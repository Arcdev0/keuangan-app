import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();

    const loadingToast = toast.loading('Sedang masuk...');

    try {
      const response = await axios.post('http://127.0.0.1:8000/api/login', {
        email,
        password,
      });

      const authData = response.data?.data;
      const token = authData?.token;
      const user = authData?.user;

      if (!token || !user) {
        throw new Error('Data login dari server tidak lengkap.');
      }

      localStorage.setItem('auth_token', token);
      localStorage.setItem('user_info', JSON.stringify(user));

      toast.dismiss(loadingToast);
      toast.success(`Selamat datang, ${user.name}!`);

      const walletSetupCompleted = localStorage.getItem('wallet_setup_completed') === 'true';

      setTimeout(() => {
        navigate(walletSetupCompleted ? '/dashboard' : '/setup-wallet');
      }, 1200);
    } catch (error) {
      toast.dismiss(loadingToast);

      const apiMessage = error.response?.data?.message;
      const validationMessage = error.response?.data?.errors?.email?.[0];
      toast.error(apiMessage || validationMessage || error.message || 'Email atau password salah!');
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fe] flex flex-col">
      <div className="bg-[#0056b3] h-48 rounded-b-[40px] p-8 flex flex-col justify-center">
        <h1 className="text-white text-2xl font-bold">Selamat Datang</h1>
        <p className="text-blue-100 text-sm">Masuk untuk mengelola keuanganmu</p>
      </div>

      <div className="flex-1 px-6 -mt-10">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#0056b3] transition-all"
                placeholder="Masukkan email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#0056b3] transition-all"
                placeholder="Masukkan password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#0056b3] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all"
            >
              Masuk
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-8">
            Belum punya akun?{' '}
            <Link to="/register" className="text-[#0056b3] font-bold hover:underline">
              Daftar Sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
