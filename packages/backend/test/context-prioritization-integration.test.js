// packages/backend/test/context-prioritization-integration.test.js
// Integration tests for ContextPrioritizationEngine

import ContextPrioritizationEngine from '../src/utils/context-prioritization-engine.js';
import IntentUnderstandingEngine from '../src/utils/intent-understanding-engine.js';

describe('ContextPrioritizationEngine Integration', () => {
  let prioritizationEngine;
  let intentEngine;
  const mockClientConfig = {
    clientId: 'test-client',
    clientName: 'Test Client'
  };

  beforeEach(() => {
    prioritizationEngine = new ContextPrioritizationEngine(mockClientConfig);
    intentEngine = new IntentUnderstandingEngine(mockClientConfig);
  });

  describe('End-to-End Context Prioritization', () => {
    it('should prioritize chunks for property search intent', async () => {
      const query = 'Quero ver apartamentos T2 disponíveis';
      const intentAnalysis = await intentEngine.analyzeIntent(query);

      const mockChunks = [
        {
          id: 'chunk-1',
          metadata: {
            text: 'Apartamento T2 com 2 quartos e 2 casas de banho, área de 85m²',
            listing_id: 'apt-001',
            typology: 'T2',
            beds: 2,
            document_category: 'unit_details'
          },
          score: 0.8
        },
        {
          id: 'chunk-2',
          metadata: {
            text: 'Informações sobre o empreendimento e localização',
            development_id: 'dev-001',
            document_category: 'development_info'
          },
          score: 0.6
        },
        {
          id: 'chunk-3',
          metadata: {
            text: 'Apartamento T1 com 1 quarto, área de 65m²',
            listing_id: 'apt-002',
            typology: 'T1',
            beds: 1,
            document_category: 'unit_details'
          },
          score: 0.7
        }
      ];

      const prioritized = prioritizationEngine.prioritizeChunks(mockChunks, intentAnalysis);

      expect(prioritized[0].metadata.typology).toBe('T2'); // T2 should be prioritized
      expect(prioritized[0].totalScore).toBeGreaterThan(prioritized[1].totalScore);
      expect(prioritized[0].relevanceCategory).toBe('high');
    });

    it('should prioritize chunks for feature inquiry intent', async () => {
      const query = 'Este apartamento tem piscina?';
      const intentAnalysis = await intentEngine.analyzeIntent(query);

      const mockChunks = [
        {
          id: 'chunk-1',
          metadata: {
            text: 'O empreendimento conta com piscina, ginásio e jardim',
            listing_id: 'apt-001',
            document_category: 'unit_details',
            generated_tags: ['comodidade:piscina', 'comodidade:ginásio']
          },
          score: 0.8
        },
        {
          id: 'chunk-2',
          metadata: {
            text: 'Informações sobre preços e condições de venda',
            listing_id: 'apt-001',
            document_category: 'pricing_info'
          },
          score: 0.7
        },
        {
          id: 'chunk-3',
          metadata: {
            text: 'Apartamento sem piscina mas com vista para o mar',
            listing_id: 'apt-002',
            document_category: 'unit_details'
          },
          score: 0.6
        }
      ];

      const prioritized = prioritizationEngine.prioritizeChunks(mockChunks, intentAnalysis);

      expect(prioritized[0].metadata.generated_tags).toContain('comodidade:piscina');
      expect(prioritized[0].relevanceCategory).toBe('high');
    });

    it('should prioritize chunks for pricing questions', async () => {
      const query = 'Quanto custa este apartamento?';
      const intentAnalysis = await intentEngine.analyzeIntent(query);

      const mockChunks = [
        {
          id: 'chunk-1',
          metadata: {
            text: 'Preço: €250.000 - Condições especiais disponíveis',
            listing_id: 'apt-001',
            price_eur: 250000,
            document_category: 'pricing_info'
          },
          score: 0.8
        },
        {
          id: 'chunk-2',
          metadata: {
            text: 'Apartamento T2 com 2 quartos e vista para o jardim',
            listing_id: 'apt-001',
            document_category: 'unit_details'
          },
          score: 0.7
        }
      ];

      const prioritized = prioritizationEngine.prioritizeChunks(mockChunks, intentAnalysis);

      expect(prioritized[0].metadata.price_eur).toBe(250000);
      expect(prioritized[0].relevanceCategory).toBe('high');
    });

    it('should consider user preferences in prioritization', async () => {
      const query = 'Mostre-me apartamentos disponíveis';
      const intentAnalysis = await intentEngine.analyzeIntent(query);

      const context = {
        userPreferences: {
          typology: 'T2',
          budget: 300000
        }
      };

      const mockChunks = [
        {
          id: 'chunk-1',
          metadata: {
            text: 'Apartamento T2, preço €280.000',
            listing_id: 'apt-001',
            typology: 'T2',
            beds: 2,
            price_eur: 280000,
            document_category: 'unit_details'
          },
          score: 0.8
        },
        {
          id: 'chunk-2',
          metadata: {
            text: 'Apartamento T3, preço €350.000',
            listing_id: 'apt-002',
            typology: 'T3',
            beds: 3,
            price_eur: 350000,
            document_category: 'unit_details'
          },
          score: 0.7
        },
        {
          id: 'chunk-3',
          metadata: {
            text: 'Apartamento T1, preço €200.000',
            listing_id: 'apt-003',
            typology: 'T1',
            beds: 1,
            price_eur: 200000,
            document_category: 'unit_details'
          },
          score: 0.6
        }
      ];

      const prioritized = prioritizationEngine.prioritizeChunks(mockChunks, intentAnalysis, context);

      // T2 should be prioritized over T3 and T1 due to user preference
      expect(prioritized[0].metadata.typology).toBe('T2');
      expect(prioritized[0].totalScore).toBeGreaterThan(prioritized[1].totalScore);
    });

    it('should consider behavioral patterns', async () => {
      const query = 'Quais são as opções disponíveis?';
      const intentAnalysis = await intentEngine.analyzeIntent(query, {
        userHistory: [
          { type: 'question', query: 'Quanto custa?' },
          { type: 'question', query: 'Qual é o preço?' },
          { type: 'click', listingId: 'apt-001' }
        ]
      });

      const mockChunks = [
        {
          id: 'chunk-1',
          metadata: {
            text: 'Preço €250.000 - Financiamento disponível',
            listing_id: 'apt-001',
            price_eur: 250000,
            document_category: 'pricing_info'
          },
          score: 0.8
        },
        {
          id: 'chunk-2',
          metadata: {
            text: 'Apartamento com piscina e terraço',
            listing_id: 'apt-001',
            document_category: 'unit_details',
            generated_tags: ['comodidade:piscina', 'comodidade:terraço']
          },
          score: 0.7
        }
      ];

      const prioritized = prioritizationEngine.prioritizeChunks(mockChunks, intentAnalysis);

      // Price info should be prioritized for price-sensitive users
      expect(prioritized[0].metadata.price_eur).toBe(250000);
    });

    it('should filter out low relevance chunks', async () => {
      const query = 'Quero ver apartamentos T2';
      const intentAnalysis = await intentEngine.analyzeIntent(query);

      const mockChunks = [
        {
          id: 'chunk-1',
          metadata: {
            text: 'Apartamento T2 disponível',
            listing_id: 'apt-001',
            typology: 'T2',
            beds: 2,
            document_category: 'unit_details'
          },
          score: 0.8
        },
        {
          id: 'chunk-2',
          metadata: {
            text: 'Informações sobre o tempo em Aveiro',
            document_category: 'general_info'
          },
          score: 0.3
        },
        {
          id: 'chunk-3',
          metadata: {
            text: 'Restaurantes próximos ao empreendimento',
            document_category: 'location_info'
          },
          score: 0.2
        }
      ];

      const prioritized = prioritizationEngine.prioritizeChunks(mockChunks, intentAnalysis);
      const filtered = prioritizationEngine.filterByRelevance(prioritized, 0.3);

      expect(filtered.length).toBe(1); // Only the T2 apartment should remain
      expect(filtered[0].metadata.typology).toBe('T2');
    });

    it('should handle empty chunks gracefully', () => {
      const query = 'Test query';
      const mockIntentAnalysis = {
        primaryIntent: 'general_information',
        confidence: 0.5,
        entities: [],
        behavioralPattern: 'exploratory'
      };

      const prioritized = prioritizationEngine.prioritizeChunks([], mockIntentAnalysis);
      expect(prioritized).toEqual([]);
    });

    it('should handle chunks without metadata', async () => {
      const query = 'Test query';
      const intentAnalysis = await intentEngine.analyzeIntent(query);

      const mockChunks = [
        { id: 'chunk-1', score: 0.8 }, // No metadata
        { id: 'chunk-2', metadata: {}, score: 0.7 } // Empty metadata
      ];

      const prioritized = prioritizationEngine.prioritizeChunks(mockChunks, intentAnalysis);

      expect(prioritized.length).toBe(2);
      expect(prioritized[0].totalScore).toBeDefined();
      expect(prioritized[0].relevanceCategory).toBeDefined();
    });
  });

  describe('Statistics and Analytics', () => {
    it('should generate correct prioritization statistics', async () => {
      const query = 'Quero apartamentos';
      const intentAnalysis = await intentEngine.analyzeIntent(query);

      const mockChunks = [
        { id: 'high-1', metadata: { text: 'T2 apartment', typology: 'T2' }, score: 0.9 },
        { id: 'high-2', metadata: { text: 'T3 apartment', typology: 'T3' }, score: 0.8 },
        { id: 'med-1', metadata: { text: 'Location info', document_category: 'location' }, score: 0.6 },
        { id: 'low-1', metadata: { text: 'Weather info', document_category: 'general' }, score: 0.2 }
      ];

      const prioritized = prioritizationEngine.prioritizeChunks(mockChunks, intentAnalysis);
      const stats = prioritizationEngine.getStatistics(prioritized);

      expect(stats.total).toBe(4);
      expect(stats.high).toBeGreaterThanOrEqual(2);
      expect(stats.medium).toBeGreaterThanOrEqual(1);
      expect(stats.low).toBeGreaterThanOrEqual(0);
      expect(stats.avgScore).toBeDefined();
      expect(stats.topScore).toBeDefined();
    });
  });

  describe('Performance and Reliability', () => {
    it('should complete prioritization within reasonable time', async () => {
      const query = 'Test query';
      const intentAnalysis = await intentEngine.analyzeIntent(query);

      const mockChunks = Array(50).fill().map((_, i) => ({
        id: `chunk-${i}`,
        metadata: {
          text: `Test content ${i}`,
          document_category: 'unit_details'
        },
        score: Math.random()
      }));

      const startTime = Date.now();
      const prioritized = prioritizationEngine.prioritizeChunks(mockChunks, intentAnalysis);
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(1000); // Should complete within 1 second
      expect(prioritized.length).toBe(50);
    });

    it('should handle malformed chunks gracefully', async () => {
      const query = 'Test query';
      const intentAnalysis = await intentEngine.analyzeIntent(query);

      const mockChunks = [
        null,
        undefined,
        { id: 'valid', metadata: { text: 'Valid content' }, score: 0.8 },
        { id: 'invalid', score: 'not-a-number' }
      ];

      const prioritized = prioritizationEngine.prioritizeChunks(mockChunks, intentAnalysis);

      expect(prioritized.length).toBe(2); // Only valid chunks should be processed
      expect(prioritized[0].id).toBe('valid');
    });

    it('should maintain chunk order and properties', async () => {
      const query = 'Test query';
      const intentAnalysis = await intentEngine.analyzeIntent(query);

      const mockChunks = [
        {
          id: 'chunk-1',
          metadata: { text: 'Content 1', customProp: 'value1' },
          score: 0.5,
          customField: 'custom1'
        }
      ];

      const prioritized = prioritizationEngine.prioritizeChunks(mockChunks, intentAnalysis);

      expect(prioritized[0].id).toBe('chunk-1');
      expect(prioritized[0].metadata.customProp).toBe('value1');
      expect(prioritized[0].customField).toBe('custom1');
      expect(prioritized[0].prioritizationScores).toBeDefined();
      expect(prioritized[0].totalScore).toBeDefined();
    });
  });
});