const DB_NAME = 'finance_guest_db';
const DB_VERSION = 1;
const GUEST_MODE_KEY = 'app_mode';

const stores = ['wallets', 'budgetCategories', 'budgets', 'transactions'];

const legacyDefaultCategories = [
  { name: 'Belanja', icon: 'shopping-bag', color: '#8b5cf6' },
  { name: 'Gaji', icon: 'wallet', color: '#22c55e' },
  { name: 'Lainnya', icon: 'more-horizontal', color: '#64748b' },
  { name: 'Makanan', icon: 'utensils', color: '#ef4444' },
  { name: 'Tagihan', icon: 'receipt', color: '#0ea5e9' },
  { name: 'Transportasi', icon: 'car', color: '#f59e0b' },
];

const openGuestDb = () => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, DB_VERSION);

  request.onupgradeneeded = () => {
    const db = request.result;

    stores.forEach((storeName) => {
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
      }
    });
  };

  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const withStore = async (storeName, mode, callback) => {
  const db = await openGuestDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = callback(store);

    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  }).finally(() => db.close());
};

const requestToPromise = (request) => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});

const getAll = (storeName) => withStore(storeName, 'readonly', (store) => requestToPromise(store.getAll()));

const addItem = (storeName, item) => withStore(storeName, 'readwrite', async (store) => {
  const now = new Date().toISOString();
  const id = await requestToPromise(store.add({ ...item, created_at: now, updated_at: now }));

  return { ...item, id, created_at: now, updated_at: now };
});

const putItem = (storeName, item) => withStore(storeName, 'readwrite', (store) => requestToPromise(store.put({
  ...item,
  updated_at: new Date().toISOString(),
})));

const deleteItem = (storeName, id) => withStore(storeName, 'readwrite', (store) => requestToPromise(store.delete(Number(id))));

export const isGuestMode = () => localStorage.getItem(GUEST_MODE_KEY) === 'guest';

export const startGuestMode = () => {
  localStorage.setItem(GUEST_MODE_KEY, 'guest');
  localStorage.setItem('user_info', JSON.stringify({
    id: 'guest',
    name: 'Tamu',
    email: '',
    has_wallet_setup: false,
    is_guest: true,
  }));
};

export const stopGuestMode = () => {
  if (isGuestMode()) {
    localStorage.removeItem(GUEST_MODE_KEY);
  }
};

export const clearGuestData = () => new Promise((resolve, reject) => {
  const request = indexedDB.deleteDatabase(DB_NAME);

  request.onsuccess = () => {
    localStorage.removeItem(GUEST_MODE_KEY);
    localStorage.removeItem('user_info');
    localStorage.removeItem('auth_token');
    resolve();
  };
  request.onerror = () => reject(request.error);
  request.onblocked = () => {
    reject(new Error('Data tamu sedang digunakan. Tutup aplikasi lalu coba lagi.'));
  };
});

export const ensureGuestCategories = async () => {
  const [categories, transactions, budgets] = await Promise.all([
    getAll('budgetCategories'),
    getAll('transactions'),
    getAll('budgets'),
  ]);

  for (const legacyCategory of legacyDefaultCategories) {
    const category = categories.find((item) => (
      item.name === legacyCategory.name
      && item.icon === legacyCategory.icon
      && item.color === legacyCategory.color
      && item.is_active !== false
    ));

    if (!category) {
      continue;
    }

    const isUsed = transactions.some((transaction) => Number(transaction.budget_category_id) === Number(category.id))
      || budgets.some((budget) => Number(budget.budget_category_id) === Number(category.id));

    if (!isUsed) {
      await deleteItem('budgetCategories', category.id);
    }
  }

  return getAll('budgetCategories');
};

export const guestStorage = {
  async getWallets() {
    return getAll('wallets');
  },

  async addWallet({ name, type, opening_balance }) {
    const balance = Number(opening_balance || 0);
    const wallets = await getAll('wallets');

    return addItem('wallets', {
      name,
      type,
      opening_balance: balance,
      current_balance: balance,
      is_default: wallets.length === 0,
      is_active: true,
    });
  },

  async getBudgetCategories() {
    const categories = await ensureGuestCategories();

    return categories
      .filter((category) => category.is_active !== false)
      .sort((first, second) => first.name.localeCompare(second.name));
  },

  async addBudgetCategory({ name }) {
    const categories = await getAll('budgetCategories');
    const duplicate = categories.some(
      (category) => category.is_active !== false && category.name.toLowerCase() === name.toLowerCase(),
    );

    if (duplicate) {
      throw new Error('Kategori dengan nama ini sudah ada.');
    }

    return addItem('budgetCategories', {
      name,
      icon: 'tag',
      color: '#0056b3',
      is_active: true,
    });
  },

  async getTransactions() {
    const [transactions, wallets, categories] = await Promise.all([
      getAll('transactions'),
      getAll('wallets'),
      this.getBudgetCategories(),
    ]);

    return transactions
      .map((transaction) => ({
        ...transaction,
        wallet: wallets.find((wallet) => Number(wallet.id) === Number(transaction.wallet_id)) || null,
        to_wallet: wallets.find((wallet) => Number(wallet.id) === Number(transaction.to_wallet_id)) || null,
        category: categories.find((category) => Number(category.id) === Number(transaction.budget_category_id)) || null,
        attachments: transaction.attachments || [],
      }))
      .sort((first, second) => new Date(second.trx_date) - new Date(first.trx_date) || Number(second.id) - Number(first.id));
  },

  async addTransaction(payload) {
    const wallets = await getAll('wallets');
    const amount = Number(payload.amount || 0);
    const fromWallet = wallets.find((wallet) => Number(wallet.id) === Number(payload.wallet_id));
    const toWallet = wallets.find((wallet) => Number(wallet.id) === Number(payload.to_wallet_id));

    if (!fromWallet) {
      throw new Error('Dompet transaksi tidak ditemukan.');
    }

    if (payload.type === 'expense' && Number(fromWallet.current_balance || 0) < amount) {
      throw new Error('Saldo dompet tidak cukup.');
    }

    if (payload.type === 'transfer' && (!toWallet || Number(fromWallet.id) === Number(toWallet.id))) {
      throw new Error('Dompet tujuan transfer tidak valid.');
    }

    if (payload.type === 'income') {
      await putItem('wallets', { ...fromWallet, current_balance: Number(fromWallet.current_balance || 0) + amount });
    }

    if (payload.type === 'expense') {
      await putItem('wallets', { ...fromWallet, current_balance: Number(fromWallet.current_balance || 0) - amount });
    }

    if (payload.type === 'transfer') {
      await putItem('wallets', { ...fromWallet, current_balance: Number(fromWallet.current_balance || 0) - amount });
      await putItem('wallets', { ...toWallet, current_balance: Number(toWallet.current_balance || 0) + amount });
    }

    return addItem('transactions', {
      type: payload.type,
      wallet_id: Number(payload.wallet_id),
      to_wallet_id: payload.type === 'transfer' ? Number(payload.to_wallet_id) : null,
      budget_category_id: payload.budget_category_id ? Number(payload.budget_category_id) : null,
      amount,
      trx_date: payload.trx_date,
      note: payload.note || '',
      status: 'completed',
      attachments: [],
    });
  },

  async deleteTransaction(id) {
    const transactions = await getAll('transactions');
    const wallets = await getAll('wallets');
    const transaction = transactions.find((item) => Number(item.id) === Number(id));

    if (!transaction) {
      return;
    }

    const amount = Number(transaction.amount || 0);
    const fromWallet = wallets.find((wallet) => Number(wallet.id) === Number(transaction.wallet_id));
    const toWallet = wallets.find((wallet) => Number(wallet.id) === Number(transaction.to_wallet_id));

    if (transaction.type === 'income' && fromWallet) {
      await putItem('wallets', { ...fromWallet, current_balance: Number(fromWallet.current_balance || 0) - amount });
    }

    if (transaction.type === 'expense' && fromWallet) {
      await putItem('wallets', { ...fromWallet, current_balance: Number(fromWallet.current_balance || 0) + amount });
    }

    if (transaction.type === 'transfer' && fromWallet && toWallet) {
      await putItem('wallets', { ...fromWallet, current_balance: Number(fromWallet.current_balance || 0) + amount });
      await putItem('wallets', { ...toWallet, current_balance: Number(toWallet.current_balance || 0) - amount });
    }

    await deleteItem('transactions', id);
  },

  async getBudgetSummary(year, month) {
    const [categories, budgets, transactions] = await Promise.all([
      this.getBudgetCategories(),
      getAll('budgets'),
      getAll('transactions'),
    ]);

    const budgetByCategory = new Map(
      budgets
        .filter((budget) => Number(budget.period_year) === Number(year) && Number(budget.period_month) === Number(month))
        .map((budget) => [Number(budget.budget_category_id), budget]),
    );

    const items = categories.map((category) => {
      const budget = budgetByCategory.get(Number(category.id));
      const limit = Number(budget?.amount || 0);
      const spent = transactions
        .filter((transaction) => {
          const transactionDate = new Date(transaction.trx_date);

          return transaction.type === 'expense'
            && Number(transaction.budget_category_id) === Number(category.id)
            && transactionDate.getFullYear() === Number(year)
            && transactionDate.getMonth() + 1 === Number(month);
        })
        .reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);

      return {
        budget_id: budget?.id || null,
        category_id: category.id,
        category_name: category.name,
        category_icon: category.icon,
        category_color: category.color,
        limit,
        spent,
        remaining: limit - spent,
        percentage: limit > 0 ? Math.min(Math.round((spent / limit) * 100), 999) : 0,
      };
    });

    const totalLimit = items.reduce((sum, item) => sum + Number(item.limit || 0), 0);
    const totalSpent = items.reduce((sum, item) => sum + Number(item.spent || 0), 0);

    return {
      period_year: Number(year),
      period_month: Number(month),
      total_limit: totalLimit,
      total_spent: totalSpent,
      total_remaining: totalLimit - totalSpent,
      percentage: totalLimit > 0 ? Math.min(Math.round((totalSpent / totalLimit) * 100), 999) : 0,
      items,
    };
  },

  async saveBudget({ budget_category_id, period_year, period_month, amount }) {
    const budgets = await getAll('budgets');
    const existing = budgets.find((budget) => (
      Number(budget.budget_category_id) === Number(budget_category_id)
      && Number(budget.period_year) === Number(period_year)
      && Number(budget.period_month) === Number(period_month)
    ));

    if (existing) {
      await putItem('budgets', { ...existing, amount: Number(amount || 0) });
      return { ...existing, amount: Number(amount || 0) };
    }

    return addItem('budgets', {
      budget_category_id: Number(budget_category_id),
      period_year: Number(period_year),
      period_month: Number(period_month),
      amount: Number(amount || 0),
    });
  },

  async copyPreviousBudgets(periodYear, periodMonth) {
    const budgets = await getAll('budgets');
    const previousMonth = Number(periodMonth) === 1 ? 12 : Number(periodMonth) - 1;
    const previousYear = Number(periodMonth) === 1 ? Number(periodYear) - 1 : Number(periodYear);
    const previousBudgets = budgets.filter((budget) => (
      Number(budget.period_year) === previousYear && Number(budget.period_month) === previousMonth
    ));

    if (previousBudgets.length === 0) {
      throw new Error('Belum ada limit anggaran di bulan sebelumnya.');
    }

    for (const budget of previousBudgets) {
      await this.saveBudget({
        budget_category_id: budget.budget_category_id,
        period_year: periodYear,
        period_month: periodMonth,
        amount: budget.amount,
      });
    }

    return this.getBudgetSummary(periodYear, periodMonth);
  },

  async getMigrationPayload() {
    const [wallets, budgetCategories, budgets, transactions] = await Promise.all(stores.map((storeName) => getAll(storeName)));

    return { wallets, budgetCategories, budgets, transactions };
  },

  async deleteBudget(id) {
    return deleteItem('budgets', id);
  },

  async deleteBudgetCategory(id) {
    const categories = await this.getBudgetCategories();
    const category = categories.find((item) => Number(item.id) === Number(id));

    if (!category) {
      return;
    }

    const transactions = await getAll('transactions');
    const budgets = await getAll('budgets');

    for (const transaction of transactions) {
      if (Number(transaction.budget_category_id) === Number(id)) {
        await putItem('transactions', { ...transaction, budget_category_id: null });
      }
    }

    for (const budget of budgets) {
      if (Number(budget.budget_category_id) === Number(id)) {
        await deleteItem('budgets', budget.id);
      }
    }

    await putItem('budgetCategories', { ...category, is_active: false });
  },
};
