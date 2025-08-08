/**
 * @fileoverview Service for ingesting documents into Pinecone.
 * @filelocation packages/backend/src/services/ingestion-service-imoprime.js
 * @description Handles document processing, chunking, and embedding for the ImoPrime project.
 */

import { getEmbedding } from '../config/openai.js';
import pinecone from '../config/pinecone.js';
import { v4 as uuidv4 } from 'uuid';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
// PDF parsing handled conditionally

/**
 * Extracts text from various file types (PDF, TXT, etc.)
 */
export const extractText = async (fileBuffer, fileType, fileName) => {
  if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
    try {
      console.log(`Skipping PDF processing for ${fileName} - PDF parsing disabled`);
      return "PDF content placeholder. PDF parsing disabled.";
    } catch (err) {
      console.error(`Error extracting text from PDF ${fileName}:`, err);
      throw new Error(`Failed to extract text from PDF: ${err.message}`);
    }
  } 
  else if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
    return fileBuffer.toString('utf-8');
  }
  else if (fileType === 'application/json' || fileName.endsWith('.json')) {
    return fileBuffer.toString('utf-8');
  }
  else {
    throw new Error(`Unsupported file type: ${fileType || 'unknown'}`);
  }
};

/**
 * Processes a document for ingestion into Pinecone
 */
export const processDocument = async ({
  clientConfig: initialClientConfig,
  file,
  documentCategory,
  metadata,
  contextual_string, // Added parameter
}, dependencies = {}) => {
  const { extractText: extractTextFn = extractText } = dependencies;
  
  try {
    if (!file || !file.buffer) {
      return { success: false, message: 'No file or file buffer provided' };
    }

    // Default client config if not provided
    const clientConfig = initialClientConfig || { 
      clientId: 'default',
      clientName: 'Default Client',
      indexName: 'rachatbot-1536',
      chunkSize: 1000,
      chunkOverlap: 200
    };

    const fileName = file.originalname || 'unknown';
    const fileType = file.mimetype || (fileName.endsWith('.pdf') ? 'application/pdf' : 'text/plain');
    
    // Extract text from document
    const documentText = await extractTextFn(file.buffer, fileType, fileName);
    if (!documentText || documentText.trim() === '') {
      return { success: false, message: 'No text could be extracted from the document' };
    }

    // Generate a unique ID for this document
    const documentId = uuidv4();
    const indexName = clientConfig.indexName || 'rachatbot-1536';

    // Prepare metadata
    const metadataWithDefaults = {
      document_id: documentId,
      document_name: fileName,
      document_category: documentCategory || 'general',
      client_id: clientConfig.clientId,
      ...metadata
    };

    // Chunk the document
    const chunkSize = clientConfig.chunkSize || 1000;
    const chunkOverlap = clientConfig.chunkOverlap || 200;
    
    let chunks = [];
    try {
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: chunkSize,
        chunkOverlap: chunkOverlap,
      });
      chunks = await textSplitter.splitText(documentText);
      
      // Use contextual string if available
      if (contextual_string) {
        chunks.unshift(contextual_string);
      }
    } catch (chunkError) {
      console.error(`Error chunking document ${fileName}:`, chunkError);
      return { success: false, message: `Failed to chunk document: ${chunkError.message}` };
    }

    if (chunks.length === 0) {
      return { success: false, message: 'No chunks were generated from the document' };
    }

    // Get embeddings for each chunk
    const embeddingPromises = chunks.map(chunk => getEmbedding(chunk));
    const embeddingResults = await Promise.all(embeddingPromises);

    // Create PineconeRecord objects for each chunk
    const chunkId = `${clientConfig.clientId}_${documentId}`;
    const embeddingRecords = chunks.map((chunk, idx) => {
      // Clone the metadata for each chunk
      const chunkMetadata = { ...metadataWithDefaults };
      
      // Add additional fields
      chunkMetadata.chunk_index = idx;
      chunkMetadata.chunk = chunk; // Storing the raw text in metadata
      chunkMetadata.created_at = new Date().toISOString();
      
      // Include URL info in metadata if present
      if (metadataWithDefaults.url_pt) chunkMetadata.url_pt = metadataWithDefaults.url_pt;
      if (metadataWithDefaults.url_en) chunkMetadata.url_en = metadataWithDefaults.url_en;
      
      return {
        id: `${chunkId}_${idx}`,
        values: embeddingResults[idx],
        metadata: chunkMetadata,
      };
    });

    // Upsert to Pinecone
    try {
      const index = pinecone.Index(indexName);
      await index.upsert({
        upsertRequest: {
          vectors: embeddingRecords,
          namespace: clientConfig.clientId
        }
      });
      console.log(`Successfully upserted ${embeddingRecords.length} vectors to Pinecone for document ${fileName}`);
      return { success: true, message: `Document processed successfully with ${embeddingRecords.length} chunks` };
    } catch (pineconeError) {
      console.error(`Error upserting to Pinecone for document ${fileName}:`, pineconeError);
      return { success: false, message: `Failed to upsert to Pinecone: ${pineconeError.message}` };
    }
  } catch (error) {
    console.error('Error processing document:', error);
    return { success: false, message: `Document processing failed: ${error.message}` };
  }
};
