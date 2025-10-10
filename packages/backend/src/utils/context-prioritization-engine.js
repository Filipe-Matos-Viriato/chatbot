// packages/backend/src/utils/context-prioritization-engine.js
// Advanced context prioritization engine with multi-dimensional scoring
// To optimize retrieval results by prioritizing relevant context chunks based on intent analysis

import { createLogger } from './structured-logger.js';

/**
 * Context Prioritization Engine
 * Provides multi-dimensional scoring for context chunks based on intent relevance
 */
export class ContextPrioritizationEngine {
  constructor(clientConfig) {
    this.clientConfig = clientConfig;
    this.logger = createLogger('context-prioritization');
    this.scoringWeights = {
      semanticRelevance: 0.4,
      intentAlignment: 0.3,
      contextualFit: 0.2,
      behavioralRelevance: 0.1
    };
  }

  /**
   * Prioritize context chunks based on intent analysis
   * @param {Array} chunks - Raw context chunks from vector search
   * @param {Object} intentAnalysis - Intent analysis result
   * @param {Object} context - Additional context (user preferences, session data)
   * @returns {Array} Prioritized and scored chunks
   */
  prioritizeChunks(chunks, intentAnalysis, context = {}) {
    const startTime = Date.now();

    try {
      this.logger.info('context.prioritization.start', {
        chunkCount: chunks.length,
        primaryIntent: intentAnalysis.primaryIntent,
        confidence: intentAnalysis.confidence
      });

      if (!chunks || chunks.length === 0) {
        return [];
      }

      // Calculate scores for each chunk
      const scoredChunks = chunks.map((chunk, index) => {
        const scores = this.calculateChunkScores(chunk, intentAnalysis, context, index);

        return {
          ...chunk,
          prioritizationScores: scores,
          totalScore: this.calculateTotalScore(scores),
          priorityRank: 0, // Will be set after sorting
          relevanceCategory: this.categorizeRelevance(scores.totalScore)
        };
      });

      // Sort by total score (descending)
      scoredChunks.sort((a, b) => b.totalScore - a.totalScore);

      // Assign priority ranks
      scoredChunks.forEach((chunk, index) => {
        chunk.priorityRank = index + 1;
      });

      const duration = Date.now() - startTime;
      const highRelevanceCount = scoredChunks.filter(c => c.relevanceCategory === 'high').length;
      const mediumRelevanceCount = scoredChunks.filter(c => c.relevanceCategory === 'medium').length;

      this.logger.info('context.prioritization.complete', {
        duration,
        highRelevanceCount,
        mediumRelevanceCount,
        lowRelevanceCount: scoredChunks.length - highRelevanceCount - mediumRelevanceCount,
        topScore: scoredChunks[0]?.totalScore || 0
      });

      return scoredChunks;

    } catch (error) {
      this.logger.error('context.prioritization.error', {
        error: error.message,
        chunkCount: chunks.length,
        duration: Date.now() - startTime
      });

      // Return chunks with default scoring on error
      return chunks.map(chunk => ({
        ...chunk,
        prioritizationScores: { error: true },
        totalScore: 0.5,
        priorityRank: 1,
        relevanceCategory: 'medium'
      }));
    }
  }

  /**
   * Calculate multi-dimensional scores for a chunk
   * @param {Object} chunk - Context chunk
   * @param {Object} intentAnalysis - Intent analysis result
   * @param {Object} context - Additional context
   * @param {number} index - Original index in results
   * @returns {Object} Score breakdown
   */
  calculateChunkScores(chunk, intentAnalysis, context, index) {
    const scores = {
      semanticRelevance: this.calculateSemanticRelevance(chunk, intentAnalysis),
      intentAlignment: this.calculateIntentAlignment(chunk, intentAnalysis),
      contextualFit: this.calculateContextualFit(chunk, context),
      behavioralRelevance: this.calculateBehavioralRelevance(chunk, intentAnalysis, context),
      positionalBonus: this.calculatePositionalBonus(index),
      freshnessBonus: this.calculateFreshnessBonus(chunk)
    };

    scores.totalScore = this.calculateTotalScore(scores);

    return scores;
  }

  /**
   * Calculate semantic relevance based on content matching intent
   * @param {Object} chunk - Context chunk
   * @param {Object} intentAnalysis - Intent analysis
   * @returns {number} Semantic relevance score (0-1)
   */
  calculateSemanticRelevance(chunk, intentAnalysis) {
    const content = this.getChunkContent(chunk).toLowerCase();
    let score = 0;

    // Primary intent matching
    const primaryIntentKeywords = this.getIntentKeywords(intentAnalysis.primaryIntent);
    const primaryMatches = primaryIntentKeywords.filter(keyword =>
      content.includes(keyword.toLowerCase())
    ).length;
    score += Math.min(primaryMatches * 0.2, 0.4);

    // Entity matching
    const entityMatches = intentAnalysis.entities.filter(entity =>
      content.includes(entity.toLowerCase())
    ).length;
    score += Math.min(entityMatches * 0.15, 0.3);

    // Sub-intent matching
    const subIntentMatches = intentAnalysis.intents.slice(1).reduce((acc, intent) => {
      const keywords = this.getIntentKeywords(intent);
      const matches = keywords.filter(keyword => content.includes(keyword.toLowerCase())).length;
      return acc + Math.min(matches * 0.1, 0.2);
    }, 0);
    score += Math.min(subIntentMatches, 0.3);

    return Math.min(score, 1.0);
  }

  /**
   * Calculate intent alignment score
   * @param {Object} chunk - Context chunk
   * @param {Object} intentAnalysis - Intent analysis
   * @returns {number} Intent alignment score (0-1)
   */
  calculateIntentAlignment(chunk, intentAnalysis) {
    const metadata = chunk.metadata || {};
    let score = 0;

    // Document type alignment
    const docType = metadata.document_category || metadata.doc_type;
    if (docType) {
      score += this.getDocumentTypeAlignment(docType, intentAnalysis.primaryIntent) * 0.4;
    }

    // Content type alignment (listing vs development vs general)
    if (metadata.listing_id) {
      if (intentAnalysis.contextType === 'listing_specific') {
        score += 0.3;
      }
    } else if (metadata.development_id) {
      if (intentAnalysis.contextType === 'development_specific') {
        score += 0.3;
      }
    }

    // Urgency alignment
    if (intentAnalysis.urgencyLevel === 'high' && metadata.price_eur) {
      score += 0.2; // Price info is urgent
    }

    // Query type alignment
    if (intentAnalysis.queryType === 'transactional' && metadata.price_eur) {
      score += 0.1;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate contextual fit based on user preferences and session
   * @param {Object} chunk - Context chunk
   * @param {Object} context - User context
   * @returns {number} Contextual fit score (0-1)
   */
  calculateContextualFit(chunk, context) {
    const metadata = chunk.metadata || {};
    let score = 0;

    // User preferences alignment
    const userPrefs = context.userPreferences;
    if (userPrefs) {
      // Budget alignment
      if (userPrefs.budget && metadata.price_eur) {
        const priceDiff = Math.abs(metadata.price_eur - userPrefs.budget) / userPrefs.budget;
        if (priceDiff <= 0.2) score += 0.3; // Within 20% of budget
        else if (priceDiff <= 0.5) score += 0.1; // Within 50% of budget
      }

      // Typology alignment
      if (userPrefs.typology && metadata.beds) {
        const prefTypology = userPrefs.typology.match(/^T(\d+)$/)?.[1];
        if (prefTypology && parseInt(prefTypology) === metadata.beds) {
          score += 0.4;
        }
      }

      // Development preference
      if (userPrefs.development_preference && metadata.development_id === userPrefs.development_preference) {
        score += 0.3;
      }
    }

    // Session context alignment
    const sessionData = context.sessionData;
    if (sessionData) {
      // Current listing context
      if (sessionData.currentListingId && metadata.listing_id === sessionData.currentListingId) {
        score += 0.4;
      }

      // Current development context
      if (sessionData.currentDevelopmentId && metadata.development_id === sessionData.currentDevelopmentId) {
        score += 0.4;
      }
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate behavioral relevance based on user journey
   * @param {Object} chunk - Context chunk
   * @param {Object} intentAnalysis - Intent analysis
   * @param {Object} context - User context
   * @returns {number} Behavioral relevance score (0-1)
   */
  calculateBehavioralRelevance(chunk, intentAnalysis, context) {
    let score = 0;

    // Journey stage alignment
    const journeyStage = intentAnalysis.journeyStage;
    const metadata = chunk.metadata || {};

    if (journeyStage === 'awareness') {
      // General overview content
      if (!metadata.listing_id && !metadata.development_id) {
        score += 0.3;
      }
    } else if (journeyStage === 'consideration') {
      // Specific property details
      if (metadata.listing_id || metadata.development_id) {
        score += 0.3;
      }
    } else if (journeyStage === 'decision') {
      // Pricing and availability
      if (metadata.price_eur || metadata.current_state) {
        score += 0.4;
      }
    } else if (journeyStage === 'action') {
      // Contact information
      if (metadata.contact_info || metadata.agent_info) {
        score += 0.4;
      }
    }

    // Engagement level alignment
    const engagementLevel = intentAnalysis.engagementLevel;
    if (engagementLevel === 'high') {
      // Provide more detailed content
      const content = this.getChunkContent(chunk);
      if (content.length > 500) {
        score += 0.2;
      }
    }

    // Behavioral pattern alignment
    const pattern = intentAnalysis.behavioralPattern;
    if (pattern === 'price_sensitive' && metadata.price_eur) {
      score += 0.3;
    } else if (pattern === 'feature_focused' && this.hasFeatures(chunk)) {
      score += 0.3;
    }

    return Math.min(score, 1.0);
  }

  /**
   * Calculate positional bonus (earlier results get slight preference)
   * @param {number} index - Position in original results
   * @returns {number} Positional bonus (0-0.1)
   */
  calculatePositionalBonus(index) {
    // Give small bonus to top 10 results
    if (index < 10) {
      return (10 - index) * 0.01; // 0.1 to 0.01
    }
    return 0;
  }

  /**
   * Calculate freshness bonus based on content recency
   * @param {Object} chunk - Context chunk
   * @returns {number} Freshness bonus (0-0.1)
   */
  calculateFreshnessBonus(chunk) {
    const metadata = chunk.metadata || {};
    const updatedAt = metadata.updated_at || metadata.created_at;

    if (!updatedAt) return 0;

    const daysSinceUpdate = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSinceUpdate < 30) return 0.1; // Very recent
    if (daysSinceUpdate < 90) return 0.05; // Recent
    if (daysSinceUpdate < 365) return 0.02; // Somewhat recent

    return 0;
  }

  /**
   * Calculate total weighted score
   * @param {Object} scores - Individual score components
   * @returns {number} Total weighted score
   */
  calculateTotalScore(scores) {
    return (
      scores.semanticRelevance * this.scoringWeights.semanticRelevance +
      scores.intentAlignment * this.scoringWeights.intentAlignment +
      scores.contextualFit * this.scoringWeights.contextualFit +
      scores.behavioralRelevance * this.scoringWeights.behavioralRelevance +
      (scores.positionalBonus || 0) +
      (scores.freshnessBonus || 0)
    );
  }

  /**
   * Categorize relevance based on total score
   * @param {number} score - Total score
   * @returns {string} Relevance category
   */
  categorizeRelevance(score) {
    if (score >= 0.7) return 'high';
    if (score >= 0.4) return 'medium';
    return 'low';
  }

  // Helper methods

  getChunkContent(chunk) {
    return (
      chunk.metadata?.text ||
      chunk.metadata?.chunk ||
      chunk.metadata?.content ||
      chunk.metadata?.body ||
      chunk.metadata?.page_text ||
      ''
    );
  }

  getIntentKeywords(intent) {
    const keywordMap = {
      property_search: ['apartamento', 'casa', 'imóvel', 'propriedade', 'moradia'],
      feature_inquiry: ['piscina', 'garagem', 'terraço', 'elevador', 'varanda', 'jardim'],
      pricing_question: ['preço', 'custo', 'valor', '€', 'orçamento', 'financiamento'],
      location_question: ['localização', 'zona', 'bairro', 'área', 'proximidade', 'acesso'],
      availability_question: ['disponível', 'vago', 'livre', 'reservado', 'vendido'],
      comparison_request: ['comparar', 'diferença', 'versus', 'melhor', 'pior'],
      general_information: ['informação', 'detalhes', 'sobre', 'como', 'quando'],
      booking_interest: ['visita', 'marcar', 'contactar', 'interessado', 'brochura'],
      contact_request: ['contacto', 'telefone', 'email', 'falar', 'reunião']
    };

    return keywordMap[intent] || [];
  }

  getDocumentTypeAlignment(docType, intent) {
    const alignmentMap = {
      'unit_details': {
        property_search: 1.0,
        feature_inquiry: 0.9,
        pricing_question: 0.8
      },
      'development_info': {
        property_search: 0.8,
        location_question: 0.9,
        general_information: 0.7
      },
      'pricing_info': {
        pricing_question: 1.0,
        booking_interest: 0.6
      },
      'brochure': {
        general_information: 0.8,
        booking_interest: 0.7
      }
    };

    return alignmentMap[docType]?.[intent] || 0.5;
  }

  hasFeatures(chunk) {
    const content = this.getChunkContent(chunk).toLowerCase();
    const features = ['piscina', 'garagem', 'terraço', 'elevador', 'jardim', 'varanda'];

    return features.some(feature => content.includes(feature));
  }

  /**
   * Filter chunks based on relevance threshold
   * @param {Array} scoredChunks - Scored chunks
   * @param {number} threshold - Minimum relevance threshold (0-1)
   * @returns {Array} Filtered chunks
   */
  filterByRelevance(scoredChunks, threshold = 0.3) {
    return scoredChunks.filter(chunk => chunk.totalScore >= threshold);
  }

  /**
   * Get prioritization statistics
   * @param {Array} scoredChunks - Scored chunks
   * @returns {Object} Statistics
   */
  getStatistics(scoredChunks) {
    if (!scoredChunks || scoredChunks.length === 0) {
      return { total: 0, high: 0, medium: 0, low: 0, avgScore: 0 };
    }

    const categories = scoredChunks.reduce((acc, chunk) => {
      acc[chunk.relevanceCategory] = (acc[chunk.relevanceCategory] || 0) + 1;
      return acc;
    }, {});

    const avgScore = scoredChunks.reduce((sum, chunk) => sum + chunk.totalScore, 0) / scoredChunks.length;

    return {
      total: scoredChunks.length,
      high: categories.high || 0,
      medium: categories.medium || 0,
      low: categories.low || 0,
      avgScore: Math.round(avgScore * 100) / 100,
      topScore: scoredChunks[0]?.totalScore || 0
    };
  }
}

export default ContextPrioritizationEngine;