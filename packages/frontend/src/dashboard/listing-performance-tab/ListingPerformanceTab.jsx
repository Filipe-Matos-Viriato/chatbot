import React from 'react';
import OverallListingPerformance from './components/OverallListingPerformance';
import PropertyTypeFeatureInterest from './components/PropertyTypeFeatureInterest';
import ListingsWithUnansweredQuestions from './components/ListingsWithUnansweredQuestions';

const ListingPerformanceTab = ({ listings, listingMetrics }) => {
    return (
        <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-800">Listing Performance</h2>

            <OverallListingPerformance listings={listings} listingMetrics={listingMetrics} />

            {/* Property Type & Feature Interest */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <PropertyTypeFeatureInterest />
                <ListingsWithUnansweredQuestions />
            </div>
        </div>
    );
};

export default ListingPerformanceTab;