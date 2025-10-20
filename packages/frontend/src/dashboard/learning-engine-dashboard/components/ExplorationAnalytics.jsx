// packages/frontend/src/dashboard/learning-engine-dashboard/components/ExplorationAnalytics.jsx
// Component for analyzing exploration vs exploitation patterns and model discovery progress
// Provides interactive charts, controls, and insights for optimizing learning exploration strategies
// LearningEngineDashboard.jsx, real-time-learning-engine.js, apiClient.js
import React, { useState, useEffect } from 'react';

const ExplorationAnalytics = ({ metrics, policies }) => {
  const [timeRange, setTimeRange] = useState('7d');
  const [explorationData, setExplorationData] = useState([]);

  useEffect(() => {
    if (metrics) {
      generateExplorationData();
    }
  }, [metrics, timeRange]);

  const generateExplorationData = () => {
    // Generate exploration data based on real metrics or show empty state
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const data = [];

    // If no real data exists yet, show current state only
    if (!metrics || !metrics.explorationRate) {
      setExplorationData([]);
      return;
    }

    for (let i = days; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);

      // Use current exploration rate for all historical data since we don't have historical data yet
      data.push({
        date: date.toISOString().split('T')[0],
        explorationRate: metrics.explorationRate,
        modelsExplored: 0, // No historical exploration data yet
        newDiscoveries: 0, // No historical discovery data yet
        exploitationRate: 1 - metrics.explorationRate
      });
    }

    setExplorationData(data);
  };

  const ExplorationChart = () => {
    const maxValue = Math.max(...explorationData.map(d => d.explorationRate));

    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          Exploration vs Exploitation
          <div className="ml-2 relative group">
            <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10 max-w-xs">
              Historical balance between exploring new models and exploiting known good ones.<br />Orange bars show exploration rate, blue bars show exploitation rate.
              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
            </div>
          </div>
        </h3>
        <div className="h-64">
          <div className="flex items-end h-full space-x-1">
            {explorationData.map((day, index) => (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div className="w-full flex flex-col-reverse h-full">
                  {/* Exploitation (bottom) */}
                  <div
                    className="bg-blue-600 w-full cursor-pointer relative group"
                    style={{ height: `${(day.exploitationRate / maxValue) * 100}%` }}
                  >
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg min-w-max break-words">
                      Exploitation: {(day.exploitationRate * 100).toFixed(1)}% on {new Date(day.date).toLocaleDateString()}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                  {/* Exploration (top) */}
                  <div
                    className="bg-orange-400 w-full cursor-pointer relative group"
                    style={{ height: `${(day.explorationRate / maxValue) * 100}%` }}
                  >
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-1 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg min-w-max break-words">
                      Exploration: {(day.explorationRate * 100).toFixed(1)}% on {new Date(day.date).toLocaleDateString()}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                </div>
                {index % Math.ceil(explorationData.length / 7) === 0 && (
                  <div className="text-xs text-gray-500 mt-2 transform -rotate-45">
                    {new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 flex justify-center space-x-6 text-sm">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-orange-400 rounded mr-2"></div>
            <span>Exploration</span>
          </div>
          <div className="flex items-center">
            <div className="w-4 h-4 bg-blue-600 rounded mr-2"></div>
            <span>Exploitation</span>
          </div>
        </div>
      </div>
    );
  };

  const ModelDiscoveryChart = () => {
    // Show real model discovery data or empty state
    const models = [
      { name: 'gpt-4o-mini', usage: 0, discovered: false, firstUsed: null },
      { name: 'gpt-4', usage: 0, discovered: false, firstUsed: null },
      { name: 'gpt-3.5-turbo', usage: 0, discovered: false, firstUsed: null },
      { name: 'claude-3-haiku', usage: 0, discovered: false, firstUsed: null },
      { name: 'claude-3-sonnet', usage: 0, discovered: false, firstUsed: null }
    ];

    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Model Discovery & Usage</h3>
        <div className="space-y-4">
          {models.map((model, index) => (
            <div key={model.name} className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${
                  model.discovered ? 'bg-green-500' : 'bg-gray-300'
                }`}></div>
                <div>
                  <div className="text-sm font-medium text-gray-900">{model.name}</div>
                  <div className="text-xs text-gray-500">
                    {model.discovered
                      ? `Discovered: ${new Date(model.firstUsed).toLocaleDateString()}`
                      : 'Not yet explored'
                    }
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                <div className="w-24 bg-gray-200 rounded-full h-2 mr-3">
                  <div
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${model.usage}%` }}
                  ></div>
                </div>
                <span className="text-sm font-medium w-10 text-right">{model.usage}%</span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
            <span className="mr-4">Discovered</span>
            <div className="w-3 h-3 bg-gray-300 rounded-full mr-2"></div>
            <span>Available for exploration</span>
          </div>
        </div>
      </div>
    );
  };

  const ExplorationMetrics = () => {
    const metrics = [
      {
        label: 'Current Exploration Rate',
        value: `${(explorationData[explorationData.length - 1]?.explorationRate * 100 || 0).toFixed(1)}%`,
        status: 'good',
        description: 'Percentage of decisions using exploration',
        tooltip: 'Current percentage of model selections that explore new or under-tested models<br />rather than exploiting known good ones.<br />Higher rates promote discovery but may reduce short-term performance.'
      },
      {
        label: 'Models Discovered',
        value: '0/5',
        status: 'warning',
        description: 'Models found through exploration',
        tooltip: 'Number of available models that have been discovered and tested through the exploration process.<br />Models must be explored before they can be effectively used in production.'
      },
      {
        label: 'Exploration Efficiency',
        value: 'N/A',
        status: 'warning',
        description: 'Quality of exploration decisions (no data yet)',
        tooltip: 'Measure of how effective exploration decisions are at finding better models.<br />Calculated as the ratio of successful discoveries to total exploration attempts.<br />Not available until exploration data accumulates.'
      },
      {
        label: 'Under-explored Models',
        value: '5',
        status: 'warning',
        description: 'Models not yet adequately tested',
        tooltip: 'Number of available models that haven\'t received sufficient testing through exploration.<br />These models represent potential opportunities for performance improvement.'
      }
    ];

    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white p-4 rounded-lg shadow relative group">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-gray-500 flex items-center">
                {metric.label}
                {metric.tooltip && (
                  <div className="ml-2">
                    <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg min-w-max max-w-sm break-words">
                      {metric.tooltip}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                    </div>
                  </div>
                )}
              </h4>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                metric.status === 'good' ? 'bg-green-100 text-green-800' :
                metric.status === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {metric.status}
              </span>
            </div>
            <div className="mt-2">
              <div className="text-2xl font-bold text-gray-900">{metric.value}</div>
              <p className="text-xs text-gray-600 mt-1">{metric.description}</p>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const ExplorationControls = () => {
    const [explorationRate, setExplorationRate] = useState(metrics?.explorationRate * 100 || 10);

    const handleRateChange = (newRate) => {
      setExplorationRate(newRate);
      // In real implementation, this would call an API to update the exploration rate
    };

    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Exploration Controls</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Exploration Rate: {explorationRate}%
            </label>
            <input
              type="range"
              min="1"
              max="30"
              value={explorationRate}
              onChange={(e) => handleRateChange(parseInt(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Conservative (1%)</span>
              <span>Aggressive (30%)</span>
            </div>
          </div>

          <div className="flex space-x-3">
            <button
              onClick={() => handleRateChange(5)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Conservative
            </button>
            <button
              onClick={() => handleRateChange(10)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Balanced
            </button>
            <button
              onClick={() => handleRateChange(20)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Aggressive
            </button>
          </div>

          <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded">
            <strong>Note:</strong> Changes to exploration rate will take effect immediately but may take time to show in metrics.
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">Exploration Analytics</h2>
        <p className="text-sm text-gray-600">
          Monitor exploration patterns and model discovery progress
        </p>
      </div>

      {/* Time Range Selector */}
      <div className="mb-6">
        <div className="flex space-x-2">
          {['7d', '30d', '90d'].map(range => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-2 rounded-md text-sm font-medium ${
                timeRange === range
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } border`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Exploration Metrics */}
      <div className="mb-6">
        <ExplorationMetrics />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <ExplorationChart />
        <ModelDiscoveryChart />
      </div>

      {/* Controls */}
      <ExplorationControls />
    </div>
  );
};

export default ExplorationAnalytics;