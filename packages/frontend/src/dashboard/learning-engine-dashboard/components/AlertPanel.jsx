// packages/frontend/src/dashboard/learning-engine-dashboard/components/AlertPanel.jsx
// Intelligent alert panel component for displaying learning engine issues and actionable recommendations
// Provides priority-based alerts with direct action buttons for system optimization
// LearningEngineDashboard.jsx, LearningMetricsOverview.jsx, apiClient.js
import React from 'react';

const AlertPanel = ({ metrics, onRetraining }) => {
  const alerts = [];

  // Signal quality alerts
  if (metrics?.signalQuality < 0.8) {
    alerts.push({
      type: 'error',
      title: 'Low Signal Quality',
      message: `Signal quality is ${(metrics.signalQuality * 100).toFixed(1)}%. Learning effectiveness may be reduced.`,
      action: 'Check data collection and signal validation logic.',
      priority: 'high'
    });
  }

  // Policy confidence alerts
  if (metrics?.policyConfidence < 0.7) {
    alerts.push({
      type: 'warning',
      title: 'Low Policy Confidence',
      message: `Average policy confidence is ${(metrics.policyConfidence * 100).toFixed(1)}%. Consider retraining.`,
      action: 'Trigger manual retraining to improve policy reliability.',
      actionButton: 'Retrain Now',
      onAction: onRetraining,
      priority: 'medium'
    });
  }

  // Exploration imbalance alerts
  if (metrics?.explorationRate < 0.05) {
    alerts.push({
      type: 'warning',
      title: 'Low Exploration Rate',
      message: 'Exploration rate is very low. New models may not be discovered adequately.',
      action: 'Consider increasing exploration rate to improve model discovery.',
      priority: 'medium'
    });
  }

  // Performance degradation alerts
  if (metrics?.performanceImprovement < 5) {
    alerts.push({
      type: 'warning',
      title: 'Slow Learning Progress',
      message: `Performance improvement is only ${metrics.performanceImprovement}%. Learning may be too slow.`,
      action: 'Consider increasing adaptation rate or triggering retraining.',
      priority: 'medium'
    });
  }

  // Retraining overdue alerts
  const lastRetraining = metrics?.lastRetraining ? new Date(metrics.lastRetraining) : null;
  const daysSinceRetraining = lastRetraining
    ? (Date.now() - lastRetraining.getTime()) / (1000 * 60 * 60 * 24)
    : Infinity;

  if (daysSinceRetraining > 7) {
    alerts.push({
      type: 'info',
      title: 'Retraining Overdue',
      message: `Last retraining was ${Math.floor(daysSinceRetraining)} days ago. Consider updating policies.`,
      action: 'Schedule regular retraining to maintain optimal performance.',
      priority: 'low'
    });
  }

  // Sort alerts by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  alerts.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  if (alerts.length === 0) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">All Systems Normal</h3>
            <div className="mt-2 text-sm text-green-700">
              Learning engine is operating optimally with no critical issues detected.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mb-6">
      {alerts.map((alert, index) => {
        const getAlertStyles = (type) => {
          switch (type) {
            case 'error':
              return {
                bg: 'bg-red-50',
                border: 'border-red-200',
                icon: 'text-red-400',
                title: 'text-red-800',
                message: 'text-red-700',
                button: 'bg-red-100 hover:bg-red-200 text-red-800'
              };
            case 'warning':
              return {
                bg: 'bg-yellow-50',
                border: 'border-yellow-200',
                icon: 'text-yellow-400',
                title: 'text-yellow-800',
                message: 'text-yellow-700',
                button: 'bg-yellow-100 hover:bg-yellow-200 text-yellow-800'
              };
            case 'info':
              return {
                bg: 'bg-blue-50',
                border: 'border-blue-200',
                icon: 'text-blue-400',
                title: 'text-blue-800',
                message: 'text-blue-700',
                button: 'bg-blue-100 hover:bg-blue-200 text-blue-800'
              };
            default:
              return {
                bg: 'bg-gray-50',
                border: 'border-gray-200',
                icon: 'text-gray-400',
                title: 'text-gray-800',
                message: 'text-gray-700',
                button: 'bg-gray-100 hover:bg-gray-200 text-gray-800'
              };
          }
        };

        const styles = getAlertStyles(alert.type);

        return (
          <div key={index} className={`${styles.bg} border ${styles.border} rounded-lg p-4`}>
            <div className="flex">
              <div className="flex-shrink-0">
                {alert.type === 'error' && (
                  <svg className={`h-5 w-5 ${styles.icon}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                {alert.type === 'warning' && (
                  <svg className={`h-5 w-5 ${styles.icon}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                {alert.type === 'info' && (
                  <svg className={`h-5 w-5 ${styles.icon}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div className="ml-3 flex-1">
                <h3 className={`text-sm font-medium ${styles.title}`}>{alert.title}</h3>
                <div className={`mt-2 text-sm ${styles.message}`}>
                  <p>{alert.message}</p>
                  {alert.action && (
                    <p className="mt-1 font-medium">{alert.action}</p>
                  )}
                </div>
                {alert.actionButton && alert.onAction && (
                  <div className="mt-4">
                    <div className="-mx-2 -my-1.5 flex">
                      <button
                        onClick={alert.onAction}
                        className={`px-3 py-2 rounded-md text-sm font-medium ${styles.button}`}
                      >
                        {alert.actionButton}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AlertPanel;