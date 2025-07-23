import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import './index.css';
import Dashboard from './dashboard/Dashboard';
import ListingDetailsPage from './dashboard/listing-performance-tab/components/ListingDetailsPage';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard/*" element={<Dashboard />} /> {/* Use /* for nested routes */}
        {/* This route is now handled inside the Dashboard component */}
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);