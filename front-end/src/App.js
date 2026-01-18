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
        <Toaster position="top-center" reverseOrder={false} />
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