/**
 * Predictive Analytics Service Tests
 * Tests forecasting, optimization, and recommendation algorithms
 */

import sinon from 'sinon';
import { expect } from 'chai';
import predictiveAnalytics from '../src/utils/predictive-analytics.js';
import supabase from '../src/config/supabase.js';

// Mock supabase
sinon.stub(supabase, 'from').returns({
  select: sinon.stub().returns({
    eq: sinon.stub().returns({
      gte: sinon.stub().returns({
        order: sinon.stub().returns({
          limit: sinon.stub().resolves({ data: [], error: null })
        })
      })
    })
  })
});

describe('PredictiveAnalytics', () => {
  beforeEach(() => {
    sinon.resetHistory();
  });

  describe('generateUsageForecast', () => {
    it('should generate forecast with sufficient historical data', async () => {
      const mockHistoricalData = [
        { created_at: '2024-01-01T10:00:00Z', client_id: 'test-client' },
        { created_at: '2024-01-02T10:00:00Z', client_id: 'test-client' },
        { created_at: '2024-01-03T10:00:00Z', client_id: 'test-client' }
      ];

      supabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              order: sinon.stub().returns({
                limit: sinon.stub().resolves({ data: mockHistoricalData, error: null })
              })
            })
          })
        })
      });

      const result = await predictiveAnalytics.generateUsageForecast('test-client', { timeRange: '7d' });

      expect(result).to.have.property('predictedRequests');
      expect(result).to.have.property('confidenceInterval');
      expect(result).to.have.property('seasonalPatterns');
      expect(result).to.have.property('trendAnalysis');
    });

    it('should return fallback forecast with insufficient data', async () => {
      supabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              order: sinon.stub().returns({
                limit: sinon.stub().resolves({ data: [], error: null })
              })
            })
          })
        })
      });

      const result = await predictiveAnalytics.generateUsageForecast('test-client');

      expect(result.predictedRequests).to.equal(1000); // Fallback value
      expect(result.forecastMethod).to.equal('fallback');
    });
  });

  describe('predictModelPerformance', () => {
    it('should predict performance for multiple models', async () => {
      const mockHistoricalData = [
        { response_time_ms: 1500, actual_cost: 0.01, model_selected: 'gpt-4o-mini' },
        { response_time_ms: 2000, actual_cost: 0.02, model_selected: 'gpt-3.5-turbo' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ data: mockHistoricalData, error: null }))
              }))
            }))
          }))
        }))
      });

      const models = ['gpt-4o-mini', 'gpt-3.5-turbo'];
      const result = await predictiveAnalytics.predictModelPerformance('test-client', models);

      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.have.property('model');
      expect(result[0]).to.have.property('predictedResponseTime');
      expect(result[0]).to.have.property('predictedCostPerRequest');
      expect(result[0]).to.have.property('predictedSuccessRate');
    });
  });

  describe('generateCostOptimization', () => {
    it('should generate cost optimization recommendations', async () => {
      const mockCostData = [
        { actual_cost: 0.02, model_selected: 'gpt-4o', created_at: '2024-01-01T00:00:00Z' },
        { actual_cost: 0.01, model_selected: 'gpt-4o-mini', created_at: '2024-01-01T00:00:00Z' }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: mockCostData, error: null }))
            }))
          }))
        }))
      });

      const currentUsage = { totalRequests: 1000, costPerRequest: 0.015 };
      const result = await predictiveAnalytics.generateCostOptimization('test-client', currentUsage);

      expect(result).to.have.property('currentCostPerRequest');
      expect(result).to.have.property('projectedSavings');
      expect(result).to.have.property('optimalModelDistribution');
      expect(result).to.have.property('recommendations');
    });
  });

  describe('getModelSelectionRecommendations', () => {
    it('should provide model selection recommendations', async () => {
      const mockPerformanceData = [
        { model_selected: 'gpt-4o-mini', response_time_ms: 1500, actual_cost: 0.01 }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => Promise.resolve({ data: mockPerformanceData, error: null }))
          }))
        }))
      });

      const queryCharacteristics = { complexity: 0.5, tokenBudget: 1000 };
      const result = await predictiveAnalytics.getModelSelectionRecommendations('test-client', queryCharacteristics);

      expect(result).to.have.property('recommendedModel');
      expect(result).to.have.property('alternatives');
      expect(result).to.have.property('reasoning');
      expect(result).to.have.property('expectedPerformance');
    });
  });

  describe('calculateTrendAnalysis', () => {
    it('should calculate growth trends from historical data', () => {
      const historicalData = [
        { created_at: '2024-01-01T00:00:00Z' },
        { created_at: '2024-01-01T00:00:00Z' }, // 2 requests on day 1
        { created_at: '2024-01-02T00:00:00Z' },
        { created_at: '2024-01-02T00:00:00Z' },
        { created_at: '2024-01-02T00:00:00Z' }  // 3 requests on day 2
      ];

      const result = predictiveAnalytics.calculateTrendAnalysis(historicalData);

      expect(result).to.have.lengthOf(1); // One trend period
      expect(result[0]).to.have.property('period');
      expect(result[0]).to.have.property('requests');
      expect(result[0]).to.have.property('growthRate');
    });

    it('should return empty array for insufficient data', () => {
      const result = predictiveAnalytics.calculateTrendAnalysis([]);
      expect(result).toEqual([]);
    });
  });

  describe('analyzeSeasonalPatterns', () => {
    it('should analyze day-of-week patterns', () => {
      const historicalData = [
        { created_at: '2024-01-01T00:00:00Z' }, // Monday (1)
        { created_at: '2024-01-02T00:00:00Z' }, // Tuesday (2)
        { created_at: '2024-01-02T00:00:00Z' }  // Tuesday (2)
      ];

      const result = predictiveAnalytics.analyzeSeasonalPatterns(historicalData);

      expect(result).toHaveLength(7); // All days of week
      const mondayPattern = result.find(p => p.dayOfWeek === 'Monday');
      const tuesdayPattern = result.find(p => p.dayOfWeek === 'Tuesday');

      expect(mondayPattern.multiplier).toBeLessThan(tuesdayPattern.multiplier);
    });
  });

  describe('generateMultiMethodForecast', () => {
    it('should generate forecast using exponential smoothing', async () => {
      const historicalData = Array(10).fill().map((_, i) => ({
        created_at: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`
      }));

      const trendAnalysis = [{ period: '2024-01-10', requests: 10, growthRate: 5 }];
      const seasonalPatterns = [{ dayOfWeek: 'Monday', multiplier: 1.2 }];

      const result = await predictiveAnalytics.generateMultiMethodForecast(
        historicalData, trendAnalysis, seasonalPatterns
      );

      expect(result).toHaveProperty('predictedRequests');
      expect(result).toHaveProperty('confidenceInterval');
      expect(result.confidenceInterval).toHaveProperty('lower');
      expect(result.confidenceInterval).toHaveProperty('upper');
      expect(result.method).toBe('exponential_smoothing');
    });
  });

  describe('scoreModelsForQuery', () => {
    it('should score models based on multiple criteria', () => {
      const historicalPerformance = {
        'gpt-4o-mini': {
          avgResponseTime: 1500,
          avgCost: 0.01,
          responseTimes: [1400, 1600],
          costs: [0.009, 0.011]
        },
        'gpt-3.5-turbo': {
          avgResponseTime: 1000,
          avgCost: 0.005,
          responseTimes: [900, 1100],
          costs: [0.004, 0.006]
        }
      };

      const costConstraints = { maxCostPerRequest: 0.05, monthlyBudget: 1000 };
      const predictions = [
        { model: 'gpt-4o-mini', predictedCostPerRequest: 0.01, predictedResponseTime: 1500 },
        { model: 'gpt-3.5-turbo', predictedCostPerRequest: 0.005, predictedResponseTime: 1000 }
      ];

      const queryCharacteristics = { complexity: 0.5, tokenBudget: 1000 };

      const result = predictiveAnalytics.scoreModelsForQuery(
        queryCharacteristics,
        historicalPerformance,
        costConstraints,
        predictions
      );

      expect(result).to.have.lengthOf(2);
      expect(result[0]).to.have.property('model');
      expect(result[0]).to.have.property('totalScore');
      expect(result[0]).to.have.property('scores');
      expect(result[0]).to.have.property('predictedCost');
      expect(result[0]).to.have.property('predictedTime');

      // Should be sorted by score (higher is better)
      expect(result[0].totalScore).to.be.greaterThanOrEqual(result[1].totalScore);
    });
  });

  describe('calculateComplexityMatch', () => {
    it('should calculate complexity match score', () => {
      const match = predictiveAnalytics.calculateComplexityMatch('gpt-4o-mini', 0.6);
      expect(match).to.be.greaterThan(0);
      expect(match).to.be.lessThanOrEqual(1);
    });
  });

  describe('calculateQualityMatch', () => {
    it('should calculate quality match score', () => {
      const match = predictiveAnalytics.calculateQualityMatch('gpt-4o-mini', 'standard');
      expect(match).to.be.greaterThan(0);
      expect(match).to.be.lessThanOrEqual(1);
    });
  });
});