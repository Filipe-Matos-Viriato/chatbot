import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import OverviewTab from './overview-tab/OverviewTab';
import NavigationTabs from './NavigationTabs';
import DashboardHeader from './DashboardHeader';


// Main Dashboard Component
const Dashboard = () => {
    const [activeTab, setActiveTab] = useState('overview');
    const [visitors, setVisitors] = useState([]);
    const [listings, setListings] = useState([]);
    const [listingMetrics, setListingMetrics] = useState([]);

    // Fetch data from Supabase
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [visitorsResult, listingsResult, metricsResult] = await Promise.all([
                    supabase.from('visitors').select('*'),
                    supabase.from('listings').select('*'),
                    supabase.from('listing_metrics').select('*')
                ]);

                if (!visitorsResult.error) setVisitors(visitorsResult.data || []);
                if (!listingsResult.error) setListings(listingsResult.data || []);
                if (!metricsResult.error) setListingMetrics(metricsResult.data || []);
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        fetchData();
    }, []);

    const handleTabClick = (tabId) => {
        setActiveTab(tabId);
    };

    const handleViewHotLeads = () => {
        setActiveTab('lead-performance');
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
            <DashboardHeader />

            <div className="flex-grow max-w-7xl mx-auto px-8 md:px-12 py-8">
                <NavigationTabs activeTab={activeTab} onTabClick={handleTabClick} />

                {activeTab === 'overview' && (
                    <OverviewTab onViewHotLeads={handleViewHotLeads} />
                )}

                {activeTab !== 'overview' && (
                    <div className="text-center py-12">
                        <h3 className="text-lg font-medium text-gray-600">
                            This tab is under development
                        </h3>
                        <p className="text-sm text-gray-500 mt-2">
                            The {activeTab} functionality will be implemented soon.
                        </p>
                    </div>
                )}
            </div>

            {/* Floating Chat Widget */}
            <div className="fixed bottom-6 right-6">
                <button className="w-12 h-12 bg-gray-800 rounded-full shadow-lg flex items-center justify-center text-white hover:bg-gray-700 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                </button>
            </div>
        </div>
    );
};

export default Dashboard;