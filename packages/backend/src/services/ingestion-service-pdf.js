/**
 * @fileoverview Simple PDF/Text ingestion service
 * - Extracts text from PDF (pdf-parse) or plaintext
 * - Chunks text (LangChain)
 * - Embeds with OpenAI (text-embedding-3-small)
 * - Upserts to Pinecone using client-specific index if configured
 * - Optionally logs document metadata to Supabase (if table exists)
 */

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import openai from '../config/openai.js';
import supabase from '../config/supabase.js';
import { Pinecone } from '@pinecone-database/pinecone';
import { extractStructuredListingData } from './nlp-extraction-service.js';

const EMBEDDING_MODEL = 'text-embedding-3-small';

async function getEmbeddingVector(text) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
  });
  return response.data[0].embedding;
}

async function extractText(buffer, mimeType, fileName) {
  if ((mimeType && mimeType.includes('pdf')) || (fileName && fileName.toLowerCase().endsWith('.pdf'))) {
    // Lazy-load pdfjs-dist only when needed to avoid serverless init issues
    const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
    // Extract text using pdfjs-dist
    // Force plain Uint8Array (Buffer subclasses can trigger pdfjs checks)
    let data;
    if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
      data = new Uint8Array(buffer); // copy into a plain Uint8Array
    } else if (buffer instanceof Uint8Array) {
      // Ensure it's not a Node Buffer subclass
      data = (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) ? new Uint8Array(buffer) : buffer;
    } else if (buffer?.buffer) {
      data = new Uint8Array(buffer.buffer, buffer.byteOffset || 0, buffer.byteLength || buffer.length || 0);
    } else {
      throw new Error('Unsupported binary type for PDF extraction');
    }
    const loadingTask = getDocument({ data });
    const pdf = await loadingTask.promise;
    let fullText = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const strings = content.items.map((it) => (typeof it.str === 'string' ? it.str : '')).join(' ');
      fullText += strings + '\n';
    }
    return fullText;
  }
  // Fallback to plain text when not PDF
  return buffer.toString('utf-8');
}

function getIndexName(clientConfig) {
  return clientConfig?.pineconeIndex || 'rachatbot-1536';
}

function getChunkingParams(clientConfig) {
  return {
    chunkSize: clientConfig?.chunkSize || 1000,
    chunkOverlap: clientConfig?.chunkOverlap || 200,
  };
}

/**
 * Ingest a single document
 * @param {object} params
 * @param {object} params.clientConfig - client configuration object
 * @param {object} params.file - Multer file object with in-memory buffer
 * @param {string} params.documentCategory - 'client' | 'development' | 'listing' | 'general'
 * @param {object} params.metadata - optional extra metadata (listing_id, development_id, etc.)
 */
export async function processDocument({ clientConfig, file, documentCategory, metadata = {} }) {
  try {
    if (!file || !file.buffer) {
      return { success: false, message: 'No file or file buffer provided' };
    }

    const indexName = getIndexName(clientConfig);
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const index = pinecone.index(indexName);

    const fileName = file.originalname || 'document.pdf';
    const mimeType = file.mimetype || 'application/pdf';

    // 1) Extract text
    const fullText = (await extractText(file.buffer, mimeType, fileName))?.trim();
    if (!fullText) {
      return { success: false, message: 'No textual content extracted from document' };
    }

    // 2) Chunk
    const { chunkSize, chunkOverlap } = getChunkingParams(clientConfig);
    const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });
    const chunks = await splitter.splitText(fullText);
    if (!chunks || chunks.length === 0) {
      return { success: false, message: 'No chunks generated from document' };
    }

    // 3) Embed chunks
    const vectors = await Promise.all(
      chunks.map(async (text, idx) => {
        const values = await getEmbeddingVector(text);
        // NLP: extract structured fields to enrich metadata for filtering
        const structuredRaw = await extractStructuredListingData(text);
        const structured = Object.fromEntries(
          Object.entries(structuredRaw).filter(([, v]) => v !== null && v !== undefined)
        );
        return {
          id: `${clientConfig.clientId || 'client'}.${Date.now()}.${idx}`,
          values,
          metadata: {
            client_id: clientConfig.clientId,
            document_category: documentCategory || 'general',
            document_name: fileName,
            text, // IMPORTANT: rag-service expects metadata.text
            ...structured,
            ...(metadata || {}),
          },
        };
      })
    );

    // 4) Upsert to Pinecone (namespace = client)
    await index.upsert(vectors, { namespace: clientConfig.clientId });

    // 5) Best-effort: log document metadata to Supabase if table exists
    try {
      await supabase
        .from('documents')
        .insert([
          {
            client_id: clientConfig.clientId,
            document_name: fileName,
            document_category: documentCategory || 'general',
            listing_id: metadata?.listing_id || null,
            development_id: metadata?.development_id || null,
          },
        ]);
    } catch (err) {
      // If the table doesn't exist or RLS prevents insert, log and continue
      console.warn('[ingestion] Supabase document log skipped:', err?.message);
    }

    return { success: true, message: `Ingested ${vectors.length} chunks to ${indexName}` };
  } catch (error) {
    console.error('[ingestion] Failed to process document:', error);
    return { success: false, message: error.message };
  }
}

export default { processDocument };


