import React, { useState, useMemo } from 'react';

const IndividualLeadsTable = ({ listingName, leads }) => {
    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'

    const sortedLeads = useMemo(() => {
        if (!leads) return [];
        let sortableLeads = [...leads];

        if (sortColumn) {
            sortableLeads.sort((a, b) => {
                let valA = a[sortColumn];
                let valB = b[sortColumn];

                // Handle date sorting
                if (sortColumn === 'created_at') {
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
        return sortableLeads;
    }, [leads, sortColumn, sortDirection]);

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const getSortIcon = (column) => {
        if (sortColumn === column) {
            return sortDirection === 'asc' ? ' ▲' : ' ▼';
        }
        // Show double arrow for sortable columns when not currently sorted
        if (column === 'lead_score' || column === 'created_at') {
            return ' ▲▼';
        }
        return '';
    };
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Individual Leads Interested in This Listing</h3>
            {leads && leads.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead>
                            <tr>
                                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Visitor ID
                                </th>
                                <th
                                    className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('lead_score')}
                                >
                                    <div className="flex items-center justify-center">
                                        <span>Lead Score</span>
                                        <span className="w-4 text-right ml-2 text-xs">{getSortIcon('lead_score')}</span>
                                    </div>
                                </th>
                                <th
                                    className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('created_at')}
                                >
                                    <div className="flex items-center justify-center">
                                        <span>Created At</span>
                                        <span className="w-4 text-right ml-2 text-xs">{getSortIcon('created_at')}</span>
                                    </div>
                                </th>
                                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50"></th> {/* New empty header */}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedLeads.map((lead) => (
                                <tr
                                    key={lead.visitor_id}
                                    className="cursor-pointer hover:bg-gray-50"
                                    onClick={() => console.log('Clicked on visitor:', lead.visitor_id)} // Placeholder for click action
                                >
                                    <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-900">
                                        {lead.visitor_id}
                                    </td>
                                    <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-900 text-center">
                                        {lead.lead_score}
                                    </td>
                                    <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-900 text-center">
                                        {new Date(lead.created_at).toLocaleString()}
                                    </td>
                                    <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-900 text-center">
                                        <span className="material-symbols-outlined text-gray-500">chat_info</span> {/* Chat Info icon */}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-gray-600 mb-4">No individual leads found for {listingName || 'this listing'}.</p>
            )}
            <p className="text-sm text-gray-500 mt-4">
                This table shows specific leads who engaged with the chatbot about this property, their scores, and creation dates.
            </p>
        </div>
    );
};

export default IndividualLeadsTable;