import OpenAI from 'openai';

class QueryValidatorService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Validates if a query is relevant to the client's domain
   * @param {string} query - The user's query
   * @param {Object} clientConfig - Client configuration object
   * @returns {Promise<Object>} - { isRelevant: boolean, reason: string, suggestedResponse?: string }
   */
  async validateQueryRelevance(query, clientConfig) {
    try {
      const systemPrompt = `You are a query relevance validator for ${clientConfig.clientName}, a real estate company.

ALLOWED TOPICS:
- Real estate properties, listings, apartments, houses
- Property features, specifications, amenities
- Prices, investment opportunities, financing
- Locations, neighborhoods, accessibility
- Company information about ${clientConfig.clientName}
- Scheduling viewings, contact information
- Real estate market information
- Property buying/selling process
- Real estate legal questions

NOT ALLOWED TOPICS:
- Cooking recipes, food preparation
- General knowledge questions unrelated to real estate
- Other businesses or companies (unless related to real estate)
- Personal advice unrelated to property
- Technical support for non-real estate software
- Entertainment, sports, news (unless real estate related)
- Any topic completely unrelated to real estate or ${clientConfig.clientName}

Analyze the following query and determine if it's relevant to ${clientConfig.clientName}'s real estate business.

Respond with ONLY a JSON object in this format:
{
  "isRelevant": true/false,
  "reason": "brief explanation",
  "suggestedResponse": "optional suggested response if not relevant"
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Query to validate: "${query}"` }
        ],
        max_tokens: 200,
        temperature: 0.1
      });

      const result = JSON.parse(response.choices[0].message.content);
      return result;
    } catch (error) {
      console.error('Error validating query relevance:', error);
      // Default to allowing the query if validation fails
      return {
        isRelevant: true,
        reason: 'Validation service error - defaulting to allow'
      };
    }
  }

  /**
   * Checks if query contains keywords that are clearly off-topic
   * @param {string} query - The user's query
   * @returns {Object} - { isRelevant: boolean, reason: string }
   */
  quickRelevanceCheck(query) {
    const lowerQuery = query.toLowerCase();
    
    // Off-topic keywords that are clearly not real estate related
    const offTopicKeywords = [
      'receita', 'recipe', 'cozinhar', 'cooking', 'comida', 'food',
      'ingredientes', 'ingredients', 'pão', 'bread', 'bolo', 'cake',
      'restaurante', 'restaurant', 'medicina', 'medicine', 'saúde', 'health',
      'desporto', 'sports', 'futebol', 'football', 'música', 'music',
      'filme', 'movie', 'livro', 'book', 'jogo', 'game', 'viagem', 'travel',
      'motor', 'carro', 'car', 'auto', 'tempo', 'weather', 'exercício', 'fitness',
      'ginásio', 'gym', 'treino', 'workout', 'escola', 'school', 'trabalho', 'job',
      'moda', 'fashion', 'beleza', 'beauty', 'tecnologia', 'technology',
      'computador', 'computer', 'software', 'hardware', 'internet', 'web'
    ];

    // Real estate related keywords
    const realEstateKeywords = [
      'apartamento', 'apartment', 'casa', 'house', 'imóvel', 'property',
      'preço', 'price', 'comprar', 'buy', 'vender', 'sell', 'arrendar', 'rent',
      'metro', 'square', 'quarto', 'bedroom', 'sala', 'living', 'cozinha', 'kitchen',
      'garagem', 'garage', 'varanda', 'balcony', 'elevador', 'elevator',
      'localização', 'location', 'bairro', 'neighborhood', 'investimento', 'investment'
    ];

    // Check for obvious off-topic queries
    const hasOffTopicKeywords = offTopicKeywords.some(keyword => lowerQuery.includes(keyword));
    const hasRealEstateKeywords = realEstateKeywords.some(keyword => lowerQuery.includes(keyword));

    if (hasOffTopicKeywords && !hasRealEstateKeywords) {
      return {
        isRelevant: false,
        reason: 'Query contains off-topic keywords',
        suggestedResponse: `Desculpe, mas sou um assistente especializado em imobiliário da ${process.env.CLIENT_NAME || 'nossa empresa'}. Posso ajudar com questões relacionadas com propriedades, apartamentos, investimentos imobiliários e informações sobre os nossos empreendimentos. Como posso ajudar com as suas necessidades imobiliárias?`
      };
    }

    return {
      isRelevant: true,
      reason: 'No obvious off-topic keywords detected'
    };
  }

  /**
   * Main validation method that combines quick check with AI validation
   * @param {string} query - The user's query
   * @param {Object} clientConfig - Client configuration object
   * @returns {Promise<Object>} - { isRelevant: boolean, reason: string, suggestedResponse?: string }
   */
  async validateQuery(query, clientConfig) {
    // First, do a quick keyword-based check
    const quickCheck = this.quickRelevanceCheck(query);
    
    if (!quickCheck.isRelevant) {
      console.log(`[${clientConfig.clientName}] Query rejected by quick check: "${query}"`);
      return quickCheck;
    }

    // If quick check passes but we want to be extra sure, use AI validation for ambiguous cases
    // For now, we'll skip AI validation to save on API costs and rely on quick check + enhanced prompt
    return {
      isRelevant: true,
      reason: 'Passed quick relevance check'
    };
  }
}

export default QueryValidatorService;