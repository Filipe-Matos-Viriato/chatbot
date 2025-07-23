import React, { useState } from 'react';
import OverallListingPerformance from './components/OverallListingPerformance';
import PropertyTypeFeatureInterest from './components/PropertyTypeFeatureInterest';
import ListingsWithUnansweredQuestions from './components/ListingsWithUnansweredQuestions';
import ListingSearchInput from './components/ListingSearchInput';

const ListingPerformanceTab = ({ listings, listingMetrics }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">Listing Performance</h2>
            <ListingSearchInput
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                onClearSearch={handleClearSearch}
            />

            <OverallListingPerformance listings={listings} listingMetrics={listingMetrics} searchTerm={searchTerm} />

            {/* Property Type & Feature Interest */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <PropertyTypeFeatureInterest />
                <ListingsWithUnansweredQuestions />
            </div>
        </div>
    );
};

export default ListingPerformanceTab;