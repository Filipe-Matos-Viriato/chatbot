import React from 'react';

const ModelUsageChart = ({ data }) => {
  if (!data || Object.keys(data).length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Model Usage</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          No model usage data available
        </div>
      </div>
    );
  }

  const totalRequests = Object.values(data).reduce((sum, count) => sum + count, 0);
  const sortedModels = Object.entries(data)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 8); // Show top 8 models

  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500',
    'bg-purple-500', 'bg-pink-500', 'bg-indigo-500', 'bg-gray-500'
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Model Usage Distribution</h3>

      <div className="space-y-4">
        {sortedModels.map(([model, count], index) => {
          const percentage = (count / totalRequests) * 100;
          const colorClass = colors[index % colors.length];

          return (
            <div key={model} className="flex items-center">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {model}
                  </span>
                  <span className="text-sm text-gray-500">
                    {count} ({percentage.toFixed(1)}%)
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${colorClass}`}
                    style={{ width: `${percentage}%` }}
                  ></div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Total Requests:</span>
          <span className="font-medium text-gray-900">{totalRequests.toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-1">
          <span className="text-gray-600">Unique Models:</span>
          <span className="font-medium text-gray-900">{Object.keys(data).length}</span>
        </div>
      </div>
    </div>
  );
};

export default ModelUsageChart;