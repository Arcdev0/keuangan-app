import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const navigate = useNavigate();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionType, setTransactionType] = useState('Pengeluaran');

  const token = localStorage.getItem('auth_token');
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');

  const fetchWallets = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/wallets', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setWallets(response.data?.data || []);
    } catch (error) {
      toast.error('Gagal memuat data dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      navigate('/login');
      return;
    }

    fetchWallets();
  }, []);

  const totalSaldo = useMemo(
    () => wallets.reduce((sum, wallet) => sum + Number(wallet.current_balance || 0), 0),
    [wallets],
  );

  const formatRupiah = (amount) => `Rp${Number(amount || 0).toLocaleString('id-ID')}`;

  return (
    <div className="min-h-screen bg-[#eef2f8] pb-28">
      <div className="bg-[#0056b3] text-white px-5 pt-7 pb-8 rounded-b-[24px] shadow-md">
        <p className="text-sm opacity-90">Hi, {userInfo?.name || 'Pengguna'}</p>
        <h1 className="text-4xl font-bold mt-3 leading-tight">Catat uangmu dengan mudah</h1>
        <p className="text-sm text-blue-100 mt-2">Semua dompet & pengeluaran kamu di satu aplikasi.</p>
      </div>

      <div className="px-5 mt-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-gray-800">Ringkasan Hari Ini</h2>
          <button className="text-xs text-[#0056b3]">Lihat semua dompet</button>
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-sm text-gray-500">Total Saldo</p>
          <h3 className="text-4xl font-bold text-gray-900 mt-1">{formatRupiah(totalSaldo)}</h3>

          {loading ? (
            <p className="text-sm text-gray-500 mt-4">Memuat dompet...</p>
          ) : wallets.length === 0 ? (
            <div className="mt-4 bg-gray-50 rounded-xl p-4 border border-dashed border-gray-300">
              <p className="text-sm text-gray-500">Belum ada dompet.</p>
              <button
                type="button"
                onClick={() => navigate('/setup-wallet')}
                className="mt-3 w-full bg-[#0056b3] text-white font-semibold py-3 rounded-xl"
              >
                + Buat Dompet Pertama
              </button>
            </div>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3">
              {wallets.slice(0, 4).map((wallet) => (
                <div key={wallet.id} className="bg-gray-50 rounded-xl p-3 border border-gray-200">
                  <p className="text-sm text-gray-500">{wallet.name}</p>
                  <p className="text-xl font-bold mt-1 text-gray-800">{formatRupiah(wallet.current_balance)}</p>
                </div>
              ))}
              <button
                type="button"
                onClick={() => navigate('/setup-wallet')}
                className="bg-[#0056b3] text-white rounded-xl text-3xl font-bold flex items-center justify-center min-h-[86px]"
              >
                +
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-4 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-bold text-gray-800">Ringkasan Bulan Ini</h3>
            <button className="text-xs text-[#0056b3]">Lihat semua</button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <p className="text-sm text-gray-600">Pemasukan</p>
              <p className="text-green-600 text-2xl font-bold mt-2">+Rp0</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-200">
              <p className="text-sm text-gray-600">Pengeluaran</p>
              <p className="text-red-600 text-2xl font-bold mt-2">-Rp0</p>
            </div>
          </div>

          <div className="mt-3 bg-gray-50 rounded-xl p-3 border border-gray-200 flex justify-between">
            <p className="text-sm text-gray-600">Total Anggaran Bulanan</p>
            <p className="font-bold">Rp0</p>
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-7 py-3">
        <div className="flex items-center justify-between max-w-md mx-auto text-xs text-gray-600">
          <button className="text-[#0056b3] font-semibold">Beranda</button>
          <button>Riwayat</button>
          <button
            type="button"
            onClick={() => setShowTransactionModal(true)}
            className="w-14 h-14 bg-[#0056b3] text-white rounded-full text-3xl -mt-8 shadow-lg"
          >
            +
          </button>
          <button>Anggaran</button>
          <button>Lainnya</button>
        </div>
      </div>

      {showTransactionModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/35 px-0 sm:items-center sm:px-4">
          <div className="w-full max-w-md rounded-t-[18px] bg-white shadow-2xl sm:rounded-[18px]">
            <div className="relative rounded-t-[18px] bg-[#f4f6fb] px-4 pb-3 pt-7 sm:rounded-t-[18px]">
              <span className="absolute left-1/2 top-3 h-1 w-10 -translate-x-1/2 rounded-full bg-[#c5cad4]" />
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-gray-900">Tambah Transaksi</h2>
                <button
                  type="button"
                  aria-label="Tutup modal tambah transaksi"
                  onClick={() => setShowTransactionModal(false)}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-2xl font-light leading-none text-gray-600"
                >
                  x
                </button>
              </div>
            </div>

            <form className="space-y-3 rounded-b-[18px] bg-white px-5 pb-3 pt-3">
              <div>
                <label className="mb-2 block text-sm text-gray-700">Jenis</label>
                <div className="grid grid-cols-3 rounded-full bg-[#bfbfbf] p-1">
                  {['Pengeluaran', 'Pemasukan', 'Transfer'].map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setTransactionType(type)}
                      className={`h-7 rounded-full text-xs transition ${
                        transactionType === type
                          ? 'bg-white font-semibold text-gray-800 shadow-sm'
                          : 'text-gray-700'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-[64px_1fr] items-center gap-2">
                <label htmlFor="transaction-amount" className="text-sm text-gray-700">
                  Jumlah
                </label>
                <input
                  id="transaction-amount"
                  type="number"
                  min="0"
                  placeholder="0"
                  className="h-8 w-full rounded-lg border border-[#d6dfef] px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-[64px_1fr] items-center gap-2">
                <label htmlFor="transaction-wallet" className="text-sm text-gray-700">
                  Dompet
                </label>
                <select
                  id="transaction-wallet"
                  className="h-8 w-full rounded-lg border border-[#d6dfef] bg-white px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                  defaultValue={wallets[0]?.id || 'cash'}
                >
                  {wallets.length > 0 ? (
                    wallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name}
                      </option>
                    ))
                  ) : (
                    <option value="cash">Tunai</option>
                  )}
                </select>
              </div>

              <div className="grid grid-cols-[64px_1fr] items-center gap-2">
                <label htmlFor="transaction-category" className="text-sm text-gray-700">
                  Kategori
                </label>
                <select
                  id="transaction-category"
                  className="h-8 w-full rounded-lg border border-[#d6dfef] bg-white px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                  defaultValue="Makanan"
                >
                  <option>Makanan</option>
                  <option>Transportasi</option>
                  <option>Belanja</option>
                  <option>Tagihan</option>
                  <option>Gaji</option>
                </select>
              </div>

              <div className="grid grid-cols-[64px_1fr] items-center gap-2">
                <label htmlFor="transaction-date" className="text-sm text-gray-700">
                  Tanggal
                </label>
                <input
                  id="transaction-date"
                  type="date"
                  className="h-8 w-full rounded-lg border border-[#d6dfef] px-3 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label htmlFor="transaction-note" className="mb-2 block text-sm text-gray-700">
                  Catatan
                </label>
                <textarea
                  id="transaction-note"
                  rows="2"
                  placeholder="Contoh: makan siang di warung..."
                  className="w-full resize-none rounded-lg border border-[#d6dfef] px-3 py-2 text-sm outline-none focus:border-[#0056b3] focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="grid grid-cols-[68px_1fr] items-center gap-2">
                <span className="text-sm text-gray-700">Foto / Struk</span>
                <label className="flex h-8 cursor-pointer items-center justify-center rounded-lg border border-dashed border-[#d6dfef] bg-[#f8f9ff] text-xs font-medium text-[#0b4fa8]">
                  Upload Foto / File
                  <input type="file" className="sr-only" />
                </label>
              </div>

              <button
                type="button"
                className="h-10 w-full rounded-lg bg-[#064da3] text-sm font-bold text-white shadow-sm transition hover:bg-[#004795]"
              >
                Simpan Transaksi
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
