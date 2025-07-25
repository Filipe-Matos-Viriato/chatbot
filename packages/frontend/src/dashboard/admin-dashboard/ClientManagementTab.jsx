import React, { useState, useEffect } from 'react';
import axios from 'axios';
import CreateClientForm from './components/CreateClientForm';
import ClientListTable from './components/ClientListTable';
import EditClientForm from './components/EditClientForm';

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
    ingestion_pipeline: '',
    url_pattern: '',
    prompts: '',
    chat_history_tagging_rules: '',
    lead_scoring_rules: '',
  });

  const fetchClients = async () => {
    try {
      const response = await axios.get('http://localhost:3006/v1/clients');
      setClients(response.data);
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
    setEditingClient(client);
    setEditFormData({
      client_id: client.client_id,
      client_name: client.client_name,
      chatbot_name: client.chatbot_name,
      document_extraction: client.document_extraction ? JSON.stringify(client.document_extraction, null, 2) : '',
      ingestion_pipeline: client.ingestion_pipeline ? JSON.stringify(client.ingestion_pipeline, null, 2) : '',
      url_pattern: client.url_pattern || '',
      prompts: client.prompts ? JSON.stringify(client.prompts, null, 2) : '',
      chat_history_tagging_rules: client.chat_history_tagging_rules ? JSON.stringify(client.chat_history_tagging_rules, null, 2) : '',
      lead_scoring_rules: client.lead_scoring_rules ? JSON.stringify(client.lead_scoring_rules, null, 2) : '',
    });
  };

  const handleDeleteClient = async (clientId) => {
    try {
      await axios.delete(`http://localhost:3006/v1/clients/${clientId}`);
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