// packages/backend/src/utils/context-window-manager.js
// Dynamically adjusts context window size based on query complexity
// Relevant files: context.js, rag-service.js

/**
 * @typedef {Object} QueryComplexity
 * @property {string} level - Complexity level ('simple', 'moderate', 'complex')
 * @property {number} score - Complexity score (0-1)
 * @property {string[]} factors - Contributing factors
 */

/**
 * @typedef {Object} ContextWindowConfig
 * @property {number} maxTokens - Maximum tokens for this window
 * @property {number} minTokens - Minimum tokens to include
 * @property {string} compressionLevel - Compression strategy ('light', 'moderate', 'aggressive')
 * @property {boolean} enableDeduplication - Whether to deduplicate chunks
 * @property {boolean} enableHierarchy - Whether to use hierarchical organization
 */

/**
 * Context Window Manager
 * Dynamically adjusts context window size and strategy based on query complexity
 */
class ContextWindowManager {
  constructor(options = {}) {
    this.defaultMaxTokens = options.defaultMaxTokens || 1500;
    this.minTokens = options.minTokens || 500;
    this.maxTokens = options.maxTokens || 3000;

    // Complexity thresholds
    this.complexityThresholds = {
      simple: 0.3,
      moderate: 0.6,
      complex: 0.8
    };

    // Window configurations for different complexity levels
    this.windowConfigs = {
      simple: {
        maxTokens: 800,
        minTokens: 300,
        compressionLevel: 'light',
        enableDeduplication: false,
        enableHierarchy: false
      },
      moderate: {
        maxTokens: 1500,
        minTokens: 500,
        compressionLevel: 'moderate',
        enableDeduplication: true,
        enableHierarchy: true
      },
      complex: {
        maxTokens: 2500,
        minTokens: 800,
        compressionLevel: 'aggressive',
        enableDeduplication: true,
        enableHierarchy: true
      }
    };
  }

  /**
   * Determines optimal context window configuration for a query
   * @param {Object} queryAnalysis - Query analysis results
   * @param {Object} userContext - User context information
   * @param {Object} systemConstraints - System constraints (available tokens, etc.)
   * @returns {ContextWindowConfig} Optimal window configuration
   */
  determineOptimalWindow(queryAnalysis, userContext = {}, systemConstraints = {}) {
    const complexity = this.assessQueryComplexity(queryAnalysis, userContext);
    const baseConfig = this.getBaseConfigForComplexity(complexity);

    // Adjust for system constraints
    const adjustedConfig = this.adjustForSystemConstraints(baseConfig, systemConstraints);

    // Adjust for user context
    const finalConfig = this.adjustForUserContext(adjustedConfig, userContext);

    console.log(`[ContextWindowManager] Query complexity: ${complexity.level} (${complexity.score.toFixed(2)}), Window: ${finalConfig.maxTokens} tokens`);

    return finalConfig;
  }

  /**
   * Assesses query complexity based on multiple factors
   * @param {Object} queryAnalysis - Query analysis results
   * @param {Object} userContext - User context information
   * @returns {QueryComplexity} Complexity assessment
   */
  assessQueryComplexity(queryAnalysis, userContext = {}) {
    let complexityScore = 0;
    const factors = [];

    // Query length factor
    const queryLength = queryAnalysis.query?.length || 0;
    if (queryLength > 100) {
      complexityScore += 0.2;
      factors.push('long_query');
    } else if (queryLength < 20) {
      complexityScore -= 0.1;
      factors.push('short_query');
    }

    // Intent complexity
    const intent = queryAnalysis.intent;
    if (intent) {
      if (intent.includes('comparison') || intent.includes('multiple')) {
        complexityScore += 0.3;
        factors.push('comparison_intent');
      }
      if (intent.includes('specific') || intent.includes('detailed')) {
        complexityScore += 0.2;
        factors.push('specific_intent');
      }
    }

    // Filter complexity
    const filters = queryAnalysis.filters || {};
    const filterCount = Object.keys(filters).length;
    if (filterCount > 2) {
      complexityScore += 0.2;
      factors.push('multiple_filters');
    }

    // User context complexity
    if (userContext.leadScore > 70) {
      complexityScore += 0.1;
      factors.push('high_engagement_user');
    }

    // Conversation depth
    const conversationDepth = userContext.conversationTurns || 0;
    if (conversationDepth > 5) {
      complexityScore += 0.1;
      factors.push('deep_conversation');
    }

    // Available context size
    const availableChunks = queryAnalysis.availableChunks || 0;
    if (availableChunks > 20) {
      complexityScore += 0.1;
      factors.push('large_context');
    }

    // Clamp score between 0 and 1
    complexityScore = Math.max(0, Math.min(1, complexityScore));

    // Determine complexity level
    let level = 'moderate';
    if (complexityScore <= this.complexityThresholds.simple) {
      level = 'simple';
    } else if (complexityScore >= this.complexityThresholds.complex) {
      level = 'complex';
    }

    return {
      level,
      score: complexityScore,
      factors
    };
  }

  /**
   * Gets base configuration for complexity level
   * @param {QueryComplexity} complexity - Complexity assessment
   * @returns {ContextWindowConfig} Base configuration
   */
  getBaseConfigForComplexity(complexity) {
    return { ...this.windowConfigs[complexity.level] };
  }

  /**
   * Adjusts configuration based on system constraints
   * @param {ContextWindowConfig} config - Base configuration
   * @param {Object} constraints - System constraints
   * @returns {ContextWindowConfig} Adjusted configuration
   */
  adjustForSystemConstraints(config, constraints = {}) {
    const adjustedConfig = { ...config };

    // Adjust for available token budget
    if (constraints.availableTokens) {
      adjustedConfig.maxTokens = Math.min(
        adjustedConfig.maxTokens,
        constraints.availableTokens * 0.8 // Leave 20% buffer
      );
    }

    // Adjust for model limits
    if (constraints.modelMaxTokens) {
      adjustedConfig.maxTokens = Math.min(
        adjustedConfig.maxTokens,
        constraints.modelMaxTokens - 500 // Leave room for response
      );
    }

    // Adjust for performance requirements
    if (constraints.performanceMode === 'fast') {
      adjustedConfig.maxTokens = Math.min(adjustedConfig.maxTokens, 1000);
      adjustedConfig.compressionLevel = 'aggressive';
    }

    // Ensure minimum tokens
    adjustedConfig.maxTokens = Math.max(adjustedConfig.maxTokens, this.minTokens);
    adjustedConfig.minTokens = Math.max(adjustedConfig.minTokens, 200);

    return adjustedConfig;
  }

  /**
   * Adjusts configuration based on user context
   * @param {ContextWindowConfig} config - Base configuration
   * @param {Object} userContext - User context information
   * @returns {ContextWindowConfig} Adjusted configuration
   */
  adjustForUserContext(config, userContext = {}) {
    const adjustedConfig = { ...config };

    // High-value users get more context
    if (userContext.leadScore > 80) {
      adjustedConfig.maxTokens = Math.min(
        adjustedConfig.maxTokens * 1.2,
        this.maxTokens
      );
      adjustedConfig.compressionLevel = 'light';
    }

    // New users get simpler context
    if (userContext.isNewUser) {
      adjustedConfig.maxTokens = Math.max(
        adjustedConfig.maxTokens * 0.8,
        this.minTokens
      );
      adjustedConfig.enableHierarchy = false;
    }

    // Users in complex conversations get more context
    if (userContext.conversationComplexity === 'high') {
      adjustedConfig.maxTokens = Math.min(
        adjustedConfig.maxTokens * 1.1,
        this.maxTokens
      );
    }

    return adjustedConfig;
  }

  /**
   * Calculates dynamic token budget based on query characteristics
   * @param {Object} queryAnalysis - Query analysis
   * @param {Object} userContext - User context
   * @param {Object} systemLimits - System limits
   * @returns {number} Recommended token budget
   */
  calculateDynamicTokenBudget(queryAnalysis, userContext = {}, systemLimits = {}) {
    const complexity = this.assessQueryComplexity(queryAnalysis, userContext);
    const baseBudget = this.defaultMaxTokens;

    // Adjust based on complexity
    let multiplier = 1.0;
    switch (complexity.level) {
      case 'simple':
        multiplier = 0.6;
        break;
      case 'moderate':
        multiplier = 1.0;
        break;
      case 'complex':
        multiplier = 1.4;
        break;
    }

    // Adjust for user value
    if (userContext.leadScore > 70) {
      multiplier *= 1.2;
    }

    // Apply system limits
    const maxAllowed = systemLimits.maxTokens || this.maxTokens;
    const calculatedBudget = Math.round(baseBudget * multiplier);

    return Math.min(Math.max(calculatedBudget, this.minTokens), maxAllowed);
  }

  /**
   * Provides recommendations for context optimization strategies
   * @param {ContextWindowConfig} config - Window configuration
   * @param {QueryComplexity} complexity - Query complexity
   * @returns {Object} Optimization recommendations
   */
  getOptimizationRecommendations(config, complexity) {
    const recommendations = {
      strategies: [],
      expectedSavings: 0,
      riskLevel: 'low'
    };

    if (config.enableDeduplication) {
      recommendations.strategies.push('semantic_deduplication');
      recommendations.expectedSavings += 15;
    }

    if (config.compressionLevel === 'moderate') {
      recommendations.strategies.push('moderate_compression');
      recommendations.expectedSavings += 25;
    } else if (config.compressionLevel === 'aggressive') {
      recommendations.strategies.push('aggressive_compression');
      recommendations.expectedSavings += 40;
      recommendations.riskLevel = 'medium';
    }

    if (config.enableHierarchy) {
      recommendations.strategies.push('hierarchical_organization');
      recommendations.expectedSavings += 10;
    }

    if (complexity.level === 'complex') {
      recommendations.strategies.push('intent_focused_filtering');
      recommendations.expectedSavings += 20;
    }

    return recommendations;
  }

  /**
   * Validates a context window configuration
   * @param {ContextWindowConfig} config - Configuration to validate
   * @returns {Object} Validation result
   */
  validateConfiguration(config) {
    const errors = [];
    const warnings = [];

    if (config.maxTokens < config.minTokens) {
      errors.push('maxTokens must be greater than minTokens');
    }

    if (config.maxTokens < 200) {
      warnings.push('maxTokens is very low, may impact response quality');
    }

    if (config.maxTokens > 5000) {
      warnings.push('maxTokens is very high, may cause performance issues');
    }

    if (!['light', 'moderate', 'aggressive'].includes(config.compressionLevel)) {
      errors.push('compressionLevel must be one of: light, moderate, aggressive');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Gets performance metrics for monitoring
   * @param {ContextWindowConfig} config - Current configuration
   * @param {QueryComplexity} complexity - Query complexity
   * @returns {Object} Performance metrics
   */
  getPerformanceMetrics(config, complexity) {
    return {
      windowSize: config.maxTokens,
      complexityLevel: complexity.level,
      complexityScore: complexity.score,
      compressionLevel: config.compressionLevel,
      optimizationsEnabled: {
        deduplication: config.enableDeduplication,
        hierarchy: config.enableHierarchy
      },
      timestamp: Date.now()
    };
  }
}

export default ContextWindowManager;