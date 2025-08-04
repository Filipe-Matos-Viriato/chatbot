import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';
import { encode } from 'gpt-3-encoder';
import * as userService from './services/user-service.js';
import * as listingService from './services/listing-service.js';

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pinecone.index('rachatbot-1536'); // Use the new 1536-dimension index

const embeddingModel = "text-embedding-3-small"; // Standardize on the 1536-dimension model
const generativeModel = "gpt-3.5-turbo";
const MAX_TOTAL_TOKENS = 4096; // Max tokens for gpt-3.5-turbo
const MAX_RESPONSE_TOKENS = 1000;
const CONTEXT_TOKEN_BUDGET = MAX_TOTAL_TOKENS - MAX_RESPONSE_TOKENS; // Reserve tokens for the response

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function extractListingIdFromQuery(query) {
  const match = query.toLowerCase().match(/ap-\d+/);
  return match ? match[0] : null;
}

function mergeFilters(queryFilters, onboardingFilters) {
  const merged = { ...onboardingFilters, ...queryFilters };
  // A simple example of resolving conflicts, queryFilters take precedence
  // You might want to implement more sophisticated logic here based on your needs
  for (const key in queryFilters) {
    if (onboardingFilters.hasOwnProperty(key)) {
      console.log(`Overriding onboarding filter '${key}' with value from query.`);
    }
  }
  return merged;
}

function extractQueryFilters(query, currentListingPrice = null) {
  const filters = {};
  const lowerCaseQuery = query.toLowerCase();

  // Number of Bedrooms (exact, greater than, less than)
  let match = lowerCaseQuery.match(/(\d+)\s*(quartos|t\d)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) {
      filters.num_bedrooms = num;
    }
  }

  match = lowerCaseQuery.match(/mais de\s*(\d+)\s*quartos/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) {
      filters.num_bedrooms = { "$gt": num };
    }
  }

  match = lowerCaseQuery.match(/menos de\s*(\d+)\s*quartos/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) {
      filters.num_bedrooms = { "$lt": num };
    }
  }

  // Number of Bathrooms
  match = lowerCaseQuery.match(/(\d+)\s*casas de banho/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) {
      filters.num_bathrooms = num;
    }
  }

  // Total Area (less than X m2)
  match = lowerCaseQuery.match(/menos de\s*([\d.,]+)\s*m²/);
  if (match) {
    const area = parseFloat(match[1].replace(',', '.'));
    if (!isNaN(area)) {
      filters.total_area_sqm = { "$lt": area };
    }
  }

  // Price (less than X€)
  match = lowerCaseQuery.match(/menos de\s*([\d.,]+)€/);
  if (match) {
    const price = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
    if (!isNaN(price)) {
      filters.price_eur = { "$lt": price };
    }
  }

  if (currentListingPrice && (lowerCaseQuery.includes('preço') || lowerCaseQuery.includes('custo') || lowerCaseQuery.includes('valor'))) {
    // This case is handled by the LLM with context
  }

  if (currentListingPrice) {
    if (lowerCaseQuery.includes('mais baixo') || lowerCaseQuery.includes('mais barato')) {
      filters.price_eur = { "$lt": currentListingPrice };
    } else if (lowerCaseQuery.includes('mais alto') || lowerCaseQuery.includes('mais caro')) {
      filters.price_eur = { "$gt": currentListingPrice };
    }
  }

  // Boolean features
  if (lowerCaseQuery.includes('piscina')) filters.has_pool = true;
  if (lowerCaseQuery.includes('jardim')) filters.has_garden = true;
  if (lowerCaseQuery.includes('garagem')) filters.has_garage = true;
  if (lowerCaseQuery.includes('elevador')) filters.has_elevator = true;
  if (lowerCaseQuery.includes('varanda')) filters.has_balcony = true;
  if (lowerCaseQuery.includes('terraço')) filters.has_terrace = true;
  if (lowerCaseQuery.includes('ginásio')) filters.has_gym = true;
  if (lowerCaseQuery.includes('carregamento elétrico')) filters.has_electric_car_charging = true;
  if (lowerCaseQuery.includes('animais permitidos')) filters.pets_allowed = true;

  return filters;
}

async function performHybridSearch(searchVector, clientConfig, externalContext = null, originalQuery = "", userContext = null, queryFilters = {}) {
  // Validate search vector before proceeding
  if (!searchVector) {
    console.error('Search vector is null or undefined');
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

  const baseFilter = {
    client_id: clientConfig.clientId,
  };

  if (userContext && userContext.role === 'promoter') {
    try {
      const assignedListings = await userService.getListingsByAgentId(userContext.userId);
      if (assignedListings.length > 0) {
        baseFilter.listing_id = { "$in": assignedListings };
      } else {
        return { matches: [] };
      }
    } catch (error) {
      console.error(`Error applying agent filtering for user ${userContext.userId}:`, error);
      return { matches: [] };
    }
  }

  const contextListingId = externalContext?.type === 'listing' ? externalContext.value : null;
  const contextDevelopmentId = externalContext?.type === 'development' ? externalContext.value : null;
  
  const queries = [];

  // 1. Targeted Listing Query
  if (contextListingId) {
    console.log(`Queueing targeted query for listing_id: ${contextListingId}`);
    queries.push(pineconeIndex
      .namespace(process.env.PINECONE_NAMESPACE)
      .query({
        vector: searchVector,
        topK: 10,
        includeMetadata: true,
        filter: { ...baseFilter, listing_id: contextListingId },
      })
    );
  } else {
    queries.push(Promise.resolve({ matches: [] })); // Add empty promise to keep array order
  }

  // 2. Targeted Development Query
  if (contextDevelopmentId) {
    console.log(`Queueing targeted query for development_id: ${contextDevelopmentId}`);
    queries.push(pineconeIndex
      .namespace(process.env.PINECONE_NAMESPACE)
      .query({
        vector: searchVector,
        topK: 10,
        includeMetadata: true,
        filter: { ...baseFilter, development_id: contextDevelopmentId },
      })
    );
  } else {
    queries.push(Promise.resolve({ matches: [] })); // Add empty promise
  }

  // 3. Broad Query
  console.log("Queueing broad query with filters:", JSON.stringify(queryFilters, null, 2));
  const initialFilter = { ...baseFilter, ...queryFilters };
  queries.push(pineconeIndex
    .namespace(process.env.PINECONE_NAMESPACE)
    .query({
        vector: searchVector,
        topK: 50,
        includeMetadata: true,
        filter: initialFilter,
    })
  );

  // Execute all queries in parallel
  const [listingResponse, developmentResponse, broadResponse] = await Promise.all(queries);

  let matches = listingResponse.matches || [];
  const developmentMatches = developmentResponse.matches || [];
  const broadMatches = broadResponse.matches || [];

  console.log(`Found ${matches.length} matches in targeted listing search.`);
  console.log(`Found ${developmentMatches.length} matches in targeted development search.`);
  console.log(`Found ${broadMatches.length} matches in broad search.`);

  const priceMatch = matches.find(match => match.metadata.price_eur !== undefined);
  let currentListingPrice = null;
  if (priceMatch) {
    currentListingPrice = priceMatch.metadata.price_eur;
    console.log(`Current listing (${contextListingId}) price from targeted search: ${currentListingPrice}`);
  }

  const combinedMatches = [...matches, ...developmentMatches];
  const existingIds = new Set(combinedMatches.map(m => m.id));

  broadMatches.forEach(bm => {
    if (!existingIds.has(bm.id)) {
      combinedMatches.push(bm);
    }
  });

  matches = combinedMatches;

  if (matches.length > 0) {
    const queryListingId = extractListingIdFromQuery(originalQuery);
    const reRankQueryFilters = extractQueryFilters(originalQuery, currentListingPrice);

    matches = matches.map(match => {
      let score = match.score;
      if (contextListingId && match.metadata.listing_id === contextListingId) {
        score += 1.0;
      }
      if (queryListingId && match.metadata.listing_id === queryListingId) {
        score += 1.5;
      }
      if (contextDevelopmentId && match.metadata.development_id === contextDevelopmentId) {
        score += 0.8;
      }

      if (Object.keys(reRankQueryFilters).length > 0) {
        let filterMatchCount = 0;
        for (const key in reRankQueryFilters) {
          if (key === 'total_area_sqm' || key === 'price_eur' || key === 'num_bedrooms') {
            if (reRankQueryFilters[key].$lt && match.metadata[key] < reRankQueryFilters[key].$lt) {
              filterMatchCount++;
            } else if (reRankQueryFilters[key].$gt && match.metadata[key] > reRankQueryFilters[key].$gt) {
              filterMatchCount++;
            } else if (match.metadata[key] === reRankQueryFilters[key]) {
              filterMatchCount++;
            }
          } else if (match.metadata[key] === reRankQueryFilters[key]) {
            filterMatchCount++;
          }
        }
        score += (filterMatchCount * 0.2);
      }
      return { ...match, score };
    });

    matches.sort((a, b) => b.score - a.score);
    matches = matches.slice(0, 20);
  }

  return { matches };
}

function isAggregativePriceQuery(query) {
  const lowerCaseQuery = query.toLowerCase();
  return (
    lowerCaseQuery.includes('mais barato') ||
    lowerCaseQuery.includes('preço mais baixo') ||
    lowerCaseQuery.includes('preço mínimo') ||
    lowerCaseQuery.includes('mais caro') ||
    lowerCaseQuery.includes('preço mais alto') ||
    lowerCaseQuery.includes('preço máximo')
  );
}

async function generateResponse(query, clientConfig, queryEmbeddingVector, externalContext = null, userContext = null, chatHistory = null, onboardingAnswers = null) {
  let aggregativeContext = '';

  if (isAggregativePriceQuery(query)) {
    try {
      if (query.toLowerCase().includes('mais barato') || query.toLowerCase().includes('preço mínimo')) {
        const minPrice = await listingService.getMinPrice(clientConfig.clientId);
        aggregativeContext = minPrice !== null ? `A propriedade com o preço mais baixo disponível é de ${minPrice}€.` : `Não foi possível encontrar o preço mínimo nos documentos fornecidos.`;
      } else if (query.toLowerCase().includes('mais caro') || query.toLowerCase().includes('preço máximo')) {
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
  const onboardingFilters = onboardingAnswers ? extractQueryFilters(JSON.stringify(onboardingAnswers)) : {};
  const mergedFilters = mergeFilters(queryFilters, onboardingFilters);

  let queryResponse;
  try {
    queryResponse = await performHybridSearch(queryEmbeddingVector, clientConfig, externalContext, query, userContext, mergedFilters);
  } catch (error) {
    console.error(`[${clientConfig.clientName}] Error in performHybridSearch:`, error);
    // Return empty matches if search fails due to invalid embedding
    queryResponse = { matches: [] };
  }
  
  let context = queryResponse.matches.map(m => m.metadata.text).join('\n\n---\n\n');
  let remainingTokens = CONTEXT_TOKEN_BUDGET;
  
  const contextTokens = encode(context).length;
  remainingTokens -= contextTokens;
  
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
    onboardingAnswers: onboardingAnswers || "Não disponível",
    chatHistory: truncatedChatHistory,
    context: context + (aggregativeContext ? `\n\nInformação Adicional:\n${aggregativeContext}` : ''),
    question: query
  };
  let systemPrompt = systemPromptTemplate;
  Object.keys(templateVariables).forEach(key => {
    const placeholder = `{${key}}`;
    // We only replace placeholders in the system prompt template, not the final prompt itself
    systemPrompt = systemPrompt.replace(new RegExp(placeholder, 'g'), templateVariables[key]);
  });
  
  console.log(`[${clientConfig.clientName || clientConfig.clientId}] Using enhanced system prompt. Final token estimate: ${MAX_TOTAL_TOKENS - remainingTokens}`);

  const messages = [
    { role: 'system', content: systemPrompt },
    ...chatMessagesArray,
    { role: 'user', content: query }
  ];

  let retries = 3;
  while (retries > 0) {
    try {
      const completion = await openai.chat.completions.create({
        model: generativeModel,
        messages: messages,
        max_tokens: MAX_RESPONSE_TOKENS,
      });
      return completion.choices[0].message.content;
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