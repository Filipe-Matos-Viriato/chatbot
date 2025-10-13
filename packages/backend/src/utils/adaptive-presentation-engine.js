// packages/backend/src/utils/adaptive-presentation-engine.js
// Adaptive Presentation Engine for intelligent response formatting
// Relevant files: rag-service.js, context.js, question-strategies.js

import { createLogger } from './structured-logger.js';

/**
 * @typedef {Object} PresentationResult
 * @property {string} strategy - Selected presentation strategy
 * @property {string} formattedContext - Formatted context string
 * @property {Object} responseStructure - Structured response components
 * @property {Array} personalizationElements - Personalization elements used
 * @property {Object} formattingMetadata - Metadata about formatting decisions
 */

/**
 * @typedef {Object} ResponseStructure
 * @property {Array} sections - Response sections
 * @property {Array} callToActions - Call-to-action elements
 * @property {Array} followUpSuggestions - Follow-up suggestions
 */

/**
 * @typedef {Object} PersonalizationElement
 * @property {string} type - Element type (budget, typology, location, etc.)
 * @property {string} value - Element value
 * @property {number} relevance - Relevance score (0-1)
 */

/**
 * @typedef {Object} FormattingMetadata
 * @property {number} processingTime - Processing time in ms
 * @property {number} contextTokens - Context token count
 * @property {number} responseTokens - Response token count
 * @property {Object} strategyMetrics - Strategy-specific metrics
 */

/**
 * Presentation Strategy Types
 * @typedef {'comprehensive_comparison'|'focused_recommendation'|'exploratory_browsing'|'detailed_analysis'|'quick_answer'|'personalized_journey'} PresentationStrategy
 */

/**
 * Adaptive Presentation Engine
 * Intelligently selects and applies presentation strategies based on intent and context
 */
export class AdaptivePresentationEngine {
  constructor(clientConfig) {
    this.clientConfig = clientConfig;
    this.logger = createLogger('adaptive-presentation');

    // Strategy selection weights
    this.strategyWeights = {
      intent: 0.4,
      context: 0.3,
      userProfile: 0.2,
      contentType: 0.1
    };
  }

  /**
   * Presents context using adaptive formatting strategy
   * @param {Array} contextChunks - Prioritized context chunks
   * @param {Object} intentAnalysis - Intent analysis result
   * @param {Object} userContext - User context and preferences
   * @param {Object} sessionData - Session context data
   * @returns {Promise<PresentationResult>} Presentation result
   */
  async presentContext(contextChunks, intentAnalysis, userContext = {}, sessionData = {}) {
    const startTime = Date.now();

    try {
      this.logger.info('presentation.start', {
        chunkCount: contextChunks?.length || 0,
        primaryIntent: intentAnalysis?.primaryIntent,
        userEngagement: userContext?.engagementLevel
      });

      // Select optimal presentation strategy
      const strategy = this.selectPresentationStrategy(intentAnalysis, userContext, sessionData, contextChunks);

      // Apply strategy-specific formatting
      const result = await this.applyPresentationStrategy(strategy, contextChunks, intentAnalysis, userContext, sessionData);

      // Add metadata
      result.formattingMetadata = {
        processingTime: Date.now() - startTime,
        contextTokens: this.calculateContextTokens(contextChunks),
        responseTokens: this.calculateResponseTokens(result.formattedContext),
        strategyMetrics: this.calculateStrategyMetrics(strategy, contextChunks, result)
      };

      this.logger.info('presentation.complete', {
        strategy: result.strategy,
        processingTime: result.formattingMetadata.processingTime,
        contextTokens: result.formattingMetadata.contextTokens,
        responseTokens: result.formattingMetadata.responseTokens
      });

      return result;

    } catch (error) {
      this.logger.error('presentation.error', {
        error: error.message,
        chunkCount: contextChunks?.length || 0,
        processingTime: Date.now() - startTime
      });

      // Return fallback presentation
      return this.createFallbackPresentation(contextChunks, intentAnalysis);
    }
  }

  /**
   * Selects the optimal presentation strategy
   * @param {Object} intentAnalysis - Intent analysis result
   * @param {Object} userContext - User context
   * @param {Object} sessionData - Session data
   * @param {Array} contextChunks - Available context chunks
   * @returns {PresentationStrategy} Selected strategy
   */
  selectPresentationStrategy(intentAnalysis, userContext, sessionData, contextChunks) {
    const scores = this.calculateStrategyScores(intentAnalysis, userContext, sessionData, contextChunks);

    // Select strategy with highest score
    let bestStrategy = 'quick_answer';
    let bestScore = 0;

    for (const [strategy, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestStrategy = strategy;
      }
    }

    this.logger.info('strategy.selected', {
      strategy: bestStrategy,
      score: bestScore,
      scores: scores
    });

    return bestStrategy;
  }

  /**
   * Calculates scores for all presentation strategies
   * @param {Object} intentAnalysis - Intent analysis
   * @param {Object} userContext - User context
   * @param {Object} sessionData - Session data
   * @param {Array} contextChunks - Context chunks
   * @returns {Object} Strategy scores
   */
  calculateStrategyScores(intentAnalysis, userContext, sessionData, contextChunks) {
    const scores = {
      comprehensive_comparison: 0,
      focused_recommendation: 0,
      exploratory_browsing: 0,
      detailed_analysis: 0,
      quick_answer: 0,
      personalized_journey: 0
    };

    // Intent-based scoring
    const intent = intentAnalysis?.primaryIntent || 'general_information';
    const subIntents = intentAnalysis?.intents || [];
    const urgency = intentAnalysis?.urgencyLevel || 'medium';
    const engagement = userContext?.engagementLevel || 'medium';

    // Comprehensive comparison - best for comparison intents with multiple options
    if (intent.includes('comparison') || subIntents.includes('comparison_request')) {
      scores.comprehensive_comparison += 0.8;
    }
    if (contextChunks?.length > 3) {
      scores.comprehensive_comparison += 0.2;
    }

    // Focused recommendation - best for specific property inquiries
    if (intent.includes('property_search') || intent.includes('booking_interest')) {
      scores.focused_recommendation += 0.7;
    }
    if (sessionData?.currentListingId) {
      scores.focused_recommendation += 0.3;
    }
    if (engagement === 'high') {
      scores.focused_recommendation += 0.2;
    }

    // Exploratory browsing - best for general discovery
    if (intent.includes('general_information') || intent.includes('property_search')) {
      scores.exploratory_browsing += 0.6;
    }
    if (engagement === 'low' || !userContext?.hasHistory) {
      scores.exploratory_browsing += 0.3;
    }

    // Detailed analysis - best for complex inquiries requiring depth
    if (intent.includes('feature_inquiry') || intent.includes('pricing_question')) {
      scores.detailed_analysis += 0.7;
    }
    if (urgency === 'high' || engagement === 'high') {
      scores.detailed_analysis += 0.2;
    }

    // Quick answer - best for simple, direct questions
    if (intent.includes('availability_question') || intent.includes('location_question')) {
      scores.quick_answer += 0.8;
    }
    if (urgency === 'high') {
      scores.quick_answer += 0.2;
    }

    // Personalized journey - best for engaged users with preferences
    if (engagement === 'high' && userContext?.hasHistory) {
      scores.personalized_journey += 0.6;
    }
    if (userContext?.preferences && Object.keys(userContext.preferences).length > 0) {
      scores.personalized_journey += 0.3;
    }

    return scores;
  }

  /**
   * Applies the selected presentation strategy
   * @param {PresentationStrategy} strategy - Selected strategy
   * @param {Array} contextChunks - Context chunks
   * @param {Object} intentAnalysis - Intent analysis
   * @param {Object} userContext - User context
   * @param {Object} sessionData - Session data
   * @returns {Promise<PresentationResult>} Presentation result
   */
  async applyPresentationStrategy(strategy, contextChunks, intentAnalysis, userContext, sessionData) {
    switch (strategy) {
      case 'comprehensive_comparison':
        return await this.presentComprehensiveComparison(contextChunks, intentAnalysis, userContext);

      case 'focused_recommendation':
        return await this.presentFocusedRecommendation(contextChunks, intentAnalysis, userContext, sessionData);

      case 'exploratory_browsing':
        return await this.presentExploratoryBrowsing(contextChunks, intentAnalysis, userContext);

      case 'detailed_analysis':
        return await this.presentDetailedAnalysis(contextChunks, intentAnalysis, userContext);

      case 'quick_answer':
        return await this.presentQuickAnswer(contextChunks, intentAnalysis, userContext);

      case 'personalized_journey':
        return await this.presentPersonalizedJourney(contextChunks, intentAnalysis, userContext, sessionData);

      default:
        return await this.presentQuickAnswer(contextChunks, intentAnalysis, userContext);
    }
  }

  /**
   * Presents comprehensive comparison format
   * @param {Array} contextChunks - Context chunks
   * @param {Object} intentAnalysis - Intent analysis
   * @param {Object} userContext - User context
   * @returns {Promise<PresentationResult>} Presentation result
   */
  async presentComprehensiveComparison(contextChunks, intentAnalysis, userContext) {
    const sections = [];
    const personalizationElements = [];

    // Extract comparison criteria from intent
    const comparisonCriteria = this.extractComparisonCriteria(intentAnalysis);

    // Group chunks by property
    const propertyGroups = this.groupChunksByProperty(contextChunks);

    // Create comparison table/matrix
    const comparisonData = this.buildComparisonMatrix(propertyGroups, comparisonCriteria);

    sections.push({
      type: 'comparison_table',
      title: 'Comparação de Imóveis',
      content: comparisonData,
      criteria: comparisonCriteria
    });

    // Add summary insights
    const insights = this.generateComparisonInsights(comparisonData, userContext);
    sections.push({
      type: 'insights',
      title: 'Principais Conclusões',
      content: insights
    });

    // Personalization elements
    if (userContext?.preferences?.budget) {
      personalizationElements.push({
        type: 'budget_filter',
        value: userContext.preferences.budget,
        relevance: 0.9
      });
    }

    const formattedContext = this.formatSections(sections);

    return {
      strategy: 'comprehensive_comparison',
      formattedContext,
      responseStructure: {
        sections,
        callToActions: [
          { type: 'schedule_visit', text: 'Marcar visita aos imóveis de interesse' },
          { type: 'contact_agent', text: 'Falar com consultor especializado' }
        ],
        followUpSuggestions: [
          'Gostaria de ver mais detalhes sobre algum imóvel específico?',
          'Precisa de ajuda para comparar outros aspetos?'
        ]
      },
      personalizationElements
    };
  }

  /**
   * Presents focused recommendation format
   * @param {Array} contextChunks - Context chunks
   * @param {Object} intentAnalysis - Intent analysis
   * @param {Object} userContext - User context
   * @param {Object} sessionData - Session data
   * @returns {Promise<PresentationResult>} Presentation result
   */
  async presentFocusedRecommendation(contextChunks, intentAnalysis, userContext, sessionData) {
    const sections = [];
    const personalizationElements = [];

    // Find best matching property
    const topRecommendation = this.selectTopRecommendation(contextChunks, intentAnalysis, userContext, sessionData);

    // Create detailed recommendation section
    sections.push({
      type: 'recommendation',
      title: `Recomendação: ${topRecommendation.name || 'Imóvel Selecionado'}`,
      content: this.formatPropertyDetails(topRecommendation),
      reasoning: this.generateRecommendationReasoning(topRecommendation, userContext)
    });

    // Add why this property section
    sections.push({
      type: 'justification',
      title: 'Por que este imóvel?',
      content: this.generatePersonalizedJustification(topRecommendation, userContext)
    });

    // Personalization elements
    personalizationElements.push({
      type: 'typology_match',
      value: userContext?.preferences?.typologia,
      relevance: 0.8
    });

    const formattedContext = this.formatSections(sections);

    return {
      strategy: 'focused_recommendation',
      formattedContext,
      responseStructure: {
        sections,
        callToActions: [
          { type: 'schedule_visit', text: 'Marcar visita a este imóvel' },
          { type: 'request_brochure', text: 'Receber brochure detalhado' }
        ],
        followUpSuggestions: [
          'Gostaria de ver fotos do interior?',
          'Quer conhecer imóveis similares?'
        ]
      },
      personalizationElements
    };
  }

  /**
   * Presents exploratory browsing format
   * @param {Array} contextChunks - Context chunks
   * @param {Object} intentAnalysis - Intent analysis
   * @param {Object} userContext - User context
   * @returns {Promise<PresentationResult>} Presentation result
   */
  async presentExploratoryBrowsing(contextChunks, intentAnalysis, userContext) {
    const sections = [];
    const personalizationElements = [];

    // Create overview section
    const overview = this.createPropertyOverview(contextChunks, intentAnalysis);
    sections.push({
      type: 'overview',
      title: 'Opções Disponíveis',
      content: overview
    });

    // Add highlights section
    const highlights = this.extractKeyHighlights(contextChunks);
    sections.push({
      type: 'highlights',
      title: 'Destaques',
      content: highlights
    });

    // Add next steps guidance
    sections.push({
      type: 'guidance',
      title: 'Como Prosseguir',
      content: this.generateBrowsingGuidance(userContext)
    });

    const formattedContext = this.formatSections(sections);

    return {
      strategy: 'exploratory_browsing',
      formattedContext,
      responseStructure: {
        sections,
        callToActions: [
          { type: 'explore_more', text: 'Ver todas as opções disponíveis' },
          { type: 'refine_search', text: 'Afinar critérios de pesquisa' }
        ],
        followUpSuggestions: [
          'Que tipo de imóvel procura exatamente?',
          'Tem preferências de localização?'
        ]
      },
      personalizationElements
    };
  }

  /**
   * Presents detailed analysis format
   * @param {Array} contextChunks - Context chunks
   * @param {Object} intentAnalysis - Intent analysis
   * @param {Object} userContext - User context
   * @returns {Promise<PresentationResult>} Presentation result
   */
  async presentDetailedAnalysis(contextChunks, intentAnalysis, userContext) {
    const sections = [];
    const personalizationElements = [];

    // Deep analysis based on intent
    const analysisType = this.determineAnalysisType(intentAnalysis);

    switch (analysisType) {
      case 'pricing':
        sections.push({
          type: 'pricing_analysis',
          title: 'Análise de Preços Detalhada',
          content: this.analyzePricing(contextChunks, userContext)
        });
        break;

      case 'features':
        sections.push({
          type: 'feature_analysis',
          title: 'Análise de Comodidades',
          content: this.analyzeFeatures(contextChunks, intentAnalysis)
        });
        break;

      case 'location':
        sections.push({
          type: 'location_analysis',
          title: 'Análise de Localização',
          content: this.analyzeLocation(contextChunks, userContext)
        });
        break;

      default:
        sections.push({
          type: 'comprehensive_analysis',
          title: 'Análise Completa',
          content: this.createComprehensiveAnalysis(contextChunks, intentAnalysis)
        });
    }

    // Add recommendations based on analysis
    sections.push({
      type: 'recommendations',
      title: 'Recomendações',
      content: this.generateAnalysisRecommendations(contextChunks, analysisType, userContext)
    });

    const formattedContext = this.formatSections(sections);

    return {
      strategy: 'detailed_analysis',
      formattedContext,
      responseStructure: {
        sections,
        callToActions: [
          { type: 'schedule_consultation', text: 'Agendar consulta especializada' },
          { type: 'request_detailed_report', text: 'Receber relatório detalhado' }
        ],
        followUpSuggestions: [
          'Gostaria de aprofundar algum aspeto específico?',
          'Tem dúvidas sobre os dados apresentados?'
        ]
      },
      personalizationElements
    };
  }

  /**
   * Presents quick answer format
   * @param {Array} contextChunks - Context chunks
   * @param {Object} intentAnalysis - Intent analysis
   * @param {Object} userContext - User context
   * @returns {Promise<PresentationResult>} Presentation result
   */
  async presentQuickAnswer(contextChunks, intentAnalysis, userContext) {
    // Extract most relevant information for direct answer
    const keyInfo = this.extractKeyInformation(contextChunks, intentAnalysis);

    const sections = [{
      type: 'direct_answer',
      title: 'Resposta',
      content: keyInfo
    }];

    // Add brief context if needed
    if (this.needsAdditionalContext(intentAnalysis)) {
      sections.push({
        type: 'additional_context',
        title: 'Informação Adicional',
        content: this.extractSupportingInfo(contextChunks, intentAnalysis)
      });
    }

    const formattedContext = this.formatSections(sections);

    return {
      strategy: 'quick_answer',
      formattedContext,
      responseStructure: {
        sections,
        callToActions: [
          { type: 'learn_more', text: 'Saber mais sobre este imóvel' }
        ],
        followUpSuggestions: [
          'Precisa de mais detalhes?',
          'Quer ver opções similares?'
        ]
      },
      personalizationElements: []
    };
  }

  /**
   * Presents personalized journey format
   * @param {Array} contextChunks - Context chunks
   * @param {Object} intentAnalysis - Intent analysis
   * @param {Object} userContext - User context
   * @param {Object} sessionData - Session data
   * @returns {Promise<PresentationResult>} Presentation result
   */
  async presentPersonalizedJourney(contextChunks, intentAnalysis, userContext, sessionData) {
    const sections = [];
    const personalizationElements = [];

    // Create personalized journey based on user profile
    const journeyStage = this.determineJourneyStage(userContext, sessionData);

    sections.push({
      type: 'journey_status',
      title: 'Onde Estamos na Sua Jornada',
      content: this.describeJourneyStage(journeyStage, userContext)
    });

    // Personalized recommendations
    const recommendations = this.generateJourneyRecommendations(contextChunks, journeyStage, userContext);
    sections.push({
      type: 'personalized_recommendations',
      title: 'Recomendações Personalizadas',
      content: recommendations
    });

    // Next steps guidance
    sections.push({
      type: 'next_steps',
      title: 'Próximos Passos Sugeridos',
      content: this.generateNextStepsGuidance(journeyStage, userContext)
    });

    // Collect personalization elements
    personalizationElements.push(
      ...this.extractPersonalizationElements(userContext)
    );

    const formattedContext = this.formatSections(sections);

    return {
      strategy: 'personalized_journey',
      formattedContext,
      responseStructure: {
        sections,
        callToActions: this.generateJourneyCallToActions(journeyStage),
        followUpSuggestions: this.generateJourneyFollowUps(journeyStage)
      },
      personalizationElements
    };
  }

  // Helper methods

  extractComparisonCriteria(intentAnalysis) {
    // Extract what user wants to compare
    const criteria = ['preço'];

    if (intentAnalysis.entities.includes('pool') || intentAnalysis.entities.includes('piscina')) {
      criteria.push('piscina');
    }
    if (intentAnalysis.entities.includes('garage') || intentAnalysis.entities.includes('garagem')) {
      criteria.push('garagem');
    }
    if (intentAnalysis.entities.includes('terrace') || intentAnalysis.entities.includes('terraço')) {
      criteria.push('terraço');
    }

    return criteria;
  }

  groupChunksByProperty(contextChunks) {
    const propertyGroups = {};

    contextChunks.forEach(chunk => {
      const propertyId = chunk.metadata?.listing_id || chunk.metadata?.development_id || 'general';
      if (!propertyGroups[propertyId]) {
        propertyGroups[propertyId] = [];
      }
      propertyGroups[propertyId].push(chunk);
    });

    return propertyGroups;
  }

  buildComparisonMatrix(propertyGroups, criteria) {
    // Build comparison matrix from property groups
    return Object.entries(propertyGroups).map(([propertyId, chunks]) => {
      const propertyData = { id: propertyId };

      // Extract data for each criterion
      criteria.forEach(criterion => {
        propertyData[criterion] = this.extractCriterionData(chunks, criterion);
      });

      return propertyData;
    });
  }

  extractCriterionData(chunks, criterion) {
    // Extract specific data for comparison criterion
    const relevantChunk = chunks.find(chunk =>
      chunk.text.toLowerCase().includes(criterion.toLowerCase())
    );

    if (!relevantChunk) return 'N/A';

    // Extract value based on criterion
    switch (criterion) {
      case 'preço':
        return this.extractPrice(relevantChunk);
      case 'piscina':
        return this.hasFeature(relevantChunk, ['piscina', 'pool']) ? 'Sim' : 'Não';
      case 'garagem':
        return this.hasFeature(relevantChunk, ['garagem', 'garage']) ? 'Sim' : 'Não';
      case 'terraço':
        return this.hasFeature(relevantChunk, ['terraço', 'terrace']) ? 'Sim' : 'Não';
      default:
        return 'N/A';
    }
  }

  selectTopRecommendation(contextChunks, intentAnalysis, userContext, sessionData) {
    // Select best property based on user preferences and context
    let bestChunk = contextChunks[0];

    if (sessionData?.currentListingId) {
      // Prioritize current listing context
      const currentListingChunk = contextChunks.find(chunk =>
        chunk.metadata?.listing_id === sessionData.currentListingId
      );
      if (currentListingChunk) {
        bestChunk = currentListingChunk;
      }
    } else if (userContext?.preferences) {
      // Score chunks based on preference match
      const scoredChunks = contextChunks.map(chunk => ({
        chunk,
        score: this.calculatePreferenceMatchScore(chunk, userContext.preferences)
      }));

      scoredChunks.sort((a, b) => b.score - a.score);
      bestChunk = scoredChunks[0].chunk;
    }

    return bestChunk;
  }

  calculatePreferenceMatchScore(chunk, preferences) {
    let score = 0;

    if (preferences.typology && chunk.metadata?.beds) {
      const prefTypology = preferences.typology.match(/^T(\d+)$/)?.[1];
      if (prefTypology && parseInt(prefTypology) === chunk.metadata.beds) {
        score += 0.4;
      }
    }

    if (preferences.budget && chunk.metadata?.price_eur) {
      const priceDiff = Math.abs(chunk.metadata.price_eur - preferences.budget) / preferences.budget;
      if (priceDiff <= 0.2) score += 0.4;
      else if (priceDiff <= 0.5) score += 0.2;
    }

    return score;
  }

  formatSections(sections) {
    return sections.map(section => {
      let formatted = `### ${section.title}\n\n`;

      if (section.content) {
        formatted += section.content;
      }

      if (section.reasoning) {
        formatted += `\n\n**Razão:** ${section.reasoning}`;
      }

      return formatted;
    }).join('\n\n---\n\n');
  }

  createFallbackPresentation(contextChunks, intentAnalysis) {
    // Simple fallback to basic formatting
    const formattedContext = contextChunks
      .map(chunk => chunk.text)
      .join('\n\n---\n\n');

    return {
      strategy: 'quick_answer',
      formattedContext,
      responseStructure: {
        sections: [{
          type: 'fallback',
          title: 'Informação Disponível',
          content: formattedContext
        }],
        callToActions: [],
        followUpSuggestions: []
      },
      personalizationElements: []
    };
  }

  calculateContextTokens(contextChunks) {
    // Estimate token count (simplified)
    return contextChunks.reduce((total, chunk) => total + (chunk.text?.length || 0) / 4, 0);
  }

  calculateResponseTokens(formattedContext) {
    // Estimate token count (simplified)
    return (formattedContext?.length || 0) / 4;
  }

  calculateStrategyMetrics(strategy, contextChunks, result) {
    return {
      strategy,
      chunkCount: contextChunks?.length || 0,
      sectionCount: result.responseStructure?.sections?.length || 0,
      callToActionCount: result.responseStructure?.callToActions?.length || 0,
      personalizationCount: result.personalizationElements?.length || 0
    };
  }

  // Additional helper methods would be implemented here
  // (generateComparisonInsights, formatPropertyDetails, etc.)
}

export default AdaptivePresentationEngine;