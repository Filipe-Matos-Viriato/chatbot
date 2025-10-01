// packages/backend/src/utils/question-strategies.js
// Provides template-based question generation strategies for fallback and hybrid approaches
// This file exists to ensure reliable question generation when LLM fails or for deterministic behavior
// Relevant files: rag-service.js, client-config-service.js

/**
 * Question templates organized by context and engagement level
 */
const QUESTION_TEMPLATES = {
  // Listing-specific questions
  LISTING_SPECIFIC: {
    HIGH_ENGAGEMENT: [
      "Estou interessado em marcar uma visita a este imóvel",
      "Quero falar com um consultor sobre este apartamento",
      "Posso saber mais sobre o processo de compra deste imóvel?"
    ],
    MEDIUM_ENGAGEMENT: [
      "Estou interessado em saber as opções de financiamento disponíveis",
      "Quero comparar este imóvel com outros semelhantes",
      "Estou curioso sobre a área e comodidades do imóvel"
    ],
    LOW_ENGAGEMENT: [
      "Estou interessado em conhecer melhor as características deste imóvel",
      "Quero saber mais sobre a localização e zona envolvente",
      "Estou curioso sobre outros imóveis neste empreendimento"
    ]
  },

  // General inquiry questions
  GENERAL_INQUIRY: {
    HIGH_ENGAGEMENT: [
      "Estou pronto para marcar visitas aos imóveis que me interessam",
      "Quero falar sobre o processo de compra e documentação",
      "Posso agendar uma reunião com um consultor?"
    ],
    MEDIUM_ENGAGEMENT: [
      "Estou interessado em comparar preços e características",
      "Quero saber mais sobre as opções de financiamento",
      "Estou a avaliar diferentes empreendimentos, pode ajudar?"
    ],
    LOW_ENGAGEMENT: [
      "Estou a começar a procurar casa, pode orientar-me?",
      "Quero conhecer as opções disponíveis na minha faixa de preço",
      "Estou curioso sobre os diferentes tipos de imóveis"
    ]
  },

  // Development-specific questions
  DEVELOPMENT_SPECIFIC: {
    HIGH_ENGAGEMENT: [
      "Estou interessado em marcar uma visita ao empreendimento",
      "Quero saber sobre a disponibilidade de unidades",
      "Posso falar com alguém sobre investimento neste empreendimento?"
    ],
    MEDIUM_ENGAGEMENT: [
      "Estou interessado em comparar as diferentes tipologias disponíveis",
      "Quero saber mais sobre as comodidades do empreendimento",
      "Estou curioso sobre o estado de construção e prazos"
    ],
    LOW_ENGAGEMENT: [
      "Estou interessado em conhecer melhor este empreendimento",
      "Quero saber sobre a localização e acessos",
      "Estou curioso sobre os preços praticados"
    ]
  },

  // Feature-specific follow-ups
  FEATURE_INQUIRY: {
    PRICE: [
      "Estou interessado nas opções de financiamento disponíveis",
      "Quero saber se há promoções ou condições especiais",
      "Posso conhecer o plano de pagamento?"
    ],
    LOCATION: [
      "Estou interessado em saber sobre transportes e acessos",
      "Quero conhecer as comodidades da zona (escolas, comércio)",
      "Estou curioso sobre o desenvolvimento futuro da área"
    ],
    AMENITIES: [
      "Estou interessado em ver fotos das áreas comuns",
      "Quero saber sobre os custos de condomínio",
      "Estou curioso sobre a gestão e manutenção"
    ]
  }
};

/**
 * Determines engagement level from lead score
 * @param {number} leadScore - Lead score (0-100)
 * @returns {string} Engagement level: 'HIGH_ENGAGEMENT', 'MEDIUM_ENGAGEMENT', or 'LOW_ENGAGEMENT'
 */
function getEngagementLevel(leadScore) {
  if (leadScore >= 70) return 'HIGH_ENGAGEMENT';
  if (leadScore >= 40) return 'MEDIUM_ENGAGEMENT';
  return 'LOW_ENGAGEMENT';
}

/**
 * Selects appropriate question template based on context
 * @param {Object} context - Context object containing user and conversation data
 * @param {Object} clientConfig - Client configuration for custom templates
 * @returns {Array<string>} Array of 3 suggested questions
 */
function selectQuestionTemplate(context, clientConfig = null) {
  const {
    leadScore = 0,
    hasListingContext = false,
    hasDevelopmentContext = false,
    lastQueryType = null,
    preferences = {}
  } = context;

  // Use client-specific templates from database if available, fallback to hardcoded defaults
  const templates = clientConfig?.questionTemplates || QUESTION_TEMPLATES;

  const engagementLevel = getEngagementLevel(leadScore);

  // Determine context type
  let contextType;
  if (hasListingContext) {
    contextType = 'LISTING_SPECIFIC';
  } else if (hasDevelopmentContext) {
    contextType = 'DEVELOPMENT_SPECIFIC';
  } else if (lastQueryType && templates.FEATURE_INQUIRY && templates.FEATURE_INQUIRY[lastQueryType]) {
    contextType = 'FEATURE_INQUIRY';
    return templates.FEATURE_INQUIRY[lastQueryType].slice(0, 3);
  } else {
    contextType = 'GENERAL_INQUIRY';
  }

  // Get base questions
  let questions = templates[contextType]?.[engagementLevel] ||
                   templates.GENERAL_INQUIRY?.LOW_ENGAGEMENT ||
                   QUESTION_TEMPLATES.GENERAL_INQUIRY.LOW_ENGAGEMENT;

  // Personalize if preferences available
  questions = personalizeQuestions(questions, preferences);

  return questions.slice(0, 3);
}

/**
 * Personalizes question templates with user preferences
 * @param {Array<string>} questions - Base question templates
 * @param {Object} preferences - User preferences (tipologia, budget, etc.)
 * @returns {Array<string>} Personalized questions
 */
function personalizeQuestions(questions, preferences) {
  return questions.map(q => {
    let personalized = q;

    // Replace tipologia placeholder
    if (preferences.tipologia && q.includes('T{tipologia}')) {
      personalized = personalized.replace('T{tipologia}', preferences.tipologia);
    }

    // Replace budget placeholder
    if (preferences.budget && q.includes('{budget}')) {
      const formattedBudget = `€${preferences.budget.toLocaleString('pt-PT')}`;
      personalized = personalized.replace('{budget}', formattedBudget);
    }

    // Replace development placeholder
    if (preferences.development && q.includes('{development}')) {
      personalized = personalized.replace('{development}', preferences.development);
    }

    return personalized;
  });
}

/**
 * Validates LLM-generated questions for quality and relevance
 * @param {Array<string>} questions - Questions generated by LLM
 * @param {Object} context - Context for validation
 * @returns {Object} Validation result with isValid flag and filtered questions
 */
function validateLLMQuestions(questions, context) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { isValid: false, questions: [] };
  }

  // Filter out invalid questions
  const validQuestions = questions.filter(q => {
    // Must be a non-empty string
    if (typeof q !== 'string' || q.trim().length === 0) return false;

    // Must be reasonable length (10-200 characters)
    if (q.length < 10 || q.length > 200) return false;

    // Should not be generic/template-like
    const genericPatterns = [
      /^como posso ajud[aá]-?lo/i,
      /^se desejar mais/i,
      /^gostaria de saber mais/i,
      /^tem mais alguma/i
    ];
    if (genericPatterns.some(pattern => pattern.test(q))) return false;

    // Should be in first person (user perspective)
    const firstPersonIndicators = [
      /^estou/i,
      /^quero/i,
      /^gostaria/i,
      /^posso/i,
      /^tenho interesse/i
    ];
    if (!firstPersonIndicators.some(pattern => pattern.test(q.trim()))) return false;

    return true;
  });

  return {
    isValid: validQuestions.length >= 2,
    questions: validQuestions.slice(0, 3)
  };
}

/**
 * Hybrid approach: combines LLM questions with template questions
 * @param {Array<string>} llmQuestions - Questions from LLM
 * @param {Object} context - Context for template selection
 * @returns {Array<string>} Final set of 3 questions
 */
function generateHybridQuestions(llmQuestions, context) {
  const validation = validateLLMQuestions(llmQuestions, context);

  if (validation.isValid && validation.questions.length >= 3) {
    // LLM generated good questions, use them
    return validation.questions;
  }

  if (validation.isValid && validation.questions.length >= 2) {
    // LLM generated 2 good questions, add 1 template
    const templateQuestions = selectQuestionTemplate(context);
    return [
      ...validation.questions,
      templateQuestions[0]
    ].slice(0, 3);
  }

  // LLM failed or generated poor questions, use templates
  console.warn('[question-strategies] Using template fallback');
  return selectQuestionTemplate(context);
}

export {
  QUESTION_TEMPLATES,
  selectQuestionTemplate,
  personalizeQuestions,
  validateLLMQuestions,
  generateHybridQuestions,
  getEngagementLevel
};