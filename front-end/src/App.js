import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

// Import halaman
import Login from './pages/Login/Login';
import Register from './pages/Register/Register';
import Dashboard from './pages/Dashboard/Dashboard';
import SetupWallet from './pages/SetupWallet/SetupWallet';
import AuthCheck from './components/AuthCheck'; // <--- Import Satpam

import './styles/App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Toaster
          position="top-center"
          reverseOrder={false}
          toastOptions={{
            duration: 3500,
            style: {
              borderRadius: '14px',
              border: '1px solid #dbe4f0',
              background: '#ffffff',
              color: '#111827',
              boxShadow: '0 16px 40px rgba(15, 23, 42, 0.12)',
              fontSize: '13px',
              fontWeight: 600,
              maxWidth: 'calc(100vw - 32px)',
            },
            success: {
              iconTheme: {
                primary: '#059669',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#dc2626',
                secondary: '#ffffff',
              },
            },
            loading: {
              iconTheme: {
                primary: '#0056b3',
                secondary: '#ffffff',
              },
            },
          }}
        />
        <Routes>
          {/* Pintu Utama dijaga AuthCheck */}
          <Route path="/" element={<AuthCheck />} />
          
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/setup-wallet" element={<SetupWallet />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
