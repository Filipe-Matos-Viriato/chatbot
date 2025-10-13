// packages/backend/src/utils/context-hierarchy-engine.js
// Organizes context chunks into hierarchical levels (summary → details → full)
// Relevant files: context.js, rag-service.js

/**
 * @typedef {Object} ContextChunk
 * @property {string} id - Unique chunk identifier
 * @property {string} text - Chunk text content
 * @property {Object} metadata - Chunk metadata
 * @property {number} score - Relevance score
 */

/**
 * @typedef {Object} ContextHierarchy
 * @property {ContextChunk[]} summary - High-level overviews (always included)
 * @property {ContextChunk[]} keyPoints - Important details (budget permitting)
 * @property {ContextChunk[]} details - Full information (if space allows)
 * @property {ContextChunk[]} fullText - Complete context (fallback only)
 */

/**
 * Context Hierarchy Engine
 * Organizes context chunks into hierarchical levels based on importance and content type
 */
class ContextHierarchyEngine {
  constructor() {
    this.hierarchyRules = {
      summary: {
        maxChunks: 2,
        priorityKeywords: ['overview', 'summary', 'introduction', 'main features'],
        contentTypes: ['structured', 'highlights'],
        minScore: 0.7
      },
      keyPoints: {
        maxChunks: 5,
        priorityKeywords: ['price', 'location', 'features', 'specifications', 'benefits'],
        contentTypes: ['structured', 'key_info'],
        minScore: 0.6
      },
      details: {
        maxChunks: 10,
        priorityKeywords: ['description', 'details', 'additional', 'specifications'],
        contentTypes: ['detailed', 'descriptive'],
        minScore: 0.5
      },
      fullText: {
        maxChunks: 20,
        priorityKeywords: ['complete', 'full', 'comprehensive'],
        contentTypes: ['any'],
        minScore: 0.3
      }
    };
  }

  /**
   * Organizes chunks into hierarchical levels
   * @param {ContextChunk[]} chunks - Input context chunks
   * @param {Object} options - Organization options
   * @returns {ContextHierarchy} Organized hierarchy
   */
  organizeIntoHierarchy(chunks, options = {}) {
    const {
      queryIntent = null,
      userContext = null,
      maxTotalChunks = 20
    } = options;

    if (!chunks || chunks.length === 0) {
      return this.createEmptyHierarchy();
    }

    // Sort chunks by relevance score
    const sortedChunks = [...chunks].sort((a, b) => (b.score || 0) - (a.score || 0));

    // Initialize hierarchy levels
    const hierarchy = {
      summary: [],
      keyPoints: [],
      details: [],
      fullText: []
    };

    // Distribute chunks across hierarchy levels
    for (const chunk of sortedChunks) {
      if (hierarchy.summary.length < this.hierarchyRules.summary.maxChunks &&
          this.shouldIncludeInLevel(chunk, 'summary', queryIntent)) {
        hierarchy.summary.push(chunk);
      } else if (hierarchy.keyPoints.length < this.hierarchyRules.keyPoints.maxChunks &&
                 this.shouldIncludeInLevel(chunk, 'keyPoints', queryIntent)) {
        hierarchy.keyPoints.push(chunk);
      } else if (hierarchy.details.length < this.hierarchyRules.details.maxChunks &&
                 this.shouldIncludeInLevel(chunk, 'details', queryIntent)) {
        hierarchy.details.push(chunk);
      } else if (hierarchy.fullText.length < this.hierarchyRules.fullText.maxChunks) {
        hierarchy.fullText.push(chunk);
      }

      // Stop if we've reached the maximum total chunks
      const totalChunks = Object.values(hierarchy).reduce((sum, level) => sum + level.length, 0);
      if (totalChunks >= maxTotalChunks) {
        break;
      }
    }

    return hierarchy;
  }

  /**
   * Determines if a chunk should be included in a specific hierarchy level
   * @param {ContextChunk} chunk - Context chunk
   * @param {string} level - Hierarchy level ('summary', 'keyPoints', 'details', 'fullText')
   * @param {Object} queryIntent - Query intent information
   * @returns {boolean} Whether to include the chunk
   */
  shouldIncludeInLevel(chunk, level, queryIntent = null) {
    const rules = this.hierarchyRules[level];
    const score = chunk.score || 0;

    // Check minimum score
    if (score < rules.minScore) {
      return false;
    }

    // Check content type if specified
    if (rules.contentTypes !== 'any') {
      const contentType = this.determineContentType(chunk);
      if (!rules.contentTypes.includes(contentType)) {
        return false;
      }
    }

    // Check priority keywords
    const text = chunk.text.toLowerCase();
    const hasPriorityKeywords = rules.priorityKeywords.some(keyword =>
      text.includes(keyword.toLowerCase())
    );

    // Boost priority for chunks with relevant keywords
    if (hasPriorityKeywords) {
      return true;
    }

    // Intent-based prioritization
    if (queryIntent) {
      return this.matchesQueryIntent(chunk, queryIntent);
    }

    return true;
  }

  /**
   * Determines the content type of a chunk
   * @param {ContextChunk} chunk - Context chunk
   * @returns {string} Content type
   */
  determineContentType(chunk) {
    const text = chunk.text;
    const metadata = chunk.metadata || {};

    // Check for structured data indicators
    if (metadata.price_eur || metadata.beds || metadata.type) {
      return 'structured';
    }

    // Check for highlights/summaries
    if (text.length < 200 && (text.includes('overview') || text.includes('highlights'))) {
      return 'highlights';
    }

    // Check for key information
    if (text.includes('price') || text.includes('location') || text.includes('features')) {
      return 'key_info';
    }

    // Check for detailed descriptions
    if (text.length > 500 || text.includes('description') || text.includes('details')) {
      return 'detailed';
    }

    // Default to descriptive
    return 'descriptive';
  }

  /**
   * Checks if chunk matches query intent
   * @param {ContextChunk} chunk - Context chunk
   * @param {Object} queryIntent - Query intent
   * @returns {boolean} Whether chunk matches intent
   */
  matchesQueryIntent(chunk, queryIntent) {
    const text = chunk.text.toLowerCase();
    const intent = queryIntent.intent || '';

    // Price-related queries
    if (intent.includes('price') || intent.includes('cost')) {
      return text.includes('price') || text.includes('preço') || text.includes('€');
    }

    // Location-related queries
    if (intent.includes('location') || intent.includes('area')) {
      return text.includes('location') || text.includes('localização') || text.includes('zone');
    }

    // Feature-related queries
    if (intent.includes('feature') || intent.includes('amenity')) {
      return text.includes('feature') || text.includes('amenity') || text.includes('comodidade');
    }

    return true; // Default to include
  }

  /**
   * Creates an empty hierarchy structure
   * @returns {ContextHierarchy} Empty hierarchy
   */
  createEmptyHierarchy() {
    return {
      summary: [],
      keyPoints: [],
      details: [],
      fullText: []
    };
  }

  /**
   * Gets statistics about the hierarchy
   * @param {ContextHierarchy} hierarchy - Context hierarchy
   * @returns {Object} Hierarchy statistics
   */
  getHierarchyStats(hierarchy) {
    const totalChunks = Object.values(hierarchy).reduce((sum, level) => sum + level.length, 0);
    const totalScore = Object.values(hierarchy).reduce((sum, level) =>
      sum + level.reduce((levelSum, chunk) => levelSum + (chunk.score || 0), 0), 0
    );

    return {
      totalChunks,
      averageScore: totalChunks > 0 ? totalScore / totalChunks : 0,
      levelDistribution: {
        summary: hierarchy.summary.length,
        keyPoints: hierarchy.keyPoints.length,
        details: hierarchy.details.length,
        fullText: hierarchy.fullText.length
      }
    };
  }
}

export default ContextHierarchyEngine;