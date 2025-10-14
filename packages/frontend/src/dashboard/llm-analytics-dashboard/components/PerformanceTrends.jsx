import React from 'react';

const PerformanceTrends = ({ data }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Trends</h3>
        <div className="flex items-center justify-center h-64 text-gray-500">
          No performance trend data available
        </div>
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

  // Calculate metrics
  const avgResponseTime = sortedData.reduce((sum, item) => sum + (item.avgResponseTime || 0), 0) / sortedData.length;
  const totalRequests = sortedData.reduce((sum, item) => sum + (item.requests || 0), 0);
  const avgCostPerRequest = sortedData.reduce((sum, item) => sum + (item.costPerRequest || 0), 0) / sortedData.length;

  // Get min/max values for scaling
  const responseTimes = sortedData.map(d => d.avgResponseTime || 0);
  const maxResponseTime = Math.max(...responseTimes);
  const minResponseTime = Math.min(...responseTimes);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Performance Trends</h3>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center">
          <p className="text-2xl font-bold text-blue-600">{Math.round(avgResponseTime)}ms</p>
          <p className="text-sm text-gray-600">Avg Response Time</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{totalRequests}</p>
          <p className="text-sm text-gray-600">Total Requests</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-purple-600">€{avgCostPerRequest.toFixed(4)}</p>
          <p className="text-sm text-gray-600">Avg Cost/Request</p>
        </div>
      </div>

      {/* Trend Chart */}
      <div className="relative">
        <div className="flex items-end space-x-1 h-32">
          {sortedData.map((item, index) => {
            const height = maxResponseTime > minResponseTime ?
              ((item.avgResponseTime - minResponseTime) / (maxResponseTime - minResponseTime)) * 100 :
              50;

            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-blue-500 rounded-t"
                  style={{
                    height: `${Math.max(height, 5)}%`,
                    minHeight: '4px'
                  }}
                  title={`${item.date}: ${Math.round(item.avgResponseTime)}ms, ${item.requests} requests`}
                ></div>
                <div className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-top">
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-xs text-gray-400 -ml-8">
          <span>{Math.round(maxResponseTime)}ms</span>
          <span>{Math.round((maxResponseTime + minResponseTime) / 2)}ms</span>
          <span>{Math.round(minResponseTime)}ms</span>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-center space-x-6 text-sm text-gray-600">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-blue-500 rounded mr-2"></div>
          <span>Avg Response Time</span>
        </div>
      </div>

      {/* Data Table */}
      <div className="mt-6">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Recent Performance Data</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Requests</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Avg Time</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cost/Req</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.slice(-7).map((item, index) => ( // Show last 7 days
                <tr key={index}>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-900">
                    {new Date(item.date).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                    {item.requests}
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                    {Math.round(item.avgResponseTime)}ms
                  </td>
                  <td className="px-3 py-2 whitespace-nowrap text-gray-500">
                    €{item.costPerRequest?.toFixed(4) || '0.0000'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default PerformanceTrends;