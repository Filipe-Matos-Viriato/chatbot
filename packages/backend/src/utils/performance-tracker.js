// packages/backend/src/utils/performance-tracker.js
// Tracks model performance and provides data for intelligent routing decisions
// Relevant files: model-router.js, rag-service.js, database schema

import supabase from '../config/supabase.js';
import { createLogger } from './structured-logger.js';

const log = createLogger('performance-tracker');

/**
 * Performance Tracker
 * Monitors and analyzes model performance for continuous optimization
 */
class PerformanceTracker {
  constructor() {
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Log a model selection for performance tracking
   * @param {Object} selection - Model selection result
   * @param {Object} complexityAnalysis - Query complexity analysis
   * @param {Object} constraints - Selection constraints
   */
  async logSelection(selection, complexityAnalysis, constraints) {
    try {
      const logEntry = {
        query_id: this.generateQueryId(),
        selected_model: selection.selectedModel,
        complexity_score: complexityAnalysis.overallScore,
        token_count: complexityAnalysis.tokenCount,
        estimated_cost: selection.estimatedCost,
        confidence: selection.confidence,
        reasoning: selection.reasoning,
        constraints: JSON.stringify(constraints),
        timestamp: new Date().toISOString()
      };

      // Store in database (async, don't block selection)
      this.storeSelectionLog(logEntry).catch(error => {
        log.error('performance.log_selection.failed', { error: error.message });
      });

      log.info('performance.selection_logged', {
        model: selection.selectedModel,
        complexity: complexityAnalysis.overallScore,
        cost: selection.estimatedCost
      });

    } catch (error) {
      log.error('performance.log_selection.error', { error: error.message });
    }
  }

  /**
   * Log actual performance metrics after response generation
   * @param {string} queryId - Query identifier
   * @param {Object} metrics - Actual performance metrics
   */
  async logPerformance(queryId, metrics) {
    try {
      const performanceEntry = {
        query_id: queryId,
        actual_cost: metrics.actualCost,
        response_quality_score: metrics.qualityScore,
        response_time_ms: metrics.responseTime,
        success: metrics.success,
        error_type: metrics.errorType,
        token_usage: metrics.tokenUsage,
        timestamp: new Date().toISOString()
      };

      // Update database record
      await this.updatePerformanceLog(queryId, performanceEntry);

      log.info('performance.metrics_logged', {
        queryId,
        cost: metrics.actualCost,
        quality: metrics.qualityScore,
        time: metrics.responseTime
      });

    } catch (error) {
      log.error('performance.log_performance.error', { error: error.message });
    }
  }

  /**
   * Get historical performance data for a model
   * @param {string} modelName - Model name
   * @param {Object} complexityAnalysis - Complexity context
   * @returns {Promise<number>} Performance score (0-1)
   */
  async getHistoricalPerformance(modelName, complexityAnalysis) {
    const cacheKey = `perf_${modelName}_${Math.floor(complexityAnalysis.overallScore * 10)}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.score;
    }

    try {
      // Query recent performance data
      const { data, error } = await supabase
        .from('model_selections')
        .select('response_quality_score, response_time_ms, actual_cost, success')
        .eq('selected_model', modelName)
        .gte('complexity_score', complexityAnalysis.overallScore - 0.1)
        .lte('complexity_score', complexityAnalysis.overallScore + 0.1)
        .gte('timestamp', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days
        .not('response_quality_score', 'is', null)
        .limit(100);

      if (error || !data || data.length === 0) {
        return 0.5; // Default neutral score
      }

      // Calculate weighted performance score
      const totalWeight = data.length;
      let weightedScore = 0;

      data.forEach(record => {
        const qualityWeight = (record.response_quality_score || 0.5) * 0.5; // 50% weight on quality
        const timeWeight = Math.max(0, 1 - (record.response_time_ms || 3000) / 10000) * 0.3; // 30% weight on speed
        const successWeight = record.success ? 0.2 : 0; // 20% weight on success

        weightedScore += qualityWeight + timeWeight + successWeight;
      });

      const averageScore = weightedScore / totalWeight;

      // Cache the result
      this.cache.set(cacheKey, {
        score: averageScore,
        timestamp: Date.now()
      });

      return Math.min(averageScore, 1);

    } catch (error) {
      log.error('performance.get_historical.error', { error: error.message });
      return 0.5; // Safe default
    }
  }

  /**
   * Get cost efficiency metrics for model comparison
   * @param {string} modelName - Model name
   * @returns {Promise<Object>} Cost efficiency metrics
   */
  async getCostEfficiency(modelName) {
    try {
      const { data, error } = await supabase
        .from('model_selections')
        .select('actual_cost, response_quality_score')
        .eq('selected_model', modelName)
        .gte('timestamp', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
        .not('actual_cost', 'is', null)
        .limit(1000);

      if (error || !data || data.length === 0) {
        return { averageCost: 0, costEfficiency: 0.5 };
      }

      const totalCost = data.reduce((sum, record) => sum + record.actual_cost, 0);
      const averageCost = totalCost / data.length;

      // Cost efficiency = quality per unit cost (normalized)
      const qualityScores = data.map(r => r.response_quality_score || 0.5);
      const averageQuality = qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length;
      const costEfficiency = averageQuality / Math.max(averageCost, 0.0001); // Avoid division by zero

      return {
        averageCost,
        costEfficiency: Math.min(costEfficiency * 1000, 1) // Normalize
      };

    } catch (error) {
      log.error('performance.get_cost_efficiency.error', { error: error.message });
      return { averageCost: 0, costEfficiency: 0.5 };
    }
  }

  /**
   * Get performance trends over time
   * @param {string} modelName - Model name
   * @param {number} days - Number of days to analyze
   * @returns {Promise<Array>} Performance trend data
   */
  async getPerformanceTrends(modelName, days = 7) {
    try {
      const { data, error } = await supabase
        .from('model_selections')
        .select('timestamp, response_quality_score, response_time_ms, actual_cost')
        .eq('selected_model', modelName)
        .gte('timestamp', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('timestamp', { ascending: true });

      if (error || !data) {
        return [];
      }

      // Group by day
      const dailyStats = {};
      data.forEach(record => {
        const day = record.timestamp.split('T')[0];
        if (!dailyStats[day]) {
          dailyStats[day] = {
            date: day,
            count: 0,
            totalQuality: 0,
            totalTime: 0,
            totalCost: 0
          };
        }

        dailyStats[day].count++;
        dailyStats[day].totalQuality += record.response_quality_score || 0;
        dailyStats[day].totalTime += record.response_time_ms || 0;
        dailyStats[day].totalCost += record.actual_cost || 0;
      });

      // Calculate averages
      return Object.values(dailyStats).map(day => ({
        date: day.date,
        requestCount: day.count,
        averageQuality: day.totalQuality / day.count,
        averageResponseTime: day.totalTime / day.count,
        averageCost: day.totalCost / day.count
      }));

    } catch (error) {
      log.error('performance.get_trends.error', { error: error.message });
      return [];
    }
  }

  /**
   * Generate a unique query identifier
   * @returns {string} Query ID
   */
  generateQueryId() {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Store selection log in database
   * @param {Object} logEntry - Selection log entry
   */
  async storeSelectionLog(logEntry) {
    const { error } = await supabase
      .from('model_selections')
      .insert(logEntry);

    if (error) {
      throw error;
    }
  }

  /**
   * Update performance log with actual metrics
   * @param {string} queryId - Query identifier
   * @param {Object} performanceEntry - Performance metrics
   */
  async updatePerformanceLog(queryId, performanceEntry) {
    const { error } = await supabase
      .from('model_selections')
      .update({
        actual_cost: performanceEntry.actual_cost,
        response_quality_score: performanceEntry.response_quality_score,
        response_time_ms: performanceEntry.response_time_ms,
        success: performanceEntry.success,
        error_type: performanceEntry.error_type,
        token_usage: performanceEntry.token_usage
      })
      .eq('query_id', queryId);

    if (error) {
      throw error;
    }
  }

  /**
   * Clear performance cache
   */
  clearCache() {
    this.cache.clear();
    log.info('performance.cache_cleared');
  }

  /**
   * Get performance summary for dashboard
   * @returns {Promise<Object>} Performance summary
   */
  async getPerformanceSummary() {
    try {
      const { data, error } = await supabase
        .from('model_selections')
        .select('selected_model, response_quality_score, response_time_ms, actual_cost, success')
        .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (error || !data) {
        return { totalRequests: 0, averageQuality: 0, averageCost: 0 };
      }

      const totalRequests = data.length;
      const successfulRequests = data.filter(r => r.success).length;
      const averageQuality = data.reduce((sum, r) => sum + (r.response_quality_score || 0), 0) / totalRequests;
      const averageCost = data.reduce((sum, r) => sum + (r.actual_cost || 0), 0) / totalRequests;
      const averageResponseTime = data.reduce((sum, r) => sum + (r.response_time_ms || 0), 0) / totalRequests;

      return {
        totalRequests,
        successfulRequests,
        successRate: successfulRequests / totalRequests,
        averageQuality,
        averageCost,
        averageResponseTime
      };

    } catch (error) {
      log.error('performance.get_summary.error', { error: error.message });
      return { totalRequests: 0, averageQuality: 0, averageCost: 0 };
    }
  }
}

export default PerformanceTracker;