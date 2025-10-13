// packages/backend/src/utils/semantic-deduplication-engine.js
// Removes semantically similar chunks using embedding-based similarity
// Relevant files: context.js, rag-service.js

import OpenAI from 'openai';

/**
 * @typedef {Object} ContextChunk
 * @property {string} id - Unique chunk identifier
 * @property {string} text - Chunk text content
 * @property {Object} metadata - Chunk metadata
 * @property {number} score - Relevance score
 * @property {number[]} [embeddings] - Text embeddings
 */

/**
 * Semantic Deduplication Engine
 * Uses embeddings to identify and remove semantically similar chunks
 */
class SemanticDeduplicationEngine {
  constructor(options = {}) {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.similarityThreshold = options.similarityThreshold || 0.85;
    this.embeddingModel = options.embeddingModel || 'text-embedding-3-small';
    this.batchSize = options.batchSize || 100;
  }

  /**
   * Removes semantically duplicate chunks from the input array
   * @param {ContextChunk[]} chunks - Input context chunks
   * @returns {Promise<ContextChunk[]>} Deduplicated chunks
   */
  async deduplicateChunks(chunks) {
    if (!chunks || chunks.length <= 1) {
      return chunks || [];
    }

    console.log(`[SemanticDeduplication] Processing ${chunks.length} chunks for deduplication`);

    try {
      // Generate embeddings if not present
      const chunksWithEmbeddings = await this.ensureEmbeddings(chunks);

      // Perform deduplication
      const deduplicated = await this.performDeduplication(chunksWithEmbeddings);

      console.log(`[SemanticDeduplication] Reduced ${chunks.length} chunks to ${deduplicated.length} unique chunks`);

      return deduplicated;
    } catch (error) {
      console.error('[SemanticDeduplication] Error during deduplication:', error);
      // Return original chunks on error to avoid breaking the pipeline
      return chunks;
    }
  }

  /**
   * Ensures all chunks have embeddings
   * @param {ContextChunk[]} chunks - Input chunks
   * @returns {Promise<ContextChunk[]>} Chunks with embeddings
   */
  async ensureEmbeddings(chunks) {
    const chunksNeedingEmbeddings = chunks.filter(chunk => !chunk.embeddings);

    if (chunksNeedingEmbeddings.length === 0) {
      return chunks;
    }

    console.log(`[SemanticDeduplication] Generating embeddings for ${chunksNeedingEmbeddings.length} chunks`);

    // Process in batches to avoid rate limits
    const batches = this.chunkArray(chunksNeedingEmbeddings, this.batchSize);

    for (const batch of batches) {
      try {
        const texts = batch.map(chunk => this.prepareTextForEmbedding(chunk.text));
        const response = await this.openai.embeddings.create({
          model: this.embeddingModel,
          input: texts
        });

        // Assign embeddings to chunks
        batch.forEach((chunk, index) => {
          chunk.embeddings = response.data[index].embedding;
        });

        // Small delay between batches to respect rate limits
        if (batches.length > 1) {
          await this.delay(100);
        }
      } catch (error) {
        console.error('[SemanticDeduplication] Error generating embeddings for batch:', error);
        // Continue with other batches
      }
    }

    return chunks;
  }

  /**
   * Performs the actual deduplication using embeddings
   * @param {ContextChunk[]} chunks - Chunks with embeddings
   * @returns {Promise<ContextChunk[]>} Deduplicated chunks
   */
  async performDeduplication(chunks) {
    const deduplicated = [];
    const processedIds = new Set();

    for (const chunk of chunks) {
      // Skip if already processed
      if (processedIds.has(chunk.id)) {
        continue;
      }

      // Check similarity with already selected chunks
      let isDuplicate = false;
      for (const selectedChunk of deduplicated) {
        if (this.calculateSimilarity(chunk.embeddings, selectedChunk.embeddings) >= this.similarityThreshold) {
          isDuplicate = true;

          // Keep the higher-scoring chunk
          if ((chunk.score || 0) > (selectedChunk.score || 0)) {
            // Replace the selected chunk with this one
            const index = deduplicated.indexOf(selectedChunk);
            deduplicated[index] = chunk;
          }

          break;
        }
      }

      if (!isDuplicate) {
        deduplicated.push(chunk);
        processedIds.add(chunk.id);
      }
    }

    return deduplicated;
  }

  /**
   * Calculates cosine similarity between two embedding vectors
   * @param {number[]} embedding1 - First embedding vector
   * @param {number[]} embedding2 - Second embedding vector
   * @returns {number} Similarity score (0-1)
   */
  calculateSimilarity(embedding1, embedding2) {
    if (!embedding1 || !embedding2 || embedding1.length !== embedding2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < embedding1.length; i++) {
      dotProduct += embedding1[i] * embedding2[i];
      norm1 += embedding1[i] * embedding1[i];
      norm2 += embedding2[i] * embedding2[i];
    }

    norm1 = Math.sqrt(norm1);
    norm2 = Math.sqrt(norm2);

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (norm1 * norm2);
  }

  /**
   * Prepares text for embedding generation
   * @param {string} text - Raw text
   * @returns {string} Prepared text
   */
  prepareTextForEmbedding(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Clean and truncate text for embedding
    let cleaned = text
      .replace(/\s+/g, ' ')  // Normalize whitespace
      .trim();

    // Truncate to reasonable length (embeddings work better with focused content)
    const maxLength = 1000;
    if (cleaned.length > maxLength) {
      cleaned = cleaned.substring(0, maxLength);
      // Try to cut at sentence boundary
      const lastSentenceEnd = cleaned.lastIndexOf('.');
      if (lastSentenceEnd > maxLength * 0.8) {
        cleaned = cleaned.substring(0, lastSentenceEnd + 1);
      }
    }

    return cleaned;
  }

  /**
   * Splits array into chunks of specified size
   * @param {Array} array - Array to chunk
   * @param {number} size - Chunk size
   * @returns {Array[]} Array of chunks
   */
  chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Small delay utility
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise} Delay promise
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Gets deduplication statistics
   * @param {ContextChunk[]} originalChunks - Original chunks
   * @param {ContextChunk[]} deduplicatedChunks - Deduplicated chunks
   * @returns {Object} Statistics
   */
  getDeduplicationStats(originalChunks, deduplicatedChunks) {
    const originalCount = originalChunks.length;
    const finalCount = deduplicatedChunks.length;
    const reduction = originalCount - finalCount;
    const reductionPercentage = originalCount > 0 ? (reduction / originalCount) * 100 : 0;

    return {
      originalCount,
      finalCount,
      duplicatesRemoved: reduction,
      reductionPercentage: Math.round(reductionPercentage * 100) / 100,
      averageSimilarity: this.calculateAverageSimilarity(deduplicatedChunks)
    };
  }

  /**
   * Calculates average similarity within a set of chunks
   * @param {ContextChunk[]} chunks - Chunks to analyze
   * @returns {number} Average similarity score
   */
  calculateAverageSimilarity(chunks) {
    if (chunks.length < 2) {
      return 1.0;
    }

    let totalSimilarity = 0;
    let pairCount = 0;

    for (let i = 0; i < chunks.length; i++) {
      for (let j = i + 1; j < chunks.length; j++) {
        if (chunks[i].embeddings && chunks[j].embeddings) {
          totalSimilarity += this.calculateSimilarity(chunks[i].embeddings, chunks[j].embeddings);
          pairCount++;
        }
      }
    }

    return pairCount > 0 ? totalSimilarity / pairCount : 0;
  }
}

export default SemanticDeduplicationEngine;