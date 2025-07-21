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
const supabase = require('../config/supabase'); // Import Supabase client
const { getClientConfig } = require('./client-config-service'); // Import client config service

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
 * @param {string} originalname The original name of the file (to determine type).
 * @param {object} clientConfig The client-specific configuration.
 * @returns {object} An object containing extracted metadata.
 */
const extractStructuredMetadata = (text, originalname, clientConfig) => {
  const metadata = {};

  // Helper function to apply regex extraction
  const applyRegexExtraction = (field, pattern, targetMetadataKey, parseFn = (val) => val) => {
    if (clientConfig.documentExtraction && clientConfig.documentExtraction[field] && clientConfig.documentExtraction[field].pattern) {
      const regex = new RegExp(clientConfig.documentExtraction[field].pattern, 'i');
      const match = text.match(regex);
      if (match && match[1]) { // Assuming the value to extract is in the first capturing group
        metadata[targetMetadataKey] = parseFn(match[1]);
      }
    }
  };

  // Number of Bedrooms (T3, T4, or X quartos) - Keep existing logic for now, as it's not client-configurable yet
  let match = text.match(/T(\d+)/i);
  if (match) {
    metadata.num_bedrooms = parseInt(match[1], 10);
  } else {
    match = text.match(/(\d+)\s*quartos/i);
    if (match) {
      metadata.num_bedrooms = parseInt(match[1], 10);
    }
  }

  // Number of Bathrooms (client-configurable)
  applyRegexExtraction('listingBaths', null, 'num_bathrooms', (val) => parseInt(val, 10));
  if (metadata.num_bathrooms === undefined) { // Fallback to existing logic if not extracted by client config
    match = text.match(/(\d+)\s*(?:casas de banho|WC|W\.C\.)/i);
    if (match) {
      metadata.num_bathrooms = parseInt(match[1], 10);
    } else {
      metadata.num_bathrooms = null;
    }
  }
  console.log(`Extracted num_bathrooms: ${metadata.num_bathrooms}`);

  // Property Type (e.g., Apartamento, Moradia, Vivenda, Casa, Escritório, Loja, Terreno)
  match = text.match(/(Apartamento|Moradia|Vivenda|Casa|Escritório|Loja|Terreno)/i);
  if (match) {
    metadata.type = match[1];
  } else {
    metadata.type = null;
  }
  console.log(`Extracted type: ${metadata.type}`);

  // Address (more robust extraction)
  // Look for "Localização:" or "Morada:" followed by text until a newline or specific delimiter
  match = text.match(/(Localização|Morada):\s*([^\n,]+(?:,[^\n,]+){0,2})/i); // Capture up to 3 parts of an address
  if (match) {
    metadata.address = match[2].trim();
  } else {
    // Fallback: look for common address components like "Rua", "Avenida" followed by numbers/names
    match = text.match(/(Rua|Avenida|Travessa|Praça)\s+[^.\n]+,\s*\d+/i);
    if (match) {
      metadata.address = match[0].trim();
    } else {
      metadata.address = null;
    }
  }
  console.log(`Extracted address: ${metadata.address}`);

  // Property Name (client-configurable)
  applyRegexExtraction('listingName', null, 'property_name');
  if (metadata.property_name === undefined) { // Fallback to existing logic if not extracted by client config
    match = text.match(/^(.+?)\n\n/); // Capture text before first double newline
    if (match) {
      metadata.property_name = match[1].trim();
    } else {
      // Fallback to filename without extension if no clear title is found
      metadata.property_name = originalname.replace(/\.pdf$/, '');
    }
  }
  console.log(`Extracted property_name: ${metadata.property_name}`);

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
    const structuredMetadata = extractStructuredMetadata(documentText, originalname, clientConfig); // Pass originalname and clientConfig
    console.log(`[${clientConfig.clientId}] Extracted metadata:`, JSON.stringify(structuredMetadata, null, 2));

    // Prepare amenities array from boolean flags
    const amenitiesArray = Object.keys(structuredMetadata).filter(key =>
      key.startsWith('has_') && structuredMetadata[key]
    ).map(key => key.replace('has_', '').replace(/_/g, ' '));

    // 2.5. Upsert listing data to Supabase 'listings' table if listing_id is present
    if (metadata.listing_id) {
      const { error: upsertError } = await supabase
        .from('listings')
        .upsert({
          id: metadata.listing_id,
          name: structuredMetadata.property_name || originalname, // Use extracted property_name
          address: structuredMetadata.address || null,
          type: structuredMetadata.type || null,
          price: structuredMetadata.price_eur ? structuredMetadata.price_eur.toString() : null, // Convert number to string
          beds: structuredMetadata.num_bedrooms || null,
          baths: structuredMetadata.num_bathrooms || null,
          amenities: amenitiesArray.length > 0 ? amenitiesArray : null,
          // created_at will default on the database side
        }, { onConflict: 'id' }); // Upsert based on 'id'

      if (upsertError) {
        console.error(`[${clientConfig.clientId}] Error upserting listing to Supabase:`, upsertError);
      } else {
        console.log(`[${clientConfig.clientId}] Listing ${metadata.listing_id} upserted to Supabase.`);
      }

      // Upsert listing metrics to Supabase 'listing_metrics' table
      const { error: metricsUpsertError } = await supabase
        .from('listing_metrics')
        .upsert({
          listing_id: metadata.listing_id,
          chatbot_views: 0, // Initialize to 0
          inquiries: 0,     // Initialize to 0
          hot_leads: 0,     // Initialize to 0
          conversion_rate: '0%', // Initialize to '0%'
          lead_score_distribution_hot: 0,
          lead_score_distribution_warm: 0,
          lead_score_distribution_cold: 0,
          // updated_at will default on the database side
        }, { onConflict: 'listing_id' }); // Upsert based on 'listing_id'

      if (metricsUpsertError) {
        console.error(`[${clientConfig.clientId}] Error upserting listing metrics to Supabase:`, metricsUpsertError);
      } else {
        console.log(`[${clientConfig.clientId}] Listing metrics for ${metadata.listing_id} upserted to Supabase.`);
      }
    }

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