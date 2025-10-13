// packages/backend/src/utils/intent-understanding-engine.js
// Advanced intent understanding engine for multi-modal query analysis
// To provide sophisticated intent classification with semantic, behavioral, and contextual analysis

import OpenAI from 'openai';
import { createLogger } from './structured-logger.js';

// Initialize OpenAI client for intent analysis
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'test-key', // Allow test key for development
});

/**
 * Intent Understanding Engine
 * Provides multi-modal analysis of user queries for advanced intent classification
 */
export class IntentUnderstandingEngine {
  constructor(clientConfig) {
    this.clientConfig = clientConfig;
    this.logger = createLogger('intent-engine');
    this.intentCache = new Map(); // Simple in-memory cache for performance
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Main method to analyze user query intent
   * @param {string} query - User query text
   * @param {Object} context - Additional context (user history, session data, etc.)
   * @returns {Promise<Object>} Intent analysis result
   */
  async analyzeIntent(query, context = {}) {
    const startTime = Date.now();

    try {
      this.logger.info('intent.analysis.start', {
        queryLength: query.length,
        hasUserHistory: Boolean(context.userHistory),
        hasSessionData: Boolean(context.sessionData)
      });

      // Check cache first
      const cacheKey = this.generateCacheKey(query, context);
      const cached = this.getCachedResult(cacheKey);
      if (cached) {
        this.logger.info('intent.analysis.cached', { cacheKey });
        return cached;
      }

      // Multi-modal analysis
      const [semanticIntent, behavioralIntent, contextualIntent] = await Promise.all([
        this.analyzeSemanticIntent(query),
        this.analyzeBehavioralIntent(query, context.userHistory),
        this.analyzeContextualIntent(query, context.sessionData)
      ]);

      // Combine and score intents
      const combinedIntent = this.combineIntentAnalysis(semanticIntent, behavioralIntent, contextualIntent);

      // Cache result
      this.setCachedResult(cacheKey, combinedIntent);

      const duration = Date.now() - startTime;
      this.logger.info('intent.analysis.complete', {
        duration,
        primaryIntent: combinedIntent.primaryIntent,
        confidence: combinedIntent.confidence,
        intentCount: combinedIntent.intents.length
      });

      return combinedIntent;

    } catch (error) {
      this.logger.error('intent.analysis.error', {
        error: error.message,
        query: query.substring(0, 100),
        duration: Date.now() - startTime
      });

      // Return fallback intent analysis
      return this.createFallbackIntent(query);
    }
  }

  /**
   * Analyze semantic intent using LLM
   * @param {string} query - User query
   * @returns {Promise<Object>} Semantic intent analysis
   */
  async analyzeSemanticIntent(query) {
    const prompt = `Analyze the following user query and classify its primary intent in the context of real estate/property search. Consider semantic meaning, implied goals, and information needs.

Query: "${query}"

Respond with a JSON object containing:
- primary_intent: Main intent category (one of: property_search, feature_inquiry, pricing_question, location_question, availability_question, comparison_request, general_information, booking_interest, contact_request)
- confidence: Confidence score (0.0-1.0)
- sub_intents: Array of secondary intents
- entities: Key entities mentioned (property types, features, locations, etc.)
- urgency_level: low/medium/high based on query language
- query_type: informational/transactional/navigational

Example response:
{
  "primary_intent": "feature_inquiry",
  "confidence": 0.85,
  "sub_intents": ["property_search"],
  "entities": ["pool", "T3"],
  "urgency_level": "medium",
  "query_type": "informational"
}`;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300,
        response_format: { type: "json_object" }
      });

      const result = JSON.parse(completion.choices[0].message.content);

      return {
        type: 'semantic',
        primaryIntent: result.primary_intent,
        confidence: result.confidence,
        subIntents: result.sub_intents || [],
        entities: result.entities || [],
        urgencyLevel: result.urgency_level,
        queryType: result.query_type,
        rawAnalysis: result
      };

    } catch (error) {
      this.logger.warn('semantic.intent.analysis.failed', { error: error.message });
      return this.createFallbackSemanticIntent(query);
    }
  }

  /**
   * Analyze behavioral intent from user history
   * @param {string} query - Current query
   * @param {Array} userHistory - Previous interactions
   * @returns {Promise<Object>} Behavioral intent analysis
   */
  async analyzeBehavioralIntent(query, userHistory = []) {
    if (!userHistory || userHistory.length === 0) {
      return {
        type: 'behavioral',
        pattern: 'new_user',
        confidence: 0.5,
        engagement: 'unknown',
        journeyStage: 'initial'
      };
    }

    // Analyze interaction patterns
    const recentInteractions = userHistory.slice(-10); // Last 10 interactions
    const avgEngagement = this.calculateEngagementScore(recentInteractions);
    const journeyStage = this.determineJourneyStage(recentInteractions);
    const queryPatterns = this.extractQueryPatterns(recentInteractions);

    // Detect behavioral patterns
    let pattern = 'exploratory';
    let confidence = 0.6;

    if (queryPatterns.priceQueries > queryPatterns.totalQueries * 0.5) {
      pattern = 'price_sensitive';
      confidence = 0.8;
    } else if (queryPatterns.featureQueries > queryPatterns.totalQueries * 0.4) {
      pattern = 'feature_focused';
      confidence = 0.75;
    } else if (queryPatterns.contactQueries > 0) {
      pattern = 'conversion_ready';
      confidence = 0.9;
    }

    return {
      type: 'behavioral',
      pattern,
      confidence,
      engagement: avgEngagement > 0.7 ? 'high' : avgEngagement > 0.4 ? 'medium' : 'low',
      journeyStage,
      queryPatterns
    };
  }

  /**
   * Analyze contextual intent from session data
   * @param {string} query - Current query
   * @param {Object} sessionData - Session context
   * @returns {Promise<Object>} Contextual intent analysis
   */
  async analyzeContextualIntent(query, sessionData = {}) {
    const context = {
      type: 'contextual',
      hasActiveListing: Boolean(sessionData.currentListingId),
      hasActiveDevelopment: Boolean(sessionData.currentDevelopmentId),
      sessionDuration: sessionData.sessionDuration || 0,
      pageViews: sessionData.pageViews || 0,
      previousQueries: sessionData.previousQueries || [],
      confidence: 0.7
    };

    // Analyze context relevance
    if (context.hasActiveListing) {
      context.contextType = 'listing_specific';
      context.relevance = this.calculateContextRelevance(query, 'listing', sessionData);
    } else if (context.hasActiveDevelopment) {
      context.contextType = 'development_specific';
      context.relevance = this.calculateContextRelevance(query, 'development', sessionData);
    } else {
      context.contextType = 'general';
      context.relevance = 0.5;
    }

    // Detect context shifts
    context.hasContextShift = this.detectContextShift(query, sessionData.previousQueries);

    return context;
  }

  /**
   * Combine multiple intent analyses into final result
   * @param {Object} semantic - Semantic analysis
   * @param {Object} behavioral - Behavioral analysis
   * @param {Object} contextual - Contextual analysis
   * @returns {Object} Combined intent analysis
   */
  combineIntentAnalysis(semantic, behavioral, contextual) {
    // Weighted combination based on confidence scores
    const weights = {
      semantic: 0.5,
      behavioral: 0.3,
      contextual: 0.2
    };

    // Determine primary intent with voting system
    const intentVotes = {};
    intentVotes[semantic.primaryIntent] = (intentVotes[semantic.primaryIntent] || 0) + weights.semantic;
    if (behavioral.pattern) {
      const behavioralIntent = this.mapBehavioralToIntent(behavioral.pattern);
      intentVotes[behavioralIntent] = (intentVotes[behavioralIntent] || 0) + weights.behavioral;
    }
    if (contextual.contextType) {
      const contextualIntent = this.mapContextualToIntent(contextual.contextType);
      intentVotes[contextualIntent] = (intentVotes[contextualIntent] || 0) + weights.contextual;
    }

    const primaryIntent = Object.keys(intentVotes).reduce((a, b) =>
      intentVotes[a] > intentVotes[b] ? a : b
    );

    // Calculate overall confidence
    const confidence = (
      semantic.confidence * weights.semantic +
      behavioral.confidence * weights.behavioral +
      contextual.confidence * weights.contextual
    );

    // Collect all intents and entities
    const allIntents = new Set([
      semantic.primaryIntent,
      ...semantic.subIntents,
      behavioral.pattern,
      contextual.contextType
    ].filter(Boolean));

    const allEntities = [
      ...semantic.entities,
      ...(behavioral.queryPatterns?.entities || [])
    ];

    return {
      primaryIntent,
      confidence: Math.min(confidence, 1.0),
      intents: Array.from(allIntents),
      entities: [...new Set(allEntities)],
      urgencyLevel: semantic.urgencyLevel,
      queryType: semantic.queryType,
      behavioralPattern: behavioral.pattern,
      engagementLevel: behavioral.engagement,
      journeyStage: behavioral.journeyStage,
      contextType: contextual.contextType,
      contextRelevance: contextual.relevance,
      hasContextShift: contextual.hasContextShift,
      analysis: {
        semantic,
        behavioral,
        contextual
      },
      timestamp: Date.now()
    };
  }

  // Helper methods

  generateCacheKey(query, context) {
    const contextHash = JSON.stringify({
      userHistory: context.userHistory?.slice(-3), // Last 3 interactions
      sessionData: {
        currentListingId: context.sessionData?.currentListingId,
        currentDevelopmentId: context.sessionData?.currentDevelopmentId
      }
    });
    return `${query}_${contextHash}`.substring(0, 100);
  }

  getCachedResult(key) {
    const cached = this.intentCache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.result;
    }
    if (cached) {
      this.intentCache.delete(key);
    }
    return null;
  }

  setCachedResult(key, result) {
    this.intentCache.set(key, {
      result,
      timestamp: Date.now()
    });

    // Clean up old cache entries
    if (this.intentCache.size > 100) {
      const oldestKey = Array.from(this.intentCache.keys())[0];
      this.intentCache.delete(oldestKey);
    }
  }

  createFallbackIntent(query) {
    return {
      primaryIntent: 'general_information',
      confidence: 0.3,
      intents: ['general_information'],
      entities: [],
      urgencyLevel: 'low',
      queryType: 'informational',
      behavioralPattern: 'unknown',
      engagementLevel: 'unknown',
      journeyStage: 'unknown',
      contextType: 'general',
      contextRelevance: 0.5,
      hasContextShift: false,
      analysis: null,
      timestamp: Date.now(),
      isFallback: true
    };
  }

  createFallbackSemanticIntent(query) {
    return {
      type: 'semantic',
      primaryIntent: 'general_information',
      confidence: 0.3,
      subIntents: [],
      entities: [],
      urgencyLevel: 'low',
      queryType: 'informational'
    };
  }

  calculateEngagementScore(interactions) {
    if (!interactions.length) return 0;

    let score = 0;
    interactions.forEach(interaction => {
      if (interaction.type === 'question') score += 0.2;
      if (interaction.type === 'click') score += 0.1;
      if (interaction.type === 'contact') score += 0.5;
      if (interaction.duration > 30) score += 0.1; // Time spent
    });

    return Math.min(score / interactions.length, 1.0);
  }

  determineJourneyStage(interactions) {
    const stages = ['awareness', 'consideration', 'decision', 'action'];
    const contactInteractions = interactions.filter(i => i.type === 'contact').length;

    if (contactInteractions > 0) return 'action';
    if (interactions.length > 10) return 'decision';
    if (interactions.length > 3) return 'consideration';
    return 'awareness';
  }

  extractQueryPatterns(interactions) {
    const patterns = {
      totalQueries: 0,
      priceQueries: 0,
      featureQueries: 0,
      contactQueries: 0,
      entities: []
    };

    interactions.forEach(interaction => {
      if (interaction.query) {
        patterns.totalQueries++;
        const query = interaction.query.toLowerCase();

        if (query.includes('preço') || query.includes('€') || query.includes('custo')) {
          patterns.priceQueries++;
        }
        if (query.includes('piscina') || query.includes('garagem') || query.includes('terraço')) {
          patterns.featureQueries++;
        }
        if (query.includes('contact') || query.includes('envia') || query.includes('brochura')) {
          patterns.contactQueries++;
        }
      }
    });

    return patterns;
  }

  calculateContextRelevance(query, contextType, sessionData) {
    let relevance = 0.5;

    if (contextType === 'listing') {
      // Check if query references current listing
      const listingId = sessionData.currentListingId;
      if (query.toLowerCase().includes(listingId?.toString())) {
        relevance = 0.9;
      }
    }

    return relevance;
  }

  detectContextShift(query, previousQueries = []) {
    if (previousQueries.length === 0) return false;

    const currentEntities = this.extractEntities(query);
    const previousEntities = previousQueries.slice(-3).flatMap(q => this.extractEntities(q));

    // Check for significant entity changes
    const currentSet = new Set(currentEntities);
    const previousSet = new Set(previousEntities);

    const intersection = new Set([...currentSet].filter(x => previousSet.has(x)));
    const union = new Set([...currentSet, ...previousSet]);

    const jaccardSimilarity = intersection.size / union.size;

    return jaccardSimilarity < 0.3; // Low similarity indicates context shift
  }

  extractEntities(query) {
    const entities = [];
    const lower = query.toLowerCase();

    // Extract property types
    if (lower.includes('t1')) entities.push('T1');
    if (lower.includes('t2')) entities.push('T2');
    if (lower.includes('t3')) entities.push('T3');

    // Extract features
    if (lower.includes('piscina')) entities.push('pool');
    if (lower.includes('garagem')) entities.push('garage');
    if (lower.includes('terraço')) entities.push('terrace');

    return entities;
  }

  mapBehavioralToIntent(pattern) {
    const mapping = {
      'price_sensitive': 'pricing_question',
      'feature_focused': 'feature_inquiry',
      'conversion_ready': 'booking_interest',
      'exploratory': 'property_search'
    };
    return mapping[pattern] || 'general_information';
  }

  mapContextualToIntent(contextType) {
    const mapping = {
      'listing_specific': 'property_search',
      'development_specific': 'property_search',
      'general': 'general_information'
    };
    return mapping[contextType] || 'general_information';
  }
}

export default IntentUnderstandingEngine;