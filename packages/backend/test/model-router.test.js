// packages/backend/test/model-router.test.js
// Unit tests for ModelRouter - intelligent model selection system

import { expect } from 'chai';
import sinon from 'sinon';
import ModelRouter from '../src/utils/model-router.js';
import PerformanceTracker from '../src/utils/performance-tracker.js';
import QueryComplexityAnalyzer from '../src/utils/query-complexity-analyzer.js';

describe('ModelRouter', () => {
  let modelRouter;
  let mockPerformanceTracker;
  let mockComplexityAnalyzer;

  beforeEach(() => {
    // Create mocks
    mockPerformanceTracker = sinon.createStubInstance(PerformanceTracker);
    mockComplexityAnalyzer = sinon.createStubInstance(QueryComplexityAnalyzer);

    // Create ModelRouter with mocked dependencies
    modelRouter = new ModelRouter(mockPerformanceTracker);
    modelRouter.complexityAnalyzer = mockComplexityAnalyzer;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('constructor', () => {
    it('should initialize with performance tracker', () => {
      expect(modelRouter.performanceTracker).to.equal(mockPerformanceTracker);
      expect(modelRouter.complexityAnalyzer).to.be.instanceOf(QueryComplexityAnalyzer);
    });

    it('should have model configurations', () => {
      expect(modelRouter.models).to.have.property('gpt-5');
      expect(modelRouter.models).to.have.property('gpt-4.1');
      expect(modelRouter.models).to.have.property('gpt-5-mini');
      expect(modelRouter.models).to.have.property('gpt-5-nano');
    });

    it('should have default constraints', () => {
      expect(modelRouter.constraints).to.have.property('maxCost', 0.01);
      expect(modelRouter.constraints).to.have.property('maxResponseTime', 10000);
      expect(modelRouter.constraints).to.have.property('fallbackModel', 'gpt-4.1');
    });
  });

  describe('selectModel', () => {
    it('should select model for simple query', async () => {
      const query = 'What is the price?';
      const context = { matches: [] };

      // Mock complexity analysis
      mockComplexityAnalyzer.analyze.resolves({
        tokenCount: 5,
        overallScore: 0.2,
        complexity: 'low',
        recommendedModels: ['gpt-5-mini', 'gpt-5-nano', 'gpt-4.1']
      });

      // Mock performance data
      mockPerformanceTracker.getHistoricalPerformance.resolves(0.8);
      mockPerformanceTracker.logSelection.resolves();

      const result = await modelRouter.selectModel(query, context);

      expect(result.selectedModel).to.equal('gpt-5-nano');
      expect(result.confidence).to.be.greaterThan(0);
      expect(result.estimatedCost).to.be.greaterThan(0);
      expect(result.reasoning).to.be.a('string');

      sinon.assert.calledOnce(mockComplexityAnalyzer.analyze);
      sinon.assert.calledWith(mockComplexityAnalyzer.analyze, query, context);
      sinon.assert.called(mockPerformanceTracker.logSelection);
    });

    it('should select high-performance model for complex query', async () => {
      const query = 'Compare the financing options, energy efficiency ratings, and long-term investment potential of these three properties with different construction phases.';
      const context = { matches: Array(20).fill({}) };

      mockComplexityAnalyzer.analyze.resolves({
        tokenCount: 2000,
        overallScore: 0.9,
        complexity: 'high',
        recommendedModels: ['gpt-5', 'gpt-4.1']
      });

      mockPerformanceTracker.getHistoricalPerformance.resolves(0.9);
      mockPerformanceTracker.logSelection.resolves();

      const result = await modelRouter.selectModel(query, context);

      expect(result.selectedModel).to.equal('gpt-4.1');
      expect(result.complexityScore).to.equal(0.9);

      sinon.assert.calledWith(mockPerformanceTracker.getHistoricalPerformance, 'gpt-5', sinon.match.object);
      sinon.assert.calledWith(mockPerformanceTracker.getHistoricalPerformance, 'gpt-4.1', sinon.match.object);
    });

    it('should respect cost constraints', async () => {
      const query = 'Simple question';
      const context = {};

      mockComplexityAnalyzer.analyze.resolves({
        tokenCount: 10000, // High token count to trigger cost concerns
        overallScore: 0.3,
        complexity: 'low',
        recommendedModels: ['gpt-5', 'gpt-4.1', 'gpt-5-mini']
      });

      // Mock high cost for expensive model
      mockPerformanceTracker.getHistoricalPerformance.resolves(0.8);
      mockPerformanceTracker.logSelection.resolves();

      // Override estimateCost to return high cost for gpt-5
      const originalEstimateCost = modelRouter.estimateCost;
      modelRouter.estimateCost = sinon.stub();
      modelRouter.estimateCost.withArgs('gpt-5', 10000).returns(0.02); // Above maxCost
      modelRouter.estimateCost.withArgs('gpt-4.1', 10000).returns(0.005);
      modelRouter.estimateCost.withArgs('gpt-5-mini', 10000).returns(0.001);

      const result = await modelRouter.selectModel(query, context);

      expect(result.selectedModel).to.not.equal('gpt-5'); // Should not select expensive model
      expect(result.estimatedCost).to.be.lessThanOrEqual(0.01);
    });

    it('should fallback to safe model on error', async () => {
      const query = 'Test query';
      const context = {};

      mockComplexityAnalyzer.analyze.rejects(new Error('Analysis failed'));

      const result = await modelRouter.selectModel(query, context);

      expect(result.selectedModel).to.equal('gpt-4.1'); // Fallback model
      expect(result.confidence).to.equal(0.5);
      expect(result.reasoning).to.include('Fallback due to error');
    });

    it('should handle empty context gracefully', async () => {
      const query = 'Hello';

      mockComplexityAnalyzer.analyze.resolves({
        tokenCount: 2,
        overallScore: 0.1,
        complexity: 'low',
        recommendedModels: ['gpt-5-nano', 'gpt-5-mini', 'gpt-4.1']
      });

      mockPerformanceTracker.getHistoricalPerformance.resolves(0.7);
      mockPerformanceTracker.logSelection.resolves();

      const result = await modelRouter.selectModel(query);

      expect(result.selectedModel).to.be.oneOf(['gpt-5-nano', 'gpt-5-mini', 'gpt-4.1']);
      expect(result.confidence).to.be.greaterThan(0);
    });
  });

  describe('estimateCost', () => {
    it('should estimate cost accurately for known models', () => {
      const cost = modelRouter.estimateCost('gpt-4.1', 1000);

      // gpt-4.1: 1000 input tokens * 0.00003 + 2500 output tokens * 0.00006
      const expectedCost = 1000 * 0.00003 + 2500 * 0.00006;
      expect(cost).to.be.closeTo(expectedCost, 0.000001);
    });

    it('should return 0 for unknown models', () => {
      const cost = modelRouter.estimateCost('unknown-model', 1000);
      expect(cost).to.equal(0);
    });

    it('should handle edge cases', () => {
      expect(modelRouter.estimateCost('gpt-4.1', 0)).to.equal(0);
      expect(modelRouter.estimateCost('gpt-4.1', -100)).to.equal(0);
      expect(modelRouter.estimateCost('gpt-4.1', -100)).to.be.at.least(0);
    });
  });

  describe('optimizeSelection', () => {
    it('should optimize based on complexity fit', () => {
      const complexityAnalysis = {
        overallScore: 0.8,
        complexity: 'high',
        recommendedModels: ['gpt-5', 'gpt-4.1']
      };

      const modelPerformance = { 'gpt-5': 0.9, 'gpt-4.1': 0.7 };
      const costEstimates = { 'gpt-5': 0.005, 'gpt-4.1': 0.002 };

      const result = modelRouter.optimizeSelection(complexityAnalysis, modelPerformance, costEstimates);

      expect(result.selectedModel).to.equal('gpt-5');
      expect(result.confidence).to.be.greaterThan(0.5);
      expect(result.reasoning).to.include('High complexity');
    });

    it('should prefer cost-effective models when performance is similar', () => {
      const complexityAnalysis = {
        overallScore: 0.3,
        complexity: 'low',
        recommendedModels: ['gpt-5-mini', 'gpt-5-nano']
      };

      const modelPerformance = { 'gpt-5-mini': 0.8, 'gpt-5-nano': 0.75 };
      const costEstimates = { 'gpt-5-mini': 0.001, 'gpt-5-nano': 0.0005 };

      const result = modelRouter.optimizeSelection(complexityAnalysis, modelPerformance, costEstimates);

      expect(result.selectedModel).to.equal('gpt-5-nano'); // Cheaper option
      expect(result.estimatedCost).to.equal(0.0005);
    });
  });

  describe('calculateComplexityFit', () => {
    it('should calculate fit for high complexity queries', () => {
      const complexityAnalysis = { complexity: 'high' };

      const fit = modelRouter.calculateComplexityFit('gpt-5', complexityAnalysis);
      expect(fit).to.be.greaterThan(0);

      const lowFit = modelRouter.calculateComplexityFit('gpt-5-nano', complexityAnalysis);
      expect(lowFit).to.be.lessThan(fit);
    });

    it('should calculate fit for low complexity queries', () => {
      const complexityAnalysis = { complexity: 'low' };

      const fit = modelRouter.calculateComplexityFit('gpt-5-nano', complexityAnalysis);
      expect(fit).to.be.greaterThan(0);

      const highFit = modelRouter.calculateComplexityFit('gpt-5', complexityAnalysis);
      expect(highFit).to.be.lessThanOrEqual(fit);
    });

    it('should return 0 for unknown models', () => {
      const complexityAnalysis = { complexity: 'medium' };
      const fit = modelRouter.calculateComplexityFit('unknown-model', complexityAnalysis);
      expect(fit).to.equal(0);
    });
  });

  describe('generateReasoning', () => {
    it('should generate appropriate reasoning for different scenarios', () => {
      const complexityAnalysis = { complexity: 'high', overallScore: 0.9 };

      const reasoning = modelRouter.generateReasoning('gpt-5', complexityAnalysis, 0.95, 0.005);

      expect(reasoning).to.include('High complexity');
      expect(reasoning).to.include('Strong historical performance');
    });

    it('should handle low complexity queries', () => {
      const complexityAnalysis = { complexity: 'low', overallScore: 0.2 };

      const reasoning = modelRouter.generateReasoning('gpt-5-mini', complexityAnalysis, 0.7, 0.0005);

      expect(reasoning).to.include('Simple query');
      expect(reasoning).to.include('cost-effective');
    });
  });

  describe('getAvailableModels', () => {
    it('should return list of available models', () => {
      const models = modelRouter.getAvailableModels();

      expect(models).to.be.an('array');
      expect(models).to.include('gpt-5');
      expect(models).to.include('gpt-4.1');
      expect(models).to.include('gpt-5-mini');
      expect(models).to.include('gpt-5-nano');
    });
  });

  describe('updateConstraints', () => {
    it('should update constraints', () => {
      const newConstraints = { maxCost: 0.02, maxResponseTime: 5000 };

      modelRouter.updateConstraints(newConstraints);

      expect(modelRouter.constraints.maxCost).to.equal(0.02);
      expect(modelRouter.constraints.maxResponseTime).to.equal(5000);
      expect(modelRouter.constraints.fallbackModel).to.equal('gpt-4.1'); // Unchanged
    });

    it('should merge with existing constraints', () => {
      modelRouter.updateConstraints({ maxCost: 0.05 });

      expect(modelRouter.constraints.maxCost).to.equal(0.05);
      expect(modelRouter.constraints.maxResponseTime).to.equal(10000); // Unchanged
    });
  });

  describe('error handling', () => {
    it('should handle performance tracker failures gracefully', async () => {
      mockComplexityAnalyzer.analyze.resolves({
        tokenCount: 100,
        overallScore: 0.5,
        complexity: 'medium',
        recommendedModels: ['gpt-4.1']
      });

      mockPerformanceTracker.getHistoricalPerformance.rejects(new Error('DB error'));
      mockPerformanceTracker.logSelection.resolves();

      const result = await modelRouter.selectModel('test query');

      expect(result.selectedModel).to.equal('gpt-4.1');
      expect(result.confidence).to.be.greaterThan(0);
    });

    it('should handle invalid complexity analysis results', async () => {
      mockComplexityAnalyzer.analyze.resolves({
        tokenCount: 100,
        overallScore: 0.5,
        complexity: 'invalid',
        recommendedModels: []
      });

      mockPerformanceTracker.getHistoricalPerformance.resolves(0.5);
      mockPerformanceTracker.logSelection.resolves();

      const result = await modelRouter.selectModel('test query');

      expect(result.selectedModel).to.equal('gpt-4.1'); // Fallback
      expect(result.confidence).to.be.at.least(0);
    });
  });
});