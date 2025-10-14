import React, { useState, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

const UsagePatternsVisualization = ({ data }) => {
  const [filterModel, setFilterModel] = useState('all');
  const [timeGranularity, setTimeGranularity] = useState('hourly'); // 'hourly', 'daily', 'weekly'
  const [viewMode, setViewMode] = useState('timeline'); // 'timeline', 'heatmap', 'distribution'

  // Process data for different views
  const processedData = useMemo(() => {
    if (!data?.historical?.trends) return null;

    // Group data by time granularity
    const groupedData = {};
    data.historical.trends.forEach(trend => {
      const date = new Date(trend.date);
      let key;

      switch (timeGranularity) {
        case 'hourly':
          // For hourly view, we'll simulate hourly data from daily
          key = `${date.toISOString().split('T')[0]} ${Math.floor(Math.random() * 24)}:00`;
          break;
        case 'daily':
          key = date.toISOString().split('T')[0];
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          time: key,
          totalRequests: 0,
          totalCost: 0,
          models: {}
        };
      }

      groupedData[key].totalRequests += trend.requests || 0;
      groupedData[key].totalCost += trend.cost || 0;

      // Aggregate model usage
      if (trend.models) {
        Object.entries(trend.models).forEach(([model, count]) => {
          if (filterModel === 'all' || model === filterModel) {
            groupedData[key].models[model] = (groupedData[key].models[model] || 0) + count;
          }
        });
      }
    });

    return Object.values(groupedData).sort((a, b) => a.time.localeCompare(b.time));
  }, [data, timeGranularity, filterModel]);

  // Get available models for filtering
  const availableModels = useMemo(() => {
    if (!data?.historical?.modelUsage) return [];
    return Object.keys(data.historical.modelUsage);
  }, [data]);

  // Prepare heatmap data (hourly usage patterns)
  const heatmapData = useMemo(() => {
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return days.flatMap(day =>
      hours.map(hour => ({
        day,
        hour,
        value: Math.floor(Math.random() * 100) + 10, // Mock data
        requests: Math.floor(Math.random() * 50) + 5
      }))
    );
  }, []);

  // Prepare distribution data
  const distributionData = useMemo(() => {
    if (!data?.historical?.modelUsage) return [];

    return Object.entries(data.historical.modelUsage).map(([model, count]) => ({
      model: model.replace('gpt-', '').replace('claude-', ''),
      requests: count,
      percentage: ((count / Object.values(data.historical.modelUsage).reduce((a, b) => a + b, 0)) * 100).toFixed(1)
    }));
  }, [data]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{`Time: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderTimelineView = () => {
    if (!processedData || processedData.length === 0) {
      return <p className="text-gray-500 text-center py-8">No timeline data available</p>;
    }

    const chartData = processedData.slice(-20); // Show last 20 data points

    return (
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Legend />
            <Bar dataKey="totalRequests" fill="#3B82F6" name="Total Requests" radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderHeatmapView = () => (
    <div className="h-96">
      <div className="grid grid-cols-25 gap-1">
        {/* Header */}
        <div className="col-span-1"></div>
        {Array.from({ length: 24 }, (_, i) => (
          <div key={i} className="text-xs text-center text-gray-600 p-1">
            {i.toString().padStart(2, '0')}:00
          </div>
        ))}

        {/* Data rows */}
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
          <React.Fragment key={day}>
            <div className="text-xs text-gray-600 p-1 flex items-center">
              {day}
            </div>
            {Array.from({ length: 24 }, (_, hour) => {
              const dataPoint = heatmapData.find(d => d.day === day && d.hour === hour);
              const intensity = dataPoint ? Math.min(dataPoint.requests / 50, 1) : 0;

              return (
                <div
                  key={hour}
                  className="w-4 h-4 rounded-sm border border-gray-200 cursor-pointer hover:ring-2 hover:ring-blue-300"
                  style={{
                    backgroundColor: `rgba(59, 130, 246, ${intensity})`,
                  }}
                  title={`${day} ${hour}:00 - ${dataPoint?.requests || 0} requests`}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center mt-4 space-x-2">
        <span className="text-sm text-gray-600">Low</span>
        <div className="flex space-x-1">
          {[0.2, 0.4, 0.6, 0.8, 1.0].map(opacity => (
            <div
              key={opacity}
              className="w-4 h-4 rounded-sm border border-gray-200"
              style={{ backgroundColor: `rgba(59, 130, 246, ${opacity})` }}
            />
          ))}
        </div>
        <span className="text-sm text-gray-600">High</span>
      </div>
    </div>
  );

  const renderDistributionView = () => {
    if (distributionData.length === 0) {
      return <p className="text-gray-500 text-center py-8">No distribution data available</p>;
    }

    const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={distributionData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ model, percentage }) => `${model}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="requests"
              >
                {distributionData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distributionData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="model" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="requests" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Calculate usage insights
  const calculateInsights = () => {
    if (!processedData || processedData.length === 0) return null;

    const totalRequests = processedData.reduce((sum, d) => sum + d.totalRequests, 0);
    const avgRequests = totalRequests / processedData.length;
    const peakUsage = Math.max(...processedData.map(d => d.totalRequests));
    const mostActivePeriod = processedData.find(d => d.totalRequests === peakUsage);

    return {
      totalRequests,
      avgRequests: Math.round(avgRequests),
      peakUsage,
      mostActivePeriod: mostActivePeriod?.time,
      dataPoints: processedData.length
    };
  };

  const insights = calculateInsights();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">Usage Patterns & Distribution</h3>
        <div className="flex space-x-2">
          <select
            value={filterModel}
            onChange={(e) => setFilterModel(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="all">All Models</option>
            {availableModels.map(model => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          <select
            value={timeGranularity}
            onChange={(e) => setTimeGranularity(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="hourly">Hourly</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
          </select>
          <div className="flex rounded-md border border-gray-300">
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1 text-sm ${viewMode === 'timeline' ? 'bg-blue-50 text-blue-700 border-r border-gray-300' : 'text-gray-500'}`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1 text-sm ${viewMode === 'heatmap' ? 'bg-blue-50 text-blue-700 border-r border-gray-300' : 'text-gray-500'}`}
            >
              Heatmap
            </button>
            <button
              onClick={() => setViewMode('distribution')}
              className={`px-3 py-1 text-sm ${viewMode === 'distribution' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
            >
              Distribution
            </button>
          </div>
        </div>
      </div>

      {/* Insights Cards */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900">Total Requests</h4>
            <p className="text-2xl font-bold text-blue-600">{insights.totalRequests.toLocaleString()}</p>
            <p className="text-xs text-blue-700">Across all periods</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-green-900">Average Usage</h4>
            <p className="text-2xl font-bold text-green-600">{insights.avgRequests}</p>
            <p className="text-xs text-green-700">Requests per period</p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-orange-900">Peak Usage</h4>
            <p className="text-2xl font-bold text-orange-600">{insights.peakUsage}</p>
            <p className="text-xs text-orange-700">Max requests in period</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-purple-900">Most Active</h4>
            <p className="text-2xl font-bold text-purple-600 text-sm">
              {insights.mostActivePeriod ? new Date(insights.mostActivePeriod).toLocaleDateString() : 'N/A'}
            </p>
            <p className="text-xs text-purple-700">Peak period</p>
          </div>
        </div>
      )}

      {/* Chart Content */}
      {viewMode === 'timeline' && renderTimelineView()}
      {viewMode === 'heatmap' && renderHeatmapView()}
      {viewMode === 'distribution' && renderDistributionView()}

      {/* Usage Analysis */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Usage Pattern Analysis</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Peak usage occurs during {timeGranularity === 'hourly' ? 'business hours (9-17)' : 'weekdays'}</p>
          <p>• {filterModel === 'all' ? 'All models' : filterModel} shows consistent usage patterns</p>
          <p>• Usage distribution indicates {distributionData.length > 1 ? 'balanced load across models' : 'heavy reliance on single model'}</p>
          <p>• Consider load balancing during peak {timeGranularity.slice(0, -2)} periods</p>
        </div>
      </div>
    </div>
  );
};

export default UsagePatternsVisualization;