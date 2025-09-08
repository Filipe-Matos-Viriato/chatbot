import React from 'react';
import { useClient } from '../context/ClientContext'; // Import useClient

const DashboardHeader = ({ title, hideClientSelect }) => {
    const { clients, selectedClientId, setSelectedClientId } = useClient();

    const handleClientChange = (event) => {
        setSelectedClientId(event.target.value);
        console.log("Selected Client ID:", event.target.value);
    };

    return (
        <header className="bg-white shadow-sm py-4 px-6">
            <div className="max-w-dashboard mx-auto px-6 flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">{title || "Real Estate Chatbot Dashboard"}</h1>
                <div className="flex items-center space-x-4">
                    {!hideClientSelect && selectedClientId !== null && ( // Conditionally render select based on hideClientSelect prop
                        <select
                            value={selectedClientId}
                            onChange={handleClientChange}
                            className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                        >
                            {clients.map((client) => (
                                <option key={client.client_id} value={client.client_id}>
                                    {client.client_name}
                                </option>
                            ))}
                        </select>
                    )}
                    <span className="text-gray-600 text-sm">Welcome, Client Name</span>
                    <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-semibold">
                        CN
                    </div>
                </div>
            </div>
        </header>
    );
};

export default DashboardHeader;