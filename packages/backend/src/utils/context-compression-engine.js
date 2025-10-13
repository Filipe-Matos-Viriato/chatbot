// packages/backend/src/utils/context-compression-engine.js
// Compresses context while preserving critical information
// Relevant files: context.js, rag-service.js

import { encode } from 'gpt-3-encoder';

/**
 * @typedef {Object} ContextChunk
 * @property {string} id - Unique chunk identifier
 * @property {string} text - Chunk text content
 * @property {Object} metadata - Chunk metadata
 * @property {number} score - Relevance score
 */

/**
 * @typedef {Object} CompressionResult
 * @property {string} compressedContext - Compressed context text
 * @property {number} compressionRatio - Ratio of compressed to original (0-1)
 * @property {number} informationPreserved - Information preservation score (0-1)
 * @property {number} tokenSavings - Number of tokens saved
 */

/**
 * Context Compression Engine
 * Intelligently compresses context while preserving important information
 */
class ContextCompressionEngine {
  constructor(options = {}) {
    this.maxTokens = options.maxTokens || 1000;
    this.compressionLevel = options.compressionLevel || 'moderate'; // 'light', 'moderate', 'aggressive'
    this.preserveKeywords = options.preserveKeywords || [
      'preço', 'price', '€', 'localização', 'location', 'quartos', 'bedrooms',
      'casas de banho', 'bathrooms', 'área', 'area', 'm²', 'tipo', 'type',
      'comodidades', 'amenities', 'terraço', 'terrace', 'piscina', 'pool'
    ];
  }

  /**
   * Compresses context chunks into a token-budgeted string
   * @param {ContextChunk[]} chunks - Input context chunks
   * @param {number} tokenBudget - Maximum tokens allowed
   * @param {Object} options - Compression options
   * @returns {Promise<CompressionResult>} Compression result
   */
  async compressContext(chunks, tokenBudget, options = {}) {
    if (!chunks || chunks.length === 0) {
      return this.createEmptyResult();
    }

    const {
      queryIntent = null,
      preserveStructuredData = true,
      compressionLevel = this.compressionLevel
    } = options;

    console.log(`[ContextCompression] Compressing ${chunks.length} chunks to ${tokenBudget} tokens`);

    try {
      // Calculate original token count
      const originalTokens = this.calculateTotalTokens(chunks);

      // Apply compression strategy based on level
      let compressedChunks;
      switch (compressionLevel) {
        case 'light':
          compressedChunks = await this.applyLightCompression(chunks, tokenBudget);
          break;
        case 'moderate':
          compressedChunks = await this.applyModerateCompression(chunks, tokenBudget, queryIntent);
          break;
        case 'aggressive':
          compressedChunks = await this.applyAggressiveCompression(chunks, tokenBudget, queryIntent);
          break;
        default:
          compressedChunks = await this.applyModerateCompression(chunks, tokenBudget, queryIntent);
      }

      // Preserve structured data if requested
      if (preserveStructuredData) {
        compressedChunks = this.preserveStructuredData(compressedChunks, chunks);
      }

      // Build final compressed context
      const compressedContext = this.buildCompressedContext(compressedChunks);
      const finalTokens = encode(compressedContext).length;

      // Calculate metrics
      const compressionRatio = originalTokens > 0 ? finalTokens / originalTokens : 0;
      const tokenSavings = Math.max(0, originalTokens - finalTokens);
      const informationPreserved = this.calculateInformationPreservation(chunks, compressedChunks);

      const result = {
        compressedContext,
        compressionRatio,
        informationPreserved,
        tokenSavings,
        originalTokens,
        finalTokens,
        chunksProcessed: chunks.length,
        chunksIncluded: compressedChunks.length
      };

      console.log(`[ContextCompression] Compression complete: ${originalTokens} → ${finalTokens} tokens (${Math.round(compressionRatio * 100)}% ratio)`);

      return result;
    } catch (error) {
      console.error('[ContextCompression] Error during compression:', error);
      // Return uncompressed context as fallback
      const fallbackContext = this.buildCompressedContext(chunks);
      return {
        compressedContext: fallbackContext,
        compressionRatio: 1.0,
        informationPreserved: 1.0,
        tokenSavings: 0,
        originalTokens: this.calculateTotalTokens(chunks),
        finalTokens: encode(fallbackContext).length,
        chunksProcessed: chunks.length,
        chunksIncluded: chunks.length,
        error: error.message
      };
    }
  }

  /**
   * Applies light compression (minimal changes)
   * @param {ContextChunk[]} chunks - Input chunks
   * @param {number} tokenBudget - Token budget
   * @returns {ContextChunk[]} Compressed chunks
   */
  async applyLightCompression(chunks, tokenBudget) {
    // Sort by score and truncate to fit budget
    const sortedChunks = [...chunks].sort((a, b) => (b.score || 0) - (a.score || 0));

    let selectedChunks = [];
    let currentTokens = 0;

    for (const chunk of sortedChunks) {
      const chunkTokens = encode(chunk.text).length;
      if (currentTokens + chunkTokens <= tokenBudget) {
        selectedChunks.push(chunk);
        currentTokens += chunkTokens;
      }
    }

    return selectedChunks;
  }

  /**
   * Applies moderate compression (smart truncation)
   * @param {ContextChunk[]} chunks - Input chunks
   * @param {number} tokenBudget - Token budget
   * @param {Object} queryIntent - Query intent for prioritization
   * @returns {ContextChunk[]} Compressed chunks
   */
  async applyModerateCompression(chunks, tokenBudget, queryIntent) {
    // Prioritize chunks based on intent and importance
    const prioritizedChunks = this.prioritizeChunks(chunks, queryIntent);

    let selectedChunks = [];
    let currentTokens = 0;

    for (const chunk of prioritizedChunks) {
      const chunkTokens = encode(chunk.text).length;

      if (currentTokens + chunkTokens <= tokenBudget) {
        // Chunk fits entirely
        selectedChunks.push(chunk);
        currentTokens += chunkTokens;
      } else if (currentTokens < tokenBudget * 0.8) {
        // Partial inclusion for high-priority chunks
        const availableTokens = tokenBudget - currentTokens;
        const truncatedChunk = this.truncateChunk(chunk, availableTokens);
        if (truncatedChunk) {
          selectedChunks.push(truncatedChunk);
          currentTokens += availableTokens;
        }
      }
      // Stop if we're approaching the budget
      if (currentTokens >= tokenBudget * 0.9) {
        break;
      }
    }

    return selectedChunks;
  }

  /**
   * Applies aggressive compression (extractive summarization)
   * @param {ContextChunk[]} chunks - Input chunks
   * @param {number} tokenBudget - Token budget
   * @param {Object} queryIntent - Query intent for prioritization
   * @returns {ContextChunk[]} Compressed chunks
   */
  async applyAggressiveCompression(chunks, tokenBudget, queryIntent) {
    // Extract key sentences and phrases
    const keyElements = await this.extractKeyElements(chunks, queryIntent);

    // Build compressed context from key elements
    let compressedText = '';
    let currentTokens = 0;

    for (const element of keyElements) {
      const elementTokens = encode(element.text).length;
      if (currentTokens + elementTokens <= tokenBudget) {
        compressedText += (compressedText ? ' ' : '') + element.text;
        currentTokens += elementTokens;
      } else {
        break;
      }
    }

    // Return as single compressed chunk
    return [{
      id: 'compressed_context',
      text: compressedText,
      metadata: { compressed: true },
      score: 1.0
    }];
  }

  /**
   * Prioritizes chunks based on query intent and importance
   * @param {ContextChunk[]} chunks - Input chunks
   * @param {Object} queryIntent - Query intent
   * @returns {ContextChunk[]} Prioritized chunks
   */
  prioritizeChunks(chunks, queryIntent) {
    return [...chunks].sort((a, b) => {
      // Primary sort: relevance score
      const scoreA = a.score || 0;
      const scoreB = b.score || 0;

      if (scoreA !== scoreB) {
        return scoreB - scoreA;
      }

      // Secondary sort: intent relevance
      const intentRelevanceA = this.calculateIntentRelevance(a, queryIntent);
      const intentRelevanceB = this.calculateIntentRelevance(b, queryIntent);

      if (intentRelevanceA !== intentRelevanceB) {
        return intentRelevanceB - intentRelevanceA;
      }

      // Tertiary sort: information density
      const densityA = this.calculateInformationDensity(a);
      const densityB = this.calculateInformationDensity(b);

      return densityB - densityA;
    });
  }

  /**
   * Calculates intent relevance score for a chunk
   * @param {ContextChunk} chunk - Context chunk
   * @param {Object} queryIntent - Query intent
   * @returns {number} Relevance score (0-1)
   */
  calculateIntentRelevance(chunk, queryIntent) {
    if (!queryIntent) return 0.5;

    const text = chunk.text.toLowerCase();
    let relevance = 0;

    // Price-related queries
    if (queryIntent.intent?.includes('price') || queryIntent.intent?.includes('cost')) {
      if (text.includes('preço') || text.includes('price') || text.includes('€')) {
        relevance += 0.8;
      }
    }

    // Location-related queries
    if (queryIntent.intent?.includes('location') || queryIntent.intent?.includes('area')) {
      if (text.includes('localização') || text.includes('location') || text.includes('zone')) {
        relevance += 0.8;
      }
    }

    // Feature-related queries
    if (queryIntent.intent?.includes('feature') || queryIntent.intent?.includes('amenity')) {
      if (text.includes('comodidade') || text.includes('feature') || text.includes('amenity')) {
        relevance += 0.8;
      }
    }

    return Math.min(relevance, 1.0);
  }

  /**
   * Calculates information density of a chunk
   * @param {ContextChunk} chunk - Context chunk
   * @returns {number} Density score (0-1)
   */
  calculateInformationDensity(chunk) {
    const text = chunk.text;
    const tokens = encode(text).length;

    if (tokens === 0) return 0;

    // Count informative elements
    let informativeElements = 0;

    // Structured data indicators
    if (chunk.metadata?.price_eur || chunk.metadata?.beds || chunk.metadata?.type) {
      informativeElements += 2;
    }

    // Keywords indicating useful information
    const keywords = ['preço', 'localização', 'quartos', 'área', 'tipo', 'comodidades'];
    keywords.forEach(keyword => {
      if (text.toLowerCase().includes(keyword)) {
        informativeElements += 0.5;
      }
    });

    // Numbers (often indicate measurements, prices, etc.)
    const numberCount = (text.match(/\d+/g) || []).length;
    informativeElements += Math.min(numberCount * 0.1, 1);

    return Math.min(informativeElements / tokens * 100, 1);
  }

  /**
   * Truncates a chunk to fit within token budget
   * @param {ContextChunk} chunk - Context chunk
   * @param {number} maxTokens - Maximum tokens
   * @returns {ContextChunk|null} Truncated chunk or null
   */
  truncateChunk(chunk, maxTokens) {
    const text = chunk.text;
    const tokens = encode(text);

    if (tokens.length <= maxTokens) {
      return chunk;
    }

    // Try to truncate at sentence boundary
    const sentences = text.split(/[.!?]+/);
    let truncatedText = '';
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = encode(sentence).length;
      if (currentTokens + sentenceTokens <= maxTokens) {
        truncatedText += (truncatedText ? '. ' : '') + sentence;
        currentTokens += sentenceTokens;
      } else {
        break;
      }
    }

    if (truncatedText.length < text.length * 0.3) {
      // Too much truncation, skip this chunk
      return null;
    }

    return {
      ...chunk,
      text: truncatedText.trim(),
      metadata: { ...chunk.metadata, truncated: true }
    };
  }

  /**
   * Extracts key elements from chunks for aggressive compression
   * @param {ContextChunk[]} chunks - Input chunks
   * @param {Object} queryIntent - Query intent
   * @returns {Array} Key elements with text and importance
   */
  async extractKeyElements(chunks, queryIntent) {
    const elements = [];

    for (const chunk of chunks) {
      // Extract sentences containing important keywords
      const sentences = chunk.text.split(/[.!?]+/).filter(s => s.trim().length > 10);

      for (const sentence of sentences) {
        const importance = this.calculateSentenceImportance(sentence, queryIntent);
        if (importance > 0.3) {
          elements.push({
            text: sentence.trim(),
            importance,
            sourceChunk: chunk.id
          });
        }
      }
    }

    // Sort by importance and return top elements
    return elements
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 20); // Limit to top 20 elements
  }

  /**
   * Calculates importance score for a sentence
   * @param {string} sentence - Sentence text
   * @param {Object} queryIntent - Query intent
   * @returns {number} Importance score (0-1)
   */
  calculateSentenceImportance(sentence, queryIntent) {
    const text = sentence.toLowerCase();
    let importance = 0.1; // Base importance

    // Intent relevance
    importance += this.calculateIntentRelevance({ text }, queryIntent) * 0.5;

    // Keyword presence
    this.preserveKeywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        importance += 0.2;
      }
    });

    // Structured data indicators
    if (text.match(/\d+.*€|€\d+/)) importance += 0.3; // Price
    if (text.match(/\d+.*m²|m².*\d+/)) importance += 0.3; // Area
    if (text.match(/\d+.*quartos|quartos.*\d+/)) importance += 0.3; // Bedrooms

    return Math.min(importance, 1.0);
  }

  /**
   * Preserves structured data from original chunks
   * @param {ContextChunk[]} compressedChunks - Compressed chunks
   * @param {ContextChunk[]} originalChunks - Original chunks
   * @returns {ContextChunk[]} Chunks with preserved structured data
   */
  preserveStructuredData(compressedChunks, originalChunks) {
    // Extract structured data from original chunks
    const structuredData = originalChunks
      .filter(chunk => chunk.metadata && (
        chunk.metadata.price_eur ||
        chunk.metadata.beds ||
        chunk.metadata.type ||
        chunk.metadata.area_sqm
      ))
      .map(chunk => ({
        id: `structured_${chunk.id}`,
        text: this.formatStructuredData(chunk.metadata),
        metadata: { ...chunk.metadata, structured: true },
        score: chunk.score || 0.8
      }));

    // Add structured data chunks at the beginning
    return [...structuredData, ...compressedChunks];
  }

  /**
   * Formats structured metadata as readable text
   * @param {Object} metadata - Chunk metadata
   * @returns {string} Formatted text
   */
  formatStructuredData(metadata) {
    const parts = [];

    if (metadata.name) parts.push(`Nome: ${metadata.name}`);
    if (metadata.type) parts.push(`Tipo: ${metadata.type}`);
    if (metadata.beds) parts.push(`Quartos: ${metadata.beds}`);
    if (metadata.baths) parts.push(`Casas de banho: ${metadata.baths}`);
    if (metadata.price_eur) parts.push(`Preço: €${metadata.price_eur.toLocaleString('pt-PT')}`);
    if (metadata.area_sqm) parts.push(`Área: ${metadata.area_sqm}m²`);
    if (metadata.location) parts.push(`Localização: ${metadata.location}`);

    return parts.join('. ');
  }

  /**
   * Builds final compressed context from chunks
   * @param {ContextChunk[]} chunks - Compressed chunks
   * @returns {string} Final context string
   */
  buildCompressedContext(chunks) {
    return chunks
      .map(chunk => chunk.text)
      .filter(text => text && text.trim().length > 0)
      .join('\n\n---\n\n');
  }

  /**
   * Calculates total tokens in chunks
   * @param {ContextChunk[]} chunks - Input chunks
   * @returns {number} Total token count
   */
  calculateTotalTokens(chunks) {
    return chunks.reduce((total, chunk) => {
      return total + encode(chunk.text).length;
    }, 0);
  }

  /**
   * Calculates information preservation score
   * @param {ContextChunk[]} originalChunks - Original chunks
   * @param {ContextChunk[]} compressedChunks - Compressed chunks
   * @returns {number} Preservation score (0-1)
   */
  calculateInformationPreservation(originalChunks, compressedChunks) {
    if (originalChunks.length === 0) return 1.0;

    // Simple heuristic: ratio of chunks preserved
    const preservationRatio = compressedChunks.length / originalChunks.length;

    // Adjust based on token reduction
    const originalTokens = this.calculateTotalTokens(originalChunks);
    const compressedTokens = this.calculateTotalTokens(compressedChunks);
    const tokenRatio = originalTokens > 0 ? compressedTokens / originalTokens : 0;

    // Weighted average
    return (preservationRatio * 0.6) + (tokenRatio * 0.4);
  }

  /**
   * Creates empty compression result
   * @returns {CompressionResult} Empty result
   */
  createEmptyResult() {
    return {
      compressedContext: '',
      compressionRatio: 1.0,
      informationPreserved: 1.0,
      tokenSavings: 0,
      originalTokens: 0,
      finalTokens: 0,
      chunksProcessed: 0,
      chunksIncluded: 0
    };
  }
}

export default ContextCompressionEngine;