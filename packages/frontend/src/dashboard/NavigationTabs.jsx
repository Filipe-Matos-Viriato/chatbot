import React from 'react';

const NavigationTabs = ({ activeTab, onTabClick, tabs: propTabs }) => {
    // Use the tabs array passed as a prop, or fall back to the default hardcoded tabs
    // This ensures backward compatibility for components that don't pass the 'tabs' prop.
    const defaultTabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'lead-performance', label: 'Lead Performance' },
        { id: 'listing-performance', label: 'Listing Performance' },
        { id: 'unanswered-questions', label: 'Unanswered Questions' },
        { id: 'user-insights', label: 'User Insights' },
        { id: 'chatbot-analytics', label: 'Chatbot Analytics' }
    ];
    const tabs = propTabs || defaultTabs;

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
                    onClick={() => onTabClick(tab.id)} // onTabClick now handles navigation
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

export default NavigationTabs;