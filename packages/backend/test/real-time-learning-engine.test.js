// packages/backend/test/real-time-learning-engine.test.js
// Comprehensive test suite for RealTimeLearningEngine
// Tests learning signal extraction, policy updates, exploration strategies, and persistence
// RealTimeLearningEngine, Supabase, Jest testing framework
const RealTimeLearningEngine = require('../src/utils/real-time-learning-engine');

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        order: jest.fn(() => ({
          data: [],
          error: null
        }))
      })),
      upsert: jest.fn(() => ({
        error: null
      }))
    }))
  }))
}));

describe('RealTimeLearningEngine', () => {
  let learningEngine;
  let mockSupabase;

  beforeEach(() => {
    // Reset environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_ANON_KEY = 'test-key';

    // Create fresh instance
    learningEngine = new RealTimeLearningEngine({
      adaptationRate: 0.1,
      explorationRate: 0.1,
      confidenceThreshold: 0.8
    });

    // Mock Supabase client
    mockSupabase = require('@supabase/supabase-js').createClient();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Initialization', () => {
    it('should initialize with default parameters', () => {
      expect(learningEngine.adaptationRate).toBe(0.1);
      expect(learningEngine.explorationRate).toBe(0.1);
      expect(learningEngine.confidenceThreshold).toBe(0.8);
      expect(learningEngine.isInitialized).toBe(false);
    });

    it('should initialize with custom parameters', () => {
      const customEngine = new RealTimeLearningEngine({
        adaptationRate: 0.2,
        explorationRate: 0.15,
        confidenceThreshold: 0.9
      });

      expect(customEngine.adaptationRate).toBe(0.2);
      expect(customEngine.explorationRate).toBe(0.15);
      expect(customEngine.confidenceThreshold).toBe(0.9);
    });

    it('should load existing policies from database', async () => {
      const mockPolicies = [
        {
          complexity_level: 0.5,
          policy_weights: { 'gpt-4': 0.8, 'gpt-3.5-turbo': 0.2 },
          confidence_score: 0.85,
          sample_size: 150,
          average_reward: 0.75,
          reward_variance: 0.05,
          last_updated: '2025-01-15T10:00:00Z',
          version: 3
        }
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            data: mockPolicies,
            error: null
          }))
        }))
      });

      await learningEngine.initialize();

      expect(learningEngine.isInitialized).toBe(true);
      expect(learningEngine.policies.size).toBe(1);
      expect(learningEngine.policies.get(0.5)).toBeDefined();
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            data: null,
            error: new Error('Database connection failed')
          }))
        }))
      });

      await learningEngine.initialize();

      expect(learningEngine.isInitialized).toBe(true); // Still true, just no policies loaded
      expect(learningEngine.policies.size).toBe(0);
    });
  });

  describe('Signal Extraction', () => {
    it('should extract learning signals from valid interaction', async () => {
      const interaction = {
        query: 'What are the best apartments for families?',
        qualityScore: 85,
        actualCost: 0.02,
        contextUtilization: 0.9,
        success: true,
        userSatisfaction: 4.2,
        conversationDepth: 3,
        userEngagement: 0.8,
        queryDiversity: 0.6
      };

      const signals = await learningEngine.extractLearningSignals(interaction);

      expect(signals).toBeDefined();
      expect(signals.queryComplexity).toBeGreaterThanOrEqual(0);
      expect(signals.queryComplexity).toBeLessThanOrEqual(1);
      expect(signals.performance).toBe(85);
      expect(signals.costEfficiency).toBeGreaterThan(0);
      expect(signals.successRate).toBe(1);
    });

    it('should calculate query complexity correctly', () => {
      // Simple query
      expect(learningEngine.calculateQueryComplexity('hello')).toBeLessThan(0.2);

      // Complex query
      const complexQuery = 'Can you compare and analyze the performance differences between various apartment types including cost efficiency, location advantages, and long-term ROI?';
      expect(learningEngine.calculateQueryComplexity(complexQuery)).toBeGreaterThan(0.5);
    });

    it('should validate signals correctly', () => {
      const validSignals = {
        queryComplexity: 0.5,
        performance: 85,
        costEfficiency: 0.8,
        successRate: 1
      };

      const invalidSignals = {
        queryComplexity: 1.5, // Invalid range
        performance: 85,
        costEfficiency: 0.8,
        successRate: 1
      };

      expect(learningEngine.validateSignals(validSignals)).toBe(true);
      expect(learningEngine.validateSignals(invalidSignals)).toBe(false);
      expect(learningEngine.validateSignals(null)).toBe(false);
    });

    it('should calculate cost efficiency', () => {
      const interaction = {
        actualCost: 0.05,
        qualityScore: 80
      };

      const efficiency = learningEngine.calculateCostEfficiency(interaction);
      expect(efficiency).toBeGreaterThan(0);
      expect(efficiency).toBeLessThanOrEqual(1);
    });
  });

  describe('Learning and Policy Updates', () => {
    beforeEach(async () => {
      await learningEngine.initialize();
    });

    it('should learn from interaction and update policies', async () => {
      const interaction = {
        query: 'What apartments are available?',
        selectedModel: 'gpt-4',
        qualityScore: 90,
        actualCost: 0.03,
        success: true
      };

      await learningEngine.learnFromInteraction(interaction);

      // Should have added to learning buffer
      expect(learningEngine.learningBuffer.length).toBe(1);

      // Process the learning batch
      await learningEngine.processLearningBatch();

      // Should have created a policy
      expect(learningEngine.policies.size).toBeGreaterThan(0);
    });

    it('should create new policy for unknown complexity', () => {
      const complexity = 0.7;
      const policy = learningEngine.getOrCreatePolicy(complexity);

      expect(policy).toBeDefined();
      expect(policy.complexityLevel).toBe(complexity);
      expect(policy.weights).toEqual({});
      expect(policy.confidence).toBe(0);
    });

    it('should find closest policy for unknown complexity', () => {
      // Create a policy at complexity 0.5
      learningEngine.policies.set(0.5, {
        complexityLevel: 0.5,
        weights: { 'gpt-4': 0.8 },
        confidence: 0.9
      });

      // Should find the 0.5 policy for complexity 0.6
      const policy = learningEngine.getPolicyForComplexity(0.6);
      expect(policy).toBeDefined();
      expect(policy.complexityLevel).toBe(0.5);
    });

    it('should update policy weights using reinforcement learning', async () => {
      const complexity = 0.5;
      const policy = learningEngine.getOrCreatePolicy(complexity);

      // Simulate learning data
      const items = [
        {
          signals: {
            performance: 90,
            costEfficiency: 0.8,
            successRate: 1,
            contextUtilization: 0.7
          },
          interaction: { selectedModel: 'gpt-4' }
        },
        {
          signals: {
            performance: 70,
            costEfficiency: 0.6,
            successRate: 1,
            contextUtilization: 0.5
          },
          interaction: { selectedModel: 'gpt-3.5-turbo' }
        }
      ];

      await learningEngine.updatePolicyForComplexity(complexity, items);

      // Should have updated weights
      expect(policy.weights['gpt-4']).toBeGreaterThan(0);
      expect(policy.weights['gpt-3.5-turbo']).toBeGreaterThan(0);
      expect(policy.sampleSize).toBe(2);
    });

    it('should calculate policy confidence correctly', () => {
      const policy = {
        sampleSize: 50,
        rewardVariance: 0.05
      };

      const confidence = learningEngine.calculatePolicyConfidence(policy);
      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('Policy Application', () => {
    beforeEach(async () => {
      await learningEngine.initialize();

      // Create a confident policy
      learningEngine.policies.set(0.5, {
        complexityLevel: 0.5,
        weights: { 'gpt-4': 0.8, 'gpt-3.5-turbo': 0.2 },
        confidence: 0.9,
        sampleSize: 200
      });
    });

    it('should apply learned policy when confidence is high', async () => {
      const selection = {
        selectedModel: 'gpt-3.5-turbo',
        complexityScore: 0.5,
        reasoning: 'Base selection'
      };

      const context = { availableModels: ['gpt-4', 'gpt-3.5-turbo'] };

      const result = await learningEngine.applyLearnedPolicy(selection, context);

      // Should override to gpt-4 based on learned weights
      expect(result.selectedModel).toBe('gpt-4');
      expect(result.policyApplied).toBe(true);
      expect(result.confidence).toBe(0.9);
    });

    it('should not apply policy when confidence is low', async () => {
      // Create low confidence policy
      learningEngine.policies.set(0.3, {
        complexityLevel: 0.3,
        weights: { 'gpt-4': 0.6 },
        confidence: 0.5, // Below threshold
        sampleSize: 10
      });

      const selection = {
        selectedModel: 'gpt-3.5-turbo',
        complexityScore: 0.3,
        reasoning: 'Base selection'
      };

      const result = await learningEngine.applyLearnedPolicy(selection, {});

      // Should return base selection unchanged
      expect(result.selectedModel).toBe('gpt-3.5-turbo');
      expect(result.policyApplied).toBeUndefined();
    });

    it('should apply exploration when triggered', async () => {
      // Set high exploration rate for testing
      learningEngine.explorationRate = 1.0; // Always explore

      const selection = {
        selectedModel: 'gpt-4',
        complexityScore: 0.5,
        reasoning: 'Base selection'
      };

      const context = { availableModels: ['gpt-4', 'gpt-3.5-turbo', 'claude-3-haiku'] };

      const result = await learningEngine.applyExploration(selection, context);

      expect(result.exploration).toBe(true);
      expect(result.selectedModel).not.toBe('gpt-4'); // Should be different due to exploration
    });
  });

  describe('Retraining', () => {
    beforeEach(async () => {
      await learningEngine.initialize();
    });

    it('should trigger retraining when sample threshold is reached', async () => {
      learningEngine.retrainingSampleThreshold = 10;

      // Add enough samples to trigger retraining
      for (let i = 0; i < 12; i++) {
        await learningEngine.learnFromInteraction({
          query: 'test query',
          selectedModel: 'gpt-4',
          qualityScore: 80,
          actualCost: 0.02,
          success: true
        });
      }

      // Should have triggered retraining
      expect(learningEngine.lastRetrainingTime).toBeDefined();
    });

    it('should not retrain too frequently', async () => {
      learningEngine.minRetrainingInterval = 24 * 60 * 60 * 1000; // 1 day
      learningEngine.lastRetrainingTime = Date.now();

      // Try to trigger retraining immediately
      await learningEngine.checkRetrainingTrigger();

      // Should not have retrained again
      const lastTime = learningEngine.lastRetrainingTime;
      await learningEngine.triggerRetraining();
      expect(learningEngine.lastRetrainingTime).toBe(lastTime);
    });
  });

  describe('Metrics and Monitoring', () => {
    beforeEach(async () => {
      await learningEngine.initialize();
    });

    it('should calculate signal quality', () => {
      // Add some test signals
      learningEngine.learningBuffer = [
        { signals: { queryComplexity: 0.5, performance: 80, costEfficiency: 0.7, successRate: 1 } },
        { signals: { queryComplexity: 0.3, performance: 90, costEfficiency: 0.8, successRate: 1 } }
      ];

      const quality = learningEngine.calculateSignalQuality();
      expect(quality).toBe(1); // All signals are valid
    });

    it('should calculate average policy confidence', () => {
      learningEngine.policies.set(0.5, { confidence: 0.8 });
      learningEngine.policies.set(0.7, { confidence: 0.9 });

      const avgConfidence = learningEngine.calculateAveragePolicyConfidence();
      expect(avgConfidence).toBe(0.85);
    });

    it('should return comprehensive metrics', async () => {
      const metrics = await learningEngine.getMetrics();

      expect(metrics).toHaveProperty('signalQuality');
      expect(metrics).toHaveProperty('learningSpeed');
      expect(metrics).toHaveProperty('explorationRate');
      expect(metrics).toHaveProperty('policyConfidence');
      expect(metrics).toHaveProperty('activePolicies');
    });

    it('should return policies for visualization', () => {
      learningEngine.policies.set(0.5, {
        complexityLevel: 0.5,
        weights: { 'gpt-4': 0.8 },
        confidence: 0.9,
        sampleSize: 100,
        averageReward: 0.75,
        lastUpdated: new Date(),
        version: 2
      });

      const policies = learningEngine.getPolicies();

      expect(policies).toHaveLength(1);
      expect(policies[0].complexityLevel).toBe(0.5);
      expect(policies[0].weights['gpt-4']).toBe(0.8);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            data: null,
            error: new Error('Database connection failed')
          }))
        }))
      });

      await expect(learningEngine.initialize()).resolves.not.toThrow();
    });

    it('should continue processing despite individual signal failures', async () => {
      const invalidInteraction = {
        // Missing required signals
      };

      await expect(learningEngine.learnFromInteraction(invalidInteraction)).resolves.not.toThrow();
    });
  });

  describe('Integration with Model Router', () => {
    it('should integrate with model selection flow', async () => {
      const selection = {
        selectedModel: 'gpt-4o-mini',
        complexityScore: 0.5,
        reasoning: 'Base selection'
      };

      const context = {
        query: 'What are the apartment features?',
        performanceHistory: []
      };

      // Mock low confidence policy
      learningEngine.policies.set(0.5, {
        weights: {},
        confidence: 0.5
      });

      const result = await learningEngine.applyLearnedPolicy(selection, context);

      // Should return base selection due to low confidence
      expect(result).toBe(selection);
    });
  });
});