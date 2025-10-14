import React, { useState } from 'react';
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle, Lightbulb, Target, Users, Zap } from 'lucide-react';

const ClientInsightsPanel = ({ data }) => {
  const [activeTab, setActiveTab] = useState('benchmarks'); // 'benchmarks', 'recommendations', 'alerts', 'comparison'

  if (!data?.clientInsights) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Client Insights</h3>
        <p className="text-gray-500">No insights data available</p>
      </div>
    );
  }

  const renderBenchmarksTab = () => {
    const benchmarks = data.clientInsights.performanceBenchmarks;
    if (!benchmarks) return <p className="text-gray-500">No benchmark data available</p>;

    return (
      <div className="space-y-6">
        {Object.entries(benchmarks).map(([model, modelBenchmarks]) => (
          <div key={model} className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-lg font-medium text-gray-900 mb-4 capitalize">
              {model.replace('gpt-', '').replace('claude-', '')} Performance Benchmarks
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {Object.entries(modelBenchmarks).map(([metric, benchmark]) => (
                <div key={metric} className="bg-gray-50 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700 capitalize">
                      {metric.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    {benchmark.status === 'good' ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-yellow-500" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Client:</span>
                      <span className="font-medium">
                        {metric === 'successRate' ? `${(benchmark.client * 100).toFixed(1)}%` :
                         metric === 'costEfficiency' ? `€${benchmark.client.toFixed(4)}` :
                         metric === 'responseTime' ? `${Math.round(benchmark.client)}ms` :
                         benchmark.client.toFixed(2)}
                      </span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Benchmark:</span>
                      <span className="font-medium">
                        {metric === 'successRate' ? `${(benchmark.benchmark * 100).toFixed(1)}%` :
                         metric === 'costEfficiency' ? `€${benchmark.benchmark.toFixed(4)}` :
                         metric === 'responseTime' ? `${Math.round(benchmark.benchmark)}ms` :
                         benchmark.benchmark.toFixed(2)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full ${
                          benchmark.status === 'good' ? 'bg-green-500' : 'bg-yellow-500'
                        }`}
                        style={{
                          width: `${Math.min((benchmark.client / benchmark.benchmark) * 100, 100)}%`
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderRecommendationsTab = () => {
    const recommendations = data.clientInsights.optimizationRecommendations || [];
    if (recommendations.length === 0) {
      return (
        <div className="text-center py-8">
          <Lightbulb className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No recommendations available</h3>
          <p className="mt-1 text-sm text-gray-500">
            Your current configuration is performing optimally.
          </p>
        </div>
      );
    }

    const priorityColors = {
      high: 'bg-red-50 border-red-200 text-red-800',
      medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      low: 'bg-green-50 border-green-200 text-green-800'
    };

    const priorityIcons = {
      high: <AlertTriangle className="h-4 w-4" />,
      medium: <TrendingUp className="h-4 w-4" />,
      low: <CheckCircle className="h-4 w-4" />
    };

    return (
      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div key={index} className={`border rounded-lg p-4 ${priorityColors[rec.priority]}`}>
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-3">
                {priorityIcons[rec.priority]}
                <div className="flex-1">
                  <h4 className="text-sm font-medium">{rec.title}</h4>
                  <p className="text-sm mt-1">{rec.description}</p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-xs">
                      <strong>Impact:</strong> {rec.impact}
                    </span>
                    <span className="text-xs">
                      <strong>Effort:</strong> {rec.effort}
                    </span>
                    {rec.model && (
                      <span className="text-xs">
                        <strong>Model:</strong> {rec.model}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${priorityColors[rec.priority]}`}>
                {rec.priority}
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderAlertsTab = () => {
    const alerts = data.clientInsights.alerts || [];
    if (alerts.length === 0) {
      return (
        <div className="text-center py-8">
          <CheckCircle className="mx-auto h-12 w-12 text-green-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">All systems operational</h3>
          <p className="mt-1 text-sm text-gray-500">
            No active alerts at this time.
          </p>
        </div>
      );
    }

    const severityColors = {
      high: 'bg-red-50 border-red-200 text-red-800',
      medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      low: 'bg-blue-50 border-blue-200 text-blue-800'
    };

    const severityIcons = {
      high: <AlertTriangle className="h-5 w-5 text-red-500" />,
      medium: <TrendingUp className="h-5 w-5 text-yellow-500" />,
      low: <CheckCircle className="h-5 w-5 text-blue-500" />
    };

    return (
      <div className="space-y-4">
        {alerts.map((alert, index) => (
          <div key={index} className={`border rounded-lg p-4 ${severityColors[alert.severity]}`}>
            <div className="flex items-start space-x-3">
              {severityIcons[alert.severity]}
              <div className="flex-1">
                <h4 className="text-sm font-medium">{alert.title}</h4>
                <p className="text-sm mt-1">{alert.message}</p>
                <p className="text-xs text-gray-500 mt-2">
                  {new Date(alert.timestamp).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderComparisonTab = () => {
    const comparison = data.clientInsights.peerComparison;
    if (!comparison) {
      return <p className="text-gray-500">No peer comparison data available</p>;
    }

    return (
      <div className="space-y-6">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center space-x-2 mb-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h4 className="text-sm font-medium text-blue-900">Peer Comparison Overview</h4>
          </div>
          <p className="text-sm text-blue-700">
            Your performance compared to similar clients in your industry segment.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {comparison.comparison?.map(({ model, client, peers, percentile }) => (
            <div key={model} className="border border-gray-200 rounded-lg p-4">
              <h5 className="text-lg font-medium text-gray-900 mb-3 capitalize">
                {model.replace('gpt-', '').replace('claude-', '')}
              </h5>

              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Response Time</span>
                  <div className="flex items-center space-x-2">
                    {percentile.responseTime === 'above_average' ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${
                      percentile.responseTime === 'above_average' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {percentile.responseTime.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Success Rate</span>
                  <div className="flex items-center space-x-2">
                    {percentile.successRate === 'above_average' ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${
                      percentile.successRate === 'above_average' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {percentile.successRate.replace('_', ' ')}
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Cost Efficiency</span>
                  <div className="flex items-center space-x-2">
                    {percentile.costEfficiency === 'above_average' ? (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-sm font-medium ${
                      percentile.costEfficiency === 'above_average' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {percentile.costEfficiency.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              {peers && (
                <div className="mt-4 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-2">Peer Average (n={peers.sampleSize})</p>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-600">Response:</span>
                      <br />
                      <span className="font-medium">{Math.round(peers.avgResponseTime)}ms</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Success:</span>
                      <br />
                      <span className="font-medium">{(peers.avgSuccessRate * 100).toFixed(1)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Cost:</span>
                      <br />
                      <span className="font-medium">€{peers.avgCostPerRequest.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const tabs = [
    { id: 'benchmarks', label: 'Benchmarks', icon: Target },
    { id: 'recommendations', label: 'Recommendations', icon: Lightbulb },
    { id: 'alerts', label: 'Alerts', icon: AlertTriangle },
    { id: 'comparison', label: 'Peer Comparison', icon: Users }
  ];

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-gray-900">Client Insights & Recommendations</h3>
        <div className="flex items-center space-x-1">
          <Zap className="h-4 w-4 text-yellow-500" />
          <span className="text-sm text-gray-600">AI-Powered Insights</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center space-x-2 ${
                activeTab === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {activeTab === 'benchmarks' && renderBenchmarksTab()}
        {activeTab === 'recommendations' && renderRecommendationsTab()}
        {activeTab === 'alerts' && renderAlertsTab()}
        {activeTab === 'comparison' && renderComparisonTab()}
      </div>

      {/* Last Updated */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 text-center">
          Last updated: {new Date(data.clientInsights.generatedAt).toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export default ClientInsightsPanel;