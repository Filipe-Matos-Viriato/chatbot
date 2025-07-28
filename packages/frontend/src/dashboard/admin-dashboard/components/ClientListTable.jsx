import React, { useState, useMemo } from 'react';
import { FaCog, FaTrash } from 'react-icons/fa';

const ClientListTable = ({ clients, handleEditClick, handleDeleteClient }) => {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'ascending' });
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [clientToDeleteId, setClientToDeleteId] = useState(null);

  const sortedClients = useMemo(() => {
    let sortableClients = [...clients];
    if (sortConfig.key !== null) {
      sortableClients.sort((a, b) => {
        if (a[sortConfig.key] < b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (a[sortConfig.key] > b[sortConfig.key]) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableClients;
  }, [clients, sortConfig]);

  const requestSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  const getSortIndicator = (key) => {
    if (sortConfig.key === key) {
      return sortConfig.direction === 'ascending' ? '▲' : '▼';
    }
    // Show double arrow for sortable columns when not currently sorted
    if (key === 'client_name') {
      return '▲▼';
    }
    return '';
  };
  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200">
          <thead>
            <tr>
              <th className="py-2 px-4 border-b text-left cursor-pointer" onClick={() => requestSort('client_name')}>
                <div className="flex items-center">
                  <span>Client Name</span>
                  <span className="w-4 text-right ml-2 text-xs">{getSortIndicator('client_name')}</span> {/* Fixed width for arrows, added ml-2 for spacing, text-xs for smaller size */}
                </div>
              </th>
              <th className="py-2 px-4 border-b text-left">Chatbot Name</th>
              <th className="py-2 px-4 border-b">Client ID</th>
              <th className="py-2 px-4 border-b">Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedClients.map((client) => (
              <tr key={client.client_id}>
                <td className="py-2 px-4 border-b">{client.client_name}</td>
                <td className="py-2 px-4 border-b">{client.chatbot_name}</td>
                <td className="py-2 px-4 border-b text-center">{client.client_id}</td>
                <td className="py-2 px-4 border-b text-center">
                  <button onClick={() => handleEditClick(client)} className="bg-blue-500 text-white px-3 py-1 rounded mr-2 hover:opacity-75"><FaCog /></button>
                  <button
                    onClick={() => {
                      setClientToDeleteId(client.client_id);
                      setShowConfirmDelete(true);
                    }}
                    className="bg-red-500 text-white px-3 py-1 rounded hover:opacity-75"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {showConfirmDelete && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full flex justify-center items-center">
          <div className="bg-white p-5 rounded-lg shadow-xl">
            <h3 className="text-lg font-bold mb-4">Confirm Deletion</h3>
            <p className="mb-4">Are you sure you want to delete this client? This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <button
                onClick={() => setShowConfirmDelete(false)}
                className="bg-gray-300 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-400"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteClient(clientToDeleteId);
                  setShowConfirmDelete(false);
                  setClientToDeleteId(null);
                }}
                className="bg-red-500 text-white px-4 py-2 rounded-md hover:bg-red-600"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ClientListTable;