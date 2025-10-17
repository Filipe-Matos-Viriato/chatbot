// packages/frontend/src/dashboard/learning-engine-dashboard/LearningEngineDashboard.jsx
// Main dashboard component for RealTimeLearningEngine monitoring and management
// Provides comprehensive admin interface for learning metrics, policy visualization, and system controls
// LearningMetricsOverview.jsx, PolicyVisualization.jsx, ExplorationAnalytics.jsx, ManualControls.jsx
import React, { useState, useEffect } from 'react';
import ClientSelector from '../llm-analytics-dashboard/components/ClientSelector';
import { apiClient } from '../../config/apiClient';
import LearningMetricsOverview from './components/LearningMetricsOverview';
import PolicyVisualization from './components/PolicyVisualization';
import ExplorationAnalytics from './components/ExplorationAnalytics';
import ManualControls from './components/ManualControls';
import AlertPanel from './components/AlertPanel';

const LearningEngineDashboard = () => {
  const [selectedClient, setSelectedClient] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [realtimeData, setRealtimeData] = useState(null);

  // Fetch initial data when client is selected
  useEffect(() => {
    if (selectedClient) {
      fetchDashboardData();
      setupRealtimeUpdates();
    }
  }, [selectedClient]);

  const fetchDashboardData = async () => {
    if (!selectedClient) return;

    try {
      setLoading(true);
      const [metricsResponse, policiesResponse] = await Promise.all([
        apiClient.get(`/api/admin/learning/metrics/${selectedClient.client_id}`),
        apiClient.get(`/api/admin/learning/policies/${selectedClient.client_id}`)
      ]);

      setMetrics(metricsResponse.data);
      setPolicies(policiesResponse.data.policies || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const setupRealtimeUpdates = () => {
    if (!selectedClient) return;

    // Set up Server-Sent Events for real-time updates
    const eventSource = new EventSource(`/api/analytics/stream/learning/${selectedClient.client_id}`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setRealtimeData(data);
        // Update metrics with real-time data
        if (data.metrics) {
          setMetrics(prev => ({ ...prev, ...data.metrics }));
        }
      } catch (err) {
        console.error('Failed to parse real-time data:', err);
      }
    };

    eventSource.onerror = (err) => {
      console.error('Real-time connection error:', err);
    };

    return () => eventSource.close();
  };

  const handleRetraining = async () => {
    if (!selectedClient) return;

    try {
      await apiClient.post(`/api/admin/learning/retrain/${selectedClient.client_id}`);
      // Refresh data after retraining
      await fetchDashboardData();
    } catch (err) {
      console.error('Retraining failed:', err);
      setError('Retraining failed');
    }
  };

  const handleClientChange = (client) => {
    setSelectedClient(client);
    setMetrics(null);
    setPolicies([]);
    setRealtimeData(null);
    setError(null);
  };

  const tabs = [
    { id: 'overview', label: 'Overview', component: LearningMetricsOverview },
    { id: 'policies', label: 'Policies', component: PolicyVisualization },
    { id: 'exploration', label: 'Exploration', component: ExplorationAnalytics },
    { id: 'controls', label: 'Controls', component: ManualControls }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading learning dashboard...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800">Dashboard Error</h3>
            <div className="mt-2 text-sm text-red-700">{error}</div>
            <div className="mt-4">
              <button
                onClick={fetchDashboardData}
                className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded-md text-sm font-medium"
              >
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Learning Engine Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Monitor and manage the RealTimeLearningEngine for intelligent model selection optimization
        </p>
      </div>

      {/* Client Selector */}
      <div className="mb-6">
        <ClientSelector
          selectedClient={selectedClient}
          onClientChange={handleClientChange}
        />
      </div>

      {selectedClient && (
        <>
              {/* Navigation Tabs */}
              <div className="mb-6">
                <nav className="flex space-x-8" aria-label="Tabs">
                  {tabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`py-2 px-1 border-b-2 font-medium text-sm ${
                        activeTab === tab.id
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>
              </div>
    
              {/* Tab Content */}
              <div className="bg-white shadow rounded-lg">
                {ActiveComponent && (
                  <ActiveComponent
                    metrics={metrics}
                    policies={policies}
                    realtimeData={realtimeData}
                    onRefresh={fetchDashboardData}
                    onRetraining={handleRetraining}
                  />
                )}
              </div>
    
              {/* Footer Info */}
              <div className="mt-8 text-center text-sm text-gray-500">
                <p>RealTimeLearningEngine v1.0 - Continuous learning for optimal model selection</p>
                <p className="mt-1">
                  Last updated: {metrics?.lastRetraining ? new Date(metrics.lastRetraining).toLocaleString() : 'Never'}
                </p>
              </div>
            </>
          )}
    
          {/* Empty State */}
          {!selectedClient && (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900">No client selected</h3>
              <p className="mt-1 text-sm text-gray-500">
                Select a client from the dropdown above to view their learning engine analytics.
              </p>
            </div>
          )}
        </div>
      );
};

export default LearningEngineDashboard;