import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

const ModelPerformanceComparison = ({ data }) => {
  const [selectedMetric, setSelectedMetric] = useState('avgResponseTime');
  const [viewMode, setViewMode] = useState('bar'); // 'bar' or 'trend'

  if (!data?.clientMetrics) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Model Performance Comparison</h3>
        <p className="text-gray-500">No performance data available</p>
      </div>
    );
  }

  const metrics = [
    { key: 'avgResponseTime', label: 'Avg Response Time (ms)', color: '#3B82F6' },
    { key: 'successRate', label: 'Success Rate (%)', color: '#10B981', formatter: (val) => `${(val * 100).toFixed(1)}%` },
    { key: 'costPerRequest', label: 'Cost per Request (€)', color: '#F59E0B', formatter: (val) => `€${val.toFixed(4)}` },
    { key: 'efficiency', label: 'Efficiency Score', color: '#8B5CF6' }
  ];

  const chartData = Object.entries(data.clientMetrics).map(([model, metrics]) => ({
    model: model.replace('gpt-', '').replace('claude-', ''),
    avgResponseTime: Math.round(metrics.avgResponseTime),
    successRate: metrics.successRate,
    costPerRequest: metrics.costPerRequest,
    efficiency: metrics.efficiency || 0,
    totalRequests: metrics.totalRequests
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const metric = metrics.find(m => m.key === selectedMetric);

      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{`Model: ${label}`}</p>
          <p className="text-sm text-gray-600">
            {`Value: ${metric?.formatter ? metric.formatter(data[selectedMetric]) : data[selectedMetric]}`}
          </p>
          <p className="text-sm text-gray-600">{`Total Requests: ${data.totalRequests}`}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">Model Performance Comparison</h3>
        <div className="flex space-x-2">
          <select
            value={selectedMetric}
            onChange={(e) => setSelectedMetric(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            {metrics.map(metric => (
              <option key={metric.key} value={metric.key}>{metric.label}</option>
            ))}
          </select>
          <div className="flex rounded-md border border-gray-300">
            <button
              onClick={() => setViewMode('bar')}
              className={`px-3 py-1 text-sm ${viewMode === 'bar' ? 'bg-blue-50 text-blue-700 border-r border-gray-300' : 'text-gray-500'}`}
            >
              Bar
            </button>
            <button
              onClick={() => setViewMode('trend')}
              className={`px-3 py-1 text-sm ${viewMode === 'trend' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
            >
              Trend
            </button>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {viewMode === 'bar' ? (
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="model" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Bar
                dataKey={selectedMetric}
                fill={metrics.find(m => m.key === selectedMetric)?.color || '#3B82F6'}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          ) : (
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="model" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey={selectedMetric}
                stroke={metrics.find(m => m.key === selectedMetric)?.color || '#3B82F6'}
                strokeWidth={3}
                dot={{ fill: metrics.find(m => m.key === selectedMetric)?.color || '#3B82F6', strokeWidth: 2, r: 6 }}
              />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Performance Insights */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-600 font-medium">Best Performance</p>
          <p className="text-lg font-bold text-blue-900">
            {chartData.reduce((best, current) =>
              selectedMetric === 'successRate' || selectedMetric === 'efficiency'
                ? (current[selectedMetric] > best[selectedMetric] ? current : best)
                : (current[selectedMetric] < best[selectedMetric] ? current : best)
            ).model}
          </p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-sm text-green-600 font-medium">Most Used</p>
          <p className="text-lg font-bold text-green-900">
            {chartData.reduce((max, current) =>
              current.totalRequests > max.totalRequests ? current : max
            ).model}
          </p>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <p className="text-sm text-purple-600 font-medium">Highest Efficiency</p>
          <p className="text-lg font-bold text-purple-900">
            {chartData.reduce((best, current) =>
              (current.efficiency || 0) > (best.efficiency || 0) ? current : best
            ).model}
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModelPerformanceComparison;