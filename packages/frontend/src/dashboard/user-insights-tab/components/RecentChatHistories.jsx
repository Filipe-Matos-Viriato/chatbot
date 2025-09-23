import React, { useState, useMemo } from 'react';

const RecentChatHistories = ({ visitors, selectedVisitorId, onOpenChatHistory }) => {
    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc');

    const title = selectedVisitorId ? 'Chat History Details' : 'Recent Chat Histories';

    const sortedVisitors = useMemo(() => {
        if (!visitors) return [];
        let sortableVisitors = [...visitors];

        if (sortColumn) {
            sortableVisitors.sort((a, b) => {
                let valA = a[sortColumn];
                let valB = b[sortColumn];

                // Handle date sorting for updated_at
                if (sortColumn === 'updated_at') {
                    valA = new Date(valA).getTime();
                    valB = new Date(valB).getTime();
                }

                if (valA < valB) {
                    return sortDirection === 'asc' ? -1 : 1;
                }
                if (valA > valB) {
                    return sortDirection === 'asc' ? 1 : -1;
                }
                return 0;
            });
        }
        return sortableVisitors;
    }, [visitors, sortColumn, sortDirection]);

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const getSortIndicator = (column) => {
        if (sortColumn === column) {
            return sortDirection === 'asc' ? ' ↑' : ' ↓';
        }
        return ' ⇅';
    };

    return (
        <div className="card-standard">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">{title}</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('visitor_id')}>
                                User ID {getSortIndicator('visitor_id')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('updated_at')}>
                                Last Chat Date {getSortIndicator('updated_at')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('lead_score')}>
                                Lead Score {getSortIndicator('lead_score')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Summary
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {sortedVisitors.map((visitor) => (
                            <tr
                                key={visitor.visitor_id}
                                className="cursor-pointer hover:bg-gray-50"
                                onClick={() => onOpenChatHistory && onOpenChatHistory(visitor.visitor_id)}
                            >
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                    {visitor.name || visitor.visitor_id}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {new Date(visitor.updated_at).toLocaleDateString()} {new Date(visitor.updated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    {visitor.lead_score} ({visitor.lead_score >= 70 ? 'Hot' : visitor.lead_score >= 40 ? 'Warm' : 'Cold'})
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                    Chat history for {visitor.name || 'N/A'} about ...
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-center align-middle">
                                    <span className="material-symbols-sharp text-gray-500 relative top-[5px]">forum</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default RecentChatHistories;