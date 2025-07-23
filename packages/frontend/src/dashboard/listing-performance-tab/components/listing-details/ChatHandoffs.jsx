import React from 'react';

const ChatHandoffs = ({ handoffs }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Chat Handoffs for this Listing</h3>
            <ul className="list-disc list-inside space-y-2 text-gray-600">
                {handoffs.map((h, index) => (
                    <li key={index}>{h.reason} ({h.count} times)</li>
                ))}
            </ul>
            <p className="text-sm text-gray-500 mt-2">Understanding reasons for human intervention specific to this property.</p>
        </div>
    );
};

export default ChatHandoffs;