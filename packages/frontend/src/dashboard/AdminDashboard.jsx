import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import ClientManagementTab from './admin-dashboard/ClientManagementTab';

const AdminDashboard = () => {
  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar Navigation */}
      <aside className="w-sidebar bg-white shadow-md p-4">
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
            <li className="mb-2">
              <NavLink
                to="/admin/llm-analytics"
                className={({ isActive }) =>
                  isActive ? "text-blue-800 font-bold" : "text-blue-600 hover:text-blue-800"
                }
              >
                LLM Analytics
              </NavLink>
            </li>
            <li className="mb-2">
              <NavLink
                to="/admin/learning-engine"
                className={({ isActive }) =>
                  isActive ? "text-blue-800 font-bold" : "text-blue-600 hover:text-blue-800"
                }
              >
                Learning Engine
              </NavLink>
            </li>
            {/* Add other admin tabs here */}
          </ul>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 p-container-padding">
        <Outlet />
      </main>
    </div>
  );
};

export default AdminDashboard;