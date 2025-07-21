import React from 'react';

const ChatHandoffsToHumanAgents = () => {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800">Chat Handoffs to Human Agents</h3>
            <div className="mt-4 flex justify-around text-center">
                <div>
                    <p className="text-3xl font-bold text-blue-600">25</p>
                    <p className="text-sm text-gray-500">Total Handoffs</p>
                </div>
                <div>
                    <p className="text-3xl font-bold text-blue-600">10%</p>
                    <p className="text-sm text-gray-500">Handoff Rate</p>
                </div>
            </div>
            <ul className="mt-4 text-sm text-gray-700 list-disc list-inside">
                <li>50% - Complex Query</li>
                <li>30% - User Requested Agent</li>
                <li>20% - Specific Property Detail</li>
            </ul>
            <p className="text-sm text-gray-500 mt-2">Reasons for escalation and success rate post-handoff.</p>
            <p className="text-3xl font-bold text-blue-600 mt-4">75%</p>
            <p className="text-sm text-gray-500">Handoff Conversion Rate (e.g., led to viewing/contact)</p>
        </div>
    );
};

export default ChatHandoffsToHumanAgents;