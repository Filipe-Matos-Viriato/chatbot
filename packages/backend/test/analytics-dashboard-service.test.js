/**
 * Analytics Dashboard Service Tests - Phase 3
 * Tests the unified dashboard service with predictive analytics and optimization
 */

import sinon from 'sinon';
import { expect } from 'chai';
import analyticsDashboardService from '../src/services/analytics-dashboard-service.js';
import supabase from '../src/config/supabase.js';

// Mock all dependencies
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

// Import mocked modules
import advancedAnalyticsLogger from '../src/utils/advanced-analytics-logger.js';
import predictiveAnalytics from '../src/utils/predictive-analytics.js';
import optimizationEngine from '../src/utils/optimization-engine.js';
import abTestingFramework from '../src/utils/ab-testing-framework.js';

// Mock the modules
sinon.stub(advancedAnalyticsLogger, 'getClientRealTimeMetrics').resolves({});
sinon.stub(advancedAnalyticsLogger, 'calculatePerformanceMetrics').resolves({});
sinon.stub(predictiveAnalytics, 'generateUsageForecast').resolves({});
sinon.stub(predictiveAnalytics, 'generateCostOptimization').resolves({});
sinon.stub(predictiveAnalytics, 'predictModelPerformance').resolves([]);
sinon.stub(optimizationEngine, 'getActiveAlerts').resolves([]);
sinon.stub(optimizationEngine, 'getRecommendations').resolves([]);
sinon.stub(abTestingFramework, 'getClientTests').resolves([]);

describe('AnalyticsDashboardService', () => {
  beforeEach(() => {
    sinon.resetHistory();
    analyticsDashboardService.cache.clear();
  });

  describe('getDashboardData', () => {
    it('should return comprehensive dashboard data', async () => {
      // Mock all service responses
      const mockRealTimeMetrics = {
        totalRequests: 1000,
        totalCost: 15.00,
        avgResponseTime: 1500
      };

      const mockPredictions = {
        usageForecast: { predictedRequests: 1200 },
        costOptimization: { projectedSavings: 25.50 }
      };

      const mockAlerts = [
        { id: 'alert-1', type: 'cost_anomaly', severity: 'warning' }
      ];

      const mockRecommendations = [
        { id: 'rec-1', type: 'cost_optimization', priority: 'high' }
      ];

      const mockActiveTests = [
        { id: 'test-1', name: 'Cost Test', status: 'running' }
      ];

      const mockPerformanceMetrics = {
        totalRequests: 1000,
        avgResponseTime: 1500,
        totalCost: 15.00
      };

      // Setup mocks
      advancedAnalyticsLogger.getClientRealTimeMetrics = jest.fn().mockResolvedValue(mockRealTimeMetrics);
      predictiveAnalytics.generateUsageForecast = jest.fn().mockResolvedValue(mockPredictions.usageForecast);
      predictiveAnalytics.generateCostOptimization = jest.fn().mockResolvedValue(mockPredictions.costOptimization);
      predictiveAnalytics.predictModelPerformance = jest.fn().mockResolvedValue([]);
      optimizationEngine.getActiveAlerts = jest.fn().mockResolvedValue(mockAlerts);
      optimizationEngine.getRecommendations = jest.fn().mockResolvedValue(mockRecommendations);
      abTestingFramework.getClientTests = jest.fn().mockResolvedValue(mockActiveTests);
      advancedAnalyticsLogger.calculatePerformanceMetrics = jest.fn().mockResolvedValue(mockPerformanceMetrics);

      const result = await analyticsDashboardService.getDashboardData('test-client');

      expect(result).to.have.property('realTime');
      expect(result).to.have.property('predictions');
      expect(result).to.have.property('alerts');
      expect(result).to.have.property('recommendations');
      expect(result).to.have.property('activeTests');
      expect(result).to.have.property('performance');
      expect(result).to.have.property('generatedAt');

      expect(result.realTime).to.deep.equal(mockRealTimeMetrics);
      expect(result.predictions).to.deep.equal(mockPredictions);
      expect(result.alerts).to.deep.equal(mockAlerts);
      expect(result.recommendations).to.deep.equal(mockRecommendations);
      expect(result.activeTests).to.deep.equal(mockActiveTests);
    });

    it('should handle optional features', async () => {
      // Mock minimal responses
      advancedAnalyticsLogger.getClientRealTimeMetrics = jest.fn().mockResolvedValue({});
      predictiveAnalytics.generateUsageForecast = jest.fn().mockResolvedValue({});
      predictiveAnalytics.generateCostOptimization = jest.fn().mockResolvedValue({});
      predictiveAnalytics.predictModelPerformance = jest.fn().mockResolvedValue([]);
      optimizationEngine.getActiveAlerts = jest.fn().mockResolvedValue([]);
      optimizationEngine.getRecommendations = jest.fn().mockResolvedValue([]);
      abTestingFramework.getClientTests = jest.fn().mockResolvedValue([]);
      advancedAnalyticsLogger.calculatePerformanceMetrics = jest.fn().mockResolvedValue({});

      const result = await analyticsDashboardService.getDashboardData('test-client', {
        includePredictions: false,
        includeAlerts: false,
        includeTests: false
      });

      expect(result.predictions).to.deep.equal({});
      expect(result.alerts).to.deep.equal([]);
      expect(result.activeTests).to.deep.equal([]);
    });
  });

  describe('getRealTimeMetrics', () => {
    it('should return cached data when available', async () => {
      const cachedData = { totalRequests: 500, cached: true };
      analyticsDashboardService.setCached('realtime_test-client', cachedData);

      const result = await analyticsDashboardService.getRealTimeMetrics('test-client');

      expect(result).to.deep.equal(cachedData);
      expect(advancedAnalyticsLogger.getClientRealTimeMetrics).not.to.have.been.called;
    });

    it('should fetch fresh data when cache expired', async () => {
      const freshData = { totalRequests: 1000, totalCost: 15.00 };
      advancedAnalyticsLogger.getClientRealTimeMetrics = jest.fn().mockResolvedValue(freshData);

      // Mock additional methods
      analyticsDashboardService.getActiveUsersCount = jest.fn().mockResolvedValue(50);
      analyticsDashboardService.getQueueDepth = jest.fn().mockResolvedValue(0);
      analyticsDashboardService.getCurrentErrorRate = jest.fn().mockResolvedValue(0.02);

      const result = await analyticsDashboardService.getRealTimeMetrics('test-client');

      expect(result.totalRequests).toBe(1000);
      expect(result.activeUsers).toBe(50);
      expect(result.queueDepth).toBe(0);
      expect(result.errorRate).toBe(0.02);
      expect(result.lastUpdated).toBeDefined();
    });
  });

  describe('getPredictions', () => {
    it('should aggregate predictive analytics', async () => {
      const mockForecast = { predictedRequests: 1200 };
      const mockOptimization = { projectedSavings: 25.50 };
      const mockPredictions = [
        { model: 'gpt-4o-mini', predictedResponseTime: 1500 }
      ];

      predictiveAnalytics.generateUsageForecast = jest.fn().mockResolvedValue(mockForecast);
      predictiveAnalytics.generateCostOptimization = jest.fn().mockResolvedValue(mockOptimization);
      predictiveAnalytics.predictModelPerformance = jest.fn().mockResolvedValue(mockPredictions);

      const result = await analyticsDashboardService.getPredictions('test-client');

      expect(result.usageForecast).toEqual(mockForecast);
      expect(result.costOptimization).toEqual(mockOptimization);
      expect(result.modelPredictions).toEqual(mockPredictions);
      expect(result.generatedAt).toBeDefined();
    });

    it('should handle prediction errors gracefully', async () => {
      predictiveAnalytics.generateUsageForecast = jest.fn().mockRejectedValue(new Error('Forecast failed'));
      predictiveAnalytics.generateCostOptimization = jest.fn().mockResolvedValue({});
      predictiveAnalytics.predictModelPerformance = jest.fn().mockResolvedValue([]);

      const result = await analyticsDashboardService.getPredictions('test-client');

      expect(result.usageForecast).toBeNull();
      expect(result.costOptimization).toEqual({});
      expect(result.error).toBe('Forecast failed');
    });
  });

  describe('createABTest', () => {
    it('should create A/B test and invalidate cache', async () => {
      const testConfig = {
        name: 'Test Experiment',
        clientId: 'test-client',
        variants: { control: 'control', test: ['variant1'] },
        metrics: { primary: ['cost'], secondary: [] }
      };

      const mockTest = { id: 'test-123', ...testConfig };
      abTestingFramework.createTest = jest.fn().mockResolvedValue(mockTest);

      const result = await analyticsDashboardService.createABTest(testConfig);

      expect(result).to.deep.equal(mockTest);
      expect(abTestingFramework.createTest).to.have.been.calledWith(testConfig);
    });
  });

  describe('startABTest', () => {
    it('should start A/B test and invalidate cache', async () => {
      abTestingFramework.startTest = jest.fn().mockResolvedValue(true);
      abTestingFramework.getTest = jest.fn().mockResolvedValue({ clientId: 'test-client' });

      const result = await analyticsDashboardService.startABTest('test-123');

      expect(result).to.equal(true);
      expect(abTestingFramework.startTest).to.have.been.calledWith('test-123');
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge alerts and invalidate cache', async () => {
      optimizationEngine.acknowledgeAlert = jest.fn().mockResolvedValue(true);

      const result = await analyticsDashboardService.acknowledgeAlert('alert-123', 'user-456');

      expect(result).toBe(true);
      expect(optimizationEngine.acknowledgeAlert).toHaveBeenCalledWith('alert-123', 'user-456');
    });
  });

  describe('getModelRecommendations', () => {
    it('should get model selection recommendations', async () => {
      const mockRecommendations = {
        recommendedModel: 'gpt-4o-mini',
        reasoning: 'Cost-effective choice'
      };

      predictiveAnalytics.getModelSelectionRecommendations = jest.fn().mockResolvedValue(mockRecommendations);

      const queryCharacteristics = { complexity: 0.5 };
      const result = await analyticsDashboardService.getModelRecommendations('test-client', queryCharacteristics);

      expect(result).toEqual(mockRecommendations);
      expect(predictiveAnalytics.getModelSelectionRecommendations).toHaveBeenCalledWith('test-client', queryCharacteristics);
    });
  });

  describe('assignUserToTest', () => {
    it('should assign user to A/B test variant', async () => {
      abTestingFramework.assignUserToVariant = jest.fn().mockResolvedValue('variant1');

      const result = await analyticsDashboardService.assignUserToTest('test-client', 'user-123', 'test-456');

      expect(result).toBe('variant1');
      expect(abTestingFramework.assignUserToVariant).toHaveBeenCalledWith('test-client', 'user-123', 'test-456');
    });
  });

  describe('recordTestMetric', () => {
    it('should record metrics for A/B testing', async () => {
      abTestingFramework.recordMetric = jest.fn().mockResolvedValue();

      await analyticsDashboardService.recordTestMetric('test-123', 'user-456', 'control', 'cost', 0.015);

      expect(abTestingFramework.recordMetric).toHaveBeenCalledWith('test-123', 'user-456', 'control', 'cost', 0.015, {});
    });
  });

  describe('getClientComparison', () => {
    it('should compare multiple clients', async () => {
      const clientIds = ['client-1', 'client-2'];
      const mockMetrics1 = { totalRequests: 1000, avgResponseTime: 1500 };
      const mockMetrics2 = { totalRequests: 800, avgResponseTime: 1200 };

      advancedAnalyticsLogger.calculatePerformanceMetrics = jest.fn()
        .mockResolvedValueOnce(mockMetrics1)
        .mockResolvedValueOnce(mockMetrics2);

      const result = await analyticsDashboardService.getClientComparison(clientIds);

      expect(result).toHaveProperty('client-1');
      expect(result).toHaveProperty('client-2');
      expect(result['client-1']).toEqual(mockMetrics1);
      expect(result['client-2']).toEqual(mockMetrics2);
    });
  });

  describe('exportDashboardData', () => {
    it('should export dashboard data in JSON format', async () => {
      const mockDashboardData = {
        realTime: { totalRequests: 1000 },
        predictions: { usageForecast: { predictedRequests: 1200 } },
        alerts: [],
        recommendations: [],
        activeTests: [],
        performance: { totalRequests: 1000 },
        generatedAt: '2024-01-01T00:00:00Z'
      };

      analyticsDashboardService.getDashboardData = jest.fn().mockResolvedValue(mockDashboardData);

      const result = await analyticsDashboardService.exportDashboardData('test-client', { format: 'json' });

      expect(result).toEqual(mockDashboardData);
    });

    it('should export dashboard data in CSV format', async () => {
      const mockDashboardData = {
        realTime: { totalRequests: 1000, totalCost: 15.00, avgResponseTime: 1500 },
        predictions: {},
        alerts: [],
        recommendations: [],
        activeTests: [],
        performance: {},
        generatedAt: '2024-01-01T00:00:00Z'
      };

      analyticsDashboardService.getDashboardData = jest.fn().mockResolvedValue(mockDashboardData);

      const result = await analyticsDashboardService.exportDashboardData('test-client', { format: 'csv' });

      expect(result).toContain('Total Requests,1000');
      expect(result).toContain('Total Cost,15');
      expect(result).toContain('Avg Response Time,1500');
    });
  });

  describe('caching', () => {
    it('should cache and retrieve data correctly', () => {
      const testData = { test: 'data' };
      const key = 'test_key';

      analyticsDashboardService.setCached(key, testData);
      const retrieved = analyticsDashboardService.getCached(key);

      expect(retrieved).toEqual(testData);
    });

    it('should return null for expired cache', () => {
      const testData = { test: 'data' };
      const key = 'test_key';

      // Set cache with negative timeout to simulate expiration
      analyticsDashboardService.cacheTimeout = -1000;
      analyticsDashboardService.setCached(key, testData);

      const retrieved = analyticsDashboardService.getCached(key);

      expect(retrieved).toBeNull();
    });

    it('should invalidate cache correctly', () => {
      const testData = { test: 'data' };
      const key = 'test_key';

      analyticsDashboardService.setCached(key, testData);
      analyticsDashboardService.invalidateCache(key);

      const retrieved = analyticsDashboardService.getCached(key);
      expect(retrieved).toBeNull();
    });
  });

  describe('helper methods', () => {
    describe('getActiveUsersCount', () => {
      it('should count unique visitors in last hour', async () => {
        const mockData = [
          { visitor_id: 'user-1' },
          { visitor_id: 'user-2' },
          { visitor_id: 'user-1' } // Duplicate
        ];

        supabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve({ data: mockData, error: null }))
                }))
              }))
            }))
          }))
        }));

        const count = await analyticsDashboardService.getActiveUsersCount('test-client');

        expect(count).toBe(2); // Unique users
      });
    });

    describe('getCurrentErrorRate', () => {
      it('should calculate error rate from recent requests', async () => {
        const mockData = [
          { response_time_ms: 500 },
          { response_time_ms: 35000 }, // Error (>30s)
          { response_time_ms: 800 }
        ];

        supabase.from = jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              gte: jest.fn(() => Promise.resolve({ data: mockData, error: null }))
            }))
          }))
        }));

        const errorRate = await analyticsDashboardService.getCurrentErrorRate('test-client');

        expect(errorRate).toBe(1/3); // 1 error out of 3 requests
      });
    });

    describe('analyzeTrends', () => {
      it('should analyze performance trends', () => {
        const performanceTrends = [
          { hour: 0, avgResponseTime: 1000 },
          { hour: 1, avgResponseTime: 1200 }
        ];

        const result = analyticsDashboardService.analyzeTrends(performanceTrends);

        expect(result).toHaveProperty('trend');
        expect(result).toHaveProperty('changePercent');
        expect(result.changePercent).toBe(20); // 20% increase
        expect(result.trend).toBe('increasing');
      });

      it('should handle stable trends', () => {
        const performanceTrends = [
          { hour: 0, avgResponseTime: 1000 },
          { hour: 1, avgResponseTime: 1010 }
        ];

        const result = analyticsDashboardService.analyzeTrends(performanceTrends);

        expect(result.trend).toBe('stable');
        expect(result.changePercent).toBe(1);
      });
    });
  });
});