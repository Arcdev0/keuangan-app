import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const SetupWallet = () => {
  const [name, setName] = useState('Tunai');
  const [balance, setBalance] = useState('');
  const navigate = useNavigate();

  const handleSetup = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('auth_token');
    const loadingToast = toast.loading('Menyiapkan dompetmu...');

    try {
      // Kirim data dompet ke Backend
      await axios.post('http://127.0.0.1:8000/api/wallets', {
        name: name,
        balance: balance,
      }, {
        headers: { Authorization: `Bearer ${token}` } // Wajib bawa token
      });

      toast.dismiss(loadingToast);
      toast.success('Dompet berhasil dibuat!');
      
      // Sukses -> Masuk Dashboard
      navigate('/dashboard');

    } catch (error) {
      toast.dismiss(loadingToast);
      toast.error('Gagal membuat dompet. Coba lagi.');
      console.error(error);
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fe] flex flex-col items-center justify-center p-6">
      <div className="bg-white p-8 rounded-3xl shadow-xl w-full max-w-md">
        <div className="text-center mb-6">
          <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">💰</span>
          </div>
          <h2 className="text-2xl font-bold text-gray-800">Mulai Catat Keuangan</h2>
          <p className="text-gray-500 text-sm mt-2">Yuk, isi saldo dompet pertamamu.</p>
        </div>

        <form onSubmit={handleSetup} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nama Dompet</label>
            <input type="text" className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#0056b3]" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: Tunai, BCA, dll" required />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Saldo Awal (Rp)</label>
            <input type="number" className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#0056b3]" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0" required />
          </div>

          <button type="submit" className="w-full bg-[#0056b3] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 transition-all">
            Simpan & Masuk Dashboard
          </button>
        </form>
      </div>
    </div>
  );
};

export default SetupWallet;