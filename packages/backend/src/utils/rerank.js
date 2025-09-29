// packages/backend/src/utils/rerank.js
// Utility for re-ranking vector search results based on query relevance and filters.
// To improve search result quality by applying heuristic scoring and filtering.
// Relevant files: rag-service.js
// Heuristic re-ranking with a simple scoring function and pluggable interface

import { QUERY_SCOPE } from './rag-parsing.js';

export function reRankMatches({
  matches,
  contextListingId,
  contextDevelopmentId,
  originalQuery,
  queryFilters,
  queryScope,
  topN = 20,
  targetedMatches = [],
}) {
  if (!Array.isArray(matches) || matches.length === 0) return { rankedMatches: [], contextualMatchStatus: 'NOT_APPLICABLE' };

  let contextualMatchStatus = 'NOT_APPLICABLE';
  const hasFeatureQueryWithContext = contextListingId && queryFilters?.generated_tags;

  if (hasFeatureQueryWithContext) {
    const filterTags = queryFilters.generated_tags?.$all || [];
    const contextualListingHasMatchingFeature = matches.some(m =>
      m.metadata?.listing_id === contextListingId &&
      Array.isArray(m.metadata?.generated_tags) &&
      filterTags.every(tag => m.metadata.generated_tags.some(metaTag => metaTag.includes(tag)))
    );

    if (contextualListingHasMatchingFeature) {
      contextualMatchStatus = 'MATCH_IN_CONTEXT';
    } else {
      contextualMatchStatus = 'NO_MATCH_IN_CONTEXT';
    }
  }

  const qLower = String(originalQuery || '').toLowerCase();
  const isLookingForT1 = qLower.includes('t1') || qLower.includes('1 quarto');
  const isLookingForT2 = qLower.includes('t2') || qLower.includes('2 quartos');
  const isLookingForStudio = qLower.includes('estúdio') || qLower.includes('studio');

  const debugBoostLogs = [];
  let reRanked = matches.map((match, idx) => {
    let score = match.score;
    const meta = match.metadata || {};

    // Initialize filterMatchCount
    let filterMatchCount = 0; // re-applied fix

    // Dynamic boosting for contextListingId based on queryScope
    if (contextListingId && meta.listing_id === contextListingId) {
      if (queryScope === QUERY_SCOPE.LISTING_SPECIFIC) {
        // Strong boost for listing-specific queries
        score += 1.0;
      } else if (queryScope === QUERY_SCOPE.GENERAL_FILTERED) {
        // Moderate boost for general filtered queries, only if the contextual listing matches the filters
        const filterTags = queryFilters.generated_tags?.$all || [];
        const hasMatchingTags = Array.isArray(meta.generated_tags) && filterTags.every(tag => meta.generated_tags.some(metaTag => metaTag.includes(tag)));
        if (hasMatchingTags) {
          score += 0.2;
        }
        // No boost if the contextual listing doesn't match the general filters
      } else if (queryScope === QUERY_SCOPE.GENERAL_UNFILTERED) {
        // No boost for general unfiltered queries
        score += 0.0;
      }
    }

    if (contextDevelopmentId && meta.development_id === contextDevelopmentId) score += 0.8;

    const queryListingId = queryFilters?.listing_id || null;
    if (queryListingId && meta.listing_id === queryListingId) score += 1.5;

    if (queryFilters && Object.keys(queryFilters).length > 0) {
      for (const key in queryFilters) {
        if (key === 'total_area_sqm' || key === 'price_eur' || key === 'num_bedrooms') {
          // Map filter keys to metadata field names
          const metaKey = key === 'num_bedrooms' ? 'beds' :
                         key === 'total_area_sqm' ? 'total_area' :
                         key === 'price_eur' ? 'price' : key;
          const filter = queryFilters[key];
          if (filter?.$lt != null && meta[metaKey] < filter.$lt) filterMatchCount++;
          else if (filter?.$gt != null && meta[metaKey] > filter.$gt) filterMatchCount++;
          else if (meta[metaKey] === filter) filterMatchCount++;
        } else if (key === 'typology') {
          if (meta.typology === queryFilters.typology || meta.type === queryFilters.typology) filterMatchCount++;
        } else if (key === 'generated_tags') {
          // Handle dynamic tag filtering
          const filterTags = queryFilters[key]?.$all || [];
          console.log(`[rerank] DEBUG: Checking generated_tags filter: ${JSON.stringify(filterTags)}`);
          console.log(`[rerank] DEBUG: Chunk metadata generated_tags: ${JSON.stringify(meta.generated_tags)}`);
          if (Array.isArray(meta.generated_tags) && filterTags.every(tag => meta.generated_tags.some(metaTag => metaTag.includes(tag)))) {
            filterMatchCount++;
            console.log(`[rerank] DEBUG: generated_tags filter matched for chunk ${meta.listing_id || meta.development_id || match.id}`);
          } else {
            console.log(`[rerank] DEBUG: generated_tags filter did NOT match for chunk ${meta.listing_id || meta.development_id || match.id} - EXCLUDING from results`);
            // HARD FILTER: Return null to exclude this match entirely
            return null;
          }
        } else if (meta[key] === queryFilters[key]) {
          filterMatchCount++;
        }
      }
      score += (filterMatchCount * 0.2);
      if (filterMatchCount > 0 && idx < 8) {
        debugBoostLogs.push({ id: meta?.listing_id || meta?.development_id || match.id, filterMatches: filterMatchCount });
      }
    }

    const text = (meta.text || meta.chunk || meta.content || meta.body || meta.page_text || '').toString().toLowerCase();
    if (text) {
      if (isLookingForT1 && (text.includes(' t1 ') || text.includes(' tipologia t1') || text.includes(' 1 quarto') || text.includes(' t1,') || text.includes(' t1.'))) {
        score += 0.3;
        if (idx < 8) debugBoostLogs.push({ id: meta.listing_id || meta.development_id || match.id, hint: 'T1' });
      }
      if (isLookingForT2 && (text.includes(' t2 ') || text.includes(' tipologia t2') || text.includes(' 2 quartos') || text.includes(' t2,') || text.includes(' t2.'))) {
        score += 0.3;
        if (idx < 8) debugBoostLogs.push({ id: meta.listing_id || meta.development_id || match.id, hint: 'T2' });
      }
      if (isLookingForStudio && (text.includes(' estúdio') || text.includes(' studio'))) {
        score += 0.2;
        if (idx < 8) debugBoostLogs.push({ id: meta.listing_id || meta.development_id || match.id, hint: 'studio' });
      }

      // Intent-based boosting for specific numerical measurements
      if (queryFilters?.intent_query_bedroom_area && (text.includes('quarto') || text.includes('dormitório')) && (text.includes('m²') || text.includes('metros') || text.includes('área'))) {
        score += 2.0;
        if (idx < 8) debugBoostLogs.push({ id: meta.listing_id || meta.development_id || match.id, hint: 'bedroom_area' });
      }
      if (queryFilters?.intent_query_terrace_area && (text.includes('terraço') || text.includes('terraco')) && (text.includes('m²') || text.includes('metros') || text.includes('área'))) {
        score += 2.0;
        if (idx < 8) debugBoostLogs.push({ id: meta.listing_id || meta.development_id || match.id, hint: 'terrace_area' });
      }
      if (queryFilters?.intent_query_bathroom_area && (text.includes('casa de banho') || text.includes('banheiro')) && (text.includes('m²') || text.includes('metros') || text.includes('área'))) {
        score += 2.0;
        if (idx < 8) debugBoostLogs.push({ id: meta.listing_id || meta.development_id || match.id, hint: 'bathroom_area' });
      }
      if (queryFilters?.intent_query_living_kitchen_area && (text.includes('sala') || text.includes('cozinha')) && (text.includes('m²') || text.includes('metros') || text.includes('área'))) {
        score += 2.0;
        if (idx < 8) debugBoostLogs.push({ id: meta.listing_id || meta.development_id || match.id, hint: 'living_kitchen_area' });
      }
    }

    return { ...match, score, filterMatchCount };
  });

  // Filter out null results (excluded by hard filters)
  reRanked = reRanked.filter(match => match !== null);

  // Apply contextual filtering based on match status
  if (contextualMatchStatus === 'MATCH_IN_CONTEXT') {
    // If the contextual listing has the feature, filter to ONLY that listing
    reRanked = reRanked.filter(m => m.metadata?.listing_id === contextListingId);
    console.log(`[rerank] DEBUG: Contextual listing ${contextListingId} has the queried feature. Filtered to only this listing.`);
  } else if (contextualMatchStatus === 'NO_MATCH_IN_CONTEXT') {
    // If the contextual listing does NOT have the feature, allow other listings to be returned
    console.log(`[rerank] DEBUG: Contextual listing ${contextListingId} does not have the queried feature. Allowing other listings.`);
  }

  // Post-processing for GENERAL_FILTERED queries to ensure diversity of listings
  if (queryScope === QUERY_SCOPE.GENERAL_FILTERED && contextListingId) {
    const contextualMatches = reRanked.filter(m => m.metadata?.listing_id === contextListingId && m.filterMatchCount > 0);
    const otherMatches = reRanked.filter(m => m.metadata?.listing_id !== contextListingId && m.filterMatchCount > 0);

    let finalRanked = [];
    if (contextualMatches.length > 0) {
      // Take the top 1-2 best contextual matches that satisfy the filters
      contextualMatches.sort((a, b) => b.score - a.score);
      finalRanked.push(...contextualMatches.slice(0, 2)); // Take top 2 contextual matches
    }

    // Add other matching listings, ensuring diversity
    // Sort other matches by score and add them
    otherMatches.sort((a, b) => b.score - a.score);
    finalRanked.push(...otherMatches);

    // Remove duplicates by ID, keeping the higher score if duplicates exist
    const uniqueMatches = new Map();
    for (const match of finalRanked) {
      const id = match.metadata?.listing_id || match.metadata?.development_id || match.id;
      if (!uniqueMatches.has(id) || uniqueMatches.get(id).score < match.score) {
        uniqueMatches.set(id, match);
      }
    }
    reRanked = Array.from(uniqueMatches.values());
  }

  const ranked = reRanked.sort((a, b) => b.score - a.score).slice(0, topN);
  try {
    const preview = ranked.slice(0, 5).map(m => ({
      id: m.metadata?.listing_id || m.metadata?.development_id || m.id,
      score: Number(m.score?.toFixed?.(6) || m.score),
      typology: m.metadata?.typology || m.metadata?.type || null,
      docCategory: m.metadata?.document_category,
      hasText: Boolean(m.metadata?.text || m.metadata?.chunk || m.metadata?.content || m.metadata?.body || m.metadata?.page_text),
    }));
    console.log('📊 Top results after re-ranking:', JSON.stringify(preview, null, 2));
    console.log('🔎 Re-ranking debug (top up to 8 shown):', JSON.stringify(debugBoostLogs, null, 2));
  } catch (_) {}

  return {
    rankedMatches: ranked,
    contextualMatchStatus,
  };
}


