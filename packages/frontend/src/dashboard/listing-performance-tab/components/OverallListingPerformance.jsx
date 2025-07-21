import React from 'react';

const OverallListingPerformance = ({ listings, listingMetrics }) => {
    // For now, using dummy data as the actual data needs to be calculated from listings and listingMetrics
    const dummyData = [
        { id: 'PROP-005', name: 'Luxury Villa, Cascais', views: 320, chats: 85, handoffs: 10, conversion: '12.5%' },
        { id: 'PROP-012', name: 'Downtown Apt, Lisbon', views: 280, chats: 72, handoffs: 8, conversion: '11.1%' },
    ];

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Overall Listing Performance by Chatbot Engagement</h3>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Listing ID
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Property Name
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Chatbot Views
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Inquiries
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Hot Leads
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Conversion Rate
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {dummyData.map((listing) => (
                            <tr key={listing.id}>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{listing.id}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{listing.name}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{listing.views}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{listing.chats}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{listing.handoffs}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{listing.conversion}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                    <button className="text-blue-600 hover:text-blue-900">View Details</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default OverallListingPerformance;