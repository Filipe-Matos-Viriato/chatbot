// File location: packages/frontend/src/dashboard/listing-performance-tab/components/listing-details/CompleteChatHistoryPage.jsx
// Description: This file displays the complete chat history for a given visitor, fetched from the chat_messages table.
// Why this file exists: To provide a dedicated view for the full conversation history of a visitor, without filtering by listing.
// Relevant files: packages/frontend/src/dashboard/VisitantesTable.jsx, packages/frontend/src/config/supabaseClient.js, packages/frontend/src/dashboard/DashboardUpInvestments.jsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../../config/supabaseClient';

const CompleteChatHistoryPage = () => {
    const { visitorId } = useParams();
    const navigate = useNavigate();
    const [chatMessages, setChatMessages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchChatHistory = async () => {
            try {
                const { data, error } = await supabase
                    .from('chat_messages')
                    .select('*')
                    .eq('visitor_id', visitorId)
                    .order('timestamp', { ascending: true });

                if (error) {
                    console.error('Error fetching chat messages:', error);
                    setError('Failed to load chat history.');
                } else {
                    setChatMessages(data || []);
                }
            } catch (err) {
                console.error('Unexpected error:', err);
                setError('An unexpected error occurred.');
            } finally {
                setLoading(false);
            }
        };

        if (visitorId) {
            fetchChatHistory();
        } else {
            setError('Visitor ID not provided.');
            setLoading(false);
        }
    }, [visitorId]);

    if (loading) {
        return <div className="text-center py-8">Loading chat history...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-600">{error}</div>;
    }

    return (
        <div className="min-h-screen bg-gray-50 p-8">
            <div className="flex items-center justify-between mb-6">
                <button
                    onClick={() => navigate(-1)}
                    className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-700 transition-colors border-4 border-blue-500"
                >
                    &larr; Back
                </button>
                <h2 className="text-2xl font-bold text-gray-800">Chat History for Visitor: {visitorId}</h2>
            </div>
            {chatMessages.length > 0 ? (
                <div className="space-y-4">
                    {chatMessages.map((message) => (
                        <div
                            key={message.id}
                            className={`p-4 rounded-lg shadow-sm ${
                                message.sender_role === 'user' ? 'bg-blue-100 text-blue-900 self-end ml-auto' : 'bg-gray-100 text-gray-800 self-start mr-auto'
                            }`}
                            style={{ maxWidth: '70%' }}
                        >
                            <p className="font-semibold">{message.sender_role === 'user' ? 'You' : 'Chatbot'}</p>
                            <p className="text-sm">{message.message_text}</p>
                            <p className="text-xs text-gray-500 mt-1">
                                {new Date(message.timestamp).toLocaleString()}
                            </p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-gray-600">No chat messages found for this visitor.</p>
            )}
        </div>
    );
};

export default CompleteChatHistoryPage;