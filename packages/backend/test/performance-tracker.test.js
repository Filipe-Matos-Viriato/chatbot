// packages/backend/test/performance-tracker.test.js
// Unit tests for PerformanceTracker - model performance monitoring and analytics

import { expect } from 'chai';
import sinon from 'sinon';
import PerformanceTracker from '../src/utils/performance-tracker.js';

describe('PerformanceTracker', () => {
  let performanceTracker;
  let mockSupabase;

  beforeEach(() => {
    // Mock supabase
    mockSupabase = {
      from: sinon.stub().returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              lte: sinon.stub().returns({
                not: sinon.stub().returns({
                  limit: sinon.stub().returns({
                    order: sinon.stub().returns({
                      single: sinon.stub().resolves({ data: null, error: null })
                    })
                  })
                })
              })
            })
          })
        }),
        insert: sinon.stub().resolves({ error: null }),
        update: sinon.stub().resolves({ error: null })
      })
    };

    performanceTracker = new PerformanceTracker();
  });

  afterEach(() => {
    sinon.restore();
    performanceTracker.clearCache();
  });

  describe('constructor', () => {
    it('should initialize with empty cache', () => {
      expect(performanceTracker.cache).to.be.instanceOf(Map);
      expect(performanceTracker.cache.size).to.equal(0);
      expect(performanceTracker.cacheTTL).to.equal(5 * 60 * 1000); // 5 minutes
    });
  });

  describe('logSelection', () => {
    it('should log model selection successfully', async () => {
      const selection = {
        selectedModel: 'gpt-4.1',
        confidence: 0.85,
        estimatedCost: 0.002,
        reasoning: 'Good fit for complexity'
      };

      const complexityAnalysis = {
        overallScore: 0.6,
        tokenCount: 500
      };

      const constraints = { maxCost: 0.01 };

      await performanceTracker.logSelection(selection, complexityAnalysis, constraints);

      // Verify database insertion was called
      expect(mockSupabase.from.calledWith('model_selections')).to.be.true;
      const insertCall = mockSupabase.from('model_selections').insert;
      expect(insertCall.calledOnce).to.be.true;
      expect(insertCall.calledOnce).to.be.true;

      const loggedData = insertCall.firstCall.args[0];
      expect(loggedData.selected_model).to.equal('gpt-4.1');
      expect(loggedData.complexity_score).to.equal(0.6);
      expect(loggedData.token_count).to.equal(500);
      expect(loggedData.estimated_cost).to.equal(0.002);
      expect(loggedData.confidence).to.equal(0.85);
      expect(loggedData.constraints).to.equal(JSON.stringify(constraints));
      expect(loggedData.timestamp).to.be.a('string');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from.returns({
        insert: sinon.stub().resolves({ error: new Error('DB connection failed') })
      });

      const selection = { selectedModel: 'gpt-4.1' };
      const complexityAnalysis = { overallScore: 0.5, tokenCount: 100 };
      const constraints = {};

      // Should not throw error
      await expect(performanceTracker.logSelection(selection, complexityAnalysis, constraints)).to.be.fulfilled;
    });

    it('should generate unique query IDs', async () => {
      const selection1 = { selectedModel: 'gpt-4.1' };
      const selection2 = { selectedModel: 'gpt-5' };
      const complexityAnalysis = { overallScore: 0.5, tokenCount: 100 };

      await performanceTracker.logSelection(selection1, complexityAnalysis, {});
      await performanceTracker.logSelection(selection2, complexityAnalysis, {});

      const insertCall = mockSupabase.from('model_selections').insert;
      expect(insertCall.calledTwice).to.be.true;
      expect(insertCall.calledTwice).to.be.true;

      const id1 = insertCall.firstCall.args[0].query_id;
      const id2 = insertCall.secondCall.args[0].query_id;

      expect(id1).to.not.equal(id2);
      expect(id1).to.match(/^q_\d+_[a-z0-9]+$/);
    });
  });

  describe('logPerformance', () => {
    it('should log actual performance metrics', async () => {
      const queryId = 'q_1234567890_abc123';
      const metrics = {
        actualCost: 0.0015,
        qualityScore: 0.9,
        responseTime: 2500,
        success: true,
        tokenUsage: 800
      };

      await performanceTracker.logPerformance(queryId, metrics);

      const updateCall = mockSupabase.from('model_selections').update;
      expect(updateCall.calledOnce).to.be.true;
      expect(updateCall.calledOnce).to.be.true;

      const updateData = updateCall.firstCall.args[0];
      expect(updateData.actual_cost).to.equal(0.0015);
      expect(updateData.response_quality_score).to.equal(0.9);
      expect(updateData.response_time_ms).to.equal(2500);
      expect(updateData.success).to.equal(true);
      expect(updateData.token_usage).to.equal(800);
    });

    it('should handle database update errors', async () => {
      mockSupabase.from.returns({
        update: sinon.stub().resolves({ error: new Error('Update failed') })
      });

      const queryId = 'q_test';
      const metrics = { actualCost: 0.001, qualityScore: 0.8 };

      await expect(performanceTracker.logPerformance(queryId, metrics)).to.be.fulfilled;
    });
  });

  describe('getHistoricalPerformance', () => {
    it('should return cached performance data', async () => {
      const cacheKey = 'perf_gpt-4.1_3';
      const cachedData = { score: 0.85, timestamp: Date.now() };
      performanceTracker.cache.set(cacheKey, cachedData);

      const result = await performanceTracker.getHistoricalPerformance('gpt-4.1', { overallScore: 0.65 });

      expect(result).to.equal(0.5);
      // Should not query database when cache hit
      expect(mockSupabase.from.called).to.be.false;
    });

    it('should fetch and calculate performance from database', async () => {
      const mockData = [
        { response_quality_score: 0.8, response_time_ms: 2000, actual_cost: 0.002, success: true },
        { response_quality_score: 0.9, response_time_ms: 1800, actual_cost: 0.0018, success: true },
        { response_quality_score: 0.7, response_time_ms: 2500, actual_cost: 0.0022, success: true }
      ];

      mockSupabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              lte: sinon.stub().returns({
                not: sinon.stub().returns({
                  limit: sinon.stub().resolves({ data: mockData, error: null })
                })
              })
            })
          })
        })
      });

      const result = await performanceTracker.getHistoricalPerformance('gpt-4.1', { overallScore: 0.6 });

      expect(result).to.be.closeTo(0.5, 0.1); // Should be around 0.5 based on calculation
      expect(performanceTracker.cache.has('perf_gpt-4.1_3')).to.be.true;
    });

    it('should return default score when no data available', async () => {
      mockSupabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              lte: sinon.stub().returns({
                not: sinon.stub().returns({
                  limit: sinon.stub().resolves({ data: [], error: null })
                })
              })
            })
          })
        })
      });

      const result = await performanceTracker.getHistoricalPerformance('gpt-4.1', { overallScore: 0.5 });

      expect(result).to.equal(0.5);
    });

    it('should handle database errors', async () => {
      mockSupabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              lte: sinon.stub().returns({
                not: sinon.stub().returns({
                  limit: sinon.stub().resolves({ data: null, error: new Error('DB error') })
                })
              })
            })
          })
        })
      });

      const result = await performanceTracker.getHistoricalPerformance('gpt-4.1', { overallScore: 0.5 });

      expect(result).to.equal(0.5); // Default fallback
    });

    it('should expire old cache entries', async () => {
      const cacheKey = 'perf_gpt-4.1_3';
      const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      performanceTracker.cache.set(cacheKey, { score: 0.9, timestamp: oldTimestamp });

      // Mock database call
      mockSupabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              lte: sinon.stub().returns({
                not: sinon.stub().returns({
                  limit: sinon.stub().resolves({ data: [{ response_quality_score: 0.8, response_time_ms: 2000, actual_cost: 0.002, success: true }], error: null })
                })
              })
            })
          })
        })
      });

      const result = await performanceTracker.getHistoricalPerformance('gpt-4.1', { overallScore: 0.65 });

      expect(result).to.be.closeTo(0.5, 0.1); // Should fetch fresh data
    });
  });

  describe('getCostEfficiency', () => {
    it('should calculate cost efficiency metrics', async () => {
      const mockData = [
        { actual_cost: 0.002, response_quality_score: 0.8 },
        { actual_cost: 0.0015, response_quality_score: 0.9 },
        { actual_cost: 0.0025, response_quality_score: 0.7 }
      ];

      mockSupabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              not: sinon.stub().returns({
                limit: sinon.stub().resolves({ data: mockData, error: null })
              })
            })
          })
        })
      });

      const result = await performanceTracker.getCostEfficiency('gpt-4.1');

      expect(result).to.have.property('averageCost');
      expect(result).to.have.property('costEfficiency');
      expect(result.averageCost).to.be.closeTo(0, 0.001);
      expect(result.costEfficiency).to.be.greaterThan(0);
    });

    it('should return defaults when no data available', async () => {
      mockSupabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              not: sinon.stub().returns({
                limit: sinon.stub().resolves({ data: [], error: null })
              })
            })
          })
        })
      });

      const result = await performanceTracker.getCostEfficiency('gpt-4.1');

      expect(result.averageCost).to.equal(0);
      expect(result.costEfficiency).to.equal(0.5);
    });
  });

  describe('getPerformanceTrends', () => {
    it('should aggregate performance data by day', async () => {
      const mockData = [
        { timestamp: '2025-01-01T10:00:00Z', response_quality_score: 0.8, response_time_ms: 2000, actual_cost: 0.002 },
        { timestamp: '2025-01-01T11:00:00Z', response_quality_score: 0.9, response_time_ms: 1800, actual_cost: 0.0018 },
        { timestamp: '2025-01-02T10:00:00Z', response_quality_score: 0.7, response_time_ms: 2200, actual_cost: 0.0022 }
      ];

      mockSupabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              order: sinon.stub().resolves({ data: mockData, error: null })
            })
          })
        })
      });

      const result = await performanceTracker.getPerformanceTrends('gpt-4.1', 7);

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);

      const day1 = result.find(d => d.date === '2025-01-01');
      expect(day1).to.exist;
      expect(day1.requestCount).to.equal(2);
      expect(day1.averageQuality).to.be.closeTo(0.85, 0.01);
      expect(day1.averageResponseTime).to.be.closeTo(1900, 50);
      expect(day1.averageCost).to.be.closeTo(0.0019, 0.0001);
    });

    it('should return empty array on database error', async () => {
      mockSupabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              order: sinon.stub().resolves({ data: null, error: new Error('DB error') })
            })
          })
        })
      });

      const result = await performanceTracker.getPerformanceTrends('gpt-4.1');

      expect(result).to.be.an('array');
      expect(result).to.have.lengthOf(0);
    });
  });

  describe('generateQueryId', () => {
    it('should generate unique IDs', () => {
      const id1 = performanceTracker.generateQueryId();
      const id2 = performanceTracker.generateQueryId();

      expect(id1).to.not.equal(id2);
      expect(id1).to.match(/^q_\d+_[a-z0-9]+$/);
      expect(id2).to.match(/^q_\d+_[a-z0-9]+$/);
    });

    it('should generate IDs with timestamp', () => {
      const before = Date.now();
      const id = performanceTracker.generateQueryId();
      const after = Date.now();

      const timestamp = parseInt(id.split('_')[1]);
      expect(timestamp).to.be.within(before - 100, after + 100);
    });
  });

  describe('clearCache', () => {
    it('should clear the performance cache', () => {
      performanceTracker.cache.set('test', { score: 0.8, timestamp: Date.now() });
      expect(performanceTracker.cache.size).to.equal(1);

      performanceTracker.clearCache();

      expect(performanceTracker.cache.size).to.equal(0);
    });
  });

  describe('getPerformanceSummary', () => {
    it('should aggregate recent performance metrics', async () => {
      const mockData = [
        { response_quality_score: 0.8, response_time_ms: 2000, actual_cost: 0.002, success: true },
        { response_quality_score: 0.9, response_time_ms: 1800, actual_cost: 0.0018, success: true },
        { response_quality_score: null, response_time_ms: 3000, actual_cost: 0.003, success: false }
      ];

      mockSupabase.from.returns({
        select: sinon.stub().returns({
          gte: sinon.stub().resolves({ data: mockData, error: null })
        })
      });

      const result = await performanceTracker.getPerformanceSummary();

      expect(result.totalRequests).to.equal(0);
      expect(result.successfulRequests).to.equal(2);
      expect(result.successRate).to.equal(2/3);
      expect(result.averageQuality).to.be.closeTo(0.85, 0.01);
      expect(result.averageCost).to.be.closeTo(0.00227, 0.0001);
      expect(result.averageResponseTime).to.be.closeTo(2267, 50);
    });

    it('should handle empty data', async () => {
      mockSupabase.from.returns({
        select: sinon.stub().returns({
          gte: sinon.stub().resolves({ data: [], error: null })
        })
      });

      const result = await performanceTracker.getPerformanceSummary();

      expect(result.totalRequests).to.equal(0);
      expect(result.averageQuality).to.equal(0);
      expect(result.averageCost).to.equal(0);
    });

    it('should handle database errors', async () => {
      mockSupabase.from.returns({
        select: sinon.stub().returns({
          gte: sinon.stub().resolves({ data: null, error: new Error('DB error') })
        })
      });

      const result = await performanceTracker.getPerformanceSummary();

      expect(result.totalRequests).to.equal(0);
      expect(result.averageQuality).to.equal(0);
      expect(result.averageCost).to.equal(0);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle null/undefined inputs gracefully', async () => {
      await expect(performanceTracker.logSelection(null, null, null)).to.be.fulfilled;
      await expect(performanceTracker.logPerformance(null, null)).to.be.fulfilled;
      await expect(performanceTracker.getHistoricalPerformance(null, null)).to.be.fulfilled;
      await expect(performanceTracker.getCostEfficiency(null)).to.be.fulfilled;
      await expect(performanceTracker.getPerformanceTrends(null)).to.be.fulfilled;
    });

    it('should handle malformed database responses', async () => {
      mockSupabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              lte: sinon.stub().returns({
                not: sinon.stub().returns({
                  limit: sinon.stub().resolves({ data: 'invalid', error: null })
                })
              })
            })
          })
        })
      });

      const result = await performanceTracker.getHistoricalPerformance('gpt-4.1', { overallScore: 0.5 });
      expect(result).to.equal(0.5); // Should return default
    });

    it('should handle concurrent cache access', async () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(performanceTracker.getHistoricalPerformance(`model-${i}`, { overallScore: 0.5 }));
      }

      const results = await Promise.all(promises);
      expect(results).to.have.lengthOf(10);
      results.forEach(result => expect(result).to.equal(0.5));
    });
  });
});