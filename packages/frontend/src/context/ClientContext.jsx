import React, { createContext, useState, useContext, useEffect } from 'react';
import { API_BASE_URL } from '../config/apiClient';

const ClientContext = createContext();

export const ClientProvider = ({ children }) => {
    const [clients, setClients] = useState([]);
    const [selectedClientId, setSelectedClientId] = useState(''); // Initialize with empty string

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const response = await fetch(`${API_BASE_URL}/v1/clients`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();
                console.log("ClientContext: Fetched clients data:", data); // Add this line
                setClients(data);
                if (data.length > 0) {
                    setSelectedClientId(data[0].client_id); // Set first client as default
                    console.log("ClientContext: Initial selectedClientId set to", data[0].client_id); // Add log
                } else {
                    setSelectedClientId(''); // Ensure it's an empty string if no clients
                    console.log("ClientContext: No clients found, selectedClientId set to empty string"); // Add log
                }
            } catch (error) {
                console.error("Error fetching clients:", error);
            }
        };

        fetchClients();
    }, []);

    return (
        <ClientContext.Provider value={{ clients, selectedClientId, setSelectedClientId }}>
            {children}
        </ClientContext.Provider>
    );
};

export const useClient = () => useContext(ClientContext);