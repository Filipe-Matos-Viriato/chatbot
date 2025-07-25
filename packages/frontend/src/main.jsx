import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import './index.css';
import Dashboard from './dashboard/Dashboard';
import AdminDashboard from './dashboard/AdminDashboard';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard/*" element={<Dashboard />} /> {/* Use /* for nested routes */}
        <Route path="/admin/*" element={<AdminDashboard />} /> {/* Admin dashboard routes */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);