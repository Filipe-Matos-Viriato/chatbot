// packages/backend/src/utils/rag-parsing.js
// Utility functions for parsing queries and extracting filters for RAG system.
// To extract listing IDs, query filters, and detect aggregative queries for better retrieval.
// Relevant files: rag-service.js
// Shared parsing utilities for the RAG system

// Query scope constants
export const QUERY_SCOPE = {
  LISTING_SPECIFIC: 'LISTING_SPECIFIC',
  GENERAL_FILTERED: 'GENERAL_FILTERED',
  GENERAL_UNFILTERED: 'GENERAL_UNFILTERED'
};

/**
 * Extracts a listing ID from a URL. Supports numeric ids and patterns like ap-<digits>.
 */
export function extractListingIdFromUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    const path = u.pathname || '';
    const segments = path.split('/').filter(Boolean);
    for (let i = segments.length - 1; i >= 0; i--) {
      const seg = segments[i];
      const m = seg.match(/^ap-\d+$/i) || seg.match(/^(\d{3,})$/);
      if (m) return m[0];
    }
    const qId = u.searchParams.get('id');
    if (qId && /^(ap-\d+|\d{3,})$/i.test(qId)) return qId;
    const hashMatch = (u.hash || '').match(/(ap-\d+|\d{3,})/i);
    if (hashMatch) return hashMatch[1];
  } catch (_) {
    const match = (String(url)).match(/(?:\/)(ap-\d+|\d{3,})(?:[\/#?]|$)/i);
    if (match) return match[1];
  }
  return null;
}

/**
 * Extracts UpInvestments-style or legacy listing ids from free-text query.
 * Examples: "T2 E Bloco 1" => block_1_apt_E
 */
export function extractListingIdFromQuery(query) {
  if (!query) return null;
  const lower = String(query).toLowerCase();

  const legacyMatch = lower.match(/ap-\d+/);
  if (legacyMatch) return legacyMatch[0];

  const blockMatch = lower.match(/bloco\s*(\d+)/i);
  const blockNum = blockMatch ? blockMatch[1] : null;

  let fractionMatch = lower.match(/fraç(?:ão|ao)\s*([a-h])/i);
  if (!fractionMatch) fractionMatch = lower.match(/\bt\s*\d\s*([a-h])\b/i);
  if (!fractionMatch && blockNum) fractionMatch = lower.match(/\b([a-h])\b(?=.*\bbloco\s*\d+)/i);

  const fractionLetter = fractionMatch ? fractionMatch[1] : null;
  if (blockNum && fractionLetter) {
    return `block_${blockNum}_apt_${fractionLetter.toUpperCase()}`;
  }
  return null;
}

/**
 * Detects aggregative price queries (min/max price).
 */
export function isAggregativePriceQuery(query) {
  const lower = String(query || '').toLowerCase();
  return (
    lower.includes('mais barato') ||
    lower.includes('preço mais baixo') ||
    lower.includes('preço mínimo') ||
    lower.includes('mais caro') ||
    lower.includes('preço mais alto') ||
    lower.includes('preço máximo')
  );
}

/**
 * Extracts soft filters from a user query for heuristic re-ranking.
 */
export function extractQueryFilters(query, currentListingPrice = null, clientConfig = null) {
  const filters = {};
  const lowerCaseQuery = String(query || '').toLowerCase();

  const naturalListingId = extractListingIdFromQuery(query);
  if (naturalListingId) filters.listing_id = naturalListingId;

  const apartmentMatch = lowerCaseQuery.match(/apartamento\s+([a-z])\s+no\s+bloco\s+(\d+)/);
  if (apartmentMatch) {
    filters.listing_id = `block_${apartmentMatch[2]}_apt_${apartmentMatch[1].toUpperCase()}`;
  }

  const typologyMatch = lowerCaseQuery.match(/\b(t\d)\b/i);
  if (typologyMatch) filters.typology = typologyMatch[1].toUpperCase();

  let match = lowerCaseQuery.match(/(\d+)\s*quartos/);
  if (match) {
    const num = parseInt(match[1], 10); if (!isNaN(num)) filters.num_bedrooms = num;
  }
  match = lowerCaseQuery.match(/mais de\s*(\d+)\s*quartos/);
  if (match) { const num = parseInt(match[1], 10); if (!isNaN(num)) filters.num_bedrooms = { "$gt": num }; }
  match = lowerCaseQuery.match(/menos de\s*(\d+)\s*quartos/);
  if (match) { const num = parseInt(match[1], 10); if (!isNaN(num)) filters.num_bedrooms = { "$lt": num }; }

  match = lowerCaseQuery.match(/(\d+)\s*casas de banho/);
  if (match) { const num = parseInt(match[1], 10); if (!isNaN(num)) filters.num_bathrooms = num; }

  match = lowerCaseQuery.match(/menos de\s*([\d.,]+)\s*m²/);
  if (match) { const area = parseFloat(match[1].replace(',', '.')); if (!isNaN(area)) filters.total_area_sqm = { "$lt": area }; }

  match = lowerCaseQuery.match(/menos de\s*([\d.,]+)€/);
  if (match) { const price = parseFloat(match[1].replace(/\./g, '').replace(',', '.')); if (!isNaN(price)) filters.price_eur = { "$lt": price }; }

  if (currentListingPrice) {
    if (lowerCaseQuery.includes('mais baixo') || lowerCaseQuery.includes('mais barato')) filters.price_eur = { "$lt": currentListingPrice };
    else if (lowerCaseQuery.includes('mais alto') || lowerCaseQuery.includes('mais caro')) filters.price_eur = { "$gt": currentListingPrice };
  }

  // Intent detection for specific numerical measurements
  if ((lowerCaseQuery.includes('tamanho do quarto') || lowerCaseQuery.includes('área do quarto') ||
      lowerCaseQuery.includes('metros quadrados do quarto') || lowerCaseQuery.includes('dimensões do quarto')) &&
      !lowerCaseQuery.includes('quarto de banho')) {
    filters.intent_query_bedroom_area = true;
  }
  if (lowerCaseQuery.includes('área do terraço') || lowerCaseQuery.includes('metros quadrados do terraço') ||
      lowerCaseQuery.includes('tamanho do terraço') || lowerCaseQuery.includes('dimensões do terraço')) {
    filters.intent_query_terrace_area = true;
  }
  if (lowerCaseQuery.includes('tamanho da casa de banho') || lowerCaseQuery.includes('área da casa de banho') ||
      lowerCaseQuery.includes('metros quadrados da casa de banho') || lowerCaseQuery.includes('dimensões da casa de banho') ||
      lowerCaseQuery.includes('tamanho do quarto de banho') || lowerCaseQuery.includes('área do quarto de banho') ||
      lowerCaseQuery.includes('metros quadrados do quarto de banho') || lowerCaseQuery.includes('dimensões do quarto de banho')) {
    filters.intent_query_bathroom_area = true;
  }
  if (lowerCaseQuery.includes('dimensões da sala') || lowerCaseQuery.includes('área da sala') ||
      lowerCaseQuery.includes('metros quadrados da sala') || lowerCaseQuery.includes('tamanho da sala')) {
    filters.intent_query_living_kitchen_area = true;
  }

  // Dynamic feature filtering using client-specific tagging_rules
  if (clientConfig && clientConfig.tagging_rules) {
    const taggingRules = clientConfig.tagging_rules;
    const matchedTags = [];

    console.log(`[rag-parsing] DEBUG: Checking tagging_rules for query: "${lowerCaseQuery}"`);
    console.log(`[rag-parsing] DEBUG: Available tagging_rules keys: ${Object.keys(taggingRules)}`);

    for (const [tagPattern, keywords] of Object.entries(taggingRules)) {
      if (Array.isArray(keywords) && keywords.some(keyword => lowerCaseQuery.includes(keyword.toLowerCase()))) {
        matchedTags.push(tagPattern);
        console.log(`[rag-parsing] DEBUG: Matched tagPattern "${tagPattern}"`);
      }
    }

    if (matchedTags.length > 0) {
      filters.generated_tags = { "$all": matchedTags };
      console.log(`[rag-parsing] DEBUG: Set filters.generated_tags to: ${JSON.stringify(filters.generated_tags)}`);
    } else {
      console.log(`[rag-parsing] DEBUG: No matched tags found in tagging_rules`);
    }
  } else {
    console.log(`[rag-parsing] DEBUG: No clientConfig.tagging_rules available`);
  }
  // No fallback to hardcoded features - system relies entirely on dynamic configuration

  return filters;
}


