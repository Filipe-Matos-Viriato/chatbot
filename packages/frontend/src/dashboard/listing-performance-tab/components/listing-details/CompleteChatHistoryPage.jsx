// File location: packages/frontend/src/dashboard/listing-performance-tab/components/listing-details/CompleteChatHistoryPage.jsx
// Description: This file displays the complete chat history for a given visitor, fetched from the chat_messages table.
// Why this file exists: To provide a dedicated view for the full conversation history of a visitor, without filtering by listing.
// Relevant files: packages/frontend/src/dashboard/VisitantesTable.jsx, packages/frontend/src/config/supabaseClient.js, packages/frontend/src/dashboard/DashboardUpInvestments.jsx

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../../config/supabaseClient';
import { useClient } from '../../../../context/ClientContext';

const CompleteChatHistoryPage = () => {
    const { visitorId } = useParams();
    const navigate = useNavigate();
    const { selectedClientId } = useClient();
    const [chatMessages, setChatMessages] = useState([]);
    const [visitorData, setVisitorData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [chatContainerHeight, setChatContainerHeight] = useState('600px'); // Default fallback height

    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch chat messages
                const { data: messagesData, error: messagesError } = await supabase
                    .from('chat_messages')
                    .select('*')
                    .eq('visitor_id', visitorId)
                    .eq('client_id', selectedClientId)
                    .order('timestamp', { ascending: true });

                if (messagesError) {
                    console.error('Error fetching chat messages:', messagesError);
                    setError('Failed to load chat history.');
                    return;
                }

                // Fetch visitor data
                const { data: visitorData, error: visitorError } = await supabase
                    .from('visitors')
                    .select('*')
                    .eq('visitor_id', visitorId)
                    .eq('client_id', selectedClientId)
                    .single();

                if (visitorError) {
                    console.error('Error fetching visitor data:', visitorError);
                    // Don't set error for visitor data, just set to null
                    setVisitorData(null);
                } else {
                    setVisitorData(visitorData);
                }

                setChatMessages(messagesData || []);
            } catch (err) {
                console.error('Unexpected error:', err);
                setError('An unexpected error occurred.');
            } finally {
                setLoading(false);
            }
        };

        if (visitorId && selectedClientId) {
            fetchData();
        } else {
            setError('Visitor ID or Client ID not provided.');
            setLoading(false);
        }
    }, [visitorId, selectedClientId]);

    // Hybrid height calculation: viewport-based with conservative fallbacks
    const calculateOptimalHeight = useCallback(() => {
        try {
            const viewportHeight = window.innerHeight;

            // Accurate estimates for fixed UI elements (in pixels)
            const headerHeight = 64; // DashboardHeader + padding (actual measurement)
            const navigationHeight = 48; // NavigationTabs + margins (actual measurement)
            const containerPadding = 48; // py-container-padding (24px * 2)
            const mainMargin = 32; // mt-8
            const cardPadding = 48; // p-6 (24px * 2)
            const cardHeaderHeight = 80; // Title, button, contact info area (reduced from 120)
            const bottomBuffer = 24; // Reduced buffer to allow more height

            // Calculate available height for chat container
            const fixedHeights = headerHeight + navigationHeight + containerPadding +
                               mainMargin + cardPadding + cardHeaderHeight + bottomBuffer;

            const availableHeight = viewportHeight - fixedHeights;

            // Apply constraints: minimum 400px, maximum 85% of viewport
            const minHeight = 400;
            const maxHeight = Math.floor(viewportHeight * 0.85);
            const optimalHeight = Math.max(minHeight, Math.min(availableHeight, maxHeight));

            // DEBUG: Log height calculations
            console.log('[ChatHeight] Viewport:', viewportHeight, 'Fixed:', fixedHeights, 'Available:', availableHeight, 'Max:', maxHeight, 'Optimal:', optimalHeight);

            return `${optimalHeight}px`;
        } catch (error) {
            console.warn('[CompleteChatHistoryPage] Height calculation failed, using fallback:', error);
            // Fallback heights based on common screen sizes
            const viewportHeight = window.innerHeight || 768;
            if (viewportHeight >= 1200) return '700px'; // Large screens
            if (viewportHeight >= 900) return '600px';  // Medium screens
            if (viewportHeight >= 768) return '500px';  // Tablets
            return '400px'; // Small screens / fallback
        }
    }, []);

    // Update height on mount and window resize
    useEffect(() => {
        const updateHeight = () => {
            const newHeight = calculateOptimalHeight();
            setChatContainerHeight(newHeight);
        };

        // Initial calculation
        updateHeight();

        // Update on window resize with debouncing
        let resizeTimeout;
        const handleResize = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(updateHeight, 100);
        };

        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            clearTimeout(resizeTimeout);
            window.removeEventListener('resize', handleResize);
        };
    }, [calculateOptimalHeight]);

    if (loading) {
        return <div className="text-center py-8">Loading chat history...</div>;
    }

    if (error) {
        return <div className="text-center py-8 text-red-600">{error}</div>;
    }

    const hasContactInfo = visitorData && (visitorData.email || visitorData.phone);

    return (
        <div className="space-y-8 w-full">
            <div className="bg-white p-6 rounded-lg shadow">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-bold text-gray-800">
                        Chat History for Visitor: {visitorData?.name || visitorId}
                    </h2>
                    <button
                        onClick={() => navigate(-1)}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none"
                    >
                        Back
                    </button>
                </div>
                <div className="mb-4 text-gray-600">
                    {hasContactInfo ? (
                        <div>
                            {visitorData.email && <span>Email: {visitorData.email}</span>}
                            {visitorData.email && visitorData.phone && <span> • </span>}
                            {visitorData.phone && <span>Phone: {visitorData.phone}</span>}
                        </div>
                    ) : (
                        <div>No contact information available</div>
                    )}
                </div>
                {chatMessages.length > 0 ? (
                    <div
                        className="flex flex-col space-y-4 overflow-y-auto mt-10"
                        style={{ maxHeight: chatContainerHeight }}
                    >
                        {chatMessages.map((message) => (
                            <div
                                key={message.id}
                                className={`p-4 rounded-lg max-w-[75%] ${
                                    message.sender_role === 'user'
                                        ? 'bg-blue-100 text-blue-800 self-start mr-auto'
                                        : 'bg-gray-100 text-gray-800 self-end ml-auto'
                                }`}
                            >
                                <p className="font-semibold">{message.sender_role === 'user' ? 'You' : 'Chatbot'}:</p>
                                <p>{message.message_text}</p>
                                <p className="text-xs text-gray-500 mt-1">{new Date(message.timestamp).toLocaleString()}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-gray-600">No chat messages found for this visitor.</div>
                )}
            </div>
        </div>
    );
};

export default CompleteChatHistoryPage;