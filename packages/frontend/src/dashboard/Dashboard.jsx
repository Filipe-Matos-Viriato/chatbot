import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { Routes, Route, useLocation, useNavigate, Outlet } from 'react-router-dom';
import OverviewTab from './overview-tab/OverviewTab';
import LeadPerformanceTab from './lead-performance-tab/LeadPerformanceTab';
import NavigationTabs from './NavigationTabs';
import ChatbotAnalyticsTab from './chatbot-analytics-tab/ChatbotAnalyticsTab';
import UserInsightsTab from './user-insights-tab/UserInsightsTab';
import DashboardHeader from './DashboardHeader';
import ListingPerformanceTab from './listing-performance-tab/ListingPerformanceTab';
import ListingDetailsPage from './listing-performance-tab/components/ListingDetailsPage';

// Main Dashboard Component
const Dashboard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const [visitors, setVisitors] = useState([]);
    const [listings, setListings] = useState([]);
    const [listingMetrics, setListingMetrics] = useState([]);
    const [topInquiredListings, setTopInquiredListings] = useState([]);

    // Determine active tab based on URL
    const getActiveTabFromPath = (pathname) => {
        const pathParts = pathname.split('/');
        if (pathParts.length > 2 && pathParts[2]) {
            return pathParts[2];
        }
        return 'overview'; // Default tab
    };

    const activeTab = getActiveTabFromPath(location.pathname);

    // Fetch data from Supabase
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [visitorsResult, listingsResult, metricsResult] = await Promise.all([
                    supabase.from('visitors').select('*'),
                    supabase.from('listings').select('*'),
                    supabase.from('listing_metrics').select('*')
                ]);

                if (!visitorsResult.error) {
                    setVisitors(visitorsResult.data || []);
                    console.log('Fetched visitors:', visitorsResult.data);
                }
                if (!listingsResult.error) {
                    setListings(listingsResult.data || []);
                    console.log('Fetched listings:', listingsResult.data);
                }
                if (!metricsResult.error) {
                    setListingMetrics(metricsResult.data || []);
                    console.log('Fetched listing metrics:', metricsResult.data);
                    // Calculate top 5 inquired-about listings
                    const combinedListings = (listingsResult.data || []).map(listing => {
                        const metrics = (metricsResult.data || []).find(m => m.listing_id === listing.id);
                        return {
                            ...listing,
                            inquiries: metrics ? metrics.inquiries : 0,
                            engaged_users: metrics ? metrics.engaged_users : 0,
                            total_conversions: metrics ? metrics.total_conversions : 0,
                            conversion_rate: metrics ? metrics.conversion_rate : 0
                        };
                    });
                    console.log('Combined listings data:', combinedListings);

                    const sortedListings = combinedListings.sort((a, b) => b.inquiries - a.inquiries);
                    setTopInquiredListings(sortedListings.slice(0, 5));
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        fetchData();
    }, []);

    const handleTabClick = (tabId) => {
        navigate(`/dashboard/${tabId}`);
    };

    const handleViewHotLeads = () => {
        navigate('/dashboard/lead-performance');
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
            <DashboardHeader />

            <div className="flex-grow max-w-7xl mx-auto px-8 md:px-12 py-8">
                <NavigationTabs activeTab={activeTab} onTabClick={handleTabClick} />

                <Routes>
                    <Route index element={<OverviewTab onViewHotLeads={handleViewHotLeads} topInquiredListings={topInquiredListings} />} />
                    <Route path="overview" element={<OverviewTab onViewHotLeads={handleViewHotLeads} topInquiredListings={topInquiredListings} />} />
                    <Route path="lead-performance" element={<LeadPerformanceTab visitors={visitors} listings={listings} listingMetrics={listingMetrics} />} />
                    <Route path="chatbot-analytics" element={<ChatbotAnalyticsTab />} />
                    <Route path="listing-performance" element={<ListingPerformanceTab listings={listings} listingMetrics={listingMetrics} />} />
                    <Route path="listing/:id" element={<ListingDetailsPage />} />
                    <Route path="user-insights" element={<UserInsightsTab visitors={visitors} />} />
                    <Route path="*" element={
                        <div className="text-center py-12">
                            <h3 className="text-lg font-medium text-gray-600">
                                This tab is under development
                            </h3>
                            <p className="text-sm text-gray-500 mt-2">
                                The {activeTab} functionality will be implemented soon.
                            </p>
                        </div>
                    } />
                </Routes>
                <Outlet /> {/* This is needed if there are further nested routes, but not for direct tab content */}
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