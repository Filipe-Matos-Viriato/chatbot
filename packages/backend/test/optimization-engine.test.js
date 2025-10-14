/**
 * Optimization Engine Tests
 * Tests real-time optimization, alerts, and recommendations
 */

import sinon from 'sinon';
import { expect } from 'chai';
import optimizationEngine from '../src/utils/optimization-engine.js';
import supabase from '../src/config/supabase.js';

// Mock supabase
sinon.stub(supabase, 'from').returns({
  select: sinon.stub().returns({
    eq: sinon.stub().returns({
      order: sinon.stub().returns({
        limit: sinon.stub().resolves({ data: [], error: null }),
        single: sinon.stub().resolves({ data: null, error: null })
      }),
      gte: sinon.stub().returns({
        not: sinon.stub().returns({
          order: sinon.stub().returns({
            limit: sinon.stub().resolves({ data: [], error: null })
          })
        })
      }),
      gt: sinon.stub().returns({
        order: sinon.stub().returns({
          limit: sinon.stub().resolves({ data: [], error: null })
        })
      })
    }),
    insert: sinon.stub().resolves({ error: null }),
    update: sinon.stub().resolves({ error: null }),
    delete: sinon.stub().resolves({ error: null })
  })
});

describe('OptimizationEngine', () => {
  beforeEach(() => {
    sinon.resetHistory();
    // Reset engine state
    optimizationEngine.lastAlerts.clear();
  });

  describe('checkForAlerts', () => {
    it('should detect cost anomalies', async () => {
      // Mock historical average cost
      optimizationEngine.getHistoricalAverageCost = sinon.stub().resolves(0.01);

      const currentMetrics = {
        totalRequests: 100,
        totalCost: 2.50, // 0.025 per request - 150% increase
        avgResponseTime: 1500
      };

      await optimizationEngine.checkForAlerts('test-client', currentMetrics);

      expect(supabase.from).to.have.been.calledWith('optimization_alerts');
      expect(supabase.from().insert).to.have.been.called;
    });

    it('should detect performance degradation', async () => {
      optimizationEngine.getHistoricalAverageResponseTime = sinon.stub().resolves(1000);

      const currentMetrics = {
        totalRequests: 100,
        totalCost: 1.00,
        avgResponseTime: 1600 // 60% increase
      };

      await optimizationEngine.checkForAlerts('test-client', currentMetrics);

      expect(supabase.from().insert).to.have.been.called;
    });

    it('should not alert for normal variations', async () => {
      optimizationEngine.getHistoricalAverageCost = sinon.stub().resolves(0.01);

      const currentMetrics = {
        totalRequests: 100,
        totalCost: 1.05, // 0.0105 per request - 5% increase (below threshold)
        avgResponseTime: 1050 // 5% increase (below threshold)
      };

      await optimizationEngine.checkForAlerts('test-client', currentMetrics);

      // Should not create alerts for small variations
      expect(supabase.from().insert).not.to.have.been.called;
    });
  });

  describe('generateRecommendations', () => {
    it('should generate cost optimization recommendations', async () => {
      // Mock predictive analytics
      const mockCostOptimization = {
        projectedSavings: 25.50,
        implementationPriority: 'high'
      };

      // Mock the predictive analytics call
      optimizationEngine.predictiveAnalytics = {
        generateCostOptimization: sinon.stub().resolves(mockCostOptimization)
      };

      const currentMetrics = {
        totalRequests: 1000,
        totalCost: 15.00,
        avgResponseTime: 1500
      };

      await optimizationEngine.generateRecommendations('test-client', currentMetrics);

      expect(supabase.from).to.have.been.calledWith('optimization_recommendations');
      expect(supabase.from().insert).to.have.been.called;
    });

    it('should generate performance recommendations', async () => {
      // Mock performance predictions
      const mockPredictions = [
        { model: 'gpt-4o-mini', predictedResponseTime: 1200 },
        { model: 'gpt-3.5-turbo', predictedResponseTime: 800 }
      ];

      optimizationEngine.predictiveAnalytics = {
        predictModelPerformance: sinon.stub().resolves(mockPredictions)
      };

      const currentMetrics = {
        totalRequests: 1000,
        totalCost: 15.00,
        avgResponseTime: 2000 // Current is slower than predicted best
      };

      await optimizationEngine.generateRecommendations('test-client', currentMetrics);

      expect(supabase.from().insert).to.have.been.called;
    });
  });

  describe('processAlert', () => {
    it('should create new alerts', async () => {
      const alert = {
        type: 'cost_anomaly',
        severity: 'warning',
        title: 'Cost Anomaly Detected',
        message: 'Cost increased by 50%',
        metrics: { increase: 0.5 },
        recommendations: ['Review model usage']
      };

      await optimizationEngine.processAlert('test-client', alert);

      expect(supabase.from).to.have.been.calledWith('optimization_alerts');
      expect(supabase.from().insert).to.have.been.called;

      const insertCall = supabase.from().insert.getCall(0).args[0];
      expect(insertCall.client_id).to.equal('test-client');
      expect(insertCall.type).to.equal('cost_anomaly');
      expect(insertCall.severity).to.equal('warning');
      expect(insertCall.acknowledged).to.equal(false);
    });

    it('should respect cooldown period', async () => {
      const alert = {
        type: 'cost_anomaly',
        severity: 'warning',
        title: 'Cost Anomaly Detected',
        message: 'Cost increased by 50%',
        metrics: { increase: 0.5 },
        recommendations: ['Review model usage']
      };

      // First alert
      await optimizationEngine.processAlert('test-client', alert);
      expect(supabase.from().insert).to.have.been.calledOnce;

      // Second alert (should be blocked by cooldown)
      await optimizationEngine.processAlert('test-client', alert);
      expect(supabase.from().insert).to.have.been.calledOnce; // Still 1
    });
  });

  describe('acknowledgeAlert', () => {
    it('should acknowledge alerts', async () => {
      const result = await optimizationEngine.acknowledgeAlert('alert-123', 'user-456');

      expect(result).to.equal(true);
      expect(supabase.from).to.have.been.calledWith('optimization_alerts');
      expect(supabase.from().update).to.have.been.calledWith({
        acknowledged: true,
        acknowledged_at: sinon.match.string,
        acknowledged_by: 'user-456'
      });
    });
  });

  describe('getActiveAlerts', () => {
    it('should retrieve active alerts', async () => {
      const mockAlerts = [
        {
          id: 'alert-1',
          type: 'cost_anomaly',
          severity: 'warning',
          title: 'Cost Alert',
          message: 'Cost increased',
          metrics: '{"increase": 0.5}',
          recommendations: '["check usage"]',
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ data: mockAlerts, error: null }))
            }))
          }))
        }))
      });

      const alerts = await optimizationEngine.getActiveAlerts('test-client');

      expect(alerts).to.have.lengthOf(1);
      expect(alerts[0].id).to.equal('alert-1');
      expect(alerts[0].type).to.equal('cost_anomaly');
      expect(alerts[0].metrics).to.deep.equal({ increase: 0.5 });
      expect(alerts[0].recommendations).to.deep.equal(['check usage']);
    });
  });

  describe('getRecommendations', () => {
    it('should retrieve recommendations', async () => {
      const mockRecommendations = [
        {
          id: 'rec-1',
          type: 'cost_optimization',
          priority: 'high',
          title: 'Cost Optimization',
          description: 'Save money',
          impact: '{"costSavings": 25.50}',
          actions: '["switch models"]',
          metadata: '{"model": "gpt-4o-mini"}',
          created_at: '2024-01-01T00:00:00Z',
          expires_at: '2024-01-08T00:00:00Z'
        }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gt: jest.fn(() => ({
              order: jest.fn(() => ({
                limit: jest.fn(() => Promise.resolve({ data: mockRecommendations, error: null }))
              }))
            }))
          }))
        }))
      });

      const recommendations = await optimizationEngine.getRecommendations('test-client');

      expect(recommendations).to.have.lengthOf(1);
      expect(recommendations[0].id).to.equal('rec-1');
      expect(recommendations[0].type).to.equal('cost_optimization');
      expect(recommendations[0].impact).to.deep.equal({ costSavings: 25.50 });
      expect(recommendations[0].actions).to.deep.equal(['switch models']);
      expect(recommendations[0].createdAt).to.be.instanceOf(Date);
      expect(recommendations[0].expiresAt).to.be.instanceOf(Date);
    });
  });

  describe('getActiveClients', () => {
    it('should retrieve active clients', async () => {
      const mockAnalytics = [
        { client_id: 'client-1' },
        { client_id: 'client-2' },
        { client_id: 'client-1' } // Duplicate
      ];

      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => Promise.resolve({ data: mockAnalytics, error: null }))
            }))
          }))
        }))
      });

      const clients = await optimizationEngine.getActiveClients();

      expect(clients).to.have.lengthOf(2);
      expect(clients).to.include('client-1');
      expect(clients).to.include('client-2');
    });
  });

  describe('getHistoricalAverageCost', () => {
    it('should calculate historical average cost', async () => {
      const mockData = [
        { actual_cost: 0.01 },
        { actual_cost: 0.02 },
        { actual_cost: 0.015 }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              not: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve({ data: mockData, error: null }))
                }))
              }))
            }))
          }))
        }))
      });

      const average = await optimizationEngine.getHistoricalAverageCost('test-client');

      expect(average).to.equal(0.015); // (0.01 + 0.02 + 0.015) / 3
    });

    it('should return 0 for no data', async () => {
      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              not: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve({ data: [], error: null }))
                }))
              }))
            }))
          }))
        }))
      });

      const average = await optimizationEngine.getHistoricalAverageCost('test-client');
      expect(average).to.equal(0);
    });
  });

  describe('getHistoricalAverageResponseTime', () => {
    it('should calculate historical average response time', async () => {
      const mockData = [
        { response_time_ms: 1000 },
        { response_time_ms: 1500 },
        { response_time_ms: 1200 }
      ];

      supabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            gte: jest.fn(() => ({
              not: jest.fn(() => ({
                order: jest.fn(() => ({
                  limit: jest.fn(() => Promise.resolve({ data: mockData, error: null }))
                }))
              }))
            }))
          }))
        }))
      });

      const average = await optimizationEngine.getHistoricalAverageResponseTime('test-client');

      expect(average).to.be.closeTo(1233.33, 0.01); // Average of the three values
    });
  });

  describe('alert detection methods', () => {
    describe('detectCostAnomaly', () => {
      it('should detect cost anomalies above threshold', async () => {
        optimizationEngine.getHistoricalAverageCost = jest.fn().mockResolvedValue(0.01);

        const currentMetrics = {
          totalRequests: 100,
          totalCost: 2.50 // 0.025 per request - 150% increase
        };

        const alert = await optimizationEngine.detectCostAnomaly('test-client', currentMetrics);

        expect(alert).to.be.ok;
        expect(alert.type).to.equal('cost_anomaly');
        expect(alert.severity).to.equal('warning');
        expect(alert.metrics.increase).to.equal(1.5);
      });

      it('should not detect anomalies below threshold', async () => {
        optimizationEngine.getHistoricalAverageCost = jest.fn().mockResolvedValue(0.01);

        const currentMetrics = {
          totalRequests: 100,
          totalCost: 1.05 // 0.0105 per request - 5% increase
        };

        const alert = await optimizationEngine.detectCostAnomaly('test-client', currentMetrics);

        expect(alert).to.equal(null);
      });
    });

    describe('detectPerformanceDegradation', () => {
      it('should detect performance degradation', async () => {
        optimizationEngine.getHistoricalAverageResponseTime = jest.fn().mockResolvedValue(1000);

        const currentMetrics = {
          totalRequests: 100,
          totalCost: 1.00,
          avgResponseTime: 1600 // 60% increase
        };

        const alert = await optimizationEngine.detectPerformanceDegradation('test-client', currentMetrics);

        expect(alert).to.be.ok;
        expect(alert.type).to.equal('performance_degradation');
        expect(alert.metrics.degradation).to.equal(0.6);
      });
    });
  });
});