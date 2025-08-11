// packages/frontend/src/dashboard/listing-performance-tab/components/listing-details/ChatHistoryPage.jsx
// This file defines the ChatHistoryPage component, which displays the full chat history for a specific visitor.
// This component exists to provide a detailed view of individual visitor interactions, aiding in lead analysis and support.
// Relevant files: packages/frontend/src/dashboard/listing-performance-tab/components/listing-details/IndividualLeadsTable.jsx, packages/frontend/src/main.jsx, packages/backend/src/services/chat-history-service.js, packages/backend/src/index.js

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../../../config/apiClient';
import { useClient } from '../../../../context/ClientContext';

const ChatHistoryPage = () => {
    const { visitorId } = useParams();
    const navigate = useNavigate();
    const { selectedClientId } = useClient();
    const [chatHistory, setChatHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchChatHistory = async () => {
            try {
                setLoading(true);
                const response = await apiRequest(`/v1/chat-history/${visitorId}`, {
                    method: 'GET',
                    headers: {
                        'X-Client-Id': selectedClientId,
                    },
                });
                setChatHistory(response);
            } catch (err) {
                console.error('Error fetching chat history:', err);
                setError('Failed to load chat history.');
            } finally {
                setLoading(false);
            }
        };

        if (visitorId) {
            fetchChatHistory();
        }
    }, [visitorId]);

    if (loading) {
        return <div className="text-center py-8">Loading chat history...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-500">{error}</div>;
    }

    if (chatHistory.length === 0) {
        return <div className="text-center py-8 text-gray-600">No chat history found for this visitor.</div>;
    }

    return (
        <div className="container mx-auto p-6 bg-white shadow-lg rounded-lg mt-8">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800">Chat History for Visitor: {visitorId}</h2>
                <button
                    onClick={() => navigate(-1)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none"
                >
                    Back
                </button>
            </div>
            <div className="flex flex-col space-y-4">
                {chatHistory.map((message, index) => (
                    <div
                        key={index}
                        className={`p-4 rounded-lg max-w-[75%] ${
                            message.sender === 'user'
                                ? 'bg-blue-100 text-blue-800 self-start mr-auto'
                                : 'bg-gray-100 text-gray-800 self-end ml-auto'
                        }`}
                    >
                        <p className="font-semibold">{message.sender === 'user' ? 'You' : 'Chatbot'}:</p>
                        <p>{message.text}</p>
                        <p className="text-xs text-gray-500 mt-1">{new Date(message.timestamp).toLocaleString()}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ChatHistoryPage;