import React, { useState } from 'react';
import OverallListingPerformance from './components/OverallListingPerformance';
import PropertyTypeFeatureInterest from './components/PropertyTypeFeatureInterest';
import ListingsWithUnansweredQuestions from './components/ListingsWithUnansweredQuestions';
import ListingSearchInput from './components/ListingSearchInput';

const ListingPerformanceTab = ({ listings, listingMetrics, clusteredQuestions, hideConversionMetrics }) => {
    const [searchTerm, setSearchTerm] = useState('');

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    return (
        <div className="space-y-8 w-full">
            <h2 className="text-2xl font-bold text-gray-800">Listing Performance</h2>
            <ListingSearchInput
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                onClearSearch={handleClearSearch}
            />

            <OverallListingPerformance listings={listings} listingMetrics={listingMetrics} searchTerm={searchTerm} hideConversionMetrics={hideConversionMetrics} />

            {/* Property Type & Feature Interest */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <PropertyTypeFeatureInterest listings={listings} listingMetrics={listingMetrics} clusteredQuestions={clusteredQuestions} />
                <ListingsWithUnansweredQuestions />
            </div>
        </div>
    );
};

export default ListingPerformanceTab;