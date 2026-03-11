import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const AuthCheck = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('auth_token');

    if (token) {
      const walletSetupCompleted = localStorage.getItem('wallet_setup_completed') === 'true';
      navigate(walletSetupCompleted ? '/dashboard' : '/setup-wallet', { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
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
