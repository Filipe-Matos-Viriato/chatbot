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
  userPreferences = null,
  isOnboardingRecommendation = false,
}) {
  if (!Array.isArray(matches) || matches.length === 0) return { rankedMatches: [], contextualMatchStatus: 'NOT_APPLICABLE' };

  // Filter out non-listing results (visitor profiles, chat history, etc.)
  // Only keep results that are actual property listings
  const listingMatches = matches.filter(match => {
    const meta = match.metadata || {};
    const matchId = meta.listing_id || meta.development_id || match.id || '';

    // Exclude visitor profiles (IDs starting with "visitor_profile_")
    if (matchId.startsWith('visitor_profile_')) {
      return false;
    }

    // Exclude results without proper listing metadata
    // Must have either listing_id or development_id to be considered a valid listing
    if (!meta.listing_id && !meta.development_id) {
      return false;
    }

    // Additional validation: exclude results that look like chat history or user data
    if (meta.visitor_id || meta.session_id || meta.user_id) {
      return false;
    }

    return true;
  });

  console.log(`[rerank] Filtered out ${matches.length - listingMatches.length} non-listing results, keeping ${listingMatches.length} actual listings`);

  // Use filtered matches for the rest of the reranking logic
  matches = listingMatches;

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
          const value = meta[metaKey];

          // Handle range filters like { gte: 200000, lte: 300000 }
          if (typeof filter === 'object' && filter !== null) {
            let matchesRange = true;
            if (filter.gte != null && value < filter.gte) matchesRange = false;
            if (filter.lte != null && value > filter.lte) matchesRange = false;
            if (matchesRange) filterMatchCount++;
          }
          // Handle legacy MongoDB-style operators
          else if (filter?.$lt != null && value < filter.$lt) filterMatchCount++;
          else if (filter?.$gt != null && value > filter.$gt) filterMatchCount++;
          // Handle exact matches
          else if (value === filter) filterMatchCount++;
        } else if (key === 'typology') {
          // Handle typology filtering (T1, T2, T3, etc.) by mapping to bedroom count
          const typologyValue = queryFilters.typology;
          if (typologyValue && typologyValue.match(/^T\d+$/i)) {
            const bedroomCount = parseInt(typologyValue.substring(1), 10);
            if (meta.beds === bedroomCount) filterMatchCount++;
          } else {
            // Fallback to direct string match if not in T\d+ format
            if (meta.typology === typologyValue || meta.type === typologyValue) filterMatchCount++;
          }
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
    // If the contextual listing does NOT have the feature, filter alternatives by user preferences
    console.log(`[rerank] DEBUG: Contextual listing ${contextListingId} does not have the queried feature. Filtering alternatives by user preferences.`);

    // Filter out the contextual listing and apply user preference filters
    reRanked = reRanked.filter(m => {
      const meta = m.metadata || {};

      // Exclude the contextual listing
      if (meta.listing_id === contextListingId) return false;

      // Apply user preference filters if available
      if (userPreferences) {
        // Filter by typology
        if (userPreferences.typology) {
          const userTypology = userPreferences.typology;
          if (userTypology.match(/^T\d+$/i)) {
            const bedroomCount = parseInt(userTypology.substring(1), 10);
            if (meta.beds !== bedroomCount) return false;
          }
        }

        // Filter by budget range
        if (userPreferences.budget) {
          const listingPrice = meta.price;
          if (listingPrice && listingPrice > userPreferences.budget) {
            return false; // Price too high
          }
        }
      }

      return true;
    });

    console.log(`[rerank] DEBUG: After user preference filtering, ${reRanked.length} alternative listings remain.`);
  }

  // Post-processing for GENERAL_FILTERED queries to ensure diversity of listings
  if (queryScope === QUERY_SCOPE.GENERAL_FILTERED) {
    // Determine if this is an explicit typology query that should be strict
    const hasExplicitTypologyFilter = queryFilters.typology && queryFilters.typology.match(/^T\d+$/i);
    const isExplicitTypologyQuery = hasExplicitTypologyFilter && (
      qLower.includes('t1') || qLower.includes('t2') || qLower.includes('t3') ||
      qLower.includes('apartamentos t') || qLower.includes('todos os t') ||
      qLower.includes(' t1') || qLower.includes(' t2') || qLower.includes(' t3')
    );

    if (contextListingId) {
      if (isExplicitTypologyQuery) {
        // STRICT filtering for explicit typology queries in contextual mode - only exact matches
        console.log(`[rerank] Applying strict filtering for explicit typology query in contextual mode: ${queryFilters.typology}`);
        const beforeCount = reRanked.length;
        reRanked = reRanked.filter(m => m.filterMatchCount > 0);
        const afterCount = reRanked.length;
        console.log(`[rerank] Filtered from ${beforeCount} to ${afterCount} listings (strict filtering for explicit typology in contextual mode)`);
      } else {
        // Existing logic for contextual queries (with specific listing context)
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
    } else {
      // For non-contextual GENERAL_FILTERED queries
      if (isOnboardingRecommendation) {
        // FLEXIBLE filtering for onboarding recommendations - strict typology, flexible price
        console.log(`[rerank] 🎯 ONBOARDING DEBUG - Applying flexible filter-based filtering for onboarding recommendations`);
        console.log(`[rerank] 🎯 ONBOARDING DEBUG - Initial matches before filtering: ${reRanked.length}`);
        console.log(`[rerank] 🎯 ONBOARDING DEBUG - Query filters:`, JSON.stringify(queryFilters, null, 2));

        // Log details of available listings before filtering
        console.log(`[rerank] 🎯 ONBOARDING DEBUG - Available listings before filtering:`);
        reRanked.slice(0, 10).forEach((m, idx) => {
          const meta = m.metadata || {};
          const listingId = meta.listing_id || meta.development_id || m.id;
          console.log(`[rerank] 🎯 ONBOARDING DEBUG - Listing ${idx + 1}: ID=${listingId}, beds=${meta.beds}, price=${meta.price}€, typology=${meta.typology}, filterMatchCount=${m.filterMatchCount}`);
          console.log(`[rerank] 🎯 ONBOARDING DEBUG - Full metadata for listing ${idx + 1}:`, JSON.stringify(meta, null, 2));
        });

        const beforeCount = reRanked.length;

        reRanked = reRanked.filter(m => {
          const meta = m.metadata || {};
          const listingId = meta.listing_id || meta.development_id || m.id;

          // For onboarding, use a two-tier approach:
          // Tier 1: Listings that pass ALL filters (strict matching) - these were working before
          if (m.filterMatchCount > 0) {
            console.log(`[rerank] 🎯 ONBOARDING DEBUG - Listing ${listingId} PASSED strict filtering (filterMatchCount: ${m.filterMatchCount})`);
            return true;
          }

          // Tier 2: Additional listings that are close matches but didn't pass all filters
          // This adds flexibility for onboarding while preserving the working strict matches

          // Check if this listing matches typology (primary requirement for onboarding)
          let hasTypologyMatch = false;
          if (queryFilters.typology && queryFilters.typology.match(/^T\d+$/i)) {
            const expectedBeds = parseInt(queryFilters.typology.substring(1), 10);
            // Use the same typology checking logic as the main filtering
            if (meta.beds === expectedBeds) {
              hasTypologyMatch = true;
              console.log(`[rerank] 🎯 ONBOARDING DEBUG - Listing ${listingId} has typology match (beds: ${meta.beds}, expected: ${expectedBeds})`);
            } else if (meta.typology === queryFilters.typology || meta.type === queryFilters.typology) {
              hasTypologyMatch = true;
              console.log(`[rerank] 🎯 ONBOARDING DEBUG - Listing ${listingId} has typology match (typology: ${meta.typology}, expected: ${queryFilters.typology})`);
            } else {
              console.log(`[rerank] 🎯 ONBOARDING DEBUG - Listing ${listingId} FAILED typology check (beds: ${meta.beds}, typology: ${meta.typology}, expected: ${queryFilters.typology})`);
            }
          }

          if (!hasTypologyMatch) {
            console.log(`[rerank] 🎯 ONBOARDING DEBUG - Listing ${listingId} EXCLUDED: no typology match`);
            return false;
          }

          // For price ranges, be flexible - allow listings reasonably close to user budget
          if (queryFilters.price_eur && typeof queryFilters.price_eur === 'object') {
            const listingPrice = meta.price;
            if (listingPrice) {
              const { gte, lte } = queryFilters.price_eur;
              const range = lte - gte;
              const tolerance = Math.max(range * 0.5, 50000); // 50% of range or €50k minimum

              // Allow listings within an expanded range around user preferences
              const expandedMin = Math.max(0, gte - tolerance);
              const expandedMax = lte + tolerance;

              if (listingPrice < expandedMin || listingPrice > expandedMax) {
                console.log(`[rerank] 🎯 ONBOARDING DEBUG - Listing ${listingId} EXCLUDED: price ${listingPrice}€ outside expanded range [${expandedMin}€-${expandedMax}€] (original: [${gte}€-${lte}€])`);
                return false;
              } else {
                console.log(`[rerank] 🎯 ONBOARDING DEBUG - Listing ${listingId} PASSED price check (${listingPrice}€ in expanded range [${expandedMin}€-${expandedMax}€])`);
              }
            } else {
              console.log(`[rerank] 🎯 ONBOARDING DEBUG - Listing ${listingId} has no price data, allowing through`);
            }
          }

          // For other filters like buying_timeframe, be flexible for onboarding
          // Don't exclude listings just because they don't match timeframe

          console.log(`[rerank] 🎯 ONBOARDING DEBUG - Listing ${listingId} PASSED flexible filtering`);
          return true;
        });

        const afterCount = reRanked.length;
        console.log(`[rerank] Filtered from ${beforeCount} to ${afterCount} listings (flexible filtering for onboarding)`);
      } else if (isExplicitTypologyQuery) {
        // STRICT filtering for explicit typology queries - only exact matches
        console.log(`[rerank] Applying strict filtering for explicit typology query: ${queryFilters.typology}`);
        const beforeCount = reRanked.length;
        reRanked = reRanked.filter(m => m.filterMatchCount > 0);
        const afterCount = reRanked.length;
        console.log(`[rerank] Filtered from ${beforeCount} to ${afterCount} listings (strict filtering for explicit typology)`);
      } else {
        // LENIENT filtering for feature queries - show close alternatives
        console.log(`[rerank] Applying lenient filter-based filtering for feature queries`);
        const beforeCount = reRanked.length;

        reRanked = reRanked.filter(m => {
          const meta = m.metadata || {};

          // Always include listings that match at least one filter
          if (m.filterMatchCount > 0) return true;

          // For listings that don't match filters, include them if they're reasonably close
          // to user preferences (for feature queries like "tem terraço?")
          if (userPreferences) {
            let isReasonablyClose = false;

            // Check typology - allow adjacent typologies only for non-explicit queries
            if (userPreferences.typology && userPreferences.typology.match(/^T\d+$/i) && !hasExplicitTypologyFilter) {
              const userBedrooms = parseInt(userPreferences.typology.substring(1), 10);
              const listingBedrooms = meta.beds;
              if (listingBedrooms && Math.abs(listingBedrooms - userBedrooms) <= 1) {
                isReasonablyClose = true;
              }
            }

            // Check budget - allow listings within 20% of the range
            if (userPreferences.budget && !isReasonablyClose) {
              const listingPrice = meta.price;
              if (listingPrice) {
                const tolerance = userPreferences.budget * 0.2; // 20% tolerance
                if (Math.abs(listingPrice - userPreferences.budget) <= tolerance) {
                  isReasonablyClose = true;
                }
              }
            }

            if (isReasonablyClose) return true;
          }

          // If no user preferences or listing doesn't match/close, exclude it
          return false;
        });

        const afterCount = reRanked.length;
        console.log(`[rerank] Filtered from ${beforeCount} to ${afterCount} listings (lenient filtering for feature queries)`);
      }
    }
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


