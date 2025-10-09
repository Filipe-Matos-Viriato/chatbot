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
                        <Route index element={<OverviewTab clientId={selectedClientId} onViewHotLeads={handleViewHotLeads} />} />
                        <Route path="overview" element={<OverviewTab clientId={selectedClientId} onViewHotLeads={handleViewHotLeads} />} />
                        <Route path="lead-performance" element={<LeadPerformanceTab clientId={selectedClientId} onOpenChatHistory={handleOpenChatHistory} />} />
                        <Route path="chatbot-analytics" element={<ChatbotAnalyticsTab clientId={selectedClientId} />} />
                        <Route path="listing-performance" element={<ListingPerformanceTab clientId={selectedClientId} />} />
                        <Route path="listing/:id" element={<ListingDetailsPage clientId={selectedClientId} />} />
                        <Route path="chat-history/:visitorId" element={<CompleteChatHistoryPage />} />
                        <Route path="unanswered-questions" element={<UnansweredQuestionsPage clientId={selectedClientId} />} />
                        <Route path="user-insights" element={<UserInsightsTab clientId={selectedClientId} onOpenChatHistory={handleOpenChatHistory} />} />
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