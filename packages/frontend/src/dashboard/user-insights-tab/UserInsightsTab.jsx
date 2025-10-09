import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useClient } from '../../context/ClientContext';
import NewVsReturningUsers from './components/NewVsReturningUsers';
import RecentChatHistories from './components/RecentChatHistories';

const UserInsightsTab = ({ clientId, onOpenChatHistory }) => {
    const [visitors, setVisitors] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchParams] = useSearchParams();
    const selectedVisitorId = searchParams.get('visitor');

    // Fetch visitors on component mount
    useEffect(() => {
        const fetchVisitors = async () => {
            if (!clientId) return;

            try {
                setLoading(true);
                setError(null);

                console.log('[UserInsightsTab] Fetching visitors for client:', clientId);

                // Use the correct API base URL for backend calls
                const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:3007' : `${window.location.origin}/api`;
                const response = await fetch(`${apiBaseUrl}/api/dashboard/visitors-with-events/${clientId}?page=1&limit=1000&sortBy=updated_at&sortOrder=desc`);

                if (!response.ok) {
                    throw new Error(`Failed to fetch visitors: ${response.status}`);
                }

                const data = await response.json();
                console.log(`[UserInsightsTab] Fetched ${data.visitors?.length || 0} visitors`);

                setVisitors(data.visitors || []);
            } catch (error) {
                console.error('[UserInsightsTab] Error fetching visitors:', error);
                setError(error.message);
                setVisitors([]);
            } finally {
                setLoading(false);
            }
        };

        fetchVisitors();
    }, [clientId]);

    // Filter visitors if a specific visitor is selected
    const filteredVisitors = selectedVisitorId
        ? visitors.filter(visitor => visitor.visitor_id === selectedVisitorId)
        : visitors;

    // Show loading state
    if (loading) {
        return (
            <div className="space-y-8 w-full">
                <h2 className="text-2xl font-bold text-gray-800">User Insights</h2>
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <p className="mt-2 text-gray-600">Loading visitor data...</p>
                </div>
            </div>
        );
    }

    // Show error state
    if (error) {
        return (
            <div className="space-y-8 w-full">
                <h2 className="text-2xl font-bold text-gray-800">User Insights</h2>
                <div className="text-center py-8">
                    <div className="text-red-600">
                        <p className="font-semibold">Error loading visitor data</p>
                        <p className="text-sm mt-1">{error}</p>
                    </div>
                </div>
            </div>
        );
    }

    const title = selectedVisitorId
        ? `Chat History - ${selectedVisitorId}`
        : 'User Insights';

    return (
        <div className="space-y-8 w-full">
            <h2 className="text-2xl font-bold text-gray-800">{title}</h2>

            {!selectedVisitorId && <NewVsReturningUsers />}

            <RecentChatHistories visitors={filteredVisitors} selectedVisitorId={selectedVisitorId} onOpenChatHistory={onOpenChatHistory} />
        </div>
    );
};

export default UserInsightsTab;