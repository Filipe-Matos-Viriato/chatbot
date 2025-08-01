const OpenAI = require('openai');
const { Pinecone } = require('@pinecone-database/pinecone');
const userService = require('./services/user-service');
const listingService = require('./services/listing-service');

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pinecone.index('rachatbot-1536'); // Use the new 1536-dimension index

const embeddingModel = "text-embedding-3-small"; // Standardize on the 1536-dimension model
const generativeModel = "gpt-3.5-turbo";

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

  let currentListingPrice = null;
  const contextListingId = externalContext?.type === 'listing' ? externalContext.value : null;
  const contextDevelopmentId = externalContext?.type === 'development' ? externalContext.value : null;
  let matches = [];
  let broadMatches = [];
  let developmentMatches = [];

  if (contextListingId) {
    console.log(`Performing targeted query for listing_id: ${contextListingId}`);
    const targetedQueryResponse = await pineconeIndex
      .namespace(process.env.PINECONE_NAMESPACE)
      .query({
        vector: searchVector,
        topK: 10,
        includeMetadata: true,
        filter: { ...baseFilter, listing_id: contextListingId },
      });

    matches = targetedQueryResponse.matches || [];
    console.log(`Found ${matches.length} matches in targeted search for ${contextListingId}.`);
    const priceMatch = matches.find(match => match.metadata.price_eur !== undefined);
    if (priceMatch) {
      currentListingPrice = priceMatch.metadata.price_eur;
      console.log(`Current listing (${contextListingId}) price from targeted search: ${currentListingPrice}`);
    }
  }

  if (contextDevelopmentId) {
    console.log(`Performing targeted query for development_id: ${contextDevelopmentId}`);
    const developmentQueryResponse = await pineconeIndex
      .namespace(process.env.PINECONE_NAMESPACE)
      .query({
        vector: searchVector,
        topK: 10,
        includeMetadata: true,
        filter: { ...baseFilter, development_id: contextDevelopmentId },
      });
    developmentMatches = developmentQueryResponse.matches || [];
    console.log(`Found ${developmentMatches.length} matches in targeted search for development_id: ${contextDevelopmentId}.`);
  }

  console.log("Performing broad query with filters:", JSON.stringify(queryFilters, null, 2));

  let initialFilter = { ...baseFilter, ...queryFilters };

  const broadQueryResponse = await pineconeIndex
    .namespace(process.env.PINECONE_NAMESPACE)
    .query({
      vector: searchVector,
      topK: 50,
      includeMetadata: true,
      filter: initialFilter,
    });
  broadMatches = broadQueryResponse.matches || [];

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

async function generateResponse(query, clientConfig, externalContext = null, userContext = null, chatHistory = null, onboardingAnswers = null) {
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

  const queryEmbedding = await openai.embeddings.create({
    model: embeddingModel,
    input: query,
  });

  const queryFilters = extractQueryFilters(query);
  const onboardingFilters = onboardingAnswers ? extractQueryFilters(JSON.stringify(onboardingAnswers)) : {};
  const mergedFilters = mergeFilters(queryFilters, onboardingFilters);

  const queryResponse = await performHybridSearch(queryEmbedding.data[0].embedding, clientConfig, externalContext, query, userContext, mergedFilters);

  // Get context from search results, or use empty context if no matches
  let context = '';
  if (queryResponse && queryResponse.matches && queryResponse.matches.length > 0) {
    context = queryResponse.matches
      .map(match => match.metadata.text)
      .join('\n\n---\n\n');
  } else {
    // For queries with no specific context (like greetings), we'll still use system prompt
    context = 'Nenhum contexto específico de documentos encontrado para esta consulta.';
  }

  const templateVariables = {
    onboardingAnswers: onboardingAnswers || "Não disponível",
    chatHistory: chatHistory || "Nenhum histórico anterior disponível",
    context: context + (aggregativeContext ? `\n\nInformação Adicional:\n${aggregativeContext}` : ''),
    question: query
  };

  let systemPrompt = clientConfig.prompts.systemInstruction;
  Object.keys(templateVariables).forEach(key => {
    const placeholder = `{${key}}`;
    systemPrompt = systemPrompt.replace(new RegExp(placeholder, 'g'), templateVariables[key]);
  });

  console.log(`[${clientConfig.clientName || clientConfig.clientId}] Using enhanced system prompt with context variables`);

  let retries = 3;
  while (retries > 0) {
    try {
      // Parse chat history into message format
      const chatMessagesArray = [];
      if (chatHistory && chatHistory !== "Nenhum histórico anterior disponível") {
        // Split the chat history by lines and convert to message objects
        const historyLines = chatHistory.split('\n');
        for (const line of historyLines) {
          if (line.startsWith('Utilizador: ')) {
            chatMessagesArray.push({
              role: 'user',
              content: line.replace('Utilizador: ', '')
            });
          } else if (line.startsWith('Assistente: ')) {
            chatMessagesArray.push({
              role: 'assistant',
              content: line.replace('Assistente: ', '')
            });
          }
        }
      }

      // Create the full messages array
      const messages = [
        { role: 'system', content: systemPrompt },
        ...chatMessagesArray,
        { role: 'user', content: query }
      ];

      // Call the API with the complete conversation
      const completion = await openai.chat.completions.create({
        model: generativeModel,
        messages: messages,
      });
      return completion.choices[0].message.content;
    } catch (error) {
      if (error.status === 503 && retries > 1) {
        console.log(`Model is overloaded. Retrying in 2 seconds... (${retries - 1} retries left)`);
        await delay(2000);
        retries--;
      } else {
        console.error('Error generating response:', error);
        return clientConfig.prompts.fallbackResponse;
      }
    }
  }

  return clientConfig.prompts.fallbackResponse;
}

async function generateSuggestedQuestions(clientConfig, externalContext = null, chatHistory = [], userContext = null) {
  let searchQuery = "general information";
  if (externalContext && externalContext.type === 'listing' && externalContext.value) {
    searchQuery = `information about ${externalContext.value}`;
  } else if (chatHistory.length > 0) {
    searchQuery = chatHistory.map(m => m.text).join(' ');
  }

  const queryEmbedding = await openai.embeddings.create({
    model: embeddingModel,
    input: searchQuery,
  });

  const queryResponse = await performHybridSearch(queryEmbedding.data[0].embedding, clientConfig, externalContext, searchQuery, userContext);

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

module.exports = { generateResponse, generateSuggestedQuestions, embeddingModel };