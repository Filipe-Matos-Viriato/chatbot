// File location: packages/frontend/src/dashboard/VisitantesTable.jsx
// Description: This file implements a table to display visitor (lead) information for the Up Investments dashboard.
// Why this file exists: To provide a dedicated, sortable table for displaying visitor data including name, email, lead score, budget, and typology.
// Relevant files: packages/frontend/src/dashboard/DashboardUpInvestments.jsx, packages/frontend/src/dashboard/listing-performance-tab/components/listing-details/IndividualLeadsTable.jsx

import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

const VisitantesTable = ({ visitors }) => {
    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
    const navigate = useNavigate();

    // Configurable styling for the lead score badge
    const badgePadding = '4px 12px'; // Example: 4px top/bottom, 8px left/right
    const badgeBorderRadius = '6px'; // Example: 4px for slightly rounded corners, '0px' for sharp corners

    // Helper function to get lead score color
    const getLeadScoreColor = (score) => {
        if (score >= 70) {
            return 'rgb(255, 99, 132)'; // Hot Lead
        } else if (score >= 40) {
            return 'rgb(255, 206, 86)'; // Warm Lead
        } else {
            return 'rgb(54, 162, 235)'; // Cold Lead
        }
    };

    const sortedVisitors = useMemo(() => {
        if (!visitors) return [];
        let sortableVisitors = [...visitors];

        if (sortColumn) {
            sortableVisitors.sort((a, b) => {
                let valA = a[sortColumn];
                let valB = b[sortColumn];

                // Handle numeric sorting for lead_score, budget, tipologia
                if (['lead_score', 'budget', 'tipologia'].includes(sortColumn)) {
                    valA = parseFloat(valA) || 0; // Convert to number, default to 0 if not a valid number
                    valB = parseFloat(valB) || 0;
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

    const getSortIcon = (column) => {
        if (sortColumn === column) {
            return sortDirection === 'asc' ? ' ▲' : ' ▼';
        }
        // Show double arrow for sortable columns when not currently sorted
        if (['lead_score', 'budget', 'tipologia'].includes(column)) {
            return ' ▲▼';
        }
        return '';
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow w-[1184px]">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Visitantes</h3>
            {visitors && visitors.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead>
                            <tr>
                                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    Nome
                                </th>
                                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                                    E-mail
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
                                    onClick={() => handleSort('budget')}
                                >
                                    <div className="flex items-center justify-center">
                                        <span>Orçamento</span>
                                        <span className="w-4 text-right ml-2 text-xs">{getSortIcon('budget')}</span>
                                    </div>
                                </th>
                                <th
                                    className="py-2 px-4 border-b border-gray-200 bg-gray-50 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider cursor-pointer"
                                    onClick={() => handleSort('tipologia')}
                                >
                                    <div className="flex items-center justify-center">
                                        <span>Tipologia</span>
                                        <span className="w-4 text-right ml-2 text-xs">{getSortIcon('tipologia')}</span>
                                    </div>
                                </th>
                                <th className="py-2 px-4 border-b border-gray-200 bg-gray-50"></th> {/* Empty header for icon column */}
                            </tr>
                        </thead>
                        <tbody>
                            {sortedVisitors.map((visitor) => (
                                <tr
                                    key={visitor.visitor_id}
                                    className="cursor-pointer hover:bg-gray-50"
                                    onClick={() => {
                                        if (visitor.chat_messages && visitor.chat_messages[0].count > 0) {
                                            navigate(`/chat-history/${visitor.visitor_id}`);
                                        }
                                    }}
                                >
                                    <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-900">
                                        {visitor.name || 'N/A'}
                                    </td>
                                    <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-900">
                                        {visitor.email || 'N/A'}
                                    </td>
                                    <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-900 text-center">
                                        <span
                                            className="text-xs font-semibold"
                                            style={{
                                                backgroundColor: getLeadScoreColor(visitor.lead_score),
                                                color: 'white',
                                                padding: badgePadding,
                                                borderRadius: badgeBorderRadius
                                            }}
                                        >
                                            {visitor.lead_score}
                                        </span>
                                    </td>
                                    <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-900 text-center">
                                        {visitor.budget || 'N/A'}
                                    </td>
                                    <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-900 text-center">
                                        {visitor.tipologia || 'N/A'}
                                    </td>
                                    <td className="py-2 px-4 border-b border-gray-200 text-sm text-gray-900 text-center align-middle">
                                        <span className={`material-symbols-sharp relative top-[5px] ${
                                            visitor.chat_messages && visitor.chat_messages.length > 0 && visitor.chat_messages[0].count > 0
                                                ? 'text-gray-500 cursor-pointer'
                                                : 'text-gray-300 cursor-not-allowed'
                                        }`}>forum</span> {/* Chat Info icon */}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="text-gray-600 mb-4">No visitors found.</p>
            )}
        </div>
    );
};

export default VisitantesTable;