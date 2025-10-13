import ContextHierarchyEngine from '../src/utils/context-hierarchy-engine.js';
import SemanticDeduplicationEngine from '../src/utils/semantic-deduplication-engine.js';
import ContextCompressionEngine from '../src/utils/context-compression-engine.js';
import ContextWindowManager from '../src/utils/context-window-manager.js';
import AdaptivePresentationEngine from '../src/utils/adaptive-presentation-engine.js';
import { buildOptimizedContext } from '../src/utils/context.js';

describe('Context Optimization Engines', () => {
  describe('AdaptivePresentationEngine', () => {
    let engine;
    let mockClientConfig;

    beforeEach(() => {
      mockClientConfig = {
        clientName: 'Test Client',
        clientId: 'test-client-id'
      };
      engine = new AdaptivePresentationEngine(mockClientConfig);
    });

    describe('Strategy Selection', () => {
      test('should select comprehensive_comparison for comparison intents', () => {
        const intentAnalysis = {
          primaryIntent: 'comparison_request',
          intents: ['comparison_request'],
          urgencyLevel: 'medium'
        };
        const userContext = { engagementLevel: 'high', leadScore: 80 };
        const sessionData = {};
        const contextChunks = Array.from({ length: 5 }, (_, i) => ({
          id: `chunk-${i}`,
          text: `Property ${i} details`,
          score: 0.8 - i * 0.1,
          metadata: { listing_id: `L${i}` }
        }));

        const strategy = engine.selectPresentationStrategy(intentAnalysis, userContext, sessionData, contextChunks);

        expect(strategy).toBe('comprehensive_comparison');
      });

      test('should select focused_recommendation for property inquiries', () => {
        const intentAnalysis = {
          primaryIntent: 'property_search',
          intents: ['booking_interest'],
          urgencyLevel: 'high'
        };
        const userContext = { engagementLevel: 'high', leadScore: 85 };
        const sessionData = { currentListingId: 'L123' };
        const contextChunks = [
          { id: 'chunk-1', text: 'Property details', score: 0.9, metadata: { listing_id: 'L123' } }
        ];

        const strategy = engine.selectPresentationStrategy(intentAnalysis, userContext, sessionData, contextChunks);

        expect(strategy).toBe('focused_recommendation');
      });

      test('should select exploratory_browsing for general discovery', () => {
        const intentAnalysis = {
          primaryIntent: 'general_information',
          intents: [],
          urgencyLevel: 'low'
        };
        const userContext = { engagementLevel: 'low', hasHistory: false };
        const sessionData = {};
        const contextChunks = [
          { id: 'chunk-1', text: 'General property info', score: 0.7, metadata: {} }
        ];

        const strategy = engine.selectPresentationStrategy(intentAnalysis, userContext, sessionData, contextChunks);

        expect(strategy).toBe('exploratory_browsing');
      });

      test('should select personalized_journey for engaged users with preferences', () => {
        const intentAnalysis = {
          primaryIntent: 'general_information',
          intents: [],
          urgencyLevel: 'medium'
        };
        const userContext = {
          engagementLevel: 'high',
          leadScore: 90,
          hasHistory: true,
          preferences: { typology: 'T2', budget: 250000 }
        };
        const sessionData = {};
        const contextChunks = [
          { id: 'chunk-1', text: 'Personalized recommendations', score: 0.8, metadata: {} }
        ];

        const strategy = engine.selectPresentationStrategy(intentAnalysis, userContext, sessionData, contextChunks);

        expect(strategy).toBe('personalized_journey');
      });
    });

    describe('Presentation Application', () => {
      test('should present comprehensive comparison format', async () => {
        const contextChunks = [
          { id: 'L1', text: 'Property 1: T2, €200k, pool', score: 0.9, metadata: { listing_id: 'L1' } },
          { id: 'L2', text: 'Property 2: T3, €250k, garage', score: 0.8, metadata: { listing_id: 'L2' } }
        ];
        const intentAnalysis = { primaryIntent: 'comparison_request', intents: ['comparison_request'] };
        const userContext = { engagementLevel: 'high', preferences: { budget: 225000 } };
        const sessionData = {};

        const result = await engine.presentContext(contextChunks, intentAnalysis, userContext, sessionData);

        expect(result.strategy).toBe('comprehensive_comparison');
        expect(result.formattedContext).toContain('Comparação de Imóveis');
        expect(result.responseStructure.sections).toHaveLength(2);
        expect(result.responseStructure.callToActions).toContainEqual(
          expect.objectContaining({ type: 'schedule_visit' })
        );
        expect(result.personalizationElements).toContainEqual(
          expect.objectContaining({ type: 'budget_filter' })
        );
      });

      test('should present focused recommendation format', async () => {
        const contextChunks = [
          { id: 'L1', text: 'Premium T2 apartment with terrace', score: 0.9, metadata: { listing_id: 'L1' } }
        ];
        const intentAnalysis = { primaryIntent: 'property_search', intents: ['booking_interest'] };
        const userContext = { engagementLevel: 'high', preferences: { typology: 'T2' } };
        const sessionData = { currentListingId: 'L1' };

        const result = await engine.presentContext(contextChunks, intentAnalysis, userContext, sessionData);

        expect(result.strategy).toBe('focused_recommendation');
        expect(result.formattedContext).toContain('Recomendação:');
        expect(result.responseStructure.callToActions).toContainEqual(
          expect.objectContaining({ type: 'schedule_visit' })
        );
      });

      test('should present exploratory browsing format', async () => {
        const contextChunks = [
          { id: 'L1', text: 'Modern apartment in city center', score: 0.8, metadata: {} },
          { id: 'L2', text: 'Spacious house with garden', score: 0.7, metadata: {} }
        ];
        const intentAnalysis = { primaryIntent: 'general_information' };
        const userContext = { engagementLevel: 'low', hasHistory: false };
        const sessionData = {};

        const result = await engine.presentContext(contextChunks, intentAnalysis, userContext, sessionData);

        expect(result.strategy).toBe('exploratory_browsing');
        expect(result.formattedContext).toContain('Opções Disponíveis');
        expect(result.responseStructure.callToActions).toContainEqual(
          expect.objectContaining({ type: 'explore_more' })
        );
      });

      test('should present personalized journey format', async () => {
        const contextChunks = [
          { id: 'L1', text: 'Perfect T2 for your needs', score: 0.9, metadata: {} }
        ];
        const intentAnalysis = { primaryIntent: 'general_information' };
        const userContext = {
          engagementLevel: 'high',
          leadScore: 90,
          hasHistory: true,
          preferences: { typology: 'T2', budget: 250000 }
        };
        const sessionData = {};

        const result = await engine.presentContext(contextChunks, intentAnalysis, userContext, sessionData);

        expect(result.strategy).toBe('personalized_journey');
        expect(result.formattedContext).toContain('Onde Estamos na Sua Jornada');
        expect(result.personalizationElements).toHaveLength(1);
      });

      test('should present quick answer format for simple queries', async () => {
        const contextChunks = [
          { id: 'L1', text: 'Property available for viewing', score: 0.8, metadata: {} }
        ];
        const intentAnalysis = { primaryIntent: 'availability_question', urgencyLevel: 'high' };
        const userContext = { engagementLevel: 'medium' };
        const sessionData = {};

        const result = await engine.presentContext(contextChunks, intentAnalysis, userContext, sessionData);

        expect(result.strategy).toBe('quick_answer');
        expect(result.formattedContext).toContain('Resposta');
        expect(result.personalizationElements).toHaveLength(0);
      });
    });

    describe('Error Handling and Fallbacks', () => {
      test('should handle empty context chunks gracefully', async () => {
        const intentAnalysis = { primaryIntent: 'general_information' };
        const userContext = {};
        const sessionData = {};

        const result = await engine.presentContext([], intentAnalysis, userContext, sessionData);

        expect(result.strategy).toBe('quick_answer');
        expect(result.formattedContext).toBeDefined();
        expect(result.responseStructure).toBeDefined();
      });

      test('should handle malformed intent analysis', async () => {
        const contextChunks = [{ id: '1', text: 'test', score: 0.8, metadata: {} }];
        const intentAnalysis = null;
        const userContext = {};
        const sessionData = {};

        const result = await engine.presentContext(contextChunks, intentAnalysis, userContext, sessionData);

        expect(result.strategy).toBe('quick_answer');
        expect(result.formattedContext).toBeDefined();
      });

      test('should provide fallback presentation on errors', async () => {
        // Create engine with invalid config to trigger error
        const invalidEngine = new AdaptivePresentationEngine(null);

        const contextChunks = [{ id: '1', text: 'test', score: 0.8, metadata: {} }];
        const intentAnalysis = { primaryIntent: 'general_information' };
        const userContext = {};
        const sessionData = {};

        const result = await invalidEngine.presentContext(contextChunks, intentAnalysis, userContext, sessionData);

        expect(result.strategy).toBe('quick_answer');
        expect(result.formattedContext).toBeDefined();
      });
    });

    describe('Performance and Metrics', () => {
      test('should complete presentation within reasonable time', async () => {
        const contextChunks = Array.from({ length: 10 }, (_, i) => ({
          id: `chunk-${i}`,
          text: `Property ${i} description with some details`,
          score: 0.5 + i * 0.05,
          metadata: { listing_id: `L${i}` }
        }));
        const intentAnalysis = { primaryIntent: 'general_information' };
        const userContext = { engagementLevel: 'medium' };
        const sessionData = {};

        const startTime = Date.now();
        const result = await engine.presentContext(contextChunks, intentAnalysis, userContext, sessionData);
        const endTime = Date.now();

        expect(endTime - startTime).toBeLessThan(500); // Should complete within 500ms
        expect(result.formattingMetadata.processingTime).toBeGreaterThan(0);
        expect(result.formattingMetadata.contextTokens).toBeGreaterThan(0);
      });

      test('should calculate accurate strategy metrics', async () => {
        const contextChunks = [
          { id: '1', text: 'Test property', score: 0.8, metadata: {} },
          { id: '2', text: 'Another property', score: 0.7, metadata: {} }
        ];
        const intentAnalysis = { primaryIntent: 'general_information' };
        const userContext = { engagementLevel: 'medium' };
        const sessionData = {};

        const result = await engine.presentContext(contextChunks, intentAnalysis, userContext, sessionData);

        expect(result.formattingMetadata.strategyMetrics).toHaveProperty('strategy');
        expect(result.formattingMetadata.strategyMetrics.chunkCount).toBe(2);
        expect(result.formattingMetadata.strategyMetrics.sectionCount).toBeGreaterThan(0);
      });
    });
  });
});

describe('Context Optimization Engines', () => {
  describe('ContextHierarchyEngine', () => {
    // TODO: Add ContextHierarchyEngine tests
  });

  describe('SemanticDeduplicationEngine', () => {
    // TODO: Add SemanticDeduplicationEngine tests
  });

  describe('ContextCompressionEngine', () => {
    // TODO: Add ContextCompressionEngine tests
  });

  describe('ContextWindowManager', () => {
    // TODO: Add ContextWindowManager tests
  });

  describe('buildOptimizedContext Integration', () => {
    // TODO: Add integration tests
  });
});