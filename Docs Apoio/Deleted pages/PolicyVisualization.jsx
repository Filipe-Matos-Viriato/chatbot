// packages/frontend/src/dashboard/learning-engine-dashboard/components/PolicyVisualization.jsx
// Interactive visualization component for displaying learned policies across query complexity levels
// Provides heatmap, 3D landscape, and detailed policy analysis for learning engine optimization
// LearningEngineDashboard.jsx, real-time-learning-engine.js, apiClient.js
import React, { useState, useEffect } from 'react';

const PolicyVisualization = ({ policies, metrics }) => {
  const [selectedComplexity, setSelectedComplexity] = useState(null);
  const [viewMode, setViewMode] = useState('heatmap'); // heatmap, 3d, timeline

  // Group policies by complexity ranges for visualization
  const complexityBuckets = {};
  policies.forEach(policy => {
    const bucket = Math.floor(policy.complexityLevel * 10) / 10; // Round to nearest 0.1
    if (!complexityBuckets[bucket]) {
      complexityBuckets[bucket] = [];
    }
    complexityBuckets[bucket].push(policy);
  });

  const PolicyHeatmap = () => {
    const complexityLevels = Object.keys(complexityBuckets).sort((a, b) => parseFloat(a) - parseFloat(b));
    const models = ['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo', 'claude-3-haiku', 'claude-3-sonnet'];

    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Policy Heatmap</h3>
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Header */}
            <div className="flex mb-2">
              <div className="w-20 flex-shrink-0 p-2 text-sm font-medium text-gray-500">Complexity</div>
              {models.map(model => (
                <div key={model} className="flex-1 p-2 text-sm font-medium text-gray-500 text-center">
                  {model.split('-').pop()}
                </div>
              ))}
            </div>

            {/* Rows */}
            {complexityLevels.map(complexity => {
              const bucketPolicies = complexityBuckets[complexity];
              const latestPolicy = bucketPolicies?.[bucketPolicies.length - 1];

              return (
                <div key={complexity} className="flex mb-1">
                  <div className="w-20 flex-shrink-0 p-2 text-sm text-gray-700 bg-gray-50 rounded-l">
                    {parseFloat(complexity).toFixed(1)}
                  </div>
                  {models.map(model => {
                    const weight = latestPolicy?.policyWeights?.[model] || 0;
                    const confidence = latestPolicy?.confidence || 0;

                    return (
                      <div
                        key={model}
                        className="flex-1 p-2 text-center cursor-pointer hover:bg-gray-100"
                        onClick={() => setSelectedComplexity(parseFloat(complexity))}
                      >
                        <div
                          className="h-8 rounded flex items-center justify-center text-xs font-medium"
                          style={{
                            backgroundColor: weight > 0
                              ? `rgba(59, 130, 246, ${weight * confidence})`
                              : '#f3f4f6',
                            color: weight > 0.5 ? 'white' : '#374151'
                          }}
                        >
                          {weight > 0 ? (weight * 100).toFixed(0) : '-'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center">
            <span className="mr-2">Weight:</span>
            <div className="flex items-center">
              <div className="w-4 h-4 bg-gray-200 rounded mr-1"></div>
              <span className="mr-3">0</span>
              <div className="w-4 h-4 bg-blue-600 rounded mr-1"></div>
              <span>100</span>
            </div>
          </div>
          <div className="text-xs">
            Click cells to view policy details
          </div>
        </div>
      </div>
    );
  };

  const PolicyDetails = ({ complexity }) => {
    if (!complexity) return null;

    const bucketPolicies = complexityBuckets[complexity];
    const latestPolicy = bucketPolicies?.[bucketPolicies.length - 1];

    if (!latestPolicy) return null;

    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">
          Policy Details - Complexity {complexity.toFixed(1)}
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Policy Weights */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Model Weights</h4>
            <div className="space-y-2">
              {Object.entries(latestPolicy.policyWeights || {}).map(([model, weight]) => (
                <div key={model} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">{model}</span>
                  <div className="flex items-center">
                    <div className="w-24 bg-gray-200 rounded-full h-2 mr-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full"
                        style={{ width: `${weight * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm font-medium w-12 text-right">
                      {(weight * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Policy Statistics */}
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">Statistics</h4>
            <dl className="space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Confidence:</dt>
                <dd className="text-sm font-medium">{(latestPolicy.confidence * 100).toFixed(1)}%</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Sample Size:</dt>
                <dd className="text-sm font-medium">{latestPolicy.sampleSize}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Average Reward:</dt>
                <dd className="text-sm font-medium">{latestPolicy.averageReward?.toFixed(3) || 'N/A'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Last Updated:</dt>
                <dd className="text-sm font-medium">
                  {new Date(latestPolicy.lastUpdated).toLocaleDateString()}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-sm text-gray-600">Version:</dt>
                <dd className="text-sm font-medium">{latestPolicy.version}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Policy Evolution */}
        {bucketPolicies && bucketPolicies.length > 1 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Policy Evolution</h4>
            <div className="space-y-2">
              {bucketPolicies.slice(-5).map((policy, index) => (
                <div key={policy.version} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm text-gray-600">v{policy.version}</span>
                  <span className="text-sm text-gray-600">
                    {new Date(policy.lastUpdated).toLocaleDateString()}
                  </span>
                  <span className="text-sm font-medium">
                    {(policy.confidence * 100).toFixed(1)}% confidence
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const ConfidenceLandscape = () => {
    // Simple 3D-like visualization using CSS transforms
    return (
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Confidence Landscape</h3>
        <div className="relative h-64 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-lg overflow-hidden">
          {policies.map((policy, index) => {
            const x = (policy.complexityLevel * 100) - 10; // Position based on complexity
            const y = 50 - (policy.confidence * 40); // Height based on confidence
            const size = Math.max(4, policy.sampleSize / 10); // Size based on sample size

            return (
              <div
                key={index}
                className="absolute w-3 h-3 bg-blue-600 rounded-full transform -translate-x-1/2 -translate-y-1/2"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                }}
                title={`Complexity: ${policy.complexityLevel.toFixed(2)}, Confidence: ${(policy.confidence * 100).toFixed(1)}%`}
              ></div>
            );
          })}

          {/* Grid lines */}
          <div className="absolute inset-0">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="absolute w-full border-t border-gray-300 opacity-30"
                style={{ top: `${20 + i * 15}%` }}
              ></div>
            ))}
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>Complexity: 0.0 → 1.0</span>
            <span>Confidence: Low → High</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">Policy Visualization</h2>
        <p className="text-sm text-gray-600">
          Interactive visualization of learned policies across complexity levels
        </p>
      </div>

      {/* View Mode Selector */}
      <div className="mb-6">
        <div className="flex space-x-4">
          {[
            { id: 'heatmap', label: 'Heatmap' },
            { id: 'landscape', label: 'Confidence Landscape' }
          ].map(mode => (
            <button
              key={mode.id}
              onClick={() => setViewMode(mode.id)}
              className={`px-4 py-2 rounded-md text-sm font-medium ${
                viewMode === mode.id
                  ? 'bg-blue-100 text-blue-700 border-blue-300'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              } border`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Visualization */}
      <div className="mb-6">
        {viewMode === 'heatmap' && <PolicyHeatmap />}
        {viewMode === 'landscape' && <ConfidenceLandscape />}
      </div>

      {/* Policy Details */}
      {selectedComplexity && (
        <PolicyDetails complexity={selectedComplexity} />
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">{policies.length}</div>
          <div className="text-sm text-gray-600">Total Policies</div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">
            {(policies.reduce((sum, p) => sum + p.confidence, 0) / policies.length * 100).toFixed(1)}%
          </div>
          <div className="text-sm text-gray-600">Avg Confidence</div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">
            {policies.reduce((sum, p) => sum + p.sampleSize, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Samples</div>
        </div>

        <div className="bg-white p-4 rounded-lg shadow">
          <div className="text-2xl font-bold text-gray-900">
            {Object.keys(complexityBuckets).length}
          </div>
          <div className="text-sm text-gray-600">Complexity Levels</div>
        </div>
      </div>
    </div>
  );
};

export default PolicyVisualization;