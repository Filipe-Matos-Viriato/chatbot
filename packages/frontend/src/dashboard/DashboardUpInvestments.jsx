// File location: packages/frontend/src/dashboard/DashboardUpInvestments.jsx
// Description: This file implements a client-specific dashboard for Up Investments, hardcoded to a specific client ID.
// Why this file exists: To provide a tailored dashboard experience for the "Up Investments" client, hiding irrelevant information and potentially adding new client-specific metrics.
// Relevant files: packages/frontend/src/dashboard/Dashboard.jsx, packages/frontend/src/main.jsx, packages/frontend/src/context/ClientContext.jsx, packages/frontend/src/dashboard/DashboardHeader.jsx

import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { Routes, Route, useLocation, useNavigate, Outlet } from 'react-router-dom';
// import { useClient } from '../context/ClientContext'; // Not needed as client ID is hardcoded
import OverviewTab from './overview-tab/OverviewTab';
import LeadPerformanceTab from './lead-performance-tab/LeadPerformanceTab';
import VisitantesTable from './VisitantesTable'; // Import the new VisitantesTable component
import NavigationTabs from './NavigationTabs';
// import ChatbotAnalyticsTab from './chatbot-analytics-tab/ChatbotAnalyticsTab'; // Hidden
// import UserInsightsTab from './user-insights-tab/UserInsightsTab'; // Hidden
import DashboardHeader from './DashboardHeader';
import ListingPerformanceTab from './listing-performance-tab/ListingPerformanceTab';
import ListingDetailsPage from './listing-performance-tab/components/ListingDetailsPage'; // Keep original for reference if needed
import ListingDetailsPageUpInvestments from './listing-performance-tab/components/ListingDetailsPageUpInvestments';
import CompleteChatHistoryPage from './listing-performance-tab/components/listing-details/CompleteChatHistoryPage';

// Main Dashboard Component for Up Investments
const DashboardUpInvestments = () => {
    const location = useLocation();
    const navigate = useNavigate();
    // Hardcode the client ID for Up Investments
    const selectedClientId = "e6f484a3-c3cb-4e01-b8ce-a276f4b7355c"; 
    const [visitors, setVisitors] = useState([]);
    const [listings, setListings] = useState([]);
    const [listingMetrics, setListingMetrics] = useState([]);
    const [topInquiredListings, setTopInquiredListings] = useState([]);

    // Determine active tab based on URL
    // Determine active tab based on URL
    const getActiveTabFromPath = (pathname) => {
        // Example: /dashboard-up-investments/visao-geral -> visao-geral
        // Example: /dashboard-up-investments/ -> visao-geral (default)
        const pathSegments = pathname.split('/').filter(Boolean); // Filter out empty strings
        const baseRouteIndex = pathSegments.indexOf('dashboard-up-investments');
        
        if (baseRouteIndex !== -1 && pathSegments.length > baseRouteIndex + 1) {
            return pathSegments[baseRouteIndex + 1];
        }
        return 'visao-geral'; // Default tab in Portuguese
    };

    const activeTab = getActiveTabFromPath(location.pathname);

    // Debugging console logs
    useEffect(() => {
        console.log('DashboardUpInvestments - location.pathname:', location.pathname);
        console.log('DashboardUpInvestments - activeTab:', activeTab);
    }, [location.pathname, activeTab]);

    // Fetch data from Supabase
    useEffect(() => {
        const fetchData = async () => {
            if (!selectedClientId) return; // Should not happen with hardcoded ID, but good practice
            console.log('Fetching data for client ID:', selectedClientId, 'Type:', typeof selectedClientId);

            try {
                // Fetch visitors
                const { data: visitorsData, error: visitorsError } = await supabase
                    .from('visitors')
                    .select('*, chat_messages(count)') // Select all visitor fields and count of related chat_messages
                    .eq('client_id', selectedClientId);
                if (visitorsError) {
                    console.error('Error fetching visitors:', visitorsError);
                } else {
                    setVisitors(visitorsData || []);
                    // console.log('Fetched visitors:', visitorsData); // Reduced verbosity
                }

                // Fetch listings
                const { data: listingsData, error: listingsError } = await supabase
                    .from('listings')
                    .select('*')
                    .eq('client_id', selectedClientId);
                if (listingsError) {
                    console.error('Error fetching listings:', listingsError);
                } else {
                    setListings(listingsData || []);
                    // console.log('Fetched listings:', listingsData); // Reduced verbosity
                }

                // Fetch listing metrics
                const { data: metricsData, error: metricsError } = await supabase
                    .from('listing_metrics')
                    .select('*')
                    .eq('client_id', selectedClientId);
                if (metricsError) {
                    console.error('Error fetching listing metrics:', metricsError);
                } else {
                    setListingMetrics(metricsData || []);
                    // console.log('Fetched listing metrics:', metricsData); // Reduced verbosity

                    // Calculate top 5 inquired-about listings
                    const combinedListings = (listingsData || []).map(listing => {
                        const metrics = (metricsData || []).find(m => m.listing_id === listing.id);
                        return {
                            ...listing,
                            inquiries: metrics ? metrics.inquiries : 0,
                            engaged_users: metrics ? metrics.engaged_users : 0,
                            total_conversions: metrics ? metrics.total_conversions : 0,
                            conversion_rate: metrics ? metrics.conversion_rate : 0
                        };
                    });
                    // console.log('Combined listings data:', combinedListings); // Reduced verbosity

                    const sortedListings = combinedListings.sort((a, b) => b.inquiries - a.inquiries);
                    setTopInquiredListings(sortedListings.slice(0, 5));
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        fetchData();
    }, [selectedClientId]);

    const handleTabClick = (tabId) => {
        navigate(`/dashboard-up-investments/${tabId}`);
    };

    const handleViewHotLeads = () => {
        navigate('/dashboard-up-investments/leads'); // Navigate to the new 'Leads' tab
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
            {/* Update DashboardHeader to display "Dashboard Up Investments" and hide client select */}
            <DashboardHeader title="Dashboard Up Investments" hideClientSelect={true} />

            <div className="flex-grow max-w-7xl mx-auto px-8 md:px-12 py-8">
                {/* Custom NavigationTabs for Up Investments */}
                <NavigationTabs 
                    activeTab={activeTab} 
                    onTabClick={handleTabClick} 
                    tabs={[
                        { id: 'visao-geral', label: 'Visão Geral' }, // Overview
                        { id: 'leads', label: 'Leads' }, // New Leads tab
                        { id: 'desempenho-listagens', label: 'Desempenho das Listagens' }, // Listing Performance
                        // Hidden: Chatbot Analytics, User Insights
                    ]}
                />

                <Routes>
                    {/* The index route matches the parent route's path (/dashboard-up-investments/) */}
                    <Route index element={<OverviewTab onViewHotLeads={handleViewHotLeads} topInquiredListings={topInquiredListings} hiddenMetrics={['chatbot-resolution-rate', 'property-viewings-booked', 'avg-chat-duration']} />} />
                    <Route path="visao-geral" element={<OverviewTab onViewHotLeads={handleViewHotLeads} topInquiredListings={topInquiredListings} hiddenMetrics={['chatbot-resolution-rate', 'property-viewings-booked', 'avg-chat-duration']} />} />
                    <Route path="leads" element={<VisitantesTable visitors={visitors} />} /> {/* Using the new VisitantesTable for "Leads" */}
                    <Route path="desempenho-listagens" element={<ListingPerformanceTab listings={listings} listingMetrics={listingMetrics} hideConversionMetrics={true} />} />
                    <Route path="listagem/:id" element={<ListingDetailsPageUpInvestments />} />
                    <Route path="chat-history/:visitorId" element={<CompleteChatHistoryPage />} />
                    {/* Hidden routes: Chatbot Analytics, User Insights */}
                    {/* The fallback route should only be hit if none of the above match */}
                    <Route path="*" element={
                        <div className="text-center py-12">
                            <h3 className="text-lg font-medium text-gray-600">
                                Esta aba está em desenvolvimento
                            </h3>
                            <p className="text-sm text-gray-500 mt-2">
                                A funcionalidade de {activeTab} será implementada em breve.
                            </p>
                        </div>
                    } />
                </Routes>
                <Outlet />
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

export default DashboardUpInvestments;