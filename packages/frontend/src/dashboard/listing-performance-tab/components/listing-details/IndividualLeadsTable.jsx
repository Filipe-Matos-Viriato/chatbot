import React from 'react';

const IndividualLeadsTable = ({ listingName }) => {
    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Individual Leads Interested in This Listing</h3>
            <div className="text-gray-600 mb-4">
                Table Placeholder for Leads related to {listingName || 'this listing'}
            </div>
            <p className="text-sm text-gray-500">
                This table would show specific leads who engaged with the chatbot about this property, their scores, and links to their full chat histories.
            </p>
        </div>
    );
};

export default IndividualLeadsTable;