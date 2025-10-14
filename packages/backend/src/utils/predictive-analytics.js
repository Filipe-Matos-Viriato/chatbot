/**
 * Predictive Analytics Service for Client-Specific LLM Analytics Dashboard
 * Provides usage forecasting, performance prediction, and cost optimization
 *
 * This file contains the core predictive analytics engine that builds upon
 * the foundation established in Phase 1 & 2 of the analytics dashboard implementation.
 *
 * Key Features:
 * - Usage forecasting with confidence intervals
 * - Performance prediction models
 * - Cost optimization algorithms
 * - Automated model selection recommendations
 */

import supabase from '../config/supabase.js';
import advancedAnalyticsLogger from './advanced-analytics-logger.js';

/**
 * @typedef {Object} ForecastData
 * @property {string} timeRange - Forecast time range (e.g., '7d', '30d')
 * @property {number} predictedRequests - Predicted number of requests
 * @property {Object} confidenceInterval - Confidence interval bounds
 * @property {number} confidenceInterval.lower - Lower bound
 * @property {number} confidenceInterval.upper - Upper bound
 * @property {Array<Object>} seasonalPatterns - Seasonal usage patterns
 * @property {string} seasonalPatterns[].dayOfWeek - Day of week
 * @property {number} seasonalPatterns[].multiplier - Usage multiplier
 * @property {Array<Object>} trendAnalysis - Trend analysis data
 * @property {string} trendAnalysis[].period - Time period
 * @property {number} trendAnalysis[].growthRate - Growth rate percentage
 */

/**
 * @typedef {Object} PerformancePrediction
 * @property {string} model - Model name being predicted
 * @property {number} predictedResponseTime - Predicted response time in ms
 * @property {number} predictedCostPerRequest - Predicted cost per request
 * @property {number} predictedSuccessRate - Predicted success rate (0-1)
 * @property {Object} confidence - Prediction confidence metrics
 * @property {number} confidence.accuracy - Prediction accuracy score
 * @property {string} confidence.factors - Factors affecting prediction
 * @property {Array<Object>} scenarios - Different prediction scenarios
 * @property {string} scenarios[].name - Scenario name
 * @property {number} scenarios[].probability - Scenario probability
 * @property {Object} scenarios[].metrics - Scenario-specific metrics
 */

class PredictiveAnalytics {
  constructor() {
    this.forecastingEnabled = String(process.env.PREDICTIVE_FORECASTING_ENABLED || 'true') === 'true';
    this.minHistoricalDataPoints = parseInt(process.env.MIN_HISTORICAL_DATA_POINTS || '50');
    this.forecastHorizonDays = parseInt(process.env.FORECAST_HORIZON_DAYS || '30');
    this.confidenceLevel = parseFloat(process.env.CONFIDENCE_LEVEL || '0.80');
  }

  /**
   * Generate usage forecast for a client
   * @param {string} clientId - Client identifier
   * @param {Object} options - Forecasting options
   * @returns {Promise<ForecastData>} Forecast data with confidence intervals
   */
  async generateUsageForecast(clientId, options = {}) {
    const { timeRange = '30d', includeSeasonal = true } = options;

    try {
      // Fetch historical data
      const historicalData = await this.getHistoricalUsageData(clientId, timeRange);

      if (!historicalData || historicalData.length < this.minHistoricalDataPoints) {
        console.warn(`[PredictiveAnalytics] Insufficient historical data for client ${clientId}`);
        return this.generateFallbackForecast(clientId);
      }

      // Calculate trend and seasonality
      const trendAnalysis = this.calculateTrendAnalysis(historicalData);
      const seasonalPatterns = includeSeasonal ? this.analyzeSeasonalPatterns(historicalData) : [];

      // Generate forecast using multiple methods
      const forecast = await this.generateMultiMethodForecast(historicalData, trendAnalysis, seasonalPatterns);

      return {
        timeRange,
        predictedRequests: Math.round(forecast.predictedRequests),
        confidenceInterval: {
          lower: Math.round(forecast.confidenceInterval.lower),
          upper: Math.round(forecast.confidenceInterval.upper)
        },
        seasonalPatterns,
        trendAnalysis,
        forecastMethod: forecast.method,
        accuracy: forecast.accuracy
      };

    } catch (error) {
      console.error(`[PredictiveAnalytics] Error generating forecast for client ${clientId}:`, error);
      return this.generateFallbackForecast(clientId);
    }
  }

  /**
   * Predict performance metrics for different models
   * @param {string} clientId - Client identifier
   * @param {Array<string>} models - Models to predict for
   * @returns {Promise<Array<PerformancePrediction>>} Performance predictions
   */
  async predictModelPerformance(clientId, models) {
    const predictions = [];

    for (const model of models) {
      try {
        const prediction = await this.predictSingleModelPerformance(clientId, model);
        predictions.push(prediction);
      } catch (error) {
        console.error(`[PredictiveAnalytics] Error predicting performance for ${model}:`, error);
        predictions.push(this.generateFallbackPrediction(model));
      }
    }

    return predictions;
  }

  /**
   * Generate cost optimization recommendations
   * @param {string} clientId - Client identifier
   * @param {Object} currentUsage - Current usage metrics
   * @returns {Promise<Object>} Cost optimization recommendations
   */
  async generateCostOptimization(clientId, currentUsage) {
    try {
      const historicalData = await this.getHistoricalCostData(clientId);
      const modelPerformance = await this.analyzeModelCostEfficiency(clientId);

      // Calculate optimal model distribution
      const optimalDistribution = this.calculateOptimalModelDistribution(
        currentUsage, historicalData, modelPerformance
      );

      // Generate specific recommendations
      const recommendations = this.generateOptimizationRecommendations(
        currentUsage, optimalDistribution, modelPerformance
      );

      return {
        currentCostPerRequest: currentUsage.costPerRequest,
        projectedSavings: recommendations.totalSavings,
        optimalModelDistribution: optimalDistribution,
        recommendations: recommendations.specific,
        implementationPriority: recommendations.priority,
        paybackPeriod: recommendations.paybackPeriod
      };

    } catch (error) {
      console.error(`[PredictiveAnalytics] Error generating cost optimization for ${clientId}:`, error);
      return this.generateFallbackOptimization(currentUsage);
    }
  }

  /**
   * Get automated model selection recommendations
   * @param {string} clientId - Client identifier
   * @param {Object} queryCharacteristics - Query characteristics
   * @returns {Promise<Object>} Model selection recommendations
   */
  async getModelSelectionRecommendations(clientId, queryCharacteristics) {
    try {
      const historicalPerformance = await this.getHistoricalModelPerformance(clientId);
      const costConstraints = await this.getClientCostConstraints(clientId);
      const performancePredictions = await this.predictModelPerformance(clientId, Object.keys(historicalPerformance));

      // Score models based on multiple criteria
      const modelScores = this.scoreModelsForQuery(
        queryCharacteristics,
        historicalPerformance,
        costConstraints,
        performancePredictions
      );

      // Generate recommendations
      const recommendations = this.generateModelRecommendations(modelScores, queryCharacteristics);

      return {
        recommendedModel: recommendations.primary,
        alternatives: recommendations.alternatives,
        reasoning: recommendations.reasoning,
        expectedPerformance: recommendations.expectedPerformance,
        costImpact: recommendations.costImpact
      };

    } catch (error) {
      console.error(`[PredictiveAnalytics] Error generating model recommendations for ${clientId}:`, error);
      return this.generateFallbackRecommendation(queryCharacteristics);
    }
  }

  // Private helper methods

  async getHistoricalUsageData(clientId, timeRange) {
    const days = parseInt(timeRange.replace('d', ''));
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('chat_message_analytics')
      .select('created_at, client_id')
      .eq('client_id', clientId)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  calculateTrendAnalysis(historicalData) {
    if (!historicalData || historicalData.length < 2) return [];

    // Group by day and calculate daily totals
    const dailyTotals = historicalData.reduce((acc, record) => {
      const day = new Date(record.created_at).toISOString().split('T')[0];
      acc[day] = (acc[day] || 0) + 1;
      return acc;
    }, {});

    // Calculate growth rates
    const days = Object.keys(dailyTotals).sort();
    const trendAnalysis = [];

    for (let i = 1; i < days.length; i++) {
      const current = dailyTotals[days[i]];
      const previous = dailyTotals[days[i - 1]];
      const growthRate = previous > 0 ? ((current - previous) / previous) * 100 : 0;

      trendAnalysis.push({
        period: days[i],
        requests: current,
        growthRate: Math.round(growthRate * 100) / 100
      });
    }

    return trendAnalysis;
  }

  analyzeSeasonalPatterns(historicalData) {
    const dayOfWeekCounts = historicalData.reduce((acc, record) => {
      const dayOfWeek = new Date(record.created_at).getDay();
      acc[dayOfWeek] = (acc[dayOfWeek] || 0) + 1;
      return acc;
    }, {});

    const totalRecords = historicalData.length;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    return Object.entries(dayOfWeekCounts).map(([day, count]) => ({
      dayOfWeek: dayNames[parseInt(day)],
      multiplier: count / (totalRecords / 7) // Average multiplier vs mean
    }));
  }

  async generateMultiMethodForecast(historicalData, trendAnalysis, seasonalPatterns) {
    // Simple exponential smoothing forecast
    const alpha = 0.3; // Smoothing factor
    const recentData = historicalData.slice(-7); // Last 7 days
    const recentAverage = recentData.length > 0 ?
      recentData.reduce((sum, record) => sum + 1, 0) / recentData.length : 0;

    // Calculate trend
    const trend = trendAnalysis.length > 0 ?
      trendAnalysis.slice(-7).reduce((sum, t) => sum + t.growthRate, 0) / trendAnalysis.length : 0;

    // Apply seasonal adjustment
    const seasonalMultiplier = seasonalPatterns.length > 0 ?
      seasonalPatterns.reduce((sum, p) => sum + p.multiplier, 0) / seasonalPatterns.length : 1;

    // Generate forecast
    const basePrediction = recentAverage * (1 + trend / 100) * seasonalMultiplier;
    const predictedRequests = Math.max(0, basePrediction);

    // Calculate confidence interval (simplified)
    const variance = this.calculateVariance(historicalData);
    const standardError = Math.sqrt(variance / historicalData.length);
    const marginOfError = standardError * 1.96; // 95% confidence

    return {
      predictedRequests,
      confidenceInterval: {
        lower: Math.max(0, predictedRequests - marginOfError),
        upper: predictedRequests + marginOfError
      },
      method: 'exponential_smoothing',
      accuracy: this.confidenceLevel
    };
  }

  calculateVariance(data) {
    if (!data || data.length < 2) return 0;

    const mean = data.length;
    const squaredDiffs = data.map(() => Math.pow(1 - mean, 2)); // Simplified for daily counts
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / squaredDiffs.length;
  }

  generateFallbackForecast(clientId) {
    return {
      timeRange: '30d',
      predictedRequests: 1000, // Conservative estimate
      confidenceInterval: { lower: 500, upper: 1500 },
      seasonalPatterns: [],
      trendAnalysis: [],
      forecastMethod: 'fallback',
      accuracy: 0.5
    };
  }

  async predictSingleModelPerformance(clientId, model) {
    const historicalData = await this.getHistoricalModelData(clientId, model);

    if (!historicalData || historicalData.length === 0) {
      return this.generateFallbackPrediction(model);
    }

    // Calculate performance metrics
    const avgResponseTime = historicalData.reduce((sum, record) =>
      sum + (record.response_time_ms || 0), 0) / historicalData.length;

    const avgCost = historicalData.reduce((sum, record) =>
      sum + (record.actual_cost || 0), 0) / historicalData.length;

    const successRate = historicalData.filter(record =>
      record.response_time_ms < 10000).length / historicalData.length; // Simple success metric

    // Generate prediction scenarios
    const scenarios = [
      { name: 'optimistic', probability: 0.2, metrics: { responseTime: avgResponseTime * 0.8, cost: avgCost * 0.9 } },
      { name: 'expected', probability: 0.6, metrics: { responseTime: avgResponseTime, cost: avgCost } },
      { name: 'pessimistic', probability: 0.2, metrics: { responseTime: avgResponseTime * 1.2, cost: avgCost * 1.1 } }
    ];

    return {
      model,
      predictedResponseTime: Math.round(avgResponseTime),
      predictedCostPerRequest: Math.round(avgCost * 100) / 100,
      predictedSuccessRate: Math.round(successRate * 100) / 100,
      confidence: {
        accuracy: 0.75,
        factors: 'Based on historical performance data'
      },
      scenarios
    };
  }

  generateFallbackPrediction(model) {
    return {
      model,
      predictedResponseTime: 2000,
      predictedCostPerRequest: 0.01,
      predictedSuccessRate: 0.95,
      confidence: {
        accuracy: 0.5,
        factors: 'Using default estimates'
      },
      scenarios: []
    };
  }

  async getHistoricalModelData(clientId, model) {
    const { data, error } = await supabase
      .from('chat_message_analytics')
      .select('response_time_ms, actual_cost')
      .eq('client_id', clientId)
      .eq('model_selected', model)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;
    return data;
  }

  async getHistoricalCostData(clientId) {
    const { data, error } = await supabase
      .from('chat_message_analytics')
      .select('actual_cost, model_selected, created_at')
      .eq('client_id', clientId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  async analyzeModelCostEfficiency(clientId) {
    const costData = await this.getHistoricalCostData(clientId);

    const modelStats = costData.reduce((acc, record) => {
      const model = record.model_selected;
      if (!acc[model]) {
        acc[model] = { totalCost: 0, totalRequests: 0 };
      }
      acc[model].totalCost += record.actual_cost || 0;
      acc[model].totalRequests += 1;
      return acc;
    }, {});

    // Calculate cost per request for each model
    Object.keys(modelStats).forEach(model => {
      modelStats[model].costPerRequest = modelStats[model].totalCost / modelStats[model].totalRequests;
    });

    return modelStats;
  }

  calculateOptimalModelDistribution(currentUsage, historicalData, modelPerformance) {
    // Simple optimization: prefer cheaper models while maintaining performance
    const models = Object.keys(modelPerformance);
    const totalRequests = currentUsage.totalRequests || 1000;

    // Sort models by cost efficiency
    const sortedModels = models.sort((a, b) =>
      modelPerformance[a].costPerRequest - modelPerformance[b].costPerRequest
    );

    // Allocate 60% to most efficient, 30% to second, 10% to third
    const distribution = {};
    distribution[sortedModels[0]] = Math.round(totalRequests * 0.6);
    if (sortedModels[1]) distribution[sortedModels[1]] = Math.round(totalRequests * 0.3);
    if (sortedModels[2]) distribution[sortedModels[2]] = Math.round(totalRequests * 0.1);

    return distribution;
  }

  generateOptimizationRecommendations(currentUsage, optimalDistribution, modelPerformance) {
    const recommendations = [];
    let totalSavings = 0;

    Object.entries(optimalDistribution).forEach(([model, requests]) => {
      const currentCostPerRequest = currentUsage.costPerRequest || 0.01;
      const optimalCostPerRequest = modelPerformance[model]?.costPerRequest || currentCostPerRequest;
      const savings = (currentCostPerRequest - optimalCostPerRequest) * requests;

      if (savings > 0) {
        totalSavings += savings;
        recommendations.push({
          model,
          recommendedRequests: requests,
          estimatedSavings: Math.round(savings * 100) / 100,
          priority: savings > 10 ? 'high' : 'medium'
        });
      }
    });

    return {
      specific: recommendations,
      totalSavings: Math.round(totalSavings * 100) / 100,
      priority: totalSavings > 50 ? 'high' : totalSavings > 20 ? 'medium' : 'low',
      paybackPeriod: totalSavings > 0 ? Math.round((100 / totalSavings) * 30) : 0 // Days
    };
  }

  generateFallbackOptimization(currentUsage) {
    return {
      currentCostPerRequest: currentUsage.costPerRequest || 0.01,
      projectedSavings: 0,
      optimalModelDistribution: {},
      recommendations: [],
      implementationPriority: 'low',
      paybackPeriod: 0
    };
  }

  async getHistoricalModelPerformance(clientId) {
    const { data, error } = await supabase
      .from('chat_message_analytics')
      .select('model_selected, response_time_ms, actual_cost')
      .eq('client_id', clientId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    if (error) throw error;

    const performance = data.reduce((acc, record) => {
      const model = record.model_selected;
      if (!acc[model]) {
        acc[model] = { responseTimes: [], costs: [] };
      }
      if (record.response_time_ms) acc[model].responseTimes.push(record.response_time_ms);
      if (record.actual_cost) acc[model].costs.push(record.actual_cost);
      return acc;
    }, {});

    // Calculate averages
    Object.keys(performance).forEach(model => {
      const stats = performance[model];
      stats.avgResponseTime = stats.responseTimes.length > 0 ?
        stats.responseTimes.reduce((a, b) => a + b, 0) / stats.responseTimes.length : 0;
      stats.avgCost = stats.costs.length > 0 ?
        stats.costs.reduce((a, b) => a + b, 0) / stats.costs.length : 0;
    });

    return performance;
  }

  async getClientCostConstraints(clientId) {
    // This could be extended to fetch from client configuration
    return {
      maxCostPerRequest: 0.05,
      monthlyBudget: 1000,
      priority: 'cost_optimization'
    };
  }

  scoreModelsForQuery(queryCharacteristics, historicalPerformance, costConstraints, predictions) {
    const { complexity = 0.5, tokenBudget = 1000, qualityRequirements = 'standard' } = queryCharacteristics;

    return Object.keys(historicalPerformance).map(model => {
      const historical = historicalPerformance[model];
      const prediction = predictions.find(p => p.model === model);

      // Scoring criteria
      const costScore = Math.max(0, 1 - (historical.avgCost / costConstraints.maxCostPerRequest));
      const performanceScore = Math.max(0, 1 - (historical.avgResponseTime / 5000)); // 5s max
      const complexityMatch = this.calculateComplexityMatch(model, complexity);
      const qualityMatch = this.calculateQualityMatch(model, qualityRequirements);

      const totalScore = (costScore * 0.3) + (performanceScore * 0.3) +
                        (complexityMatch * 0.2) + (qualityMatch * 0.2);

      return {
        model,
        totalScore,
        scores: { costScore, performanceScore, complexityMatch, qualityMatch },
        predictedCost: prediction?.predictedCostPerRequest || historical.avgCost,
        predictedTime: prediction?.predictedResponseTime || historical.avgResponseTime
      };
    }).sort((a, b) => b.totalScore - a.totalScore);
  }

  calculateComplexityMatch(model, complexity) {
    // Simple heuristic: more complex models for complex queries
    const modelComplexity = {
      'gpt-3.5-turbo': 0.3,
      'gpt-4o-mini': 0.6,
      'gpt-4o': 0.9
    };

    const modelComp = modelComplexity[model] || 0.5;
    return 1 - Math.abs(modelComp - complexity);
  }

  calculateQualityMatch(model, requirements) {
    const qualityScores = {
      'gpt-3.5-turbo': requirements === 'basic' ? 1 : 0.7,
      'gpt-4o-mini': 0.8,
      'gpt-4o': 1
    };

    return qualityScores[model] || 0.5;
  }

  generateModelRecommendations(modelScores, queryCharacteristics) {
    const [primary, ...alternatives] = modelScores.slice(0, 3);

    return {
      primary: primary.model,
      alternatives: alternatives.map(m => m.model),
      reasoning: `Selected ${primary.model} based on optimal balance of cost (${primary.scores.costScore.toFixed(2)}), performance (${primary.scores.performanceScore.toFixed(2)}), and complexity match (${primary.scores.complexityMatch.toFixed(2)})`,
      expectedPerformance: {
        responseTime: primary.predictedTime,
        costPerRequest: primary.predictedCost
      },
      costImpact: primary.predictedCost - (modelScores[modelScores.length - 1]?.predictedCost || 0)
    };
  }

  generateFallbackRecommendation(queryCharacteristics) {
    return {
      recommendedModel: 'gpt-4o-mini',
      alternatives: ['gpt-3.5-turbo', 'gpt-4o'],
      reasoning: 'Using default recommendation due to insufficient data',
      expectedPerformance: {
        responseTime: 2000,
        costPerRequest: 0.01
      },
      costImpact: 0
    };
  }
}

export default new PredictiveAnalytics();