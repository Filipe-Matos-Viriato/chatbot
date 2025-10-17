// packages/backend/src/utils/real-time-learning-engine.js
// RealTimeLearningEngine - Core reinforcement learning system for intelligent model selection
// Implements continuous learning, policy optimization, and adaptive model routing based on query characteristics
// Integrates with model-router.js, performance-tracker.js, and Supabase for persistent learning state
// LearningEngineDashboard.jsx, model-router.js, performance-tracker.js, Supabase tables: learning_policies, learning_signals

const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

class RealTimeLearningEngine {
  constructor(options = {}) {
    this.adaptationRate = options.adaptationRate || 0.1;
    this.explorationRate = options.explorationRate || 0.1;
    this.confidenceThreshold = options.confidenceThreshold || 0.8;
    this.retrainingSampleThreshold = options.retrainingSampleThreshold || 1000;
    this.minRetrainingInterval = options.minRetrainingInterval || 604800000; // 7 days
    this.windowSize = options.windowSize || 1000;

    this.policies = new Map();
    this.learningBuffer = [];
    this.explorationState = {
      underExploredModels: new Set(),
      lastExplorationBonus: new Map()
    };

    this.lastRetrainingTime = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the learning engine with existing policies from database
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      console.log('[RealTimeLearningEngine] Initializing...');

      // Load existing policies from Supabase
      const { data: policies, error } = await supabase
        .from('learning_policies')
        .select('*')
        .order('last_updated', { ascending: false });

      if (error) {
        console.error('[RealTimeLearningEngine] Error loading policies:', error);
        return;
      }

      // Group policies by complexity level (keep only latest version per level)
      const latestPolicies = new Map();
      policies.forEach(policy => {
        if (!latestPolicies.has(policy.complexity_level) ||
            policy.last_updated > latestPolicies.get(policy.complexity_level).last_updated) {
          latestPolicies.set(policy.complexity_level, policy);
        }
      });

      // Load policies into memory
      latestPolicies.forEach((policy, complexity) => {
        this.policies.set(complexity, {
          complexityLevel: complexity,
          weights: policy.policy_weights,
          confidence: policy.confidence_score,
          sampleSize: policy.sample_size,
          averageReward: policy.average_reward,
          rewardVariance: policy.reward_variance,
          lastUpdated: new Date(policy.last_updated),
          version: policy.version
        });
      });

      console.log(`[RealTimeLearningEngine] Loaded ${this.policies.size} policies`);
      this.isInitialized = true;

    } catch (error) {
      console.error('[RealTimeLearningEngine] Initialization error:', error);
    }
  }

  /**
   * Extract learning signals from interaction data
   */
  async extractLearningSignals(interaction) {
    const signals = {
      queryComplexity: this.calculateQueryComplexity(interaction.query),
      performance: interaction.qualityScore || 0,
      costEfficiency: this.calculateCostEfficiency(interaction),
      contextUtilization: interaction.contextUtilization || 0,
      successRate: interaction.success ? 1 : 0,
      engagementSignals: {
        userSatisfaction: interaction.userSatisfaction || 0,
        conversationDepth: interaction.conversationDepth || 0,
        userEngagement: interaction.userEngagement || 0,
        queryDiversity: interaction.queryDiversity || 0
      }
    };

    // Validate signals
    if (!this.validateSignals(signals)) {
      console.warn('[RealTimeLearningEngine] Invalid signals detected:', signals);
      return null;
    }

    return signals;
  }

  /**
   * Calculate query complexity score
   */
  calculateQueryComplexity(query) {
    if (!query) return 0;

    const complexityFactors = {
      length: Math.min(query.length / 100, 1), // 0-1 based on length
      keywords: this.countComplexityKeywords(query),
      structure: this.analyzeQueryStructure(query),
      domain: this.assessDomainComplexity(query)
    };

    // Weighted combination
    return (
      complexityFactors.length * 0.2 +
      complexityFactors.keywords * 0.3 +
      complexityFactors.structure * 0.3 +
      complexityFactors.domain * 0.2
    );
  }

  /**
   * Count complexity-indicating keywords
   */
  countComplexityKeywords(query) {
    const complexityKeywords = [
      'compare', 'versus', 'vs', 'difference', 'best', 'worst',
      'analyze', 'evaluate', 'assess', 'optimize', 'maximize', 'minimize',
      'complex', 'advanced', 'sophisticated', 'detailed', 'comprehensive',
      'multiple', 'various', 'diverse', 'range', 'spectrum'
    ];

    const lowerQuery = query.toLowerCase();
    const matches = complexityKeywords.filter(keyword => lowerQuery.includes(keyword));
    return Math.min(matches.length / 3, 1); // Cap at 1.0
  }

  /**
   * Analyze query structure complexity
   */
  analyzeQueryStructure(query) {
    let complexity = 0;

    // Question marks indicate structured queries
    complexity += (query.match(/\?/g) || []).length * 0.2;

    // Multiple clauses
    complexity += (query.match(/(and|or|but|however|although)/gi) || []).length * 0.1;

    // Lists or enumerations
    complexity += (query.match(/(\d+\.|\•|-)/g) || []).length * 0.1;

    // Technical terms
    complexity += (query.match(/\b(algorithm|methodology|framework|architecture|infrastructure)\b/gi) || []).length * 0.2;

    return Math.min(complexity, 1);
  }

  /**
   * Assess domain-specific complexity
   */
  assessDomainComplexity(query) {
    // Domain-specific complexity patterns
    const domainPatterns = {
      technical: /\b(api|database|server|cloud|infrastructure|deployment|integration|authentication)\b/gi,
      business: /\b(roi|kpi|metrics|analytics|optimization|efficiency|scalability|performance)\b/gi,
      analytical: /\b(analyze|evaluate|compare|benchmark|trend|pattern|correlation|prediction)\b/gi
    };

    let domainComplexity = 0;
    Object.values(domainPatterns).forEach(pattern => {
      const matches = query.match(pattern);
      if (matches) domainComplexity += 0.2;
    });

    return Math.min(domainComplexity, 1);
  }

  /**
   * Calculate cost efficiency score
   */
  calculateCostEfficiency(interaction) {
    const cost = interaction.actualCost || 0;
    const quality = interaction.qualityScore || 0;

    if (cost === 0) return 1; // Free is perfectly efficient

    // Cost per quality point (lower is better)
    const costPerQuality = cost / Math.max(quality, 0.1);

    // Normalize: assume 0.01 cost per quality point is baseline
    const baseline = 0.01;
    const efficiency = baseline / costPerQuality;

    return Math.min(Math.max(efficiency, 0), 1);
  }

  /**
   * Validate learning signals
   */
  validateSignals(signals) {
    if (!signals) return false;

    const requiredFields = ['queryComplexity', 'performance', 'costEfficiency', 'successRate'];
    for (const field of requiredFields) {
      if (typeof signals[field] !== 'number' || isNaN(signals[field])) {
        return false;
      }
    }

    // Range validation
    if (signals.queryComplexity < 0 || signals.queryComplexity > 1) return false;
    if (signals.performance < 0 || signals.performance > 100) return false;
    if (signals.costEfficiency < 0 || signals.costEfficiency > 1) return false;
    if (signals.successRate < 0 || signals.successRate > 1) return false;

    return true;
  }

  /**
   * Learn from interaction data
   */
  async learnFromInteraction(interaction) {
    try {
      const signals = await this.extractLearningSignals(interaction);
      if (!signals) return;

      // Add to learning buffer
      this.learningBuffer.push({
        signals,
        timestamp: Date.now(),
        interaction
      });

      // Process learning batch if buffer is full
      if (this.learningBuffer.length >= this.windowSize) {
        await this.processLearningBatch();
      }

      // Check if retraining is needed
      await this.checkRetrainingTrigger();

    } catch (error) {
      console.error('[RealTimeLearningEngine] Learning error:', error);
    }
  }

  /**
   * Process accumulated learning signals
   */
  async processLearningBatch() {
    if (this.learningBuffer.length === 0) return;

    console.log(`[RealTimeLearningEngine] Processing learning batch of ${this.learningBuffer.length} signals`);

    // Group signals by complexity
    const complexityGroups = new Map();

    this.learningBuffer.forEach(item => {
      const complexity = Math.round(item.signals.queryComplexity * 10) / 10; // Round to nearest 0.1

      if (!complexityGroups.has(complexity)) {
        complexityGroups.set(complexity, []);
      }
      complexityGroups.get(complexity).push(item);
    });

    // Update policies for each complexity group
    for (const [complexity, items] of complexityGroups) {
      await this.updatePolicyForComplexity(complexity, items);
    }

    // Clear buffer
    this.learningBuffer = [];

    console.log(`[RealTimeLearningEngine] Updated policies for ${complexityGroups.size} complexity levels`);
  }

  /**
   * Update policy for specific complexity level
   */
  async updatePolicyForComplexity(complexity, items) {
    const policy = this.getOrCreatePolicy(complexity);

    // Calculate rewards for each model in the batch
    const modelRewards = new Map();

    items.forEach(item => {
      const model = item.interaction.selectedModel;
      const reward = this.calculateReward(item.signals);

      if (!modelRewards.has(model)) {
        modelRewards.set(model, []);
      }
      modelRewards.get(model).push(reward);
    });

    // Update policy weights using reinforcement learning
    for (const [model, rewards] of modelRewards) {
      const averageReward = rewards.reduce((sum, r) => sum + r, 0) / rewards.length;
      const currentWeight = policy.weights[model] || 0;

      // Temporal difference learning update
      const newWeight = currentWeight + this.adaptationRate * (averageReward - currentWeight);
      policy.weights[model] = Math.max(0, Math.min(1, newWeight)); // Clamp to [0,1]
    }

    // Update policy statistics
    policy.sampleSize += items.length;
    policy.averageReward = this.calculateAverageReward(modelRewards);
    policy.rewardVariance = this.calculateRewardVariance(modelRewards);
    policy.confidence = this.calculatePolicyConfidence(policy);
    policy.lastUpdated = new Date();

    // Persist to database
    await this.persistPolicy(complexity, policy);

    console.log(`[RealTimeLearningEngine] Updated policy for complexity ${complexity}: confidence=${policy.confidence.toFixed(3)}`);
  }

  /**
   * Calculate reward from signals
   */
  calculateReward(signals) {
    // Weighted combination of signal components
    const weights = {
      performance: 0.4,
      costEfficiency: 0.3,
      successRate: 0.2,
      contextUtilization: 0.1
    };

    return (
      signals.performance * weights.performance / 100 + // Normalize performance to 0-1
      signals.costEfficiency * weights.costEfficiency +
      signals.successRate * weights.successRate +
      signals.contextUtilization * weights.contextUtilization
    );
  }

  /**
   * Get or create policy for complexity level
   */
  getOrCreatePolicy(complexity) {
    if (!this.policies.has(complexity)) {
      this.policies.set(complexity, {
        complexityLevel: complexity,
        weights: {},
        confidence: 0,
        sampleSize: 0,
        averageReward: 0,
        rewardVariance: 0,
        lastUpdated: new Date(),
        version: 1
      });
    }
    return this.policies.get(complexity);
  }

  /**
   * Find closest policy for unknown complexity
   */
  getPolicyForComplexity(complexity) {
    // Exact match
    if (this.policies.has(complexity)) {
      return this.policies.get(complexity);
    }

    // Find closest complexity level
    let closestComplexity = null;
    let minDistance = Infinity;

    for (const existingComplexity of this.policies.keys()) {
      const distance = Math.abs(complexity - existingComplexity);
      if (distance < minDistance) {
        minDistance = distance;
        closestComplexity = existingComplexity;
      }
    }

    return closestComplexity ? this.policies.get(closestComplexity) : null;
  }

  /**
   * Apply learned policy to model selection
   */
  async applyLearnedPolicy(selection, context) {
    const complexity = selection.complexityScore;
    const policy = this.getPolicyForComplexity(complexity);

    if (!policy || policy.confidence < this.confidenceThreshold) {
      // Not confident enough, return base selection
      return selection;
    }

    // Apply exploration
    const exploredSelection = await this.applyExploration(selection, context);

    // Apply policy adjustments
    return this.applyPolicyAdjustments(exploredSelection, policy);
  }

  /**
   * Apply exploration strategy
   */
  async applyExploration(selection, context) {
    if (Math.random() > this.explorationRate) {
      return selection; // No exploration
    }

    // Exploration logic
    const availableModels = context.availableModels || ['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo', 'claude-3-haiku'];

    // Prioritize under-explored models
    if (this.explorationState.underExploredModels.size > 0) {
      const underExploredArray = Array.from(this.explorationState.underExploredModels);
      const randomModel = underExploredArray[Math.floor(Math.random() * underExploredArray.length)];

      return {
        ...selection,
        selectedModel: randomModel,
        exploration: true,
        reasoning: `Exploring under-explored model: ${randomModel}`
      };
    }

    // Random exploration
    const randomModel = availableModels[Math.floor(Math.random() * availableModels.length)];

    return {
      ...selection,
      selectedModel: randomModel,
      exploration: true,
      reasoning: `Random exploration: ${randomModel}`
    };
  }

  /**
   * Apply policy-based adjustments
   */
  applyPolicyAdjustments(selection, policy) {
    const modelWeights = policy.weights;
    const selectedModel = selection.selectedModel;

    // Check if current model has learned weights
    if (modelWeights[selectedModel] && modelWeights[selectedModel] > 0.5) {
      return {
        ...selection,
        confidence: policy.confidence,
        policyApplied: true,
        reasoning: `Policy-based selection: ${selectedModel} (weight: ${(modelWeights[selectedModel] * 100).toFixed(1)}%)`
      };
    }

    // Find best model according to policy
    let bestModel = selectedModel;
    let bestWeight = modelWeights[selectedModel] || 0;

    for (const [model, weight] of Object.entries(modelWeights)) {
      if (weight > bestWeight) {
        bestWeight = weight;
        bestModel = model;
      }
    }

    if (bestModel !== selectedModel && bestWeight > 0.6) {
      return {
        ...selection,
        selectedModel: bestModel,
        confidence: policy.confidence,
        policyApplied: true,
        reasoning: `Policy override: ${bestModel} preferred over ${selectedModel} (weight: ${(bestWeight * 100).toFixed(1)}%)`
      };
    }

    return {
      ...selection,
      confidence: policy.confidence,
      policyApplied: true,
      reasoning: `Policy maintained: ${selectedModel} (weight: ${((modelWeights[selectedModel] || 0) * 100).toFixed(1)}%)`
    };
  }

  /**
   * Check if retraining should be triggered
   */
  async checkRetrainingTrigger() {
    const now = Date.now();

    // Check time-based trigger
    if (this.lastRetrainingTime &&
        (now - this.lastRetrainingTime) < this.minRetrainingInterval) {
      return; // Too soon since last retraining
    }

    // Check sample-based trigger
    let totalSamples = 0;
    for (const policy of this.policies.values()) {
      totalSamples += policy.sampleSize;
    }

    if (totalSamples >= this.retrainingSampleThreshold) {
      await this.triggerRetraining();
    }
  }

  /**
   * Trigger comprehensive retraining
   */
  async triggerRetraining() {
    console.log('[RealTimeLearningEngine] Starting retraining process...');

    try {
      // Process any remaining learning buffer
      if (this.learningBuffer.length > 0) {
        await this.processLearningBatch();
      }

      // Update exploration state
      await this.updateExplorationState();

      // Reset learning buffer for fresh data
      this.learningBuffer = [];

      this.lastRetrainingTime = Date.now();

      console.log('[RealTimeLearningEngine] Retraining completed');

    } catch (error) {
      console.error('[RealTimeLearningEngine] Retraining error:', error);
    }
  }

  /**
   * Update exploration state based on current policies
   */
  async updateExplorationState() {
    const allModels = new Set(['gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo', 'claude-3-haiku', 'claude-3-sonnet']);
    const usedModels = new Set();

    // Collect all models that have been used in policies
    for (const policy of this.policies.values()) {
      Object.keys(policy.weights).forEach(model => usedModels.add(model));
    }

    // Identify under-explored models
    this.explorationState.underExploredModels = new Set();
    for (const model of allModels) {
      if (!usedModels.has(model)) {
        this.explorationState.underExploredModels.add(model);
      }
    }

    console.log(`[RealTimeLearningEngine] Under-explored models: ${Array.from(this.explorationState.underExploredModels).join(', ')}`);
  }

  /**
   * Get learning metrics for monitoring
   */
  async getMetrics() {
    const metrics = {
      signalQuality: this.calculateSignalQuality(),
      learningSpeed: this.calculateLearningSpeed(),
      explorationRate: this.explorationRate,
      policyConfidence: this.calculateAveragePolicyConfidence(),
      activePolicies: this.policies.size,
      totalSignals: this.learningBuffer.length,
      lastRetraining: this.lastRetrainingTime,
      retrainingFrequency: await this.calculateRetrainingFrequency()
    };

    return metrics;
  }

  /**
   * Get all policies for visualization
   */
  getPolicies() {
    return Array.from(this.policies.values()).map(policy => ({
      complexityLevel: policy.complexityLevel,
      weights: policy.weights,
      confidence: policy.confidence,
      sampleSize: policy.sampleSize,
      averageReward: policy.averageReward,
      lastUpdated: policy.lastUpdated,
      version: policy.version
    }));
  }

  /**
   * Persist policy to database
   */
  async persistPolicy(complexity, policy) {
    try {
      const policyData = {
        complexity_level: complexity,
        policy_weights: policy.weights,
        confidence_score: policy.confidence,
        sample_size: policy.sampleSize,
        average_reward: policy.averageReward,
        reward_variance: policy.rewardVariance,
        last_updated: policy.lastUpdated.toISOString(),
        version: policy.version
      };

      const { error } = await supabase
        .from('learning_policies')
        .upsert(policyData, {
          onConflict: 'complexity_level',
          ignoreDuplicates: false
        });

      if (error) {
        console.error('[RealTimeLearningEngine] Error persisting policy:', error);
      }

    } catch (error) {
      console.error('[RealTimeLearningEngine] Policy persistence error:', error);
    }
  }

  // Helper methods for metrics calculation
  calculateSignalQuality() {
    if (this.learningBuffer.length === 0) return 1;

    const validSignals = this.learningBuffer.filter(item =>
      this.validateSignals(item.signals)
    ).length;

    return validSignals / this.learningBuffer.length;
  }

  calculateLearningSpeed() {
    // Policies updated per day (simplified)
    const recentPolicies = Array.from(this.policies.values())
      .filter(p => p.lastUpdated > Date.now() - 24 * 60 * 60 * 1000);

    return recentPolicies.length;
  }

  calculateAveragePolicyConfidence() {
    if (this.policies.size === 0) return 0;

    const totalConfidence = Array.from(this.policies.values())
      .reduce((sum, p) => sum + p.confidence, 0);

    return totalConfidence / this.policies.size;
  }

  async calculateRetrainingFrequency() {
    // Simplified: retrainings per day over last 30 days
    if (!this.lastRetrainingTime) return 0;

    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const recentRetrainingTime = this.lastRetrainingTime > thirtyDaysAgo ? this.lastRetrainingTime : null;

    return recentRetrainingTime ? 1 / 30 : 0; // Very simplified
  }

  calculateAverageReward(modelRewards) {
    const allRewards = [];
    for (const rewards of modelRewards.values()) {
      allRewards.push(...rewards);
    }
    return allRewards.length > 0 ? allRewards.reduce((sum, r) => sum + r, 0) / allRewards.length : 0;
  }

  calculateRewardVariance(modelRewards) {
    const avgReward = this.calculateAverageReward(modelRewards);
    const allRewards = [];
    for (const rewards of modelRewards.values()) {
      allRewards.push(...rewards);
    }

    if (allRewards.length <= 1) return 0;

    const variance = allRewards.reduce((sum, r) => sum + Math.pow(r - avgReward, 2), 0) / (allRewards.length - 1);
    return variance;
  }

  calculatePolicyConfidence(policy) {
    // Confidence based on sample size and reward consistency
    const sampleConfidence = Math.min(policy.sampleSize / 100, 1); // 100 samples for full confidence
    const rewardConfidence = policy.rewardVariance < 0.1 ? 1 : Math.max(0, 1 - policy.rewardVariance);

    return (sampleConfidence + rewardConfidence) / 2;
  }
}

module.exports = RealTimeLearningEngine;