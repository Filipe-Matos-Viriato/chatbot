// packages/backend/src/utils/real-time-learning-engine.js
// Event-driven RealTimeLearningEngine implementation with reinforcement learning for intelligent model selection
// Provides event-triggered learning from interactions to optimize LLM model routing and performance
// model-router.js, performance-tracker.js, rag-service.js, supabase.js
import supabase from '../config/supabase.js';
import { EventEmitter } from 'events';
import { createLogger } from './structured-logger.js';

const log = createLogger('real-time-learning-engine');

/**
 * RealTimeLearningEngine
 * Event-driven reinforcement learning system for optimizing model selection through triggered learning
 */
class RealTimeLearningEngine extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      windowSize: config.windowSize || 1000,
      adaptationRate: config.adaptationRate || 0.1,
      explorationRate: config.explorationRate || 0.1,
      confidenceThreshold: config.confidenceThreshold || 0.8,
      retrainingSampleThreshold: config.retrainingSampleThreshold || 1000,
      minRetrainingInterval: config.minRetrainingInterval || 604800000, // 7 days
      inactivityTimeout: config.inactivityTimeout || 3600000, // 1 hour
       batchTriggerThreshold: config.batchTriggerThreshold || 100, // Process batch when 100 interactions
      batchTriggerThreshold: config.batchTriggerThreshold || 100, // Process batch when 100 interactions
      ...config
    };

    this.policies = new Map();
    this.learningBuffer = [];
    this.lastRetrainingTime = 0;
    this.lastActivityTime = Date.now();
    this.isInitialized = false;
    this.isActive = false;
    this.explorationState = {
      currentRate: this.config.explorationRate,
      lastAdjustment: Date.now(),
      underExploredModels: new Set()
    };

    this.inactivityTimer = null;
    this.setupInactivityHandler();
  }

  /**
   * Lazy initialization - only called when first needed
   */
  async initialize() {
    if (this.isInitialized) return;

    try {
      log.info('real_time_learning_engine.lazy_initializing');

      // Load existing policies from database
      await this.loadPolicies();

      // Initialize exploration state
      await this.updateExplorationState();

      this.isInitialized = true;
      this.isActive = true;
      this.lastActivityTime = Date.now();

      log.info('real_time_learning_engine.initialized', {
        policiesLoaded: this.policies.size,
        explorationRate: this.explorationState.currentRate
      });
    } catch (error) {
      log.error('real_time_learning_engine.initialization_failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup inactivity handler for auto-shutdown
   */
  setupInactivityHandler() {
    this.inactivityTimer = setInterval(() => {
      const timeSinceActivity = Date.now() - this.lastActivityTime;
      if (timeSinceActivity > this.config.inactivityTimeout && this.isActive) {
        this.shutdown();
      }
    }, 60000); // Check every minute
  }

  /**
   * Learn from an interaction with multi-dimensional signals (event-driven)
   * @param {Object} interaction - Interaction data with signals
   */
  async learnFromInteraction(interaction) {
    try {
      // Lazy initialize if not already done
      await this.initialize();

      // Update activity timestamp
      this.lastActivityTime = Date.now();

      // Extract and validate learning signals
      const signals = await this.extractLearningSignals(interaction);

      if (!this.validateSignals(signals)) {
        log.warn('real_time_learning_engine.invalid_signals', { interactionId: interaction.id });
        return;
      }

      // Add to learning buffer
      this.learningBuffer.push({
        ...interaction,
        signals,
        timestamp: Date.now()
      });

      // Emit learning event
      this.emit('learningEvent', {
        type: 'interaction_processed',
        interactionId: interaction.id,
        bufferSize: this.learningBuffer.length
      });

      // Process learning if buffer reaches trigger threshold
      if (this.learningBuffer.length >= this.config.batchTriggerThreshold) {
        await this.processLearningBatch();
      }

      // Store signals in database asynchronously (don't wait)
      this.storeLearningSignals(signals).catch(error => {
        log.error('real_time_learning_engine.signal_storage_failed', { error: error.message });
      });

      log.info('real_time_learning_engine.learned_from_interaction', {
        interactionId: interaction.id,
        signalsExtracted: Object.keys(signals).length,
        bufferSize: this.learningBuffer.length
      });

    } catch (error) {
      log.error('real_time_learning_engine.learning_failed', {
        error: error.message,
        interactionId: interaction.id
      });
    }
  }

  /**
   * Apply learned policy to model selection
   * @param {Object} selection - Base model selection
   * @param {Object} context - Selection context
   * @returns {Object} Policy-adjusted selection
   */
  async applyLearnedPolicy(selection, context) {
    try {
      const complexity = selection.complexityScore || 0.5;
      const policy = this.getPolicyForComplexity(complexity);

      if (!policy || policy.confidence < this.config.confidenceThreshold) {
        // Not enough confidence, use base selection
        return selection;
      }

      // Apply exploration
      if (Math.random() < this.explorationState.currentRate) {
        return this.applyExploration(selection, context);
      }

      // Apply learned policy adjustments
      const adjustedSelection = this.applyPolicyAdjustments(selection, policy);

      log.info('real_time_learning_engine.policy_applied', {
        originalModel: selection.selectedModel,
        adjustedModel: adjustedSelection.selectedModel,
        complexity,
        confidence: policy.confidence
      });

      return adjustedSelection;

    } catch (error) {
      log.error('real_time_learning_engine.policy_application_failed', { error: error.message });
      return selection; // Fallback to base selection
    }
  }

  /**
   * Extract multi-dimensional learning signals from interaction
   * @param {Object} interaction - Interaction data
   * @returns {Object} Extracted signals
   */
  async extractLearningSignals(interaction) {
    const signals = {
      queryComplexity: interaction.queryComplexity || 0.5,
      performance: this.calculatePerformanceScore(interaction),
      userSatisfaction: interaction.userSatisfaction,
      costEfficiency: this.calculateCostEfficiency(interaction),
      contextUtilization: this.calculateContextUtilization(interaction),
      successRate: interaction.success ? 1 : 0,
      temporalFeatures: this.extractTemporalFeatures(),
      engagementSignals: this.extractEngagementSignals(interaction)
    };

    return signals;
  }

  /**
   * Validate learning signals quality
   * @param {Object} signals - Signals to validate
   * @returns {boolean} True if signals pass quality gates
   */
  validateSignals(signals) {
    // Quality gates for signal validation
    const qualityChecks = [
      signals.queryComplexity >= 0 && signals.queryComplexity <= 1,
      signals.performance >= 0 && signals.performance <= 100,
      signals.costEfficiency >= 0 && signals.costEfficiency <= 1,
      signals.contextUtilization >= 0 && signals.contextUtilization <= 1,
      signals.successRate >= 0 && signals.successRate <= 1
    ];

    return qualityChecks.every(check => check);
  }

  /**
   * Process a batch of learning data for policy updates (event-driven)
   */
  async processLearningBatch() {
    try {
      log.info('real_time_learning_engine.processing_batch', {
        batchSize: this.learningBuffer.length
      });

      // Emit batch processing event
      this.emit('learningEvent', {
        type: 'batch_processing_started',
        batchSize: this.learningBuffer.length
      });

      // Group by complexity levels
      const complexityGroups = this.groupByComplexity(this.learningBuffer);

      // Update policies for each complexity level
      for (const [complexity, interactions] of complexityGroups) {
        await this.updatePolicyForComplexity(complexity, interactions);
      }

      // Update exploration state (only when processing batch)
      await this.updateExplorationState();

      // Check for retraining trigger
      await this.checkRetrainingTrigger();

      // Emit batch completion event
      this.emit('learningEvent', {
        type: 'batch_processing_completed',
        complexityGroups: complexityGroups.size,
        policiesUpdated: complexityGroups.size
      });

      // Clear buffer
      this.learningBuffer = [];

      log.info('real_time_learning_engine.batch_processed', {
        complexityGroups: complexityGroups.size
      });

    } catch (error) {
      log.error('real_time_learning_engine.batch_processing_failed', { error: error.message });
      this.emit('learningEvent', {
        type: 'batch_processing_failed',
        error: error.message
      });
    }
  }

  /**
   * Update policy for a specific complexity level using reinforcement learning
   * @param {number} complexity - Complexity level
   * @param {Array} interactions - Interactions for this complexity
   */
  async updatePolicyForComplexity(complexity, interactions) {
    const policy = this.getOrCreatePolicy(complexity);

    // Calculate rewards for each interaction
    const rewards = interactions.map(interaction => this.calculateReward(interaction));

    // Update policy using momentum-based policy gradients
    const learningRate = this.config.adaptationRate;
    const momentum = 0.9;

    // Calculate policy gradients
    const gradients = this.calculatePolicyGradients(policy, interactions, rewards);

    // Apply momentum and regularization
    policy.velocity = policy.velocity || {};
    Object.keys(gradients).forEach(key => {
      // Momentum update
      policy.velocity[key] = (policy.velocity[key] || 0) * momentum + gradients[key];

      // Update weights with regularization
      policy.weights[key] = (policy.weights[key] || 0) + learningRate * policy.velocity[key];

      // Entropy regularization to prevent mode collapse
      policy.weights[key] *= (1 - 0.01); // Small entropy bonus
    });

    // Update policy statistics
    policy.sampleSize += interactions.length;
    policy.averageReward = this.updateRunningAverage(policy.averageReward, rewards, policy.sampleSize);
    policy.rewardVariance = this.calculateRewardVariance(rewards, policy.averageReward);

    // Update confidence using Bayesian approach
    policy.confidence = this.calculateBayesianConfidence(policy);

    // Save updated policy
    await this.savePolicy(policy);

    log.info('real_time_learning_engine.policy_updated', {
      complexity,
      sampleSize: policy.sampleSize,
      averageReward: policy.averageReward,
      confidence: policy.confidence
    });
  }

  /**
   * Apply exploration strategy to model selection
   * @param {Object} selection - Base selection
   * @param {Object} context - Selection context
   * @returns {Object} Exploration-adjusted selection
   */
  applyExploration(selection, context) {
    // ε-greedy with intelligent model targeting
    const availableModels = ['gpt-5', 'gpt-4.1', 'gpt-5-mini', 'gpt-5-nano'];

    // Prioritize under-explored models
    const underExploredModels = Array.from(this.explorationState.underExploredModels);
    if (underExploredModels.length > 0) {
      const randomUnderExplored = underExploredModels[Math.floor(Math.random() * underExploredModels.length)];
      return {
        ...selection,
        selectedModel: randomUnderExplored,
        reasoning: `Exploration: Testing under-explored model ${randomUnderExplored}`,
        exploration: true
      };
    }

    // Random exploration among all models
    const randomModel = availableModels[Math.floor(Math.random() * availableModels.length)];
    return {
      ...selection,
      selectedModel: randomModel,
      reasoning: `Exploration: Random model selection ${randomModel}`,
      exploration: true
    };
  }

  /**
   * Apply policy adjustments to model selection
   * @param {Object} selection - Base selection
   * @param {Object} policy - Learned policy
   * @returns {Object} Adjusted selection
   */
  applyPolicyAdjustments(selection, policy) {
    const weights = policy.weights;

    // Calculate model scores based on policy weights
    const modelScores = {};
    const availableModels = ['gpt-5', 'gpt-4.1', 'gpt-5-mini', 'gpt-5-nano'];

    availableModels.forEach(model => {
      modelScores[model] = this.calculateModelScore(model, selection, weights);
    });

    // Select model with highest score
    const bestModel = Object.keys(modelScores).reduce((a, b) =>
      modelScores[a] > modelScores[b] ? a : b
    );

    return {
      ...selection,
      selectedModel: bestModel,
      confidence: policy.confidence,
      reasoning: `Policy-based selection: ${bestModel} (confidence: ${(policy.confidence * 100).toFixed(1)}%)`,
      policyApplied: true
    };
  }

  /**
   * Check if retraining should be triggered
   */
  async checkRetrainingTrigger() {
    const now = Date.now();
    const timeSinceLastRetraining = now - this.lastRetrainingTime;

    if (timeSinceLastRetraining < this.config.minRetrainingInterval) {
      return; // Too soon for retraining
    }

    // Check sample size threshold
    const totalSamples = Array.from(this.policies.values())
      .reduce((sum, policy) => sum + policy.sampleSize, 0);

    if (totalSamples >= this.config.retrainingSampleThreshold) {
      await this.triggerRetraining();
    }

    // Check for concept drift using KL divergence
    const driftDetected = await this.detectConceptDrift();
    if (driftDetected) {
      log.warn('real_time_learning_engine.concept_drift_detected');
      await this.triggerRetraining();
    }
  }

  /**
   * Trigger comprehensive model retraining
   */
  async triggerRetraining() {
    try {
      log.info('real_time_learning_engine.retraining_triggered');

      // Gather comprehensive training data
      const trainingData = await this.gatherTrainingData();

      // Perform cross-validation
      const validationResults = await this.performCrossValidation(trainingData);

      // Update model versions
      await this.updateModelVersions(validationResults);

      this.lastRetrainingTime = Date.now();

      log.info('real_time_learning_engine.retraining_completed', {
        trainingSamples: trainingData.length,
        validationScore: validationResults.averageScore
      });

    } catch (error) {
      log.error('real_time_learning_engine.retraining_failed', { error: error.message });
    }
  }

  /**
   * Get learning metrics for monitoring
   * @returns {Object} Learning metrics
   */
  async getMetrics() {
    const metrics = {
      signalQuality: await this.calculateSignalQuality(),
      learningSpeed: this.calculateLearningSpeed(),
      explorationRate: this.explorationState.currentRate,
      policyConfidence: this.calculateAveragePolicyConfidence(),
      retrainingFrequency: this.calculateRetrainingFrequency(),
      performanceImprovement: await this.calculatePerformanceImprovement(),
      activePolicies: this.policies.size,
      totalSignals: this.learningBuffer.length,
      lastRetraining: this.lastRetrainingTime
    };

    return metrics;
  }

  /**
   * Get current policies
   * @returns {Array} Policy data
   */
  getPolicies() {
    return Array.from(this.policies.values()).map(policy => ({
      complexityLevel: policy.complexityLevel,
      confidence: policy.confidence,
      sampleSize: policy.sampleSize,
      averageReward: policy.averageReward,
      lastUpdated: policy.lastUpdated,
      policyWeights: policy.weights  // Transform weights to policyWeights for frontend compatibility
    }));
  }

  // Helper methods

  async loadPolicies() {
    const { data, error } = await supabase
      .from('learning_policies')
      .select('*')
      .order('complexity_level', { ascending: true });

    if (error) throw error;

    data.forEach(row => {
      this.policies.set(row.complexity_level, {
        id: row.id,
        complexityLevel: row.complexity_level,
        weights: row.policy_weights,
        confidence: row.confidence_score,
        sampleSize: row.sample_size,
        averageReward: row.average_reward,
        rewardVariance: row.reward_variance,
        lastUpdated: new Date(row.last_updated),
        version: row.version
      });
    });
  }

  getPolicyForComplexity(complexity) {
    // Find closest complexity level
    const complexities = Array.from(this.policies.keys());
    const closest = complexities.reduce((prev, curr) =>
      Math.abs(curr - complexity) < Math.abs(prev - complexity) ? curr : prev
    );

    return this.policies.get(closest);
  }

  getOrCreatePolicy(complexity) {
    let policy = this.getPolicyForComplexity(complexity);

    if (!policy) {
      policy = {
        complexityLevel: complexity,
        weights: {},
        confidence: 0,
        sampleSize: 0,
        averageReward: 0,
        rewardVariance: 0,
        lastUpdated: new Date(),
        version: 1
      };
      this.policies.set(complexity, policy);
    }

    return policy;
  }

  calculatePerformanceScore(interaction) {
    // Composite performance score based on multiple metrics
    const quality = interaction.qualityScore || 0.5;
    const time = Math.max(0, 1 - (interaction.responseTime || 3000) / 10000);
    const success = interaction.success ? 1 : 0;

    return Math.round((quality * 0.5 + time * 0.3 + success * 0.2) * 100);
  }

  calculateCostEfficiency(interaction) {
    const cost = interaction.actualCost || 0;
    const quality = interaction.qualityScore || 0.5;
    const maxExpectedCost = 0.01; // Maximum expected cost

    return Math.max(0, Math.min(1, quality / Math.max(cost, 0.0001) / maxExpectedCost));
  }

  calculateContextUtilization(interaction) {
    // Estimate based on token usage vs available context
    const usedTokens = interaction.tokenUsage || 0;
    const availableTokens = 4000; // Approximate context window

    return Math.min(1, usedTokens / availableTokens);
  }

  extractTemporalFeatures() {
    const now = new Date();
    return {
      hourOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      isWeekend: now.getDay() === 0 || now.getDay() === 6
    };
  }

  extractEngagementSignals(interaction) {
    return {
      conversationDepth: interaction.conversationDepth || 0,
      userEngagement: interaction.userEngagement || 0.5,
      queryDiversity: interaction.queryDiversity || 0.5
    };
  }

  groupByComplexity(interactions) {
    const groups = new Map();

    interactions.forEach(interaction => {
      const complexity = Math.round(interaction.signals.queryComplexity * 10) / 10; // Round to 1 decimal
      if (!groups.has(complexity)) {
        groups.set(complexity, []);
      }
      groups.get(complexity).push(interaction);
    });

    return groups;
  }

  calculateReward(interaction) {
    const signals = interaction.signals;

    // Multi-objective reward function
    const performanceReward = signals.performance / 100;
    const costReward = signals.costEfficiency;
    const satisfactionReward = signals.userSatisfaction || 0.5;
    const utilizationReward = signals.contextUtilization;

    // Weighted combination with dynamic weighting
    return performanceReward * 0.4 + costReward * 0.3 + satisfactionReward * 0.2 + utilizationReward * 0.1;
  }

  calculatePolicyGradients(policy, interactions, rewards) {
    const gradients = {};

    // Simplified policy gradient calculation
    interactions.forEach((interaction, i) => {
      const reward = rewards[i];
      const model = interaction.selectedModel;

      // Update gradients based on reward and model choice
      gradients[model] = (gradients[model] || 0) + reward;
    });

    // Normalize gradients
    const totalReward = Object.values(gradients).reduce((sum, g) => sum + g, 0);
    if (totalReward > 0) {
      Object.keys(gradients).forEach(key => {
        gradients[key] /= totalReward;
      });
    }

    return gradients;
  }

  updateRunningAverage(current, newValues, totalCount) {
    const newSum = newValues.reduce((sum, val) => sum + val, 0);
    const newCount = newValues.length;
    const oldSum = current * (totalCount - newCount);

    return (oldSum + newSum) / totalCount;
  }

  calculateRewardVariance(rewards, mean) {
    const squaredDiffs = rewards.map(r => Math.pow(r - mean, 2));
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / rewards.length;
  }

  calculateBayesianConfidence(policy) {
    // Simplified Bayesian confidence calculation
    const sampleSize = policy.sampleSize;
    const variance = policy.rewardVariance;

    if (sampleSize < 10) return 0.1; // Low confidence with small sample

    // Confidence increases with sample size and decreases with variance
    const baseConfidence = Math.min(1, sampleSize / 100);
    const variancePenalty = Math.max(0, 1 - variance * 10);

    return baseConfidence * variancePenalty;
  }

  async savePolicy(policy) {
    const { error } = await supabase
      .from('learning_policies')
      .upsert({
        id: policy.id,
        complexity_level: policy.complexityLevel,
        policy_weights: policy.weights,
        confidence_score: policy.confidence,
        sample_size: policy.sampleSize,
        average_reward: policy.averageReward,
        reward_variance: policy.rewardVariance,
        last_updated: policy.lastUpdated.toISOString(),
        version: policy.version
      });

    if (error) throw error;
  }

  async updateExplorationState() {
    // Identify under-explored models based on recent interactions
    const recentInteractions = this.learningBuffer.slice(-100);
    const modelCounts = {};

    recentInteractions.forEach(interaction => {
      const model = interaction.selectedModel;
      modelCounts[model] = (modelCounts[model] || 0) + 1;
    });

    const totalInteractions = recentInteractions.length;
    const averageCount = totalInteractions / 4; // Assuming 4 models

    this.explorationState.underExploredModels = new Set(
      Object.keys(modelCounts).filter(model => modelCounts[model] < averageCount * 0.7)
    );

    // Adjust exploration rate based on learning progress
    const averageConfidence = this.calculateAveragePolicyConfidence();
    this.explorationState.currentRate = Math.max(
      0.05, // Minimum exploration
      this.config.explorationRate * (1 - averageConfidence)
    );
  }

  calculateModelScore(model, selection, weights) {
    // Base score from model capabilities
    let score = 0;

    // Performance weight
    score += (weights[model] || 0) * 0.4;

    // Cost efficiency weight
    const costWeight = weights[`${model}_cost`] || 0;
    score += costWeight * 0.3;

    // Complexity fit weight
    const complexityFit = this.calculateComplexityFit(model, selection.complexityScore);
    score += complexityFit * 0.3;

    return score;
  }

  calculateComplexityFit(model, complexity) {
    // Simplified complexity fit calculation
    const modelCapabilities = {
      'gpt-5': 0.9,
      'gpt-4.1': 0.7,
      'gpt-5-mini': 0.5,
      'gpt-5-nano': 0.3
    };

    const modelComplexity = modelCapabilities[model] || 0.5;
    return 1 - Math.abs(modelComplexity - complexity);
  }

  async storeLearningSignals(signals) {
    const { error } = await supabase
      .from('learning_signals')
      .insert({
        interaction_id: signals.interactionId || null,
        query_complexity: signals.queryComplexity,
        selected_model: signals.selectedModel,
        actual_performance: signals.performance,
        user_satisfaction: signals.userSatisfaction,
        cost_efficiency: signals.costEfficiency,
        context_utilization: signals.contextUtilization,
        success_rate: signals.successRate,
        learning_signals: signals
      });

    if (error) {
      log.error('real_time_learning_engine.store_signals_failed', { error: error.message });
    }
  }

  async detectConceptDrift() {
    // Simplified concept drift detection using KL divergence
    // In a real implementation, this would compare recent vs historical distributions
    return false; // Placeholder
  }

  async gatherTrainingData() {
    const { data, error } = await supabase
      .from('learning_signals')
      .select('*')
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days
      .limit(10000);

    if (error) throw error;
    return data;
  }

  async performCrossValidation(trainingData) {
    // Simplified cross-validation
    // In a real implementation, this would perform proper k-fold cross-validation
    const averageScore = trainingData.reduce((sum, record) =>
      sum + record.actual_performance, 0) / trainingData.length;

    return { averageScore };
  }

  async updateModelVersions(validationResults) {
    const { error } = await supabase
      .from('learning_model_versions')
      .insert({
        model_type: 'selection_policy',
        version: Date.now(),
        training_data_size: validationResults.trainingSize,
        validation_metrics: validationResults,
        deployed_at: new Date().toISOString(),
        status: 'active'
      });

    if (error) throw error;
  }

  async calculateSignalQuality() {
    // Calculate average signal validation pass rate
    const recentSignals = this.learningBuffer.slice(-100);
    const validSignals = recentSignals.filter(item => this.validateSignals(item.signals));

    return recentSignals.length > 0 ? validSignals.length / recentSignals.length : 0;
  }

  calculateLearningSpeed() {
    // Calculate policy update frequency
    const recentUpdates = Array.from(this.policies.values())
      .filter(policy => policy.lastUpdated > new Date(Date.now() - 24 * 60 * 60 * 1000));

    return recentUpdates.length;
  }

  calculateAveragePolicyConfidence() {
    const policies = Array.from(this.policies.values());
    if (policies.length === 0) return 0;

    const totalConfidence = policies.reduce((sum, policy) => sum + policy.confidence, 0);
    return totalConfidence / policies.length;
  }

  calculateRetrainingFrequency() {
    if (this.lastRetrainingTime === 0) return 0;

    const daysSinceRetraining = (Date.now() - this.lastRetrainingTime) / (24 * 60 * 60 * 1000);
    return 1 / daysSinceRetraining; // Retrainings per day
  }

  async calculatePerformanceImprovement() {
    // Calculate improvement in model selection accuracy over time
    const { data, error } = await supabase
      .from('learning_signals')
      .select('actual_performance, created_at')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true });

    if (error || !data || data.length < 2) return 0;

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstHalfAvg = firstHalf.reduce((sum, r) => sum + r.actual_performance, 0) / firstHalf.length;
    const secondHalfAvg = secondHalf.reduce((sum, r) => sum + r.actual_performance, 0) / secondHalf.length;

    return ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100; // Percentage improvement
  }

  /**
   * Manual retraining trigger for admin operations
   */
  async manualRetrain() {
    await this.initialize(); // Ensure initialized
    log.info('real_time_learning_engine.manual_retrain_triggered');
    await this.triggerRetraining();
    return { success: true, timestamp: new Date().toISOString() };
  }

  /**
   * Shutdown the learning engine to free resources
   */
  shutdown() {
    if (!this.isActive) return;

    log.info('real_time_learning_engine.shutting_down');

    // Clear inactivity timer
    if (this.inactivityTimer) {
      clearInterval(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    // Clear learning buffer to free memory
    this.learningBuffer = [];

    this.isActive = false;

    // Emit shutdown event
    this.emit('shutdown', {
      timestamp: new Date().toISOString(),
      policiesCount: this.policies.size
    });

    log.info('real_time_learning_engine.shutdown_complete');
  }

  /**
   * Get current status of the learning engine
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      isActive: this.isActive,
      bufferSize: this.learningBuffer.length,
      policiesCount: this.policies.size,
      lastActivityTime: this.lastActivityTime,
      uptime: this.isActive ? Date.now() - this.lastActivityTime : 0
    };
  }
}

export default RealTimeLearningEngine;