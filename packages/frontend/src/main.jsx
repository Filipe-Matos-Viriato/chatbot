import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import './index.css';
import NewDashboard from './dashboard/NewDashboard'; // Import the NewDashboard component

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/dashboard" element={<NewDashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);