import React, { useState, useEffect } from 'react';
import ClientSelector from './components/ClientSelector';
import MetricsOverview from './components/MetricsOverview';
import ModelUsageChart from './components/ModelUsageChart';
import PerformanceTrends from './components/PerformanceTrends';
import RealTimeMetrics from './components/RealTimeMetrics';
// Phase 2: Advanced Analytics Components
import ModelPerformanceComparison from './components/ModelPerformanceComparison';
import CostAnalysisChart from './components/CostAnalysisChart';
import ResponseQualityTrends from './components/ResponseQualityTrends';
import UsagePatternsVisualization from './components/UsagePatternsVisualization';
import ClientInsightsPanel from './components/ClientInsightsPanel';
import { apiClient } from '../../config/apiClient';

const LLMAnalyticsDashboard = () => {
  const [selectedClient, setSelectedClient] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [realTimeData, setRealTimeData] = useState(null);

  // Load analytics data when client is selected
  useEffect(() => {
    if (selectedClient) {
      loadAnalyticsData(selectedClient.client_id);
      setupRealTimeUpdates(selectedClient.client_id);
    }
  }, [selectedClient]);

  const loadAnalyticsData = async (clientId) => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiClient.get(`/api/analytics/dashboard/${clientId}`);
      setAnalyticsData(response.data);
    } catch (err) {
      console.error('Error loading analytics data:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const setupRealTimeUpdates = (clientId) => {
    // Clean up previous connection
    if (window.analyticsEventSource) {
      window.analyticsEventSource.close();
    }

    try {
      const eventSource = new EventSource(`${apiClient.defaults.baseURL}/api/analytics/stream/${clientId}`);

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          setRealTimeData(data);
        } catch (err) {
          console.error('Error parsing real-time data:', err);
        }
      };

      eventSource.onerror = (err) => {
        console.error('Real-time updates error:', err);
        eventSource.close();
      };

      window.analyticsEventSource = eventSource;
    } catch (err) {
      console.error('Failed to setup real-time updates:', err);
    }
  };

  const handleClientChange = (client) => {
    setSelectedClient(client);
    setAnalyticsData(null);
    setRealTimeData(null);
    setError(null);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (window.analyticsEventSource) {
        window.analyticsEventSource.close();
      }
    };
  }, []);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">LLM Analytics Dashboard</h1>
        <p className="text-gray-600">
          Monitor and analyze your Large Language Model performance, costs, and usage patterns.
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
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2 text-gray-600">Loading analytics data...</span>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* Analytics Content */}
          {analyticsData && !loading && (
            <div className="space-y-6">
              {/* Real-time Metrics */}
              <RealTimeMetrics
                realTimeData={realTimeData}
                historicalData={analyticsData.realTime}
              />

              {/* Metrics Overview */}
              <MetricsOverview
                data={analyticsData.historical}
                realTimeData={realTimeData}
              />

              {/* Phase 2: Advanced Analytics Dashboard */}
              <div className="space-y-6">
                {/* Advanced Model Performance Comparison */}
                <ModelPerformanceComparison data={analyticsData.modelPerformance} />

                {/* Cost Analysis & Efficiency */}
                <CostAnalysisChart data={analyticsData.costAnalysis} />

                {/* Response Quality Trends */}
                <ResponseQualityTrends data={analyticsData} />

                {/* Usage Patterns Visualization */}
                <UsagePatternsVisualization data={analyticsData} />

                {/* Client Insights Panel */}
                <ClientInsightsPanel data={analyticsData} />
              </div>

              {/* Legacy Charts Row (kept for compatibility) */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8 pt-8 border-t border-gray-200">
                <div className="text-center text-gray-500">
                  <h4 className="text-sm font-medium">Legacy Model Usage Chart</h4>
                  <p className="text-xs mt-1">See advanced analytics above</p>
                </div>
                <div className="text-center text-gray-500">
                  <h4 className="text-sm font-medium">Legacy Performance Trends</h4>
                  <p className="text-xs mt-1">See advanced analytics above</p>
                </div>
              </div>

              {/* Additional Analytics Sections */}
              <div className="grid grid-cols-1 gap-6">
                {/* Cost Analysis */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Analysis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center">
                      <p className="text-2xl font-bold text-green-600">
                        €{analyticsData.historical?.totalCost?.toFixed(2) || '0.00'}
                      </p>
                      <p className="text-sm text-gray-600">Total Cost</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600">
                        €{analyticsData.historical?.performanceMetrics?.costPerRequest?.toFixed(4) || '0.0000'}
                      </p>
                      <p className="text-sm text-gray-600">Cost per Request</p>
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-bold text-purple-600">
                        {analyticsData.historical?.performanceMetrics?.successRate ?
                          Math.round(analyticsData.historical.performanceMetrics.successRate * 100) : 0}%
                      </p>
                      <p className="text-sm text-gray-600">Success Rate</p>
                    </div>
                  </div>
                </div>

                {/* Model Performance Details */}
                <div className="bg-white rounded-lg shadow p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Model Performance Details</h3>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Model
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Usage Count
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Total Cost
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Avg Response Time
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {Object.entries(analyticsData.historical?.modelUsage || {}).map(([model, count]) => (
                          <tr key={model}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {model}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {count}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              €{analyticsData.historical?.costBreakdown?.[model]?.toFixed(2) || '0.00'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {analyticsData.historical?.avgResponseTime ?
                                `${Math.round(analyticsData.historical.avgResponseTime)}ms` : 'N/A'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
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
            Select a client from the dropdown above to view their LLM analytics.
          </p>
        </div>
      )}
    </div>
  );
};

export default LLMAnalyticsDashboard;