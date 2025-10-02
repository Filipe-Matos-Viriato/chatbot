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
export function extractQueryFilters(query, currentListingPrice = null, clientConfig = null, userPreferences = null) {
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

  // Handle written numbers for bedrooms
  const writtenNumbers = { 'um': 1, 'uma': 1, 'dois': 2, 'duas': 2, 'três': 3, 'quatro': 4, 'cinco': 5 };
  for (const [word, num] of Object.entries(writtenNumbers)) {
    if (lowerCaseQuery.includes(word + ' quartos') || lowerCaseQuery.includes(word + ' quarto')) {
      filters.num_bedrooms = num;
      break;
    }
  }

  match = lowerCaseQuery.match(/(\d+)\s*(casas de banho|wc|banheiro|quarto de banho)/);
  if (match) { const num = parseInt(match[1], 10); if (!isNaN(num)) filters.num_bathrooms = num; }

  match = lowerCaseQuery.match(/menos de\s*([\d.,]+)\s*m²/);
  if (match) { const area = parseFloat(match[1].replace(',', '.')); if (!isNaN(area)) filters.total_area_sqm = { "$lt": area }; }

  match = lowerCaseQuery.match(/menos de\s*([\d.,]+)€/);
  if (match) { const price = parseFloat(match[1].replace(/\./g, '').replace(',', '.')); if (!isNaN(price)) filters.price_eur = { "$lt": price }; }

  if (currentListingPrice) {
    if (lowerCaseQuery.includes('mais baixo') || lowerCaseQuery.includes('mais barato')) filters.price_eur = { "$lt": currentListingPrice };
    else if (lowerCaseQuery.includes('mais alto') || lowerCaseQuery.includes('mais caro')) filters.price_eur = { "$gt": currentListingPrice };
  }


  // Dynamic feature and intent filtering using client-specific tagging_rules
  if (clientConfig && clientConfig.tagging_rules) {
    const taggingRules = clientConfig.tagging_rules;
    const matchedTags = [];
    const intents = [];

    console.log(`[rag-parsing] DEBUG: Checking tagging_rules for query: "${lowerCaseQuery}"`);
    console.log(`[rag-parsing] DEBUG: Available tagging_rules keys: ${Object.keys(taggingRules)}`);

    for (const [key, value] of Object.entries(taggingRules)) {
      if (Array.isArray(value)) {
        // Feature: Check if any keywords match the query using word boundaries
        if (value.some(keyword => new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(lowerCaseQuery))) {
          matchedTags.push(key);
          console.log(`[rag-parsing] DEBUG: Matched feature tag "${key}"`);
        }
      } else if (typeof value === 'object' && value.keywords && value.prompt_instruction) {
        // Intent: Check if any keywords match the query using word boundaries
        if (value.keywords.some(keyword => new RegExp('\\b' + keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b', 'i').test(lowerCaseQuery))) {
          intents.push(value.prompt_instruction);
          console.log(`[rag-parsing] DEBUG: Matched intent "${key}"`);
        }
      }
    }

    if (matchedTags.length > 0) {
      filters.generated_tags = { "$all": matchedTags.map(tag => tag.replace(/_/g, ' ')) };
      console.log(`[rag-parsing] DEBUG: Set filters.generated_tags to: ${JSON.stringify(filters.generated_tags)}`);
    } else {
      console.log(`[rag-parsing] DEBUG: No matched feature tags found in tagging_rules`);
    }

    if (intents.length > 0) {
      filters.intents = intents;
      console.log(`[rag-parsing] DEBUG: Set filters.intents to: ${JSON.stringify(filters.intents)}`);
    } else {
      console.log(`[rag-parsing] DEBUG: No matched intents found in tagging_rules`);
    }
  } else {
    console.log(`[rag-parsing] DEBUG: No clientConfig.tagging_rules available`);
  }

  // Detect if user wants a complete list
  filters.wantsAll = lowerCaseQuery.includes('todos') || lowerCaseQuery.includes('all') || lowerCaseQuery.includes('completa') || lowerCaseQuery.includes('complete') || lowerCaseQuery.includes('lista completa');

  // Detect deictic references (these, those, this, that, etc.) for smart context resolution
  filters.hasDeicticReference = (
    lowerCaseQuery.includes('estes') ||
    lowerCaseQuery.includes('estas') ||
    lowerCaseQuery.includes('esses') ||
    lowerCaseQuery.includes('essas') ||
    lowerCaseQuery.includes('estes imóveis') ||
    lowerCaseQuery.includes('estas opções') ||
    lowerCaseQuery.includes('algum destes') ||
    lowerCaseQuery.includes('alguma destas') ||
    lowerCaseQuery.includes('these') ||
    lowerCaseQuery.includes('those') ||
    lowerCaseQuery.includes('this one') ||
    lowerCaseQuery.includes('that one')
  );

  if (filters.hasDeicticReference) {
    console.log(`[rag-parsing] DEBUG: Detected deictic reference, will use user preferences instead of explicit listing context`);
  }

  // Include user preferences from onboarding for persistent context enrichment
  if (userPreferences && userPreferences.hasPreferences) {
    // Add typology preference as a filter
    if (userPreferences.typology && !filters.typology) {
      filters.typology = userPreferences.typology;
      console.log(`[rag-parsing] DEBUG: Added user typology preference: ${userPreferences.typology}`);
    }

    // Add budget preference as a price range filter
    if (userPreferences.budget && !filters.price_eur) {
      // Create a price range around the user's budget preference
      const budget = userPreferences.budget;
      const tolerance = 0.3; // 30% tolerance
      const minPrice = Math.floor(budget * (1 - tolerance));
      const maxPrice = Math.ceil(budget * (1 + tolerance));

      filters.price_eur = { "$gte": minPrice, "$lte": maxPrice };
      console.log(`[rag-parsing] DEBUG: Added user budget preference range: €${minPrice}-€${maxPrice}`);
    }

    // Add development preference if available
    if (userPreferences.development_preference) {
      filters.development_preference = userPreferences.development_preference;
      console.log(`[rag-parsing] DEBUG: Added user development preference: ${userPreferences.development_preference}`);
    }
  }

  // Fallback to hardcoded intent detection when no clientConfig is provided (for backward compatibility)
  if (!clientConfig || !clientConfig.tagging_rules) {
    // Detect intent for bedroom area queries
    if (lowerCaseQuery.includes('tamanho') && (lowerCaseQuery.includes('quarto') || lowerCaseQuery.includes('dormitório')) &&
        !lowerCaseQuery.includes('casa de banho') && !lowerCaseQuery.includes('banheiro') && !lowerCaseQuery.includes('quarto de banho')) {
      filters.intent_query_bedroom_area = true;
    }

    // Detect intent for bathroom area queries
    if (lowerCaseQuery.includes('tamanho') && (lowerCaseQuery.includes('casa de banho') || lowerCaseQuery.includes('banheiro') || lowerCaseQuery.includes('quarto de banho'))) {
      filters.intent_query_bathroom_area = true;
    }

    // Detect intent for terrace area queries
    if (lowerCaseQuery.includes('tamanho') && (lowerCaseQuery.includes('terraço') || lowerCaseQuery.includes('terraco'))) {
      filters.intent_query_terrace_area = true;
    }

    // Detect intent for living/kitchen area queries
    if (lowerCaseQuery.includes('tamanho') && (lowerCaseQuery.includes('sala') || lowerCaseQuery.includes('cozinha'))) {
      filters.intent_query_living_kitchen_area = true;
    }
  }

  return filters;
}


