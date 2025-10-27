// packages/frontend/src/main.jsx
// Defines the entry point for the React application, setting up routing and rendering the app to the DOM.
// This file exists to initialize the React app with necessary providers and route configuration.
// packages/frontend/src/App.jsx, packages/frontend/src/index.html, packages/frontend/src/dashboard/Dashboard.jsx, packages/frontend/src/context/ClientContext.jsx

import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import ChatInterfaceTesting from './chatbot/ChatInterface_testing';
import './index.css';
import Dashboard from './dashboard/Dashboard';
import DashboardUpInvestments from './dashboard/DashboardUpInvestments';
import AdminDashboard from './dashboard/AdminDashboard';
import ClientManagementTab from './dashboard/admin-dashboard/ClientManagementTab';
import DocumentUploadPage from './dashboard/admin-dashboard/pages/DocumentUploadPage';
import ChatHistoryPage from './dashboard/listing-performance-tab/components/listing-details/ChatHistoryPage'; // Import ChatHistoryPage
import LLMAnalyticsDashboard from './dashboard/llm-analytics-dashboard/LLMAnalyticsDashboard'; // Import LLM Analytics Dashboard
import LearningEngineDashboard from './dashboard/learning-engine-dashboard/LearningEngineDashboard'; // Import Learning Engine Dashboard
import PortugueseFineTuningTab from './dashboard/portuguese-fine-tuning-tab/PortugueseFineTuningTab'; // Import Portuguese Fine Tuning Tab
import { ClientProvider } from './context/ClientContext'; // Import ClientProvider

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ClientProvider> {/* Wrap BrowserRouter with ClientProvider */}
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<ChatInterfaceTesting />} />
          <Route path="/dashboard/*" element={<Dashboard />} /> {/* Use /* for nested routes */}
          <Route path="/dashboard-up-investments/*" element={<DashboardUpInvestments />} />
          <Route path="/admin/*" element={<AdminDashboard />}> {/* Admin dashboard routes */}
            <Route index element={<ClientManagementTab />} /> {/* Default route for /admin */}
            <Route path="clients" element={<ClientManagementTab />} />
            <Route path="llm-analytics" element={<LLMAnalyticsDashboard />} />
            <Route path="learning-engine" element={<LearningEngineDashboard />} />
            <Route path="portuguese-fine-tuning" element={<PortugueseFineTuningTab />} />
            <Route path="document-upload/:clientId" element={<DocumentUploadPage />} />
          </Route>
          <Route path="/chat-history/:visitorId" element={<ChatHistoryPage />} /> {/* New route for chat history */}
        </Routes>
      </BrowserRouter>
    </ClientProvider>
  </React.StrictMode>
);