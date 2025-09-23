// packages/frontend/src/dashboard/Dashboard.jsx
// Defines the main dashboard component that orchestrates all dashboard tabs and data fetching from Supabase.
// This file exists to provide the central hub for client dashboard functionality, managing state and routing.
// packages/frontend/src/main.jsx, packages/frontend/src/App.jsx, packages/frontend/src/context/ClientContext.jsx, packages/frontend/src/config/supabaseClient.js

import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';
import { Routes, Route, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useClient } from '../context/ClientContext'; // Import useClient
import OverviewTab from './overview-tab/OverviewTab';
import LeadPerformanceTab from './lead-performance-tab/LeadPerformanceTab';
import NavigationTabs from './NavigationTabs';
import ChatbotAnalyticsTab from './chatbot-analytics-tab/ChatbotAnalyticsTab';
import UserInsightsTab from './user-insights-tab/UserInsightsTab';
import DashboardHeader from './DashboardHeader';
import ListingPerformanceTab from './listing-performance-tab/ListingPerformanceTab';
import ListingDetailsPage from './listing-performance-tab/components/ListingDetailsPage';
import CompleteChatHistoryPage from './listing-performance-tab/components/listing-details/CompleteChatHistoryPage';
import UnansweredQuestionsPage from './unanswered-questions-tab/UnansweredQuestionsPage';
import Layout from './components/Layout';

// Main Dashboard Component
const Dashboard = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { selectedClientId } = useClient(); // Get selectedClientId from context
    const [visitors, setVisitors] = useState([]);
    const [listings, setListings] = useState([]);
    const [listingMetrics, setListingMetrics] = useState([]);
    const [clusteredQuestions, setClusteredQuestions] = useState([]);
    const [topInquiredListings, setTopInquiredListings] = useState([]);
    const [clientConfig, setClientConfig] = useState(null);
    const [customCriteria, setCustomCriteria] = useState(() => {
        // Try to load from localStorage first
        const saved = localStorage.getItem('customLeadCriteria');
        return saved ? JSON.parse(saved) : {
            minimalLeadScore: 40,
            selectedConversionActions: []
        };
    });

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
            if (!selectedClientId) return; // Don't fetch if no client is selected
            console.log('Fetching data for client ID:', selectedClientId, 'Type:', typeof selectedClientId); // Add this line

            try {
                // Fetch visitors
                const { data: visitorsData, error: visitorsError } = await supabase
                    .from('visitors')
                    .select('*, previous_lead_score')
                    .eq('client_id', selectedClientId);
                if (visitorsError) {
                    console.error('Error fetching visitors:', visitorsError);
                } else {
                    // Fetch events for these visitors
                    const visitorIds = visitorsData.map(v => v.visitor_id);
                    if (visitorIds.length > 0) {
                        const { data: eventsData, error: eventsError } = await supabase
                            .from('events')
                            .select('visitor_id, event_type, timestamp, score_impact')
                            .in('visitor_id', visitorIds)
                            .order('timestamp', { ascending: false });

                        if (eventsError) {
                            console.error('Error fetching events:', eventsError);
                        } else {
                            // Group events by visitor_id
                            const eventsByVisitor = eventsData.reduce((acc, event) => {
                                if (!acc[event.visitor_id]) {
                                    acc[event.visitor_id] = [];
                                }
                                acc[event.visitor_id].push(event);
                                return acc;
                            }, {});

                            // Combine visitors with their events
                            const visitorsWithEvents = visitorsData.map(visitor => ({
                                ...visitor,
                                events: eventsByVisitor[visitor.visitor_id] || []
                            }));

                            // Fetch score history for each visitor
                            const visitorsWithScoreHistory = await Promise.all(
                                visitorsWithEvents.map(async (visitor) => {
                                    try {
                                        // Use the correct API base URL for backend calls
                                        const apiBaseUrl = import.meta.env.DEV ? 'http://localhost:3007' : `${window.location.origin}/api`;
                                        const response = await fetch(`${apiBaseUrl}/v1/visitors/${visitor.visitor_id}/score-history?maxPoints=15`, {
                                            headers: {
                                                'x-client-id': selectedClientId,
                                                'Content-Type': 'application/json'
                                            }
                                        });
                                        if (response.ok) {
                                            const { scoreHistory } = await response.json();
                                            return { ...visitor, scoreHistory };
                                        }
                                        return visitor;
                                    } catch (error) {
                                        console.error(`Error fetching score history for visitor ${visitor.visitor_id}:`, error);
                                        return visitor;
                                    }
                                })
                            );

                            setVisitors(visitorsWithScoreHistory);
                            console.log('Fetched visitors with events and score history:', visitorsWithScoreHistory);
                        }
                    } else {
                        setVisitors(visitorsData || []);
                        console.log('Fetched visitors:', visitorsData);
                    }
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
                    console.log('Fetched listings:', listingsData);
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
                    console.log('Fetched listing metrics:', metricsData);

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
                    console.log('Combined listings data:', combinedListings);

                    const sortedListings = combinedListings.sort((a, b) => b.inquiries - a.inquiries);
                    setTopInquiredListings(sortedListings.slice(0, 5));
                }

                // Fetch clustered questions
                const { data: clusteredData, error: clusteredError } = await supabase
                    .from('clustered_questions')
                    .select('*')
                    .eq('client_id', selectedClientId);
                if (clusteredError) {
                    console.error('Error fetching clustered questions:', clusteredError);
                } else {
                    setClusteredQuestions(clusteredData || []);
                    console.log('Fetched clustered questions:', clusteredData);
                }

                // Fetch client config
                const { data: configData, error: configError } = await supabase
                    .from('clients')
                    .select('lead_scoring_rules')
                    .eq('client_id', selectedClientId)
                    .single();
                if (configError) {
                    console.error('Error fetching client config:', configError);
                } else {
                    setClientConfig(configData?.lead_scoring_rules || null);
                    console.log('Fetched client config:', configData);
                }
            } catch (error) {
                console.error('Error fetching dashboard data:', error);
            }
        };

        fetchData();
    }, [selectedClientId]);

    // Save custom criteria to localStorage whenever it changes
    useEffect(() => {
        localStorage.setItem('customLeadCriteria', JSON.stringify(customCriteria));
    }, [customCriteria]);

    const handleTabClick = (tabId) => {
        navigate(`/dashboard/${tabId}`);
    };

    const handleViewHotLeads = (filter = 'all') => {
        navigate(`/dashboard/lead-performance?filter=${filter}`);
    };

    const handleOpenChatHistory = (visitorId) => {
        // Navigate to complete chat history page for the visitor
        navigate(`/dashboard/chat-history/${visitorId}`);
    };

    return (
        <div className="min-h-screen flex flex-col bg-gray-50 font-sans text-gray-900">
            <DashboardHeader />

            <div className="w-full max-w-dashboard mx-auto px-6 py-container-padding grid grid-cols-1">
                <div className="w-full">
                    <NavigationTabs activeTab={activeTab} onTabClick={handleTabClick} />
                </div>

                <main className="w-full mt-8">
                    <Routes>
                        <Route index element={<OverviewTab onViewHotLeads={handleViewHotLeads} topInquiredListings={topInquiredListings} />} />
                        <Route path="overview" element={<OverviewTab onViewHotLeads={handleViewHotLeads} topInquiredListings={topInquiredListings} />} />
                        <Route path="lead-performance" element={<LeadPerformanceTab visitors={visitors} listings={listings} listingMetrics={listingMetrics} clientConfig={clientConfig} onOpenChatHistory={handleOpenChatHistory} customCriteria={customCriteria} setCustomCriteria={setCustomCriteria} />} />
                        <Route path="chatbot-analytics" element={<ChatbotAnalyticsTab />} />
                        <Route path="listing-performance" element={<ListingPerformanceTab listings={listings} listingMetrics={listingMetrics} clusteredQuestions={clusteredQuestions} />} />
                        <Route path="listing/:id" element={<ListingDetailsPage />} />
                        <Route path="chat-history/:visitorId" element={<CompleteChatHistoryPage />} />
                        <Route path="unanswered-questions" element={<UnansweredQuestionsPage />} />
                        <Route path="user-insights" element={<UserInsightsTab visitors={visitors} onOpenChatHistory={handleOpenChatHistory} />} />
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
                </main>
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