/**
 * Analytics Dashboard Service - Phase 3: Advanced Features
 * Integrates predictive analytics, optimization engine, and A/B testing
 *
 * This service provides the API layer for the advanced analytics dashboard,
 * combining all Phase 1-3 features into a unified interface.
 */

import supabase from '../config/supabase.js';
import advancedAnalyticsLogger from '../utils/advanced-analytics-logger.js';
import predictiveAnalytics from '../utils/predictive-analytics.js';
import optimizationEngine from '../utils/optimization-engine.js';
import abTestingFramework from '../utils/ab-testing-framework.js';

/**
 * @typedef {Object} DashboardMetrics
 * @property {Object} realTime - Real-time metrics
 * @property {Object} predictions - Predictive analytics
 * @property {Array} alerts - Active alerts
 * @property {Array} recommendations - Optimization recommendations
 * @property {Array} activeTests - Active A/B tests
 * @property {Object} performance - Performance metrics
 */

class AnalyticsDashboardService {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get comprehensive dashboard data for a client
   * @param {string} clientId - Client identifier
   * @param {Object} options - Query options
   * @returns {Promise<DashboardMetrics>} Complete dashboard data
   */
  async getDashboardData(clientId, options = {}) {
    const { includePredictions = true, includeAlerts = true, includeTests = true } = options;

    try {
      const [
        realTimeMetrics,
        predictions,
        alerts,
        recommendations,
        activeTests,
        performanceMetrics
      ] = await Promise.all([
        this.getRealTimeMetrics(clientId),
        includePredictions ? this.getPredictions(clientId) : Promise.resolve({}),
        includeAlerts ? this.getAlerts(clientId) : Promise.resolve([]),
        this.getRecommendations(clientId),
        includeTests ? this.getActiveTests(clientId) : Promise.resolve([]),
        this.getPerformanceMetrics(clientId, options)
      ]);

      return {
        realTime: realTimeMetrics,
        predictions,
        alerts,
        recommendations,
        activeTests,
        performance: performanceMetrics,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error(`[AnalyticsDashboard] Error getting dashboard data for ${clientId}:`, error);
      throw error;
    }
  }

  /**
   * Get client analytics data (alias for getDashboardData)
   * @param {string} clientId - Client identifier
   * @returns {Promise<DashboardMetrics>} Client analytics data
   */
  async getClientAnalytics(clientId) {
    return this.getDashboardData(clientId);
  }

  /**
   * Get dashboard summary for admin view
   * @returns {Promise<Object>} Dashboard summary
   */
  async getDashboardSummary() {
    try {
      // Get all clients
      const { data: clients, error } = await supabase
        .from('clients')
        .select('client_id, client_name');

      if (error) {
        console.error('[AnalyticsDashboard] Error fetching clients:', error);
        return { error: 'Failed to fetch clients' };
      }

      // Get summary metrics for all clients
      const clientSummaries = [];
      for (const client of clients) {
        try {
          const metrics = await this.getRealTimeMetrics(client.client_id);
          clientSummaries.push({
            clientId: client.client_id,
            clientName: client.client_name,
            totalRequests: metrics.totalRequests || 0,
            totalCost: metrics.totalCost || 0,
            avgResponseTime: metrics.avgResponseTime || 0,
            activeUsers: metrics.activeUsers || 0
          });
        } catch (err) {
          console.warn(`[AnalyticsDashboard] Error getting metrics for ${client.client_id}:`, err.message);
          clientSummaries.push({
            clientId: client.client_id,
            clientName: client.client_name,
            totalRequests: 0,
            totalCost: 0,
            avgResponseTime: 0,
            activeUsers: 0
          });
        }
      }

      return {
        totalClients: clients.length,
        clientSummaries,
        generatedAt: new Date().toISOString()
      };

    } catch (error) {
      console.error('[AnalyticsDashboard] Error getting dashboard summary:', error);
      return { error: 'Failed to generate dashboard summary' };
    }
  }

  /**
   * Get streaming data for real-time updates
   * @param {string} clientId - Client identifier
   * @returns {Object} Streaming data object with cleanup function
   */
  getStreamingData(clientId) {
    let intervalId = null;
    let isActive = true;

    const cleanup = () => {
      isActive = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    // Start background updates
    intervalId = setInterval(async () => {
      if (!isActive) return;

      try {
        // Update cache with fresh data
        const freshMetrics = await this.getRealTimeMetrics(clientId);
        this.setCached(`realtime_${clientId}`, freshMetrics);
      } catch (error) {
        console.error(`[AnalyticsDashboard] Error updating streaming data for ${clientId}:`, error);
      }
    }, 30000); // Update every 30 seconds

    return {
      data: this.getCached(`realtime_${clientId}`) || {},
      cleanup
    };
  }

  /**
   * Get real-time metrics for dashboard
   * @param {string} clientId - Client identifier
   * @returns {Promise<Object>} Real-time metrics
   */
  async getRealTimeMetrics(clientId) {
    const cacheKey = `realtime_${clientId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const metrics = advancedAnalyticsLogger.getClientRealTimeMetrics(clientId);

    // Enhance with additional real-time data
    const enhancedMetrics = {
      ...metrics,
      lastUpdated: new Date().toISOString(),
      activeUsers: await this.getActiveUsersCount(clientId),
      queueDepth: await this.getQueueDepth(clientId),
      errorRate: await this.getCurrentErrorRate(clientId)
    };

    this.setCached(cacheKey, enhancedMetrics);
    return enhancedMetrics;
  }

  /**
   * Get predictive analytics data
   * @param {string} clientId - Client identifier
   * @returns {Promise<Object>} Predictions data
   */
  async getPredictions(clientId) {
    const cacheKey = `predictions_${clientId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    try {
      const [
        usageForecast,
        costOptimization,
        modelPredictions
      ] = await Promise.all([
        predictiveAnalytics.generateUsageForecast(clientId, { timeRange: '30d' }),
        predictiveAnalytics.generateCostOptimization(clientId, {}),
        predictiveAnalytics.predictModelPerformance(clientId, ['gpt-4o-mini', 'gpt-3.5-turbo', 'gpt-4o'])
      ]);

      const predictions = {
        usageForecast,
        costOptimization,
        modelPredictions,
        generatedAt: new Date().toISOString()
      };

      this.setCached(cacheKey, predictions);
      return predictions;

    } catch (error) {
      console.error(`[AnalyticsDashboard] Error getting predictions for ${clientId}:`, error);
      return {
        usageForecast: null,
        costOptimization: null,
        modelPredictions: [],
        error: error.message
      };
    }
  }

  /**
   * Get active alerts
   * @param {string} clientId - Client identifier
   * @returns {Promise<Array>} Active alerts
   */
  async getAlerts(clientId) {
    const cacheKey = `alerts_${clientId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const alerts = await optimizationEngine.getActiveAlerts(clientId, { limit: 10 });
    this.setCached(cacheKey, alerts);
    return alerts;
  }

  /**
   * Get optimization recommendations
   * @param {string} clientId - Client identifier
   * @returns {Promise<Array>} Recommendations
   */
  async getRecommendations(clientId) {
    const cacheKey = `recommendations_${clientId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const recommendations = await optimizationEngine.getRecommendations(clientId, { limit: 5 });
    this.setCached(cacheKey, recommendations);
    return recommendations;
  }

  /**
   * Get active A/B tests
   * @param {string} clientId - Client identifier
   * @returns {Promise<Array>} Active tests
   */
  async getActiveTests(clientId) {
    const cacheKey = `tests_${clientId}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const tests = await abTestingFramework.getClientTests(clientId, { status: 'running' });
    this.setCached(cacheKey, tests);
    return tests;
  }

  /**
   * Get performance metrics with historical trends
   * @param {string} clientId - Client identifier
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Performance metrics
   */
  async getPerformanceMetrics(clientId, options = {}) {
    const { startDate, endDate, model } = options;

    const cacheKey = `performance_${clientId}_${startDate || 'default'}_${endDate || 'default'}_${model || 'all'}`;
    const cached = this.getCached(cacheKey);
    if (cached) return cached;

    const metrics = await advancedAnalyticsLogger.calculatePerformanceMetrics(clientId, {
      startDate,
      endDate,
      model
    });

    // Add trend analysis
    if (metrics && metrics.performanceTrends) {
      metrics.trends = this.analyzeTrends(metrics.performanceTrends);
    }

    this.setCached(cacheKey, metrics);
    return metrics;
  }

  /**
   * Create an A/B test
   * @param {Object} testConfig - Test configuration
   * @returns {Promise<Object>} Created test
   */
  async createABTest(testConfig) {
    this.invalidateCache(`tests_${testConfig.clientId}`);
    return await abTestingFramework.createTest(testConfig);
  }

  /**
   * Start an A/B test
   * @param {string} testId - Test ID
   * @returns {Promise<boolean>} Success status
   */
  async startABTest(testId) {
    const success = await abTestingFramework.startTest(testId);
    if (success) {
      // Invalidate related caches
      const test = await abTestingFramework.getTest(testId);
      if (test) {
        this.invalidateCache(`tests_${test.clientId}`);
      }
    }
    return success;
  }

  /**
   * Stop an A/B test
   * @param {string} testId - Test ID
   * @param {string} reason - Stop reason
   * @returns {Promise<boolean>} Success status
   */
  async stopABTest(testId, reason) {
    const success = await abTestingFramework.stopTest(testId, reason);
    if (success) {
      // Invalidate related caches
      const test = await abTestingFramework.getTest(testId);
      if (test) {
        this.invalidateCache(`tests_${test.clientId}`);
      }
    }
    return success;
  }

  /**
   * Acknowledge an alert
   * @param {string} alertId - Alert ID
   * @param {string} userId - User ID acknowledging
   * @returns {Promise<boolean>} Success status
   */
  async acknowledgeAlert(alertId, userId) {
    const success = await optimizationEngine.acknowledgeAlert(alertId, userId);
    if (success) {
      // Invalidate alerts cache for the client
      // We would need to get client ID from alert, but for now invalidate all
      this.invalidateCachePattern(/^alerts_/);
    }
    return success;
  }

  /**
   * Get model selection recommendations
   * @param {string} clientId - Client identifier
   * @param {Object} queryCharacteristics - Query characteristics
   * @returns {Promise<Object>} Recommendations
   */
  async getModelRecommendations(clientId, queryCharacteristics) {
    return await predictiveAnalytics.getModelSelectionRecommendations(clientId, queryCharacteristics);
  }

  /**
   * Assign user to A/B test variant
   * @param {string} clientId - Client identifier
   * @param {string} userId - User identifier
   * @param {string} testId - Test ID (optional)
   * @returns {Promise<string|null>} Assigned variant
   */
  async assignUserToTest(clientId, userId, testId = null) {
    return await abTestingFramework.assignUserToVariant(clientId, userId, testId);
  }

  /**
   * Record metric for A/B testing
   * @param {string} testId - Test ID
   * @param {string} userId - User ID
   * @param {string} variant - Variant
   * @param {string} metricName - Metric name
   * @param {number} value - Metric value
   * @param {Object} metadata - Metadata
   */
  async recordTestMetric(testId, userId, variant, metricName, value, metadata = {}) {
    await abTestingFramework.recordMetric(testId, userId, variant, metricName, value, metadata);
  }

  /**
   * Get client comparison data
   * @param {Array<string>} clientIds - Client IDs to compare
   * @param {Object} options - Query options
   * @returns {Promise<Object>} Comparison data
   */
  async getClientComparison(clientIds, options = {}) {
    const { startDate, endDate } = options;

    const comparisonData = {};
    for (const clientId of clientIds) {
      comparisonData[clientId] = await this.getPerformanceMetrics(clientId, { startDate, endDate });
    }

    return comparisonData;
  }

  /**
   * Export dashboard data for reporting
   * @param {string} clientId - Client identifier
   * @param {Object} options - Export options
   * @returns {Promise<Object>} Export data
   */
  async exportDashboardData(clientId, options = {}) {
    const { format = 'json', includeHistorical = false, dateRange } = options;

    const dashboardData = await this.getDashboardData(clientId, {
      includePredictions: true,
      includeAlerts: true,
      includeTests: true
    });

    if (includeHistorical) {
      dashboardData.historical = await this.getHistoricalData(clientId, dateRange);
    }

    // Format the data
    switch (format) {
      case 'csv':
        return this.formatAsCSV(dashboardData);
      case 'json':
      default:
        return dashboardData;
    }
  }

  // Private helper methods

  async getActiveUsersCount(clientId) {
    // Simplified implementation - count recent sessions
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('chat_message_analytics')
      .select('visitor_id')
      .eq('client_id', clientId)
      .gte('created_at', oneHourAgo.toISOString());

    if (error) return 0;

    const uniqueVisitors = new Set(data.map(record => record.visitor_id));
    return uniqueVisitors.size;
  }

  async getQueueDepth(clientId) {
    // Placeholder - would integrate with actual queue system
    return 0;
  }

  async getCurrentErrorRate(clientId) {
    // Simplified error rate calculation
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('chat_message_analytics')
      .select('response_time_ms')
      .eq('client_id', clientId)
      .gte('created_at', oneHourAgo.toISOString());

    if (error || !data || data.length === 0) return 0;

    const errors = data.filter(record => (record.response_time_ms || 0) > 30000).length;
    return errors / data.length;
  }

  analyzeTrends(performanceTrends) {
    if (!performanceTrends || performanceTrends.length < 2) {
      return { trend: 'insufficient_data', changePercent: 0 };
    }

    const sortedTrends = performanceTrends.sort((a, b) => a.hour - b.hour);
    const firstHalf = sortedTrends.slice(0, Math.floor(sortedTrends.length / 2));
    const secondHalf = sortedTrends.slice(Math.floor(sortedTrends.length / 2));

    const firstAvg = firstHalf.reduce((sum, t) => sum + t.avgResponseTime, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, t) => sum + t.avgResponseTime, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    let trend;
    if (Math.abs(changePercent) < 5) trend = 'stable';
    else if (changePercent > 0) trend = 'increasing';
    else trend = 'decreasing';

    return { trend, changePercent: Math.round(changePercent * 100) / 100 };
  }

  async getHistoricalData(clientId, dateRange) {
    const { startDate, endDate } = dateRange || {};
    const options = {};
    if (startDate) options.startDate = startDate;
    if (endDate) options.endDate = endDate;

    return await advancedAnalyticsLogger.calculatePerformanceMetrics(clientId, options);
  }

  formatAsCSV(data) {
    // Simplified CSV formatting
    const rows = [];

    // Add headers
    rows.push(['Metric', 'Value', 'Timestamp']);

    // Add real-time metrics
    if (data.realTime) {
      rows.push(['Total Requests', data.realTime.totalRequests, data.generatedAt]);
      rows.push(['Total Cost', data.realTime.totalCost, data.generatedAt]);
      rows.push(['Avg Response Time', data.realTime.avgResponseTime, data.generatedAt]);
    }

    return rows.map(row => row.join(',')).join('\n');
  }

  getCached(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  setCached(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  invalidateCache(key) {
    this.cache.delete(key);
  }

  invalidateCachePattern(pattern) {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clean up old cache entries
   */
  cleanupCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp > this.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Stop the dashboard service and clean up resources
   */
  stop() {
    // Clean up cache
    this.cache.clear();

    // Stop dependent services
    advancedAnalyticsLogger.stop();
    optimizationEngine.stop();
    abTestingFramework.stop();

    console.log('[AnalyticsDashboard] Dashboard service stopped');
  }
}

export default new AnalyticsDashboardService();