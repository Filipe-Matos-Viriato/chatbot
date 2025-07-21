import React from 'react';

const NavigationTabs = ({ activeTab, onTabClick }) => {
    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'lead-performance', label: 'Lead Performance' },
        { id: 'chatbot-analytics', label: 'Chatbot Analytics' },
        { id: 'listing-performance', label: 'Listing Performance' },
        { id: 'user-insights', label: 'User Insights' }
    ];

    return (
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        activeTab === tab.id 
                            ? 'bg-white text-gray-900 shadow' 
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                    onClick={() => onTabClick(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

export default NavigationTabs;