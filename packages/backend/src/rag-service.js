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
import { buildContext, pickText, buildContextFromMatches, buildStructuredListingSummary } from './utils/context.js';
import { renderTemplate } from './utils/prompt.js';
import { createLogger } from './utils/structured-logger.js';
import { extractListingIdFromUrl, extractListingIdFromQuery, extractQueryFilters, isAggregativePriceQuery, QUERY_SCOPE } from './utils/rag-parsing.js';
import { removeRedundantClosingCTA } from './utils/postprocess.js';
import { generateHybridQuestions } from './utils/question-strategies.js';
import supabase from './config/supabase.js';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

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

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const log = createLogger('rag-service');

async function performHybridSearch(searchVector, clientConfig, externalContext = null, originalQuery = "", userContext = null, queryFilters = {}, queryScope = QUERY_SCOPE.GENERAL_UNFILTERED) {
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

  console.log(`Found ${matches.length} matches in targeted listing search.`);
  console.log(`Found ${broadMatches.length} matches in broad search.`);
  
  // Add detailed debugging for broad search
  console.log(`🔍 DEBUGGING - Broad Search Details:`);
  console.log(`  Base filter: ${JSON.stringify(baseFilter, null, 2)}`);
  console.log(`  Vector dimensions: ${searchVector.length}`);
  console.log(`  TopK requested: ${broadParams?.topK || 0}`);
  if (broadMatches.length > 0) {
    console.log(`  Best match score: ${broadMatches[0].score}`);
    console.log(`  Worst match score: ${broadMatches[broadMatches.length - 1].score}`);
  }

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
    const reRankQueryFilters = extractQueryFilters(originalQuery, currentListingPrice, clientConfig);

    // Determine queryScope based on externalContext and filters
    let queryScope = QUERY_SCOPE.GENERAL_UNFILTERED;
    const hasSignificantFilters = reRankQueryFilters.generated_tags || reRankQueryFilters.num_bedrooms || reRankQueryFilters.price_eur || reRankQueryFilters.typology || reRankQueryFilters.num_bathrooms || reRankQueryFilters.total_area_sqm;
    const hasListingIdFromQuery = reRankQueryFilters.listing_id;
    const hasExternalContext = externalContext && (externalContext.value || externalContext.developmentId);

    if (hasListingIdFromQuery) {
      queryScope = QUERY_SCOPE.LISTING_SPECIFIC;
    } else if (hasExternalContext && !hasSignificantFilters) {
      queryScope = QUERY_SCOPE.LISTING_SPECIFIC;
    } else if (hasSignificantFilters) {
      queryScope = QUERY_SCOPE.GENERAL_FILTERED;
    }

    console.log(`[${clientConfig.clientName}] 🔍 DEBUG: Determined queryScope: ${queryScope} (hasExternalContext: ${hasExternalContext}, hasSignificantFilters: ${hasSignificantFilters}, hasListingIdFromQuery: ${hasListingIdFromQuery})`);

    // Dynamically adjust topN based on queryScope to ensure broader results for general queries
    const topN = queryScope === QUERY_SCOPE.GENERAL_FILTERED ? 50 : 20;

    reRankedResult = reRankMatches({
      matches,
      contextListingId,
      contextDevelopmentId,
      originalQuery,
      queryFilters: reRankQueryFilters,
      queryScope,
      topN,
      targetedMatches: targetedResponse?.matches || [],
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

   // Convert buying timeframe (could be used for urgency scoring in future)
   if (onboardingAnswers.buying_timeframe) {
     // For now, we'll store this as metadata but not use it in filtering
     // Could be used for lead scoring or agent assignment
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

   // Add timeframe context
   if (onboardingAnswers.buying_timeframe) {
     queryParts.push(`para ${onboardingAnswers.buying_timeframe.toLowerCase()}`);
   }

   return queryParts.join(" ");
 }

/**
 * Enriches user context with behavioral data for personalized question generation
 * @param {string} visitorId - Unique visitor identifier
 * @param {string} clientId - Client UUID
 * @returns {Promise<Object>} User context object
 */
async function enrichUserContext(visitorId, clientId) {
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
        events!inner(
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

async function generateResponse(query, clientConfig, queryEmbeddingVector, externalContext = null, userContext = null, chatHistory = null, pageUrl = null, contextShifted = false, visitorId = null, onboardingContext = null) {
   // Normalize externalContext format for backward compatibility
   if (externalContext?.listingId && !externalContext.type) {
     externalContext = {
       type: 'listing',
       value: externalContext.listingId,
       developmentId: externalContext.developmentId
     };
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
    queryFilters = extractQueryFilters(query, null, clientConfig);
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

  console.log(`[${clientConfig.clientName}] 🔍 DEBUG: Determined queryScope for system prompt: ${queryScope} (hasExternalContext: ${hasExternalContext}, hasSignificantFilters: ${hasSignificantFilters}, hasListingIdFromQuery: ${hasListingIdFromQuery})`);

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

  // Add debugging for filters
  console.log(`[${clientConfig.clientName}] 🔍 DEBUGGING - Filters Applied:`);
  console.log(`  Query filters: ${JSON.stringify(queryFilters, null, 2)}`);
  console.log(`  Original query: "${query}"`);
  console.log(`  Lead collecting intent: ${leadCollectingIntent}`);
  console.log(`  Visitor contact info: ${JSON.stringify(visitorContactInfo)}`);

  let queryResponse = { matches: [], contextualMatchStatus: 'NOT_APPLICABLE' };
  try {
    queryResponse = await performHybridSearch(queryEmbeddingVector, clientConfig, externalContext, query, userContext, queryFilters, queryScope);
  } catch (error) {
    console.error(`[${clientConfig.clientName}] Error in performHybridSearch:`, error);
    // Return empty matches if search fails due to invalid embedding
    queryResponse = { matches: [], contextualMatchStatus: 'NOT_APPLICABLE' };
  }

  const structuredListingSummary = queryScope === QUERY_SCOPE.GENERAL_FILTERED
    ? buildStructuredListingSummary(queryResponse.matches, queryFilters)
    : null;
  
  // Add debugging for matches found
  console.log(`[${clientConfig.clientName}] 🔍 DEBUGGING - Search Results:`);
  console.log(`  Total matches found: ${queryResponse.matches.length}`);
  if (queryResponse.matches.length > 0) {
    console.log(`  First match score: ${queryResponse.matches[0].score}`);
    console.log(`  Match metadata keys: ${Object.keys(queryResponse.matches[0].metadata || {})}`);
    queryResponse.matches.slice(0, 3).forEach((match, index) => {
      console.log(`    Match ${index + 1}: ${match.metadata.listing_id || match.metadata.development_id || 'Unknown ID'} (score: ${match.score})`);
    });
  } else {
    console.log(`  ⚠️ No matches found in Pinecone for query: "${query}"`);
  }
  
  // Check if we have no matches and handle accordingly
  if (queryResponse.matches.length === 0) {
    console.log(`[${clientConfig.clientName}] ⚠️ No matches found in Pinecone. The chatbot may generate generic responses or hallucinate listings.`);
  }
  
  let context = buildContextFromMatches(queryResponse.matches, preferredListingId, contextDevelopmentId);

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
    console.log(`[${clientConfig.clientName}] 🧩 Context assembly:`, JSON.stringify({
      pickedTextCount: texts.length,
      hasPageContext: Boolean(pageContext),
      topMatchSummaries,
      sampleText: texts[0] ? texts[0].slice(0, 200) : null,
    }, null, 2));
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

  // NEW: Enrich user context for personalized questions
  const enrichedUserContext = await enrichUserContext(visitorId, clientConfig.clientId);

  // NEW: Build context-aware question generation instructions
  let questionGenerationContext = '';

  if (enrichedUserContext.hasHistory) {
    questionGenerationContext = `
CONTEXTO DO UTILIZADOR PARA FRASES SUGERIDAS:
- Nível de Engagement: ${enrichedUserContext.engagementLevel} (Score: ${enrichedUserContext.leadScore}/100)
- Tendência: ${enrichedUserContext.scoreTrend > 0 ? 'crescente (+' + enrichedUserContext.scoreTrend + ')' :
             enrichedUserContext.scoreTrend < 0 ? 'decrescente (' + enrichedUserContext.scoreTrend + ')' : 'estável'}
${enrichedUserContext.preferences.tipologia ? `- Preferência de Tipologia: ${enrichedUserContext.preferences.tipologia}` : ''}
${enrichedUserContext.preferences.budget ? `- Orçamento: €${enrichedUserContext.preferences.budget.toLocaleString('pt-PT')}` : ''}
${enrichedUserContext.preferences.development ? `- Empreendimento de Interesse: ${enrichedUserContext.preferences.development}` : ''}
${enrichedUserContext.recentEvents.length > 0 ? `- Ações Recentes: ${enrichedUserContext.recentEvents.map(e => e.type).join(', ')}` : ''}
${enrichedUserContext.hasContact ? '- Utilizador já forneceu contacto (lead qualificado)' : '- Utilizador ainda não forneceu contacto'}

ESTRATÉGIA DE FRASES BASEADA NO ENGAGEMENT:
${enrichedUserContext.engagementLevel === 'high' ? `
- FOCO: Conversão e ação imediata
- Sugerir: marcar visita, falar com consultor, processo de compra
- Tom: Direto e orientado para decisão
` : enrichedUserContext.engagementLevel === 'medium' ? `
- FOCO: Aprofundamento e comparação
- Sugerir: características específicas, comparar opções, financiamento
- Tom: Informativo e exploratório
` : `
- FOCO: Descoberta e orientação
- Sugerir: explorar opções, entender características, conhecer empreendimentos
- Tom: Educativo e acolhedor
`}
`;
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

  // Add conditional instructions for GENERAL_FILTERED queries to control introductory text and formatting
  if (queryScope === QUERY_SCOPE.GENERAL_FILTERED && queryResponse.matches.length > 0 && !isAggregativePriceQuery(query)) {
    const requestedFeature = isOnboardingRecommendation ?
      "imóveis baseados nas suas preferências" :
      extractFeatureFromQuery(query);

    const introMessage = isOnboardingRecommendation ?
      (onboardingContext?.completionMessage || "Com base nas suas preferências") + ", aqui estão algumas opções disponíveis:" :
      `Aqui estão algumas opções de ${requestedFeature} disponíveis:`;

    systemPrompt += `\n\nINSTRUÇÃO CRÍTICA E OBRIGATÓRIA: Comece a resposta dizendo exatamente "${introMessage}". Liste algumas opções dos imóveis da lista fornecida no contexto. Formate cada imóvel como: **Nome:** [nome], **Tipo:** [tipo], **Quartos:** [beds], **Preço:** [preço]€\n\n. Formate o preço com separadores de milhares usando pontos (ex: 123.456€). NÃO INVENTE nem modifique as informações dos imóveis; use apenas os dados da lista fornecida para garantir a precisão.`;
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

  // CRITICAL INSTRUCTION: Never negate features mentioned in context
  systemPrompt += `\n\n*** INSTRUÇÃO ABSOLUTA E PRIORITÁRIA: SE O CONTEXTO MENCIONAR UMA CARACTERÍSTICA (como terraço, piscina, etc.), NUNCA NEGUE A SUA EXISTÊNCIA. CONFIRME SEMPRE A PRESENÇA SE ESTIVER MENCIONADA. ***`;

  // CRITICAL INSTRUCTION: Context structure
  systemPrompt += `\n\nINSTRUÇÃO CRÍTICA: O contexto é dividido em seções. Para o imóvel principal, há 'Ficha Técnica' (dados estruturados) e 'Descrição Adicional' (texto descritivo). Sintetize informações de AMBAS as seções do imóvel principal para criar uma resposta completa e conversacional. Use a seção 'Outros Imóveis Relevantes' APENAS se o usuário pedir explicitamente uma comparação. Mantenha um tom fluido e amigável, como um corretor de imóveis experiente.`;

  // CRITICAL INSTRUCTION: Never mention listing IDs in responses
  systemPrompt += `\n\n*** INSTRUÇÃO ABSOLUTA E PRIORITÁRIA: NUNCA mencione IDs de imóveis (como "ID: 4275") nas suas respostas ao utilizador. Sempre use apenas o nome do imóvel ou uma descrição clara. ***`;

  // New soft-fail instruction for contextual feature queries
  if (queryResponse.contextualMatchStatus === 'NO_MATCH_IN_CONTEXT' && queryResponse.matches.length > 0) {
    const feature = query.replace(/^tem\s+/, '').replace(/\?$/, '');
    systemPrompt += `\n\nINSTRUÇÃO CRÍTICA: Comece sempre a resposta dizendo "Desculpe, mas o imóvel atual não tem ${feature}. No entanto, aqui estão algumas opções disponíveis:" e depois liste as alternativas do contexto.`;
  }

  // Dynamic intent-based instructions from database configuration
  if (queryFilters.intents && queryFilters.intents.length > 0) {
    systemPrompt += `\n\n${queryFilters.intents.join('\n\n')}`;
  }


  // CRITICAL INSTRUCTION: Always generate suggested questions (overrides all other instructions)
  // Use database-driven prompt with fallback to hardcoded version
  const enhancedQuestionPrompt = clientConfig.enhanced_question_generation_prompt ||
    `*** INSTRUÇÃO CRÍTICA E OBRIGATÓRIA PARA FRASES SUGERIDAS ***
${questionGenerationContext}

APÓS a resposta principal, DEVE gerar exatamente 2-3 frases concretas e relevantes ainda não respondidas, que antecipem as necessidades do visitante.

AS FRASES DEVEM SER:
1. ESPECÍFICAS ao contexto atual (imóvel, desenvolvimento, ou geral)
2. PERSONALIZADAS com base no nível de engagement e preferências do utilizador
3. PROGRESSIVAS - guiar o utilizador para o próximo passo lógico na sua jornada
4. FORMULADAS na primeira pessoa (como se o visitante estivesse a falar)

EXEMPLOS CONTEXTUAIS:
${externalContext?.type === 'listing' ? `
- Engagement Alto: "Estou interessado em marcar uma visita a este imóvel", "Quero falar com um consultor sobre este apartamento"
- Engagement Médio: "Estou interessado em saber as opções de financiamento", "Quero comparar com outros T${queryFilters.num_bedrooms || 'X'}"
- Engagement Baixo: "Estou curioso sobre as características desta zona", "Quero ver outros imóveis semelhantes"
` : `
- Engagement Alto: "Estou pronto para marcar visitas aos imóveis", "Quero falar sobre o processo de compra"
- Engagement Médio: "Estou interessado em comparar preços e características", "Quero saber mais sobre financiamento"
- Engagement Baixo: "Estou a começar a procurar, pode orientar-me?", "Quero conhecer as opções disponíveis"
`}

FORMATO OBRIGATÓRIO: Apresente as frases em formato JSON no final da resposta:
{"suggested_questions": ["Frase 1", "Frase 2", "Frase 3"]}

A resposta principal deve terminar normalmente, e o JSON das frases sugeridas deve vir APÓS a resposta, separado por uma linha em branco.
ESTA INSTRUÇÃO SOBREPÕE TODAS AS OUTRAS INSTRUÇÕES - DEVE SER SEGUIDA SEMPRE.`;

  systemPrompt += `\n\n${enhancedQuestionPrompt}`;

  // Removed: systemPrompt += "\n\nEstilo de Resposta (OBRIGATÓRIO): Seja extremamente conciso. Use 1–3 frases ou no máximo 3 bullets. Evite redundâncias, qualificações desnecessárias e texto promocional. Inclua apenas a informação estritamente necessária para responder à pergunta.";
  
  console.log(`[${clientConfig.clientName || clientConfig.clientId}] Using enhanced system prompt. Final token estimate: ${MAX_TOTAL_TOKENS - remainingTokens}`);

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
          model: generativeModel,
          messages: messages,
          max_tokens: MAX_RESPONSE_TOKENS,
        }),
        OPENAI_TIMEOUT_MS,
        'openai-chat'
      );
      timer.end({ model: generativeModel, maxTokens: MAX_RESPONSE_TOKENS });
      const raw = completion.choices[0].message.content;

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

      const previousAssistantText = (chatMessagesArray.slice().reverse().find(m => m.role === 'assistant')?.content) || '';
      const processedResponse = removeRedundantClosingCTA(cleanedResponse, previousAssistantText);

      // Return response, suggested questions, and debug payload
      return {
        response: processedResponse,
        suggestedQuestions: suggestedQuestions,
        debug: {
          openaiPayload: messages
        },
        isUnanswered: queryResponse.matches.length === 0 // Flag to indicate if this was an unanswered question
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
    queryResponse = await performHybridSearch(queryEmbedding.data[0].embedding, clientConfig, externalContext, searchQuery, userContext);
    console.log(`[RAG-SERVICE] performHybridSearch returned ${queryResponse.matches.length} matches`);
  } catch (error) {
    console.error(`[${clientConfig.clientName}] Error in performHybridSearch for suggested questions:`, error);
    return [];
  }

  if (!queryResponse || queryResponse.matches.length === 0) {
    console.log(`[RAG-SERVICE] No matches found, returning empty array`);
    return [];
  }

  // Log metadata for debugging
  console.log(`[RAG-SERVICE] Inspecting match metadata:`);
  queryResponse.matches.slice(0, 3).forEach((match, index) => {
    console.log(`[RAG-SERVICE] Match ${index + 1} metadata keys:`, Object.keys(match.metadata || {}));
    console.log(`[RAG-SERVICE] Match ${index + 1} metadata.text:`, match.metadata?.text ? match.metadata.text.substring(0, 100) + '...' : 'undefined');
  });

  const context = queryResponse.matches
    .map(match => pickText(match.metadata))
    .filter(text => text && text.trim().length > 0)
    .join('\n\n---\n\n');

  console.log(`[RAG-SERVICE] Built context for LLM, length: ${context.length} characters`);
  console.log(`[RAG-SERVICE] Context content:`, context);

  // Use database-driven prompt with fallback to hardcoded version
  const prompt = clientConfig.basic_suggested_questions_prompt ||
    `You are a real estate chatbot assistant. Based on the following context about a real estate listing or development, generate exactly three distinct, relevant, and concise questions that a potential buyer or tenant might ask about this property.

    IMPORTANT: All questions must be specifically related to real estate, property features, pricing, location, or buying/renting process. Do not generate questions about unrelated topics like technology, healthcare, or general knowledge.

    CRITICAL: Each question must be answerable using the information provided in the context below. Only generate questions that can be answered based on the available knowledge base content. If the context doesn't contain enough information to generate three answerable questions, return fewer questions or an empty array.

    Format the output as a JSON object with a "questions" key containing an array of strings.
    For example: {"questions": ["What is the price of this property?", "Does it have a garage?", "What is the neighborhood like?"]}.
    If you cannot generate three relevant real estate questions from the context, return {"questions": []}.

    Context:
    ${context}`;

  console.log(`[RAG-SERVICE] Sending prompt to LLM`);

  try {
    const completion = await openai.chat.completions.create({
        model: generativeModel,
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: "json_object" },
      });
    const responseText = completion.choices[0].message.content;
    console.log(`[RAG-SERVICE] LLM response:`, responseText);

    // Check if responseText is empty or null
    if (!responseText || responseText.trim() === '') {
      console.error(`[RAG-SERVICE] LLM returned empty response`);
      return [];
    }

    // Basic validation to ensure the response is a parsable JSON array.
    const parsed = JSON.parse(responseText);
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions && Array.isArray(parsed.questions) ? parsed.questions : []);
    console.log(`[RAG-SERVICE] Parsed questions:`, questions);
    return questions;
  } catch (error) {
    console.error("[RAG-SERVICE] Failed to generate or parse suggested questions:", error);
    console.error("[RAG-SERVICE] Error details:", error.message);
    return [];
  }
}

export { generateResponse, generateSuggestedQuestions, embeddingModel };