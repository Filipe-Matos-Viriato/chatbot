import React from 'react';
import { Routes, Route, NavLink } from 'react-router-dom';
import ClientManagementTab from './admin-dashboard/ClientManagementTab';

const AdminDashboard = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-white shadow-md p-4">
        <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
        <nav>
          <ul>
            <li className="mb-2">
              <NavLink
                to="/admin/clients"
                className={({ isActive }) =>
                  isActive ? "text-blue-800 font-bold" : "text-blue-600 hover:text-blue-800"
                }
              >
                Clients
              </NavLink>
            </li>
            {/* Add other admin tabs here */}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-6">
        <Routes>
          <Route path="clients" element={<ClientManagementTab />} /> {/* Note: path is relative */}
          {/* Add routes for other admin tabs here */}
        </Routes>
      </main>
    </div>
  );
};

export default AdminDashboard;