// packages/frontend/src/dashboard/learning-engine-dashboard/components/LearningMetricsOverview.jsx
// Component displaying real-time learning engine metrics with trend analysis and health indicators
// Provides comprehensive overview of learning performance, system health, and key KPIs
// LearningEngineDashboard.jsx, AlertPanel.jsx, apiClient.js
import React, { useState, useEffect } from 'react';

const LearningMetricsOverview = ({ metrics, realtimeData, onRefresh }) => {
  const [trends, setTrends] = useState({});

  useEffect(() => {
    if (metrics && realtimeData) {
      calculateTrends();
    }
  }, [metrics, realtimeData]);

  const calculateTrends = () => {
    // Calculate trends compared to previous data
    const newTrends = {};

    if (realtimeData?.previousMetrics) {
      Object.keys(metrics).forEach(key => {
        if (typeof metrics[key] === 'number' && typeof realtimeData.previousMetrics[key] === 'number') {
          const current = metrics[key];
          const previous = realtimeData.previousMetrics[key];
          const change = ((current - previous) / previous) * 100;
          newTrends[key] = {
            value: change,
            direction: change > 0 ? 'up' : change < 0 ? 'down' : 'stable'
          };
        }
      });
    }

    setTrends(newTrends);
  };

  const MetricCard = ({ title, value, unit, trend, description, status }) => {
    const getStatusColor = (status) => {
      switch (status) {
        case 'good': return 'text-green-600 bg-green-50';
        case 'warning': return 'text-yellow-600 bg-yellow-50';
        case 'error': return 'text-red-600 bg-red-50';
        default: return 'text-gray-600 bg-gray-50';
      }
    };

    const getTrendIcon = (direction) => {
      switch (direction) {
        case 'up': return '↗️';
        case 'down': return '↘️';
        default: return '→';
      }
    };

    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500">{title}</h3>
          {status && (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(status)}`}>
              {status}
            </span>
          )}
        </div>
        <div className="mt-2">
          <div className="flex items-baseline">
            <p className="text-2xl font-semibold text-gray-900">
              {typeof value === 'number' ? value.toFixed(2) : value}
              {unit && <span className="text-sm text-gray-500 ml-1">{unit}</span>}
            </p>
            {trend && (
              <span className="ml-2 text-sm text-gray-500">
                {getTrendIcon(trend.direction)} {Math.abs(trend.value).toFixed(1)}%
              </span>
            )}
          </div>
          {description && (
            <p className="mt-1 text-sm text-gray-600">{description}</p>
          )}
        </div>
      </div>
    );
  };

  const getStatusForMetric = (key, value) => {
    const thresholds = {
      signalQuality: { good: 0.9, warning: 0.8 },
      policyConfidence: { good: 0.8, warning: 0.7 },
      explorationRate: { good: 0.15, warning: 0.05 },
      performanceImprovement: { good: 15, warning: 8 }
    };

    if (!thresholds[key]) return null;

    const threshold = thresholds[key];
    if (value >= threshold.good) return 'good';
    if (value >= threshold.warning) return 'warning';
    return 'error';
  };

  if (!metrics) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading metrics...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">Learning Engine Overview</h2>
        <p className="text-sm text-gray-600">
          Real-time performance metrics and learning progress
        </p>
      </div>

      {/* Primary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <MetricCard
          title="Signal Quality"
          value={metrics.signalQuality * 100}
          unit="%"
          trend={trends.signalQuality}
          description="Percentage of valid learning signals"
          status={getStatusForMetric('signalQuality', metrics.signalQuality)}
        />

        <MetricCard
          title="Learning Speed"
          value={metrics.learningSpeed}
          unit="policies/day"
          trend={trends.learningSpeed}
          description="New policies learned per day"
          status={metrics.learningSpeed >= 10 ? 'good' : metrics.learningSpeed >= 5 ? 'warning' : 'error'}
        />

        <MetricCard
          title="Policy Confidence"
          value={metrics.policyConfidence * 100}
          unit="%"
          trend={trends.policyConfidence}
          description="Average confidence in learned policies"
          status={getStatusForMetric('policyConfidence', metrics.policyConfidence)}
        />

        <MetricCard
          title="Exploration Rate"
          value={metrics.explorationRate * 100}
          unit="%"
          trend={trends.explorationRate}
          description="Balance between exploration and exploitation"
          status={getStatusForMetric('explorationRate', metrics.explorationRate)}
        />
      </div>

      {/* Secondary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MetricCard
          title="Performance Improvement"
          value={metrics.performanceImprovement}
          unit="%"
          trend={trends.performanceImprovement}
          description="Improvement in model selection accuracy"
          status={getStatusForMetric('performanceImprovement', metrics.performanceImprovement)}
        />

        <MetricCard
          title="Retraining Frequency"
          value={metrics.retrainingFrequency}
          unit="/day"
          trend={trends.retrainingFrequency}
          description="Policy retraining events per day"
          status={metrics.retrainingFrequency <= 1 ? 'good' : metrics.retrainingFrequency <= 2 ? 'warning' : 'error'}
        />

        <MetricCard
          title="Active Policies"
          value={metrics.activePolicies}
          trend={trends.activePolicies}
          description="Number of active learning policies"
          status={metrics.activePolicies >= 5 ? 'good' : 'warning'}
        />
      </div>

      {/* System Health Indicators */}
      <div className="bg-gray-50 rounded-lg p-6">
        <h3 className="text-md font-medium text-gray-900 mb-4">System Health</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              metrics.lastRetraining && Date.now() - new Date(metrics.lastRetraining).getTime() < 24 * 60 * 60 * 1000
                ? 'bg-green-500'
                : 'bg-yellow-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              Last Retraining: {metrics.lastRetraining ? new Date(metrics.lastRetraining).toLocaleDateString() : 'Never'}
            </span>
          </div>

          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              metrics.totalSignals && metrics.totalSignals > 1000 ? 'bg-green-500' : 'bg-yellow-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              Total Signals: {metrics.totalSignals?.toLocaleString() || 0}
            </span>
          </div>

          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              realtimeData ? 'bg-green-500' : 'bg-gray-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              Real-time Updates: {realtimeData ? 'Active' : 'Inactive'}
            </span>
          </div>

          <div className="flex items-center">
            <div className={`w-3 h-3 rounded-full mr-2 ${
              metrics.signalQuality > 0.9 ? 'bg-green-500' : metrics.signalQuality > 0.8 ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              Data Quality: {metrics.signalQuality > 0.9 ? 'Excellent' : metrics.signalQuality > 0.8 ? 'Good' : 'Poor'}
            </span>
          </div>
        </div>
      </div>

      {/* Refresh Button */}
      <div className="mt-6 flex justify-end">
        <button
          onClick={onRefresh}
          className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          <svg className="-ml-1 mr-2 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>
    </div>
  );
};

export default LearningMetricsOverview;