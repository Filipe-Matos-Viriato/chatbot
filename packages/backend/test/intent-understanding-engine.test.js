// packages/backend/test/intent-understanding-engine.test.js
// Unit tests for IntentUnderstandingEngine

import IntentUnderstandingEngine from '../src/utils/intent-understanding-engine.js';

// Mock OpenAI to avoid API calls in tests
import sinon from 'sinon';

// Mock the OpenAI module
const mockOpenAI = {
  chat: {
    completions: {
      create: sinon.stub().resolves({
        choices: [{
          message: {
            content: JSON.stringify({
              primary_intent: 'property_search',
              confidence: 0.85,
              sub_intents: ['feature_inquiry'],
              entities: ['T2'],
              urgency_level: 'medium',
              query_type: 'informational'
            })
          }
        }]
      })
    }
  }
};

// Stub the OpenAI constructor
sinon.stub(require('openai'), 'default').returns(mockOpenAI);

describe('IntentUnderstandingEngine', () => {
  let engine;
  const mockClientConfig = {
    clientId: 'test-client',
    clientName: 'Test Client'
  };

  beforeEach(() => {
    engine = new IntentUnderstandingEngine(mockClientConfig);
  });

  describe('analyzeIntent', () => {
    it('should analyze property search intent correctly', async () => {
      const query = 'Quero ver apartamentos T2 disponíveis';
      const result = await engine.analyzeIntent(query);

      expect(result.primaryIntent).to.equal('property_search');
      expect(result.confidence).to.be.greaterThan(0.5);
      expect(result.entities).to.include('T2');
      expect(result.queryType).to.equal('informational');
    });

    it('should analyze feature inquiry intent', async () => {
      const query = 'Este apartamento tem piscina?';
      const result = await engine.analyzeIntent(query);

      expect(result.primaryIntent).to.equal('feature_inquiry');
      expect(result.entities).to.include('pool');
      expect(result.contextType).to.equal('listing_specific');
    });

    it('should analyze pricing questions', async () => {
      const query = 'Quanto custa este imóvel?';
      const result = await engine.analyzeIntent(query);

      expect(result.primaryIntent).to.equal('pricing_question');
      expect(result.queryType).to.equal('informational');
    });

    it('should handle behavioral context', async () => {
      const query = 'Quais são as opções de financiamento?';
      const context = {
        userHistory: [
          { type: 'question', query: 'Quanto custa o apartamento T2?', timestamp: Date.now() - 1000 },
          { type: 'click', listingId: '123', timestamp: Date.now() - 2000 }
        ]
      };

      const result = await engine.analyzeIntent(query, context);

      expect(result.behavioralPattern).to.equal('conversion_ready');
      expect(result.journeyStage).to.equal('decision');
    });

    it('should handle contextual information', async () => {
      const query = 'Quais são as comodidades?';
      const context = {
        sessionData: {
          currentListingId: 'listing-123',
          sessionDuration: 300, // 5 minutes
          pageViews: 3
        }
      };

      const result = await engine.analyzeIntent(query, context);

      expect(result.contextType).to.equal('listing_specific');
      expect(result.hasContextShift).to.equal(false);
    });

    it('should detect context shifts', async () => {
      const query = 'Quero ver apartamentos T3';
      const context = {
        sessionData: {
          previousQueries: ['Quanto custa o apartamento T2 no bloco 1?']
        }
      };

      const result = await engine.analyzeIntent(query, context);

      expect(result.hasContextShift).to.equal(true);
    });

    it('should cache results for performance', async () => {
      const query = 'Test query for caching';
      const context = { userHistory: [] };

      // First call
      const startTime = Date.now();
      const result1 = await engine.analyzeIntent(query, context);
      const firstCallTime = Date.now() - startTime;

      // Second call (should be cached)
      const secondStartTime = Date.now();
      const result2 = await engine.analyzeIntent(query, context);
      const secondCallTime = Date.now() - secondStartTime;

      expect(result1.primaryIntent).to.equal(result2.primaryIntent);
      expect(secondCallTime).to.be.lessThan(firstCallTime); // Cached call should be faster
    });

    it('should handle fallback gracefully on LLM failure', async () => {
      // Mock OpenAI to fail
      const originalOpenAI = global.openai;
      global.openai = {
        chat: {
          completions: {
            create: () => Promise.reject(new Error('API Error'))
          }
        }
      };

      const query = 'Test query';
      const result = await engine.analyzeIntent(query);

      expect(result.isFallback).to.equal(true);
      expect(result.primaryIntent).to.equal('general_information');
      expect(result.confidence).to.equal(0.3);

      // Restore original
      global.openai = originalOpenAI;
    });
  });

  describe('Behavioral Analysis', () => {
    it('should identify price-sensitive users', async () => {
      const context = {
        userHistory: [
          { type: 'question', query: 'Qual é o preço mais baixo?' },
          { type: 'question', query: 'Há descontos disponíveis?' },
          { type: 'question', query: 'Quanto custa o T1?' }
        ]
      };

      const result = await engine.analyzeIntent('Quanto custa?', context);
      expect(result.behavioralPattern).to.equal('price_sensitive');
    });

    it('should identify feature-focused users', async () => {
      const context = {
        userHistory: [
          { type: 'question', query: 'Tem piscina?' },
          { type: 'question', query: 'Tem garagem?' },
          { type: 'question', query: 'Tem terraço?' }
        ]
      };

      const result = await engine.analyzeIntent('Quais comodidades?', context);
      expect(result.behavioralPattern).to.equal('feature_focused');
    });

    it('should calculate engagement scores correctly', () => {
      const interactions = [
        { type: 'question', duration: 60 },
        { type: 'click', duration: 30 },
        { type: 'contact', duration: 120 }
      ];

      const score = engine.calculateEngagementScore(interactions);
      expect(score).to.be.greaterThan(0.5); // High engagement
    });

    it('should determine journey stages', () => {
      const earlyInteractions = [{ type: 'question' }];
      const midInteractions = Array(5).fill({ type: 'question' });
      const lateInteractions = Array(15).fill({ type: 'question' }).concat([{ type: 'contact' }]);

      expect(engine.determineJourneyStage(earlyInteractions)).to.equal('awareness');
      expect(engine.determineJourneyStage(midInteractions)).to.equal('consideration');
      expect(engine.determineJourneyStage(lateInteractions)).to.equal('action');
    });
  });

  describe('Context Analysis', () => {
    it('should handle listing-specific context', async () => {
      const context = {
        sessionData: {
          currentListingId: 'listing-123',
          sessionDuration: 180
        }
      };

      const result = await engine.analyzeIntent('Quanto custa?', context);
      expect(result.contextType).to.equal('listing_specific');
      expect(result.contextRelevance).to.be.greaterThan(0.8);
    });

    it('should handle development-specific context', async () => {
      const context = {
        sessionData: {
          currentDevelopmentId: 'dev-456',
          sessionDuration: 300
        }
      };

      const result = await engine.analyzeIntent('Quais apartamentos estão disponíveis?', context);
      expect(result.contextType).to.equal('development_specific');
    });
  });

  describe('Performance', () => {
    it('should complete analysis within reasonable time', async () => {
      const query = 'Quero ver apartamentos T2 com piscina';
      const startTime = Date.now();

      await engine.analyzeIntent(query);

      const duration = Date.now() - startTime;
      expect(duration).to.be.lessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent requests', async () => {
      const queries = [
        'Quanto custa o T2?',
        'Tem garagem?',
        'Qual é a localização?',
        'Posso marcar uma visita?'
      ];

      const promises = queries.map(query => engine.analyzeIntent(query));
      const results = await Promise.all(promises);

      expect(results).to.have.length(4);
      results.forEach(result => {
        expect(result.primaryIntent).to.be.defined;
        expect(result.confidence).to.be.defined;
      });
    });
  });
});