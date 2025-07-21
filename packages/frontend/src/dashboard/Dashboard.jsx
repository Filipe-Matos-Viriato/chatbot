import React, { useState, useEffect } from 'react';
import { supabase } from '../config/supabaseClient';

// Metric Card Component
const MetricCard = ({ value, label, className = '' }) => (
    <div className={`bg-white rounded-lg border shadow-sm p-6 text-center ${className}`}>
        <div className="text-4xl font-bold text-gray-900 mb-2">{value}</div>
        <div className="text-sm text-gray-600">{label}</div>
    </div>
);

// Hot Leads Alert Component
const HotLeadsAlert = ({ count, onViewLeads }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
            <div>
                <h3 className="text-lg font-semibold text-red-800">🔥 {count} New Hot Leads Identified!</h3>
                <p className="text-sm text-red-700 mt-1">
                    These leads scored 70+ points and are ready for immediate agent follow-up.
                </p>
            </div>
            <button 
                onClick={onViewLeads}
                className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700 transition-colors"
            >
                View Hot Leads
            </button>
        </div>
    </div>
);

// Chart Placeholder Component
const ChartPlaceholder = ({ title, description, height = "h-40" }) => (
    <div className="bg-white rounded-lg border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className={`${height} bg-gray-100 rounded flex items-center justify-center text-gray-500`}>
            Chart Placeholder
        </div>
        <p className="text-sm text-gray-600 mt-4">{description}</p>
    </div>
);

// Top Listings Component
const TopListings = ({ listings }) => (
    <div className="bg-white rounded-lg border shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Most Inquired-About Listings</h3>
        <ul className="space-y-3">
            {listings.map((listing, index) => (
                <li key={index} className="flex justify-between items-center text-gray-700">
                    <span>{index + 1}. {listing.name}</span>
                    <span className="font-medium">{listing.inquiries} inquiries</span>
                </li>
            ))}
        </ul>
    </div>
);

// Navigation Tabs Component
const NavigationTabs = ({ activeTab, onTabClick }) => {
    const tabs = [
        { id: 'overview', label: 'Overview' },
        { id: 'lead-performance', label: 'Lead Performance' },
        { id: 'chatbot-analytics', label: 'Chatbot Analytics' },
        { id: 'listing-performance', label: 'Listing Performance' },
        { id: 'user-insights', label: 'User Insights' }
    ];

    return (
        <div className="flex space-x-1 bg-gray-100 p-1 rounded-lg mb-6">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    className={`px-4 py-2 rounded text-sm font-medium transition-colors ${
                        activeTab === tab.id 
                            ? 'bg-white text-gray-900 shadow' 
                            : 'text-gray-600 hover:text-gray-800'
                    }`}
                    onClick={() => onTabClick(tab.id)}
                >
                    {tab.label}
                </button>
            ))}
        </div>
    );
};

// Dashboard Header Component
const DashboardHeader = () => (
    <header className="bg-white shadow-sm py-4 px-6 md:px-8">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-2xl font-bold text-gray-800">Real Estate Chatbot Dashboard</h1>
            <div className="flex items-center space-x-4">
                <span className="text-gray-600 text-sm">Welcome, Client Name</span>
                <div className="w-8 h-8 bg-blue-200 rounded-full flex items-center justify-center text-blue-800 font-semibold">
                    CN
                </div>
            </div>
        </div>
    </header>
);

// Overview Tab Component
const OverviewTab = ({ onViewHotLeads }) => {
    const metrics = [
        { value: '6', label: 'Total Leads Generated' },
        { value: '78%', label: 'Chatbot Resolution Rate' },
        { value: '3', label: 'New Hot Leads (70+ Pts)' },
        { value: '5.2 min', label: 'Avg. Chat Duration' },
        { value: '18', label: 'Property Viewings Booked' },
        { value: '3', label: 'Unanswered Questions' }
    ];

    const topListings = [
        { name: 'Luxury Villa, Cascais', inquiries: 85 },
        { name: 'Downtown Apartment, Lisbon', inquiries: 72 },
        { name: 'Family Home, Porto', inquiries: 60 },
        { name: 'Commercial Space, Faro', inquiries: 45 },
        { name: 'Beachfront Condo, Algarve', inquiries: 38 }
    ];

    return (
        <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-800">Dashboard Overview</h2>

            <HotLeadsAlert count={3} onViewLeads={onViewHotLeads} />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {metrics.map((metric, index) => (
                    <MetricCard
                        key={index}
                        value={metric.value}
                        label={metric.label}
                    />
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ChartPlaceholder
                    title="Lead Score Distribution"
                    description="Shows the percentage of leads in Hot, Warm, and Cold categories."
                />
                <TopListings listings={topListings} />
            </div>
        </div>
    );
};

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