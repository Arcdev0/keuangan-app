import React, { useState } from 'react';

const Register = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = (e) => {
    e.preventDefault();
    console.log({ name, email, password });
    // Di sini nanti tempat panggil API Laravel
  };

  return (
    <div className="min-h-screen bg-bg-gray flex flex-col">
      {/* Header Biru ala gambar referensi */}
      <div className="bg-primary-blue h-48 rounded-b-[40px] p-8 flex flex-col justify-center">
        <h1 className="text-white text-2xl font-bold">Buat Akun Baru</h1>
        <p className="text-blue-100 text-sm">Kelola keuanganmu dengan lebih teratur</p>
      </div>

      {/* Form Card */}
      <div className="flex-1 px-6 -mt-10">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <form onSubmit={handleRegister} className="space-y-5">
            {/* <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nama Lengkap</label>
              <input
                type="text"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-primary-blue transition-all"
                placeholder="Masukkan nama..."
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div> */}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-primary-blue transition-all"
                placeholder="Email aktif..."
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                className="w-full px-4 py-3 rounded-xl bg-gray-50 border border-gray-200 focus:outline-none focus:border-primary-blue transition-all"
                placeholder="Minimal 8 karakter..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <button
              type="submit"
              className="w-full bg-primary-blue text-white font-bold py-4 rounded-2xl shadow-lg hover:bg-blue-700 active:scale-[0.98] transition-all mt-4"
            >
              Daftar Sekarang
            </button>
          </form>

          <p className="text-center text-gray-500 text-sm mt-6">
            Sudah punya akun? <span className="text-primary-blue font-bold cursor-pointer">Masuk di sini</span>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;