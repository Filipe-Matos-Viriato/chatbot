/**
 * @fileoverview Service for handling the document ingestion pipeline.
 * This service will be responsible for orchestrating the asynchronous
 * processing of documents, including text extraction, chunking, embedding,
 * and upserting into the vector database.
 */

const mammoth = require('mammoth');
const pdf = require('pdf-parse');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { Pinecone } = require('@pinecone-database/pinecone');

// Initialize clients (ensure these are consistent with rag-service.js)
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME);

const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

/**
 * Extracts text from a given file buffer based on its original name.
 * @param {Buffer} buffer The file buffer.
 * @param {string} originalname The original name of the file (to determine type).
 * @returns {Promise<string>} The extracted text.
 */
const extractText = async (buffer, originalname) => {
  if (originalname.endsWith('.docx')) {
    // Convert Node.js Buffer to Uint8Array and then to ArrayBuffer
    const uint8Array = new Uint8Array(buffer);
    const arrayBuffer = uint8Array.buffer;
    const { value } = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    return value;
  } else if (originalname.endsWith('.pdf')) {
    const data = await pdf(buffer);
    return data.text;
  } else {
    // Fallback for other text-based files, or throw an error for unsupported types
    return buffer.toString('utf8');
  }
};

/**
 * Extracts structured metadata from the document text.
 * @param {string} text The full text of the document.
 * @returns {object} An object containing extracted metadata.
 */
const extractStructuredMetadata = (text) => {
  const metadata = {};

  // Number of Bedrooms (T3, T4, or X quartos)
  let match = text.match(/T(\d+)/i);
  if (match) {
    metadata.num_bedrooms = parseInt(match[1], 10);
  } else {
    match = text.match(/(\d+)\s*quartos/i);
    if (match) {
      metadata.num_bedrooms = parseInt(match[1], 10);
    }
  }

  // Number of Bathrooms
  match = text.match(/(\d+)\s*casas de banho/i);
  if (match) {
    metadata.num_bathrooms = parseInt(match[1], 10);
  }

  // Total Area (m²)
  match = text.match(/Área:\s*([\d.,]+)\s*m²/i);
  if (match) {
    metadata.total_area_sqm = parseFloat(match[1].replace(',', '.'));
  }

  // Price (€)
  match = text.match(/Preço:\s*([\d.,]+)€/i);
  if (match) {
    metadata.price_eur = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
  }

  // Boolean features (presence of keywords)
  metadata.has_pool = /piscina/i.test(text);
  metadata.has_garden = /jardim/i.test(text);
  metadata.has_garage = /garagem/i.test(text);
  metadata.has_elevator = /elevador/i.test(text);
  metadata.has_balcony = /varanda/i.test(text);
  metadata.has_terrace = /terraço/i.test(text);
  metadata.has_gym = /ginásio/i.test(text);
  metadata.has_electric_car_charging = /carregamento elétrico/i.test(text);
  metadata.pets_allowed = /animais permitidos/i.test(text);

  // Location (simple extraction, might need refinement)
  // This is a very basic example, might need a list of known cities or more complex NLP
  if (/Porto/i.test(text)) metadata.location = 'Porto';
  if (/Aveiro/i.test(text)) metadata.location = 'Aveiro';
  if (/Lisboa/i.test(text)) metadata.location = 'Lisboa';


  return metadata;
};

/**
 * Processes a document by extracting text, chunking, embedding, and upserting into Pinecone.
 * @param {object} params - The parameters for document processing.
 * @param {object} params.clientConfig - The client-specific configuration.
 * @param {object} params.file - The file object containing buffer and originalname.
 * @param {string} params.ingestionType - The type of ingestion (e.g., 'listing', 'general').
 * @param {object} params.metadata - Additional metadata for the document.
 * @returns {Promise<object>} An object indicating success or failure.
 */
const processDocument = async ({
  clientConfig,
  file,
  ingestionType,
  metadata,
}) => {
  console.log(
    `[${clientConfig.clientId}] Starting document processing. Type: ${ingestionType}`
  );

  try {
    // Debugging: Log clientConfig.ingestionPipeline
    console.log(`[${clientConfig.clientId}] clientConfig.ingestionPipeline:`, JSON.stringify(clientConfig.ingestionPipeline, null, 2));

    // Extract chunking settings from clientConfig.ingestionPipeline
    const chunkingSettings = clientConfig.ingestionPipeline.find(
      (pipeline) => pipeline.name === 'template-chunker'
    )?.settings;

    // Debugging: Log chunkingSettings
    console.log(`[${clientConfig.clientId}] chunkingSettings:`, JSON.stringify(chunkingSettings, null, 2));


    const chunkSize = chunkingSettings?.chunkSize || 1000; // Default if not found
    const chunkOverlap = chunkingSettings?.chunkOverlap || 200; // Default if not found

    // 1. Extract text from the document
    const { originalname, buffer } = file;
    console.log(`[${clientConfig.clientId}] Extracting text from ${originalname}...`);
    const documentText = await extractText(buffer, originalname);

    // 2. Extract structured metadata
    console.log(`[${clientConfig.clientId}] Extracting structured metadata...`);
    const structuredMetadata = extractStructuredMetadata(documentText);
    console.log(`[${clientConfig.clientId}] Extracted metadata:`, JSON.stringify(structuredMetadata, null, 2));


    // 3. Chunk the text based on client's configuration
    console.log(`[${clientConfig.clientId}] Chunking document with chunkSize: ${chunkSize}, chunkOverlap: ${chunkOverlap}...`);
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: chunkSize,
      chunkOverlap: chunkOverlap,
    });
    const chunks = await textSplitter.splitText(documentText);

    // 4. Generate embeddings for each chunk and prepare for upsert
    console.log(`[${clientConfig.clientId}] Generating embeddings for ${chunks.length} chunks...`);
    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embeddingResult = await embeddingModel.embedContent({
        content: { parts: [{ text: chunk }] },
        taskType: "RETRIEVAL_DOCUMENT",
      });

      const vectorMetadata = {
        client_id: clientConfig.clientId,
        source: originalname,
        text: chunk, // Store the chunk text in metadata
        chunk_id: i,
        ...structuredMetadata, // Add extracted structured metadata
      };

      // Conditionally add listing_id and listing_url if they are not null
      if (metadata.listing_id !== null) {
        vectorMetadata.listing_id = metadata.listing_id;
      }
      if (metadata.listing_url) {
        vectorMetadata.listing_url = metadata.listing_url;
      }

      console.log(`[${clientConfig.clientId}] Metadata for vector ${i}:`, JSON.stringify(vectorMetadata, null, 2));

      vectors.push({
        id: `${clientConfig.clientId}-${originalname}-${i}`, // Unique ID for each chunk
        values: embeddingResult.embedding.values,
        metadata: vectorMetadata,
      });
    }

    // 5. Upsert chunks with metadata into the vector database
    console.log(
      `[${clientConfig.clientId}] Upserting ${
        vectors.length
      } vectors into Pinecone index '${process.env.PINECONE_INDEX_NAME}' namespace '${process.env.PINECONE_NAMESPACE}'...`
    );
    await pineconeIndex.namespace(process.env.PINECONE_NAMESPACE).upsert(vectors);

    console.log(`[${clientConfig.clientId}] Document processing completed successfully.`);
    return { success: true, message: 'Document processed successfully.' };
  } catch (error) {
    console.error(
      `[${clientConfig.clientId}] Error processing document:`,
      error
    );
    return { success: false, message: `Failed to process document: ${error.message}` };
  }
};

module.exports = {
  processDocument,
};