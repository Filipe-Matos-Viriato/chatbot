import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../config/apiClient';

const ClientSelector = ({ selectedClient, onClientChange }) => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/v1/clients');
      setClients(response.data || []);
      setError(null);
    } catch (err) {
      console.error('Error loading clients:', err);
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Select Client</h2>
          <p className="text-sm text-gray-600 mt-1">
            Choose a client to view their LLM analytics and performance metrics.
          </p>
        </div>
      </div>

      <div className="mt-4">
        {loading ? (
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            <span className="text-sm text-gray-600">Loading clients...</span>
          </div>
        ) : error ? (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-md">
            {error}
            <button
              onClick={loadClients}
              className="ml-2 text-blue-600 hover:text-blue-800 underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <select
            value={selectedClient?.client_id || ''}
            onChange={(e) => {
              const client = clients.find(c => c.client_id === e.target.value);
              onClientChange(client || null);
            }}
            className="block w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">Select a client...</option>
            {clients.map((client) => (
              <option key={client.client_id} value={client.client_id}>
                {client.client_name || client.client_id}
              </option>
            ))}
          </select>
        )}

        {selectedClient && (
          <div className="mt-3 p-3 bg-blue-50 rounded-md">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-blue-800">
                  Viewing analytics for: {selectedClient.client_name || selectedClient.client_id}
                </p>
                <p className="text-sm text-blue-600">
                  Client ID: {selectedClient.client_id}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ClientSelector;