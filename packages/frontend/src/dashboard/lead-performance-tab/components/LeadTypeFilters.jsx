import React from 'react';

const LeadTypeFilters = () => {
    return (
        <div className="flex space-x-4">
            <button className="px-6 py-2 bg-blue-600 text-white rounded-lg shadow hover:bg-blue-700 transition-colors">
                All Leads
            </button>
            <button className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg shadow hover:bg-gray-300 transition-colors">
                Hot Leads
            </button>
            <button className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg shadow hover:bg-gray-300 transition-colors">
                Warm Leads
            </button>
            <button className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg shadow hover:bg-gray-300 transition-colors">
                Cold Leads
            </button>
        </div>
    );
};

export default LeadTypeFilters;