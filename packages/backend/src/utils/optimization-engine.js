/**
 * Optimization Engine for Client-Specific LLM Analytics Dashboard
 * Provides real-time optimization recommendations and automated alerts
 *
 * This engine builds upon the predictive analytics foundation to provide
 * actionable optimization strategies and proactive monitoring.
 */

import { EventEmitter } from 'events';
import supabase from '../config/supabase.js';
import predictiveAnalytics from './predictive-analytics.js';
import advancedAnalyticsLogger from './advanced-analytics-logger.js';

/**
 * @typedef {Object} OptimizationRecommendation
 * @property {string} id - Unique recommendation ID
 * @property {string} type - Recommendation type (cost_optimization, performance_improvement, etc.)
 * @property {string} priority - Priority level (high, medium, low)
 * @property {string} title - Human-readable title
 * @property {string} description - Detailed description
 * @property {Object} impact - Expected impact metrics
 * @property {number} impact.costSavings - Expected cost savings
 * @property {number} impact.performanceGain - Expected performance improvement
 * @property {Array<string>} actions - Recommended actions
 * @property {Object} metadata - Additional metadata
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} expiresAt - Expiration timestamp
 */

/**
 * @typedef {Object} AutomatedAlert
 * @property {string} id - Unique alert ID
 * @property {string} type - Alert type (performance_degradation, cost_anomaly, etc.)
 * @property {string} severity - Alert severity (critical, warning, info)
 * @property {string} title - Alert title
 * @property {string} message - Alert message
 * @property {Object} metrics - Related metrics
 * @property {Array<string>} recommendations - Suggested actions
 * @property {boolean} acknowledged - Whether alert has been acknowledged
 * @property {Date} createdAt - Creation timestamp
 * @property {Date} acknowledgedAt - Acknowledgement timestamp
 */

class OptimizationEngine extends EventEmitter {
  constructor() {
    super();
    this.enabled = String(process.env.OPTIMIZATION_ENGINE_ENABLED || 'true') === 'true';
    this.alertThresholds = this.loadAlertThresholds();
    this.recommendationCache = new Map();
    this.alertCooldownMs = parseInt(process.env.ALERT_COOLDOWN_MS || '3600000'); // 1 hour
    this.lastAlerts = new Map(); // Track last alert time per client/type

    if (this.enabled) {
      this.startOptimizationMonitoring();
    }
  }

  /**
   * Load alert thresholds from environment or defaults
   * @returns {Object} Alert threshold configuration
   */
  loadAlertThresholds() {
    return {
      costAnomaly: {
        threshold: parseFloat(process.env.COST_ANOMALY_THRESHOLD || '0.5'), // 50% increase
        severity: 'warning'
      },
      performanceDegradation: {
        threshold: parseFloat(process.env.PERFORMANCE_DEGRADATION_THRESHOLD || '0.3'), // 30% slower
        severity: 'warning'
      },
      highErrorRate: {
        threshold: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.1'), // 10% error rate
        severity: 'critical'
      },
      usageSpike: {
        threshold: parseFloat(process.env.USAGE_SPIKE_THRESHOLD || '2.0'), // 2x normal usage
        severity: 'info'
      }
    };
  }

  /**
   * Start real-time optimization monitoring
   */
  startOptimizationMonitoring() {
    console.log('[OptimizationEngine] Starting real-time optimization monitoring');

    // Monitor every 15 minutes
    setInterval(async () => {
      try {
        await this.performOptimizationCheck();
      } catch (error) {
        console.error('[OptimizationEngine] Error in optimization monitoring:', error);
      }
    }, 15 * 60 * 1000);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('[OptimizationEngine] Optimization monitoring stopped');
    });
  }

  /**
   * Perform comprehensive optimization check for all active clients
   */
  async performOptimizationCheck() {
    try {
      // Get active clients from recent analytics
      const activeClients = await this.getActiveClients();

      for (const clientId of activeClients) {
        try {
          await this.checkClientOptimizations(clientId);
        } catch (error) {
          console.error(`[OptimizationEngine] Error checking optimizations for ${clientId}:`, error);
        }
      }
    } catch (error) {
      console.error('[OptimizationEngine] Error in optimization check:', error);
    }
  }

  /**
   * Check optimizations for a specific client
   * @param {string} clientId - Client identifier
   */
  async checkClientOptimizations(clientId) {
    const currentMetrics = advancedAnalyticsLogger.getClientRealTimeMetrics(clientId);

    if (!currentMetrics || currentMetrics.totalRequests === 0) {
      return; // No data to analyze
    }

    // Check for alerts
    await this.checkForAlerts(clientId, currentMetrics);

    // Generate recommendations
    await this.generateRecommendations(clientId, currentMetrics);

    // Update optimization metrics
    await this.updateOptimizationMetrics(clientId, currentMetrics);
  }

  /**
   * Check for automated alerts based on current metrics
   * @param {string} clientId - Client identifier
   * @param {Object} currentMetrics - Current metrics
   */
  async checkForAlerts(clientId, currentMetrics) {
    const alerts = [];

    // Cost anomaly detection
    const costAnomaly = await this.detectCostAnomaly(clientId, currentMetrics);
    if (costAnomaly) alerts.push(costAnomaly);

    // Performance degradation detection
    const performanceAlert = await this.detectPerformanceDegradation(clientId, currentMetrics);
    if (performanceAlert) alerts.push(performanceAlert);

    // High error rate detection
    const errorAlert = await this.detectHighErrorRate(clientId, currentMetrics);
    if (errorAlert) alerts.push(errorAlert);

    // Usage spike detection
    const usageAlert = await this.detectUsageSpike(clientId, currentMetrics);
    if (usageAlert) alerts.push(usageAlert);

    // Process alerts
    for (const alert of alerts) {
      await this.processAlert(clientId, alert);
    }
  }

  /**
   * Detect cost anomalies
   * @param {string} clientId - Client identifier
   * @param {Object} currentMetrics - Current metrics
   * @returns {AutomatedAlert|null} Alert if anomaly detected
   */
  async detectCostAnomaly(clientId, currentMetrics) {
    const historicalAvg = await this.getHistoricalAverageCost(clientId);

    if (!historicalAvg || historicalAvg === 0) return null;

    const currentCostPerRequest = currentMetrics.totalCost / currentMetrics.totalRequests;
    const costIncrease = (currentCostPerRequest - historicalAvg) / historicalAvg;

    if (costIncrease > this.alertThresholds.costAnomaly.threshold) {
      return {
        type: 'cost_anomaly',
        severity: this.alertThresholds.costAnomaly.severity,
        title: 'Cost Anomaly Detected',
        message: `Cost per request increased by ${(costIncrease * 100).toFixed(1)}% compared to historical average`,
        metrics: {
          currentCostPerRequest: Math.round(currentCostPerRequest * 100) / 100,
          historicalAverage: Math.round(historicalAvg * 100) / 100,
          increase: Math.round(costIncrease * 100) / 100
        },
        recommendations: [
          'Review model selection strategy',
          'Consider cost optimization recommendations',
          'Check for unusual query patterns'
        ]
      };
    }

    return null;
  }

  /**
   * Detect performance degradation
   * @param {string} clientId - Client identifier
   * @param {Object} currentMetrics - Current metrics
   * @returns {AutomatedAlert|null} Alert if degradation detected
   */
  async detectPerformanceDegradation(clientId, currentMetrics) {
    const historicalAvg = await this.getHistoricalAverageResponseTime(clientId);

    if (!historicalAvg || historicalAvg === 0) return null;

    const currentAvgTime = currentMetrics.avgResponseTime;
    const degradation = (currentAvgTime - historicalAvg) / historicalAvg;

    if (degradation > this.alertThresholds.performanceDegradation.threshold) {
      return {
        type: 'performance_degradation',
        severity: this.alertThresholds.performanceDegradation.severity,
        title: 'Performance Degradation Detected',
        message: `Average response time increased by ${(degradation * 100).toFixed(1)}% compared to historical average`,
        metrics: {
          currentAvgTime: Math.round(currentAvgTime),
          historicalAverage: Math.round(historicalAvg),
          degradation: Math.round(degradation * 100) / 100
        },
        recommendations: [
          'Consider switching to faster models',
          'Review query complexity',
          'Check system resource utilization'
        ]
      };
    }

    return null;
  }

  /**
   * Detect high error rates
   * @param {string} clientId - Client identifier
   * @param {Object} currentMetrics - Current metrics
   * @returns {AutomatedAlert|null} Alert if high error rate detected
   */
  async detectHighErrorRate(clientId, currentMetrics) {
    // This would require error tracking in the analytics
    // For now, using a simplified approach
    const errorRate = await this.getCurrentErrorRate(clientId);

    if (errorRate > this.alertThresholds.highErrorRate.threshold) {
      return {
        type: 'high_error_rate',
        severity: this.alertThresholds.highErrorRate.severity,
        title: 'High Error Rate Detected',
        message: `Error rate of ${(errorRate * 100).toFixed(1)}% exceeds threshold`,
        metrics: { errorRate: Math.round(errorRate * 100) / 100 },
        recommendations: [
          'Investigate recent changes',
          'Check model availability',
          'Review error logs'
        ]
      };
    }

    return null;
  }

  /**
   * Detect usage spikes
   * @param {string} clientId - Client identifier
   * @param {Object} currentMetrics - Current metrics
   * @returns {AutomatedAlert|null} Alert if usage spike detected
   */
  async detectUsageSpike(clientId, currentMetrics) {
    const historicalAvgRequests = await this.getHistoricalAverageRequests(clientId);

    if (!historicalAvgRequests || historicalAvgRequests === 0) return null;

    const currentRequests = currentMetrics.totalRequests;
    const spikeRatio = currentRequests / historicalAvgRequests;

    if (spikeRatio > this.alertThresholds.usageSpike.threshold) {
      return {
        type: 'usage_spike',
        severity: this.alertThresholds.usageSpike.severity,
        title: 'Usage Spike Detected',
        message: `Request volume is ${spikeRatio.toFixed(1)}x higher than historical average`,
        metrics: {
          currentRequests,
          historicalAverage: Math.round(historicalAvgRequests),
          spikeRatio: Math.round(spikeRatio * 10) / 10
        },
        recommendations: [
          'Monitor system capacity',
          'Consider scaling resources',
          'Review usage patterns'
        ]
      };
    }

    return null;
  }

  /**
   * Process and store an alert
   * @param {string} clientId - Client identifier
   * @param {AutomatedAlert} alert - Alert to process
   */
  async processAlert(clientId, alert) {
    const alertKey = `${clientId}:${alert.type}`;

    // Check cooldown period
    const lastAlertTime = this.lastAlerts.get(alertKey);
    if (lastAlertTime && Date.now() - lastAlertTime < this.alertCooldownMs) {
      return; // Still in cooldown
    }

    // Create full alert object
    const fullAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      client_id: clientId,
      ...alert,
      acknowledged: false,
      created_at: new Date().toISOString()
    };

    // Store alert
    const { error } = await supabase
      .from('optimization_alerts')
      .insert(fullAlert);

    if (error) {
      console.error('[OptimizationEngine] Failed to store alert:', error);
      return;
    }

    // Update cooldown
    this.lastAlerts.set(alertKey, Date.now());

    // Emit event for real-time notifications
    this.emit('alertGenerated', { clientId, alert: fullAlert });

    console.log(`[OptimizationEngine] ✅ Generated ${alert.severity} alert for ${clientId}: ${alert.title}`);
  }

  /**
   * Generate optimization recommendations for a client
   * @param {string} clientId - Client identifier
   * @param {Object} currentMetrics - Current metrics
   */
  async generateRecommendations(clientId, currentMetrics) {
    const recommendations = [];

    // Cost optimization recommendations
    const costOptimization = await predictiveAnalytics.generateCostOptimization(clientId, currentMetrics);
    if (costOptimization.projectedSavings > 10) {
      recommendations.push({
        id: `rec_cost_${Date.now()}`,
        type: 'cost_optimization',
        priority: costOptimization.implementationPriority,
        title: 'Cost Optimization Opportunity',
        description: `Potential savings of €${costOptimization.projectedSavings.toFixed(2)} per month through model optimization`,
        impact: {
          costSavings: costOptimization.projectedSavings,
          performanceGain: 0
        },
        actions: [
          'Review optimal model distribution',
          'Implement recommended model allocation',
          'Monitor cost reduction progress'
        ],
        metadata: { optimalDistribution: costOptimization.optimalModelDistribution },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days
      });
    }

    // Performance optimization recommendations
    const performancePredictions = await predictiveAnalytics.predictModelPerformance(
      clientId, ['gpt-4o-mini', 'gpt-3.5-turbo']
    );

    const bestPerformance = performancePredictions.sort((a, b) =>
      a.predictedResponseTime - b.predictedResponseTime
    )[0];

    if (bestPerformance && bestPerformance.predictedResponseTime < currentMetrics.avgResponseTime * 0.8) {
      recommendations.push({
        id: `rec_perf_${Date.now()}`,
        type: 'performance_improvement',
        priority: 'medium',
        title: 'Performance Optimization Available',
        description: `Switching to ${bestPerformance.model} could reduce response time by ${Math.round((1 - bestPerformance.predictedResponseTime / currentMetrics.avgResponseTime) * 100)}%`,
        impact: {
          costSavings: 0,
          performanceGain: Math.round((currentMetrics.avgResponseTime - bestPerformance.predictedResponseTime) / currentMetrics.avgResponseTime * 100)
        },
        actions: [
          `Consider switching to ${bestPerformance.model} for faster responses`,
          'Evaluate impact on response quality',
          'Test with sample queries'
        ],
        metadata: { recommendedModel: bestPerformance.model },
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) // 14 days
      });
    }

    // Store recommendations
    for (const recommendation of recommendations) {
      await this.storeRecommendation(clientId, recommendation);
    }
  }

  /**
   * Store a recommendation in the database
   * @param {string} clientId - Client identifier
   * @param {OptimizationRecommendation} recommendation - Recommendation to store
   */
  async storeRecommendation(clientId, recommendation) {
    const recData = {
      client_id: clientId,
      ...recommendation,
      impact: JSON.stringify(recommendation.impact),
      actions: JSON.stringify(recommendation.actions),
      metadata: JSON.stringify(recommendation.metadata),
      created_at: recommendation.createdAt.toISOString(),
      expires_at: recommendation.expiresAt.toISOString()
    };

    const { error } = await supabase
      .from('optimization_recommendations')
      .insert(recData);

    if (error) {
      console.error('[OptimizationEngine] Failed to store recommendation:', error);
    } else {
      console.log(`[OptimizationEngine] ✅ Stored ${recommendation.priority} priority recommendation for ${clientId}`);
    }
  }

  /**
   * Get active clients from recent analytics
   * @returns {Array<string>} Array of active client IDs
   */
  async getActiveClients() {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('chat_message_analytics')
      .select('client_id')
      .gte('created_at', oneDayAgo.toISOString())
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OptimizationEngine] Error fetching active clients:', error);
      return [];
    }

    // Get unique client IDs
    const uniqueClients = [...new Set(data.map(record => record.client_id))];
    return uniqueClients;
  }

  /**
   * Get historical average cost for a client
   * @param {string} clientId - Client identifier
   * @returns {number} Historical average cost per request
   */
  async getHistoricalAverageCost(clientId) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('chat_message_analytics')
      .select('actual_cost')
      .eq('client_id', clientId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .not('actual_cost', 'is', null);

    if (error || !data || data.length === 0) return 0;

    const totalCost = data.reduce((sum, record) => sum + (record.actual_cost || 0), 0);
    return totalCost / data.length;
  }

  /**
   * Get historical average response time for a client
   * @param {string} clientId - Client identifier
   * @returns {number} Historical average response time
   */
  async getHistoricalAverageResponseTime(clientId) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('chat_message_analytics')
      .select('response_time_ms')
      .eq('client_id', clientId)
      .gte('created_at', sevenDaysAgo.toISOString())
      .not('response_time_ms', 'is', null);

    if (error || !data || data.length === 0) return 0;

    const totalTime = data.reduce((sum, record) => sum + (record.response_time_ms || 0), 0);
    return totalTime / data.length;
  }

  /**
   * Get current error rate for a client
   * @param {string} clientId - Client identifier
   * @returns {number} Current error rate (0-1)
   */
  async getCurrentErrorRate(clientId) {
    // This is a simplified implementation
    // In a real system, you'd track errors separately
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('chat_message_analytics')
      .select('response_time_ms')
      .eq('client_id', clientId)
      .gte('created_at', oneHourAgo.toISOString());

    if (error || !data || data.length === 0) return 0;

    // Simple heuristic: consider responses > 30s as errors
    const errors = data.filter(record => (record.response_time_ms || 0) > 30000).length;
    return errors / data.length;
  }

  /**
   * Get historical average requests for a client
   * @param {string} clientId - Client identifier
   * @returns {number} Historical average daily requests
   */
  async getHistoricalAverageRequests(clientId) {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const { data, error } = await supabase
      .from('chat_message_analytics')
      .select('created_at')
      .eq('client_id', clientId)
      .gte('created_at', sevenDaysAgo.toISOString());

    if (error || !data || data.length === 0) return 0;

    // Group by day and calculate daily averages
    const dailyCounts = data.reduce((acc, record) => {
      const day = new Date(record.created_at).toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

    const dailyTotals = Object.values(dailyCounts);
    return dailyTotals.reduce((sum, count) => sum + count, 0) / dailyTotals.length;
  }

  /**
   * Update optimization metrics for monitoring
   * @param {string} clientId - Client identifier
   * @param {Object} currentMetrics - Current metrics
   */
  async updateOptimizationMetrics(clientId, currentMetrics) {
    const metricsData = {
      client_id: clientId,
      timestamp: new Date().toISOString(),
      total_requests: currentMetrics.totalRequests,
      total_cost: currentMetrics.totalCost,
      avg_response_time: currentMetrics.avgResponseTime,
      active_alerts: await this.getActiveAlertCount(clientId),
      pending_recommendations: await this.getPendingRecommendationCount(clientId)
    };

    const { error } = await supabase
      .from('optimization_metrics')
      .insert(metricsData);

    if (error) {
      console.error('[OptimizationEngine] Failed to update optimization metrics:', error);
    }
  }

  /**
   * Get count of active alerts for a client
   * @param {string} clientId - Client identifier
   * @returns {number} Count of active alerts
   */
  async getActiveAlertCount(clientId) {
    const { data, error } = await supabase
      .from('optimization_alerts')
      .select('id')
      .eq('client_id', clientId)
      .eq('acknowledged', false);

    if (error) return 0;
    return data.length;
  }

  /**
   * Get count of pending recommendations for a client
   * @param {string} clientId - Client identifier
   * @returns {number} Count of pending recommendations
   */
  async getPendingRecommendationCount(clientId) {
    const { data, error } = await supabase
      .from('optimization_alerts')
      .select('id')
      .eq('client_id', clientId)
      .gt('expires_at', new Date().toISOString());

    if (error) return 0;
    return data.length;
  }

  /**
   * Get optimization recommendations for a client
   * @param {string} clientId - Client identifier
   * @param {Object} options - Query options
   * @returns {Array<OptimizationRecommendation>} Array of recommendations
   */
  async getRecommendations(clientId, options = {}) {
    const { type, priority, limit = 10 } = options;

    let query = supabase
      .from('optimization_recommendations')
      .select('*')
      .eq('client_id', clientId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (type) query = query.eq('type', type);
    if (priority) query = query.eq('priority', priority);

    const { data, error } = await query;

    if (error) {
      console.error('[OptimizationEngine] Error fetching recommendations:', error);
      return [];
    }

    return data.map(rec => ({
      ...rec,
      impact: JSON.parse(rec.impact || '{}'),
      actions: JSON.parse(rec.actions || '[]'),
      metadata: JSON.parse(rec.metadata || '{}'),
      createdAt: new Date(rec.created_at),
      expiresAt: new Date(rec.expires_at)
    }));
  }

  /**
   * Get active alerts for a client
   * @param {string} clientId - Client identifier
   * @param {Object} options - Query options
   * @returns {Array<AutomatedAlert>} Array of active alerts
   */
  async getActiveAlerts(clientId, options = {}) {
    const { severity, type, limit = 20 } = options;

    let query = supabase
      .from('optimization_alerts')
      .select('*')
      .eq('client_id', clientId)
      .eq('acknowledged', false)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (severity) query = query.eq('severity', severity);
    if (type) query = query.eq('type', type);

    const { data, error } = await query;

    if (error) {
      console.error('[OptimizationEngine] Error fetching alerts:', error);
      return [];
    }

    return data.map(alert => ({
      ...alert,
      metrics: JSON.parse(alert.metrics || '{}'),
      recommendations: JSON.parse(alert.recommendations || '[]'),
      createdAt: new Date(alert.created_at),
      acknowledgedAt: alert.acknowledged_at ? new Date(alert.acknowledged_at) : null
    }));
  }

  /**
   * Acknowledge an alert
   * @param {string} alertId - Alert ID to acknowledge
   * @param {string} userId - User ID acknowledging the alert
   * @returns {boolean} Success status
   */
  async acknowledgeAlert(alertId, userId) {
    const { error } = await supabase
      .from('optimization_alerts')
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId
      })
      .eq('id', alertId);

    if (error) {
      console.error('[OptimizationEngine] Error acknowledging alert:', error);
      return false;
    }

    console.log(`[OptimizationEngine] ✅ Alert ${alertId} acknowledged by ${userId}`);
    return true;
  }

  /**
   * Stop the optimization engine
   */
  stop() {
    console.log('[OptimizationEngine] Optimization engine stopped');
  }
}

export default new OptimizationEngine();