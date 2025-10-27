// packages/backend/src/rag-service.js
// Core service implementing the RAG pipeline for generating contextual chatbot responses using vector search and LLM.
// To provide intelligent, context-aware responses by retrieving relevant knowledge from vector database and generating natural language answers.
// Relevant files: index.js, config/openai.js, config/pinecone.js, services/listing-service.js, services/user-service.js, utils/rag-parsing.js, utils/context.js, utils/prompt.js
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { encode } from 'gpt-3-encoder';
import * as userService from './services/user-service.js';
import listingService from './services/listing-service.js';
import * as developmentService from './services/development-service.js';
import visitorService from './services/visitor-service.js';
import { withTimeout } from './utils/async-timeout.js';
import { reRankMatches } from './utils/rerank.js';
import { buildContext, pickText, buildContextFromMatches, buildStructuredListingSummary, buildOptimizedContext } from './utils/context.js';
import { renderTemplate } from './utils/prompt.js';
import { createLogger } from './utils/structured-logger.js';
import { extractListingIdFromUrl, extractListingIdFromQuery, extractQueryFilters, isAggregativePriceQuery, QUERY_SCOPE } from './utils/rag-parsing.js';
import { removeRedundantClosingCTA } from './utils/postprocess.js';
import { generateHybridQuestions } from './utils/question-strategies.js';
import AdaptivePresentationEngine from './utils/adaptive-presentation-engine.js';
import ModelRouter from './utils/model-router.js';
import PerformanceTracker from './utils/performance-tracker.js';
import analyticsLogger from './utils/analytics-logger.js';
import PostProcessingEngine from './utils/post-processing-engine.js';
import supabase from './config/supabase.js';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// Initialize intelligent model selection components
const performanceTracker = new PerformanceTracker();
const modelRouter = new ModelRouter(performanceTracker);

// Function to get the appropriate Pinecone index based on client config
function getPineconeIndex(clientConfig) {
  // Use client-specific index if available, otherwise fall back to shared index
  const indexName = clientConfig?.pineconeIndex || 'rachatbot-1536';
  console.log(`Using Pinecone index: ${indexName} for client: ${clientConfig?.clientName || 'Unknown'}`);
  return pinecone.index(indexName);
}

const embeddingModel = "text-embedding-3-small"; // Standardize on the 1536-dimension model
const generativeModel = "gpt-3.5-turbo";
const MAX_TOTAL_TOKENS = 4096; // Max tokens for gpt-3.5-turbo
const MAX_RESPONSE_TOKENS = 1000;
const CONTEXT_TOKEN_BUDGET = MAX_TOTAL_TOKENS - MAX_RESPONSE_TOKENS; // Reserve tokens for the response
const PINECONE_TIMEOUT_MS = Number(process.env.RAG_PINECONE_TIMEOUT_MS || 2000);
const OPENAI_TIMEOUT_MS = Number(process.env.RAG_OPENAI_TIMEOUT_MS || 15000);
const TWO_QUERY_ENABLED = String(process.env.RAG_TWO_QUERY_ENABLED || 'true') === 'true';

// Intelligent Model Selection Configuration
const INTELLIGENT_MODEL_SELECTION_ENABLED = String(process.env.RAG_INTELLIGENT_MODEL_SELECTION_ENABLED || 'false') === 'true';
const DEFAULT_MODEL = process.env.RAG_DEFAULT_MODEL || 'gpt-4o-mini';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const log = createLogger('rag-service');

async function performHybridSearch(searchVector, clientConfig, externalContext = null, originalQuery = "", userContext = null, queryFilters = {}, queryScope = QUERY_SCOPE.GENERAL_UNFILTERED, visitorId = null, isOnboardingRecommendation = false) {
  // Validate search vector before proceeding
  if (!searchVector) {
    console.error(`[${clientConfig.clientName}] ❌ FATAL ERROR: Search vector is null or undefined`);
    throw new Error('Invalid search vector: vector is required for Pinecone queries');
  }
  
  if (!Array.isArray(searchVector)) {
    console.error('Search vector is not an array:', typeof searchVector);
    throw new Error('Invalid search vector: must be an array of numbers');
  }
  
  if (searchVector.length === 0) {
    console.error('Search vector is empty');
    throw new Error('Invalid search vector: vector cannot be empty');
  }
  
  if (typeof searchVector[0] !== 'number' || isNaN(searchVector[0])) {
    console.error('Search vector contains invalid values:', searchVector.slice(0, 5));
    throw new Error('Invalid search vector: must contain numeric values');
  }
  
  console.log(`[${clientConfig.clientName}] Using search vector with ${searchVector.length} dimensions`);

  // Get the client-specific Pinecone index and namespace it per client
  const clientPineconeIndex = getPineconeIndex(clientConfig);
  const namespacedIndex = clientPineconeIndex.namespace(clientConfig.clientId);
  
  // For client-specific indexes, we don't need to filter by client_id since the entire index
  // is dedicated to this client, but we'll keep it for backward compatibility
  const baseFilter = {
    client_id: clientConfig.clientId,
  };
  
  // Now that baseFilter is initialized, we can log it
  console.log(`[${clientConfig.clientName}] 🔍 DEBUG: Base filter being used: ${JSON.stringify(baseFilter)}`);
  console.log(`[${clientConfig.clientName}] 🔍 DEBUG: Client config: ${JSON.stringify({
    clientId: clientConfig.clientId,
    clientName: clientConfig.clientName,
    defaultDevelopmentId: clientConfig.defaultDevelopmentId,
    pineconeIndex: clientConfig.pineconeIndex || 'default'
  })}`);
  console.log(`[${clientConfig.clientName}] 🔍 DEBUG: External context: ${JSON.stringify(externalContext)}`);
  
  const contextListingId = externalContext?.value;
  const contextDevelopmentId = externalContext?.developmentId || (externalContext?.type === 'development' ? externalContext.value : clientConfig.defaultDevelopmentId);
  
  console.log(`[${clientConfig.clientName}] 🔍 DEBUG: Context listing ID: ${contextListingId || 'none'}`);
  console.log(`[${clientConfig.clientName}] 🔍 DEBUG: Context development ID: ${contextDevelopmentId || 'none'}`);

  if (userContext && userContext.role === 'promoter') {
    try {
      const assignedListings = await userService.getListingsByAgentId(userContext.userId);
      // Extract only the 'id' (old ID) from the assigned listings for Pinecone filtering
      const assignedListingIds = assignedListings.map(listing => listing.id);
      if (assignedListingIds.length > 0) {
        baseFilter.listing_id = { "$in": assignedListingIds };
      } else {
        return { matches: [] };
      }
    } catch (error) {
      console.error(`Error applying agent filtering for user ${userContext.userId}:`, error);
      return { matches: [] };
    }
  }

  // Two-query path: 1) Targeted (listing OR development OR query-derived listing), 2) Broad
  console.log(`[${clientConfig.clientName}] 🔎 performHybridSearch: originalQuery="${originalQuery}", queryFilters=${JSON.stringify(queryFilters)}`);
  const targetedFilter = (await (async () => {
    if (contextListingId) return { ...baseFilter, listing_id: contextListingId };

    // Try to resolve a numeric listing_id from a natural pattern like "block_2_apt_B" plus typology in query
    const derived = extractListingIdFromQuery(originalQuery);
    if (derived) {
      // If derived is already numeric, use it directly
      if (/^\d{3,}$/.test(String(derived))) {
        return { ...baseFilter, listing_id: derived };
      }
      // Map block/letter pattern to real numeric ID via DB lookup
      const blockPattern = derived.match(/^block_(\d+)_apt_([A-H])$/i);
      if (blockPattern) {
        const blockNum = blockPattern[1];
        const letter = blockPattern[2].toUpperCase();
        const tMatch = String(originalQuery || '').match(/\bT\s*([1-4])\b/i);
        const typology = tMatch ? `T${tMatch[1]}` : null;
        if (typology) {
          try {
            console.log(`[${clientConfig.clientName}] Mapping derived ${derived} + typology=${typology} to numeric listing via DB...`);
            const row = await listingService.findByTypologyLetterBlock(baseFilter.client_id, typology, letter, blockNum);
            if (row?.id) {
              console.log(`[${clientConfig.clientName}] Derived mapping resolved to listing ${row.id}`);
              return { ...baseFilter, listing_id: row.id };
            }
          } catch (_) {}
        }
      }
    }
    if (contextDevelopmentId) return { ...baseFilter, development_id: contextDevelopmentId };
    return null;
  })());
  console.log(`[${clientConfig.clientName}] 🔎 targetedFilter=${JSON.stringify(targetedFilter)}`);

  const queries = [];
  if (TWO_QUERY_ENABLED && targetedFilter) {
    const targetedParams = { vector: searchVector, topK: 10, includeMetadata: true, filter: targetedFilter };
    const { vector, ...loggable } = targetedParams;
    log.info('pinecone.targeted.query', { params: loggable });
    queries.push(withTimeout(namespacedIndex.query(targetedParams), PINECONE_TIMEOUT_MS, 'pinecone-targeted'));
  } else {
    queries.push(Promise.resolve({ matches: [] }));
  }

  // Skip broad search for LISTING_SPECIFIC queries to prevent context bleed
  let broadParams = null;
  if (queryScope !== QUERY_SCOPE.LISTING_SPECIFIC) {
    const broadTopK = Number(process.env.RAG_BROAD_TOPK || 30);
    broadParams = { vector: searchVector, topK: broadTopK, includeMetadata: true, filter: { ...baseFilter } };
    const { vector: _v, ...loggableBroad } = broadParams;
    log.info('pinecone.broad.query', { params: loggableBroad });
    queries.push(withTimeout(namespacedIndex.query(broadParams), PINECONE_TIMEOUT_MS, 'pinecone-broad'));
  } else {
    queries.push(Promise.resolve({ matches: [] }));
    console.log(`[${clientConfig.clientName}] Skipping broad search for LISTING_SPECIFIC query`);
  }

  let targetedResponse, broadResponse;
  try {
    const t = log.time('pinecone.all');
    [targetedResponse, broadResponse] = await Promise.all(queries);
    t.end({
      targetedCount: targetedResponse?.matches?.length || 0,
      broadCount: broadResponse?.matches?.length || 0,
      broadTopK: broadParams?.topK || 0,
      twoQueryEnabled: TWO_QUERY_ENABLED,
    });
  } catch (error) {
    log.error('pinecone.query.failed', { error: error.message });
    throw error;
  }

  let matches = (targetedResponse?.matches || []);
  const broadMatches = (broadResponse?.matches || []);
  console.log(`[${clientConfig.clientName}] targeted matches=${matches.length}, broad matches=${broadMatches.length}`);

  console.log(`[${clientConfig.clientName}] Search results: ${matches.length} targeted, ${broadMatches.length} broad`);

  const priceMatch = matches.find(match => match.metadata && match.metadata.price_eur !== undefined) || broadMatches.find(m => m.metadata && m.metadata.price_eur !== undefined);
  let currentListingPrice = null;
  if (priceMatch) {
    currentListingPrice = priceMatch.metadata.price_eur;
    console.log(`Current listing (${contextListingId}) price from targeted search: ${currentListingPrice}`);
  }

  const combinedMatches = [...matches];
  const existingIds = new Set(combinedMatches.map(m => m.id));

  broadMatches.forEach(bm => {
    if (!existingIds.has(bm.id)) {
      combinedMatches.push(bm);
    }
  });

  matches = combinedMatches;

  // Fallback: if no matches, try broad search without user query filters
  if (matches.length === 0) {
    try {
      console.log(`[${clientConfig.clientName}] ⚠️ No matches with filters. Trying fallback broad search without query filters...`);
      const fallback = await namespacedIndex.query({
        vector: searchVector,
        topK: 50,
        includeMetadata: true,
        filter: baseFilter,
      });
      matches = fallback?.matches || [];
      console.log(`[${clientConfig.clientName}] Fallback broad search found ${matches.length} matches`);
    } catch (e) {
      console.error(`[${clientConfig.clientName}] Fallback broad search failed:`, e);
    }
  }

  // Removed cross-namespace fallback to prevent data leakage between clients
  // All queries must use client-specific namespace for security

  let reRankedResult = { contextualMatchStatus: 'NOT_APPLICABLE' };

  if (matches.length > 0) {
    const reRankQueryFilters = await extractQueryFilters(originalQuery, currentListingPrice, clientConfig, null, {
      userHistory: [], // TODO: Pass actual user history when available
      sessionData: {
        currentListingId: contextListingId,
        currentDevelopmentId: contextDevelopmentId,
        sessionDuration: 0, // TODO: Calculate actual session duration
        pageViews: 1
      }
    });

    // Determine queryScope based on externalContext and filters
    let queryScope = QUERY_SCOPE.GENERAL_UNFILTERED;
    const hasSignificantFilters = reRankQueryFilters.generated_tags || reRankQueryFilters.num_bedrooms || reRankQueryFilters.price_eur || reRankQueryFilters.typology || reRankQueryFilters.num_bathrooms || reRankQueryFilters.total_area_sqm;
    const hasListingIdFromQuery = reRankQueryFilters.listing_id;
    const hasExternalContext = externalContext && (externalContext.value || externalContext.developmentId);

    if (hasListingIdFromQuery) {
      queryScope = QUERY_SCOPE.LISTING_SPECIFIC;
    } else if (hasSignificantFilters) {
      queryScope = QUERY_SCOPE.GENERAL_FILTERED;
    } else if (hasExternalContext) {
      queryScope = QUERY_SCOPE.LISTING_SPECIFIC;
    } else {
      queryScope = QUERY_SCOPE.GENERAL_UNFILTERED;
    }
    
    console.log(`[${clientConfig.clientName}] 🔍 DEBUG: Determined queryScope: ${queryScope} (hasExternalContext: ${hasExternalContext}, hasSignificantFilters: ${hasSignificantFilters}, hasListingIdFromQuery: ${hasListingIdFromQuery})`);

    // Dynamically adjust topN based on queryScope to ensure broader results for general queries
    const topN = queryScope === QUERY_SCOPE.GENERAL_FILTERED ? 50 : 20;

    // Get user preferences for re-ranking logic
    const userPreferencesForReRanking = visitorId ? await visitorService.getUserPreferences(visitorId, clientConfig.clientId) : null;

    // Extract intent analysis from query filters if available
    const intentAnalysis = reRankQueryFilters.intentAnalysis;

    reRankedResult = reRankMatches({
      matches,
      contextListingId,
      contextDevelopmentId,
      originalQuery,
      queryFilters: reRankQueryFilters,
      queryScope,
      topN,
      targetedMatches: targetedResponse?.matches || [],
      userPreferences: userPreferencesForReRanking,
      isOnboardingRecommendation,
      clientConfig,
      intentAnalysis,
    });
    matches = reRankedResult.rankedMatches;
  }

  return {
    matches,
    contextualMatchStatus: reRankedResult.contextualMatchStatus
  };
}

// parsing helpers now imported from ./utils/rag-parsing.js

/**
 * Builds terminology guidance for Portuguese localization
 * @param {Object} terminologyConfig - Client terminology configuration
 * @returns {string} Formatted guidance text for system prompt
 */
function buildTerminologyGuidance(terminologyConfig) {
  if (!terminologyConfig.enabled || !terminologyConfig.termMappings || terminologyConfig.termMappings.length === 0) {
    return '';
  }

  const dialect = terminologyConfig.primaryDialect === 'european' ? 'EUROPEU' : 'BRASILEIRO';
  let guidance = `\n\nINSTRUÇÕES DE LOCALIZAÇÃO - PORTUGUÊS ${dialect}:`;

  // Add critical terms guidance
  const criticalTerms = terminologyConfig.termMappings.filter(mapping =>
    mapping.sourceTerm && mapping.targetTerm
  );

  if (criticalTerms.length > 0) {
    guidance += `\nTermos críticos a utilizar:`;
    criticalTerms.forEach(mapping => {
      guidance += `\n- Sempre usar "${mapping.targetTerm}" em vez de "${mapping.sourceTerm}"`;
    });

    guidance += `\n\nExemplos de uso correto:`;
    criticalTerms.slice(0, 3).forEach(mapping => { // Limit to first 3 examples
      guidance += `\n- ❌ "${mapping.sourceTerm}" → ✅ "${mapping.targetTerm}"`;
    });
  }

  // Add context rules if available
  if (terminologyConfig.customRules && terminologyConfig.customRules.length > 0) {
    guidance += `\n\nRegras contextuais:`;
    terminologyConfig.customRules.forEach(rule => {
      if (rule.description) {
        guidance += `\n- ${rule.description}`;
      }
    });
  }

  return guidance;
}

/**
 * Determines the type of query for context-aware question generation
 * @param {string} query - User query
 * @returns {string|null} Query type or null
 */
function determineQueryType(query) {
  const lowerQuery = query.toLowerCase();

  if (lowerQuery.includes('preço') || lowerQuery.includes('custo') ||
      lowerQuery.includes('valor') || lowerQuery.includes('€')) {
    return 'PRICE';
  }

  if (lowerQuery.includes('localização') || lowerQuery.includes('zona') ||
      lowerQuery.includes('área') || lowerQuery.includes('bairro')) {
    return 'LOCATION';
  }

  if (lowerQuery.includes('comodidade') || lowerQuery.includes('característica') ||
      lowerQuery.includes('piscina') || lowerQuery.includes('garagem') ||
      lowerQuery.includes('terraço')) {
    return 'AMENITIES';
  }

  return null;
}

function extractFeatureFromQuery(query) {
   const lower = query.toLowerCase();
   let feature = query;

   // Remove common question prefixes
   const prefixes = [
     'quais os ',
     'quero saber todos os ',
     'quero saber os ',
     'todos os ',
     'alguns ',
     'quais são os ',
     'quais ',
     'qual o '
   ];

   for (const prefix of prefixes) {
     if (lower.startsWith(prefix)) {
       feature = query.slice(prefix.length);
       break;
     }
   }

   return feature.trim() || 'imóveis';
 }

/**
 * Maps buying timeframe to appropriate current_state values for availability filtering
 */
const TIMEFRAME_AVAILABILITY_MAP = {
  'asap': ['finished'],                    // Only completed properties
  '1-3 months': ['finished', 'building'], // Completed or near completion
  '3-6 months': ['finished', 'building'], // Allow building phase
  '6+ months': ['finished', 'building', 'project'] // Include projects
};

/**
 * Converts onboarding answers into query filters for RAG search
 * @param {Object} onboardingAnswers - User's onboarding responses
 * @returns {Object} Query filters compatible with extractQueryFilters
 */
function convertOnboardingToFilters(onboardingAnswers) {
   const filters = {};

   if (!onboardingAnswers || typeof onboardingAnswers !== 'object') {
     return filters;
   }

   // Convert typology preference
   if (onboardingAnswers.typology && onboardingAnswers.typology !== 'Indiferente') {
     filters.typology = onboardingAnswers.typology;
   }

   // Convert budget range to price filter
   if (onboardingAnswers.budget_bucket && onboardingAnswers.budget_bucket !== 'Prefer not to say') {
     const priceRange = parseBudgetRange(onboardingAnswers.budget_bucket);
     if (priceRange.min !== null && priceRange.max !== null) {
       filters.price_eur = { gte: priceRange.min, lte: priceRange.max };
     }
   }

   // Convert buying timeframe to availability filtering
   if (onboardingAnswers.buying_timeframe) {
     const allowedStates = TIMEFRAME_AVAILABILITY_MAP[onboardingAnswers.buying_timeframe.toLowerCase()];
     if (allowedStates) {
       filters.current_state = { $in: allowedStates };
       console.log(`[convertOnboardingToFilters] Timeframe "${onboardingAnswers.buying_timeframe}" mapped to current_state filter: ${allowedStates.join(', ')}`);
     }
     // Keep timeframe for lead scoring
     filters.buying_timeframe = onboardingAnswers.buying_timeframe;
   }

   return filters;
 }

/**
 * Parses budget bucket string into min/max price range
 * @param {string} budgetBucket - Budget range string (e.g., "€200–300k")
 * @returns {Object} Object with min and max price values
 */
function parseBudgetRange(budgetBucket) {
   if (!budgetBucket || typeof budgetBucket !== 'string') {
     return { min: null, max: null };
   }

   // Handle different budget formats
   const lowerBucket = budgetBucket.toLowerCase().trim();

   if (lowerBucket.includes('€100–200k') || lowerBucket.includes('100-200k')) {
     return { min: 100000, max: 200000 };
   } else if (lowerBucket.includes('€200–300k') || lowerBucket.includes('200-300k')) {
     return { min: 200000, max: 300000 };
   } else if (lowerBucket.includes('€300–400k') || lowerBucket.includes('300-400k')) {
     return { min: 300000, max: 400000 };
   } else if (lowerBucket.includes('€400–500k') || lowerBucket.includes('400-500k')) {
     return { min: 400000, max: 500000 };
   } else if (lowerBucket.includes('€500k+') || lowerBucket.includes('500k+')) {
     return { min: 500000, max: null };
   }

   // Try to parse generic patterns like "€100k-€200k"
   const rangeMatch = budgetBucket.match(/€?(\d+)k?\s*[-–]\s*€?(\d+)k?/i);
   if (rangeMatch) {
     const min = parseInt(rangeMatch[1], 10) * 1000;
     const max = parseInt(rangeMatch[2], 10) * 1000;
     return { min, max };
   }

   return { min: null, max: null };
 }

/**
 * Transforms onboarding answers into a natural language query for recommendations
 * @param {Object} onboardingAnswers - User's onboarding responses
 * @returns {string} Natural language query for RAG
 */
function transformOnboardingToQuery(onboardingAnswers) {
   if (!onboardingAnswers || typeof onboardingAnswers !== 'object') {
     return "Mostre-me recomendações de apartamentos";
   }

   let queryParts = ["Mostre-me recomendações de"];

   // Add typology
   if (onboardingAnswers.typology && onboardingAnswers.typology !== 'Indiferente') {
     queryParts.push(onboardingAnswers.typology.toLowerCase());
   } else {
     queryParts.push("apartamentos");
   }

   // Add budget information
   if (onboardingAnswers.budget_bucket && onboardingAnswers.budget_bucket !== 'Prefer not to say') {
     queryParts.push(`na faixa de preço ${onboardingAnswers.budget_bucket}`);
   }

   // Removed: timeframe textual appendage (causing LLM misinterpretation as rental duration)
   // Timeframe now used for structured availability filtering instead

   return queryParts.join(" ");
 }

/**
 * Enriches user context with behavioral data for personalized question generation
 * @param {string} visitorId - Unique visitor identifier
 * @param {string} clientId - Client UUID
 * @returns {Promise<Object>} User context object
 */
async function enrichUserContext(visitorId, clientId) {
  console.log(`[enrichUserContext] Called with visitorId: ${visitorId}, clientId: ${clientId}`);

  if (!visitorId) {
    return {
      leadScore: 0,
      preferences: {},
      recentEvents: [],
      hasHistory: false
    };
  }

  try {
    // Single optimized query with join - ~20ms
    const { data, error } = await supabase
      .from('visitors')
      .select(`
        lead_score,
        previous_lead_score,
        tipologia,
        budget,
        development_preference,
        name,
        email,
        phone,
        events(
          event_type,
          timestamp,
          listing_id
        )
      `)
      .eq('visitor_id', visitorId)
      .eq('client_id', clientId)
      .order('events.timestamp', { ascending: false })
      .limit(5) // Only recent events
      .single();

    if (error || !data) {
      console.warn(`[enrichUserContext] No data found for visitor ${visitorId}`);
      return {
        leadScore: 0,
        preferences: {},
        recentEvents: [],
        hasHistory: false
      };
    }

    // Calculate engagement trend
    const scoreTrend = data.lead_score - (data.previous_lead_score || 0);
    const engagementLevel = data.lead_score >= 70 ? 'high' :
                           data.lead_score >= 40 ? 'medium' : 'low';

    return {
      leadScore: data.lead_score || 0,
      scoreTrend,
      engagementLevel,
      preferences: {
        tipologia: data.tipologia,
        budget: data.budget,
        development: data.development_preference
      },
      recentEvents: (data.events || []).map(e => ({
        type: e.event_type,
        listingId: e.listing_id,
        timestamp: e.timestamp
      })),
      hasContact: Boolean(data.email || data.phone),
      hasHistory: true
    };
  } catch (error) {
    console.error('[enrichUserContext] Error:', error);
    return {
      leadScore: 0,
      preferences: {},
      recentEvents: [],
      hasHistory: false
    };
  }
}

async function generateResponse(query, clientConfig, queryEmbeddingVector, externalContext = null, userContext = null, chatHistory = null, pageUrl = null, contextShifted = false, visitorId = null, onboardingContext = null, chatMessageId = null) {
    // Normalize externalContext format for backward compatibility
    if (externalContext?.listingId && !externalContext.type) {
      externalContext = {
        type: 'listing',
        value: externalContext.listingId,
        developmentId: externalContext.developmentId
      };
    }

    // INTELLIGENT MODEL SELECTION: Analyze query and select optimal model
    let selectedModel = DEFAULT_MODEL;
    let modelSelection = null;
    let queryComplexityScore = null;
    let selectionConfidence = null;
    let estimatedCost = null;
    let modelReasoning = null;
    let startTime = Date.now();

    if (INTELLIGENT_MODEL_SELECTION_ENABLED) {
      try {
        // Prepare context for model selection
        const modelSelectionContext = {
          matches: [], // Will be populated after search
          externalContext,
          queryFilters: null, // Will be populated after filtering
        };

        // Select model based on query complexity
        modelSelection = await modelRouter.selectModel(query, modelSelectionContext);
        selectedModel = modelSelection.selectedModel;
        queryComplexityScore = modelSelection.complexityScore;
        selectionConfidence = modelSelection.confidence;
        estimatedCost = modelSelection.estimatedCost;
        modelReasoning = modelSelection.reasoning;

        console.log(`[${clientConfig.clientName}] 🎯 INTELLIGENT MODEL SELECTION: ${selectedModel} (confidence: ${(selectionConfidence * 100).toFixed(1)}%, cost: $${estimatedCost.toFixed(6)})`);
        console.log(`[${clientConfig.clientName}] 📋 Reasoning: ${modelReasoning}`);

        // LOG MODEL SELECTION ANALYTICS: Capture initial model selection data
        if (chatMessageId) {
          analyticsLogger.logModelSelection({
            chatMessageId,
            clientId: clientConfig.clientId,
            modelSelected: selectedModel,
            queryComplexityScore,
            selectionConfidence,
            estimatedCost,
            modelReasoning,
            fallbackUsed: false
          }).catch(error => {
            console.error(`[${clientConfig.clientName}] ❌ Failed to log model selection analytics:`, error.message);
          });
        }

      } catch (error) {
        console.error(`[${clientConfig.clientName}] ❌ Model selection failed, using default:`, error.message);
        selectedModel = DEFAULT_MODEL;

        // LOG FALLBACK ANALYTICS: When model selection fails
        if (chatMessageId) {
          analyticsLogger.logModelSelection({
            chatMessageId,
            clientId: clientConfig.clientId,
            modelSelected: selectedModel,
            queryComplexityScore: null,
            selectionConfidence: null,
            estimatedCost: null,
            modelReasoning: `Fallback to default model due to error: ${error.message}`,
            fallbackUsed: true
          }).catch(error => {
            console.error(`[${clientConfig.clientName}] ❌ Failed to log fallback analytics:`, error.message);
          });
        }
      }
    } else {
      console.log(`[${clientConfig.clientName}] 🔄 Using default model: ${selectedModel}`);

      // LOG DEFAULT MODEL ANALYTICS: When intelligent selection is disabled
      if (chatMessageId) {
        analyticsLogger.logModelSelection({
          chatMessageId,
          clientId: clientConfig.clientId,
          modelSelected: selectedModel,
          queryComplexityScore: null,
          selectionConfidence: null,
          estimatedCost: null,
          modelReasoning: 'Intelligent model selection disabled, using default model',
          fallbackUsed: false
        }).catch(error => {
          console.error(`[${clientConfig.clientName}] ❌ Failed to log default model analytics:`, error.message);
        });
      }
    }

    // Handle onboarding context - transform onboarding answers into personalized recommendations
    let isOnboardingRecommendation = false;
    if (onboardingContext && typeof onboardingContext === 'object') {
      console.log(`[${clientConfig.clientName}] 🎯 Detected onboarding context, transforming to personalized recommendations`);
      isOnboardingRecommendation = true;

      // Transform onboarding answers into query filters
      const onboardingFilters = convertOnboardingToFilters(onboardingContext);
      console.log(`[${clientConfig.clientName}] Onboarding filters:`, JSON.stringify(onboardingFilters, null, 2));

      // Override query with onboarding-specific query
      query = transformOnboardingToQuery(onboardingContext);
      console.log(`[${clientConfig.clientName}] Transformed query: "${query}"`);
    }

    let aggregativeContext = '';

   let isNoMatches = false;
   // 1. Determine context IDs
   const listingIdFromUrl = extractListingIdFromUrl(pageUrl);
   const targetedListingId = externalContext?.value;
   const preferredListingId = targetedListingId || listingIdFromUrl || null;
   const contextDevelopmentId = externalContext?.developmentId || (externalContext?.type === 'development' ? externalContext.value : clientConfig.defaultDevelopmentId);

   if (isAggregativePriceQuery(query)) {
     try {
       const qLower = query.toLowerCase();
       if (qLower.includes('mais barato') || qLower.includes('preço mínimo')) {
         // Try precise SQL first (typology-aware)
         const tMatch = qLower.match(/\b(t\d)\b/i);
         const typology = tMatch ? tMatch[1].toUpperCase() : null;
         const devId = clientConfig.defaultDevelopmentId || null;
         const cheapest = await listingService.getCheapestListingsByTypology(clientConfig.clientId, typology, devId, 2);
         if (cheapest && cheapest.length > 0) {
           const [first, second] = cheapest;
           const firstLine = `O ${typology || ''} mais barato é ${first.name || first.id} por €${Number(first.price).toLocaleString('pt-PT')}.`.trim();
           const secondLine = second ? ` O segundo mais barato é ${second.name || second.id} por €${Number(second.price).toLocaleString('pt-PT')}.` : '';
           aggregativeContext = `${firstLine}${secondLine}`;
         } else {
           const minPrice = await listingService.getMinPrice(clientConfig.clientId);
           aggregativeContext = minPrice !== null ? `A propriedade com o preço mais baixo disponível é de ${minPrice}€.` : `Não foi possível encontrar o preço mínimo nos documentos fornecidos.`;
         }
       } else if (qLower.includes('mais caro') || qLower.includes('preço máximo')) {
         const maxPrice = await listingService.getMaxPrice(clientConfig.clientId);
         aggregativeContext = maxPrice !== null ? `A propriedade com o preço mais alto disponível é de ${maxPrice}€.` : `Não foi possível encontrar o preço máximo nos documentos fornecidos.`;
       }
       console.log(`Aggregative Price Context: ${aggregativeContext}`);
     } catch (error) {
       console.error('Error fetching aggregative price:', error);
       aggregativeContext = `Ocorreu um erro ao tentar obter informações de preço.`;
     }
   }

   // Extract query filters - use onboarding filters if available, otherwise extract from query
   let queryFilters;
   if (isOnboardingRecommendation) {
     queryFilters = convertOnboardingToFilters(onboardingContext);
   } else {
     // Get user preferences for persistent context enrichment
     const userPreferences = visitorId ? await visitorService.getUserPreferences(visitorId, clientConfig.clientId) : null;
     queryFilters = extractQueryFilters(query, null, clientConfig, userPreferences);
   }

   // Extract queried feature for potential no-matches handling
   let queriedFeature = null;
   if (queryFilters.generated_tags && queryFilters.generated_tags.$all && queryFilters.generated_tags.$all.length > 0) {
     const tag = queryFilters.generated_tags.$all[0];
     if (tag.startsWith('comodidade:')) {
       queriedFeature = tag.replace('comodidade:', '');
     }
   }

   // Determine queryScope for system prompt instructions (moved before performHybridSearch)
   let queryScope = QUERY_SCOPE.GENERAL_UNFILTERED;
   const hasSignificantFilters = queryFilters.generated_tags || queryFilters.num_bedrooms || queryFilters.price_eur || queryFilters.typology || queryFilters.num_bathrooms || queryFilters.total_area_sqm;
   const hasListingIdFromQuery = queryFilters.listing_id;
   const hasExternalContext = externalContext && (externalContext.value || externalContext.developmentId);

   if (hasListingIdFromQuery) {
     queryScope = QUERY_SCOPE.LISTING_SPECIFIC;
   } else if (hasSignificantFilters) {
     queryScope = QUERY_SCOPE.GENERAL_FILTERED;
   } else if (hasExternalContext) {
     queryScope = QUERY_SCOPE.LISTING_SPECIFIC;
   } else {
     queryScope = QUERY_SCOPE.GENERAL_UNFILTERED;
   }

   // Detect if this is a broad overview query (wants comprehensive view of multiple listings)
   // Even with external context, broad typology queries should show overview
   const queryLower = String(query || '').toLowerCase();
   const hasTypologyFilter = queryFilters.typology;
   const hasBroadIntentWords = /\b(todos|todas|all|every|disponíveis?|available|list|show)\b/i.test(queryLower);
   const lacksSpecificReference = !/\b(este|esta|this|esse|essa|that)\b/i.test(queryLower);

   const isBroadOverview = hasTypologyFilter && (hasBroadIntentWords || (hasSignificantFilters && lacksSpecificReference));

   console.log(`[${clientConfig.clientName}] 🔍 DEBUG: Determined queryScope: ${queryScope}, isBroadOverview: ${isBroadOverview} (hasTypologyFilter: ${hasTypologyFilter}, hasBroadIntentWords: ${hasBroadIntentWords}, lacksSpecificReference: ${lacksSpecificReference})`);

   // Detect lead-collecting intent
   const lowerQuery = String(query || '').toLowerCase();
   const leadCollectingIntent = lowerQuery.includes('sim') || lowerQuery.includes('envia') || lowerQuery.includes('brochura') || lowerQuery.includes('envia-me') || lowerQuery.includes('manda') || lowerQuery.includes('receber');

   // Fetch visitor contact information if lead-collecting intent is detected
   let visitorContactInfo = { hasEmail: false, hasPhone: false };
   if (leadCollectingIntent && visitorId) {
     try {
       const visitor = await visitorService.getVisitor(visitorId);
       if (visitor) {
         visitorContactInfo.hasEmail = Boolean(visitor.email);
         visitorContactInfo.hasPhone = Boolean(visitor.phone);
         console.log(`[${clientConfig.clientName}] Visitor contact info: email=${visitorContactInfo.hasEmail}, phone=${visitorContactInfo.hasPhone}`);
       }
     } catch (error) {
       console.error(`[${clientConfig.clientName}] Error fetching visitor contact info:`, error);
     }
   }

   // Concise filter summary
   console.log(`[${clientConfig.clientName}] Filters: ${Object.keys(queryFilters).length} applied, lead intent: ${leadCollectingIntent}`);

   let queryResponse = { matches: [], contextualMatchStatus: 'NOT_APPLICABLE' };
   try {
     queryResponse = await performHybridSearch(queryEmbeddingVector, clientConfig, externalContext, query, userContext, queryFilters, queryScope, visitorId, isOnboardingRecommendation);
   } catch (error) {
     console.error(`[${clientConfig.clientName}] Error in performHybridSearch:`, error);
     // Return empty matches if search fails due to invalid embedding
     queryResponse = { matches: [], contextualMatchStatus: 'NOT_APPLICABLE' };
   }

   const structuredListingSummary = queryScope === QUERY_SCOPE.GENERAL_FILTERED
     ? buildStructuredListingSummary(queryResponse.matches, queryFilters, isOnboardingRecommendation)
     : null;
   
   // Concise match summary
   if (queryResponse.matches.length === 0) {
     console.log(`[${clientConfig.clientName}] ⚠️ No matches found for query: "${query}"`);
   } else {
     console.log(`[${clientConfig.clientName}] Found ${queryResponse.matches.length} matches (top score: ${queryResponse.matches[0].score.toFixed(3)})`);
   }
   
   // Check if we have no matches and handle accordingly
   if (queryResponse.matches.length === 0) {
     console.log(`[${clientConfig.clientName}] ⚠️ No matches found in Pinecone. The chatbot may generate generic responses or hallucinate listings.`);
   }
   
   // Initialize Adaptive Presentation Engine
   const presentationEngine = new AdaptivePresentationEngine(clientConfig);

   // Analyze intent for presentation strategy selection
   const intentAnalysis = {
     primaryIntent: queryFilters.intentAnalysis?.intent || 'general_information',
     intents: queryFilters.intentAnalysis?.intents || [],
     urgencyLevel: queryFilters.intentAnalysis?.urgencyLevel || 'medium',
     entities: queryFilters.intentAnalysis?.entities || []
   };

   // NEW: Enrich user context for personalized questions
   const enrichedUserContext = await enrichUserContext(visitorId, clientConfig.clientId);

   // Prepare user context for presentation engine
   const userContextForPresentation = {
     engagementLevel: enrichedUserContext.engagementLevel,
     leadScore: enrichedUserContext.leadScore,
     hasHistory: enrichedUserContext.hasHistory,
     preferences: enrichedUserContext.preferences
   };

   // Prepare session data
   const sessionData = {
     currentListingId: externalContext?.value,
     currentDevelopmentId: externalContext?.developmentId,
     sessionDuration: 0, // TODO: Calculate actual session duration
     pageViews: 1
   };

   // Use advanced context optimization for better token efficiency
   const queryAnalysis = {
     query: query,
     intent: queryFilters.intentAnalysis?.intent,
     availableChunks: queryResponse.matches.length,
     filters: queryFilters
   };

   const userContextForOptimization = {
     leadScore: enrichedUserContext.leadScore,
     isNewUser: enrichedUserContext.leadScore < 10,
     conversationTurns: chatHistory ? chatHistory.split('\n').filter(line => line.startsWith('Utilizador:')).length : 0,
     conversationComplexity: enrichedUserContext.engagementLevel === 'high' ? 'high' : 'low'
   };

   // Determine token budget based on query complexity and system constraints
   const tokenBudget = Math.min(CONTEXT_TOKEN_BUDGET, 2000); // Conservative budget for optimization

   const optimizedContextResult = await buildOptimizedContext({
     pageContext: '',
     matches: queryResponse.matches,
     queryAnalysis,
     userContext: userContextForOptimization,
     tokenBudget,
     enableOptimization: true
   });

   let context = optimizedContextResult.context;

   // Apply adaptive presentation strategy to context chunks
   const prioritizedChunks = queryResponse.matches.map(match => ({
     id: match.id,
     score: match.score,
     text: pickText(match.metadata),
     metadata: match.metadata
   }));

   const presentationResult = await presentationEngine.presentContext(
     prioritizedChunks,
     intentAnalysis,
     userContextForPresentation,
     sessionData
   );

   // Log presentation strategy selection
   console.log(`[${clientConfig.clientName}] 🎨 Selected Presentation Strategy: ${presentationResult.strategy}`);

   // Use formatted context from presentation engine
   context = presentationResult.formattedContext;

   // Log optimization metrics
   if (optimizedContextResult.optimizationApplied) {
     console.log(`[${clientConfig.clientName}] 🎯 Context Optimization Applied:`);
     console.log(`[${clientConfig.clientName}]   Token Savings: ${optimizedContextResult.tokenSavings} (${optimizedContextResult.compressionRatio.toFixed(2)}x ratio)`);
     console.log(`[${clientConfig.clientName}]   Information Preserved: ${(optimizedContextResult.informationPreserved * 100).toFixed(1)}%`);
     console.log(`[${clientConfig.clientName}]   Hierarchy Chunks: ${optimizedContextResult.hierarchyStats.totalChunks}`);
     if (optimizedContextResult.deduplicationStats) {
       console.log(`[${clientConfig.clientName}]   Deduplication: ${optimizedContextResult.deduplicationStats.duplicatesRemoved} removed`);
     }
   }

   // Fallback to original method if optimization fails
   if (!optimizedContextResult.optimizationApplied) {
     console.log(`[${clientConfig.clientName}] ⚠️ Context optimization failed, using fallback method`);
     context = buildContextFromMatches(queryResponse.matches, preferredListingId, contextDevelopmentId, isBroadOverview);
   }

   // Add structured listing summary to context if available
   if (structuredListingSummary) {
     context += '\n\n' + structuredListingSummary;
   }

   try {
     const citations = queryResponse.matches.slice(0, 5).map(m => {
       const meta = m.metadata || {};
       return {
         id: meta.listing_id || meta.development_id || m.id,
         url_pt: meta.url_pt || null,
         url_en: meta.url_en || null,
       };
     });
     log.info('context.citations', { count: citations.length, citations });

     // Surface URLs explicitly to help the model include the correct link
     const lines = citations
       .map(c => {
         const url = c.url_pt || c.url_en;
         return url ? `- ${c.id}: ${url}` : null;
       })
       .filter(Boolean);
     if (lines.length) {
       context += `\n\nLinks úteis (usar o que corresponder ao imóvel referido):\n${lines.join('\n')}\n`;
     }
   } catch (_) {}
   
   // If we have a targeted listing but no matches/citations, synthesize URLs and return a deterministic answer
   // Only if user intent suggests asking for a link/URL or the query references a specific listing/typology
   const qLower = String(query || '').toLowerCase();
   const linkIntent = /(url|link|mostra|mostrar|mostra-me|ver|abre|abrir|aceder|acessar|envia o link|manda o link)/i.test(qLower);
   const hasSpecificRef = queryFilters && Object.keys(queryFilters).length > 0;
   const lastAssistantLine = (typeof chatHistory === 'string') ? (chatHistory.split('\n').reverse().find(l => l.startsWith('Assistente: ')) || '') : '';
   const lastAssistantMsg = lastAssistantLine.replace('Assistente: ', '');
   const onboardingPromptDetected = /perguntas rápidas|recomendar os melhores apartamentos/i.test(lastAssistantMsg || '');
   if (queryResponse.matches.length === 0 && targetedListingId && (linkIntent || hasSpecificRef) && !onboardingPromptDetected && queryScope !== QUERY_SCOPE.GENERAL_FILTERED) {
     const id = String(targetedListingId);
     const base = 'https://upinvestments.pt';
     const urlPt = `${base}/pt/imoveis/aveiro/${id}`;
     const urlEn = `${base}/en/real-estate/aveiro/${id}`;
     console.log(`[${clientConfig.clientName}] Returning deterministic URL response for listing ${id}`);
     return {
       response: `Aqui está o URL do imóvel: ${urlPt}\n(English) ${urlEn}`,
       suggestedQuestions: [],
       debug: { openaiPayload: [] },
       isUnanswered: true
     };
   }
   try {
     const texts = queryResponse.matches.map(m => pickText(m.metadata)).filter(Boolean);
     const topMatchSummaries = queryResponse.matches.slice(0, 5).map(m => ({
       id: m.metadata?.listing_id || m.metadata?.development_id || m.id,
       typology: m.metadata?.typology || m.metadata?.type || null,
       category: m.metadata?.document_category,
       hasText: Boolean(pickText(m.metadata)),
     }));
     console.log(`[${clientConfig.clientName}] Context assembled: ${texts.length} text chunks`);
   } catch (_) {}
   let remainingTokens = CONTEXT_TOKEN_BUDGET;
   
   // Handle empty search results with enhanced no-matches scenario
   if (queryResponse.matches.length === 0) {
     console.log(`[${clientConfig.clientName}] ⚠️ No matches found - implementing no-matches scenario`);

     // For feature queries with no matches, provide direct clear answer
     if (queriedFeature) {
       console.log(`[${clientConfig.clientName}] Providing direct answer for missing feature`);
       const response = externalContext?.type === 'listing'
         ? `Este imóvel não tem ${queriedFeature}.`
         : `Não temos imóveis com ${queriedFeature} disponíveis no momento.`;

       return {
         response,
         suggestedQuestions: [`Estou interessado em imóveis com ${queriedFeature}`, "Quais outras características são importantes para si?"],
         debug: { openaiPayload: [] },
         isUnanswered: false
       };
     }

     isNoMatches = true;

     // Check if visitor has contact information
     let hasContactInfo = false;
     if (visitorId) {
       try {
         const { data: visitor, error } = await supabase
           .from('visitors')
           .select('email, phone')
           .eq('visitor_id', visitorId)
           .eq('client_id', clientConfig.clientId)
           .single();

         if (!error && visitor && (visitor.email || visitor.phone)) {
           hasContactInfo = true;
           console.log(`[${clientConfig.clientName}] Visitor ${visitorId} has contact info - will mark as unanswered`);
         } else {
           console.log(`[${clientConfig.clientName}] Visitor ${visitorId} has no contact info - will ask for contact details`);
         }
       } catch (error) {
         console.error(`[${clientConfig.clientName}] Error checking visitor contact info:`, error);
       }
     }

     // Use configurable fallback responses from client config
     const fallbackWithContact = clientConfig.prompts?.fallbackResponseWithContact ||
       "Desculpe, não encontrei informações específicas na nossa base de dados que respondam completamente à sua pergunta. Os nossos especialistas irão analisar a sua questão e entrarão em contacto consigo em breve para fornecer uma resposta personalizada.";
   
     const fallbackWithoutContact = clientConfig.prompts?.fallbackResponseWithoutContact ||
       "Desculpe, não encontrei informações específicas na nossa base de dados que respondam à sua pergunta. Para que possamos ajudá-lo melhor, poderia fornecer o seu email ou número de telefone? Entraremos em contacto consigo com uma resposta personalizada.";
   
     if (hasContactInfo) {
       context = fallbackWithContact;
     } else {
       context = fallbackWithoutContact;
     }
     console.log(`[${clientConfig.clientName}] 📝 Using configurable no-matches response with ${hasContactInfo ? 'contact follow-up' : 'contact request'}`);

     // Mark question as unanswered (will be done in index.js after response)
     console.log(`[${clientConfig.clientName}] Question will be marked as unanswered`);
   }
   
   // Add client filter reminder to prevent incorrect listings
   context += "\n\nIMPORTANTE: Apenas mencione e recomende propriedades que pertencem ao cliente atual (" + clientConfig.clientName + "). NÃO RECOMENDE propriedades ou listagens que não pertencem a este cliente. Se não houver propriedades disponíveis que correspondam aos critérios, informe o utilizador de forma clara.";
   
   const contextTokens = encode(context).length;
   if (contextTokens > remainingTokens) {
     const overBy = contextTokens - remainingTokens;
     // naive truncate by characters proportionally
     const ratio = (context.length - Math.ceil(overBy * 3)) / context.length; // approx 3 chars per token
     const cut = Math.max(0, Math.floor(context.length * Math.max(0.5, Math.min(1, ratio))));
     context = context.slice(0, cut);
   }
   remainingTokens = Math.max(0, CONTEXT_TOKEN_BUDGET - encode(context).length);
   
   // Truncate chat history
   let truncatedChatHistory = '';
   const chatMessagesArray = [];
 
   // If no specific listing or development context is provided, discard chat history
   // This prevents "context bleeding" from previous listing-specific conversations
   const hasSpecificContext = externalContext && (externalContext.value || externalContext.developmentId);
   if (!hasSpecificContext) {
     console.log(`[${clientConfig.clientName}] ⚠️ No specific context (listing/development) provided. Discarding chat history to prevent context bleeding.`);
     truncatedChatHistory = "Nenhum histórico anterior disponível";
   } else if (chatHistory && chatHistory !== "Nenhum histórico anterior disponível") {
     // The chatHistory string is now pre-filtered in index.js if a context shift occurred.
     // So, we just need to truncate and format it for the prompt.
     const chatHistoryString = typeof chatHistory === 'string' ? chatHistory : JSON.stringify(chatHistory);
     const historyLines = chatHistoryString.split('\n').reverse(); // Process from newest to oldest
     const tempHistory = [];
     for (const line of historyLines) {
       const lineTokens = encode(line).length;
       if (remainingTokens - lineTokens > 0) {
         tempHistory.unshift(line); // Add to the beginning to maintain order
         remainingTokens -= lineTokens;
       } else {
         break;
       }
     }
     truncatedChatHistory = tempHistory.join('\n');
 
     for (const line of tempHistory) {
       if (line.startsWith('Utilizador: ')) {
         chatMessagesArray.push({ role: 'user', content: line.replace('Utilizador: ', '') });
       } else if (line.startsWith('Assistente: ')) {
         chatMessagesArray.push({ role: 'assistant', content: line.replace('Assistente: ', '') });
       }
     }
   } else {
       truncatedChatHistory = "Nenhum histórico anterior disponível";
   }
 
   // NEW: Build context-aware question generation instructions
   let questionGenerationContext = '';

   if (enrichedUserContext.hasHistory && enrichedUserContext.leadScore > 0) {
     // Only inject context when meaningful data exists
     const contextParts = [];
     if (enrichedUserContext.engagementLevel) {
       contextParts.push(`Engagement: ${enrichedUserContext.engagementLevel} (${enrichedUserContext.leadScore}/100)`);
     }
     if (enrichedUserContext.preferences?.tipologia) {
       contextParts.push(`Preferência: ${enrichedUserContext.preferences.tipologia}`);
     }
     if (enrichedUserContext.preferences?.budget) {
       contextParts.push(`Orçamento: €${enrichedUserContext.preferences.budget.toLocaleString('pt-PT')}`);
     }

     if (contextParts.length > 0) {
       questionGenerationContext = `\nCONTEXTO UTILIZADOR: ${contextParts.join(', ')}`;
     }
   }
 
   const systemPromptTemplate = clientConfig.prompts.systemInstruction;
   if (!systemPromptTemplate) {
       throw new Error("System prompt is not defined in the client configuration.");
   }
 
   const templateVariables = {
     chatHistory: truncatedChatHistory,
     context: context +
       (aggregativeContext && queryScope !== QUERY_SCOPE.LISTING_SPECIFIC ? `\n\nInformação Adicional:\n${aggregativeContext}` : ''),
     question: query,
     pageUrl: pageUrl || 'Não disponível',
     queryFilters: queryFilters,
     visitorContactInfo: visitorContactInfo
   };
   let systemPrompt = renderTemplate(systemPromptTemplate, templateVariables);
 
 
   // Add special instruction for GENERAL_FILTERED queries with no matches to prevent hallucination
   if (queryScope === QUERY_SCOPE.GENERAL_FILTERED && queryResponse.matches.length === 0 && queriedFeature) {
     systemPrompt += `\n\nINSTRUÇÃO CRÍTICA: Não há imóveis com ${queriedFeature} na nossa base de dados. Responda dizendo "Desculpe, não encontramos imóveis com ${queriedFeature} no momento."`;
   }
 
   // Add guidance for multi-listing responses to improve readability
   if (queryResponse.matches.length > 1 && !isAggregativePriceQuery(query)) {
     console.log(`[${clientConfig.clientName}] 🎨 Applying multi-listing formatting instruction (queryScope: ${queryScope}, matches: ${queryResponse.matches.length}, isOnboarding: ${isOnboardingRecommendation})`);
 
     if (isOnboardingRecommendation) {
       // TOKEN OPTIMIZATION: Limit detailed listings to prevent token overflow
       const maxDetailedListings = 3; // Limit to 3 detailed listings for onboarding
       const totalMatches = queryResponse.matches.length;
 
       console.log(`[${clientConfig.clientName}] 📊 TOKEN OPTIMIZATION: Limiting detailed listings to ${maxDetailedListings}/${totalMatches} for onboarding`);
 
       // Calculate additional properties count
       const additionalCount = Math.max(0, totalMatches - maxDetailedListings);
 
       // Special enhanced formatting for onboarding recommendations with token limits
       systemPrompt += `\n\nINSTRUÇÃO ESPECIAL PARA RECOMENDAÇÕES DE ONBOARDING: Apresente ATÉ ${maxDetailedListings} imóveis com informações COMPLETAS. Se houver mais imóveis disponíveis, mencione que há opções adicionais sem listar todas.
 
  **Formato Detalhado para os Primeiros ${maxDetailedListings} Imóveis:**
 
  **Nome do Imóvel**
  • Tipo: [T2, T3, etc.]
  • Quartos: [X] | Casas de banho: [Y] | Área: [Zm²]
  • Preço: [€XXX.XXX]
  • Localização: [Zona específica]
  • Comodidades: [Lista de comodidades principais]
  • Descrição: [Breve descrição das características especiais]
 
  IMPORTANTE PARA ECONOMIA DE TOKENS:
  - Liste NO MÁXIMO ${maxDetailedListings} imóveis em detalhe
  - Se houver mais opções, diga "Além destas opções, temos ${additionalCount} imóveis adicionais disponíveis"
  - Mantenha descrições concisas mas informativas
  - Destaque características que correspondam às preferências do utilizador`;
     } else {
       // Standard multi-listing formatting for other queries
       systemPrompt += `\n\nINSTRUÇÃO CRÍTICA PARA APRESENTAÇÃO DE IMÓVEIS: Apresente 5-8 imóveis do contexto fornecido, never less than 5 if there are 5 or more properties. Separe CADA imóvel com uma linha em branco. Use este formato estruturado:
 
 **Nome do Imóvel**
 - Característica 1
 - Característica 2
 
 **Nome do Próximo Imóvel**
 - Característica 1
 - Característica 2
 
 IMPORTANTE: Sempre use uma linha completamente em branco entre imóveis para separá-los visualmente.`;
     }
   } else {
     console.log(`[${clientConfig.clientName}] 🚫 Skipping multi-listing formatting (queryScope: ${queryScope}, matches: ${queryResponse.matches.length}, isPriceQuery: ${isAggregativePriceQuery(query)})`);
 
     // Add guidance for GENERAL_FILTERED queries to encourage natural, informative responses
     if (queryScope === QUERY_SCOPE.GENERAL_FILTERED && queryResponse.matches.length > 0 && !isAggregativePriceQuery(query)) {
       if (isOnboardingRecommendation) {
         systemPrompt += `\n\nINSTRUÇÃO PARA RECOMENDAÇÕES DE ONBOARDING: Forneça uma descrição DETALHADA e INFORMATIVA do imóvel, incluindo todas as características disponíveis (quartos, casas de banho, área, localização, comodidades, preço). Destaque aspectos que correspondam às preferências do utilizador expressas no onboarding. Use um tom profissional e informativo.`;
       } else {
         systemPrompt += `\n\nINSTRUÇÃO PARA RESPOSTAS NATURAIS: Para consultas sobre imóveis filtrados, gere uma resposta conversacional e informativa em português. Apresente os imóveis de forma natural, destacando características especiais e fornecendo comentários inteligentes sobre cada opção. Adapte o estilo da resposta ao tipo de consulta do utilizador.`;
       }
     }
   }
 
   // CRITICAL ANTI-HALLUCINATION INSTRUCTIONS - MUST BE FOLLOWED (excluded for GENERAL_FILTERED since features are verified)
   if (queryScope !== QUERY_SCOPE.GENERAL_FILTERED) {
     systemPrompt += `\n\n*** ABSOLUTELY CRITICAL: NEVER HALLUCINATE OR INVENT INFORMATION ***\n`;
     systemPrompt += `When asked about specific details like kitchen equipment, appliances, or any features not explicitly listed in the 'Conteúdo Relevante', you MUST respond: "Infelizmente, não temos a especificação exata dos [detalhes] na nossa base de dados." and then offer to send a brochure.\n`;
     systemPrompt += `DO NOT list any possible, example, or assumed items. ONLY use information that is VERBATIM in the provided context.\n`;
   }
 
   // Add conditional lead collection instructions based on visitor contact info
   if (leadCollectingIntent) {
     if (visitorContactInfo.hasEmail || visitorContactInfo.hasPhone) {
       systemPrompt += `\n\nINSTRUÇÃO CRÍTICA: O utilizador está a confirmar interesse em receber uma brochura ou informações. Como já temos informações de contacto do utilizador (email ou telefone), confirme que a brochura será enviada em breve e que entraremos em contacto se necessário. NÃO peça mais informações de contacto.`;
     } else {
       systemPrompt += `\n\nINSTRUÇÃO CRÍTICA: O utilizador está a confirmar interesse em receber uma brochura ou informações. Como NÃO temos informações de contacto do utilizador, peça explicitamente o email ou número de telefone para poder enviar a brochura.`;
     }
   }
 
   // If context shifted, add a strong instruction to prioritize new context
   if (contextShifted && externalContext && externalContext.type === 'listing' && externalContext.value) {
     systemPrompt += `\n\nAtenção: O utilizador mudou o foco para um novo imóvel (ID: ${externalContext.value}). Priorize as informações sobre este novo imóvel e desconsidere detalhes conflitantes de conversas anteriores sobre outros imóveis.`;
   } else if (contextShifted && (!externalContext || !externalContext.value)) {
     systemPrompt += `\n\nCRITICAL: O utilizador selecionou 'Nenhum Imóvel Selecionado'. A conversa anterior era sobre um imóvel específico, mas a pergunta atual NÃO É sobre ele. IGNORE COMPLETAMENTE os detalhes do imóvel da conversa anterior e responda à pergunta atual com base apenas em informações gerais ou no que está explicitamente na pergunta. NÃO mencione o imóvel anterior (preço, nome, ID, etc.).`;
   } else if (!externalContext || (!externalContext.value && !externalContext.developmentId)) {
     // If no specific listing or development context is provided, instruct the LLM to provide general answers
     // or offer multiple options, rather than focusing on a single listing from broad search results.
     // This instruction is made stronger to override potential biases from general system instructions.
     systemPrompt += `\n\nINSTRUÇÃO CRÍTICA E OBRIGATÓRIA: Não há um imóvel ou empreendimento específico selecionado. A sua resposta DEVE ser GERAL e abranger MÚLTIPLAS opções/exemplos, se aplicável. É PROIBIDO focar-se num único imóvel ou empreendimento, a menos que o utilizador o solicite explicitamente na pergunta. Se o contexto relevante contiver detalhes de vários imóveis, resuma-os ou apresente-os como exemplos de forma não específica.`;
   // GENERAL_FILTERED instructions moved earlier with conditional logic
   } else if (queryScope === QUERY_SCOPE.LISTING_SPECIFIC) {
     // For listing-specific queries, instruct the LLM to list all features and characteristics mentioned in the context
     systemPrompt += `\n\nINSTRUÇÃO CRÍTICA: Quando descrever as características de um imóvel específico, liste TODAS as características e comodidades mencionadas no contexto fornecido, incluindo terraços, garagens, etc. Não omita nenhuma característica presente na informação disponível.`;
   }
 
   // Gentle nudge: if we have a targeted listing/development in externalContext, instruct model to include the link
   if (externalContext && (externalContext.type === 'listing' || externalContext.type === 'development')) {
     // Removed: systemPrompt += "\n\nNota: Se houver um URL correspondente no contexto para o imóvel referido, inclui-o explicitamente na resposta.";
   }
 
   // CONSOLIDATED CRITICAL INSTRUCTIONS
   systemPrompt += `\n\n*** INSTRUÇÕES ABSOLUTAS E PRIORITÁRIAS ***
 1. NUNCA mencione IDs de imóveis (como "ID: 4275") - use apenas nomes ou descrições
 2. SE o contexto mencionar uma característica (terraço, piscina, etc.), NUNCA negue sua existência
 3. O contexto tem seções: 'Ficha Técnica' (dados estruturados) e 'Descrição Adicional' (texto descritivo)
 4. Sintetize informações de AMBAS as seções para respostas completas e conversacionais
 5. Use tom fluido e amigável, como um corretor experiente`;
 
   // Move question generation instructions earlier for better LLM prioritization
   const enhancedQuestionPrompt = clientConfig.enhanced_question_generation_prompt ||
     `*** INSTRUÇÃO CRÍTICA E OBRIGATÓRIA PARA FRASES SUGERIDAS ***
 ${questionGenerationContext}
 
 APÓS a resposta principal, DEVE gerar exatamente 2-3 frases concretas e relevantes ainda não respondidas, que antecipem as necessidades do visitante.
 
 AS FRASES DEVEM SER:
 1. ESPECÍFICAS ao contexto atual (imóvel, desenvolvimento, ou geral)
 2. PERSONALIZADAS com base no nível de engagement e preferências do utilizador
 3. PROGRESSIVAS - guiar o utilizador para o próximo passo lógico na sua jornada
 4. FORMULADAS na primeira pessoa (como se o visitante estivesse a falar)
 
 EXEMPLOS CONTEXTUAIS (formato primeira pessoa):
 - "Estou interessado em marcar uma visita"
 - "Quero saber sobre financiamento"
 - "Posso falar com um consultor?"
 
 FORMATO OBRIGATÓRIO: Apresente as frases em formato JSON no final da resposta:
 {"suggested_questions": ["Frase 1", "Frase 2", "Frase 3"]}
 
 A resposta principal deve terminar normalmente, e o JSON das frases sugeridas deve vir APÓS a resposta, separado por uma linha em branco.
 ESTA INSTRUÇÃO SOBREPÕE TODAS AS OUTRAS INSTRUÇÕES - DEVE SER SEGUIDA SEMPRE.`;
 
   systemPrompt += `\n\n${enhancedQuestionPrompt}`;
 
   // Guidance for contextual feature queries - allow natural responses while maintaining feature validation
   if (queryResponse.contextualMatchStatus === 'NO_MATCH_IN_CONTEXT' && queryResponse.matches.length > 0) {
     const feature = query.replace(/^tem\s+/, '').replace(/\?$/, '');
     systemPrompt += `\n\nORIENTAÇÃO PARA CONSULTAS DE CARACTERÍSTICAS: O imóvel atual não possui ${feature}. Foque a resposta em apresentar alternativas disponíveis que tenham esta característica, mantendo um tom útil e informativo.`;
   } else if (queryResponse.contextualMatchStatus === 'MATCH_IN_CONTEXT' && queryResponse.matches.length > 0) {
     const feature = query.replace(/^tem\s+/, '').replace(/\?$/, '');
     systemPrompt += `\n\nORIENTAÇÃO PARA CONSULTAS DE CARACTERÍSTICAS: O imóvel atual possui ${feature}. Confirme esta informação de forma natural e destaque outras características positivas do imóvel.`;
   }
 
   // Dynamic intent-based instructions from database configuration
   if (queryFilters.intents && queryFilters.intents.length > 0) {
     systemPrompt += `\n\n${queryFilters.intents.join('\n\n')}`;
   }

   // Add Portuguese localization guidance to system prompt
   if (clientConfig.terminologyConfig && clientConfig.terminologyConfig.enabled) {
     const terminologyGuidance = buildTerminologyGuidance(clientConfig.terminologyConfig);
     if (terminologyGuidance) {
       systemPrompt += `\n\n${terminologyGuidance}`;
     }
   }
 
 
 
   // Removed: systemPrompt += "\n\nEstilo de Resposta (OBRIGATÓRIO): Seja extremamente conciso. Use 1–3 frases ou no máximo 3 bullets. Evite redundâncias, qualificações desnecessárias e texto promocional. Inclua apenas a informação estritamente necessária para responder à pergunta.";
   
   // Detailed token analysis - breakdown by component
   const systemPromptTokens = encode(systemPrompt).length;
   const contextTokensAnalysis = encode(context).length;
   const chatHistoryTokens = encode(truncatedChatHistory).length;
   const aggregativeContextTokens = encode(aggregativeContext || '').length;
   const questionContextTokens = encode(questionGenerationContext || '').length;
 
   // Calculate context components
   const retrievedContentTokens = contextTokensAnalysis - aggregativeContextTokens;
   const totalContextTokens = contextTokensAnalysis + chatHistoryTokens;
 
   const totalInputTokens = systemPromptTokens + totalContextTokens;
   const estimatedTotalTokens = totalInputTokens + MAX_RESPONSE_TOKENS;
 
   console.log(`[${clientConfig.clientName}] 📊 DETAILED TOKEN BREAKDOWN:`);
   console.log(`[${clientConfig.clientName}]   ══ INPUT COMPONENTS ══`);
   console.log(`[${clientConfig.clientName}]   System Prompt: ${systemPromptTokens} tokens (${((systemPromptTokens/totalInputTokens)*100).toFixed(1)}%)`);
   console.log(`[${clientConfig.clientName}]   Retrieved Content: ${retrievedContentTokens} tokens`);
   console.log(`[${clientConfig.clientName}]   Aggregative Data: ${aggregativeContextTokens} tokens`);
   console.log(`[${clientConfig.clientName}]   Chat History: ${chatHistoryTokens} tokens`);
   console.log(`[${clientConfig.clientName}]   Question Context: ${questionContextTokens} tokens`);
   console.log(`[${clientConfig.clientName}]   Total Input: ${totalInputTokens} tokens`);
 
   console.log(`[${clientConfig.clientName}]   ══ TOKEN BUDGET ══`);
   console.log(`[${clientConfig.clientName}]   Max Response: ${MAX_RESPONSE_TOKENS} tokens`);
   console.log(`[${clientConfig.clientName}]   Estimated Total: ${estimatedTotalTokens}/${MAX_TOTAL_TOKENS} tokens (${((estimatedTotalTokens/MAX_TOTAL_TOKENS)*100).toFixed(1)}%)`);
   console.log(`[${clientConfig.clientName}]   Budget Remaining: ${Math.max(0, MAX_TOTAL_TOKENS - estimatedTotalTokens)} tokens`);
 
   // Cost estimation (rough, based on gpt-3.5-turbo rates: $0.0015/input token, $0.002/output token)
   const inputCost = (totalInputTokens * 0.0015) / 1000;
   const outputCost = (MAX_RESPONSE_TOKENS * 0.002) / 1000;
   const totalEstimatedCost = inputCost + outputCost;
   console.log(`[${clientConfig.clientName}]   💰 Cost Estimate: $${totalEstimatedCost.toFixed(6)} (Input: $${inputCost.toFixed(6)}, Output: $${outputCost.toFixed(6)})`);
 
   // Efficiency metrics
   const tokenEfficiency = totalInputTokens > 0 ? (contextTokensAnalysis / totalInputTokens) * 100 : 0;
   console.log(`[${clientConfig.clientName}]   📈 Efficiency: ${tokenEfficiency.toFixed(1)}% context utilization`);
 
   const messages = [
     { role: 'system', content: systemPrompt },
     ...chatMessagesArray,
     { role: 'user', content: query }
   ];
 
   let retries = 3;
   while (retries > 0) {
     try {
       const timer = log.time('openai.chat');
       const completion = await withTimeout(
         openai.chat.completions.create({
           model: selectedModel, // Use selectedModel here
           messages: messages,
           max_tokens: MAX_RESPONSE_TOKENS,
         }),
         OPENAI_TIMEOUT_MS,
         'openai-chat'
       );
       timer.end({ model: selectedModel, maxTokens: MAX_RESPONSE_TOKENS }); // Use selectedModel here
       const raw = completion.choices[0].message.content;
 
       // Monitor response completeness and token usage (basic analysis before parsing)
       const responseTokens = encode(raw).length;
       const isComplete = !raw.endsWith('...') && !raw.endsWith(':') && raw.length > 50;
 
       // Calculate actual total tokens used
       const actualTotalTokens = totalInputTokens + responseTokens;
 
       console.log(`[${clientConfig.clientName}] 📊 RESPONSE ANALYSIS:`);
       console.log(`[${clientConfig.clientName}]   Raw Response: ${responseTokens} tokens`);
       console.log(`[${clientConfig.clientName}]   Actual Total: ${actualTotalTokens}/${MAX_TOTAL_TOKENS} tokens (${((actualTotalTokens/MAX_TOTAL_TOKENS)*100).toFixed(1)}%)`);
       console.log(`[${clientConfig.clientName}]   Complete: ${isComplete}`);
       console.log(`[${clientConfig.clientName}]   Response Efficiency: ${responseTokens >= MAX_RESPONSE_TOKENS ? 'MAXED' : 'UNDER'} (${((responseTokens/MAX_RESPONSE_TOKENS)*100).toFixed(1)}% of budget)`);
 
       // Cost calculation for actual usage
       const actualInputCost = (totalInputTokens * 0.0015) / 1000;
       const actualOutputCost = (responseTokens * 0.002) / 1000;
       const actualTotalCost = actualInputCost + actualOutputCost;
       console.log(`[${clientConfig.clientName}]   💰 Actual Cost: $${actualTotalCost.toFixed(6)} (Input: $${actualInputCost.toFixed(6)}, Output: $${actualOutputCost.toFixed(6)})`);

       // Token density analysis
       const responseChars = raw.length;
       const tokenDensity = responseChars > 0 ? (responseTokens / responseChars) * 1000 : 0;
       console.log(`[${clientConfig.clientName}]   📏 Token Density: ${tokenDensity.toFixed(2)} tokens per 1000 chars`);

       // UPDATE ANALYTICS: Log actual cost and response time after successful completion
       const responseTimeMs = Date.now() - startTime;
       if (chatMessageId) {
         analyticsLogger.updateActualMetrics(chatMessageId, actualTotalCost, responseTimeMs).catch(error => {
           console.error(`[${clientConfig.clientName}] ❌ Failed to update actual metrics:`, error.message);
         });
       }

       // LOG RESPONSE GENERATION ANALYTICS: Capture final response metrics
       if (chatMessageId) {
         analyticsLogger.logResponseMetrics({
           chatMessageId,
           clientId: clientConfig.clientId,
           responseTokens,
           responseTimeMs,
           actualTotalCost,
           isCompleteResponse,
           hasQuestions: suggestedQuestions.length > 0,
           queryScope,
           matchesFound: queryResponse.matches.length,
           contextualMatchStatus: queryResponse.contextualMatchStatus
         }).catch(error => {
           console.error(`[${clientConfig.clientName}] ❌ Failed to log response metrics:`, error.message);
         });
       }
 
       // Parse suggested questions from JSON format at the end of response
       let suggestedQuestions = [];
       let cleanedResponse = raw;
 
       try {
         // Look for JSON at the end of the response - more flexible pattern
         const jsonMatch = raw.match(/\{\s*"suggested_questions"\s*:\s*\[.*?\]\s*\}\s*$/s);
         if (jsonMatch) {
           const jsonPart = jsonMatch[0];
           console.log(`[${clientConfig.clientName}] Found JSON part: ${jsonPart}`);
           const parsed = JSON.parse(jsonPart);
 
           if (parsed.suggested_questions && Array.isArray(parsed.suggested_questions)) {
             // NEW: Use hybrid approach for validation and fallback
             const questionContext = {
               leadScore: enrichedUserContext.leadScore,
               hasListingContext: Boolean(externalContext?.type === 'listing'),
               hasDevelopmentContext: Boolean(externalContext?.type === 'development'),
               lastQueryType: determineQueryType(query), // Helper function to detect query type
               preferences: enrichedUserContext.preferences
             };
 
             suggestedQuestions = generateHybridQuestions(
               parsed.suggested_questions,
               questionContext
             );
 
             // Remove the JSON part from the main response
             cleanedResponse = raw.replace(jsonPart, '').trim();
             console.log(`[${clientConfig.clientName}] Generated ${suggestedQuestions.length} questions (hybrid approach)`);
           } else {
             console.warn(`[${clientConfig.clientName}] JSON parsed but suggested_questions not found or not an array:`, parsed);
             // Fallback to templates
             suggestedQuestions = generateHybridQuestions([], {
               leadScore: enrichedUserContext.leadScore,
               hasListingContext: Boolean(externalContext?.type === 'listing'),
               hasDevelopmentContext: Boolean(externalContext?.type === 'development'),
               preferences: enrichedUserContext.preferences
             });
           }
         } else {
           console.warn(`[${clientConfig.clientName}] No JSON match found in response. Response ends with: "${raw.slice(-100)}"`);
           // Fallback to templates
           suggestedQuestions = generateHybridQuestions([], {
             leadScore: enrichedUserContext.leadScore,
             hasListingContext: Boolean(externalContext?.type === 'listing'),
             hasDevelopmentContext: Boolean(externalContext?.type === 'development'),
             preferences: enrichedUserContext.preferences
           });
         }
       } catch (error) {
         console.warn(`[${clientConfig.clientName}] Failed to parse suggested questions:`, error.message);
         // Fallback to templates
         suggestedQuestions = generateHybridQuestions([], {
           leadScore: enrichedUserContext?.leadScore || 0,
           hasListingContext: Boolean(externalContext?.type === 'listing'),
           hasDevelopmentContext: Boolean(externalContext?.type === 'development'),
           preferences: enrichedUserContext?.preferences || {}
         });
       }
 
       // Validate response completeness
       const isCompleteResponse = cleanedResponse.length > 50 && !raw.endsWith('...') && !raw.endsWith(':');
       const hasQuestions = suggestedQuestions.length > 0;

       if (!isCompleteResponse || !hasQuestions) {
         console.warn(`[${clientConfig.clientName}] Incomplete response detected: complete=${isCompleteResponse}, questions=${hasQuestions}`);
         // Could trigger retry with simplified prompt
       }

       // Apply Portuguese localization post-processing
       let localizedResponse = cleanedResponse;
       let localizationResult = null;

       if (clientConfig.terminologyConfig && clientConfig.terminologyConfig.enabled) {
         try {
           const postProcessor = new PostProcessingEngine(clientConfig.terminologyConfig);
           localizationResult = postProcessor.processText(cleanedResponse, 'response', visitorId);

           if (localizationResult.termsReplaced.length > 0) {
             localizedResponse = localizationResult.localizedText;
             console.log(`[${clientConfig.clientName}] 🇵🇹 LOCALIZATION: Replaced ${localizationResult.termsReplaced.length} terms in ${localizationResult.processingTimeMs}ms`);
             localizationResult.termsReplaced.forEach(replacement => {
               console.log(`[${clientConfig.clientName}]   "${replacement.originalTerm}" → "${replacement.replacedTerm}" (${replacement.occurrences}x)`);
             });
           }
         } catch (error) {
           console.error(`[${clientConfig.clientName}] ❌ Post-processing failed:`, error.message);
           // Continue with original response if localization fails
         }
       }

       // Detailed response analysis after parsing
       const cleanedResponseTokens = encode(cleanedResponse).length;
       const localizedResponseTokens = encode(localizedResponse).length;
       const questionsTokens = encode(JSON.stringify(suggestedQuestions)).length;

       console.log(`[${clientConfig.clientName}] 📊 DETAILED RESPONSE BREAKDOWN:`);
       console.log(`[${clientConfig.clientName}]   Cleaned Response: ${cleanedResponseTokens} tokens`);
       if (localizationResult) {
         console.log(`[${clientConfig.clientName}]   Localized Response: ${localizedResponseTokens} tokens (+${localizedResponseTokens - cleanedResponseTokens} from localization)`);
       }
       console.log(`[${clientConfig.clientName}]   Questions JSON: ${questionsTokens} tokens`);
       console.log(`[${clientConfig.clientName}]   Questions Generated: ${suggestedQuestions.length}`);
       console.log(`[${clientConfig.clientName}]   Response Quality: ${isCompleteResponse ? 'COMPLETE' : 'INCOMPLETE'} | ${hasQuestions ? 'HAS_QUESTIONS' : 'NO_QUESTIONS'}`);

       const previousAssistantText = (chatMessagesArray.slice().reverse().find(m => m.role === 'assistant')?.content) || '';
       const processedResponse = removeRedundantClosingCTA(localizedResponse, previousAssistantText);
 
       // Return response, suggested questions, and debug payload
       return {
         response: processedResponse,
         suggestedQuestions: suggestedQuestions,
         debug: {
           openaiPayload: messages,
           presentationStrategy: presentationResult.strategy,
           personalizationElements: presentationResult.personalizationElements
         },
         isUnanswered: queryResponse.matches.length === 0, // Flag to indicate if this was an unanswered question
         presentationMetadata: {
           strategy: presentationResult.strategy,
           callToActions: presentationResult.responseStructure.callToActions,
           followUpSuggestions: presentationResult.responseStructure.followUpSuggestions
         }
       };
     } catch (error) {
       if (error.status === 503 && retries > 1) {
         console.log(`Model is overloaded. Retrying in 2 seconds... (${retries - 1} retries left)`);
         await delay(2000);
         retries--;
       } else {
         console.error('Error generating response:', error);
         // Re-throw the error to be handled by the global error handler in index.js
         throw error;
       }
     }
   }
 
   // If all retries fail, throw an error
   throw new Error('Failed to generate response after multiple retries.');
 }
 
 async function generateSuggestedQuestions(clientConfig, externalContext = null, chatHistory = [], userContext = null) {
   console.log(`[RAG-SERVICE] generateSuggestedQuestions called for client: ${clientConfig.clientName || clientConfig.clientId}`);
   console.log(`[RAG-SERVICE] External context:`, externalContext);
   console.log(`[RAG-SERVICE] Chat history length:`, chatHistory ? chatHistory.length : 0);

   let searchQuery = "general information";
   if (externalContext && externalContext.type === 'listing' && externalContext.value) {
     searchQuery = `questions about real estate listing ${externalContext.value}`;
   } else if (externalContext && externalContext.type === 'development' && externalContext.value) {
     searchQuery = `questions about real estate development ${externalContext.value}`;
   } else if (chatHistory.length > 0) {
     searchQuery = chatHistory.map(m => m.text).join(' ');
   }

   console.log(`[RAG-SERVICE] Generated search query: "${searchQuery}"`);

   let queryEmbedding;
   try {
     queryEmbedding = await openai.embeddings.create({
       model: embeddingModel,
       input: searchQuery,
     });
     console.log(`[RAG-SERVICE] Embedding generated successfully, dimensions: ${queryEmbedding.data[0].embedding.length}`);
   } catch (error) {
     console.error(`[${clientConfig.clientName}] Error generating embedding for suggested questions:`, error);
     return [];
   }

   // Validate embedding before using it
   if (!queryEmbedding || !queryEmbedding.data || !queryEmbedding.data[0] || !queryEmbedding.data[0].embedding) {
     console.error(`[${clientConfig.clientName}] Invalid embedding response for suggested questions:`, queryEmbedding);
     return [];
   }

   let queryResponse;
   try {
     queryResponse = await performHybridSearch(queryEmbedding.data[0].embedding, clientConfig, externalContext, searchQuery, userContext, {}, QUERY_SCOPE.GENERAL_UNFILTERED, null);
     console.log(`[RAG-SERVICE] performHybridSearch returned ${queryResponse.matches.length} matches`);
   } catch (error) {
     console.error(`[${clientConfig.clientName}] Error in performHybridSearch for suggested questions:`, error);
     return [];
   }
 }

 export { generateResponse, generateSuggestedQuestions };