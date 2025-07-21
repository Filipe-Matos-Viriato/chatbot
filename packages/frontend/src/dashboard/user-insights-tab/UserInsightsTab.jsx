import React from 'react';
import NewVsReturningUsers from './components/NewVsReturningUsers';
import RecentChatHistories from './components/RecentChatHistories';

const UserInsightsTab = ({ visitors }) => {
    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">User Insights</h2>

            <NewVsReturningUsers />

            <RecentChatHistories visitors={visitors} />
        </div>
    );
};

export default UserInsightsTab;