import React, { useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AuthCheck = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('auth_token');

      if (!token) {
        navigate('/login', { replace: true });
        return;
      }

      try {
        const response = await axios.get('http://127.0.0.1:8000/api/me', {
          headers: { Authorization: `Bearer ${token}` },
        });

        const user = response.data?.data;
        localStorage.setItem('user_info', JSON.stringify(user));
        navigate(user?.has_wallet_setup ? '/dashboard' : '/setup-wallet', { replace: true });
      } catch (error) {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_info');
        navigate('/login', { replace: true });
      }
    };

    checkAuth();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f7fe]">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#0056b3] mx-auto mb-4"></div>
        <p className="text-gray-500 font-medium">Memuat aplikasi...</p>
      </div>
    </div>
  );
};

export default AuthCheck;
