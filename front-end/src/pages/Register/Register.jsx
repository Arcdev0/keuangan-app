import { Link, useNavigate } from 'react-router-dom';
import React, { useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';


const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState(''); // Kolom ke-4
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    if (password !== passwordConfirmation) {
      // Ganti Swal Error jadi Toast Error
      toast.error('Password tidak cocok!');
      return;
    }

    // Tampilkan loading (efek keren: loading muter-muter)
    const loadingToast = toast.loading('Mendaftarkan akun...');

    try {
      await axios.post('http://127.0.0.1:8000/api/register', {
        name, email, password, password_confirmation: passwordConfirmation,
      });

      // Tutup loading, ganti jadi sukses
      toast.dismiss(loadingToast);
      toast.success('Registrasi Berhasil! Silakan Login.');

      setTimeout(() => {
        navigate('/');
      }, 2000);

    } catch (error) {
      // Tutup loading, ganti jadi error
      toast.dismiss(loadingToast);
      toast.error(error.response?.data?.message || 'Registrasi Gagal');
    }
  };

  return (
    <div className="min-h-screen bg-[#f4f7fe] flex flex-col">
      {/* Header */}
      <div className="bg-[#0056b3] h-48 rounded-b-[40px] p-8 flex flex-col justify-center">
        <h1 className="text-white text-2xl font-bold">Buat Akun Baru</h1>
        <p className="text-blue-100 text-sm">Kelola keuanganmu dengan lebih teratur</p>
      </div>

      {/* Form */}
      <div className="flex-1 px-6 -mt-10 mb-10">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Nama Lengkap</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#0056b3]"
                placeholder="Nama..."
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <input
                type="email"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#0056b3]"
                placeholder="Email..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#0056b3]"
                placeholder="Min. 8 karakter"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {/* Kolom Konfirmasi Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700">Konfirmasi Password</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-[#0056b3]"
                placeholder="Ulangi password"
                value={passwordConfirmation}
                onChange={(e) => setPasswordConfirmation(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-[#0056b3] text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 mt-4 transition-all"
            >
              Daftar Sekarang
            </button>
          </form>
        </div>
        <p className="text-center text-gray-500 text-sm mt-6">
          Sudah punya akun?{' '}
          <Link to="/" className="text-[#0056b3] font-bold cursor-pointer hover:underline">
            Masuk di sini
          </Link>
        </p>
      </div>
    </div>
  );
};

export default Register;