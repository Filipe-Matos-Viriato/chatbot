// packages/backend/src/utils/query-complexity-analyzer.js
// Analyzes query complexity across multiple dimensions to determine optimal LLM selection
// Relevant files: rag-service.js, model-router.js, utils/rag-parsing.js

import { encode } from 'gpt-3-encoder';

/**
 * Query Complexity Analyzer
 * Assesses query complexity across multiple dimensions for intelligent model routing
 */
class QueryComplexityAnalyzer {
  constructor() {
    this.complexityThresholds = {
      low: 0.3,
      medium: 0.5,
      high: 0.8
    };
  }

  /**
   * Analyze query complexity across multiple dimensions
   * @param {string} query - User query
   * @param {Object} context - Context object with matches, externalContext, etc.
   * @returns {Promise<Object>} Complexity analysis result
   */
  async analyze(query, context = {}) {
    const [
      tokenCount,
      semanticComplexity,
      intentClarity,
      contextRequirements
    ] = await Promise.all([
      this.countTokens(query, context),
      this.assessSemanticComplexity(query),
      this.assessIntentClarity(query, context),
      this.assessContextRequirements(context)
    ]);

    const overallScore = this.computeOverallScore({
      tokenCount,
      semanticComplexity,
      intentClarity,
      contextRequirements
    });

    return {
      tokenCount,
      semanticComplexity,
      intentClarity,
      contextRequirements,
      overallScore,
      complexity: this.classifyComplexity(overallScore),
      recommendedModels: this.getRecommendedModels(overallScore, tokenCount)
    };
  }

  /**
   * Count total tokens for query and context
   * @param {string} query - User query
   * @param {Object} context - Context object
   * @returns {number} Total token count
   */
  countTokens(query, context) {
    const queryTokens = encode(query).length;

    // Estimate context tokens based on matches
    let contextTokens = 0;
    if (context.matches && Array.isArray(context.matches)) {
      // Rough estimate: 4 chars per token
      const contextText = context.matches
        .slice(0, 10) // Limit to first 10 matches for estimation
        .map(match => match.metadata?.text || '')
        .join(' ');
      contextTokens = Math.ceil(contextText.length / 4);
    }

    return queryTokens + contextTokens;
  }

  /**
   * Assess semantic complexity using linguistic features
   * @param {string} query - User query
   * @returns {number} Semantic complexity score (0-1)
   */
  assessSemanticComplexity(query) {
    const lowerQuery = query.toLowerCase();

    let score = 0;

    // Length-based complexity
    if (query.length > 100) score += 0.2;
    else if (query.length > 50) score += 0.1;

    // Technical/real estate terminology
    const technicalTerms = ['hipoteca', 'financiamento', 'escritura', 'registo', 'certificado', 'energia', 'isolamento', 'certificado energético'];
    const technicalCount = technicalTerms.filter(term => lowerQuery.includes(term)).length;
    score += Math.min(technicalCount * 0.1, 0.3);

    // Comparative language
    const comparativeWords = ['mais barato', 'mais caro', 'melhor', 'pior', 'comparar', 'diferença'];
    if (comparativeWords.some(word => lowerQuery.includes(word))) {
      score += 0.2;
    }

    // Multiple questions or complex structure
    if (query.includes('?') && query.split('?').length > 2) {
      score += 0.1;
    }

    // Conditional or hypothetical language
    const conditionalWords = ['se', 'caso', 'quando', 'então', 'mas', 'porém', 'contudo'];
    if (conditionalWords.some(word => lowerQuery.includes(word))) {
      score += 0.1;
    }

    return Math.min(score, 1);
  }

  /**
   * Assess intent clarity based on query structure and filters
   * @param {string} query - User query
   * @param {Object} context - Context object
   * @returns {number} Intent clarity score (0-1)
   */
  assessIntentClarity(query, context) {
    let score = 0;

    // Clear intent indicators
    const intentIndicators = {
      price: ['preço', 'custo', 'valor', '€', 'euros'],
      location: ['localização', 'zona', 'bairro', 'área', 'distrito'],
      features: ['quartos', 'casas de banho', 'garagem', 'terraço', 'piscina'],
      availability: ['disponível', 'venda', 'aluguer', 'reservado']
    };

    let matchedIntents = 0;
    Object.values(intentIndicators).forEach(indicators => {
      if (indicators.some(indicator => query.toLowerCase().includes(indicator))) {
        matchedIntents++;
      }
    });

    score += Math.min(matchedIntents * 0.2, 0.6);

    // Context-based clarity
    if (context.externalContext?.type === 'listing') {
      score += 0.2; // Specific listing context increases clarity
    }

    // Filter-based clarity
    if (context.queryFilters) {
      const filterCount = Object.keys(context.queryFilters).length;
      score += Math.min(filterCount * 0.1, 0.2);
    }

    return Math.min(score, 1);
  }

  /**
   * Assess context requirements based on query type and available data
   * @param {Object} context - Context object
   * @returns {number} Context requirements score (0-1)
   */
  assessContextRequirements(context) {
    let score = 0;

    // Base requirement for any real estate query
    score += 0.3;

    // Specific listing queries need detailed context
    if (context.externalContext?.type === 'listing') {
      score += 0.4;
    }

    // Comparative queries need broader context
    if (context.query && (context.query.toLowerCase().includes('comparar') ||
                         context.query.toLowerCase().includes('diferença'))) {
      score += 0.3;
    }

    // Complex queries need more context
    if (context.query && context.query.length > 80) {
      score += 0.2;
    }

    // Availability of matches affects requirements
    if (context.matches && context.matches.length > 5) {
      score += 0.1; // More matches available, can be more selective
    }

    return Math.min(score, 1);
  }

  /**
   * Compute overall complexity score
   * @param {Object} components - Individual complexity components
   * @returns {number} Overall complexity score (0-1)
   */
  computeOverallScore(components) {
    const weights = {
      tokenCount: 0.2,
      semanticComplexity: 0.3,
      intentClarity: 0.3,
      contextRequirements: 0.2
    };

    // Normalize token count (assuming 1000 tokens is high complexity)
    const normalizedTokenCount = Math.min(components.tokenCount / 1000, 1);

    const weightedScore =
      normalizedTokenCount * weights.tokenCount +
      components.semanticComplexity * weights.semanticComplexity +
      components.intentClarity * weights.intentClarity +
      components.contextRequirements * weights.contextRequirements;

    return Math.min(weightedScore, 1);
  }

  /**
   * Classify complexity into categories
   * @param {number} score - Overall complexity score
   * @returns {string} Complexity category
   */
  classifyComplexity(score) {
    if (score >= this.complexityThresholds.high) return 'high';
    if (score >= this.complexityThresholds.medium) return 'medium';
    return 'low';
  }

  /**
   * Get recommended models based on complexity and token count
   * @param {number} complexityScore - Overall complexity score
   * @param {number} tokenCount - Total token count
   * @returns {string[]} Array of recommended model names
   */
  getRecommendedModels(complexityScore, tokenCount) {
    const recommendations = [];

    // High complexity or large token count → GPT-5
    if (complexityScore >= this.complexityThresholds.high || tokenCount > 80000) {
      recommendations.push('gpt-5');
    }

    // Medium complexity or moderate token count → GPT-4.1
    if (complexityScore >= this.complexityThresholds.medium || tokenCount > 40000) {
      recommendations.push('gpt-4.1');
    }

    // Low complexity or cost-sensitive → GPT-5 mini/nano
    if (complexityScore < this.complexityThresholds.medium) {
      if (tokenCount < 10000) {
        recommendations.push('gpt-5-nano');
      }
      recommendations.push('gpt-5-mini');
    }

    // Ensure GPT-4.1 as fallback
    if (!recommendations.includes('gpt-4.1')) {
      recommendations.push('gpt-4.1');
    }

    return [...new Set(recommendations)]; // Remove duplicates
  }
}

export default QueryComplexityAnalyzer;