import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import './index.css';
import Dashboard from './dashboard/Dashboard';
import AdminDashboard from './dashboard/AdminDashboard';
import ClientManagementTab from './dashboard/admin-dashboard/ClientManagementTab';
import DocumentUploadPage from './dashboard/admin-dashboard/pages/DocumentUploadPage';
import { ClientProvider } from './context/ClientContext'; // Import ClientProvider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClientProvider> {/* Wrap BrowserRouter with ClientProvider */}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/dashboard/*" element={<Dashboard />} /> {/* Use /* for nested routes */}
          <Route path="/admin/*" element={<AdminDashboard />}> {/* Admin dashboard routes */}
            <Route index element={<ClientManagementTab />} /> {/* Default route for /admin */}
            <Route path="clients" element={<ClientManagementTab />} />
            <Route path="document-upload/:clientId" element={<DocumentUploadPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ClientProvider>
  </React.StrictMode>
);