import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';

const CostAnalysisChart = ({ data }) => {
  const [viewMode, setViewMode] = useState('trends'); // 'trends', 'breakdown', 'forecast'

  if (!data) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Cost Analysis</h3>
        <p className="text-gray-500">No cost data available</p>
      </div>
    );
  }

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{`Date: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: €${entry.value.toFixed(4)}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderTrendsView = () => {
    if (!data.costTrends || data.costTrends.length === 0) {
      return <p className="text-gray-500 text-center py-8">No trend data available</p>;
    }

    const chartData = data.costTrends.map(trend => ({
      ...trend,
      date: new Date(trend.date).toLocaleDateString()
    }));

    return (
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="cost"
              stackId="1"
              stroke="#3B82F6"
              fill="#3B82F6"
              fillOpacity={0.6}
              name="Daily Cost"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  const renderBreakdownView = () => {
    if (!data.costBreakdown || data.costBreakdown.length === 0) {
      return <p className="text-gray-500 text-center py-8">No breakdown data available</p>;
    }

    const pieData = data.costBreakdown.map((item, index) => ({
      name: item.model.replace('gpt-', '').replace('claude-', ''),
      value: item.cost,
      percentage: item.percentage,
      fill: COLORS[index % COLORS.length]
    }));

    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${(percentage).toFixed(1)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `€${value.toFixed(2)}`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pieData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip formatter={(value) => `€${value.toFixed(2)}`} />
              <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  const renderForecastView = () => {
    if (!data.forecasting) {
      return <p className="text-gray-500 text-center py-8">No forecast data available</p>;
    }

    const forecastData = [
      {
        period: 'Current',
        cost: data.forecasting.currentAvgDailyCost,
        type: 'current'
      },
      {
        period: 'Projected (7 days)',
        cost: data.forecasting.projectedWeeklyCost / 7,
        type: 'forecast'
      }
    ];

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900">Current Daily Average</h4>
            <p className="text-2xl font-bold text-blue-600">
              €{data.forecasting.currentAvgDailyCost.toFixed(2)}
            </p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-green-900">Projected Weekly Total</h4>
            <p className="text-2xl font-bold text-green-600">
              €{data.forecasting.projectedWeeklyCost.toFixed(2)}
            </p>
          </div>
          <div className="bg-orange-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-orange-900">Trend</h4>
            <p className={`text-2xl font-bold ${data.forecasting.trendPercentage > 0 ? 'text-red-600' : 'text-green-600'}`}>
              {data.forecasting.trendPercentage > 0 ? '+' : ''}{data.forecasting.trendPercentage.toFixed(1)}%
            </p>
          </div>
        </div>

        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={forecastData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip formatter={(value) => `€${value.toFixed(2)}`} />
              <Bar dataKey="cost" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-gray-50 p-4 rounded-lg">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Forecast Confidence</h4>
          <div className="flex items-center">
            <div className="flex-1 bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${data.forecasting.confidence === 'high' ? 'bg-green-500 w-3/4' : 'bg-yellow-500 w-1/2'}`}
              ></div>
            </div>
            <span className="ml-2 text-sm text-gray-600 capitalize">{data.forecasting.confidence}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">Cost Analysis & Efficiency</h3>
        <div className="flex rounded-md border border-gray-300">
          <button
            onClick={() => setViewMode('trends')}
            className={`px-3 py-1 text-sm ${viewMode === 'trends' ? 'bg-blue-50 text-blue-700 border-r border-gray-300' : 'text-gray-500'}`}
          >
            Trends
          </button>
          <button
            onClick={() => setViewMode('breakdown')}
            className={`px-3 py-1 text-sm ${viewMode === 'breakdown' ? 'bg-blue-50 text-blue-700 border-r border-gray-300' : 'text-gray-500'}`}
          >
            Breakdown
          </button>
          <button
            onClick={() => setViewMode('forecast')}
            className={`px-3 py-1 text-sm ${viewMode === 'forecast' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
          >
            Forecast
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="text-center p-3 bg-blue-50 rounded-lg">
          <p className="text-2xl font-bold text-blue-600">€{data.totalCost?.toFixed(2) || '0.00'}</p>
          <p className="text-sm text-blue-600">Total Cost</p>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <p className="text-2xl font-bold text-green-600">€{data.avgCostPerRequest?.toFixed(4) || '0.0000'}</p>
          <p className="text-sm text-green-600">Avg per Request</p>
        </div>
        <div className="text-center p-3 bg-purple-50 rounded-lg">
          <p className="text-2xl font-bold text-purple-600">{data.efficiencyMetrics?.costEfficiency?.toFixed(4) || '0.0000'}</p>
          <p className="text-sm text-purple-600">Cost Efficiency</p>
        </div>
        <div className="text-center p-3 bg-orange-50 rounded-lg">
          <p className="text-2xl font-bold text-orange-600">{data.efficiencyMetrics?.overallEfficiency?.toFixed(2) || '0.00'}</p>
          <p className="text-sm text-orange-600">Overall Score</p>
        </div>
      </div>

      {/* Chart Content */}
      {viewMode === 'trends' && renderTrendsView()}
      {viewMode === 'breakdown' && renderBreakdownView()}
      {viewMode === 'forecast' && renderForecastView()}
    </div>
  );
};

export default CostAnalysisChart;