const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');

// Initialize clients
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME);

const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
const generativeModel = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

/**
 * A helper function to add a delay.
 * @param {number} ms The number of milliseconds to wait.
 * @returns {Promise<void>}
 */
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Generates a response using the RAG pipeline with retry logic.
 * @param {string} query The user's question.
 * @returns {Promise<string>} The generated answer.
 */
/**
 * Performs a hybrid search in Pinecone to retrieve relevant context.
 * @param {Array<number>} searchVector The vector to search for.
 * @param {object} externalContext The external context for filtering.
 * @returns {Promise<object>} The Pinecone query response.
 */
/**
 * Extracts a listing ID (e.g., "ap-XX") from a query string.
 * @param {string} query The user's query.
 * @returns {string|null} The extracted listing ID or null.
 */
function extractListingIdFromQuery(query) {
  const match = query.toLowerCase().match(/ap-\d+/);
  return match ? match[0] : null;
}

/**
 * Performs a hybrid search in Pinecone to retrieve relevant context with re-ranking.
 * @param {Array<number>} searchVector The vector to search for.
 * @param {object} clientConfig The client-specific configuration.
 * @param {object} externalContext The external context for filtering (e.g., { type: 'listing', value: 'ap-01' }).
 * @param {string} originalQuery The original user query string.
 * @returns {Promise<object>} The Pinecone query response with re-ranked matches.
 */
/**
 * Extracts a listing ID (e.g., "ap-XX") from a query string.
 * @param {string} query The user's query.
 * @returns {string|null} The extracted listing ID or null.
 */
function extractListingIdFromQuery(query) {
  const match = query.toLowerCase().match(/ap-\d+/);
  return match ? match[0] : null;
}

/**
 * Extracts structured query filters from the user's query.
 * @param {string} query The user's query.
 * @returns {object} An object containing Pinecone filter conditions.
 */
function extractQueryFilters(query, currentListingPrice = null) {
  const filters = {};
  const lowerCaseQuery = query.toLowerCase();

  // Number of Bedrooms (exact, greater than, less than)
  let match = lowerCaseQuery.match(/(\d+)\s*(quartos|t\d)/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) {
      filters.num_bedrooms = num; // Exact match
    }
  }

  match = lowerCaseQuery.match(/mais de\s*(\d+)\s*quartos/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) {
      filters.num_bedrooms = { "$gt": num }; // Greater than
    }
  }

  match = lowerCaseQuery.match(/menos de\s*(\d+)\s*quartos/);
  if (match) {
    const num = parseInt(match[1], 10);
    if (!isNaN(num)) {
      filters.num_bedrooms = { "$lt": num }; // Less than
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

  // General Price Queries (e.g., "qual o preço?", "qual o preço deste imóvel?")
  if (currentListingPrice && (lowerCaseQuery.includes('preço') || lowerCaseQuery.includes('custo') || lowerCaseQuery.includes('valor'))) {
    // If a general price query is made and we have a current listing price,
    // we don't add a filter here. The RAG service will retrieve relevant documents
    // and the LLM should be able to find the price in the context.
    // This is to avoid over-filtering when the user just wants the current listing's price.
  }

  // Comparative Price Queries (e.g., "mais baixo", "mais alto")
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

/**
 * Performs a hybrid search in Pinecone to retrieve relevant context with re-ranking and attribute filtering.
 * @param {Array<number>} searchVector The vector to search for.
 * @param {object} clientConfig The client-specific configuration.
 * @param {object} externalContext The external context for filtering (e.g., { type: 'listing', value: 'ap-01' }).
 * @param {string} originalQuery The original user query string.
 * @returns {Promise<object>} The Pinecone query response with re-ranked matches.
 */
async function performHybridSearch(searchVector, clientConfig, externalContext = null, originalQuery = "") {
  const baseFilter = {
    client_id: clientConfig.clientId,
  };

  let currentListingPrice = null;
  const contextListingId = externalContext?.type === 'listing' ? externalContext.value : null;
  let matches = [];
  let broadMatches = [];

  // 1. Perform targeted search if contextListingId is present
  if (contextListingId) {
    console.log(`Performing targeted query for listing_id: ${contextListingId}`);
    const targetedQueryResponse = await pineconeIndex
      .namespace(process.env.PINECONE_NAMESPACE)
      .query({
        vector: searchVector,
        topK: 10, // Smaller topK for targeted search
        includeMetadata: true,
        filter: { ...baseFilter, listing_id: contextListingId },
      });

    matches = targetedQueryResponse.matches || [];
    console.log(`Found ${matches.length} matches in targeted search for ${contextListingId}.`);

    // Try to get currentListingPrice from targeted matches if available
    const priceMatch = matches.find(match => match.metadata.price_eur !== undefined);
    if (priceMatch) {
      currentListingPrice = priceMatch.metadata.price_eur;
      console.log(`Current listing (${contextListingId}) price from targeted search: ${currentListingPrice}`);
    }
  }

  // 2. Always perform broad search
  console.log("Performing broad query.");
  const queryFilters = extractQueryFilters(originalQuery, currentListingPrice);
  console.log("Extracted query filters:", JSON.stringify(queryFilters, null, 2));

  let initialFilter = { ...baseFilter, ...queryFilters };

  const broadQueryResponse = await pineconeIndex
    .namespace(process.env.PINECONE_NAMESPACE)
    .query({
      vector: searchVector,
      topK: 50, // Retrieve a large number of results for re-ranking
      includeMetadata: true,
      filter: initialFilter,
    });

  broadMatches = broadQueryResponse.matches || [];

  // 3. Combine results from targeted and broad searches, avoiding duplicates
  const combinedMatches = [...matches]; // Start with targeted matches
  const existingIds = new Set(matches.map(m => m.id));

  broadMatches.forEach(bm => {
    if (!existingIds.has(bm.id)) {
      combinedMatches.push(bm);
    }
  });

  matches = combinedMatches; // Update matches to the combined set

  // Re-ranking logic (applies to combined matches)
  if (matches.length > 0) {
    const queryListingId = extractListingIdFromQuery(originalQuery);
    // Re-extract query filters here to ensure they are based on the latest currentListingPrice
    // and are used consistently for re-ranking.
    const reRankQueryFilters = extractQueryFilters(originalQuery, currentListingPrice);

    matches = matches.map(match => {
      let score = match.score; // Start with the Pinecone similarity score

      // Boost if listing_id matches the external context (current page)
      if (contextListingId && match.metadata.listing_id === contextListingId) {
        score += 1.0; // Significantly higher boost for current context
      }

      // Boost if listing_id is explicitly mentioned in the query
      if (queryListingId && match.metadata.listing_id === queryListingId) {
        score += 1.5; // Even higher boost for explicit query mention
      }

      // Boost if the document has structured metadata that matches query filters
      if (Object.keys(reRankQueryFilters).length > 0) {
        let filterMatchCount = 0;
        for (const key in reRankQueryFilters) {
          if (key === 'total_area_sqm' || key === 'price_eur' || key === 'num_bedrooms') { // Added num_bedrooms
            if (reRankQueryFilters[key].$lt && match.metadata[key] < reRankQueryFilters[key].$lt) {
              filterMatchCount++;
            } else if (reRankQueryFilters[key].$gt && match.metadata[key] > reRankQueryFilters[key].$gt) {
              filterMatchCount++;
            } else if (match.metadata[key] === reRankQueryFilters[key]) { // Exact match for num_bedrooms
              filterMatchCount++;
            }
          } else if (match.metadata[key] === reRankQueryFilters[key]) {
            filterMatchCount++;
          }
        }
        score += (filterMatchCount * 0.2); // Small boost for each matching filter
      }

      return { ...match, score };
    });

    // Sort by the new score in descending order
    matches.sort((a, b) => b.score - a.score);

    // Return topK results after re-ranking
    matches = matches.slice(0, 20);
  }

  return { matches };
}

async function generateResponse(query, clientConfig, externalContext = null) {
  // 1. Generate embedding for the user's query
  const queryEmbedding = await embeddingModel.embedContent({
    content: { parts: [{ text: query }] },
    taskType: "RETRIEVAL_QUERY",
  });

  // 2. Perform Hybrid Search with re-ranking
  const queryResponse = await performHybridSearch(queryEmbedding.embedding.values, clientConfig, externalContext, query);

  // If there are no matches at all, use the client's configured fallback.
  if (!queryResponse || queryResponse.matches.length === 0) {
    return clientConfig.prompts.fallbackResponse;
  }

  // 3. Format the retrieved context
  const context = queryResponse.matches
    .map(match => match.metadata.text)
    .join('\n\n---\n\n');

  // 4. Construct the prompt using the client's configuration
  let externalContextString = '';
  if (externalContext) {
    externalContextString = `
    This is the additional context provided by the application:
    ${JSON.stringify(externalContext)}
    `;
  }

  const prompt = `
    ${clientConfig.prompts.systemInstruction}
    Answer the user's question based ONLY on the context provided below.
    If the answer is not in the context, say that you do not have enough information to answer that question based on the provided documents.
    ${externalContextString}

    Context:
    ${context}

    Question:
    ${query}
  `;

  // 5. Generate the final response with retry logic
  let retries = 3;
  while (retries > 0) {
    try {
      const result = await generativeModel.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      if (error.status === 503 && retries > 1) {
        console.log(`Model is overloaded. Retrying in 2 seconds... (${retries - 1} retries left)`);
        await delay(2000);
        retries--;
      } else {
        throw error; // Re-throw other errors or if retries are exhausted
      }
    }
  }
}

async function generateSuggestedQuestions(clientConfig, externalContext = null, chatHistory = []) {
  // 1. Create a search query from the context or history
  let searchQuery = "general information"; // Default search
  if (externalContext && externalContext.type === 'listing' && externalContext.value) {
    // A more specific search if we have a listingId
    searchQuery = `information about ${externalContext.value}`;
  } else if (chatHistory.length > 0) {
    searchQuery = chatHistory.map(m => m.text).join(' ');
  }

  const queryEmbedding = await embeddingModel.embedContent({
    content: { parts: [{ text: searchQuery }] },
    taskType: "RETRIEVAL_QUERY",
  });

  // 2. Perform Hybrid Search to find relevant context, now client-aware
  const queryResponse = await performHybridSearch(queryEmbedding.embedding.values, clientConfig, externalContext, searchQuery);

  if (!queryResponse || queryResponse.matches.length === 0) {
    return []; // No context found, no questions to suggest
  }

  const context = queryResponse.matches
    .map(match => match.metadata.text)
    .join('\n\n---\n\n');

  // 3. Construct the prompt for generating questions
  const prompt = `
    Based on the following context, generate exactly three distinct, relevant, and concise questions a user might ask.
    Format the output as a JSON array of strings. For example: ["Question 1", "Question 2", "Question 3"].
    If you cannot generate three relevant questions from the context, return an empty array [].

    Context:
    ${context}
  `;

  // 4. Generate the questions
  try {
    const result = await generativeModel.generateContent(prompt);
    const responseText = await result.response.text();
    // Clean and parse the JSON output
    const cleanedJson = responseText.trim().replace(/^```json\s*|```$/g, '');
    const questions = JSON.parse(cleanedJson);
    return Array.isArray(questions) ? questions : [];
  } catch (error) {
    console.error("Failed to generate or parse suggested questions:", error);
    return []; // Return empty array on failure
  }
}

module.exports = { generateResponse, generateSuggestedQuestions };