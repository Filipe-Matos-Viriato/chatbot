# Query Validation Implementation

## Overview

This document describes the implementation of a query validation system to ensure the chatbot only responds to queries related to the client's real estate business and knowledge base. This prevents the chatbot from answering off-topic questions like cooking recipes, general knowledge, or other unrelated topics.

## Problem

Previously, the chatbot would answer any query, including completely unrelated topics like:
- "Diz-me uma receita para fazer pão" (Tell me a bread recipe)
- General knowledge questions
- Personal advice unrelated to real estate
- Technical support for non-real estate topics

## Solution

A multi-layered approach was implemented to restrict the chatbot's responses:

### 1. Query Validator Service (`query-validator-service.js`)

Created a new service that validates queries before processing:

#### Features:
- **Quick Keyword Check**: Fast filtering based on obvious off-topic keywords
- **Real Estate Keywords**: Recognizes relevant real estate terminology
- **Fallback Response Generation**: Provides appropriate responses for off-topic queries
- **AI Validation** (optional): Can use OpenAI to validate ambiguous queries

#### Off-topic Keywords Detected:
- Cooking: `receita`, `recipe`, `cozinhar`, `cooking`, `comida`, `food`
- Medical: `medicina`, `medicine`, `saúde`, `health`
- Entertainment: `música`, `music`, `filme`, `movie`, `jogo`, `game`
- Sports: `desporto`, `sports`, `futebol`, `football`
- And many more...

#### Real Estate Keywords Recognized:
- Property: `apartamento`, `apartment`, `casa`, `house`, `imóvel`, `property`
- Features: `quarto`, `bedroom`, `sala`, `living`, `cozinha`, `kitchen`
- Business: `preço`, `price`, `comprar`, `buy`, `investimento`, `investment`
- And many more...

### 2. Enhanced System Prompt

Updated the client configuration with explicit restrictions:

#### Added to System Prompt:
```
🚨 **RESTRIÇÃO CRÍTICA - APENAS TÓPICOS IMOBILIÁRIOS** 🚨
APENAS responde a perguntas relacionadas com:
- Imóveis, apartamentos, casas da UpInvestments
- Preços, características e detalhes das propriedades
- Informações sobre a empresa UpInvestments
- Processo de compra, visitas, financiamento imobiliário
- Localizações e bairros dos empreendimentos
- Investimento imobiliário

NUNCA responda a:
- Receitas culinárias ou questões de cozinha
- Perguntas gerais não relacionadas com imobiliário
- Tópicos sobre outras empresas ou negócios
- Aconselhamento médico, legal (não imobiliário) ou técnico
- Entretenimento, desporto, viagens, etc.
```

### 3. API Integration

Modified the main chat endpoint (`/api/chat`) to include validation:

#### Flow:
1. Receive query from user
2. **Validate query relevance** using QueryValidatorService
3. If irrelevant: Return polite rejection response
4. If relevant: Continue with normal RAG processing
5. Store both user messages and responses for analytics

#### Benefits:
- Prevents expensive embedding generation for off-topic queries
- Maintains conversation history for analytics
- Provides consistent rejection responses
- Graceful fallback if validation service fails

### 4. Fallback Response System

Standardized responses for off-topic queries:

```portuguese
"Desculpe, mas sou um assistente especializado em imobiliário da UpInvestments. 
Posso ajudar com questões relacionadas com as nossas propriedades, apartamentos, 
investimentos imobiliários e informações sobre os nossos empreendimentos. 
Como posso ajudar com as suas necessidades imobiliárias?"
```

## Implementation Details

### Files Modified:

1. **`packages/backend/src/services/query-validator-service.js`** (NEW)
   - Query validation logic
   - Keyword-based filtering
   - Fallback response generation

2. **`packages/backend/src/index.js`**
   - Added QueryValidatorService import
   - Integrated validation into chat endpoint
   - Enhanced user message storage logic

3. **`packages/backend/configs/e6f484a3-c3cb-4e01-b8ce-a276f4b7355c.json`**
   - Updated system prompt with explicit restrictions
   - Added visual emphasis with emojis
   - Defined allowed and forbidden topics

### Configuration Options

The system can be easily configured per client:

#### In QueryValidatorService:
- Modify `offTopicKeywords` array for different languages/domains
- Adjust `realEstateKeywords` for specific business terminology
- Customize fallback responses

#### In Client Config:
- Update `systemInstruction` for different business domains
- Modify allowed/forbidden topic lists
- Customize rejection responses

## Benefits

1. **Cost Savings**: Prevents expensive OpenAI API calls for irrelevant queries
2. **User Experience**: Provides clear boundaries and helpful redirections
3. **Brand Consistency**: Maintains focus on business domain
4. **Analytics**: Tracks both approved and rejected queries
5. **Flexibility**: Easy to configure for different clients/domains
6. **Performance**: Quick keyword-based filtering for obvious cases
7. **Reliability**: Graceful fallback if validation service fails

## Testing Scenarios

To test the implementation:

### Off-topic Queries (Should be Rejected):
- "Diz-me uma receita para fazer pão"
- "Como está o tempo hoje?"
- "Qual é a melhor música do ano?"
- "Como funciona um motor de carro?"

### Real Estate Queries (Should be Approved):
- "Quais apartamentos têm disponíveis?"
- "Qual é o preço do T2 em Aveiro?"
- "Posso agendar uma visita?"
- "Que financiamento oferecem?"

### Edge Cases:
- "Cozinha moderna" (Should be approved - refers to kitchen in apartments)
- "Receita de investimento" (Should be approved - investment recipe in business context)

## Monitoring

The system logs all validation decisions:

```
[Up Investments] Query rejected: "receita para fazer pão" - Query contains off-topic keywords
[Up Investments] Query approved: "apartamentos disponíveis" - Passed quick relevance check
```

## Future Improvements

1. **Machine Learning**: Train a custom model for domain-specific validation
2. **Multilingual Support**: Expand keyword lists for English, Spanish, etc.
3. **Context Awareness**: Consider conversation history for validation
4. **Admin Dashboard**: Interface to monitor and adjust validation rules
5. **A/B Testing**: Compare different validation strategies

## Maintenance

### Regular Tasks:
- Review rejection logs for false positives
- Update keyword lists based on user queries
- Monitor validation performance and accuracy
- Adjust system prompts based on user feedback

### Adding New Clients:
1. Create client-specific keyword lists
2. Customize system prompts for business domain
3. Set appropriate fallback responses
4. Test with domain-specific queries

This implementation provides a robust, scalable solution to ensure the chatbot stays focused on the client's business domain while maintaining a good user experience.