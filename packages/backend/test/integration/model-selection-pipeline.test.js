// packages/backend/test/integration/model-selection-pipeline.test.js
// Integration tests for the complete model selection pipeline

import { expect } from 'chai';
import sinon from 'sinon';
import ModelRouter from '../../src/utils/model-router.js';
import PerformanceTracker from '../../src/utils/performance-tracker.js';
import QueryComplexityAnalyzer from '../../src/utils/query-complexity-analyzer.js';

describe('Model Selection Pipeline Integration', () => {
  let modelRouter;
  let performanceTracker;
  let complexityAnalyzer;
  let mockSupabase;

  beforeEach(() => {
    // Mock supabase for performance tracker
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
    modelRouter = new ModelRouter(performanceTracker);
    complexityAnalyzer = new QueryComplexityAnalyzer();
  });

  afterEach(() => {
    sinon.restore();
    performanceTracker.clearCache();
  });

  describe('End-to-End Model Selection Flow', () => {
    it('should complete full pipeline for simple query', async () => {
      const query = 'What is the price of the apartment?';
      const context = { matches: [] };

      // Step 1: Complexity Analysis
      const complexityResult = await complexityAnalyzer.analyze(query, context);
      expect(complexityResult).to.have.property('overallScore');
      expect(complexityResult).to.have.property('complexity');
      expect(complexityResult).to.have.property('recommendedModels');
      expect(complexityResult.complexity).to.equal('low');

      // Step 2: Model Selection
      const selectionResult = await modelRouter.selectModel(query, context);
      expect(selectionResult).to.have.property('selectedModel');
      expect(selectionResult).to.have.property('confidence');
      expect(selectionResult).to.have.property('estimatedCost');
      expect(selectionResult).to.have.property('reasoning');
      expect(selectionResult).to.have.property('complexityScore');

      // Step 3: Performance Logging
      const performanceMetrics = {
        actualCost: selectionResult.estimatedCost * 0.8, // Simulate actual cost
        qualityScore: 0.85,
        responseTime: 1500,
        success: true,
        tokenUsage: 200
      };

      await performanceTracker.logPerformance(selectionResult.queryId || 'test-id', performanceMetrics);

      // Verify the pipeline completed successfully
      expect(selectionResult.selectedModel).to.be.oneOf(['gpt-5-mini', 'gpt-5-nano', 'gpt-4.1', 'gpt-5']);
      expect(selectionResult.confidence).to.be.greaterThan(0);
      expect(selectionResult.estimatedCost).to.be.greaterThan(0);
    });

    it('should complete full pipeline for complex query', async () => {
      const query = 'Can you compare the energy efficiency ratings, financing options, and long-term investment potential of the T3 apartments in Evergreen Pure versus the T2 units in Evergreen Village, considering current market conditions and future development plans?';
      const context = {
        matches: Array(15).fill({ metadata: { text: 'Sample context data' } }),
        externalContext: { type: 'development', value: 'evergreen' }
      };

      // Step 1: Complexity Analysis
      const complexityResult = await complexityAnalyzer.analyze(query, context);
      expect(complexityResult.complexity).to.equal('high');
      expect(complexityResult.overallScore).to.be.greaterThan(0.7);

      // Step 2: Model Selection
      const selectionResult = await modelRouter.selectModel(query, context);
      expect(selectionResult.selectedModel).to.equal('gpt-5'); // Should select most capable model
      expect(selectionResult.complexityScore).to.equal(complexityResult.overallScore);

      // Step 3: Performance Logging
      const performanceMetrics = {
        actualCost: selectionResult.estimatedCost * 1.2, // Simulate higher actual cost
        qualityScore: 0.95,
        responseTime: 3500,
        success: true,
        tokenUsage: 1200
      };

      await performanceTracker.logPerformance('test-complex-id', performanceMetrics);

      // Verify high-complexity handling
      expect(selectionResult.confidence).to.be.greaterThan(0.5);
      expect(selectionResult.reasoning).to.include('High complexity');
    });

    it('should handle cost-constrained scenarios', async () => {
      const query = 'Show me available apartments';
      const context = { matches: Array(5).fill({}) };

      // Set very low cost constraint
      modelRouter.updateConstraints({ maxCost: 0.0001 });

      const selectionResult = await modelRouter.selectModel(query, context);

      // Should select cheapest viable model
      expect(selectionResult.selectedModel).to.equal('gpt-5-nano');
      expect(selectionResult.estimatedCost).to.be.lessThanOrEqual(0.0001);
    });

    it('should maintain consistency across similar queries', async () => {
      const queries = [
        'What apartments are available?',
        'Show me available properties',
        'Which units are for sale?'
      ];

      const results = [];
      for (const query of queries) {
        const result = await modelRouter.selectModel(query, { matches: [] });
        results.push(result);
      }

      // All similar queries should select similar models
      const models = results.map(r => r.selectedModel);
      const primaryModel = models[0];
      const consistency = models.filter(m => m === primaryModel).length / models.length;

      expect(consistency).to.be.greaterThan(0.6); // At least 60% consistency
    });
  });

  describe('Performance Tracking Integration', () => {
    it('should track performance metrics across multiple selections', async () => {
      const queries = [
        { text: 'Simple question', expectedComplexity: 'low' },
        { text: 'Medium complexity query with some details', expectedComplexity: 'medium' },
        { text: 'Very complex analysis requiring deep reasoning and comparison', expectedComplexity: 'high' }
      ];

      const selections = [];
      for (const query of queries) {
        const result = await modelRouter.selectModel(query.text, { matches: [] });
        selections.push(result);

        // Log performance for each
        await performanceTracker.logPerformance(`test-${query.expectedComplexity}`, {
          actualCost: result.estimatedCost * (0.8 + Math.random() * 0.4), // Vary actual cost
          qualityScore: 0.7 + Math.random() * 0.3,
          responseTime: 1000 + Math.random() * 3000,
          success: Math.random() > 0.1, // 90% success rate
          tokenUsage: 100 + Math.random() * 1000
        });
      }

      // Verify selections were made
      expect(selections).to.have.lengthOf(3);
      selections.forEach(selection => {
        expect(selection.selectedModel).to.be.a('string');
        expect(selection.confidence).to.be.within(0, 1);
      });

      // Check that different complexities got different models
      const complexities = selections.map(s => s.complexityScore).sort();
      expect(complexities[2]).to.be.greaterThan(complexities[0]); // Some variation
    });

    it('should provide performance summary after activity', async () => {
      // Generate some test data
      for (let i = 0; i < 5; i++) {
        await modelRouter.selectModel(`Test query ${i}`, { matches: [] });
        await performanceTracker.logPerformance(`test-summary-${i}`, {
          actualCost: 0.001 + Math.random() * 0.002,
          qualityScore: 0.7 + Math.random() * 0.3,
          responseTime: 1500 + Math.random() * 2000,
          success: true,
          tokenUsage: 200 + Math.random() * 800
        });
      }

      const summary = await performanceTracker.getPerformanceSummary();

      expect(summary).to.have.property('totalRequests');
      expect(summary).to.have.property('successfulRequests');
      expect(summary).to.have.property('successRate');
      expect(summary).to.have.property('averageQuality');
      expect(summary).to.have.property('averageCost');
      expect(summary).to.have.property('averageResponseTime');

      expect(summary.totalRequests).to.be.greaterThan(0);
      expect(summary.successRate).to.be.greaterThan(0);
    });
  });

  describe('Query Complexity Analysis Integration', () => {
    it('should accurately analyze different query types', async () => {
      const testCases = [
        {
          query: 'Hi',
          expectedComplexity: 'low',
          expectedScoreRange: [0, 0.4]
        },
        {
          query: 'What is the price of the T2 apartment?',
          expectedComplexity: 'low',
          expectedScoreRange: [0, 0.5]
        },
        {
          query: 'Can you explain the financing options and compare different mortgage rates?',
          expectedComplexity: 'medium',
          expectedScoreRange: [0.3, 0.7]
        },
        {
          query: 'Analyze the investment potential considering market trends, location advantages, energy efficiency ratings, and compare with similar developments in the area.',
          expectedComplexity: 'high',
          expectedScoreRange: [0.7, 1.0]
        }
      ];

      for (const testCase of testCases) {
        const result = await complexityAnalyzer.analyze(testCase.query, { matches: [] });

        expect(result.complexity).to.equal(testCase.expectedComplexity);
        expect(result.overallScore).to.be.within(testCase.expectedScoreRange[0], testCase.expectedScoreRange[1]);

        // Verify model recommendations make sense
        expect(result.recommendedModels).to.be.an('array');
        expect(result.recommendedModels.length).to.be.greaterThan(0);
        expect(result.recommendedModels).to.include('gpt-4.1'); // Always included as fallback
      }
    });

    it('should consider context in complexity analysis', async () => {
      const query = 'Tell me about this property';

      const simpleContext = { matches: [] };
      const complexContext = {
        matches: Array(20).fill({ metadata: { text: 'Detailed property information' } }),
        externalContext: { type: 'listing', value: '123' },
        queryFilters: { typology: 'T3', price_eur: { gte: 300000 } }
      };

      const simpleResult = await complexityAnalyzer.analyze(query, simpleContext);
      const complexResult = await complexityAnalyzer.analyze(query, complexContext);

      // Complex context should increase complexity score
      expect(complexResult.overallScore).to.be.greaterThan(simpleResult.overallScore);
      expect(complexResult.contextRequirements).to.be.greaterThan(simpleResult.contextRequirements);
    });

    it('should handle edge cases in complexity analysis', async () => {
      const edgeCases = [
        { query: '', context: {} },
        { query: '   ', context: {} },
        { query: null, context: {} },
        { query: 'Test query', context: null },
        { query: 'Very long query '.repeat(50), context: {} }
      ];

      for (const edgeCase of edgeCases) {
        try {
          const result = await complexityAnalyzer.analyze(edgeCase.query, edgeCase.context);
          expect(result).to.have.property('overallScore');
          expect(result.overallScore).to.be.within(0, 1);
        } catch (error) {
          // Some edge cases might throw, which is acceptable
          expect(error).to.be.instanceOf(Error);
        }
      }
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle partial system failures gracefully', async () => {
      // Simulate complexity analyzer failure
      const originalAnalyze = complexityAnalyzer.analyze;
      complexityAnalyzer.analyze = sinon.stub().rejects(new Error('Analysis failed'));

      const result = await modelRouter.selectModel('Test query', {});

      // Should still return a valid result using fallback
      expect(result.selectedModel).to.equal('gpt-4.1');
      expect(result.confidence).to.equal(0.5);
      expect(result.reasoning).to.include('Fallback');

      // Restore
      complexityAnalyzer.analyze = originalAnalyze;
    });

    it('should maintain service availability during database issues', async () => {
      // Simulate database failure for performance tracker
      const originalLogSelection = performanceTracker.logSelection;
      performanceTracker.logSelection = sinon.stub().rejects(new Error('DB unavailable'));

      const result = await modelRouter.selectModel('Test query', {});

      // Should still work despite logging failure
      expect(result.selectedModel).to.be.a('string');
      expect(result.confidence).to.be.greaterThan(0);

      // Restore
      performanceTracker.logSelection = originalLogSelection;
    });

    it('should handle concurrent requests', async () => {
      const queries = Array(10).fill('Concurrent test query');
      const contexts = Array(10).fill({ matches: [] });

      const promises = queries.map((query, index) =>
        modelRouter.selectModel(`${query} ${index}`, contexts[index])
      );

      const results = await Promise.all(promises);

      expect(results).to.have.lengthOf(10);
      results.forEach(result => {
        expect(result).to.have.property('selectedModel');
        expect(result.confidence).to.be.within(0, 1);
      });
    });
  });

  describe('Performance Regression Detection', () => {
    it('should detect performance degradation', async () => {
      const modelName = 'gpt-4.1';
      const baselinePerformance = 0.85;

      // Establish baseline
      for (let i = 0; i < 10; i++) {
        await performanceTracker.logPerformance(`baseline-${i}`, {
          actualCost: 0.002,
          qualityScore: baselinePerformance,
          responseTime: 2000,
          success: true,
          tokenUsage: 400
        });
      }

      // Check baseline performance
      const baselineScore = await performanceTracker.getHistoricalPerformance(
        modelName,
        { overallScore: 0.5 }
      );
      expect(baselineScore).to.be.closeTo(baselinePerformance, 0.1);

      // Simulate performance degradation
      for (let i = 0; i < 5; i++) {
        await performanceTracker.logPerformance(`degraded-${i}`, {
          actualCost: 0.002,
          qualityScore: 0.6, // Significantly lower
          responseTime: 3500, // Slower
          success: true,
          tokenUsage: 400
        });
      }

      // Clear cache to force fresh calculation
      performanceTracker.clearCache();

      const degradedScore = await performanceTracker.getHistoricalPerformance(
        modelName,
        { overallScore: 0.5 }
      );

      // Should detect performance drop
      expect(degradedScore).to.be.lessThan(baselineScore);
      expect(degradedScore).to.be.lessThan(0.75); // Below acceptable threshold
    });

    it('should track cost efficiency changes', async () => {
      const modelName = 'gpt-4.1';

      // Initial cost efficiency
      for (let i = 0; i < 5; i++) {
        await performanceTracker.logPerformance(`cost-test-${i}`, {
          actualCost: 0.0015,
          qualityScore: 0.8,
          responseTime: 2000,
          success: true,
          tokenUsage: 300
        });
      }

      const initialEfficiency = await performanceTracker.getCostEfficiency(modelName);
      expect(initialEfficiency.costEfficiency).to.be.greaterThan(0);

      // Simulate cost increase without quality improvement
      for (let i = 5; i < 10; i++) {
        await performanceTracker.logPerformance(`cost-test-${i}`, {
          actualCost: 0.003, // Doubled cost
          qualityScore: 0.8, // Same quality
          responseTime: 2000,
          success: true,
          tokenUsage: 300
        });
      }

      const newEfficiency = await performanceTracker.getCostEfficiency(modelName);

      // Cost efficiency should decrease
      expect(newEfficiency.costEfficiency).to.be.lessThan(initialEfficiency.costEfficiency);
      expect(newEfficiency.averageCost).to.be.greaterThan(initialEfficiency.averageCost);
    });
  });
});