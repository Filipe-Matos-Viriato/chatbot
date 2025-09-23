import React from 'react';

const LeadTypeFilters = ({ activeFilter, onFilterChange }) => {
    const filters = [
        { key: 'all', label: 'All Leads' },
        { key: 'hot', label: 'Hot Leads' },
        { key: 'warm', label: 'Warm Leads' },
        { key: 'cold', label: 'Cold Leads' }
    ];

    return (
        <div className="flex space-x-4">
            {filters.map((filter) => (
                <button
                    key={filter.key}
                    onClick={() => onFilterChange(filter.key)}
                    className={`px-6 py-2 rounded-lg shadow transition-colors ${
                        activeFilter === filter.key
                            ? 'bg-blue-600 text-white hover:bg-blue-700'
                            : 'bg-gray-200 text-gray-800 hover:bg-gray-300'
                    }`}
                >
                    {filter.label}
                </button>
            ))}
        </div>
    );
};

export default LeadTypeFilters;