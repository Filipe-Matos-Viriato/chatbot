/**
 * Advanced Analytics Logger for Client-Specific LLM Analytics Dashboard
 * Event-driven batch processing with comprehensive metric collection and client-specific data partitioning
 */

import supabase from '../config/supabase.js';
import { EventEmitter } from 'events';

class AdvancedAnalyticsLogger extends EventEmitter {
  constructor() {
    super();
    this.enabled = String(process.env.RAG_ANALYTICS_LOGGING_ENABLED || 'true') === 'true';
    this.aggregationInterval = parseInt(process.env.ANALYTICS_AGGREGATION_INTERVAL || '300000'); // 5 minutes default
     this.batchTriggerThreshold = parseInt(process.env.ANALYTICS_BATCH_THRESHOLD || '50'); // Process batch when 50 records
    this.batchTriggerThreshold = parseInt(process.env.ANALYTICS_BATCH_THRESHOLD || '50'); // Process batch when 50 records
    this.clientMetrics = new Map(); // In-memory cache for real-time metrics
    this.aggregationTimer = null;
    this.pendingRecords = []; // Queue for batch processing
    this.isProcessingBatch = false;

    // Start event-driven aggregation if enabled
    if (this.enabled) {
      this.startEventDrivenAggregation();
    }
  }

  /**
   * Start event-driven aggregation pipeline
   */
  startEventDrivenAggregation() {
    console.log('[AdvancedAnalyticsLogger] Starting event-driven aggregation pipeline');

    // Set up periodic check for batch processing (less frequent than continuous)
    this.aggregationTimer = setInterval(async () => {
      try {
        // Only process if we have pending records and not already processing
        if (this.pendingRecords.length > 0 && !this.isProcessingBatch) {
          await this.processBatch();
        }
        // Still do periodic aggregation for any remaining data
        await this.aggregateClientMetrics();
      } catch (error) {
        console.error('[AdvancedAnalyticsLogger] Error in event-driven aggregation:', error);
      }
    }, this.aggregationInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      if (this.aggregationTimer) {
        clearInterval(this.aggregationTimer);
        console.log('[AdvancedAnalyticsLogger] Event-driven aggregation stopped');
      }
    });
  }

  /**
   * Log comprehensive model selection analytics (event-driven batch processing)
   * @param {Object} analyticsData - Enhanced analytics data
   */
  async logModelSelection(analyticsData) {
    if (!this.enabled) return;

    try {
      const {
        chatMessageId,
        clientId,
        modelSelected,
        queryComplexityScore,
        selectionConfidence,
        estimatedCost,
        actualCost,
        responseTimeMs,
        modelReasoning,
        fallbackUsed = false,
        // Enhanced metrics
        tokenUsage = {},
        contextQuality = 0,
        userIntent = '',
        responseQuality = 0,
        conversationContext = {}
      } = analyticsData;

      // Validate required fields
      if (!chatMessageId || !clientId || !modelSelected) {
        console.warn('[AdvancedAnalyticsLogger] Missing required fields for analytics logging');
        return;
      }

      const analyticsRecord = {
        chat_message_id: chatMessageId,
        client_id: clientId,
        model_selected: modelSelected,
        query_complexity_score: queryComplexityScore,
        selection_confidence: selectionConfidence,
        estimated_cost: estimatedCost,
        actual_cost: actualCost,
        response_time_ms: responseTimeMs,
        model_reasoning: modelReasoning,
        fallback_used: fallbackUsed,
        // Enhanced fields
        prompt_tokens: tokenUsage.promptTokens || 0,
        completion_tokens: tokenUsage.completionTokens || 0,
        total_tokens: tokenUsage.totalTokens || 0,
        context_quality_score: contextQuality,
        user_intent: userIntent,
        response_quality_score: responseQuality,
        conversation_turns: conversationContext.turns || 0,
        has_follow_up_questions: conversationContext.hasFollowUp || false,
        created_at: new Date().toISOString()
      };

      // Add to pending records queue instead of immediate database insert
      this.pendingRecords.push(analyticsRecord);

      // Update real-time metrics cache immediately
      this.updateClientMetricsCache(clientId, analyticsRecord);

      // Emit event for real-time updates
      this.emit('analyticsLogged', { clientId, analytics: analyticsRecord });

      // Check if we should trigger batch processing
      if (this.pendingRecords.length >= this.batchTriggerThreshold) {
        this.triggerBatchProcessing();
      }

      console.log(`[AdvancedAnalyticsLogger] ✅ Queued analytics for message ${chatMessageId} (${this.pendingRecords.length} pending)`);

    } catch (error) {
      console.error('[AdvancedAnalyticsLogger] Error logging analytics:', error);
    }
  }

  /**
   * Update real-time metrics cache for a client
   * @param {string} clientId - Client identifier
   * @param {Object} analyticsRecord - Analytics record
   */
  updateClientMetricsCache(clientId, analyticsRecord) {
    if (!this.clientMetrics.has(clientId)) {
      this.clientMetrics.set(clientId, {
        totalRequests: 0,
        totalCost: 0,
        totalResponseTime: 0,
        modelUsage: new Map(),
        hourlyStats: new Map(),
        lastUpdated: Date.now()
      });
    }

    const clientStats = this.clientMetrics.get(clientId);
    clientStats.totalRequests++;
    clientStats.totalCost += analyticsRecord.actual_cost || 0;
    clientStats.totalResponseTime += analyticsRecord.response_time_ms || 0;
    clientStats.lastUpdated = Date.now();

    // Update model usage
    const model = analyticsRecord.model_selected;
    clientStats.modelUsage.set(model, (clientStats.modelUsage.get(model) || 0) + 1);

    // Update hourly stats
    const hour = new Date().getHours();
    if (!clientStats.hourlyStats.has(hour)) {
      clientStats.hourlyStats.set(hour, { requests: 0, cost: 0 });
    }
    const hourStats = clientStats.hourlyStats.get(hour);
    hourStats.requests++;
    hourStats.cost += analyticsRecord.actual_cost || 0;
  }

  /**
   * Process pending records in batches
   */
  async processBatch() {
    if (this.isProcessingBatch || this.pendingRecords.length === 0) return;

    this.isProcessingBatch = true;
    const batchSize = Math.min(this.pendingRecords.length, 100); // Process up to 100 records at a time
    const batch = this.pendingRecords.splice(0, batchSize);

    try {
      console.log(`[AdvancedAnalyticsLogger] Processing batch of ${batch.length} analytics records`);

      // Insert batch to database
      const { error } = await supabase
        .from('chat_message_analytics')
        .insert(batch);

      if (error) {
        console.error('[AdvancedAnalyticsLogger] Failed to insert analytics batch:', error);
        // Re-queue failed records
        this.pendingRecords.unshift(...batch);
      } else {
        console.log(`[AdvancedAnalyticsLogger] ✅ Processed batch of ${batch.length} analytics records`);

        // Emit batch processed event
        this.emit('batchProcessed', {
          batchSize,
          remaining: this.pendingRecords.length,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('[AdvancedAnalyticsLogger] Error processing analytics batch:', error);
      // Re-queue failed records
      this.pendingRecords.unshift(...batch);
    } finally {
      this.isProcessingBatch = false;
    }
  }

  /**
   * Trigger batch processing manually
   */
  triggerBatchProcessing() {
    if (!this.isProcessingBatch && this.pendingRecords.length > 0) {
      this.processBatch();
    }
  }

  /**
   * Aggregate client metrics and store in database
   */
  async aggregateClientMetrics() {
    console.log('[AdvancedAnalyticsLogger] Aggregating client metrics...');

    for (const [clientId, metrics] of this.clientMetrics) {
      try {
        // Calculate averages
        const avgResponseTime = metrics.totalRequests > 0 ?
          metrics.totalResponseTime / metrics.totalRequests : 0;

        const hourlyData = Array.from(metrics.hourlyStats.entries()).map(([hour, stats]) => ({
          hour,
          requests: stats.requests,
          cost: stats.cost
        }));

        // Store aggregated metrics
        const aggregatedData = {
          client_id: clientId,
          period_start: new Date(Date.now() - this.aggregationInterval).toISOString(),
          period_end: new Date().toISOString(),
          total_requests: metrics.totalRequests,
          total_cost: metrics.totalCost,
          avg_response_time_ms: avgResponseTime,
          model_usage: Object.fromEntries(metrics.modelUsage),
          hourly_breakdown: hourlyData,
          created_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('client_analytics_aggregates')
          .insert(aggregatedData);

        if (error) {
          console.error(`[AdvancedAnalyticsLogger] Failed to store aggregated metrics for client ${clientId}:`, error);
        } else {
          console.log(`[AdvancedAnalyticsLogger] ✅ Stored aggregated metrics for client ${clientId}`);
        }

        // Reset metrics after successful aggregation
        this.clientMetrics.delete(clientId);

      } catch (error) {
        console.error(`[AdvancedAnalyticsLogger] Error aggregating metrics for client ${clientId}:`, error);
      }
    }
  }

  /**
   * Get real-time metrics for a specific client
   * @param {string} clientId - Client identifier
   * @returns {Object} Real-time metrics
   */
  getClientRealTimeMetrics(clientId) {
    const metrics = this.clientMetrics.get(clientId);
    if (!metrics) {
      return {
        totalRequests: 0,
        totalCost: 0,
        avgResponseTime: 0,
        modelUsage: {},
        hourlyStats: []
      };
    }

    return {
      totalRequests: metrics.totalRequests,
      totalCost: metrics.totalCost,
      avgResponseTime: metrics.totalRequests > 0 ?
        metrics.totalResponseTime / metrics.totalRequests : 0,
      modelUsage: Object.fromEntries(metrics.modelUsage),
      hourlyStats: Array.from(metrics.hourlyStats.entries()).map(([hour, stats]) => ({
        hour,
        requests: stats.requests,
        cost: stats.cost
      })),
      lastUpdated: metrics.lastUpdated
    };
  }

  /**
   * Calculate performance metrics for dashboard
   * @param {string} clientId - Client identifier
   * @param {Object} options - Query options
   * @returns {Object} Performance metrics
   */
  async calculatePerformanceMetrics(clientId, options = {}) {
    const { startDate, endDate, model } = options;

    try {
      let query = supabase
        .from('chat_message_analytics')
        .select('*')
        .eq('client_id', clientId);

      if (startDate) query = query.gte('created_at', startDate);
      if (endDate) query = query.lte('created_at', endDate);
      if (model) query = query.eq('model_selected', model);

      const { data, error } = await query;

      if (error) {
        console.error('[AdvancedAnalyticsLogger] Error fetching performance data:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return {
          totalRequests: 0,
          avgResponseTime: 0,
          totalCost: 0,
          costPerRequest: 0,
          modelDistribution: {},
          performanceTrends: []
        };
      }

      // Calculate metrics
      const totalRequests = data.length;
      const totalCost = data.reduce((sum, record) => sum + (record.actual_cost || 0), 0);
      const totalResponseTime = data.reduce((sum, record) => sum + (record.response_time_ms || 0), 0);
      const avgResponseTime = totalResponseTime / totalRequests;
      const costPerRequest = totalCost / totalRequests;

      // Model distribution
      const modelDistribution = data.reduce((dist, record) => {
        const model = record.model_selected;
        dist[model] = (dist[model] || 0) + 1;
        return dist;
      }, {});

      // Performance trends (group by hour)
      const trends = data.reduce((trends, record) => {
        const hour = new Date(record.created_at).getHours();
        if (!trends[hour]) {
          trends[hour] = { requests: 0, cost: 0, responseTime: 0 };
        }
        trends[hour].requests++;
        trends[hour].cost += record.actual_cost || 0;
        trends[hour].responseTime += record.response_time_ms || 0;
        return trends;
      }, {});

      const performanceTrends = Object.entries(trends).map(([hour, stats]) => ({
        hour: parseInt(hour),
        requests: stats.requests,
        cost: stats.cost,
        avgResponseTime: stats.responseTime / stats.requests
      }));

      return {
        totalRequests,
        avgResponseTime,
        totalCost,
        costPerRequest,
        modelDistribution,
        performanceTrends
      };

    } catch (error) {
      console.error('[AdvancedAnalyticsLogger] Error calculating performance metrics:', error);
      return null;
    }
  }

  /**
   * Get client comparison metrics
   * @param {Array<string>} clientIds - Array of client IDs to compare
   * @param {Object} options - Query options
   * @returns {Object} Comparison metrics
   */
  async getClientComparisonMetrics(clientIds, options = {}) {
    const { startDate, endDate } = options;
    const comparisonData = {};

    for (const clientId of clientIds) {
      const metrics = await this.calculatePerformanceMetrics(clientId, { startDate, endDate });
      if (metrics) {
        comparisonData[clientId] = metrics;
      }
    }

    return comparisonData;
  }

  /**
   * Clean up old aggregated data (keep last 30 days)
   */
  async cleanupOldAggregates() {
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { error } = await supabase
        .from('client_analytics_aggregates')
        .delete()
        .lt('period_end', thirtyDaysAgo.toISOString());

      if (error) {
        console.error('[AdvancedAnalyticsLogger] Error cleaning up old aggregates:', error);
      } else {
        console.log('[AdvancedAnalyticsLogger] ✅ Cleaned up old aggregated data');
      }
    } catch (error) {
      console.error('[AdvancedAnalyticsLogger] Error in cleanup:', error);
    }
  }

  /**
   * Process any remaining pending records before shutdown
   */
  async flushPendingRecords() {
    if (this.pendingRecords.length > 0) {
      console.log(`[AdvancedAnalyticsLogger] Flushing ${this.pendingRecords.length} pending records before shutdown`);
      while (this.pendingRecords.length > 0) {
        await this.processBatch();
      }
    }
  }

  /**
   * Stop the analytics logger and clean up resources
   */
  async stop() {
    console.log('[AdvancedAnalyticsLogger] Stopping analytics logger...');

    // Flush any pending records
    await this.flushPendingRecords();

    // Clear aggregation timer
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    // Clear pending records to free memory
    this.pendingRecords = [];

    console.log('[AdvancedAnalyticsLogger] Analytics logger stopped and cleaned up');
  }

  /**
   * Get current status of the analytics logger
   */
  getStatus() {
    return {
      enabled: this.enabled,
      pendingRecords: this.pendingRecords.length,
      isProcessingBatch: this.isProcessingBatch,
      batchTriggerThreshold: this.batchTriggerThreshold,
      aggregationInterval: this.aggregationInterval,
      activeClients: this.clientMetrics.size
    };
  }
}

export default new AdvancedAnalyticsLogger();