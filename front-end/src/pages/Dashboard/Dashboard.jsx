import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  ArrowDownUp,
  BarChart3,
  CalendarDays,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  EyeOff,
  FileText,
  Filter,
  LockKeyhole,
  Home,
  Image,
  LogOut,
  Moon,
  Pencil,
  Plus,
  Puzzle,
  ReceiptText,
  Settings,
  Trash2,
  Users,
  Sun,
  Tag,
  Target,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import ConfirmationDialog from '../../components/ConfirmationDialog';
import { API_BASE_URL, API_URL, clearAuthSession, isUnauthorizedError } from '../../utils/api';
import { formatMoneyInput, moneyInputToNumber, parseMoneyInput } from '../../utils/currencyInput';
import { guestStorage, isGuestMode } from '../../utils/guestStorage';

const typeOptions = [
  { label: 'Pengeluaran', value: 'expense' },
  { label: 'Pemasukan', value: 'income' },
  { label: 'Transfer', value: 'transfer' },
];

const walletTypeLabels = {
  cash: 'Tunai',
  bank: 'Bank',
  'e-wallet': 'E-Wallet',
  other: 'Lainnya',
};

const walletChartColors = ['#0056b3', '#0f9f6e', '#f59e0b', '#dc2626', '#7c3aed'];

const navItems = [
  { key: 'home', label: 'Beranda', icon: Home },
  { key: 'history', label: 'Riwayat', icon: Clock3 },
  { key: 'budget', label: 'Anggaran', icon: BarChart3 },
  { key: 'more', label: 'Lainnya', icon: Puzzle },
];

const getToday = () => new Date().toISOString().slice(0, 10);

const initialTransactionForm = {
  type: 'expense',
  wallet_id: '',
  to_wallet_id: '',
  budget_category_id: '',
  amount: '',
  trx_date: getToday(),
  note: '',
  attachment: null,
};

const initialHistoryFilters = {
  wallet_id: 'all',
  type: 'all',
  period: 'month',
};

const initialBudgetForm = {
  budget_category_id: '',
  amount: '',
};

const initialBudgetCategoryForm = {
  name: '',
};

const initialPasswordForm = {
  current_password: '',
  password: '',
  password_confirmation: '',
};

const Dashboard = () => {
  const navigate = useNavigate();
  const [activeView, setActiveView] = useState('home');
  const [wallets, setWallets] = useState([]);
  const [budgetCategories, setBudgetCategories] = useState([]);
  const [budgetSummary, setBudgetSummary] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [historyFilters, setHistoryFilters] = useState(initialHistoryFilters);
  const [budgetMonth] = useState(getToday().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [loadingTransactionDetail, setLoadingTransactionDetail] = useState(false);
  const [showDashboardAmounts, setShowDashboardAmounts] = useState(true);
  const [savingTransaction, setSavingTransaction] = useState(false);
  const [savingBudget, setSavingBudget] = useState(false);
  const [savingBudgetCategory, setSavingBudgetCategory] = useState(false);
  const [savingBudgetCopy, setSavingBudgetCopy] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [clockDate, setClockDate] = useState(() => new Date());
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showBudgetCategoryModal, setShowBudgetCategoryModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [selectedBudgetItem, setSelectedBudgetItem] = useState(null);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactionForm, setTransactionForm] = useState(initialTransactionForm);
  const [budgetForm, setBudgetForm] = useState(initialBudgetForm);
  const [budgetCategoryForm, setBudgetCategoryForm] = useState(initialBudgetCategoryForm);
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [attachmentPreview, setAttachmentPreview] = useState('');

  const token = localStorage.getItem('auth_token');
  const isGuest = isGuestMode();
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');

  const authHeaders = useMemo(
    () => ({
      headers: { Authorization: `Bearer ${token}` },
    }),
    [token],
  );

  const fetchWallets = useCallback(async () => {
    if (isGuest) {
      setWallets(await guestStorage.getWallets());
      return;
    }

    const response = await axios.get(`${API_URL}/wallets`, authHeaders);
    setWallets(response.data?.data || []);
  }, [authHeaders, isGuest]);

  const fetchTransactions = useCallback(async () => {
    if (isGuest) {
      setTransactions(await guestStorage.getTransactions());
      return;
    }

    const response = await axios.get(`${API_URL}/transactions?per_page=100`, authHeaders);
    setTransactions(response.data?.data || []);
  }, [authHeaders, isGuest]);

  const fetchBudgetCategories = useCallback(async () => {
    if (isGuest) {
      setBudgetCategories(await guestStorage.getBudgetCategories());
      return;
    }

    const response = await axios.get(`${API_URL}/budget-categories`, authHeaders);
    setBudgetCategories(response.data?.data || []);
  }, [authHeaders, isGuest]);

  const fetchBudgets = useCallback(async () => {
    const [year, month] = budgetMonth.split('-');
    if (isGuest) {
      setBudgetSummary(await guestStorage.getBudgetSummary(Number(year), Number(month)));
      return;
    }

    const response = await axios.get(`${API_URL}/budgets?year=${year}&month=${Number(month)}`, authHeaders);
    setBudgetSummary(response.data?.data || null);
  }, [authHeaders, budgetMonth, isGuest]);

  const handleUnauthorized = useCallback((error) => {
    if (!isUnauthorizedError(error)) {
      return false;
    }

    clearAuthSession();
    toast.error('Sesi login berakhir. Silakan masuk lagi.');
    navigate('/login', { replace: true });

    return true;
  }, [navigate]);

  const loadDashboard = useCallback(async () => {
    try {
      await Promise.all([fetchWallets(), fetchTransactions(), fetchBudgetCategories(), fetchBudgets()]);
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      toast.error('Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  }, [fetchBudgetCategories, fetchBudgets, fetchTransactions, fetchWallets, handleUnauthorized]);

  useEffect(() => {
    if (!token && !isGuest) {
      navigate('/login');
      return;
    }

    loadDashboard();
  }, [isGuest, loadDashboard, navigate, token]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setClockDate(new Date());
    }, 60000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!showTransactionModal || wallets.length === 0) {
      return;
    }

    setTransactionForm((currentForm) => ({
      ...currentForm,
      wallet_id: currentForm.wallet_id || String(wallets[0].id),
      to_wallet_id:
        currentForm.to_wallet_id ||
        String(wallets.find((wallet) => String(wallet.id) !== String(wallets[0].id))?.id || ''),
      budget_category_id: currentForm.budget_category_id || String(budgetCategories[0]?.id || ''),
    }));
  }, [budgetCategories, showTransactionModal, wallets]);

  useEffect(() => {
    if (!showBudgetModal) {
      return;
    }

    setBudgetForm((currentForm) => ({
      ...currentForm,
      budget_category_id: currentForm.budget_category_id || String(budgetCategories[0]?.id || ''),
    }));
  }, [budgetCategories, showBudgetModal]);

  useEffect(() => {
    return () => {
      if (attachmentPreview) {
        URL.revokeObjectURL(attachmentPreview);
      }
    };
  }, [attachmentPreview]);

  const totalSaldo = useMemo(
    () => wallets.reduce((sum, wallet) => sum + Number(wallet.current_balance || 0), 0),
    [wallets],
  );

  const currentMonthSummary = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    return transactions.reduce(
      (summary, transaction) => {
        const transactionDate = new Date(transaction.trx_date);
        const isCurrentMonth =
          transactionDate.getMonth() === currentMonth && transactionDate.getFullYear() === currentYear;

        if (!isCurrentMonth) {
          return summary;
        }

        if (transaction.type === 'income') {
          return { ...summary, income: summary.income + Number(transaction.amount || 0) };
        }

        if (transaction.type === 'expense') {
          return { ...summary, expense: summary.expense + Number(transaction.amount || 0) };
        }

        return summary;
      },
      { income: 0, expense: 0 },
    );
  }, [transactions]);

  const filteredTransactions = useMemo(() => {
    const now = new Date();

    return transactions.filter((transaction) => {
      const transactionDate = new Date(transaction.trx_date);
      const matchWallet =
        historyFilters.wallet_id === 'all' ||
        String(transaction.wallet_id) === historyFilters.wallet_id ||
        String(transaction.to_wallet_id) === historyFilters.wallet_id;
      const matchType = historyFilters.type === 'all' || transaction.type === historyFilters.type;
      const matchPeriod =
        historyFilters.period === 'all' ||
        (historyFilters.period === 'month' &&
          transactionDate.getMonth() === now.getMonth() &&
          transactionDate.getFullYear() === now.getFullYear());

      return matchWallet && matchType && matchPeriod;
    });
  }, [historyFilters, transactions]);

  const formatRupiah = (amount) => {
    const value = Number(amount || 0);
    const sign = value < 0 ? '-' : '';

    return `${sign}Rp${Math.abs(value).toLocaleString('id-ID')}`;
  };
  const formatDate = (date) =>
    new Date(date).toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  const formatDateTime = (date) =>
    new Date(date).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  const getAttachmentUrl = (path) => {
    if (!path) {
      return '';
    }

    return path.startsWith('http') ? path : `${API_BASE_URL}${path}`;
  };
  const currentHour = clockDate.getHours();
  const isNightTime = currentHour >= 18 || currentHour < 6;
  const TimeIcon = isNightTime ? Moon : Sun;
  const currentTime = clockDate.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  const pageTitle = activeView === 'history' ? 'Riwayat transaksi' : 'Catat uangmu dengan mudah';
  const pageSubtitle = activeView === 'history'
    ? 'Lihat semua pemasukan dan pengeluaran kamu.'
    : 'Semua dompet & pengeluaran kamu di satu aplikasi.';
  const resolvedPageTitle =
    activeView === 'profile'
      ? 'Profil & Pengaturan'
      : activeView === 'more'
        ? 'Fitur lainnya'
        : activeView === 'budget'
      ? 'Kelola anggaran bulanan'
      : activeView === 'history'
        ? 'Riwayat transaksi'
        : pageTitle;
  const resolvedPageSubtitle =
    activeView === 'profile'
      ? 'Kelola akun dan keamanan aplikasi.'
      : activeView === 'more'
        ? 'Kelola fitur tambahan dan pengaturan akun.'
        : activeView === 'budget'
      ? 'Pastikan pengeluaran tetap aman dan terkontrol.'
      : pageSubtitle;

  const updateTransactionForm = (field, value) => {
    setTransactionForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const updateHistoryFilter = (field, value) => {
    setHistoryFilters((currentFilters) => ({
      ...currentFilters,
      [field]: value,
    }));
  };

  const handleAmountChange = (value) => {
    updateTransactionForm('amount', formatMoneyInput(value));
  };

  const handleBudgetAmountChange = (value) => {
    setBudgetForm((currentForm) => ({
      ...currentForm,
      amount: formatMoneyInput(value),
    }));
  };

  const handleTypeChange = (type) => {
    setTransactionForm((currentForm) => {
      const fromWalletId = currentForm.wallet_id || String(wallets[0]?.id || '');
      const fallbackToWalletId = String(wallets.find((wallet) => String(wallet.id) !== fromWalletId)?.id || '');

      return {
        ...currentForm,
        type,
        to_wallet_id: type === 'transfer' ? currentForm.to_wallet_id || fallbackToWalletId : '',
      };
    });
  };

  const handleWalletChange = (walletId) => {
    setTransactionForm((currentForm) => {
      const fallbackToWalletId = String(wallets.find((wallet) => String(wallet.id) !== walletId)?.id || '');

      return {
        ...currentForm,
        wallet_id: walletId,
        to_wallet_id:
          currentForm.type === 'transfer' && currentForm.to_wallet_id === walletId
            ? fallbackToWalletId
            : currentForm.to_wallet_id,
      };
    });
  };

  const scanReceiptFile = async (file) => {
    if (isGuest) {
      toast.error('Baca struk otomatis tersedia setelah masuk dengan akun online.');
      return;
    }

    const payload = new FormData();
    payload.append('receipt', file);

    const loadingToast = toast.loading('Membaca struk...');
    setScanningReceipt(true);

    try {
      const response = await axios.post(`${API_URL}/transactions/scan-receipt`, payload, authHeaders);
      const parsed = response.data?.data?.parsed || {};

      setTransactionForm((currentForm) => ({
        ...currentForm,
        type: 'expense',
        amount: parsed.amount ? formatMoneyInput(parsed.amount) : currentForm.amount,
        trx_date: parsed.trx_date || currentForm.trx_date,
        note: parsed.note || currentForm.note,
        budget_category_id: parsed.budget_category_id
          ? String(parsed.budget_category_id)
          : currentForm.budget_category_id,
      }));

      toast.dismiss(loadingToast);
      toast.success('Struk terbaca. Cek ulang sebelum disimpan.');
    } catch (error) {
      toast.dismiss(loadingToast);
      if (handleUnauthorized(error)) {
        return;
      }

      toast.error(getValidationMessage(error));
    } finally {
      setScanningReceipt(false);
    }
  };

  const handleFileChange = (event) => {
    if (isGuest) {
      toast.error('Mode tamu tidak mendukung upload gambar atau baca struk otomatis.');
      event.target.value = '';
      return;
    }

    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    const maxSize = 5 * 1024 * 1024;

    if (!allowedTypes.includes(file.type)) {
      toast.error('File harus berupa JPG, PNG, WebP, atau PDF.');
      event.target.value = '';
      return;
    }

    if (file.size > maxSize) {
      toast.error('Ukuran file maksimal 5 MB.');
      event.target.value = '';
      return;
    }

    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
    }

    updateTransactionForm('attachment', file);
    setAttachmentPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : '');

    if (file.type.startsWith('image/')) {
      scanReceiptFile(file);
    }
  };

  const removeAttachment = () => {
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
    }

    setAttachmentPreview('');
    updateTransactionForm('attachment', null);
  };

  const resetTransactionForm = () => {
    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
    }

    setAttachmentPreview('');
    setEditingTransaction(null);
    setTransactionForm({
      ...initialTransactionForm,
      trx_date: getToday(),
      wallet_id: wallets[0]?.id ? String(wallets[0].id) : '',
      to_wallet_id: wallets[1]?.id ? String(wallets[1].id) : '',
      budget_category_id: budgetCategories[0]?.id ? String(budgetCategories[0].id) : '',
    });
  };

  const closeTransactionModal = () => {
    setShowTransactionModal(false);
    resetTransactionForm();
  };

  const openBudgetModal = (budgetItem = null) => {
    setSelectedBudgetItem(budgetItem);
    setBudgetForm({
      budget_category_id: String(budgetItem?.category_id || budgetCategories[0]?.id || ''),
      amount: budgetItem ? formatMoneyInput(budgetItem.limit) : '',
    });
    setShowBudgetModal(true);
  };

  const closeBudgetModal = () => {
    setShowBudgetModal(false);
    setSelectedBudgetItem(null);
    setBudgetForm(initialBudgetForm);
  };

  const closeBudgetCategoryModal = () => {
    setShowBudgetCategoryModal(false);
    setBudgetCategoryForm(initialBudgetCategoryForm);
  };

  const openConfirmDialog = (options) => {
    setConfirmDialog(options);
  };

  const closeConfirmDialog = () => {
    if (confirmLoading) {
      return;
    }

    setConfirmDialog(null);
  };

  const confirmDialogAction = async () => {
    if (!confirmDialog?.onConfirm) {
      setConfirmDialog(null);
      return;
    }

    setConfirmLoading(true);

    try {
      await confirmDialog.onConfirm();
      setConfirmDialog(null);
    } finally {
      setConfirmLoading(false);
    }
  };

  const getValidationMessage = (error) => {
    const errors = error.response?.data?.errors;

    if (errors) {
      const firstError = Object.values(errors)[0]?.[0];
      if (firstError) {
        return firstError;
      }
    }

    return error.response?.data?.message || error.message || 'Transaksi gagal disimpan.';
  };

  const getTransactionMeta = (transaction) => {
    if (transaction.type === 'transfer') {
      return {
        label: 'Transfer',
        title: transaction.note || `${transaction.wallet?.name || 'Dompet'} ke ${transaction.to_wallet?.name || 'Dompet'}`,
        detail: `${transaction.wallet?.name || '-'} -> ${transaction.to_wallet?.name || '-'}`,
        amount: formatRupiah(transaction.amount),
        amountClass: 'text-[#0056b3]',
        icon: ArrowDownUp,
      };
    }

    if (transaction.type === 'income') {
      return {
        label: 'Pemasukan',
        title: transaction.note || transaction.category?.name || 'Pemasukan',
        detail: `Dompet: ${transaction.wallet?.name || '-'}${transaction.category?.name ? ` - Kategori: ${transaction.category.name}` : ''}`,
        amount: `+${formatRupiah(transaction.amount)}`,
        amountClass: 'text-green-600',
        icon: Wallet,
      };
    }

    return {
      label: 'Pengeluaran',
      title: transaction.note || transaction.category?.name || 'Pengeluaran',
      detail: `Dompet: ${transaction.wallet?.name || '-'}${transaction.category?.name ? ` - Kategori: ${transaction.category.name}` : ''}`,
      amount: `-${formatRupiah(transaction.amount)}`,
      amountClass: 'text-red-600',
      icon: ReceiptText,
    };
  };

  const openTransactionDetail = async (transactionId) => {
    setLoadingTransactionDetail(true);

    try {
      if (isGuest) {
        setSelectedTransaction(transactions.find((transaction) => Number(transaction.id) === Number(transactionId)) || null);
        return;
      }

      const response = await axios.get(`${API_URL}/transactions/${transactionId}`, authHeaders);
      setSelectedTransaction(response.data?.data || null);
    } catch (error) {
      if (handleUnauthorized(error)) {
        return;
      }

      toast.error('Gagal memuat detail transaksi.');
    } finally {
      setLoadingTransactionDetail(false);
    }
  };

  const closeTransactionDetail = () => {
    setSelectedTransaction(null);
  };

  const openEditTransaction = () => {
    if (!selectedTransaction) {
      return;
    }

    if (attachmentPreview) {
      URL.revokeObjectURL(attachmentPreview);
    }

    const transactionDate = selectedTransaction.trx_date
      ? new Date(selectedTransaction.trx_date).toISOString().slice(0, 10)
      : getToday();

    setEditingTransaction(selectedTransaction);
    setAttachmentPreview('');
    setTransactionForm({
      type: selectedTransaction.type || 'expense',
      wallet_id: selectedTransaction.wallet_id ? String(selectedTransaction.wallet_id) : '',
      to_wallet_id: selectedTransaction.to_wallet_id ? String(selectedTransaction.to_wallet_id) : '',
      budget_category_id: selectedTransaction.budget_category_id ? String(selectedTransaction.budget_category_id) : '',
      amount: formatMoneyInput(selectedTransaction.amount),
      trx_date: transactionDate,
      note: selectedTransaction.note || '',
      attachment: null,
    });
    setSelectedTransaction(null);
    setShowTransactionModal(true);
  };

  const handleDeleteTransaction = async () => {
    if (!selectedTransaction) {
      return;
    }

    openConfirmDialog({
      title: 'Hapus transaksi?',
      description: 'Saldo dompet akan dikembalikan sesuai efek transaksi ini. Aksi ini tidak bisa dibatalkan.',
      confirmLabel: 'Hapus',
      tone: 'danger',
      onConfirm: async () => {
        const loadingToast = toast.loading('Menghapus transaksi...');

        try {
          if (isGuest) {
            await guestStorage.deleteTransaction(selectedTransaction.id);
          } else {
            await axios.delete(`${API_URL}/transactions/${selectedTransaction.id}`, authHeaders);
          }
          toast.dismiss(loadingToast);
          toast.success('Transaksi berhasil dihapus.');
          setSelectedTransaction(null);
          await loadDashboard();
        } catch (error) {
          toast.dismiss(loadingToast);
          if (handleUnauthorized(error)) {
            return;
          }

          toast.error(getValidationMessage(error));
        }
      },
    });
  };

  const handleSubmitTransaction = async (event) => {
    event.preventDefault();

    if (wallets.length === 0) {
      toast.error('Buat dompet dulu sebelum mencatat transaksi.');
      return;
    }

    if (!transactionForm.wallet_id) {
      toast.error('Pilih dompet transaksi.');
      return;
    }

    if (transactionForm.type === 'expense' && !transactionForm.budget_category_id) {
      toast.error('Buat atau pilih kategori pengeluaran terlebih dahulu.');
      return;
    }

    const rawAmount = parseMoneyInput(transactionForm.amount);

    if (moneyInputToNumber(transactionForm.amount) <= 0) {
      toast.error('Jumlah transaksi harus lebih dari 0.');
      return;
    }

    if (transactionForm.type === 'transfer') {
      if (!transactionForm.to_wallet_id) {
        toast.error('Pilih dompet tujuan transfer.');
        return;
      }

      if (transactionForm.wallet_id === transactionForm.to_wallet_id) {
        toast.error('Dompet asal dan tujuan harus berbeda.');
        return;
      }
    }

    const payload = new FormData();
    payload.append('type', transactionForm.type);
    payload.append('wallet_id', transactionForm.wallet_id);
    payload.append('amount', rawAmount);
    payload.append('trx_date', transactionForm.trx_date);

    if (transactionForm.type === 'transfer') {
      payload.append('to_wallet_id', transactionForm.to_wallet_id);
    }

    if (transactionForm.note.trim()) {
      payload.append('note', transactionForm.note.trim());
    }

    if (transactionForm.type !== 'transfer' && transactionForm.budget_category_id) {
      payload.append('budget_category_id', transactionForm.budget_category_id);
    }

    if (!isGuest && transactionForm.attachment) {
      payload.append('attachment', transactionForm.attachment);
    }

    const loadingToast = toast.loading(editingTransaction ? 'Memperbarui transaksi...' : 'Menyimpan transaksi...');
    setSavingTransaction(true);

    try {
      if (isGuest) {
        if (editingTransaction) {
          await guestStorage.deleteTransaction(editingTransaction.id);
        }

        await guestStorage.addTransaction({
          type: transactionForm.type,
          wallet_id: transactionForm.wallet_id,
          to_wallet_id: transactionForm.to_wallet_id,
          budget_category_id: transactionForm.budget_category_id,
          amount: rawAmount,
          trx_date: transactionForm.trx_date,
          note: transactionForm.note.trim(),
        });
      } else if (editingTransaction) {
        payload.append('_method', 'PATCH');
        await axios.post(`${API_URL}/transactions/${editingTransaction.id}`, payload, authHeaders);
      } else {
        await axios.post(`${API_URL}/transactions`, payload, authHeaders);
      }

      toast.dismiss(loadingToast);
      toast.success(editingTransaction ? 'Transaksi berhasil diperbarui.' : 'Transaksi berhasil disimpan.');
      setShowTransactionModal(false);
      resetTransactionForm();
      await loadDashboard();
    } catch (error) {
      toast.dismiss(loadingToast);
      if (handleUnauthorized(error)) {
        return;
      }

      toast.error(getValidationMessage(error));
    } finally {
      setSavingTransaction(false);
    }
  };

  const handleSubmitBudget = async (event) => {
    event.preventDefault();

    if (!budgetForm.budget_category_id) {
      toast.error('Pilih kategori anggaran.');
      return;
    }

    const rawAmount = parseMoneyInput(budgetForm.amount);

    if (moneyInputToNumber(budgetForm.amount) <= 0) {
      toast.error('Limit anggaran harus lebih dari 0.');
      return;
    }

    const [year, month] = budgetMonth.split('-');
    const loadingToast = toast.loading('Menyimpan anggaran...');
    setSavingBudget(true);

    try {
      if (isGuest) {
        await guestStorage.saveBudget({
          budget_category_id: budgetForm.budget_category_id,
          period_year: Number(year),
          period_month: Number(month),
          amount: rawAmount,
        });
      } else {
        await axios.post(
          `${API_URL}/budgets`,
          {
            budget_category_id: budgetForm.budget_category_id,
            period_year: Number(year),
            period_month: Number(month),
            amount: rawAmount,
          },
          authHeaders,
        );
      }
      toast.dismiss(loadingToast);
      toast.success('Anggaran berhasil disimpan.');
      closeBudgetModal();
      await fetchBudgets();
    } catch (error) {
      toast.dismiss(loadingToast);
      if (handleUnauthorized(error)) {
        return;
      }

      toast.error(getValidationMessage(error));
    } finally {
      setSavingBudget(false);
    }
  };

  const handleDeleteBudget = async () => {
    if (!selectedBudgetItem?.budget_id) {
      toast.error('Limit anggaran belum disimpan.');
      return;
    }

    openConfirmDialog({
      title: 'Hapus limit anggaran?',
      description: 'Limit kategori ini untuk bulan berjalan akan dihapus. Kategorinya tetap ada dan transaksi tidak berubah.',
      confirmLabel: 'Hapus Limit',
      tone: 'danger',
      onConfirm: async () => {
        const loadingToast = toast.loading('Menghapus limit anggaran...');
        setSavingBudget(true);

        try {
          if (isGuest) {
            await guestStorage.deleteBudget(selectedBudgetItem.budget_id);
          } else {
            await axios.delete(`${API_URL}/budgets/${selectedBudgetItem.budget_id}`, authHeaders);
          }
          toast.dismiss(loadingToast);
          toast.success('Limit anggaran berhasil dihapus.');
          closeBudgetModal();
          await fetchBudgets();
        } catch (error) {
          toast.dismiss(loadingToast);
          if (handleUnauthorized(error)) {
            return;
          }

          toast.error(getValidationMessage(error));
        } finally {
          setSavingBudget(false);
        }
      },
    });
  };

  const handleCopyPreviousBudget = async () => {
    const [year, month] = budgetMonth.split('-');
    const loadingToast = toast.loading('Menyalin limit bulan sebelumnya...');
    setSavingBudgetCopy(true);

    try {
      if (isGuest) {
        const summary = await guestStorage.copyPreviousBudgets(Number(year), Number(month));
        toast.dismiss(loadingToast);
        toast.success('Limit bulan sebelumnya berhasil disalin.');
        setBudgetSummary(summary);
        return;
      }

      const response = await axios.post(
        `${API_URL}/budgets/copy-previous`,
        {
          period_year: Number(year),
          period_month: Number(month),
        },
        authHeaders,
      );

      toast.dismiss(loadingToast);
      toast.success(response.data?.message || 'Limit bulan sebelumnya berhasil disalin.');
      setBudgetSummary(response.data?.data || null);
    } catch (error) {
      toast.dismiss(loadingToast);
      if (handleUnauthorized(error)) {
        return;
      }

      toast.error(getValidationMessage(error));
    } finally {
      setSavingBudgetCopy(false);
    }
  };

  const handleSubmitBudgetCategory = async (event) => {
    event.preventDefault();

    if (!budgetCategoryForm.name.trim()) {
      toast.error('Nama kategori wajib diisi.');
      return;
    }

    const loadingToast = toast.loading('Menyimpan kategori...');
    setSavingBudgetCategory(true);

    try {
      const response = isGuest
        ? { data: { data: await guestStorage.addBudgetCategory({ name: budgetCategoryForm.name.trim() }) } }
        : await axios.post(
          `${API_URL}/budget-categories`,
          {
            name: budgetCategoryForm.name.trim(),
          },
          authHeaders,
        );
      const newCategory = response.data?.data;

      toast.dismiss(loadingToast);
      toast.success('Kategori anggaran berhasil dibuat.');
      closeBudgetCategoryModal();
      await Promise.all([fetchBudgetCategories(), fetchBudgets()]);

      if (newCategory?.id) {
        openBudgetModal({
          category_id: newCategory.id,
          category_name: newCategory.name,
          limit: 0,
          budget_id: null,
        });
      }
    } catch (error) {
      toast.dismiss(loadingToast);
      if (handleUnauthorized(error)) {
        return;
      }

      toast.error(getValidationMessage(error));
    } finally {
      setSavingBudgetCategory(false);
    }
  };

  const handleDeleteBudgetCategory = async () => {
    if (!selectedBudgetItem?.category_id) {
      return;
    }

    if (!isGuest && selectedBudgetItem.category_name === 'Lainnya') {
      toast.error('Kategori Lainnya tidak bisa dihapus.');
      return;
    }

    openConfirmDialog({
      title: `Hapus kategori ${selectedBudgetItem.category_name}?`,
      description: isGuest
        ? 'Transaksi lama tidak akan hilang. Kategori pada transaksi lama akan dikosongkan.'
        : 'Transaksi lama tidak akan hilang. Semua transaksi pada kategori ini akan dipindahkan ke Lainnya.',
      confirmLabel: 'Hapus Kategori',
      tone: 'danger',
      onConfirm: async () => {
        const loadingToast = toast.loading('Menghapus kategori...');
        setSavingBudget(true);

        try {
          if (isGuest) {
            await guestStorage.deleteBudgetCategory(selectedBudgetItem.category_id);
          } else {
            await axios.delete(`${API_URL}/budget-categories/${selectedBudgetItem.category_id}`, authHeaders);
          }
          toast.dismiss(loadingToast);
          toast.success(isGuest
            ? 'Kategori berhasil dihapus. Transaksi lama tetap tersimpan tanpa kategori.'
            : 'Kategori berhasil dihapus. Transaksi lama dipindahkan ke Lainnya.');
          closeBudgetModal();
          await Promise.all([fetchBudgetCategories(), fetchBudgets(), fetchTransactions()]);
        } catch (error) {
          toast.dismiss(loadingToast);
          if (handleUnauthorized(error)) {
            return;
          }

          toast.error(getValidationMessage(error));
        } finally {
          setSavingBudget(false);
        }
      },
    });
  };

  const updatePasswordForm = (field, value) => {
    setPasswordForm((currentForm) => ({
      ...currentForm,
      [field]: value,
    }));
  };

  const handleSubmitPassword = async (event) => {
    event.preventDefault();

    if (passwordForm.password !== passwordForm.password_confirmation) {
      toast.error('Konfirmasi password baru tidak cocok.');
      return;
    }

    const loadingToast = toast.loading('Memperbarui password...');
    setSavingPassword(true);

    try {
      await axios.post(`${API_URL}/change-password`, passwordForm, authHeaders);
      toast.dismiss(loadingToast);
      toast.success('Password berhasil diperbarui.');
      setPasswordForm(initialPasswordForm);
    } catch (error) {
      toast.dismiss(loadingToast);
      if (handleUnauthorized(error)) {
        return;
      }

      toast.error(getValidationMessage(error));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleLogout = async () => {
    const loadingToast = toast.loading('Keluar dari akun...');

    try {
      if (!isGuest) {
        await axios.post(`${API_URL}/logout`, {}, authHeaders);
      }
      toast.dismiss(loadingToast);
      toast.success(isGuest ? 'Keluar dari mode tamu.' : 'Berhasil logout.');
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Sesi diakhiri dari perangkat ini.');
    } finally {
      clearAuthSession();
      navigate('/login');
    }
  };

  const activeTypeLabel = typeOptions.find((option) => option.value === transactionForm.type)?.label || 'Pengeluaran';
  const transferWallets = wallets.filter((wallet) => String(wallet.id) !== String(transactionForm.wallet_id));
  const monthlyTotalFlow = currentMonthSummary.income + currentMonthSummary.expense;
  const incomePercentage = monthlyTotalFlow > 0 ? Math.round((currentMonthSummary.income / monthlyTotalFlow) * 100) : 0;
  const expensePercentage = monthlyTotalFlow > 0 ? 100 - incomePercentage : 0;
  const budgetTotalLimit = Number(budgetSummary?.total_limit || 0);
  const budgetTotalSpent = Number(budgetSummary?.total_spent || 0);
  const budgetTotalRemaining = Number(budgetSummary?.total_remaining || 0);
  const budgetPercentage = Number(budgetSummary?.percentage || 0);
  const monthlyNetCashflow = currentMonthSummary.income - currentMonthSummary.expense;
  const recentTransactions = transactions.slice(0, 3);
  const positiveWalletTotal = wallets.reduce(
    (sum, wallet) => sum + Math.max(Number(wallet.current_balance || 0), 0),
    0,
  );
  const budgetStatusText =
    budgetTotalLimit === 0
      ? 'Belum ada limit'
      : budgetPercentage >= 90
        ? 'Hampir habis'
        : budgetPercentage >= 70
          ? 'Perlu dipantau'
          : 'Masih aman';
  const budgetStatusClass =
    budgetTotalLimit === 0
      ? 'text-gray-500'
      : budgetPercentage >= 90
        ? 'text-red-600'
        : budgetPercentage >= 70
          ? 'text-amber-600'
          : 'text-green-600';
  const dashboardAmount = (amount, prefix = '') => (
    showDashboardAmounts ? `${prefix}${formatRupiah(amount)}` : `${prefix}******`
  );
  const dashboardSignedAmount = (amount) => {
    const prefix = Number(amount || 0) >= 0 ? '+' : '-';

    return dashboardAmount(Math.abs(amount), prefix);
  };

  const renderHomeView = () => (
    <div className="px-5 mt-5 space-y-4">
      <section className="rounded-[22px] bg-white p-5 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">Total Saldo</p>
            <h2 className="mt-1 text-3xl font-bold tracking-normal text-gray-950">{dashboardAmount(totalSaldo)}</h2>
          </div>
          <button
            type="button"
            onClick={() => setShowDashboardAmounts((currentValue) => !currentValue)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-[#0056b3]"
            aria-label={showDashboardAmounts ? 'Sembunyikan nominal dashboard' : 'Tampilkan nominal dashboard'}
          >
            {showDashboardAmounts ? <Eye size={22} /> : <EyeOff size={22} />}
          </button>
        </div>

        <div className="mt-5 grid grid-cols-3 divide-x divide-gray-100 text-sm">
          <div className="pr-3">
            <p className="text-xs text-gray-500">Masuk</p>
            <p className="mt-1 font-bold text-green-600">{dashboardAmount(currentMonthSummary.income, '+')}</p>
          </div>
          <div className="px-3">
            <p className="text-xs text-gray-500">Keluar</p>
            <p className="mt-1 font-bold text-red-600">{dashboardAmount(currentMonthSummary.expense, '-')}</p>
          </div>
          <div className="pl-3">
            <p className="text-xs text-gray-500">Net</p>
            <p className={`mt-1 font-bold ${monthlyNetCashflow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {dashboardSignedAmount(monthlyNetCashflow)}
            </p>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-green-50 text-green-600">
              <TrendingUp size={18} />
            </div>
            <span className="text-xs text-gray-500">{incomePercentage}%</span>
          </div>
          <p className="text-sm text-gray-500">Pemasukan</p>
          <p className="mt-1 truncate text-xl font-bold text-gray-950">{dashboardAmount(currentMonthSummary.income)}</p>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-red-50 text-red-600">
              <TrendingDown size={18} />
            </div>
            <span className="text-xs text-gray-500">{expensePercentage}%</span>
          </div>
          <p className="text-sm text-gray-500">Pengeluaran</p>
          <p className="mt-1 truncate text-xl font-bold text-gray-950">{dashboardAmount(currentMonthSummary.expense)}</p>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-950">Dompet Aktif</h2>
            <p className="text-xs text-gray-500">{wallets.length} dompet tersimpan</p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/setup-wallet')}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0056b3] text-white"
            aria-label="Tambah dompet"
          >
            <Plus size={20} strokeWidth={3} />
          </button>
        </div>

        {loading ? (
          <p className="py-3 text-sm text-gray-500">Memuat dompet...</p>
        ) : wallets.length === 0 ? (
          <button
            type="button"
            onClick={() => navigate('/setup-wallet')}
            className="w-full rounded-xl border border-dashed border-gray-300 py-4 text-sm font-semibold text-[#0056b3]"
          >
            Buat dompet pertama
          </button>
        ) : (
          <div className="space-y-3">
            {wallets.slice(0, 4).map((wallet, index) => {
              const walletBalance = Number(wallet.current_balance || 0);
              const walletPercentage =
                positiveWalletTotal > 0 ? Math.round((Math.max(walletBalance, 0) / positiveWalletTotal) * 100) : 0;
              const walletColor = walletChartColors[index % walletChartColors.length];

              return (
                <div key={wallet.id} className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div
                      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
                      style={{
                        background: `conic-gradient(${walletColor} ${walletPercentage * 3.6}deg, #edf1f7 0deg)`,
                      }}
                      aria-label={`${wallet.name} ${walletPercentage}% dari total saldo`}
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
                        <span className="text-[11px] font-bold text-gray-900">{walletPercentage}%</span>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-950">{wallet.name}</p>
                      <p className="text-xs text-gray-500">{walletTypeLabels[wallet.type] || wallet.type}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-gray-950">{dashboardAmount(wallet.current_balance)}</p>
                    <p className="text-[11px] text-gray-500">dari total saldo</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-950">Anggaran Bulan Ini</h2>
            <p className={`text-xs font-semibold ${budgetStatusClass}`}>{budgetStatusText}</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('budget')}
            className="flex items-center text-xs font-semibold text-[#0056b3]"
          >
            Detail
            <ChevronRight size={15} />
          </button>
        </div>
        <div className="mb-3 flex items-end justify-between">
          <div>
            <p className="text-xs text-gray-500">Terpakai</p>
            <p className="text-xl font-bold text-gray-950">{dashboardAmount(budgetTotalSpent)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">Limit</p>
            <p className="text-sm font-bold text-gray-950">{dashboardAmount(budgetTotalLimit)}</p>
          </div>
        </div>
        <div className="h-2.5 rounded-full bg-[#dfe5f1]">
          <div
            className={`h-2.5 rounded-full ${budgetPercentage >= 90 ? 'bg-red-500' : 'bg-[#0056b3]'}`}
            style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
          <span>{budgetPercentage}% terpakai</span>
          <span className={budgetTotalRemaining < 0 ? 'font-semibold text-red-600' : ''}>
            {dashboardAmount(budgetTotalRemaining)} sisa
          </span>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-gray-950">Transaksi Terbaru</h2>
            <p className="text-xs text-gray-500">Aktivitas terakhir kamu</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveView('history')}
            className="flex items-center text-xs font-semibold text-[#0056b3]"
          >
            Semua
            <ChevronRight size={15} />
          </button>
        </div>

        {loading ? (
          <p className="py-3 text-sm text-gray-500">Memuat transaksi...</p>
        ) : recentTransactions.length === 0 ? (
          <div className="rounded-xl bg-gray-50 p-4 text-center">
            <Target className="mx-auto text-gray-400" size={24} />
            <p className="mt-2 text-sm text-gray-500">Belum ada transaksi bulan ini.</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {recentTransactions.map((transaction) => {
              const meta = getTransactionMeta(transaction);
              const TransactionIcon = meta.icon;

              return (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => openTransactionDetail(transaction.id)}
                  className="flex w-full items-center gap-3 py-3 text-left"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0056b3]">
                    <TransactionIcon size={18} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-950">{meta.title}</p>
                    <p className="text-xs text-gray-500">{formatDate(transaction.trx_date)}</p>
                  </div>
                  <p className={`shrink-0 text-sm font-bold ${meta.amountClass}`}>
                    {showDashboardAmounts ? meta.amount : `${transaction.type === 'income' ? '+' : transaction.type === 'expense' ? '-' : ''}******`}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );

  const renderHistoryView = () => (
    <div className="px-5 mt-5 space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-gray-900">Riwayat Transaksi</h2>
        <button
          type="button"
          onClick={() => setHistoryFilters(initialHistoryFilters)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[#0056b3]"
        >
          <Filter size={14} />
          Filter
        </button>
      </div>

      <div className="rounded-2xl bg-white p-3 shadow-sm">
        <div className="grid grid-cols-[72px_1fr] gap-x-3 gap-y-2 text-sm">
          <label htmlFor="history-wallet" className="text-gray-900">
            Dompet
          </label>
          <select
            id="history-wallet"
            className="bg-transparent text-right text-gray-600 outline-none"
            value={historyFilters.wallet_id}
            onChange={(event) => updateHistoryFilter('wallet_id', event.target.value)}
          >
            <option value="all">Semua</option>
            {wallets.map((wallet) => (
              <option key={wallet.id} value={wallet.id}>
                {wallet.name}
              </option>
            ))}
          </select>

          <label htmlFor="history-type" className="text-gray-900">
            Jenis
          </label>
          <select
            id="history-type"
            className="bg-transparent text-right text-gray-600 outline-none"
            value={historyFilters.type}
            onChange={(event) => updateHistoryFilter('type', event.target.value)}
          >
            <option value="all">Semua jenis</option>
            {typeOptions.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>

          <label htmlFor="history-period" className="text-gray-900">
            Tanggal
          </label>
          <select
            id="history-period"
            className="bg-transparent text-right text-gray-600 outline-none"
            value={historyFilters.period}
            onChange={(event) => updateHistoryFilter('period', event.target.value)}
          >
            <option value="month">Bulan ini</option>
            <option value="all">Semua waktu</option>
          </select>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-3 shadow-sm">
        {loading ? (
          <p className="py-6 text-center text-sm text-gray-500">Memuat riwayat...</p>
        ) : filteredTransactions.length === 0 ? (
          <p className="py-6 text-center text-sm text-gray-500">Belum ada transaksi.</p>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredTransactions.map((transaction) => {
              const meta = getTransactionMeta(transaction);
              const TransactionIcon = meta.icon;

              return (
                <button
                  key={transaction.id}
                  type="button"
                  onClick={() => openTransactionDetail(transaction.id)}
                  className="block w-full py-3 text-left transition active:scale-[0.99]"
                >
                  <div className="mb-2 flex items-center gap-2 text-xs text-gray-600">
                    <CalendarDays size={14} />
                    <span>{formatDate(transaction.trx_date)}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0056b3]">
                      <TransactionIcon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-gray-900">{meta.title}</p>
                      <p className="truncate text-xs text-gray-500">{meta.detail}</p>
                    </div>
                    <p className={`shrink-0 text-sm font-bold ${meta.amountClass}`}>{meta.amount}</p>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderBudgetView = () => {
    const summary = budgetSummary || {
      total_limit: 0,
      total_spent: 0,
      total_remaining: 0,
      percentage: 0,
      items: [],
    };
    const items = summary.items || [];

    return (
      <div className="px-5 mt-5 space-y-3">
        <div>
          <h2 className="text-center text-base font-bold text-gray-900">Anggaran Bulanan</h2>
          <p className="mx-auto mt-1 max-w-xs text-center text-xs text-gray-500">
            Limit hanya berlaku untuk bulan ini. Pengeluaran kategori akan mengurangi sisa anggaran.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={handleCopyPreviousBudget}
            disabled={savingBudgetCopy}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d6dfef] bg-white text-xs font-bold text-[#0056b3] shadow-sm disabled:cursor-not-allowed disabled:text-gray-400"
          >
            <Copy size={15} />
            {savingBudgetCopy ? 'Menyalin...' : 'Salin bulan lalu'}
          </button>
          <button
            type="button"
            onClick={() => setShowBudgetCategoryModal(true)}
            className="flex h-10 items-center justify-center gap-2 rounded-lg border border-[#d6dfef] bg-white text-xs font-bold text-[#0056b3] shadow-sm"
          >
            <Tag size={15} />
            Kategori baru
          </button>
        </div>

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">Total Anggaran</p>
            <p className="text-sm text-gray-600">{summary.percentage || 0}%</p>
          </div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-base font-bold text-gray-900">Terpakai: {formatRupiah(summary.total_spent)}</p>
            <p className="text-base font-bold text-gray-900">Limit: {formatRupiah(summary.total_limit)}</p>
          </div>
          <div className="h-2 rounded-full bg-[#dfe5f1]">
            <div
              className={`h-2 rounded-full ${summary.percentage >= 100 ? 'bg-red-500' : 'bg-[#0056b3]'}`}
              style={{ width: `${Math.min(summary.percentage || 0, 100)}%` }}
            />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
            <span>{summary.percentage || 0}% terpakai</span>
            <span className={Number(summary.total_remaining || 0) < 0 ? 'font-semibold text-red-600' : ''}>
              {formatRupiah(summary.total_remaining)} sisa
            </span>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl bg-white p-5 text-center text-sm text-gray-500 shadow-sm">Memuat anggaran...</div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl bg-white p-5 text-center text-sm text-gray-500 shadow-sm">
            Belum ada kategori anggaran.
          </div>
        ) : (
          items.map((item) => (
            <button
              key={item.category_id}
              type="button"
              onClick={() => openBudgetModal(item)}
              className="w-full rounded-2xl bg-white p-4 text-left shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900">{item.category_name}</p>
                <p className="text-xs text-gray-500">{item.percentage}% terpakai</p>
              </div>
              <div className="h-1.5 rounded-full bg-[#dfe5f1]">
                <div
                  className={`h-1.5 rounded-full ${item.percentage > 100 ? 'bg-red-500' : 'bg-[#0056b3]'}`}
                  style={{ width: `${Math.min(item.percentage || 0, 100)}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-600">
                <span>
                  {formatRupiah(item.spent)} / {formatRupiah(item.limit)}
                </span>
                <span className={Number(item.remaining || 0) < 0 ? 'font-semibold text-red-600' : ''}>
                  {formatRupiah(item.remaining)} sisa
                </span>
              </div>
            </button>
          ))
        )}

        <button
          type="button"
          onClick={() => openBudgetModal()}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0056b3] text-sm font-bold text-white shadow-sm"
        >
          <Plus size={18} />
          Atur Limit Anggaran
        </button>
      </div>
    );
  };

  const renderMoreView = () => (
    <div className="px-5 mt-5 space-y-3">
      <h2 className="text-base font-bold text-gray-900">Fitur Lainnya</h2>

      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-50 text-purple-700">
          <Users size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-gray-900">Catat Bareng</p>
            <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">Segera</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">Catatan bersama dengan 2 akun atau lebih dalam 1 buku.</p>
        </div>
      </button>

      <button
        type="button"
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-yellow-50 text-yellow-600">
          <Target size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="font-semibold text-gray-900">Arisan / Tabungan</p>
            <span className="rounded-full border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600">Segera</span>
          </div>
          <p className="mt-1 text-sm text-gray-500">Fitur arisan dan tabungan kolektif sedang disiapkan.</p>
        </div>
      </button>

      <button
        type="button"
        onClick={() => setActiveView('profile')}
        className="flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0056b3]">
          <Settings size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900">Profil & Pengaturan</p>
          <p className="mt-1 text-sm text-gray-500">Kelola akun, keamanan, dan sesi login.</p>
        </div>
        <ChevronRight size={18} className="text-gray-400" />
      </button>
    </div>
  );

  const renderProfileView = () => (
    <div className="px-5 mt-5 space-y-4">
      <button
        type="button"
        onClick={() => setActiveView('more')}
        className="text-sm font-semibold text-[#0056b3]"
      >
        Kembali
      </button>

      <section className="rounded-2xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-lg font-bold text-[#0056b3]">
            {(userInfo?.name || 'P').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-bold text-gray-900">{userInfo?.name || 'Pengguna'}</p>
            <p className="truncate text-sm text-gray-500">{userInfo?.email || '-'}</p>
          </div>
        </div>
      </section>

      {isGuest ? (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <LockKeyhole size={18} className="text-[#0056b3]" />
            <h2 className="font-bold text-gray-900">Mode Tamu</h2>
          </div>
          <p className="text-sm leading-6 text-gray-500">
            Data kamu saat ini tersimpan di perangkat ini. Tombol aktivasi akun online dan migrasi data akan kita buat
            pada tahap berikutnya.
          </p>
        </section>
      ) : (
        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <LockKeyhole size={18} className="text-[#0056b3]" />
            <h2 className="font-bold text-gray-900">Ganti Password</h2>
          </div>

          <form onSubmit={handleSubmitPassword} className="space-y-3">
            <input
              type="password"
              value={passwordForm.current_password}
              onChange={(event) => updatePasswordForm('current_password', event.target.value)}
              placeholder="Password lama"
              className="h-11 w-full rounded-lg border border-[#d6dfef] px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
              required
            />
            <input
              type="password"
              value={passwordForm.password}
              onChange={(event) => updatePasswordForm('password', event.target.value)}
              placeholder="Password baru"
              className="h-11 w-full rounded-lg border border-[#d6dfef] px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
              required
            />
            <input
              type="password"
              value={passwordForm.password_confirmation}
              onChange={(event) => updatePasswordForm('password_confirmation', event.target.value)}
              placeholder="Konfirmasi password baru"
              className="h-11 w-full rounded-lg border border-[#d6dfef] px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
              required
            />
            <button
              type="submit"
              disabled={savingPassword}
              className="h-11 w-full rounded-lg bg-[#0056b3] text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-gray-400"
            >
              {savingPassword ? 'Menyimpan...' : 'Simpan Password'}
            </button>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={handleLogout}
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 text-sm font-bold text-white shadow-sm"
      >
        <LogOut size={18} />
        Logout
      </button>
    </div>
  );

  const renderReceiptUpload = () => (
    <div className={`space-y-2 rounded-2xl border border-dashed p-3 ${
      isGuest ? 'border-amber-200 bg-amber-50' : 'border-[#b8c6df] bg-[#f8f9ff]'
    }`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-gray-900">Foto / Struk</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {isGuest
              ? 'Mode tamu menyimpan data di perangkat ini. Upload gambar dan baca struk otomatis tersedia setelah masuk akun online.'
              : 'Upload foto struk, form akan dicoba isi otomatis.'}
          </p>
        </div>
        {isGuest ? (
          <span className="flex h-10 shrink-0 items-center justify-center rounded-lg border border-amber-200 bg-white px-3 text-xs font-bold text-amber-700">
            Online saja
          </span>
        ) : (
          <label className="flex h-10 shrink-0 cursor-pointer items-center justify-center rounded-lg bg-[#0056b3] px-4 text-xs font-bold text-white active:bg-[#064da3]">
            {transactionForm.attachment ? 'Ganti' : 'Upload'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileChange}
              className="sr-only"
            />
          </label>
        )}
      </div>

      {scanningReceipt && (
        <div className="rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#0056b3]">
          Membaca struk dan mengisi form...
        </div>
      )}

      {transactionForm.attachment && (
        <div className="rounded-xl border border-[#d6dfef] bg-white p-2">
          <div className="flex items-center gap-3">
            {attachmentPreview ? (
              <img
                src={attachmentPreview}
                alt="Preview struk"
                className="h-14 w-14 rounded-lg object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-gray-50 text-xs font-bold text-[#0b4fa8]">
                PDF
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-gray-800">{transactionForm.attachment.name}</p>
              <p className="text-xs text-gray-500">
                {(transactionForm.attachment.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <button
              type="button"
              onClick={removeAttachment}
              className="h-8 rounded-lg px-3 text-xs font-semibold text-red-600"
            >
              Hapus
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#f2f5fb] pb-28">
      <header className="bg-[#064da3] px-5 pb-4 pt-5 text-white shadow-lg rounded-b-[18px]">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Hi, {userInfo?.name || 'Pengguna'}</p>
            <div className="flex items-center gap-1 text-sm">
              <TimeIcon size={16} className={isNightTime ? 'text-blue-100' : 'text-yellow-300'} />
              <span>{currentTime}</span>
            </div>
          </div>
          <h1 className="mt-4 text-2xl font-bold leading-tight">{resolvedPageTitle}</h1>
          <p className="mt-1 text-sm text-blue-100">{resolvedPageSubtitle}</p>
        </div>
      </header>

      <main className="mx-auto max-w-md">
        {activeView === 'home' && renderHomeView()}
        {activeView === 'history' && renderHistoryView()}
        {activeView === 'budget' && renderBudgetView()}
        {activeView === 'more' && renderMoreView()}
        {activeView === 'profile' && renderProfileView()}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-gray-200 bg-white/95 px-4 py-2 shadow-[0_-12px_28px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-5 items-end text-[11px] text-gray-500">
          {navItems.slice(0, 2).map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveView(item.key)}
                className={`flex flex-col items-center gap-1 py-1 font-medium ${isActive ? 'text-[#0056b3]' : ''}`}
              >
                <Icon size={19} strokeWidth={isActive ? 2.8 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setShowTransactionModal(true)}
            className="mx-auto -mt-8 flex h-[60px] w-[60px] items-center justify-center rounded-full bg-[#0056b3] text-white shadow-xl shadow-blue-900/25"
            aria-label="Tambah transaksi"
          >
            <Plus size={30} strokeWidth={3} />
          </button>

          {navItems.slice(2).map((item) => {
            const Icon = item.icon;
            const isActive = activeView === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setActiveView(item.key)}
                className={`flex flex-col items-center gap-1 py-1 font-medium ${isActive ? 'text-[#0056b3]' : ''}`}
              >
                <Icon size={19} strokeWidth={isActive ? 2.8 : 2} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {(selectedTransaction || loadingTransactionDetail) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-0 sm:items-center sm:px-4"
          onClick={closeTransactionDetail}
        >
          <div
            className="w-full max-w-md rounded-t-[18px] bg-white shadow-2xl sm:rounded-[18px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative rounded-t-[18px] bg-[#f4f6fb] px-4 pb-3 pt-7 sm:rounded-t-[18px]">
              <span className="absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-[#c5cad4]" />
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">Detail Transaksi</h2>
                <button
                  type="button"
                  aria-label="Tutup detail transaksi"
                  onClick={closeTransactionDetail}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-gray-600"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="max-h-[82vh] overflow-y-auto rounded-b-[18px] bg-white px-5 pb-5 pt-4">
              {loadingTransactionDetail ? (
                <p className="py-8 text-center text-sm text-gray-500">Memuat detail transaksi...</p>
              ) : (
                (() => {
                  const meta = getTransactionMeta(selectedTransaction);
                  const DetailIcon = meta.icon;
                  const attachments = selectedTransaction.attachments || [];

                  return (
                    <div className="space-y-4">
                      <div className="rounded-2xl bg-gray-50 p-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-[#0056b3]">
                            <DetailIcon size={22} />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs text-gray-500">{meta.label}</p>
                            <p className="truncate text-base font-bold text-gray-900">{meta.title}</p>
                          </div>
                          <p className={`text-base font-bold ${meta.amountClass}`}>{meta.amount}</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-[104px_1fr] gap-x-3 gap-y-3 text-sm">
                        <span className="text-gray-500">Tanggal</span>
                        <span className="font-medium text-gray-900">{formatDateTime(selectedTransaction.trx_date)}</span>

                        <span className="text-gray-500">Dompet</span>
                        <span className="font-medium text-gray-900">{selectedTransaction.wallet?.name || '-'}</span>

                        {selectedTransaction.type === 'transfer' && (
                          <>
                            <span className="text-gray-500">Tujuan</span>
                            <span className="font-medium text-gray-900">{selectedTransaction.to_wallet?.name || '-'}</span>
                          </>
                        )}

                        {selectedTransaction.type !== 'transfer' && (
                          <>
                            <span className="text-gray-500">Kategori</span>
                            <span className="font-medium text-gray-900">{selectedTransaction.category?.name || '-'}</span>
                          </>
                        )}

                        <span className="text-gray-500">Status</span>
                        <span className="font-medium capitalize text-gray-900">{selectedTransaction.status || '-'}</span>

                        <span className="text-gray-500">Catatan</span>
                        <span className="font-medium text-gray-900">{selectedTransaction.note || '-'}</span>
                      </div>

                      <div>
                        <div className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900">
                          <FileText size={16} />
                          Lampiran
                        </div>

                        {attachments.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-sm text-gray-500">
                            Tidak ada foto atau struk.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {attachments.map((attachment) => {
                              const attachmentUrl = getAttachmentUrl(attachment.file_path);
                              const isImage = /\.(jpg|jpeg|png|webp)$/i.test(attachment.file_path || attachment.caption || '');

                              return (
                                <a
                                  key={attachment.id}
                                  href={attachmentUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2"
                                >
                                  {isImage ? (
                                    <img
                                      src={attachmentUrl}
                                      alt={attachment.caption || 'Lampiran transaksi'}
                                      className="h-14 w-14 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-white text-[#0056b3]">
                                      <Image size={22} />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-gray-900">
                                      {attachment.caption || 'Lampiran transaksi'}
                                    </p>
                                    <p className="text-xs text-gray-500">Ketuk untuk membuka</p>
                                  </div>
                                </a>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <button
                          type="button"
                          onClick={openEditTransaction}
                          className="flex h-11 items-center justify-center gap-2 rounded-lg bg-[#0056b3] text-sm font-bold text-white"
                        >
                          <Pencil size={16} />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={handleDeleteTransaction}
                          className="flex h-11 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-bold text-red-600"
                        >
                          <Trash2 size={16} />
                          Hapus
                        </button>
                      </div>
                    </div>
                  );
                })()
              )}
            </div>
          </div>
        </div>
      )}

      {showBudgetModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-0 sm:items-center sm:px-4"
          onClick={closeBudgetModal}
        >
          <div
            className="w-full max-w-md rounded-t-[18px] bg-white shadow-2xl sm:rounded-[18px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative rounded-t-[18px] bg-[#f4f6fb] px-4 pb-3 pt-7 sm:rounded-t-[18px]">
              <span className="absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-[#c5cad4]" />
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  {selectedBudgetItem?.budget_id ? 'Edit Anggaran' : 'Atur Anggaran'}
                </h2>
                <button
                  type="button"
                  aria-label="Tutup modal anggaran"
                  onClick={closeBudgetModal}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-2xl font-light leading-none text-gray-600"
                >
                  x
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitBudget} className="space-y-4 rounded-b-[18px] bg-white px-5 pb-5 pt-4">
              <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-[#064da3]">
                Limit ini hanya berlaku untuk bulan ini. Jika pengeluaran melewati limit, sisa akan tampil minus.
              </div>

              <div>
                <label htmlFor="budget-category" className="mb-2 block text-sm text-gray-700">
                  Kategori
                </label>
                <select
                  id="budget-category"
                  value={budgetForm.budget_category_id}
                  onChange={(event) =>
                    setBudgetForm((currentForm) => ({ ...currentForm, budget_category_id: event.target.value }))
                  }
                  disabled={Boolean(selectedBudgetItem?.budget_id)}
                  className="h-11 w-full rounded-lg border border-[#d6dfef] bg-white px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                  required={budgetCategories.length > 0}
                >
                  {budgetCategories.length > 0 ? (
                    budgetCategories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))
                  ) : (
                    <option value="">Buat kategori dulu</option>
                  )}
                </select>
                {budgetCategories.length === 0 && (
                  <p className="mt-2 text-xs text-amber-600">
                    Belum ada kategori. Tutup modal ini lalu tekan Kategori baru untuk membuat kategori anggaran.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="budget-amount" className="mb-2 block text-sm text-gray-700">
                  Limit Bulanan
                </label>
                <input
                  id="budget-amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 1.000.000"
                  value={budgetForm.amount}
                  onChange={(event) => handleBudgetAmountChange(event.target.value)}
                  className="h-11 w-full rounded-lg border border-[#d6dfef] px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={savingBudget}
                className="h-11 w-full rounded-lg bg-[#0056b3] text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {savingBudget ? 'Menyimpan...' : 'Simpan Anggaran'}
              </button>

              {selectedBudgetItem?.budget_id && (
                <button
                  type="button"
                  onClick={handleDeleteBudget}
                  disabled={savingBudget}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:text-red-300"
                >
                  <Trash2 size={16} />
                  Hapus Limit Bulan Ini
                </button>
              )}

              {selectedBudgetItem?.category_id && (isGuest || selectedBudgetItem?.category_name !== 'Lainnya') && (
                <button
                  type="button"
                  onClick={handleDeleteBudgetCategory}
                  disabled={savingBudget}
                  className="flex h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-white text-sm font-bold text-red-600 disabled:cursor-not-allowed disabled:text-red-300"
                >
                  <Trash2 size={16} />
                  Hapus Kategori
                </button>
              )}
            </form>
          </div>
        </div>
      )}

      {showBudgetCategoryModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-0 sm:items-center sm:px-4"
          onClick={closeBudgetCategoryModal}
        >
          <div
            className="w-full max-w-md rounded-t-[18px] bg-white shadow-2xl sm:rounded-[18px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative rounded-t-[18px] bg-[#f4f6fb] px-4 pb-3 pt-7 sm:rounded-t-[18px]">
              <span className="absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-[#c5cad4]" />
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">Kategori Anggaran Baru</h2>
                <button
                  type="button"
                  aria-label="Tutup modal kategori"
                  onClick={closeBudgetCategoryModal}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-2xl font-light leading-none text-gray-600"
                >
                  x
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmitBudgetCategory} className="space-y-4 rounded-b-[18px] bg-white px-5 pb-5 pt-4">
              <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs text-[#064da3]">
                Kategori baru akan muncul di transaksi pengeluaran dan bisa diberi limit bulanan.
              </div>

              <div>
                <label htmlFor="budget-category-name" className="mb-2 block text-sm text-gray-700">
                  Nama kategori
                </label>
                <input
                  id="budget-category-name"
                  type="text"
                  placeholder="Contoh: Kesehatan"
                  value={budgetCategoryForm.name}
                  onChange={(event) =>
                    setBudgetCategoryForm((currentForm) => ({ ...currentForm, name: event.target.value }))
                  }
                  className="h-11 w-full rounded-lg border border-[#d6dfef] px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={savingBudgetCategory}
                className="h-11 w-full rounded-lg bg-[#0056b3] text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {savingBudgetCategory ? 'Menyimpan...' : 'Simpan Kategori'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showTransactionModal && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-0 sm:items-center sm:px-4"
          onClick={closeTransactionModal}
        >
          <div
            className="w-full max-w-md rounded-t-[18px] bg-white shadow-2xl sm:rounded-[18px]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="relative rounded-t-[18px] bg-[#f4f6fb] px-4 pb-3 pt-7 sm:rounded-t-[18px]">
              <span className="absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-[#c5cad4]" />
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">
                  {editingTransaction ? 'Edit Transaksi' : 'Tambah Transaksi'}
                </h2>
                <button
                  type="button"
                  aria-label="Tutup modal tambah transaksi"
                  onClick={closeTransactionModal}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-2xl font-light leading-none text-gray-600"
                >
                  x
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmitTransaction}
              className="max-h-[82vh] space-y-3 overflow-y-auto rounded-b-[18px] bg-white px-5 pb-4 pt-3"
            >
              {renderReceiptUpload()}

              <div>
                <label className="mb-2 block text-sm text-gray-700">Jenis</label>
                <div className="grid grid-cols-3 rounded-full bg-[#bfbfbf] p-1">
                  {typeOptions.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => handleTypeChange(type.value)}
                      className={`h-8 rounded-full text-xs transition ${
                        transactionForm.type === type.value
                          ? 'bg-white font-semibold text-gray-800 shadow-sm'
                          : 'text-gray-700'
                      }`}
                    >
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[72px_1fr] items-center gap-2">
                <label htmlFor="transaction-amount" className="text-sm text-gray-700">
                  Jumlah
                </label>
                <input
                  id="transaction-amount"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={transactionForm.amount}
                  onChange={(event) => handleAmountChange(event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#d6dfef] px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div className="grid grid-cols-[72px_1fr] items-center gap-2">
                <label htmlFor="transaction-wallet" className="text-sm text-gray-700">
                  Dompet
                </label>
                <select
                  id="transaction-wallet"
                  className="h-10 w-full rounded-lg border border-[#d6dfef] bg-white px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                  value={transactionForm.wallet_id}
                  onChange={(event) => handleWalletChange(event.target.value)}
                  required
                >
                  {wallets.length > 0 ? (
                    wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} - {formatRupiah(wallet.current_balance)}
                      </option>
                    ))
                  ) : (
                    <option value="">Belum ada dompet</option>
                  )}
                </select>
              </div>

              {transactionForm.type === 'transfer' ? (
                <div className="grid grid-cols-[72px_1fr] items-center gap-2">
                  <label htmlFor="transaction-to-wallet" className="text-sm text-gray-700">
                    Tujuan
                  </label>
                  <select
                    id="transaction-to-wallet"
                    className="h-10 w-full rounded-lg border border-[#d6dfef] bg-white px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                    value={transactionForm.to_wallet_id}
                    onChange={(event) => updateTransactionForm('to_wallet_id', event.target.value)}
                    required
                  >
                    {transferWallets.length > 0 ? (
                      transferWallets.map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.name} - {formatRupiah(wallet.current_balance)}
                        </option>
                      ))
                    ) : (
                      <option value="">Butuh dompet lain</option>
                    )}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-[72px_1fr] items-center gap-2">
                  <label htmlFor="transaction-category" className="text-sm text-gray-700">
                    Kategori
                  </label>
                  <select
                    id="transaction-category"
                    className="h-10 w-full rounded-lg border border-[#d6dfef] bg-white px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                    value={transactionForm.budget_category_id}
                    onChange={(event) => updateTransactionForm('budget_category_id', event.target.value)}
                    required={transactionForm.type === 'expense' && budgetCategories.length > 0}
                  >
                    {budgetCategories.length > 0 ? (
                      budgetCategories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))
                    ) : (
                      <option value="">Buat kategori dulu</option>
                    )}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-[72px_1fr] items-center gap-2">
                <label htmlFor="transaction-date" className="text-sm text-gray-700">
                  Tanggal
                </label>
                <input
                  id="transaction-date"
                  type="date"
                  value={transactionForm.trx_date}
                  onChange={(event) => updateTransactionForm('trx_date', event.target.value)}
                  className="h-10 w-full rounded-lg border border-[#d6dfef] px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                  required
                />
              </div>

              <div>
                <label htmlFor="transaction-note" className="mb-2 block text-sm text-gray-700">
                  Catatan
                </label>
                <textarea
                  id="transaction-note"
                  rows="2"
                  placeholder={`Contoh: ${activeTypeLabel.toLowerCase()} hari ini...`}
                  value={transactionForm.note}
                  onChange={(event) => updateTransactionForm('note', event.target.value)}
                  className="w-full resize-none rounded-lg border border-[#d6dfef] px-3 py-2 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <button
                type="submit"
                disabled={savingTransaction || scanningReceipt || wallets.length === 0}
                className="h-11 w-full rounded-lg bg-[#064da3] text-sm font-bold text-white shadow-sm transition hover:bg-[#004795] disabled:cursor-not-allowed disabled:bg-gray-400"
              >
                {scanningReceipt
                  ? 'Menunggu OCR...'
                  : savingTransaction
                  ? editingTransaction
                    ? 'Memperbarui...'
                    : 'Menyimpan...'
                  : editingTransaction
                    ? 'Simpan Perubahan'
                    : 'Simpan Transaksi'}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmationDialog
        open={Boolean(confirmDialog)}
        title={confirmDialog?.title}
        description={confirmDialog?.description}
        confirmLabel={confirmDialog?.confirmLabel}
        cancelLabel={confirmDialog?.cancelLabel}
        tone={confirmDialog?.tone}
        loading={confirmLoading}
        onCancel={closeConfirmDialog}
        onConfirm={confirmDialogAction}
      />
    </div>
  );
};

export default Dashboard;
