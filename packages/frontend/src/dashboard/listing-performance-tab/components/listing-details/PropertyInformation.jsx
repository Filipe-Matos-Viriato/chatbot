import React from 'react';

const PropertyInformation = ({ listing }) => {
    if (!listing) {
        return <div className="bg-white p-6 rounded-lg shadow">Loading property information...</div>;
    }

    return (
        <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Property Information</h3>
            <div className="space-y-2 text-gray-600">
                <p><strong>Address:</strong> {listing.address}</p>
                <p><strong>Type:</strong> {listing.type}</p>
                <p><strong>Price:</strong> {listing.price}</p>
                <p><strong>Bedrooms:</strong> {listing.beds}</p>
                <p><strong>Bathrooms:</strong> {listing.baths}</p>
                <p><strong>Amenities:</strong> {listing.amenities ? listing.amenities.join(', ') : 'N/A'}</p>
            </div>
        </div>
    );
};

export default PropertyInformation;