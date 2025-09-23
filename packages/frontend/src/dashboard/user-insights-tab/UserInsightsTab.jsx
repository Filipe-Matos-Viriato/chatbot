import React from 'react';
import { useSearchParams } from 'react-router-dom';
import NewVsReturningUsers from './components/NewVsReturningUsers';
import RecentChatHistories from './components/RecentChatHistories';

const UserInsightsTab = ({ visitors, onOpenChatHistory }) => {
    const [searchParams] = useSearchParams();
    const selectedVisitorId = searchParams.get('visitor');

    // Filter visitors if a specific visitor is selected
    const filteredVisitors = selectedVisitorId
        ? visitors.filter(visitor => visitor.visitor_id === selectedVisitorId)
        : visitors;

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