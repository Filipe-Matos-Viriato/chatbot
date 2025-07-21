import React from 'react';

const HotLeadsAlert = ({ count, onViewLeads }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold text-red-800">🔥 {count} New Hot Leads Identified!</h3>
                <p className="text-sm text-red-700 mt-1">
                    These leads scored 70+ points and are ready for immediate agent follow-up.
                </p>
            </div>
            <button 
                onClick={onViewLeads}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition-colors"
            >
                View Hot Leads
            </button>
        </div>
    </div>
);

export default HotLeadsAlert;