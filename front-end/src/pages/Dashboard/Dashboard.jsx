import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const Dashboard = () => {
  const navigate = useNavigate();
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(true);

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
            onClick={() => navigate('/setup-wallet')}
            className="w-14 h-14 bg-[#0056b3] text-white rounded-full text-3xl -mt-8 shadow-lg"
          >
            +
          </button>
          <button>Anggaran</button>
          <button>Lainnya</button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
