// packages/backend/test/performance-regression.test.js
// Performance regression tests for model selection system

import { expect } from 'chai';
import sinon from 'sinon';
import ModelRouter from '../src/utils/model-router.js';
import PerformanceTracker from '../src/utils/performance-tracker.js';
import QueryComplexityAnalyzer from '../src/utils/query-complexity-analyzer.js';

describe('Performance Regression Tests', () => {
  let modelRouter;
  let performanceTracker;
  let complexityAnalyzer;
  let clock;

  // Performance baselines (adjust based on system capabilities)
  const BASELINES = {
    modelSelectionTime: 100, // ms
    complexityAnalysisTime: 50, // ms
    performanceLoggingTime: 20, // ms
    cacheHitTime: 5, // ms
    memoryUsageIncrease: 10 * 1024 * 1024, // 10MB
    throughput: 10 // selections per second
  };

  beforeEach(() => {
    performanceTracker = new PerformanceTracker();
    modelRouter = new ModelRouter(performanceTracker);
    complexityAnalyzer = new QueryComplexityAnalyzer();

    // Use fake timers for consistent timing tests
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    sinon.restore();
    clock.restore();
    performanceTracker.clearCache();
  });

  describe('Response Time Regression', () => {
    it('should maintain model selection response time', async () => {
      const testCases = [
        { query: 'Simple query', context: { matches: [] } },
        { query: 'Medium complexity query with some details', context: { matches: Array(10).fill({}) } },
        { query: 'Complex query requiring analysis and comparison of multiple factors', context: { matches: Array(50).fill({}) } }
      ];

      const timings = [];

      for (const testCase of testCases) {
        const startTime = Date.now();
        await modelRouter.selectModel(testCase.query, testCase.context);
        const endTime = Date.now();
        timings.push(endTime - startTime);
      }

      const averageTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const maxTime = Math.max(...timings);

      console.log(`Model Selection Performance: Avg=${averageTime.toFixed(2)}ms, Max=${maxTime}ms`);

      // Performance assertions
      expect(averageTime).to.be.below(BASELINES.modelSelectionTime * 2, 'Average selection time regression detected');
      expect(maxTime).to.be.below(BASELINES.modelSelectionTime * 5, 'Maximum selection time regression detected');
    });

    it('should maintain complexity analysis performance', async () => {
      const testQueries = [
        'Hi',
        'What is the price?',
        'Can you compare financing options and energy efficiency?',
        'Please analyze the investment potential considering market trends, location advantages, and compare with similar developments.'
      ];

      const timings = [];

      for (const query of testQueries) {
        const startTime = performance.now();
        await complexityAnalyzer.analyze(query, { matches: [] });
        const endTime = performance.now();
        timings.push(endTime - startTime);
      }

      const averageTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const maxTime = Math.max(...timings);

      console.log(`Complexity Analysis Performance: Avg=${averageTime.toFixed(2)}ms, Max=${maxTime.toFixed(2)}ms`);

      expect(averageTime).to.be.below(BASELINES.complexityAnalysisTime * 2);
      expect(maxTime).to.be.below(BASELINES.complexityAnalysisTime * 5);
    });

    it('should maintain cache performance', async () => {
      // Populate cache
      await performanceTracker.getHistoricalPerformance('gpt-4.1', { overallScore: 0.5 });

      // Measure cache hit performance
      const timings = [];
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        await performanceTracker.getHistoricalPerformance('gpt-4.1', { overallScore: 0.5 });
        const endTime = performance.now();
        timings.push(endTime - startTime);
      }

      const averageTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const maxTime = Math.max(...timings);

      console.log(`Cache Performance: Avg=${averageTime.toFixed(2)}ms, Max=${maxTime.toFixed(2)}ms`);

      expect(averageTime).to.be.below(BASELINES.cacheHitTime * 2);
      expect(maxTime).to.be.below(BASELINES.cacheHitTime * 5);
    });
  });

  describe('Memory Usage Regression', () => {
    it('should not have significant memory leaks', async () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform many operations
      for (let i = 0; i < 100; i++) {
        await modelRouter.selectModel(`Test query ${i}`, { matches: [] });
        await performanceTracker.getHistoricalPerformance('gpt-4.1', { overallScore: 0.5 });
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      console.log(`Memory Usage: Initial=${(initialMemory / 1024 / 1024).toFixed(2)}MB, Final=${(finalMemory / 1024 / 1024).toFixed(2)}MB, Increase=${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      expect(memoryIncrease).to.be.below(BASELINES.memoryUsageIncrease, 'Memory leak detected');
    });

    it('should maintain cache size limits', async () => {
      // Fill cache with many entries
      for (let i = 0; i < 200; i++) {
        await performanceTracker.getHistoricalPerformance(`model-${i}`, { overallScore: 0.5 });
      }

      // Cache should not grow indefinitely
      expect(performanceTracker.cache.size).to.be.below(1000, 'Cache size exceeds reasonable limits');
    });
  });

  describe('Throughput Regression', () => {
    it('should maintain selection throughput', async () => {
      const numRequests = 50;
      const testQuery = 'What is the price?';
      const testContext = { matches: [] };

      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < numRequests; i++) {
        promises.push(modelRouter.selectModel(testQuery, testContext));
      }

      await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const throughput = (numRequests / totalTime) * 1000; // requests per second

      console.log(`Throughput: ${throughput.toFixed(2)} req/sec (${numRequests} requests in ${totalTime}ms)`);

      expect(throughput).to.be.above(BASELINES.throughput * 0.5, 'Throughput regression detected');
    });

    it('should handle concurrent load without degradation', async () => {
      const numConcurrent = 20;
      const testQuery = 'Test query';
      const testContext = { matches: [] };

      const startTime = Date.now();

      const promises = [];
      for (let i = 0; i < numConcurrent; i++) {
        promises.push(modelRouter.selectModel(`${testQuery} ${i}`, testContext));
      }

      const results = await Promise.all(promises);

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / numConcurrent;

      console.log(`Concurrent Load: ${numConcurrent} requests, Total=${totalTime}ms, Avg=${avgTime.toFixed(2)}ms per request`);

      // All requests should succeed
      expect(results).to.have.lengthOf(numConcurrent);
      results.forEach(result => {
        expect(result).to.have.property('selectedModel');
        expect(result.confidence).to.be.within(0, 1);
      });

      // Average time should not be excessively high
      expect(avgTime).to.be.below(BASELINES.modelSelectionTime * 3);
    });
  });

  describe('Database Performance Regression', () => {
    let mockSupabase;

    beforeEach(() => {
      // Mock database with controlled delays
      mockSupabase = {
        from: sinon.stub().returns({
          select: sinon.stub().returns({
            eq: sinon.stub().returns({
              gte: sinon.stub().returns({
                lte: sinon.stub().returns({
                  not: sinon.stub().returns({
                    limit: sinon.stub().resolves({
                      data: [
                        { response_quality_score: 0.8, response_time_ms: 2000, actual_cost: 0.002, success: true }
                      ],
                      error: null
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
    });

    it('should maintain database query performance', async () => {
      const queryCount = 20;

      const timings = [];
      for (let i = 0; i < queryCount; i++) {
        const startTime = performance.now();
        await performanceTracker.getHistoricalPerformance('gpt-4.1', { overallScore: 0.5 });
        const endTime = performance.now();
        timings.push(endTime - startTime);
      }

      const averageTime = timings.reduce((sum, time) => sum + time, 0) / timings.length;
      const maxTime = Math.max(...timings);

      console.log(`Database Query Performance: Avg=${averageTime.toFixed(2)}ms, Max=${maxTime.toFixed(2)}ms`);

      // Database queries should be reasonably fast
      expect(averageTime).to.be.below(100, 'Database query performance regression');
      expect(maxTime).to.be.below(500, 'Database query outlier detected');
    });

    it('should handle database connection issues gracefully', async () => {
      // Simulate database timeout
      mockSupabase.from.returns({
        select: sinon.stub().returns({
          eq: sinon.stub().returns({
            gte: sinon.stub().returns({
              lte: sinon.stub().returns({
                not: sinon.stub().returns({
                  limit: sinon.stub().rejects(new Error('Connection timeout'))
                })
              })
            })
          })
        })
      });

      const startTime = performance.now();
      const result = await performanceTracker.getHistoricalPerformance('gpt-4.1', { overallScore: 0.5 });
      const endTime = performance.now();

      const queryTime = endTime - startTime;

      // Should return default value and not take too long
      expect(result).to.equal(0.5);
      expect(queryTime).to.be.below(1000, 'Database failure handling too slow');
    });
  });

  describe('Algorithmic Performance Regression', () => {
    it('should maintain selection algorithm consistency', async () => {
      const testQuery = 'What apartments are available for sale?';
      const testContext = { matches: Array(5).fill({}) };

      // Run multiple times to check consistency
      const results = [];
      for (let i = 0; i < 10; i++) {
        const result = await modelRouter.selectModel(testQuery, testContext);
        results.push(result);
      }

      // Check that results are reasonably consistent
      const models = results.map(r => r.selectedModel);
      const uniqueModels = [...new Set(models)];
      const mostCommonModel = uniqueModels.reduce((prev, current) =>
        models.filter(m => m === current).length > models.filter(m => m === prev).length ? current : prev
      );

      const consistency = models.filter(m => m === mostCommonModel).length / models.length;

      console.log(`Selection Consistency: ${consistency.toFixed(2)} (${mostCommonModel} selected ${models.filter(m => m === mostCommonModel).length}/${models.length} times)`);

      expect(consistency).to.be.above(0.7, 'Selection algorithm inconsistency detected');
    });

    it('should maintain cost estimation accuracy', async () => {
      const testCases = [
        { model: 'gpt-5-nano', tokens: 100, expectedRange: [0.00001, 0.0001] },
        { model: 'gpt-4.1', tokens: 1000, expectedRange: [0.00005, 0.00015] },
        { model: 'gpt-5', tokens: 2000, expectedRange: [0.0002, 0.0004] }
      ];

      for (const testCase of testCases) {
        const cost = modelRouter.estimateCost(testCase.model, testCase.tokens);

        console.log(`${testCase.model} (${testCase.tokens} tokens): $${cost.toFixed(6)}`);

        expect(cost).to.be.within(testCase.expectedRange[0], testCase.expectedRange[1],
          `Cost estimation regression for ${testCase.model}`);
      }
    });

    it('should maintain complexity scoring stability', async () => {
      const testQueries = [
        { query: 'Hi', expectedRange: [0, 0.3] },
        { query: 'What is the price?', expectedRange: [0.1, 0.4] },
        { query: 'Compare financing options', expectedRange: [0.4, 0.7] },
        { query: 'Analyze investment potential with market trends', expectedRange: [0.7, 1.0] }
      ];

      for (const testQuery of testQueries) {
        const result = await complexityAnalyzer.analyze(testQuery.query, { matches: [] });
        const score = result.overallScore;

        console.log(`"${testQuery.query}": ${score.toFixed(3)}`);

        expect(score).to.be.within(testQuery.expectedRange[0], testQuery.expectedRange[1],
          `Complexity scoring regression for: "${testQuery.query}"`);
      }
    });
  });

  describe('Resource Usage Monitoring', () => {
    it('should monitor and report resource usage', async () => {
      const initialUsage = process.cpuUsage();
      const initialMemory = process.memoryUsage();

      // Perform intensive operations
      const promises = [];
      for (let i = 0; i < 50; i++) {
        promises.push(modelRouter.selectModel(`Load test query ${i}`, {
          matches: Array(Math.floor(Math.random() * 20)).fill({})
        }));
      }

      await Promise.all(promises);

      const finalUsage = process.cpuUsage(initialUsage);
      const finalMemory = process.memoryUsage();

      const cpuTime = (finalUsage.user + finalUsage.system) / 1000; // Convert to ms
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Resource Usage: CPU=${cpuTime.toFixed(2)}ms, Memory=${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Resource usage should be reasonable
      expect(cpuTime).to.be.below(1000, 'Excessive CPU usage');
      expect(memoryIncrease).to.be.below(BASELINES.memoryUsageIncrease, 'Excessive memory usage');
    });

    it('should detect memory leaks in repeated operations', async () => {
      const measurements = [];

      for (let cycle = 0; cycle < 5; cycle++) {
        const beforeMemory = process.memoryUsage().heapUsed;

        // Perform operations
        for (let i = 0; i < 20; i++) {
          await modelRouter.selectModel(`Cycle ${cycle} query ${i}`, { matches: [] });
        }

        const afterMemory = process.memoryUsage().heapUsed;
        const increase = afterMemory - beforeMemory;
        measurements.push(increase);

        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      const averageIncrease = measurements.reduce((sum, inc) => sum + inc, 0) / measurements.length;
      const maxIncrease = Math.max(...measurements);

      console.log(`Memory Leak Detection: Avg=${(averageIncrease / 1024 / 1024).toFixed(2)}MB, Max=${(maxIncrease / 1024 / 1024).toFixed(2)}MB`);

      // Memory increases should stabilize, not grow continuously
      expect(averageIncrease).to.be.below(BASELINES.memoryUsageIncrease * 0.5);
      expect(maxIncrease).to.be.below(BASELINES.memoryUsageIncrease);
    });
  });

  describe('Scalability Testing', () => {
    it('should scale with increasing load', async () => {
      const loadLevels = [1, 5, 10, 20];

      for (const loadLevel of loadLevels) {
        const startTime = performance.now();

        const promises = [];
        for (let i = 0; i < loadLevel; i++) {
          promises.push(modelRouter.selectModel(`Load ${loadLevel} query ${i}`, { matches: [] }));
        }

        await Promise.all(promises);

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        const avgTime = totalTime / loadLevel;

        console.log(`Load ${loadLevel}: Total=${totalTime.toFixed(2)}ms, Avg=${avgTime.toFixed(2)}ms per request`);

        // Response time should not degrade excessively with load
        expect(avgTime).to.be.below(BASELINES.modelSelectionTime * (1 + loadLevel * 0.1));
      }
    });

    it('should maintain quality under load', async () => {
      const numRequests = 30;
      const testQuery = 'What is the price of available apartments?';
      const testContext = { matches: Array(10).fill({}) };

      const promises = [];
      for (let i = 0; i < numRequests; i++) {
        promises.push(modelRouter.selectModel(testQuery, testContext));
      }

      const results = await Promise.all(promises);

      // All results should be valid
      expect(results).to.have.lengthOf(numRequests);
      results.forEach(result => {
        expect(result).to.have.property('selectedModel');
        expect(result.confidence).to.be.within(0, 1);
        expect(result.estimatedCost).to.be.greaterThan(0);
      });

      // Selection quality should be maintained
      const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / numRequests;
      expect(avgConfidence).to.be.above(0.3, 'Quality degradation under load');
    });
  });
});