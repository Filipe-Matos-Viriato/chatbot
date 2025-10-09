import React, { useState, useEffect } from 'react';
import { supabase } from '../../config/supabaseClient';
import OverallListingPerformance from './components/OverallListingPerformance';
import PropertyTypeFeatureInterest from './components/PropertyTypeFeatureInterest';
import ListingsWithUnansweredQuestions from './components/ListingsWithUnansweredQuestions';
import ListingSearchInput from './components/ListingSearchInput';

const ListingPerformanceTab = ({ clientId, hideConversionMetrics }) => {
    const [listings, setListings] = useState([]);
    const [listingMetrics, setListingMetrics] = useState([]);
    const [clusteredQuestions, setClusteredQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch data for this component
    useEffect(() => {
        const fetchData = async () => {
            if (!clientId) return;

            console.log('[ListingPerformanceTab] Fetching data for client:', clientId);
            setLoading(true);

            try {
                // Fetch listings, metrics, and clustered questions in parallel
                const [listingsResult, metricsResult, questionsResult] = await Promise.all([
                    supabase.from('listings').select('*').eq('client_id', clientId),
                    supabase.from('listing_metrics').select('*').eq('client_id', clientId),
                    supabase.from('clustered_questions').select('*').eq('client_id', clientId)
                ]);

                if (listingsResult.error) console.error('Listings fetch error:', listingsResult.error);
                else setListings(listingsResult.data || []);

                if (metricsResult.error) console.error('Metrics fetch error:', metricsResult.error);
                else setListingMetrics(metricsResult.data || []);

                if (questionsResult.error) console.error('Questions fetch error:', questionsResult.error);
                else setClusteredQuestions(questionsResult.data || []);

            } catch (error) {
                console.error('[ListingPerformanceTab] Data fetch error:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [clientId]);

    const handleSearchChange = (event) => {
        setSearchTerm(event.target.value);
    };

    const handleClearSearch = () => {
        setSearchTerm('');
    };

    // Show loading state while fetching data
    if (loading) {
        return (
            <div className="space-y-8 w-full">
                <h2 className="text-2xl font-bold text-gray-800">Listing Performance</h2>
                <div className="text-center py-8">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                    <p className="mt-2 text-gray-600">Loading listing data...</p>
                </div>
            </div>
        );
    }

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