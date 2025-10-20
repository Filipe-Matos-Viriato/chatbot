// packages/frontend/src/dashboard/learning-engine-dashboard/components/BatchProcessingSettings.jsx
// Component for managing batch processing settings per client
// Allows administrators to configure batch sizes for learning engine and analytics logger

import React, { useState, useEffect } from 'react';
import { apiClient } from '../../../config/apiClient';

const BatchProcessingSettings = ({ clientId, onRefresh }) => {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [pendingChanges, setPendingChanges] = useState({});

  // System configurations
  const systems = [
    {
      name: 'learning_engine',
      label: 'Learning Engine',
      description: 'Batch trigger threshold for RealTimeLearningEngine processing',
      defaultThreshold: 100,
      min: 10,
      max: 1000
    },
    {
      name: 'analytics_logger',
      label: 'Analytics Logger',
      description: 'Batch trigger threshold for AdvancedAnalyticsLogger processing',
      defaultThreshold: 50,
      min: 5,
      max: 500
    }
  ];

  // Fetch current settings
  useEffect(() => {
    if (clientId) {
      fetchSettings();
    }
  }, [clientId]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiClient.get(`/api/admin/batch-settings/${clientId}`);
      setSettings(response.data.settings || []);

      // Initialize pending changes with current values
      const initialChanges = {};
      response.data.settings.forEach(setting => {
        initialChanges[setting.system_name] = {
          batch_trigger_threshold: setting.batch_trigger_threshold,
          description: setting.description || '',
          is_active: setting.is_active
        };
      });
      setPendingChanges(initialChanges);

    } catch (err) {
      console.error('Failed to fetch batch settings:', err);
      setError('Failed to load batch settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = (systemName, field, value) => {
    setPendingChanges(prev => ({
      ...prev,
      [systemName]: {
        ...prev[systemName],
        [field]: value
      }
    }));
  };

  const saveSetting = async (systemName) => {
    const changes = pendingChanges[systemName];
    if (!changes) return;

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      await apiClient.put(`/api/admin/batch-settings/${clientId}/${systemName}`, changes);

      setSuccess(`✅ ${systems.find(s => s.name === systemName)?.label} settings updated successfully`);

      // Refresh settings
      await fetchSettings();

      // Call parent refresh if provided
      if (onRefresh) {
        onRefresh();
      }

      // Clear success message after 3 seconds
      setTimeout(() => setSuccess(null), 3000);

    } catch (err) {
      console.error('Failed to save batch setting:', err);
      setError(`Failed to update ${systems.find(s => s.name === systemName)?.label} settings: ${err.response?.data?.error || err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const resetSetting = (systemName) => {
    const currentSetting = settings.find(s => s.system_name === systemName);
    if (currentSetting) {
      setPendingChanges(prev => ({
        ...prev,
        [systemName]: {
          batch_trigger_threshold: currentSetting.batch_trigger_threshold,
          description: currentSetting.description || '',
          is_active: currentSetting.is_active
        }
      }));
    }
  };

  const getCurrentValue = (systemName, field) => {
    return pendingChanges[systemName]?.[field];
  };

  const hasChanges = (systemName) => {
    const current = settings.find(s => s.system_name === systemName);
    const pending = pendingChanges[systemName];

    if (!current && !pending) return false;
    if (!current || !pending) return true;

    return (
      current.batch_trigger_threshold !== pending.batch_trigger_threshold ||
      current.description !== pending.description ||
      current.is_active !== pending.is_active
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading batch settings...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white shadow rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4 flex items-center">
            Batch Processing Settings
            <div className="ml-2 relative group">
              <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg min-w-max max-w-sm break-words">
                <div dangerouslySetInnerHTML={{ __html: 'Configure batch processing thresholds for learning and analytics systems.<br />Higher thresholds reduce processing frequency but may delay learning.<br />Lower thresholds provide more responsive updates but increase system load.<br />Settings are client-specific and take effect immediately.' }} />
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </h3>
          <p className="text-sm text-gray-600 mb-6">
            Configure batch trigger thresholds for different processing systems. These settings control when batch operations are triggered based on accumulated data.
          </p>

          {/* Success/Error Messages */}
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-red-800">{error}</p>
                </div>
              </div>
            </div>
          )}

          {success && (
            <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-green-800">{success}</p>
                </div>
              </div>
            </div>
          )}

          {/* Settings Forms */}
          <div className="space-y-6">
            {systems.map((system) => {
              const currentSetting = settings.find(s => s.system_name === system.name);
              const hasUnsavedChanges = hasChanges(system.name);

              return (
                <div key={system.name} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <div>
                        <h4 className="text-md font-medium text-gray-900 flex items-center">
                          {system.label}
                          <div className="ml-2 relative group">
                            <svg className="w-4 h-4 text-gray-400 cursor-help" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                            <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 shadow-lg min-w-max max-w-sm break-words">
                              <div dangerouslySetInnerHTML={{ __html: `${system.label} batch processing configuration.<br />Controls when ${system.name.replace('_', ' ')} operations are triggered.<br />Higher thresholds = less frequent processing, lower thresholds = more responsive updates.<br />Range: ${system.min}-${system.max} accumulated items before processing.` }} />
                              <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                            </div>
                          </div>
                        </h4>
                        <p className="text-sm text-gray-600">{system.description}</p>
                      </div>
                    </div>
                    {hasUnsavedChanges && (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        Unsaved Changes
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Batch Trigger Threshold */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Batch Trigger Threshold
                      </label>
                      <input
                        type="number"
                        min={system.min}
                        max={system.max}
                        value={getCurrentValue(system.name, 'batch_trigger_threshold') || system.defaultThreshold}
                        onChange={(e) => handleSettingChange(system.name, 'batch_trigger_threshold', parseInt(e.target.value))}
                        className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Range: {system.min} - {system.max} items
                      </p>
                    </div>

                    {/* Active Status */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Status
                      </label>
                      <div className="mt-1">
                        <label className="inline-flex items-center">
                          <input
                            type="checkbox"
                            checked={getCurrentValue(system.name, 'is_active') !== false}
                            onChange={(e) => handleSettingChange(system.name, 'is_active', e.target.checked)}
                            className="rounded border-gray-300 text-blue-600 shadow-sm focus:border-blue-300 focus:ring focus:ring-blue-200 focus:ring-opacity-50"
                          />
                          <span className="ml-2 text-sm text-gray-700">Active</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <textarea
                      value={getCurrentValue(system.name, 'description') || ''}
                      onChange={(e) => handleSettingChange(system.name, 'description', e.target.value)}
                      rows={2}
                      className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                      placeholder="Optional description for this setting..."
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="mt-4 flex justify-end space-x-3">
                    {hasUnsavedChanges && (
                      <button
                        onClick={() => resetSetting(system.name)}
                        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                      >
                        Reset
                      </button>
                    )}
                    <button
                      onClick={() => saveSetting(system.name)}
                      disabled={saving || !hasUnsavedChanges}
                      className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>
                  </div>

                  {/* Current Values Display */}
                  {currentSetting && (
                    <div className="mt-4 pt-4 border-t border-gray-200">
                      <h5 className="text-sm font-medium text-gray-700 mb-2">Current Active Settings</h5>
                      <div className="text-sm text-gray-600 space-y-1">
                        <p>Threshold: {currentSetting.batch_trigger_threshold} items</p>
                        <p>Status: {currentSetting.is_active ? 'Active' : 'Inactive'}</p>
                        <p>Last Updated: {new Date(currentSetting.updated_at).toLocaleString()}</p>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchProcessingSettings;