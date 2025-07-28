import React, { useState } from 'react';
import axios from 'axios';

const CreateClientForm = ({ fetchClients }) => {
  const [newClient, setNewClient] = useState({
    client_name: '',
    chatbot_name: '',
  });
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewClient({ ...newClient, [name]: value });
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await axios.post('http://localhost:3007/v1/clients', newClient);
      setNewClient({ client_name: '', chatbot_name: '' }); // Clear form
      fetchClients(); // Refresh list
      setError(null); // Clear any previous errors
    } catch (err) {
      setError(err);
    }
  };

  return (
    <div className="mb-8 p-4 border rounded shadow-sm bg-white">
      <h3 className="text-xl font-semibold mb-4">Create New Client</h3>
      {error && <p className="text-red-500 mb-4">Error creating client: {error.message}</p>}
      <form onSubmit={handleCreateClient} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label htmlFor="client_name" className="block text-sm font-medium text-gray-700">Client Name</label>
          <input
            type="text"
            name="client_name"
            id="client_name"
            value={newClient.client_name}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div>
          <label htmlFor="chatbot_name" className="block text-sm font-medium text-gray-700">Chatbot Name</label>
          <input
            type="text"
            name="chatbot_name"
            id="chatbot_name"
            value={newClient.chatbot_name}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            required
          />
        </div>
        <div className="md:col-span-3">
          <button
            type="submit"
            className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600"
          >
            Add Client
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateClientForm;