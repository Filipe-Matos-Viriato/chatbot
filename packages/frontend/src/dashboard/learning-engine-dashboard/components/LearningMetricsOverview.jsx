// packages/frontend/src/dashboard/learning-engine-dashboard/components/LearningMetricsOverview.jsx
// Component displaying real-time learning engine metrics with trend analysis and health indicators
// Provides comprehensive overview of learning performance, system health, and key KPIs
// LearningEngineDashboard.jsx, AlertPanel.jsx, apiClient.js
import React, { useState, useEffect } from 'react';

const LearningMetricsOverview = ({ metrics, realtimeData, onRefresh }) => {
  console.log('[LearningMetricsOverview] Component rendered with:', { metrics, realtimeData });

  const [trends, setTrends] = useState({});

  useEffect(() => {
    console.log('[LearningMetricsOverview] useEffect triggered, calculating trends...');
    if (metrics && realtimeData) {
      calculateTrends();
    } else {
      console.log('[LearningMetricsOverview] Missing metrics or realtimeData, skipping trend calculation');
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

  const MetricCard = ({ title, value, unit, trend, description, status, tooltip }) => {
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
      <div className="bg-white rounded-lg shadow p-6 relative group">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-500 flex items-center">
            {title}
            {tooltip && (
              <div className="ml-2 relative">
                <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg min-w-max max-w-sm break-words">
                  {tooltip}
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
              </div>
            )}
          </h3>
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
    console.log('[LearningMetricsOverview] No metrics available, rendering loading state');
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading metrics...</p>
      </div>
    );
  }

  console.log('[LearningMetricsOverview] Rendering with metrics:', metrics);

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
          tooltip="Measures the quality and validity of learning signals processed by the engine.<br />Higher values indicate more reliable data for training policies."
        />

        <MetricCard
          title="Learning Speed"
          value={metrics.learningSpeed}
          unit="policies/day"
          trend={trends.learningSpeed}
          description="New policies learned per day"
          status={metrics.learningSpeed >= 10 ? 'good' : metrics.learningSpeed >= 5 ? 'warning' : 'error'}
          tooltip="Rate at which new policies are being learned and added to the system.<br />Higher values indicate faster adaptation to new patterns."
        />

        <MetricCard
          title="Policy Confidence"
          value={metrics.policyConfidence * 100}
          unit="%"
          trend={trends.policyConfidence}
          description="Average confidence in learned policies"
          status={getStatusForMetric('policyConfidence', metrics.policyConfidence)}
          tooltip="Statistical confidence level in the learned policies.<br />Higher confidence means more reliable model selection decisions."
        />

        <MetricCard
          title="Exploration Rate"
          value={metrics.explorationRate * 100}
          unit="%"
          trend={trends.explorationRate}
          description="Balance between exploration and exploitation"
          status={getStatusForMetric('explorationRate', metrics.explorationRate)}
          tooltip="Percentage of decisions that explore new models vs exploiting known good ones.<br />Balances discovery with optimization."
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
          tooltip="Percentage improvement in model selection accuracy compared to baseline.<br />Measures how much better the learning system performs over time."
        />

        <MetricCard
          title="Retraining Frequency"
          value={metrics.retrainingFrequency}
          unit="/day"
          trend={trends.retrainingFrequency}
          description="Policy retraining events per day"
          status={metrics.retrainingFrequency <= 1 ? 'good' : metrics.retrainingFrequency <= 2 ? 'warning' : 'error'}
          tooltip="How often the system triggers comprehensive retraining of policies.<br />Lower frequency indicates stable learning, higher frequency may indicate concept drift."
        />

        <MetricCard
          title="Active Policies"
          value={metrics.activePolicies}
          trend={trends.activePolicies}
          description="Number of active learning policies"
          status={metrics.activePolicies >= 5 ? 'good' : 'warning'}
          tooltip="Total number of learned policies currently active in the system.<br />More policies indicate better coverage of different query complexity levels."
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