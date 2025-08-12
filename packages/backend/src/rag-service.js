import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { encode } from 'gpt-3-encoder';
import * as userService from './services/user-service.js';
import listingService from './services/listing-service.js';
import { withTimeout } from './utils/async-timeout.js';
import { reRankMatches } from './utils/rerank.js';
import { buildContext, pickText } from './utils/context.js';
import { renderTemplate } from './utils/prompt.js';
import { createLogger } from './utils/structured-logger.js';
import { extractListingIdFromUrl, extractListingIdFromQuery, extractQueryFilters, isAggregativePriceQuery } from './utils/rag-parsing.js';
import { removeRedundantClosingCTA } from './utils/postprocess.js';

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

async function performHybridSearch(searchVector, clientConfig, externalContext = null, originalQuery = "", userContext = null, queryFilters = {}) {
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
  
  const contextListingId = externalContext?.type === 'listing' ? externalContext.value : null;
  const contextDevelopmentId = externalContext?.type === 'development' ? externalContext.value : clientConfig.defaultDevelopmentId;
  
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
  const targetedFilter = (() => {
    if (contextListingId) return { ...baseFilter, listing_id: contextListingId };
    const derived = extractListingIdFromQuery(originalQuery);
    if (derived) return { ...baseFilter, listing_id: derived };
    if (contextDevelopmentId) return { ...baseFilter, development_id: contextDevelopmentId };
    return null;
  })();

  const queries = [];
  if (TWO_QUERY_ENABLED && targetedFilter) {
    const targetedParams = { vector: searchVector, topK: 10, includeMetadata: true, filter: targetedFilter };
    const { vector, ...loggable } = targetedParams;
    log.info('pinecone.targeted.query', { params: loggable });
    queries.push(withTimeout(namespacedIndex.query(targetedParams), PINECONE_TIMEOUT_MS, 'pinecone-targeted'));
  } else {
    queries.push(Promise.resolve({ matches: [] }));
  }

  const broadTopK = Number(process.env.RAG_BROAD_TOPK || 30);
  const broadParams = { vector: searchVector, topK: broadTopK, includeMetadata: true, filter: { ...baseFilter } };
  const { vector: _v, ...loggableBroad } = broadParams;
  log.info('pinecone.broad.query', { params: loggableBroad });
  queries.push(withTimeout(namespacedIndex.query(broadParams), PINECONE_TIMEOUT_MS, 'pinecone-broad'));

  let targetedResponse, broadResponse;
  try {
    const t = log.time('pinecone.all');
    [targetedResponse, broadResponse] = await Promise.all(queries);
    t.end({
      targetedCount: targetedResponse?.matches?.length || 0,
      broadCount: broadResponse?.matches?.length || 0,
      broadTopK: broadParams.topK,
      twoQueryEnabled: TWO_QUERY_ENABLED,
    });
  } catch (error) {
    log.error('pinecone.query.failed', { error: error.message });
    throw error;
  }

  let matches = (targetedResponse?.matches || []);
  const broadMatches = (broadResponse?.matches || []);

  console.log(`Found ${matches.length} matches in targeted listing search.`);
  console.log(`Found ${broadMatches.length} matches in broad search.`);
  
  // Add detailed debugging for broad search
  console.log(`🔍 DEBUGGING - Broad Search Details:`);
  console.log(`  Base filter: ${JSON.stringify(baseFilter, null, 2)}`);
  console.log(`  Vector dimensions: ${searchVector.length}`);
  console.log(`  TopK requested: ${broadParams.topK}`);
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

  if (matches.length > 0) {
    const reRankQueryFilters = extractQueryFilters(originalQuery, currentListingPrice);
    matches = reRankMatches({
      matches,
      contextListingId,
      contextDevelopmentId,
      originalQuery,
      queryFilters: reRankQueryFilters,
      topN: 20,
    });
  }

  return { matches };
}

// parsing helpers now imported from ./utils/rag-parsing.js

async function generateResponse(query, clientConfig, queryEmbeddingVector, externalContext = null, userContext = null, chatHistory = null, pageUrl = null) {
  let aggregativeContext = '';
  let pageContext = '';

  // 1. Check for context from the current page URL
  const listingIdFromUrl = extractListingIdFromUrl(pageUrl);
  if (listingIdFromUrl) {
    try {
      const listing = await listingService.getListingById(listingIdFromUrl);
      if (listing) {
        // Construct a detailed summary of the listing
        pageContext = `O utilizador está atualmente a ver a página do seguinte imóvel:
- **Nome:** ${listing.name}
- **ID:** ${listing.id}
- **Preço:** €${listing.price.toLocaleString()}
- **Tipo:** ${listing.type}
- **Quartos:** ${listing.beds}
- **Casas de Banho:** ${listing.baths}
- **Comodidades:** ${listing.amenities ? listing.amenities.join(', ') : 'N/A'}
Use esta informação como o contexto principal para responder a perguntas como "qual é o preço?" ou "quantos quartos tem?".
---
`;
        console.log(`[${clientConfig.clientName}]  enriched context with data for listing ID: ${listingIdFromUrl}`);
      }
    } catch (error) {
      console.error(`[${clientConfig.clientName}] failed to fetch listing data for ID ${listingIdFromUrl} from URL:`, error);
    }
  }

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

  const queryFilters = extractQueryFilters(query);
  
  // Add debugging for filters
  console.log(`[${clientConfig.clientName}] 🔍 DEBUGGING - Filters Applied:`);
  console.log(`  Query filters: ${JSON.stringify(queryFilters, null, 2)}`);
  console.log(`  Original query: "${query}"`);

  let queryResponse = { matches: [] };
  if (!listingIdFromUrl) {
    try {
      queryResponse = await performHybridSearch(queryEmbeddingVector, clientConfig, externalContext, query, userContext, queryFilters);
    } catch (error) {
      console.error(`[${clientConfig.clientName}] Error in performHybridSearch:`, error);
      // Return empty matches if search fails due to invalid embedding
      queryResponse = { matches: [] };
    }
  }
  
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
  
  let context = buildContext({ pageContext, matches: queryResponse.matches });
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
  } catch (_) {}
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
  
  // Handle empty search results. If we have page context, KEEP IT and do not override.
  if (queryResponse.matches.length === 0) {
    if (!pageContext) {
      context = "IMPORTANTE: Não foram encontradas propriedades na base de dados que correspondam aos critérios especificados. NÃO INVENTE ou CRIE informações sobre apartamentos que não existem nos documentos. Informe o utilizador que não há propriedades disponíveis que correspondam aos critérios. Apenas mencione propriedades específicas da Up Investments (client_id: e6f484a3-c3cb-4e01-b8ce-a276f4b7355c) e não de outros clientes.";
      console.log(`[${clientConfig.clientName}] 📝 Using empty context warning to prevent hallucination (no page context)`);
    } else {
      console.log(`[${clientConfig.clientName}] ✅ Using page context only (no Pinecone matches).`);
    }
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
  if (chatHistory && chatHistory !== "Nenhum histórico anterior disponível") {
    // Ensure chatHistory is a string
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
    
    // Create the messages array for the API call from the truncated history
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

  const systemPromptTemplate = clientConfig.prompts.systemInstruction;
  if (!systemPromptTemplate) {
      throw new Error("System prompt is not defined in the client configuration.");
  }
  
  const templateVariables = {
    chatHistory: truncatedChatHistory,
    context: context + (aggregativeContext ? `\n\nInformação Adicional:\n${aggregativeContext}` : ''),
    question: query,
    pageUrl: pageUrl || 'Não disponível'
  };
  const systemPrompt = renderTemplate(systemPromptTemplate, templateVariables);
  
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
      const previousAssistantText = (chatMessagesArray.slice().reverse().find(m => m.role === 'assistant')?.content) || '';
      return removeRedundantClosingCTA(raw, previousAssistantText);
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
  let searchQuery = "general information";
  if (externalContext && externalContext.type === 'listing' && externalContext.value) {
    searchQuery = `information about ${externalContext.value}`;
  } else if (chatHistory.length > 0) {
    searchQuery = chatHistory.map(m => m.text).join(' ');
  }

  let queryEmbedding;
  try {
    queryEmbedding = await openai.embeddings.create({
      model: embeddingModel,
      input: searchQuery,
    });
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
  } catch (error) {
    console.error(`[${clientConfig.clientName}] Error in performHybridSearch for suggested questions:`, error);
    return [];
  }

  if (!queryResponse || queryResponse.matches.length === 0) {
    return [];
  }

  const context = queryResponse.matches
    .map(match => match.metadata.text)
    .join('\n\n---\n\n');

  const prompt = `
    Based on the following context, generate exactly three distinct, relevant, and concise questions a user might ask.
    Format the output as a JSON array of strings. For example: ["Question 1", "Question 2", "Question 3"].
    If you cannot generate three relevant questions from the context, return an empty array [].

    Context:
    ${context}
  `;

  try {
    const completion = await openai.chat.completions.create({
        model: generativeModel,
        messages: [{ role: 'system', content: prompt }],
        response_format: { type: "json_object" },
      });
    const responseText = completion.choices[0].message.content;
    // Basic validation to ensure the response is a parsable JSON array.
    const parsed = JSON.parse(responseText);
    return Array.isArray(parsed) ? parsed : (parsed.questions && Array.isArray(parsed.questions) ? parsed.questions : []);
  } catch (error) {
    console.error("Failed to generate or parse suggested questions:", error);
    return [];
  }
}

export { generateResponse, generateSuggestedQuestions, embeddingModel };