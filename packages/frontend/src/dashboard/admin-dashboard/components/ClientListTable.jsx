import React from 'react';

const ClientListTable = ({ clients, handleEditClick, handleDeleteClient }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200">
        <thead>
          <tr>
            <th className="py-2 px-4 border-b">Client ID</th>
            <th className="py-2 px-4 border-b">Client Name</th>
            <th className="py-2 px-4 border-b">Chatbot Name</th>
            <th className="py-2 px-4 border-b">Actions</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.client_id}>
              <td className="py-2 px-4 border-b">{client.client_id}</td>
              <td className="py-2 px-4 border-b">{client.client_name}</td>
              <td className="py-2 px-4 border-b">{client.chatbot_name}</td>
              <td className="py-2 px-4 border-b text-center">
                <button onClick={() => handleEditClick(client)} className="bg-blue-500 text-white px-3 py-1 rounded mr-2">Edit</button>
                <button onClick={() => handleDeleteClient(client.client_id)} className="bg-red-500 text-white px-3 py-1 rounded">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ClientListTable;