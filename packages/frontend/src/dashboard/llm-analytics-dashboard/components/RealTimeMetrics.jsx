import React, { useState, useEffect } from 'react';

const RealTimeMetrics = ({ realTimeData, historicalData }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    // Check if we have an active EventSource connection
    const checkConnection = () => {
      setIsConnected(!!window.analyticsEventSource && window.analyticsEventSource.readyState === EventSource.OPEN);
    };

    checkConnection();
    const interval = setInterval(checkConnection, 5000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (realTimeData) {
      setLastUpdate(new Date());
    }
  }, [realTimeData]);

  // Use real-time data if available, otherwise fall back to historical
  const displayData = realTimeData || historicalData;

  if (!displayData) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Real-Time Metrics</h3>
        <div className="flex items-center justify-center h-32 text-gray-500">
          No metrics data available
        </div>
      </div>
    );
  }

  const formatTime = (date) => {
    return date ? date.toLocaleTimeString() : 'Never';
  };

  const getConnectionStatus = () => {
    if (isConnected) {
      return { status: 'Connected', color: 'green', icon: '🟢' };
    } else {
      return { status: 'Disconnected', color: 'red', icon: '🔴' };
    }
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Real-Time Metrics</h3>
        <div className="flex items-center space-x-2">
          <span className={`text-sm ${connectionStatus.color === 'green' ? 'text-green-600' : 'text-red-600'}`}>
            {connectionStatus.icon} {connectionStatus.status}
          </span>
          {lastUpdate && (
            <span className="text-xs text-gray-500">
              Last update: {formatTime(lastUpdate)}
            </span>
          )}
        </div>
      </div>

      {/* Connection Status Alert */}
      {!isConnected && (
        <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
                Real-time updates are currently unavailable. Showing cached data.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Real-time Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl">📊</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-blue-600">Active Requests</p>
              <p className="text-2xl font-bold text-blue-900">
                {displayData.totalRequests || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl">💰</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-green-600">Current Cost</p>
              <p className="text-2xl font-bold text-green-900">
                €{displayData.totalCost?.toFixed(2) || '0.00'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-yellow-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl">⚡</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-yellow-600">Avg Response Time</p>
              <p className="text-2xl font-bold text-yellow-900">
                {displayData.avgResponseTime ? `${Math.round(displayData.avgResponseTime)}ms` : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-purple-50 p-4 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-2xl">🎯</span>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-purple-600">Success Rate</p>
              <p className="text-2xl font-bold text-purple-900">
                {displayData.performanceMetrics?.successRate ?
                  `${Math.round(displayData.performanceMetrics.successRate * 100)}%` :
                  'N/A'
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Hourly Breakdown */}
      {displayData.hourlyStats && displayData.hourlyStats.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Hourly Activity (Last 24h)</h4>
          <div className="grid grid-cols-12 gap-1">
            {Array.from({ length: 24 }, (_, hour) => {
              const hourData = displayData.hourlyStats.find(h => h.hour === hour);
              const intensity = hourData ? Math.min((hourData.requests / 10) * 100, 100) : 0;

              return (
                <div key={hour} className="flex flex-col items-center">
                  <div
                    className="w-full bg-blue-200 rounded-sm"
                    style={{
                      height: '20px',
                      backgroundColor: intensity > 0 ? `rgba(59, 130, 246, ${intensity / 100})` : '#e5e7eb'
                    }}
                    title={`${hour}:00 - ${hourData?.requests || 0} requests`}
                  ></div>
                  <span className="text-xs text-gray-500 mt-1">{hour}</span>
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>0:00</span>
            <span>12:00</span>
            <span>23:00</span>
          </div>
        </div>
      )}

      {/* Model Usage in Real-time */}
      {displayData.modelUsage && Object.keys(displayData.modelUsage).length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-900 mb-3">Current Model Usage</h4>
          <div className="flex flex-wrap gap-2">
            {Object.entries(displayData.modelUsage).map(([model, count]) => (
              <span
                key={model}
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
              >
                {model}: {count}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeMetrics;