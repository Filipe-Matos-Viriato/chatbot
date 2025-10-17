// packages/backend/test/real-time-learning-engine.test.js
// Comprehensive test suite for RealTimeLearningEngine reinforcement learning system
// Tests learning algorithms, policy management, signal processing, and integration points
// real-time-learning-engine.js, supabase.js, structured-logger.js
import RealTimeLearningEngine from '../src/utils/real-time-learning-engine.js';
import supabase from '../src/config/supabase.js';

// Mock supabase
jest.mock('../src/config/supabase.js', () => ({
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      order: jest.fn(() => ({
        data: [],
        error: null
      }))
    })),
    upsert: jest.fn(() => ({
      error: null
    })),
    insert: jest.fn(() => ({
      error: null
    }))
  }))
}));

// Mock structured-logger
jest.mock('../src/utils/structured-logger.js', () => ({
  createLogger: jest.fn(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }))
}));

describe('RealTimeLearningEngine', () => {
  let learningEngine;
  let mockSupabase;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null
          }))
        })),
        upsert: jest.fn(() => ({
          error: null
        })),
        insert: jest.fn(() => ({
          error: null
        }))
      }))
    };

    // Reset supabase mock
    supabase.from.mockImplementation(mockSupabase.from);

    learningEngine = new RealTimeLearningEngine({
      windowSize: 100,
      adaptationRate: 0.1,
      explorationRate: 0.1,
      confidenceThreshold: 0.8,
      retrainingSampleThreshold: 100,
      minRetrainingInterval: 604800000
    });
  });

  describe('Initialization', () => {
    it('should initialize with default configuration', async () => {
      const engine = new RealTimeLearningEngine();
      expect(engine.config.windowSize).toBe(1000);
      expect(engine.config.adaptationRate).toBe(0.1);
      expect(engine.config.explorationRate).toBe(0.1);
      expect(engine.config.confidenceThreshold).toBe(0.8);
    });

    it('should load existing policies from database', async () => {
      const mockPolicies = [
        {
          complexity_level: 0.5,
          policy_weights: { 'gpt-4o-mini': 0.8 },
          confidence_score: 0.9,
          sample_size: 100,
          average_reward: 0.75,
          reward_variance: 0.1,
          last_updated: new Date().toISOString(),
          version: 1
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

      expect(learningEngine.policies.size).toBe(1);
      expect(learningEngine.policies.get(0.5)).toBeDefined();
    });
  });

  describe('Signal Processing', () => {
    it('should extract learning signals from interaction', async () => {
      const interaction = {
        queryComplexity: 0.7,
        selectedModel: 'gpt-4o-mini',
        actualCost: 0.02,
        qualityScore: 0.85,
        responseTime: 1200,
        success: true,
        tokenUsage: 150,
        userSatisfaction: 0.9,
        conversationDepth: 3,
        userEngagement: 0.8,
        queryDiversity: 0.6
      };

      const signals = await learningEngine.extractLearningSignals(interaction);

      expect(signals.queryComplexity).toBe(0.7);
      expect(signals.performance).toBeGreaterThan(0);
      expect(signals.costEfficiency).toBeGreaterThan(0);
      expect(signals.successRate).toBe(1);
      expect(signals.engagementSignals).toBeDefined();
    });

    it('should validate signal quality', () => {
      const validSignals = {
        queryComplexity: 0.5,
        performance: 85,
        costEfficiency: 0.8,
        contextUtilization: 0.6,
        successRate: 1
      };

      const invalidSignals = {
        queryComplexity: 1.5, // Invalid range
        performance: 150, // Invalid range
        costEfficiency: 0.8,
        contextUtilization: 0.6,
        successRate: 1
      };

      expect(learningEngine.validateSignals(validSignals)).toBe(true);
      expect(learningEngine.validateSignals(invalidSignals)).toBe(false);
    });
  });

  describe('Policy Management', () => {
    it('should create new policy for unknown complexity', () => {
      const policy = learningEngine.getOrCreatePolicy(0.3);

      expect(policy.complexityLevel).toBe(0.3);
      expect(policy.weights).toEqual({});
      expect(policy.confidence).toBe(0);
      expect(policy.sampleSize).toBe(0);
    });

    it('should retrieve existing policy for known complexity', () => {
      const existingPolicy = {
        complexityLevel: 0.5,
        weights: { 'gpt-4o-mini': 0.8 },
        confidence: 0.9
      };
      learningEngine.policies.set(0.5, existingPolicy);

      const policy = learningEngine.getPolicyForComplexity(0.5);
      expect(policy).toBe(existingPolicy);
    });

    it('should find closest policy for unknown complexity', () => {
      learningEngine.policies.set(0.4, { complexityLevel: 0.4 });
      learningEngine.policies.set(0.6, { complexityLevel: 0.6 });

      const policy = learningEngine.getPolicyForComplexity(0.45);
      expect(policy.complexityLevel).toBe(0.4);
    });
  });

  describe('Learning Batch Processing', () => {
    it('should process learning batch when buffer is full', async () => {
      // Fill buffer to trigger processing
      for (let i = 0; i < 101; i++) {
        learningEngine.learningBuffer.push({
          signals: {
            queryComplexity: 0.5,
            performance: 80,
            costEfficiency: 0.7,
            contextUtilization: 0.6,
            successRate: 1
          }
        });
      }

      await learningEngine.processLearningBatch();

      expect(learningEngine.learningBuffer.length).toBe(0);
    });

    it('should update policy statistics correctly', async () => {
      const interactions = [
        { signals: { queryComplexity: 0.5, performance: 80, costEfficiency: 0.7, contextUtilization: 0.6, successRate: 1 } },
        { signals: { queryComplexity: 0.5, performance: 90, costEfficiency: 0.8, contextUtilization: 0.7, successRate: 1 } }
      ];

      await learningEngine.updatePolicyForComplexity(0.5, interactions);

      const policy = learningEngine.policies.get(0.5);
      expect(policy.sampleSize).toBe(2);
      expect(policy.averageReward).toBeGreaterThan(0);
    });
  });

  describe('Exploration Strategy', () => {
    it('should apply exploration when random condition met', () => {
      // Mock Math.random to return exploration rate
      jest.spyOn(Math, 'random').mockReturnValue(0.05); // Below exploration rate

      const selection = { selectedModel: 'gpt-4o-mini', complexityScore: 0.5 };
      const result = learningEngine.applyExploration(selection, {});

      expect(result.exploration).toBe(true);
      expect(result.reasoning).toContain('Exploration');
    });

    it('should prioritize under-explored models', () => {
      learningEngine.explorationState.underExploredModels.add('gpt-5');

      const selection = { selectedModel: 'gpt-4o-mini', complexityScore: 0.5 };
      const result = learningEngine.applyExploration(selection, {});

      expect(result.selectedModel).toBe('gpt-5');
    });
  });

  describe('Policy Application', () => {
    it('should apply learned policy adjustments', () => {
      const policy = {
        weights: { 'gpt-4o-mini': 0.8, 'gpt-5': 0.6 },
        confidence: 0.9
      };

      const selection = {
        selectedModel: 'gpt-4o-mini',
        complexityScore: 0.5
      };

      const result = learningEngine.applyPolicyAdjustments(selection, policy);

      expect(result.confidence).toBe(0.9);
      expect(result.policyApplied).toBe(true);
      expect(result.reasoning).toContain('Policy-based selection');
    });

    it('should fallback to base selection when confidence is low', async () => {
      const policy = {
        weights: {},
        confidence: 0.5 // Below threshold
      };

      const selection = { selectedModel: 'gpt-4o-mini' };
      const context = {};

      const result = await learningEngine.applyLearnedPolicy(selection, context);

      expect(result).toBe(selection); // Should return base selection
    });
  });

  describe('Retraining Logic', () => {
    it('should trigger retraining when sample threshold reached', async () => {
      // Mock large sample size
      learningEngine.policies.set(0.5, { sampleSize: 1001 });

      const triggerSpy = jest.spyOn(learningEngine, 'triggerRetraining').mockResolvedValue();

      await learningEngine.checkRetrainingTrigger();

      expect(triggerSpy).toHaveBeenCalled();
    });

    it('should not trigger retraining too frequently', async () => {
      learningEngine.lastRetrainingTime = Date.now() - 100000; // Recent retraining
      learningEngine.policies.set(0.5, { sampleSize: 1001 });

      const triggerSpy = jest.spyOn(learningEngine, 'triggerRetraining').mockResolvedValue();

      await learningEngine.checkRetrainingTrigger();

      expect(triggerSpy).not.toHaveBeenCalled();
    });
  });

  describe('Metrics and Monitoring', () => {
    it('should calculate learning metrics', async () => {
      // Add some learning data
      learningEngine.learningBuffer = [
        { signals: { queryComplexity: 0.5, performance: 80, costEfficiency: 0.7, contextUtilization: 0.6, successRate: 1 } },
        { signals: { queryComplexity: 0.5, performance: 90, costEfficiency: 0.8, contextUtilization: 0.7, successRate: 1 } }
      ];

      const metrics = await learningEngine.getMetrics();

      expect(metrics).toHaveProperty('signalQuality');
      expect(metrics).toHaveProperty('learningSpeed');
      expect(metrics).toHaveProperty('explorationRate');
      expect(metrics).toHaveProperty('policyConfidence');
    });

    it('should return policy data', () => {
      learningEngine.policies.set(0.5, {
        complexityLevel: 0.5,
        confidence: 0.8,
        sampleSize: 100,
        averageReward: 0.75,
        lastUpdated: new Date()
      });

      const policies = learningEngine.getPolicies();

      expect(policies).toHaveLength(1);
      expect(policies[0].complexityLevel).toBe(0.5);
      expect(policies[0].confidence).toBe(0.8);
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

      await expect(learningEngine.initialize()).rejects.toThrow();
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