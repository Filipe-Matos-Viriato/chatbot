// packages/backend/src/utils/context.js
// Utility functions for building and managing context from vector search results.
// To prepare contextual information for LLM prompts in the RAG system.
// Relevant files: rag-service.js, context-hierarchy-engine.js, semantic-deduplication-engine.js, context-compression-engine.js
import { encode } from 'gpt-3-encoder';
import ContextHierarchyEngine from './context-hierarchy-engine.js';
import SemanticDeduplicationEngine from './semantic-deduplication-engine.js';
import ContextCompressionEngine from './context-compression-engine.js';
import ContextWindowManager from './context-window-manager.js';

export function pickText(meta) {
  return (meta?.chunk_text || meta?.text || meta?.chunk || meta?.content || meta?.body || meta?.page_text || '').toString();
}

/**
 * Builds optimized context using advanced compression and hierarchy
 * @param {Object} options - Context building options
 * @param {string} options.pageContext - Page context
 * @param {Array} options.matches - Search result matches
 * @param {Object} options.queryAnalysis - Query analysis results
 * @param {Object} options.userContext - User context information
 * @param {number} options.tokenBudget - Token budget for context
 * @param {boolean} options.enableOptimization - Whether to use advanced optimization
 * @returns {Promise<Object>} Optimized context result
 */
export async function buildOptimizedContext({
  pageContext = '',
  matches = [],
  queryAnalysis = {},
  userContext = {},
  tokenBudget = 1500,
  enableOptimization = true
}) {
  if (!enableOptimization || matches.length === 0) {
    // Fallback to simple context building
    const simpleContext = buildContext({ pageContext, matches });
    return {
      context: simpleContext,
      tokens: encode(simpleContext).length,
      optimizationApplied: false,
      compressionRatio: 1.0
    };
  }

  try {
    console.log(`[buildOptimizedContext] Optimizing context for ${matches.length} matches, budget: ${tokenBudget} tokens`);

    // Initialize optimization engines
    const hierarchyEngine = new ContextHierarchyEngine();
    const deduplicationEngine = new SemanticDeduplicationEngine();
    const compressionEngine = new ContextCompressionEngine();
    const windowManager = new ContextWindowManager();

    // Step 1: Determine optimal window configuration
    const windowConfig = windowManager.determineOptimalWindow(
      queryAnalysis,
      userContext,
      { availableTokens: tokenBudget }
    );

    // Step 2: Organize chunks hierarchically
    const hierarchy = hierarchyEngine.organizeIntoHierarchy(matches, {
      queryIntent: queryAnalysis.intent,
      userContext,
      maxTotalChunks: 30
    });

    // Step 3: Flatten hierarchy for processing (prioritize by level)
    const prioritizedChunks = [
      ...hierarchy.summary,
      ...hierarchy.keyPoints,
      ...hierarchy.details,
      ...hierarchy.fullText
    ];

    // Step 4: Apply semantic deduplication if enabled
    let processedChunks = prioritizedChunks;
    if (windowConfig.enableDeduplication) {
      processedChunks = await deduplicationEngine.deduplicateChunks(prioritizedChunks);
      console.log(`[buildOptimizedContext] Deduplication: ${prioritizedChunks.length} → ${processedChunks.length} chunks`);
    }

    // Step 5: Apply compression
    const compressionResult = await compressionEngine.compressContext(
      processedChunks,
      Math.min(windowConfig.maxTokens, tokenBudget),
      {
        queryIntent: queryAnalysis.intent,
        compressionLevel: windowConfig.compressionLevel,
        preserveStructuredData: true
      }
    );

    // Step 6: Add page context if provided
    const finalContext = pageContext ?
      `${pageContext}\n\n--- Context ---\n\n${compressionResult.compressedContext}` :
      compressionResult.compressedContext;

    const finalTokens = encode(finalContext).length;

    console.log(`[buildOptimizedContext] Optimization complete: ${compressionResult.originalTokens} → ${finalTokens} tokens (${Math.round(compressionResult.compressionRatio * 100)}% ratio)`);

    return {
      context: finalContext,
      tokens: finalTokens,
      optimizationApplied: true,
      compressionRatio: compressionResult.compressionRatio,
      informationPreserved: compressionResult.informationPreserved,
      tokenSavings: compressionResult.tokenSavings,
      hierarchyStats: hierarchyEngine.getHierarchyStats(hierarchy),
      deduplicationStats: windowConfig.enableDeduplication ?
        deduplicationEngine.getDeduplicationStats(prioritizedChunks, processedChunks) : null,
      windowConfig
    };

  } catch (error) {
    console.error('[buildOptimizedContext] Error during optimization:', error);
    // Fallback to simple context building
    const fallbackContext = buildContext({ pageContext, matches });
    return {
      context: fallbackContext,
      tokens: encode(fallbackContext).length,
      optimizationApplied: false,
      compressionRatio: 1.0,
      error: error.message
    };
  }
}

export function buildContext({ pageContext = '', matches = [] }) {
   const texts = matches.map(m => pickText(m.metadata)).filter(Boolean);
   return pageContext + texts.join('\n\n---\n\n');
}

export function buildContextFromMatches(matches, contextListingId = null, contextDevelopmentId = null, isBroadOverview = false) {
  if (!matches || matches.length === 0) {
    return '';
  }

  // Identify the primary match
  let primaryMatch = null;
  let primaryId = null;
  if (contextListingId) {
    primaryMatch = matches.find(m => m.metadata?.listing_id === contextListingId);
    primaryId = contextListingId;
  } else if (contextDevelopmentId) {
    primaryMatch = matches.find(m => m.metadata?.development_id === contextDevelopmentId);
    primaryId = contextDevelopmentId;
  }
  if (!primaryMatch) {
    // Fallback to highest score
    primaryMatch = matches.reduce((best, current) => (current.score > best.score ? current : best), matches[0]);
    primaryId = primaryMatch.metadata?.listing_id || primaryMatch.metadata?.development_id;
  }

  if (!primaryMatch || !primaryMatch.metadata) {
    return matches.map(m => pickText(m.metadata)).filter(Boolean).join('\n\n---\n\n');
  }

  const meta = primaryMatch.metadata;

  // Ficha Técnica (structured data)
  let structuredSummary = '### Imóvel Principal: Ficha Técnica\n';
  const excludeKeys = new Set(['client_id', 'generated_tags', 'chunk_text', 'content_type', 'has_description', 'id']);
  for (const [key, value] of Object.entries(meta)) {
    if (excludeKeys.has(key) || value === null || value === undefined || value === '') continue;
    let displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    let displayValue = value;
    if (key === 'price_eur' && typeof value === 'number') {
      displayValue = `€${value.toLocaleString('pt-PT')}`;
    } else if (key === 'duplex' && typeof value === 'boolean') {
      displayValue = value ? 'Sim' : 'Não';
    } else if (Array.isArray(value)) {
      displayValue = value.join(', ');
    } else if (typeof value === 'number' && key.includes('area')) {
      displayValue = `${value} m²`;
    }
    structuredSummary += `- **${displayKey}:** ${displayValue}\n`;
  }
  structuredSummary += '\n';

  // Descrição Adicional (unstructured text)
  const primaryChunks = matches.filter(m => (m.metadata?.listing_id === primaryId || m.metadata?.development_id === primaryId));
  const primaryTexts = primaryChunks.map(m => pickText(m.metadata)).filter(Boolean);
  if (primaryTexts.length > 0) {
    structuredSummary += '### Imóvel Principal: Descrição Adicional\n';
    structuredSummary += primaryTexts.join('\n\n') + '\n\n';
  }

  // Comparative context for other matches
  const otherMatches = matches.filter(m => m.metadata?.listing_id !== primaryId && m.metadata?.development_id !== primaryId);
  if (otherMatches.length > 0) {
    structuredSummary += '### Outros Imóveis Relevantes\n';
    const uniqueOthers = [];
    const seenIds = new Set();
    for (const m of otherMatches) {
      const id = m.metadata?.listing_id || m.metadata?.development_id;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        uniqueOthers.push(m);
      }
    }
    // For broad overview queries, show more listings to give comprehensive view
    const maxOtherListings = isBroadOverview ? 12 : 5;
    uniqueOthers.slice(0, maxOtherListings).forEach(m => {
      const mMeta = m.metadata;
      let summary = `- **ID:** ${mMeta.id || mMeta.listing_id || 'N/A'}`;
      if (mMeta.name) summary += `, **Nome:** ${mMeta.name}`;
      if (mMeta.type) summary += `, **Tipo:** ${mMeta.type}`;
      if (mMeta.beds) summary += `, **Quartos:** ${mMeta.beds}`;
      if (mMeta.price_eur) summary += `, **Preço:** €${Number(mMeta.price_eur).toLocaleString('pt-PT')}`;

      // For broad overview queries (like onboarding), include amenity information from generated_tags
      if (isBroadOverview && Array.isArray(mMeta.generated_tags) && mMeta.generated_tags.length > 0) {
        const amenityTags = mMeta.generated_tags
          .filter(tag => tag.startsWith('comodidade:'))
          .map(tag => tag.replace('comodidade:', ''))
          .join(', ');
        if (amenityTags) {
          summary += `, **Comodidades:** ${amenityTags}`;
        }
      }

      structuredSummary += summary + '\n';
    });
  }

  return structuredSummary;
}

export function truncateByTokenBudget(text, budget) {
  const tokens = encode(text);
  if (tokens.length <= budget) return { text, tokenCount: tokens.length };
  // naive cut by proportion
  const ratio = budget / tokens.length;
  const cut = Math.max(0, Math.floor(text.length * ratio) - 1);
  return { text: text.slice(0, cut), tokenCount: budget };
}

export function buildStructuredListingSummary(matches, queryFilters, isOnboarding = false) {
  if (!matches || matches.length === 0) {
    return null;
  }

  // DEBUG: Log metadata fields for first few matches to understand data structure
  if (isOnboarding && matches.length > 0) {
    console.log('[buildStructuredListingSummary] DEBUG: Analyzing metadata fields for onboarding');
    matches.slice(0, 2).forEach((match, index) => {
      const metadata = match.metadata || {};
      console.log(`[buildStructuredListingSummary] Match ${index + 1} metadata keys:`, Object.keys(metadata));
      console.log(`[buildStructuredListingSummary] Match ${index + 1} location fields:`, {
        address: metadata.address,
        location: metadata.location,
        neighborhood: metadata.neighborhood,
        zone: metadata.zone,
        city: metadata.city,
        bairro: metadata.bairro,
        localizacao: metadata.localizacao
      });
      console.log(`[buildStructuredListingSummary] Match ${index + 1} generated_tags:`, metadata.generated_tags);
    });
  }

  const listingsMap = new Map();
  // Extract the first feature tag for context. A more robust solution might handle multiple tags.
  const requestedFeature = queryFilters?.generated_tags?.$all[0] || 'Unknown Feature';

  for (const match of matches) {
    const metadata = match.metadata;
    const listingId = metadata?.listing_id;

    if (listingId && !listingsMap.has(listingId)) {
      const listing = {
        id: listingId,
        name: metadata.name || metadata.listing_id || 'Nome não disponível',
        type: metadata.type || metadata.typology || 'Tipo não disponível',
        beds: metadata.beds || metadata.num_bedrooms || 'N/A',
        baths: metadata.baths || metadata.num_bathrooms || 'N/A',
        price_eur: metadata.price_eur || metadata.price || 'Preço não disponível',
        area_sqm: metadata.total_area_sqm || metadata.area_sqm || metadata.gross_area_sqm,
        location: metadata.location || metadata.neighborhood || metadata.zone ||
                 metadata.address || metadata.city || metadata.bairro ||
                 metadata.localizacao || 'Não especificada',
        features: [],
        description: metadata.description || '',
        hasFeature: true // Since filtering ensures the feature is present
      };

      // Extract amenities from generated_tags for richer context
      if (Array.isArray(metadata.generated_tags)) {
        const amenities = metadata.generated_tags
          .filter(tag => tag.startsWith('comodidade:'))
          .map(tag => tag.replace('comodidade:', ''))
          .slice(0, 6); // Top 6 amenities
        listing.features = amenities;
      }

      listingsMap.set(listingId, listing);
    }
  }

  if (listingsMap.size === 0) {
    return null;
  }

  // Enhanced summary with rich details for onboarding
  if (isOnboarding) {
    let summary = `Encontramos ${listingsMap.size} imóvel(is) que correspondem às suas preferências:\n\n`;

    for (const listing of Array.from(listingsMap.values())) {
      summary += `**${listing.name}**\n`;
      summary += `• Tipo: ${listing.type}\n`;
      summary += `• Quartos: ${listing.beds}`;
      if (listing.baths && listing.baths !== 'N/A') summary += ` | Casas de banho: ${listing.baths}`;
      if (listing.area_sqm) summary += ` | Área: ${listing.area_sqm}m²`;
      summary += `\n`;
      summary += `• Preço: €${typeof listing.price_eur === 'number' ? listing.price_eur.toLocaleString('pt-PT') : listing.price_eur}\n`;
      if (listing.location) summary += `• Localização: ${listing.location}\n`;
      if (listing.features && listing.features.length > 0) {
        summary += `• Comodidades: ${listing.features.join(', ')}\n`;
      }
      if (listing.description && listing.description.length > 50) {
        const shortDesc = listing.description.substring(0, 150) + '...';
        summary += `• Descrição: ${shortDesc}\n`;
      }
      summary += `\n`;
    }

    return summary;
  }

  // Original format for non-onboarding queries
  let summary = `Característica solicitada: ${requestedFeature.replace(/comodidade:|feature:/, '')}\n\n`;
  summary += 'Imóveis correspondentes:\n';
  for (const listing of Array.from(listingsMap.values())) {
    summary += `- Nome: ${listing.name}, Tipo: ${listing.type}, Quartos: ${listing.beds}, Preço: ${listing.price_eur}\n`;
  }

  return summary;
}

