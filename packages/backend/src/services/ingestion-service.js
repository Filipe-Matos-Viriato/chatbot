/**
 * @fileoverview Service for handling the document ingestion pipeline.
 * This service will be responsible for orchestrating the asynchronous
 * processing of documents, including text extraction, chunking, embedding,
 * and upserting into the vector database.
 */

import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import { GoogleGenerativeAI } from '@google/generative-ai'; // Keep for other potential uses if needed
import OpenAI from 'openai'; // Import OpenAI
import { Pinecone } from '@pinecone-database/pinecone';
import supabase from '../config/supabase.js'; // Import Supabase client
import { getClientConfig } from './client-config-service.js'; // Import client config service
import listingService from './listing-service.js'; // Import listing service (default export)
import { createDevelopment, getDevelopmentById, getDevelopmentsByClientId, updateDevelopment, deleteDevelopment } from './development-service.js'; // Import named exports
import { v4 as uuidv4 } from 'uuid'; // For generating UUIDs

// Default instances (can be overridden for testing)
let defaultGenAI; // Keep for other potential uses if needed
let defaultOpenAI; // New OpenAI instance
let defaultPinecone;
let defaultPineconeIndex;
let defaultEmbeddingModel;

// Initialize default clients if not already initialized (for production/non-test use)
const initializeDefaultClients = () => {
  if (!defaultOpenAI) { // Initialize OpenAI
    defaultOpenAI = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  if (!defaultPinecone) {
    defaultPinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  }
  if (!defaultPineconeIndex) {
    defaultPineconeIndex = defaultPinecone.index(process.env.PINECONE_INDEX_NAME);
  }
  if (!defaultEmbeddingModel) {
    // Use OpenAI's embedding model
    defaultEmbeddingModel = {
      embedContent: async (params) => {
        const response = await defaultOpenAI.embeddings.create({
          model: "text-embedding-3-small",
          input: params.content.parts[0].text,
        });
        return { embedding: { values: response.data[0].embedding } };
      }
    };
  }
};

/**
 * Get the appropriate Pinecone index based on client config
 * @param {object} clientConfig The client configuration
 * @returns {object} The Pinecone index to use
 */
const getPineconeIndexForClient = (clientConfig) => {
  if (clientConfig && clientConfig.pineconeIndex) {
    console.log(`Using client-specific Pinecone index: ${clientConfig.pineconeIndex} for ingestion`);
    return defaultPinecone.index(clientConfig.pineconeIndex);
  }
  
  console.log(`Using default Pinecone index: ${process.env.PINECONE_INDEX_NAME} for ingestion`);
  return defaultPineconeIndex;
};

// Call this once to initialize defaults for non-test environments
initializeDefaultClients();

/**
 * Extracts text from a given file buffer based on its original name.
 * @param {Buffer} buffer The file buffer.
 * @param {string} originalname The original name of the file (to determine type).
 * @param {object} dependencies - Optional dependencies for testing (mammoth, pdf).
 * @returns {Promise<string>} The extracted text.
 */
const extractText = async (buffer, originalname, dependencies = {}) => {
  const {
    pdf, // pdf is now passed as a direct dependency from the calling script
  } = dependencies;

  if (originalname.endsWith('.pdf')) {
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
  const metadata = {
    listing_status: null, // Initialize with null
    current_state: null, // Initialize with null
  };

  // Check if the file is a JSON file and extract data directly
  if (originalname.endsWith('.json')) {
    try {
      const jsonData = JSON.parse(text);

      if (jsonData.preço !== undefined) {
        metadata.price_eur = parseFloat(String(jsonData.preço).replace(/\./g, '').replace(',', '.'));
        console.log(`[DEBUG] Price from JSON: ${metadata.price_eur}`); // Add debug log
      }
      if (jsonData.tipologia !== undefined) {
        metadata.num_bedrooms = parseInt(String(jsonData.tipologia).replace('T', ''), 10);
        // Infer type as "Apartamento" if tipologia exists and no explicit type is found yet
        if (metadata.type === undefined || metadata.type === null) { // Only infer if not already set
          metadata.type = 'Apartamento';
        }
      }
      if (jsonData.area_bruta_m2 !== undefined) {
        metadata.total_area_sqm = parseFloat(String(jsonData.area_bruta_m2));
      }

      // Extract num_bathrooms from "descricao.divisoes"
      // Extract num_bathrooms from "descricao.divisoes" (JSON specific)
      if (jsonData.descricao && Array.isArray(jsonData.descricao.divisoes)) {
        const bathroomDivision = jsonData.descricao.divisoes.find(
          (div) => div.nome && div.nome.toLowerCase().includes('casa de banho')
        );
        if (bathroomDivision) {
          metadata.num_bathrooms = 1; // Assuming one bathroom if "Casa de banho" is found
        }
      }

      // If a 'type' or 'Tipo' field exists in JSON, use it directly (overrides inferred type)
      if (jsonData.type !== undefined) {
        metadata.type = jsonData.type;
      } else if (jsonData.Tipo !== undefined) {
        metadata.type = jsonData.Tipo;
      }

      // Continue to apply regex extractions as fallbacks or for other metadata
      // Do NOT return early here.
    } catch (e) {
      console.error(`Error parsing JSON from ${originalname}:`, e);
      // Fallback to text-based extraction if JSON parsing fails
    }
  }

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

  // Number of Bathrooms (client-configurable or fallback)
  // Only apply if num_bathrooms was not set by JSON parsing
  if (metadata.num_bathrooms === undefined || metadata.num_bathrooms === null) {
    applyRegexExtraction('listingBaths', clientConfig.documentExtraction?.listingBaths?.pattern, 'num_bathrooms', (val) => parseInt(val, 10));
    if (metadata.num_bathrooms === undefined || metadata.num_bathrooms === null) { // Fallback to existing logic if not extracted by client config or previous regex
      match = text.match(/(\d+)\s*(?:casas de banho|WC|W\.C\.)/i);
      if (match) {
        metadata.num_bathrooms = parseInt(match[1], 10);
      } else {
        metadata.num_bathrooms = null;
      }
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
  applyRegexExtraction('listingName', clientConfig.documentExtraction?.listingName?.pattern, 'property_name');
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
  applyRegexExtraction('listingPrice', clientConfig.documentExtraction?.listingPrice?.pattern, 'price_eur', (val) => parseFloat(val.replace(/\./g, '').replace(',', '.')));
  if (metadata.price_eur === undefined || metadata.price_eur === null) { // Fallback to existing logic if not extracted by client config
    match = text.match(/Preço:\s*([\d.,]+)€/i);
    if (match) {
      metadata.price_eur = parseFloat(match[1].replace(/\./g, '').replace(',', '.'));
      console.log(`[DEBUG] Price from text regex: ${metadata.price_eur}`); // Add debug log
    }
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

  // Listing Status (e.g., 'available', 'reserved', 'sold')
  // Listing Status (e.g., 'available', 'reserved', 'sold')
  applyRegexExtraction('listingStatus', null, 'listing_status', (val) => val.toLowerCase());
  if (metadata.listing_status === null) { // Fallback to existing logic if not extracted by client config
    match = text.match(/(available|reserved|sold)/i);
    if (match) {
      metadata.listing_status = match[1].toLowerCase();
    }
  }

  // Current State (e.g., 'project', 'building', 'finished')
  applyRegexExtraction('currentState', null, 'current_state', (val) => val.toLowerCase());
  if (metadata.current_state === null) { // Fallback to existing logic if not extracted by client config
    match = text.match(/(project|building|finished)/i);
    if (match) {
      metadata.current_state = match[1].toLowerCase();
    }
  }

  // Ensure listing_status has a default value if not extracted
  if (metadata.listing_status === null) {
    metadata.listing_status = 'available'; // Default to 'available'
  }

  // Ensure current_state has a default value if not extracted
  if (metadata.current_state === null) {
    metadata.current_state = 'finished'; // Default to 'finished'
  }

  console.log(`[DEBUG] Final extracted metadata:`, JSON.stringify(metadata, null, 2));
  return metadata;
};

/**
 * Applies client-specific tagging rules to enrich vector metadata.
 * @param {string} documentText The full text of the document.
 * @param {string} originalname The original name of the file.
 * @param {object} taggingRules The client-specific tagging rules from clientConfig.
 * @param {object} currentMetadata The metadata object to enrich.
 * @returns {object} The enriched metadata object.
 */
const applyClientTaggingRules = (documentText, originalname, taggingRules, currentMetadata) => {
  const enrichedMetadata = { ...currentMetadata };
  const documentType = originalname.split('.').pop().toLowerCase();

  // Ensure taggingRules is an object, default to empty if null or undefined
  const rules = taggingRules || {};

  // Apply global tags
  if (rules.global_tags) {
    rules.global_tags.forEach(tag => {
      enrichedMetadata[tag.field] = tag.value;
    });
  }

  // Apply document type specific tags
  if (rules.document_type_tags) {
    for (const typeKey in rules.document_type_tags) {
      // Check if the document matches the type (e.g., 'json', 'text/docx')
      // This is a simplified check; a more robust solution might map file extensions to types
      if (typeKey.includes(documentType) || (typeKey === 'json' && ['json'].includes(documentType)) || (typeKey === 'text/docx' && ['txt', 'docx', 'pdf'].includes(documentType))) {
        const typeRules = rules.document_type_tags[typeKey];

        if (typeRules.source_type === 'json' && documentType === 'json') {
          try {
            const docJson = JSON.parse(documentText);
            typeRules.fields.forEach(fieldRule => {
              let value = docJson;
              if (fieldRule.path) {
                const pathParts = fieldRule.path.split('.');
                for (const part of pathParts) {
                  if (value && typeof value === 'object' && value.hasOwnProperty(part)) {
                    value = value[part];
                  } else {
                    value = undefined; // Path not found
                    break;
                  }
                }
              } else if (fieldRule.value !== undefined) {
                value = fieldRule.value;
              }

              if (value !== undefined && value !== null) {
                if (fieldRule.transform === 'array_to_string' && Array.isArray(value)) {
                  enrichedMetadata[fieldRule.name] = value.join(', ');
                } else if (fieldRule.regex) {
                  const regexMatch = String(value).match(new RegExp(fieldRule.regex));
                  if (regexMatch && regexMatch[1]) {
                    enrichedMetadata[fieldRule.name] = regexMatch[1];
                  } else {
                    enrichedMetadata[fieldRule.name] = value; // Fallback to original value if regex fails
                  }
                } else {
                  enrichedMetadata[fieldRule.name] = value;
                }
              }
            });
          } catch (e) {
            console.error(`Error parsing JSON for tagging: ${e.message}`);
          }
        } else if (typeRules.source_type === 'text/docx' && ['txt', 'docx', 'pdf'].includes(documentType)) {
          typeRules.regex_rules.forEach(rule => {
            const regex = new RegExp(rule.pattern, 'i');
            if (regex.test(documentText) || regex.test(originalname)) { // Check both content and filename
              enrichedMetadata[rule.tag_name] = rule.value || rule.pattern.replace(/\|/g, '/'); // Simple value or pattern
            }
          });
        }
      }
    }
  }
  return enrichedMetadata;
};

/**
 * Clean metadata for Pinecone compatibility by removing null values
 * @param {Object} metadata - The metadata object to clean
 * @returns {Object} - Cleaned metadata object
 */
const cleanMetadataForPinecone = (metadata) => {
  const cleaned = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== null && value !== undefined) {
      // Convert arrays to strings if they contain primitives
      if (Array.isArray(value)) {
        // Only keep arrays of strings, numbers, or booleans
        const validArray = value.filter(item => 
          typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean'
        );
        if (validArray.length > 0) {
          cleaned[key] = validArray;
        }
      } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        cleaned[key] = value;
      }
      // Skip objects and other complex types
    }
  }
  return cleaned;
};

/**
 * Processes a document by extracting text, chunking, embedding, and upserting into Pinecone.
 * @param {object} params - The parameters for document processing.
 * @param {object} params.clientConfig - The client-specific configuration.
 * @param {object} params.file - The file object containing buffer and originalname.
 * @param {string} params.documentCategory - The category of the document (e.g., 'client', 'development', 'listing').
 * @param {object} params.metadata - Additional metadata for the document (e.g., listing_id, development_id).
 * @returns {Promise<object>} An object indicating success or failure.
 */
const processDocument = async ({
  clientConfig: initialClientConfig,
  file,
  documentCategory,
  metadata,
}, dependencies = {}) => {
  const {
    // genAI = defaultGenAI, // No longer directly used for embeddings
    openai = defaultOpenAI, // Pass OpenAI instance
    pinecone = defaultPinecone,
    pineconeIndex = defaultPineconeIndex,
    embeddingModel = defaultEmbeddingModel,
    extractText: injectedExtractText, // Explicitly require extractText
    pdf, // Ensure pdf is destructured here
  } = dependencies;
const { originalname, buffer } = file;

  if (!injectedExtractText) {
    throw new Error('extractText dependency must be provided to processDocument');
  }

  // Defensive check: Ensure clientConfig is not undefined and has expected structure
  let clientConfig = initialClientConfig;
  if (!clientConfig || !clientConfig.chunking_rules) {
    console.error('Defensive check failed: clientConfig or chunking_rules is missing!', clientConfig);
    clientConfig = clientConfig || { chunking_rules: {}, documentExtraction: {} };
  }

  // Ensure default clients are initialized if not provided via dependencies
  initializeDefaultClients();

  console.log(
    `[${clientConfig.clientName || clientConfig.clientId}] Starting document processing. Category: ${documentCategory}`
  );

  try {
    console.log(`[${clientConfig.clientName || clientConfig.clientId}] clientConfig.chunking_rules:`, JSON.stringify(clientConfig.chunking_rules, null, 2));
    console.log('clientConfig at line 212:', clientConfig);

    // Determine chunking strategy based on document type and client config
    const documentType = originalname.split('.').pop().toLowerCase();
    // Ensure chunking_rules is an object, default to empty if null or undefined
    const chunkingRules = clientConfig.chunking_rules || {};
    const chunkingStrategy = chunkingRules?.document_types?.[documentType]?.strategy || 'semantic_paragraph';
    const chunkSize = chunkingRules?.document_types?.[documentType]?.max_tokens || 1000;
    const chunkOverlap = chunkingRules?.document_types?.[documentType]?.overlap_tokens || 200;

    
    console.log(`[${clientConfig.clientName || clientConfig.clientId}] Extracting text from ${originalname}...`);
    const documentText = await injectedExtractText(buffer, originalname, { pdf });

    let currentListingId = null;
    let currentDevelopmentId = null;
    let structuredMetadata = {};

    if (documentCategory === 'listing') {
      currentListingId = metadata.listing_id || null;
      currentDevelopmentId = metadata.development_id || null;

      // 2. Extract structured metadata for listings
      console.log(`[${clientConfig.clientName || clientConfig.clientId}] Extracting structured metadata for listing...`);
      structuredMetadata = extractStructuredMetadata(documentText, originalname, clientConfig);
      console.log(`[${clientConfig.clientName || clientConfig.clientId}] Extracted metadata:`, JSON.stringify(structuredMetadata, null, 2));

      // Prepare amenities array from boolean flags
      const amenitiesArray = Object.keys(structuredMetadata).filter(key =>
        key.startsWith('has_') && structuredMetadata[key]
      ).map(key => key.replace('has_', '').replace(/_/g, ' '));

      const listingData = {
        name: structuredMetadata.property_name || originalname,
        address: structuredMetadata.address || null,
        type: structuredMetadata.type || null, // Use the extracted type
        price: structuredMetadata.price_eur || null, // Pass as number directly
        beds: structuredMetadata.num_bedrooms || null,
        baths: structuredMetadata.num_bathrooms || null, // Use the extracted bathrooms
        amenities: amenitiesArray.length > 0 ? amenitiesArray : null,
        listing_status: structuredMetadata.listing_status || null,
        current_state: structuredMetadata.current_state || null,
        development_id: currentDevelopmentId, // Use currentDevelopmentId
        client_id: clientConfig.clientId,
        client_name: clientConfig.clientName || null, // Add client_name
      };

      if (currentListingId) {
        // Update existing listing
        try {
          const updatedListing = await listingService.updateListing(currentListingId, listingData);
          console.log(`[${clientConfig.clientName || clientConfig.clientId}] Listing ${currentListingId} updated in Supabase.`);
        } catch (error) {
          console.error(`[${clientConfig.clientName || clientConfig.clientId}] Error updating listing ${currentListingId} in Supabase:`, error);
          throw new Error(`Failed to update listing: ${error.message}`);
        }
      } else {
        // Create new listing
        listingData.id = uuidv4(); // Generate UUID for new listing
        try {
          const listing = await listingService.createListing(listingData);
          if (listing) {
            currentListingId = listing.id;
            console.log(`[${clientConfig.clientName || clientConfig.clientId}] New listing ${currentListingId} created in Supabase.`);
          } else {
            throw new Error(`Failed to create listing: listing object is undefined.`);
          }
        } catch (error) {
          console.error(`[${clientConfig.clientName || clientConfig.clientId}] Error creating new listing in Supabase:`, error);
          throw new Error(`Failed to create listing: ${error.message}`);
        }
      }

      // Upsert listing metrics to Supabase 'listing_metrics' table
      const { error: metricsUpsertError } = await supabase
        .from('listing_metrics')
        .upsert({
          listing_id: currentListingId,
          engaged_users: 0, // Initialize to 0, matches schema
          inquiries: 0,     // Initialize to 0
          unacknowledged_hot_leads: 0,     // Initialize to 0
          conversion_rate: 0, // Initialize to 0, matches schema (numeric)
          lead_score_distribution_hot: 0,
          lead_score_distribution_warm: 0,
          lead_score_distribution_cold: 0,
          total_conversions: 0, // Add, matches schema
          client_id: clientConfig.clientId, // Add, matches schema
          // updated_at will default on the database side
        }, { onConflict: 'listing_id' }); // Upsert based on 'listing_id'

      if (metricsUpsertError) {
        console.error(`[${clientConfig.clientName || clientConfig.clientId}] Error upserting listing metrics to Supabase:`, metricsUpsertError);
      } else {
        console.log(`[${clientConfig.clientName || clientConfig.clientId}] Listing metrics for ${currentListingId} upserted to Supabase.`);
      }
    } else if (documentCategory === 'development') {
      currentDevelopmentId = metadata.development_id || null;
      if (!currentDevelopmentId) {
        // Create new development if ID not provided
        console.log(`[${clientConfig.clientName || clientConfig.clientId}] Creating new development in Supabase...`);
        const developmentResult = await createDevelopment({ // Use named import
          name: originalname.replace(/\.(pdf|docx)$/i, ''), // Use filename as name
          client_id: clientConfig.clientId,
        });
        if (developmentResult.error) {
          console.error(`[${clientConfig.clientName || clientConfig.clientId}] Error creating new development in Supabase:`, developmentResult.error);
          throw new Error(`Failed to create development: ${developmentResult.error.message}`);
        }
        currentDevelopmentId = developmentResult.id;
        console.log(`[${clientConfig.clientName || clientConfig.clientId}] New development ${currentDevelopmentId} created in Supabase.`);
      } else {
        console.log(`[${clientConfig.clientName || clientConfig.clientId}] Using existing development ID: ${currentDevelopmentId}.`);
      }
    }
    // For 'client' documents, currentListingId and currentDevelopmentId will remain null

    // 3. Chunk the text based on client's configuration
    console.log(`[${clientConfig.clientName || clientConfig.clientId}] Chunking document with strategy: ${chunkingStrategy}, chunkSize: ${chunkSize}, chunkOverlap: ${chunkOverlap}...`);
    let chunks = [];
    if (chunkingStrategy === 'whole_document') {
      chunks = [documentText];
    } else {
      const textSplitter = new RecursiveCharacterTextSplitter({
        chunkSize: chunkSize,
        chunkOverlap: chunkOverlap,
      });
      chunks = await textSplitter.splitText(documentText);
    }

    // 4. Generate embeddings for each chunk and prepare for upsert
    console.log(`[${clientConfig.clientName || clientConfig.clientId}] Generating embeddings for ${chunks.length} chunks...`);
    const vectors = [];
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const embeddingResult = await embeddingModel.embedContent({ // Use the new embeddingModel structure
        content: { parts: [{ text: chunk }] },
        // taskType is not used by OpenAI embeddings, remove if not needed elsewhere
      });

      const vectorMetadata = {
        client_id: clientConfig.clientId,
        source: originalname,
        text: chunk, // Store the chunk text in metadata
        chunk_id: i,
        // Apply structured metadata and client-defined tagging rules
        ...structuredMetadata, // Keep existing structured metadata
      };

      // Conditionally add listing_id and development_id based on category
      if (documentCategory === 'listing' && currentListingId) {
        vectorMetadata.listing_id = currentListingId;
      }
      if ((documentCategory === 'development' || documentCategory === 'listing') && currentDevelopmentId) {
        vectorMetadata.development_id = currentDevelopmentId;
      }

      // Apply client-specific tagging rules to enrich the metadata
      const finalVectorMetadata = applyClientTaggingRules(documentText, originalname, clientConfig.tagging_rules, vectorMetadata);

      // Clean null values from metadata for Pinecone compatibility
      const cleanedMetadata = cleanMetadataForPinecone(finalVectorMetadata);

      console.log(`[${clientConfig.clientName || clientConfig.clientId}] Metadata for vector ${i}:`, JSON.stringify(cleanedMetadata, null, 2));

      vectors.push({
        id: `${clientConfig.clientId}-${originalname}-${i}`, // Unique ID for each chunk
        values: embeddingResult.embedding.values,
        metadata: cleanedMetadata,
      });
    }

    // 5. Upsert chunks with metadata into the vector database
    // Get the client-specific index if available
    const index = dependencies.pineconeIndex || getPineconeIndexForClient(clientConfig);
    const indexName = clientConfig.pineconeIndex || process.env.PINECONE_INDEX_NAME;
    
    console.log(
      `[${clientConfig.clientName || clientConfig.clientId}] Upserting ${
      vectors.length
      } vectors into Pinecone index '${indexName}' namespace '${process.env.PINECONE_NAMESPACE}'...`
    );
    await index.namespace(process.env.PINECONE_NAMESPACE).upsert(vectors);

    console.log(`[${clientConfig.clientName || clientConfig.clientId}] Document processing completed successfully.`);
    return { success: true, message: 'Document processed successfully.' };
  } catch (error) {
    console.error(
      `[${clientConfig.clientName || clientConfig.clientId}] Error processing document:`,
      error
    );
    return { success: false, message: `Failed to process document: ${error.message}` };
  }
};

export {
  processDocument,
  extractText, // Export extractText for testing and potential external use
  extractStructuredMetadata, // Export for testing and potential external use
  applyClientTaggingRules, // Export for testing
};