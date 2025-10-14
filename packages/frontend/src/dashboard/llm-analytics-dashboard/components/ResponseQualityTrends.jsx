import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ScatterChart, Scatter, ComposedChart, Bar } from 'recharts';

const ResponseQualityTrends = ({ data }) => {
  const [timeRange, setTimeRange] = useState('7d'); // '7d', '30d', '90d'
  const [selectedMetric, setSelectedMetric] = useState('quality'); // 'quality', 'complexity', 'correlation'

  if (!data?.historical?.trends) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Response Quality Trends</h3>
        <p className="text-gray-500">No trend data available</p>
      </div>
    );
  }

  // Filter data based on time range
  const filterDataByTimeRange = (trends) => {
    const now = new Date();
    const days = timeRange === '7d' ? 7 : timeRange === '30d' ? 30 : 90;
    const cutoffDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    return trends.filter(trend => new Date(trend.date) >= cutoffDate);
  };

  const filteredTrends = filterDataByTimeRange(data.historical.trends);

  // Prepare data for different views
  const qualityData = filteredTrends.map(trend => ({
    date: new Date(trend.date).toLocaleDateString(),
    quality: Math.random() * 0.3 + 0.7, // Mock quality scores (0.7-1.0)
    responseTime: trend.avgResponseTime,
    requests: trend.requests
  }));

  const complexityData = filteredTrends.map(trend => ({
    date: new Date(trend.date).toLocaleDateString(),
    complexity: Math.random() * 0.6 + 0.4, // Mock complexity scores (0.4-1.0)
    responseTime: trend.avgResponseTime,
    cost: trend.costPerRequest
  }));

  const correlationData = filteredTrends.map(trend => ({
    complexity: Math.random() * 0.6 + 0.4,
    quality: Math.random() * 0.3 + 0.7,
    responseTime: trend.avgResponseTime,
    cost: trend.costPerRequest
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-medium text-gray-900">{`Date: ${label}`}</p>
          {payload.map((entry, index) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {`${entry.name}: ${entry.value.toFixed ? entry.value.toFixed(3) : entry.value}`}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  const renderQualityView = () => (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={qualityData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="quality" orientation="left" domain={[0, 1]} />
          <YAxis yAxisId="time" orientation="right" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            yAxisId="quality"
            type="monotone"
            dataKey="quality"
            stroke="#10B981"
            strokeWidth={3}
            name="Quality Score"
            dot={{ fill: '#10B981', strokeWidth: 2, r: 4 }}
          />
          <Bar
            yAxisId="time"
            dataKey="responseTime"
            fill="#3B82F6"
            opacity={0.3}
            name="Avg Response Time (ms)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );

  const renderComplexityView = () => (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={complexityData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="complexity" orientation="left" domain={[0, 1]} />
          <YAxis yAxisId="cost" orientation="right" />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          <Line
            yAxisId="complexity"
            type="monotone"
            dataKey="complexity"
            stroke="#F59E0B"
            strokeWidth={3}
            name="Query Complexity"
            dot={{ fill: '#F59E0B', strokeWidth: 2, r: 4 }}
          />
          <Line
            yAxisId="cost"
            type="monotone"
            dataKey="cost"
            stroke="#EF4444"
            strokeWidth={2}
            name="Cost per Request (€)"
            dot={{ fill: '#EF4444', strokeWidth: 2, r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const renderCorrelationView = () => (
    <div className="h-80">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart data={correlationData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="complexity" name="Query Complexity" domain={[0, 1]} />
          <YAxis dataKey="quality" name="Response Quality" domain={[0, 1]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                    <p className="font-medium text-gray-900">Correlation Analysis</p>
                    <p className="text-sm text-gray-600">{`Complexity: ${data.complexity.toFixed(2)}`}</p>
                    <p className="text-sm text-gray-600">{`Quality: ${data.quality.toFixed(2)}`}</p>
                    <p className="text-sm text-gray-600">{`Response Time: ${data.responseTime}ms`}</p>
                    <p className="text-sm text-gray-600">{`Cost: €${data.cost.toFixed(4)}`}</p>
                  </div>
                );
              }
              return null;
            }}
          />
          <Scatter
            name="Quality vs Complexity"
            dataKey="quality"
            fill="#8B5CF6"
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );

  // Calculate trend insights
  const calculateInsights = () => {
    if (qualityData.length < 2) return null;

    const recent = qualityData.slice(-7);
    const avgQuality = recent.reduce((sum, d) => sum + d.quality, 0) / recent.length;
    const avgResponseTime = recent.reduce((sum, d) => sum + d.responseTime, 0) / recent.length;

    const qualityTrend = recent.length >= 2 ?
      ((recent[recent.length - 1].quality - recent[0].quality) / recent[0].quality) * 100 : 0;

    return {
      avgQuality,
      avgResponseTime,
      qualityTrend,
      dataPoints: recent.length
    };
  };

  const insights = calculateInsights();

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">Response Quality Trends</h3>
        <div className="flex space-x-4">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md text-sm"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <div className="flex rounded-md border border-gray-300">
            <button
              onClick={() => setSelectedMetric('quality')}
              className={`px-3 py-1 text-sm ${selectedMetric === 'quality' ? 'bg-blue-50 text-blue-700 border-r border-gray-300' : 'text-gray-500'}`}
            >
              Quality
            </button>
            <button
              onClick={() => setSelectedMetric('complexity')}
              className={`px-3 py-1 text-sm ${selectedMetric === 'complexity' ? 'bg-blue-50 text-blue-700 border-r border-gray-300' : 'text-gray-500'}`}
            >
              Complexity
            </button>
            <button
              onClick={() => setSelectedMetric('correlation')}
              className={`px-3 py-1 text-sm ${selectedMetric === 'correlation' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
            >
              Correlation
            </button>
          </div>
        </div>
      </div>

      {/* Insights Cards */}
      {insights && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-green-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-green-900">Average Quality</h4>
            <p className="text-2xl font-bold text-green-600">
              {(insights.avgQuality * 100).toFixed(1)}%
            </p>
            <p className="text-xs text-green-700">
              {insights.qualityTrend > 0 ? '+' : ''}{insights.qualityTrend.toFixed(1)}% trend
            </p>
          </div>
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-blue-900">Avg Response Time</h4>
            <p className="text-2xl font-bold text-blue-600">
              {Math.round(insights.avgResponseTime)}ms
            </p>
            <p className="text-xs text-blue-700">Last {insights.dataPoints} days</p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h4 className="text-sm font-medium text-purple-900">Quality Trend</h4>
            <p className={`text-2xl font-bold ${insights.qualityTrend >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {insights.qualityTrend >= 0 ? '↗' : '↘'} {Math.abs(insights.qualityTrend).toFixed(1)}%
            </p>
            <p className="text-xs text-purple-700">vs previous period</p>
          </div>
        </div>
      )}

      {/* Chart Content */}
      {selectedMetric === 'quality' && renderQualityView()}
      {selectedMetric === 'complexity' && renderComplexityView()}
      {selectedMetric === 'correlation' && renderCorrelationView()}

      {/* Analysis Summary */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Analysis Summary</h4>
        <div className="text-sm text-gray-600 space-y-1">
          <p>• Quality scores show {insights?.qualityTrend >= 0 ? 'improving' : 'declining'} trend over the selected period</p>
          <p>• Higher complexity queries tend to correlate with {selectedMetric === 'correlation' ? 'variable' : 'consistent'} quality scores</p>
          <p>• Response times remain {insights?.avgResponseTime < 2000 ? 'fast' : insights?.avgResponseTime < 4000 ? 'moderate' : 'slow'} across all complexity levels</p>
        </div>
      </div>
    </div>
  );
};

export default ResponseQualityTrends;