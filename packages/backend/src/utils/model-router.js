// packages/backend/src/utils/model-router.js
// Intelligent model selection system that routes queries to optimal LLM models based on complexity analysis and performance data
// Relevant files: performance-tracker.js, query-complexity-analyzer.js, rag-service.js

import QueryComplexityAnalyzer from './query-complexity-analyzer.js';
import { createLogger } from './structured-logger.js';

const log = createLogger('model-router');

/**
 * Model Router
 * Intelligently selects the optimal LLM model based on query complexity, performance data, and cost constraints
 */
class ModelRouter {
  constructor(performanceTracker) {
    this.performanceTracker = performanceTracker;
    this.complexityAnalyzer = new QueryComplexityAnalyzer();

    // Model configurations with capabilities and cost estimates
    this.models = {
      'gpt-5': {
        name: 'gpt-5',
        maxTokens: 128000,
        costPerToken: 0.00015, // Input token cost
        costPerOutputToken: 0.0006, // Output token cost
        capabilities: ['high_complexity', 'reasoning', 'analysis'],
        performanceScore: 0.95
      },
      'gpt-4.1': {
        name: 'gpt-4.1',
        maxTokens: 8192,
        costPerToken: 0.00003,
        costPerOutputToken: 0.00006,
        capabilities: ['medium_complexity', 'reasoning', 'general'],
        performanceScore: 0.85
      },
      'gpt-5-mini': {
        name: 'gpt-5-mini',
        maxTokens: 16384,
        costPerToken: 0.0000015,
        costPerOutputToken: 0.000002,
        capabilities: ['low_complexity', 'fast', 'cost_effective'],
        performanceScore: 0.75
      },
      'gpt-5-nano': {
        name: 'gpt-5-nano',
        maxTokens: 4096,
        costPerToken: 0.00000015,
        costPerOutputToken: 0.0000006,
        capabilities: ['simple', 'fastest', 'ultra_cost_effective'],
        performanceScore: 0.65
      }
    };

    // Selection constraints
    this.constraints = {
      maxCost: 0.01, // Maximum cost per request in USD
      maxResponseTime: 10000, // Maximum response time in ms
      fallbackModel: 'gpt-4.1' // Always available fallback
    };
  }

  /**
   * Select the optimal model for a given query and context
   * @param {string} query - User query
   * @param {Object} context - Query context (matches, externalContext, etc.)
   * @returns {Promise<Object>} Model selection result
   */
  async selectModel(query, context = {}) {
    try {
      log.info('model_router.select_model.start', { queryLength: query.length });

      // Analyze query complexity
      const complexityAnalysis = await this.complexityAnalyzer.analyze(query, context);

      // Get performance data for recommended models
      const modelPerformance = {};
      for (const modelName of complexityAnalysis.recommendedModels) {
        if (this.models[modelName]) {
          modelPerformance[modelName] = await this.performanceTracker.getHistoricalPerformance(
            modelName,
            complexityAnalysis
          );
        }
      }

      // Calculate cost estimates for each model
      const costEstimates = {};
      for (const modelName of complexityAnalysis.recommendedModels) {
        if (this.models[modelName]) {
          costEstimates[modelName] = this.estimateCost(
            modelName,
            complexityAnalysis.tokenCount
          );
        }
      }

      // Select optimal model based on complexity, performance, and cost
      const selection = this.optimizeSelection(
        complexityAnalysis,
        modelPerformance,
        costEstimates
      );

      // Log selection for performance tracking
      await this.performanceTracker.logSelection(selection, complexityAnalysis, {
        queryLength: query.length,
        contextMatches: context.matches?.length || 0,
        recommendedModels: complexityAnalysis.recommendedModels
      });

      log.info('model_router.select_model.success', {
        selectedModel: selection.selectedModel,
        complexity: complexityAnalysis.complexity,
        confidence: selection.confidence,
        estimatedCost: selection.estimatedCost
      });

      return selection;

    } catch (error) {
      log.error('model_router.select_model.error', {
        error: error.message,
        queryLength: query.length
      });

      // Return safe fallback
      return {
        selectedModel: this.constraints.fallbackModel,
        confidence: 0.5,
        estimatedCost: this.estimateCost(this.constraints.fallbackModel, 1000),
        reasoning: `Fallback due to error: ${error.message}`,
        complexityScore: 0.5
      };
    }
  }

  /**
   * Estimate cost for a model and token count
   * @param {string} modelName - Model name
   * @param {number} tokenCount - Estimated token count
   * @returns {number} Estimated cost in USD
   */
  estimateCost(modelName, tokenCount) {
    const model = this.models[modelName];
    if (!model) return 0;

    // Ensure token count is non-negative
    const safeTokenCount = Math.max(0, tokenCount);

    // Estimate output tokens (typically 2-3x input for conversational responses)
    const estimatedOutputTokens = Math.min(safeTokenCount * 2.5, model.maxTokens - safeTokenCount);

    const inputCost = safeTokenCount * model.costPerToken;
    const outputCost = Math.max(0, estimatedOutputTokens) * model.costPerOutputToken;

    return inputCost + outputCost;
  }

  /**
   * Optimize model selection based on multiple factors
   * @param {Object} complexityAnalysis - Complexity analysis result
   * @param {Object} modelPerformance - Performance scores by model
   * @param {Object} costEstimates - Cost estimates by model
   * @returns {Object} Optimized selection
   */
  optimizeSelection(complexityAnalysis, modelPerformance, costEstimates) {
    let bestModel = this.constraints.fallbackModel;
    let bestScore = 0;
    let bestReasoning = '';

    for (const modelName of complexityAnalysis.recommendedModels) {
      if (!this.models[modelName]) continue;

      const model = this.models[modelName];
      const performance = modelPerformance[modelName] || 0.5;
      const cost = costEstimates[modelName] || 0;

      // Skip if cost exceeds budget
      if (cost > this.constraints.maxCost) {
        continue;
      }

      // Calculate composite score: 40% complexity fit, 40% performance, 20% cost efficiency
      const complexityFit = this.calculateComplexityFit(modelName, complexityAnalysis);
      const costEfficiency = Math.max(0, 1 - (cost / this.constraints.maxCost));

      const compositeScore = (
        complexityFit * 0.4 +
        performance * 0.4 +
        costEfficiency * 0.2
      );

      if (compositeScore > bestScore) {
        bestScore = compositeScore;
        bestModel = modelName;
        bestReasoning = this.generateReasoning(modelName, complexityAnalysis, performance, cost);
      }
    }

    return {
      selectedModel: bestModel,
      confidence: Math.min(bestScore, 1),
      estimatedCost: costEstimates[bestModel] || 0,
      reasoning: bestReasoning,
      complexityScore: complexityAnalysis.overallScore
    };
  }

  /**
   * Calculate how well a model fits the query complexity
   * @param {string} modelName - Model name
   * @param {Object} complexityAnalysis - Complexity analysis
   * @returns {number} Fit score (0-1)
   */
  calculateComplexityFit(modelName, complexityAnalysis) {
    const model = this.models[modelName];
    if (!model) return 0;

    const complexity = complexityAnalysis.complexity;

    // Model capability mapping
    const capabilityMap = {
      'low': ['simple', 'fastest', 'ultra_cost_effective'],
      'medium': ['low_complexity', 'medium_complexity', 'fast', 'general'],
      'high': ['medium_complexity', 'high_complexity', 'reasoning', 'analysis']
    };

    const requiredCapabilities = capabilityMap[complexity] || [];
    const modelCapabilities = model.capabilities;

    // Calculate capability overlap
    const overlap = requiredCapabilities.filter(cap =>
      modelCapabilities.includes(cap)
    ).length;

    return overlap / Math.max(requiredCapabilities.length, 1);
  }

  /**
   * Generate human-readable reasoning for model selection
   * @param {string} modelName - Selected model
   * @param {Object} complexityAnalysis - Complexity analysis
   * @param {number} performance - Performance score
   * @param {number} cost - Estimated cost
   * @returns {string} Reasoning text
   */
  generateReasoning(modelName, complexityAnalysis, performance, cost) {
    const complexity = complexityAnalysis.complexity;
    const reasons = [];

    if (complexity === 'high') {
      reasons.push(`High complexity query (${complexityAnalysis.overallScore.toFixed(2)}) requires advanced reasoning`);
    } else if (complexity === 'medium') {
      reasons.push(`Medium complexity query needs balanced capabilities`);
    } else {
      reasons.push(`Simple query can use cost-effective model`);
    }

    if (performance > 0.8) {
      reasons.push(`Strong historical performance (${(performance * 100).toFixed(0)}%)`);
    }

    if (cost < 0.001) {
      reasons.push(`Cost-effective solution ($${cost.toFixed(6)})`);
    }

    return reasons.join('. ') + '.';
  }

  /**
   * Get available models
   * @returns {Array} List of available model names
   */
  getAvailableModels() {
    return Object.keys(this.models);
  }

  /**
   * Update model constraints
   * @param {Object} newConstraints - New constraint values
   */
  updateConstraints(newConstraints) {
    this.constraints = { ...this.constraints, ...newConstraints };
    log.info('model_router.constraints_updated', this.constraints);
  }
}

export default ModelRouter;