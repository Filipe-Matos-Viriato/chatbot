/**
 * A/B Testing Framework Tests
 * Tests experiment creation, execution, and statistical analysis
 */

import sinon from 'sinon';
import { expect } from 'chai';
import abTestingFramework from '../src/utils/ab-testing-framework.js';
import supabase from '../src/config/supabase.js';

// Mock supabase
sinon.stub(supabase, 'from').returns({
  select: sinon.stub().returns({
    eq: sinon.stub().returns({
      order: sinon.stub().returns({
        limit: sinon.stub().returns({
          single: sinon.stub().resolves({ data: null, error: null })
        })
      }),
      single: sinon.stub().resolves({ data: null, error: null })
    }),
    insert: sinon.stub().resolves({ error: null }),
    update: sinon.stub().resolves({ error: null })
  })
});

describe('ABTestingFramework', () => {
  beforeEach(() => {
    sinon.resetHistory();
    abTestingFramework.activeTests.clear();
  });

  describe('createTest', () => {
    it('should create a valid A/B test', async () => {
      const testConfig = {
        name: 'Cost Optimization Test',
        description: 'Testing cost optimization strategies',
        clientId: 'test-client',
        variants: {
          control: 'current_model',
          test: ['cheaper_model', 'faster_model']
        },
        metrics: {
          primary: ['cost_per_request', 'response_time'],
          secondary: ['success_rate']
        },
        targeting: {
          percentage: 50,
          filters: {}
        }
      };

      const test = await abTestingFramework.createTest(testConfig);

      expect(test.id).to.match(/^test_\d+_/);
      expect(test.name).to.equal('Cost Optimization Test');
      expect(test.clientId).to.equal('test-client');
      expect(test.status).to.equal('draft');
      expect(test.variants.control).to.equal('current_model');
      expect(test.variants.test).to.deep.equal(['cheaper_model', 'faster_model']);
      expect(test.metrics.primary).to.deep.equal(['cost_per_request', 'response_time']);
    });

    it('should validate test configuration', async () => {
      const invalidConfig = {
        name: '', // Invalid: empty name
        clientId: 'test-client',
        variants: {
          control: 'control',
          test: []
        },
        metrics: {
          primary: [], // Invalid: no primary metrics
          secondary: []
        }
      };

      await expect(abTestingFramework.createTest(invalidConfig)).rejects.toThrow();
    });
  });

  describe('startTest', () => {
    it('should start a draft test', async () => {
      // Create a test first
      const testConfig = {
        name: 'Test Experiment',
        description: 'Testing experiment',
        clientId: 'test-client',
        variants: { control: 'control', test: ['variant1'] },
        metrics: { primary: ['metric1'], secondary: [] },
        targeting: { percentage: 100, filters: {} }
      };

      const test = await abTestingFramework.createTest(testConfig);
      abTestingFramework.activeTests.set(test.id, test);

      const result = await abTestingFramework.startTest(test.id);

      expect(result).to.equal(true);
      expect(abTestingFramework.activeTests.get(test.id).status).to.equal('running');
    });

    it('should reject starting non-draft tests', async () => {
      const test = {
        id: 'test-123',
        status: 'running', // Already running
        name: 'Test',
        clientId: 'client',
        variants: { control: 'control', test: ['variant1'] },
        metrics: { primary: ['metric1'], secondary: [] },
        targeting: { percentage: 100, filters: {} },
        schedule: { startDate: new Date(), endDate: new Date() },
        results: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      abTestingFramework.activeTests.set(test.id, test);

      await expect(abTestingFramework.startTest(test.id)).to.be.rejectedWith('not in draft status');
    });
  });

  describe('assignUserToVariant', () => {
    it('should assign user to control variant', async () => {
      const test = {
        id: 'test-123',
        status: 'running',
        clientId: 'test-client',
        variants: { control: 'control', test: ['variant1'] },
        targeting: { percentage: 100, filters: {} },
        schedule: { startDate: new Date(Date.now() - 1000), endDate: new Date(Date.now() + 86400000) },
        results: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      abTestingFramework.activeTests.set(test.id, test);

      // Mock user assignment storage
      abTestingFramework.storeUserAssignment = jest.fn().mockResolvedValue();

      const variant = await abTestingFramework.assignUserToVariant('test-client', 'user-123', test.id);

      expect(variant).to.be.ok;
      expect(['control', 'variant1']).to.include(variant);
      expect(abTestingFramework.storeUserAssignment).to.have.been.calledWith(test.id, 'user-123', variant);
    });

    it('should return null when no applicable test', async () => {
      const variant = await abTestingFramework.assignUserToVariant('test-client', 'user-123');
      expect(variant).toBeNull();
    });

    it('should respect targeting percentage', async () => {
      const test = {
        id: 'test-123',
        status: 'running',
        clientId: 'test-client',
        variants: { control: 'control', test: ['variant1'] },
        targeting: { percentage: 0, filters: {} }, // 0% targeting
        schedule: { startDate: new Date(), endDate: new Date(Date.now() + 86400000) },
        results: {},
        createdAt: new Date(),
        updatedAt: new Date()
      };

      abTestingFramework.activeTests.set(test.id, test);

      const variant = await abTestingFramework.assignUserToVariant('test-client', 'user-123', test.id);

      expect(variant).to.equal(null); // Should not assign due to 0% targeting
    });
  });

  describe('recordMetric', () => {
    it('should record metrics for test variants', async () => {
      await abTestingFramework.recordMetric('test-123', 'user-456', 'control', 'cost_per_request', 0.015, { source: 'api' });

      expect(supabase.from).toHaveBeenCalledWith('ab_test_metrics');
      expect(supabase.from().insert).toHaveBeenCalledWith({
        test_id: 'test-123',
        user_id: 'user-456',
        variant: 'control',
        metric_name: 'cost_per_request',
        value: 0.015,
        metadata: '{"source":"api"}',
        recorded_at: expect.any(String)
      });
    });
  });

  describe('calculateTestResults', () => {
    it('should calculate results for completed test', async () => {
      const test = {
        id: 'test-123',
        variants: { control: 'control', test: ['variant1'] },
        metrics: { primary: ['cost_per_request'], secondary: [] }
      };

      // Mock metric data
      const mockMetrics = {
        sampleSize: 100,
        averages: { cost_per_request: 0.012 }
      };

      abTestingFramework.getVariantMetrics = jest.fn().mockResolvedValue(mockMetrics);

      const results = await abTestingFramework.calculateTestResults(test);

      expect(results).to.have.lengthOf(2); // control + 1 test variant
      expect(results[0]).to.have.property('variantId');
      expect(results[0]).to.have.property('sampleSize');
      expect(results[0]).to.have.property('metrics');
      expect(results[0]).to.have.property('confidence');
    });
  });

  describe('checkStatisticalSignificance', () => {
    it('should detect statistically significant results', () => {
      const results = [
        {
          variantId: 'control',
          sampleSize: 1000,
          metrics: { cost_per_request: 0.015 },
          improvement: 0,
          pValue: 1.0
        },
        {
          variantId: 'variant1',
          sampleSize: 1000,
          metrics: { cost_per_request: 0.012 },
          improvement: 20, // 20% improvement
          pValue: 0.01 // Significant
        }
      ];

      const significant = abTestingFramework.checkStatisticalSignificance(results);

      expect(significant).to.have.lengthOf(1);
      expect(significant[0].variant).to.equal('variant1');
      expect(significant[0].improvement).to.equal(20);
      expect(significant[0].pValue).to.equal(0.01);
    });

    it('should return empty array for insignificant results', () => {
      const results = [
        {
          variantId: 'control',
          sampleSize: 100,
          metrics: { cost_per_request: 0.015 },
          improvement: 0,
          pValue: 1.0
        },
        {
          variantId: 'variant1',
          sampleSize: 100,
          metrics: { cost_per_request: 0.014 },
          improvement: 5, // 5% improvement
          pValue: 0.20 // Not significant
        }
      ];

      const significant = abTestingFramework.checkStatisticalSignificance(results);

      expect(significant).to.have.lengthOf(0);
    });
  });

  describe('calculateConfidenceIntervals', () => {
    it('should calculate confidence intervals for metrics', () => {
      const variantMetrics = {
        sampleSize: 100,
        averages: { cost_per_request: 0.015 },
        rawValues: { cost_per_request: [0.01, 0.02] } // Mock raw values
      };

      const intervals = abTestingFramework.calculateConfidenceIntervals(variantMetrics);

      expect(intervals).toHaveProperty('cost_per_request');
      expect(intervals.cost_per_request).toHaveProperty('lower');
      expect(intervals.cost_per_request).toHaveProperty('upper');
      expect(intervals.cost_per_request).toHaveProperty('marginOfError');
    });
  });

  describe('calculatePValue', () => {
    it('should calculate statistical significance', () => {
      const control = {
        sampleSize: 1000,
        metrics: { cost_per_request: 0.015 }
      };

      const variant = {
        sampleSize: 1000,
        metrics: { cost_per_request: 0.012 }
      };

      const pValue = abTestingFramework.calculatePValue(control, variant);

      expect(pValue).toBeGreaterThan(0);
      expect(pValue).toBeLessThanOrEqual(1);
    });
  });

  describe('assignVariant', () => {
    it('should assign variants consistently', () => {
      const test = {
        variants: { control: 'control', test: ['variant1', 'variant2'] },
        targeting: { percentage: 100, filters: {} }
      };

      // Same user should get same variant consistently
      const variant1 = abTestingFramework.assignVariant(test, 'user-123');
      const variant2 = abTestingFramework.assignVariant(test, 'user-123');

      expect(variant1).to.equal(variant2);
      expect(['control', 'variant1', 'variant2']).to.include(variant1);
    });

    it('should distribute users across variants', () => {
      const test = {
        variants: { control: 'control', test: ['variant1'] },
        targeting: { percentage: 100, filters: {} }
      };

      const assignments = new Set();
      for (let i = 0; i < 100; i++) {
        const variant = abTestingFramework.assignVariant(test, `user-${i}`);
        assignments.add(variant);
      }

      expect(assignments.size).to.be.greaterThan(1); // Should assign to multiple variants
    });
  });

  describe('evaluateTest', () => {
    it('should complete test when statistically significant', async () => {
      const test = {
        id: 'test-123',
        schedule: { endDate: new Date(Date.now() + 86400000) }, // Not ended
        metrics: { primary: ['cost_per_request'], secondary: [] },
        variants: { control: 'control', test: ['variant1'] }
      };

      // Mock significant results
      abTestingFramework.calculateTestResults = jest.fn().mockResolvedValue([
        { variantId: 'control', pValue: 1.0, improvement: 0 },
        { variantId: 'variant1', pValue: 0.01, improvement: 15 } // Significant
      ]);

      abTestingFramework.checkStatisticalSignificance = jest.fn().mockReturnValue([
        { variant: 'variant1', improvement: 15, pValue: 0.01 }
      ]);

      const shouldComplete = await abTestingFramework.evaluateTest(test);

      expect(shouldComplete).to.equal(true);
      expect(test.results.completionReason).to.equal('statistical_significance');
      expect(test.results.significantFindings).to.have.lengthOf(1);
    });

    it('should complete test when scheduled end date reached', async () => {
      const test = {
        id: 'test-123',
        schedule: { endDate: new Date(Date.now() - 1000) }, // Already ended
        metrics: { primary: ['cost_per_request'], secondary: [] },
        variants: { control: 'control', test: ['variant1'] }
      };

      const shouldComplete = await abTestingFramework.evaluateTest(test);

      expect(shouldComplete).to.equal(true);
      expect(test.results.completionReason).to.equal('scheduled_end');
    });

    it('should not complete test with insufficient data', async () => {
      const test = {
        id: 'test-123',
        schedule: { endDate: new Date(Date.now() + 86400000) },
        metrics: { primary: ['cost_per_request'], secondary: [] },
        variants: { control: 'control', test: ['variant1'] }
      };

      // Mock insufficient sample size
      abTestingFramework.getVariantMetrics = jest.fn().mockResolvedValue({ sampleSize: 10 });

      const shouldComplete = await abTestingFramework.evaluateTest(test);

      expect(shouldComplete).to.equal(false);
    });
  });

  describe('getClientTests', () => {
    it('should retrieve tests for a client', async () => {
      const mockTests = [
        {
          id: 'test-1',
          name: 'Test 1',
          client_id: 'test-client',
          status: 'running',
          variants: '{"control":"control","test":["variant1"]}',
          metrics: '{"primary":["metric1"],"secondary":[]}',
          targeting: '{"percentage":50,"filters":{}}',
          schedule: '{"startDate":"2024-01-01T00:00:00.000Z","endDate":"2024-01-08T00:00:00.000Z"}',
          results: '{}',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z'
        }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ data: mockTests, error: null }))
            }))
          }))
        }))
      });

      const tests = await abTestingFramework.getClientTests('test-client');

      expect(tests).to.have.lengthOf(1);
      expect(tests[0].id).to.equal('test-1');
      expect(tests[0].name).to.equal('Test 1');
      expect(tests[0].status).to.equal('running');
    });
  });

  describe('validateTestConfig', () => {
    it('should accept valid configuration', () => {
      const validConfig = {
        name: 'Valid Test',
        clientId: 'client-123',
        variants: { control: 'control', test: ['variant1'] },
        metrics: { primary: ['metric1'], secondary: [] },
        targeting: { percentage: 50, filters: {} },
        schedule: { startDate: new Date(), endDate: new Date() }
      };

      expect(() => abTestingFramework.validateTestConfig(validConfig)).to.not.throw();
    });

    it('should reject invalid configurations', () => {
      const invalidConfigs = [
        { name: '', clientId: 'client' }, // No name
        { name: 'Test', variants: { control: 'control', test: [] } }, // No test variants
        { name: 'Test', variants: { control: 'control', test: ['v1'] }, metrics: { primary: [] } } // No primary metrics
      ];

      invalidConfigs.forEach(config => {
        expect(() => abTestingFramework.validateTestConfig(config)).to.throw();
      });
    });
  });
});