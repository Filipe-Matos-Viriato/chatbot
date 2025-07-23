import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const OverallListingPerformance = ({ listings, listingMetrics, searchTerm }) => {
    const navigate = useNavigate();
    const [currentPage, setCurrentPage] = useState(1);
    const [sortColumn, setSortColumn] = useState(null);
    const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
    const itemsPerPage = 10;

    // Combine listings and metrics data
    const combinedData = listings.map(listing => {
        const metrics = listingMetrics.find(m => m.listing_id === listing.id);
        return {
            id: listing.id,
            name: listing.name,
            engaged_users: metrics ? metrics.engaged_users : 0,
            inquiries: metrics ? metrics.inquiries : 0,
            total_conversions: metrics ? metrics.total_conversions : 0,
            conversion_rate: metrics ? metrics.conversion_rate : 0,
            unacknowledged_hot_leads: metrics ? metrics.unacknowledged_hot_leads : 0,
        };
    });

    // Filter logic
    const filteredData = combinedData.filter(listing =>
        listing.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        listing.id.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // Sorting logic
    const sortedData = [...filteredData].sort((a, b) => {
        if (sortColumn === null) return 0;

        const aValue = a[sortColumn];
        const bValue = b[sortColumn];

        if (typeof aValue === 'string' && typeof bValue === 'string') {
            return sortDirection === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
        } else {
            return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
        }
    });

    // Pagination logic
    const totalPages = Math.ceil(sortedData.length / itemsPerPage);
    // Reset to first page if search term changes or data changes
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, sortedData.length]);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentListings = sortedData.slice(startIndex, endIndex);

    const handleSort = (column) => {
        if (sortColumn === column) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
        } else {
            setSortColumn(column);
            setSortDirection('asc');
        }
    };

    const handlePageChange = (newPage) => {
        if (newPage > 0 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const getSortIndicator = (column) => {
        if (sortColumn === column) {
            return sortDirection === 'asc' ? ' ▲' : ' ▼';
        }
        return '';
    };

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Overall Listing Performance by Chatbot Engagement</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('id')}>
                                Listing ID {getSortIndicator('id')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('name')}>
                                Property Name {getSortIndicator('name')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('engaged_users')}>
                                Engaged Users {getSortIndicator('engaged_users')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('inquiries')}>
                                Inquiries {getSortIndicator('inquiries')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('total_conversions')}>
                                Total Conversions {getSortIndicator('total_conversions')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('conversion_rate')}>
                                Conversion Rate {getSortIndicator('conversion_rate')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('unacknowledged_hot_leads')}>
                                Unacknowledged Hot Leads {getSortIndicator('unacknowledged_hot_leads')}
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {currentListings.map((listing) => (
                            <tr key={listing.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{listing.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{listing.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{listing.engaged_users}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{listing.inquiries}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{listing.total_conversions}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{listing.conversion_rate !== null ? listing.conversion_rate.toFixed(2) : '0.00'}%</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{listing.unacknowledged_hot_leads}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button
                                        onClick={() => navigate(`/dashboard/listing/${listing.id}`)}
                                        className="text-blue-600 hover:text-blue-900"
                                    >
                                        View Details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* Pagination Controls */}
            <div className="flex justify-between items-center mt-4">
                <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md disabled:opacity-50"
                >
                    Previous
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md disabled:opacity-50"
                >
                    Next
                </button>
            </div>
        </div>
    );
};

export default OverallListingPerformance;