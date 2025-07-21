import React from 'react';

const IndividualLeadProgression = ({ visitors }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Individual Lead Progression</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Lead ID
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Current Score
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Last Activity
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Score Trend
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {visitors.map((visitor) => (
                            <tr key={visitor.visitor_id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {`LEAD-${visitor.visitor_id.substring(0, 3)} (${visitor.name || 'N/A'})`}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {visitor.lead_score} {visitor.lead_score > 60 ? '▲' : visitor.lead_score < 40 ? '▼' : '—'}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {visitor.events && visitor.events.length > 0 ? visitor.events[visitor.events.length - 1].type : 'N/A'} ({(new Date() - new Date(visitor.updated_at)) / (1000 * 60 * 60 * 24) < 1 ? `${Math.round((new Date() - new Date(visitor.updated_at)) / (1000 * 60 * 60))}h ago` : `${Math.round((new Date() - new Date(visitor.updated_at)) / (1000 * 60 * 60 * 24))}d ago`})
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    Mini Trend
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button className="text-blue-600 hover:text-blue-900">View Chat</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default IndividualLeadProgression;