import React from 'react';

const TopListings = ({ listings }) => (
    <div className="bg-white rounded-lg border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Most Inquired-About Listings</h3>
        <div className="flex justify-between items-center text-gray-600 text-sm font-medium mb-2">
            <span>Listing</span>
            <span>Inquiries</span>
        </div>
        <ul className="space-y-3">
            {listings.map((listing, index) => (
                <li key={index} className="flex justify-between items-center text-gray-700">
                    <span>{index + 1}. {listing.name}</span>
                    <span className="font-medium">{listing.inquiries}</span>
                </li>
            ))}
        </ul>
    </div>
);

export default TopListings;