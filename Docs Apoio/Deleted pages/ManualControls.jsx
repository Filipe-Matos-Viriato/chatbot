// packages/frontend/src/dashboard/learning-engine-dashboard/components/ManualControls.jsx
// Administrative control panel for manual learning engine management and parameter tuning
// Provides retraining triggers, parameter controls, and system management capabilities
// LearningEngineDashboard.jsx, real-time-learning-engine.js, apiClient.js
import React, { useState } from 'react';
import { apiClient } from '../../../config/apiClient';

const ManualControls = ({ onRetraining, metrics }) => {
  const [retrainingStatus, setRetrainingStatus] = useState('idle');
  const [parameterUpdates, setParameterUpdates] = useState({
    adaptationRate: metrics?.adaptationRate || 0.1,
    explorationRate: metrics?.explorationRate || 0.1,
    confidenceThreshold: metrics?.confidenceThreshold || 0.8
  });
  const [updateStatus, setUpdateStatus] = useState('idle');

  const handleRetraining = async () => {
    setRetrainingStatus('running');
    try {
      await onRetraining();
      setRetrainingStatus('success');
      setTimeout(() => setRetrainingStatus('idle'), 3000);
    } catch (error) {
      console.error('Retraining failed:', error);
      setRetrainingStatus('error');
      setTimeout(() => setRetrainingStatus('idle'), 5000);
    }
  };

  const handleParameterUpdate = async () => {
    setUpdateStatus('running');
    try {
      // In real implementation, this would call an API to update parameters
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setUpdateStatus('success');
      setTimeout(() => setUpdateStatus('idle'), 3000);
    } catch (error) {
      console.error('Parameter update failed:', error);
      setUpdateStatus('error');
      setTimeout(() => setUpdateStatus('idle'), 5000);
    }
  };

  const resetToDefaults = () => {
    setParameterUpdates({
      adaptationRate: 0.1,
      explorationRate: 0.1,
      confidenceThreshold: 0.8
    });
  };

  const RetrainingSection = () => (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Policy Retraining</h3>

      <div className="space-y-4">
        <div className="bg-blue-50 p-4 rounded-lg">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h4 className="text-sm font-medium text-blue-800">Manual Retraining</h4>
              <div className="mt-2 text-sm text-blue-700">
                <p>Force immediate policy retraining with current learning data. This will:</p>
                <ul className="list-disc list-inside mt-1 space-y-1">
                  <li>Process all accumulated learning signals</li>
                  <li>Update policy weights based on new data</li>
                  <li>Reset exploration state for better discovery</li>
                  <li>May temporarily impact performance during retraining</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">
              Last retraining: {metrics?.lastRetraining ? new Date(metrics.lastRetraining).toLocaleString() : 'Never'}
            </p>
            <p className="text-sm text-gray-600">
              Current policies: {metrics?.activePolicies || 0}
            </p>
          </div>

          <button
            onClick={handleRetraining}
            disabled={retrainingStatus === 'running'}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
              retrainingStatus === 'running'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : retrainingStatus === 'success'
                ? 'bg-green-600 text-white hover:bg-green-700'
                : retrainingStatus === 'error'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            {retrainingStatus === 'running' && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {retrainingStatus === 'running' ? 'Retraining...' :
             retrainingStatus === 'success' ? 'Retrained Successfully' :
             retrainingStatus === 'error' ? 'Retraining Failed' :
             'Start Retraining'}
          </button>
        </div>
      </div>
    </div>
  );

  const ParameterControls = () => (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Parameter Controls</h3>

      <div className="space-y-6">
        {/* Adaptation Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Adaptation Rate: {(parameterUpdates.adaptationRate * 100).toFixed(1)}%
          </label>
          <input
            type="range"
            min="0.01"
            max="0.5"
            step="0.01"
            value={parameterUpdates.adaptationRate}
            onChange={(e) => setParameterUpdates(prev => ({
              ...prev,
              adaptationRate: parseFloat(e.target.value)
            }))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Slow (1%)</span>
            <span>Fast (50%)</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            How quickly policies adapt to new data. Higher values learn faster but may be unstable.
          </p>
        </div>

        {/* Exploration Rate */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Exploration Rate: {(parameterUpdates.explorationRate * 100).toFixed(1)}%
          </label>
          <input
            type="range"
            min="0.01"
            max="0.3"
            step="0.01"
            value={parameterUpdates.explorationRate}
            onChange={(e) => setParameterUpdates(prev => ({
              ...prev,
              explorationRate: parseFloat(e.target.value)
            }))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Conservative (1%)</span>
            <span>Aggressive (30%)</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Balance between exploring new models and exploiting known good ones.
          </p>
        </div>

        {/* Confidence Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Confidence Threshold: {(parameterUpdates.confidenceThreshold * 100).toFixed(1)}%
          </label>
          <input
            type="range"
            min="0.5"
            max="0.95"
            step="0.01"
            value={parameterUpdates.confidenceThreshold}
            onChange={(e) => setParameterUpdates(prev => ({
              ...prev,
              confidenceThreshold: parseFloat(e.target.value)
            }))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
          />
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>Low (50%)</span>
            <span>High (95%)</span>
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Minimum confidence required to apply learned policies.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3 pt-4 border-t">
          <button
            onClick={resetToDefaults}
            className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Reset to Defaults
          </button>

          <button
            onClick={handleParameterUpdate}
            disabled={updateStatus === 'running'}
            className={`inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md ${
              updateStatus === 'running'
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : updateStatus === 'success'
                ? 'bg-green-600 text-white'
                : updateStatus === 'error'
                ? 'bg-red-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
          >
            {updateStatus === 'running' && (
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            )}
            {updateStatus === 'running' ? 'Updating...' :
             updateStatus === 'success' ? 'Updated Successfully' :
             updateStatus === 'error' ? 'Update Failed' :
             'Update Parameters'}
          </button>
        </div>
      </div>
    </div>
  );

  const SystemControls = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900 mb-4">System Controls</h3>

      <div className="space-y-4">
        {/* Learning Engine Toggle */}
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Learning Engine</h4>
            <p className="text-sm text-gray-600">Enable/disable the real-time learning system</p>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-3">
              {metrics?.learningEnabled ? 'Enabled' : 'Disabled'}
            </span>
            <button
              type="button"
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 ${
                metrics?.learningEnabled ? 'bg-blue-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  metrics?.learningEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Data Collection Toggle */}
        <div className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
          <div>
            <h4 className="text-sm font-medium text-gray-900">Data Collection</h4>
            <p className="text-sm text-gray-600">Collect learning signals for analysis</p>
          </div>
          <div className="flex items-center">
            <span className="text-sm text-gray-500 mr-3">Enabled</span>
            <button
              type="button"
              className="relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent bg-blue-600 transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            >
              <span className="pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out translate-x-5" />
            </button>
          </div>
        </div>

        {/* Emergency Controls */}
        <div className="border-t pt-4">
          <h4 className="text-sm font-medium text-gray-900 mb-3 text-red-600">Emergency Controls</h4>
          <div className="space-y-2">
            <button className="w-full px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50">
              Reset All Policies
            </button>
            <button className="w-full px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50">
              Clear Learning Data
            </button>
            <button className="w-full px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 hover:bg-red-50">
              Emergency Stop
            </button>
          </div>
          <p className="text-xs text-red-600 mt-2">
            These actions cannot be undone. Use only in emergency situations.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">Manual Controls</h2>
        <p className="text-sm text-gray-600">
          Administrative controls for learning engine management and parameter tuning
        </p>
      </div>

      <RetrainingSection />
      <ParameterControls />
      <SystemControls />
    </div>
  );
};

export default ManualControls;