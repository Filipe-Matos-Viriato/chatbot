import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config/apiClient';
import CreateClientForm from './components/CreateClientForm';
import ClientListTable from './components/ClientListTable';
import EditClientForm from './components/EditClientForm';
import ClientSearch from './components/ClientSearch';

const ClientManagementTab = () => {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingClient, setEditingClient] = useState(null);
  const [editFormData, setEditFormData] = useState({
    client_id: '',
    client_name: '',
    chatbot_name: '',
    document_extraction: '',
    chunking_rules: '',
    tagging_rules: '',
    url_pattern: '',
    prompts: '',
    chat_history_tagging_rules: '',
    lead_scoring_rules: '',
    default_onboarding_questions: '',
  });

  const fetchClients = async (searchQuery = '') => {
    try {
      const response = await axios.get(`${API_BASE_URL}/v1/clients`);
      let filteredClients = response.data;
      if (searchQuery) {
        filteredClients = response.data.filter(client =>
          client.client_name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      setClients(filteredClients);
      setError(null);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  const handleEditClick = (client) => {
    if (editingClient && editingClient.client_id === client.client_id) {
      setEditingClient(null); // Close the form if the same client is clicked again
    } else {
      setEditingClient(client);
      setEditFormData({
        client_id: client.client_id,
        client_name: client.client_name,
        chatbot_name: client.chatbot_name,
        document_extraction: client.document_extraction ? JSON.stringify(client.document_extraction, null, 2) : '',
        chunking_rules: client.chunking_rules ? JSON.stringify(client.chunking_rules, null, 2) : '',
        tagging_rules: client.tagging_rules ? JSON.stringify(client.tagging_rules, null, 2) : '',
        url_pattern: client.url_pattern || '',
        prompts: client.prompts ? JSON.stringify(client.prompts, null, 2) : '',
        chat_history_tagging_rules: client.chat_history_tagging_rules ? JSON.stringify(client.chat_history_tagging_rules, null, 2) : '',
        lead_scoring_rules: client.lead_scoring_rules ? JSON.stringify(client.lead_scoring_rules, null, 2) : '',
        default_onboarding_questions: client.default_onboarding_questions ? JSON.stringify(client.default_onboarding_questions, null, 2) : '',
      });
    }
  };

  const handleDeleteClient = async (clientId) => {
    try {
      await axios.delete(`${API_BASE_URL}/v1/clients/${clientId}`);
      fetchClients();
    } catch (err) {
      setError(err);
    }
  };

  if (loading) return <p>Loading clients...</p>;

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Client Management</h2>

      {error && <p className="text-red-500 mb-4">Error: {error.message}</p>}

      <CreateClientForm fetchClients={fetchClients} />

      <ClientSearch onSearch={fetchClients} />

      <ClientListTable
        clients={clients}
        handleEditClick={handleEditClick}
        handleDeleteClient={handleDeleteClient}
      />

      {editingClient && (
        <EditClientForm
          editingClient={editingClient}
          editFormData={editFormData}
          setEditFormData={setEditFormData}
          setEditingClient={setEditingClient}
          fetchClients={fetchClients}
          setError={setError}
        />
      )}
    </div>
  );
};

export default ClientManagementTab;