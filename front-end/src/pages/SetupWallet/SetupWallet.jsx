import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { formatMoneyInput, moneyInputToNumber, parseMoneyInput } from '../../utils/currencyInput';

const walletTypeOptions = [
  { value: 'cash', label: 'Tunai' },
  { value: 'bank', label: 'Bank' },
  { value: 'e-wallet', label: 'E-Wallet' },
  { value: 'other', label: 'Lainnya' },
];

const SetupWallet = () => {
  const [name, setName] = useState('Tunai');
  const [type, setType] = useState('cash');
  const [balance, setBalance] = useState('');
  const [wallets, setWallets] = useState([]);
  const [loadingWallets, setLoadingWallets] = useState(true);
  const navigate = useNavigate();

  const token = localStorage.getItem('auth_token');
  const authHeader = { headers: { Authorization: `Bearer ${token}` } };

  const loadWallets = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/wallets', authHeader);
      setWallets(response.data?.data || []);
    } catch (error) {
      toast.error('Gagal memuat daftar dompet.');
    } finally {
      setLoadingWallets(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    loadWallets();
  }, []);

  const handleAddWallet = async (e) => {
    e.preventDefault();

    const loadingToast = toast.loading('Menyimpan dompet...');
    const openingBalance = parseMoneyInput(balance);

    if (moneyInputToNumber(balance) < 0) {
      toast.dismiss(loadingToast);
      toast.error('Saldo awal tidak valid.');
      return;
    }

    try {
      await axios.post('http://127.0.0.1:8000/api/wallets', {
        name,
        type,
        opening_balance: openingBalance,
      }, authHeader);

      toast.dismiss(loadingToast);
      toast.success('Dompet berhasil ditambahkan!');

      setName('');
      setType('cash');
      setBalance('');
      loadWallets();
    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.message || 'Gagal membuat dompet.');
    }
  };

  const handleFinish = () => {
    if (wallets.length === 0) {
      toast.error('Buat minimal 1 dompet dulu sebelum lanjut ke dashboard.');
      return;
    }

    const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
    userInfo.has_wallet_setup = true;
    localStorage.setItem('user_info', JSON.stringify(userInfo));

    navigate('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#f4f7fe] p-6">
      <div className="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-xl">
        <div className="text-center mb-6">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">💰</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Setup Dompet</h2>
          <p className="text-gray-500 text-sm mt-2">Kamu bisa menambah lebih dari 1 dompet dengan jenis berbeda.</p>
        </div>

        <form onSubmit={handleAddWallet} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Dompet</label>
            <input type="text" className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#0056b3]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Tunai Harian, BCA, GoPay" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jenis Dompet</label>
            <select className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#0056b3]" value={type} onChange={(e) => setType(e.target.value)} required>
              {walletTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Awal (Rp)</label>
            <input type="text" inputMode="numeric" className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#0056b3]" value={balance} onChange={(e) => setBalance(formatMoneyInput(e.target.value))} placeholder="0" required />
          </div>

          <button type="submit" className="w-full bg-[#0056b3] text-white font-bold py-3 rounded-2xl shadow-lg hover:bg-blue-700 transition-all">
            Tambah Dompet
          </button>
        </form>

        <div className="mt-7">
          <h3 className="font-bold text-gray-800 mb-3">Dompet yang sudah dibuat</h3>
          {loadingWallets ? (
            <p className="text-sm text-gray-500">Memuat dompet...</p>
          ) : wallets.length === 0 ? (
            <p className="text-sm text-gray-500">Belum ada dompet. Tambahkan dompet pertama kamu.</p>
          ) : (
            <ul className="space-y-2">
              {wallets.map((wallet) => (
                <li key={wallet.id} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm flex justify-between">
                  <span>{wallet.name} ({wallet.type})</span>
                  <span className="font-semibold">Rp {Number(wallet.current_balance || 0).toLocaleString('id-ID')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button type="button" onClick={handleFinish} className="w-full mt-6 bg-green-600 text-white font-bold py-3 rounded-2xl shadow-lg hover:bg-green-700 transition-all">
          Selesai & Masuk Dashboard
        </button>
      </div>
    </div>
  );
};

export default SetupWallet;
