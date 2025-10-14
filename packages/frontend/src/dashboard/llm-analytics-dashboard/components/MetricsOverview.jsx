import React from 'react';

const MetricsOverview = ({ data, realTimeData }) => {
  if (!data) return null;

  // Use real-time data if available, otherwise fall back to historical
  const displayData = realTimeData || data;

  const metrics = [
    {
      title: 'Total Requests',
      value: displayData.totalRequests || 0,
      icon: '📊',
      color: 'blue',
      format: 'number'
    },
    {
      title: 'Total Cost',
      value: displayData.totalCost || 0,
      icon: '💰',
      color: 'green',
      format: 'currency'
    },
    {
      title: 'Avg Response Time',
      value: displayData.avgResponseTime || 0,
      icon: '⚡',
      color: 'yellow',
      format: 'duration'
    },
    {
      title: 'Cost per Request',
      value: displayData.performanceMetrics?.costPerRequest || 0,
      icon: '📈',
      color: 'purple',
      format: 'currency-small'
    },
    {
      title: 'Success Rate',
      value: displayData.performanceMetrics?.successRate || 0,
      icon: '✅',
      color: 'green',
      format: 'percentage'
    },
    {
      title: 'Fallback Rate',
      value: displayData.performanceMetrics?.fallbackRate || 0,
      icon: '⚠️',
      color: 'red',
      format: 'percentage'
    }
  ];

  const formatValue = (value, format) => {
    switch (format) {
      case 'currency':
        return `€${value.toFixed(2)}`;
      case 'currency-small':
        return `€${value.toFixed(4)}`;
      case 'duration':
        return `${Math.round(value)}ms`;
      case 'percentage':
        return `${Math.round(value * 100)}%`;
      case 'number':
      default:
        return value.toLocaleString();
    }
  };

  const getColorClasses = (color) => {
    const colors = {
      blue: 'bg-blue-50 text-blue-700 border-blue-200',
      green: 'bg-green-50 text-green-700 border-green-200',
      yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
      purple: 'bg-purple-50 text-purple-700 border-purple-200',
      red: 'bg-red-50 text-red-700 border-red-200'
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Metrics Overview</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className={`p-4 rounded-lg border ${getColorClasses(metric.color)}`}
          >
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <span className="text-2xl">{metric.icon}</span>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">{metric.title}</p>
                <p className="text-2xl font-bold text-gray-900">
                  {formatValue(metric.value, metric.format)}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Additional Insights */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Key Insights</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">Most Used Model:</span>{' '}
            {Object.keys(displayData.modelUsage || {}).length > 0 ?
              Object.entries(displayData.modelUsage)
                .sort(([,a], [,b]) => b - a)[0][0] :
              'No data'
            }
          </div>
          <div>
            <span className="font-medium">Peak Usage Hour:</span>{' '}
            {displayData.hourlyStats && displayData.hourlyStats.length > 0 ?
              displayData.hourlyStats
                .sort((a, b) => b.requests - a.requests)[0]?.hour :
              'No data'
            }:00
          </div>
        </div>
      </div>
    </div>
  );
};

export default MetricsOverview;