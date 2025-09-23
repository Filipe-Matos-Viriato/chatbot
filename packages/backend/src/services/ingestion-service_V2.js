// packages/backend/src/services/ingestion-service_V2.js
// This file implements the Enriched Ingestion Service (V2), a sophisticated service for processing structured data from the Supabase listings table.
// It generates precise, semantically-aware text chunks and metadata tags based on client-specific rules stored in the clients table, then vectorizes and upserts to Pinecone.
// Relevant files: packages/backend/src/services/client-config-service.js, packages/backend/src/services/listing-service.js, packages/backend/src/rag-service.js

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { Pinecone } from '@pinecone-database/pinecone';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Pinecone client
const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

/**
 * Cleans LLM response by removing markdown code block wrappers if present.
 * @param {string} content - The raw LLM response content.
 * @returns {string} Cleaned content ready for JSON parsing.
 */
function cleanJsonResponse(content) {
  if (content.startsWith('```json') && content.endsWith('```')) {
    return content.slice(7, -3).trim();
  }
  return content;
}

/**
 * Fetches client-specific configuration from the Supabase clients table.
 * @param {string} clientId - The client ID.
 * @returns {object} Client configuration object containing chunking_rules, tagging_rules, and document_extraction.
 */
async function fetchClientConfiguration(clientId) {
  const { data, error } = await supabase
    .from('clients')
    .select('chunking_rules, tagging_rules, document_extraction, listing_tagging_prompt')
    .eq('client_id', clientId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch client configuration: ${error.message}`);
  }

  return data;
}

/**
 * Fetches listings from the Supabase listings table, filtered by client_id and optional development_id or listing_id.
 * @param {string} clientId - The client ID.
 * @param {string|null} developmentId - Optional development ID to filter listings.
 * @param {string|null} listingId - Optional specific listing ID to fetch.
 * @param {number} batchSize - Number of listings to fetch.
 * @param {number} offset - The starting offset for pagination.
 * @returns {array} Array of listing objects.
 */
async function fetchListings(clientId, developmentId, listingId, batchSize, offset) {
  let query = supabase
    .from('listings')
    .select('*')
    .eq('client_id', clientId);

  if (developmentId) {
    query = query.eq('development_id', developmentId);
  }

  if (listingId) {
    query = query.eq('id', listingId);
  }

  // Use range for pagination only if not filtering by specific listingId
  if (!listingId) {
    query = query.range(offset, offset + batchSize - 1);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch listings: ${error.message}`);
  }

  return data;
}

/**
 * Creates a metadata summary chunk for listings without descriptions.
 * @param {object} listing - The listing object.
 * @returns {string} A summary string of the listing's metadata.
 */
function createMetadataSummary(listing) {
  // explain what this function does: creates a textual summary of the listing's key metadata for embedding when no description is available
  const summary = `This is a ${listing.type || 'property'} located at ${listing.address || 'unknown address'}. ` +
    `It has ${listing.beds || 'unknown'} bedrooms, ${listing.baths || 'unknown'} bathrooms, ` +
    `and is ${listing.duplex ? 'a duplex' : 'not a duplex'}. ` +
    `The listing status is ${listing.listing_status || 'unknown'}, current state is ${listing.current_state || 'unknown'}, ` +
    `with a total area of ${listing.total_area || 'unknown'} sqm and private area of ${listing.private_area || 'unknown'} sqm. ` +
    `Amenities include: ${listing.amenities || 'none specified'}. ` +
    `Price: ${listing.price ? `${listing.price} EUR` : 'not specified'}.`;

  return summary;
}

/**
 * Generates propositional chunks from the listing description using configurable LLM prompt.
 * @param {string} description - The listing description.
 * @param {object} clientConfig - The client configuration object.
 * @returns {array} Array of chunk strings.
 */
async function getPropositionalChunks(description, clientConfig) {
  // explain what this function does: uses the client's chunking prompt to break down the description into propositional chunks via LLM
  const chunkingPrompt = clientConfig.chunking_rules?.prompt || 'Break down this property description into propositional chunks, each representing a distinct aspect or proposition. Return as a JSON array of strings.';

  const response = await openai.chat.completions.create({
    model: 'gpt-4o', // using GPT-4o for chunking
    messages: [
      { role: 'system', content: chunkingPrompt },
      { role: 'user', content: description }
    ],
    temperature: 0.1, // low temperature for consistent chunking
  });

  const rawContent = response.choices[0].message.content;
  const content = cleanJsonResponse(rawContent);
  let chunks;
  try {
    chunks = JSON.parse(content);
    if (!Array.isArray(chunks)) {
      throw new Error('Response is not an array');
    }
  } catch (error) {
    console.error('Failed to parse LLM response as JSON array:', rawContent);
    // Fallback: split by sentences or something
    chunks = description.split('. ').map(s => s.trim()).filter(s => s);
  }

  // Consider chunk_overlap if specified
  const overlap = clientConfig.chunking_rules?.chunk_overlap || 0;
  if (overlap > 0) {
    // Implement overlap logic: for each pair, add overlapping chunk
    const overlapped = [];
    for (let i = 0; i < chunks.length; i++) {
      overlapped.push(chunks[i]);
      if (i < chunks.length - 1) {
        const next = chunks[i + 1];
        const overlapText = chunks[i].slice(-overlap) + ' ' + next.slice(0, overlap);
        overlapped.push(overlapText);
      }
    }
    chunks = overlapped;
  }

  return chunks;
}

/**
 * Generates enriched tags using dynamic prompt construction and unified NLP call.
 * @param {object} listing - The listing object.
 * @param {object} clientConfig - The client configuration object.
 * @returns {array} Array of generated tag strings.
 */
async function generateEnrichedTags(listing, clientConfig) {
  // explain what this function does: constructs a dynamic prompt with client-specific rules and uses LLM to generate semantically diverse tags
  // Use database prompt (required - no fallback)
  if (!clientConfig.listing_tagging_prompt) {
    throw new Error(`Missing listing_tagging_prompt for client ${clientId}. Please ensure the client configuration includes a listing tagging prompt.`);
  }
  const basePrompt = clientConfig.listing_tagging_prompt;

  const taggingRules = clientConfig.tagging_rules ? JSON.stringify(clientConfig.tagging_rules) : '{}';
  const extractionRules = clientConfig.document_extraction ? JSON.stringify(clientConfig.document_extraction) : '{}';

  const authoritativeTags = {
    id: listing.id,
    name: listing.name,
    address: listing.address,
    type: listing.type,
    price: listing.price,
    beds: listing.beds,
    duplex: listing.duplex,
    baths: listing.baths,
    // amenities are already a top-level field, exclude them from here to prevent LLM from re-processing them into duplicate tags
    listing_status: listing.listing_status,
    current_state: listing.current_state,
    total_area: listing.total_area,
    private_area: listing.private_area,
  };

  console.log(`Authoritative tags for listing ${listing.id}:`, authoritativeTags);

  const fullPrompt = `${basePrompt}
${taggingRules}

Use these regex patterns for additional extraction:
${extractionRules}

Authoritative tags from database:
${JSON.stringify(authoritativeTags)}

Return only a JSON object with a single key "generated_tags" containing an array of strings, each being a tag like "feature:pool" or "location:city_center".`;

  const content = listing.description || createMetadataSummary(listing);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: fullPrompt },
      { role: 'user', content: content }
    ],
    temperature: 0.2, // slightly higher for creativity in tagging
  });

  const rawResponseContent = response.choices[0].message.content;
  const responseContent = cleanJsonResponse(rawResponseContent);
  let result;
  try {
    result = JSON.parse(responseContent);
    if (!result.generated_tags || !Array.isArray(result.generated_tags)) {
      throw new Error('Invalid response structure');
    }
  } catch (error) {
    console.error('Failed to parse tag generation response:', rawResponseContent);
    // Fallback: extract tags from text or return empty
    result = { generated_tags: [] };
  }

  const programmaticTags = [];
  const fieldsToTag = {
    price: listing.price,
    beds: listing.beds,
    baths: listing.baths,
    duplex: listing.duplex,
    listing_status: listing.listing_status,
    current_state: listing.current_state,
    total_area: listing.total_area,
    private_area: listing.private_area,
  };

  for (const [key, value] of Object.entries(fieldsToTag)) {
    if (value !== null && value !== undefined && value !== '') {
      programmaticTags.push(`${key}:${value}`);
    }
  }

  // Combine LLM-generated tags with programmatically created tags, ensuring no duplicates
  console.log(`LLM tags (${result.generated_tags.length}):`, result.generated_tags);
  console.log(`Programmatic tags (${programmaticTags.length}):`, programmaticTags);
  const rawCombined = [...result.generated_tags, ...programmaticTags];
  console.log(`Raw combined tags before deduplication (${rawCombined.length}):`, rawCombined);
  const combinedTags = [...new Set(rawCombined)];
  console.log(`Combined tags after deduplication (${combinedTags.length}):`, combinedTags);

  // Replace underscores with spaces in all tags for better search compatibility
  const cleanedTags = combinedTags.map(tag => tag.replace(/_/g, ' '));
  console.log(`Tags after cleaning underscores (${cleanedTags.length}):`, cleanedTags);

  return cleanedTags;
}

/**
 * Generates embeddings for the given chunks using OpenAI's text-embedding-3-small model.
 * @param {array} chunks - Array of chunk objects with 'text' property.
 * @returns {array} Array of embedding vectors.
 */
async function createEmbeddings(chunks) {
  // explain what this function does: creates vector embeddings for each text chunk using OpenAI's embedding model
  const texts = chunks.map(chunk => chunk.text);
  if (texts.length === 0) return [];

  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  });

  return response.data.map(item => item.embedding);
}

/**
 * Main function to process listings for a given client and optional development.
 * @param {string} clientId - The client ID.
 * @param {string|null} developmentId - Optional development ID to filter listings.
 * @param {string|null} listingId - Optional specific listing ID to process.
 * @param {number} batchSize - Number of listings to process in each batch (default 10).
 * @param {number} offset - The starting offset for pagination.
 * @returns {object} An object containing processedCount and moreAvailable.
 */
async function processListings(clientId, developmentId = null, listingId = null, batchSize = 10, offset = 0) {
  console.log(`Processing listings for client ${clientId}, development ${developmentId || 'all'}, listing ${listingId || 'all'}, batch size ${batchSize}, offset ${offset}`);

  // Fetch client configuration
  const clientConfig = await fetchClientConfiguration(clientId);
  // Removed logging of full client configuration to save console space (prompts are verbose)

  // Fetch listings
  const listings = await fetchListings(clientId, developmentId, listingId, batchSize, offset);
  console.log(`Fetched ${listings.length} listings`);

  const allVectors = [];

  // Process each listing
  for (const listing of listings) {
    console.log(`Processing listing ${listing.id}: ${listing.name}`);

    // Always create metadata summary chunk
    const metadataSummary = createMetadataSummary(listing);
    let chunks = [{ text: metadataSummary, has_description: !!listing.description }];

    if (listing.description) {
      // Proceed to chunking
      console.log(`Listing has description, proceeding to chunking`);
      const propositionalChunks = await getPropositionalChunks(listing.description, clientConfig);
      chunks.push(...propositionalChunks.map(text => ({ text, has_description: true })));
    } else {
      console.log(`Listing has no description, using only metadata summary`);
    }

    // Generate enriched tags
    const generatedTags = await generateEnrichedTags(listing, clientConfig);
    console.log(`Generated ${generatedTags.length} tags for listing ${listing.id}:`, generatedTags);

    // Generate embeddings
    const embeddings = await createEmbeddings(chunks);
    console.log(`Generated ${embeddings.length} embeddings for listing ${listing.id}`);

    // Construct vectors for upsert
    for (let i = 0; i < chunks.length; i++) {
      const metadata = {
        chunk_text: chunks[i].text,
        client_id: listing.client_id,
        listing_id: listing.id,
        id: listing.id,
        name: listing.name,
        type: listing.type,
        generated_tags: generatedTags,
        has_description: chunks[i].has_description,
        content_type: 'listing',
      };

      // Only add non-null fields to avoid Pinecone metadata errors
      if (listing.development_id !== null) {
        metadata.development_id = listing.development_id;
      }
      if (listing.price !== null) {
        metadata.price = listing.price;
      }
      if (listing.beds !== null) {
        metadata.beds = listing.beds;
      }
      if (listing.duplex !== null) {
        metadata.duplex = listing.duplex;
      }
      if (listing.baths !== null) {
        metadata.baths = listing.baths;
      }
      if (listing.amenities !== null) {
        metadata.amenities = listing.amenities;
      }
      if (listing.listing_status !== null) {
        metadata.listing_status = listing.listing_status;
      }
      if (listing.current_state !== null) {
        metadata.current_state = listing.current_state;
      }
      if (listing.total_area !== null) {
        metadata.total_area = listing.total_area;
      }
      if (listing.private_area !== null) {
        metadata.private_area = listing.private_area;
      }
      if (listing.address !== null) {
        metadata.address = listing.address;
      }

      const vector = {
        id: `${listing.client_id}-${listing.id}-chunk-${i}`,
        values: embeddings[i],
        metadata: metadata
      };
      allVectors.push(vector);

      console.log(`Metadata for chunk ${i} of listing ${listing.id}:`, JSON.stringify(vector.metadata, null, 2));
    }

    console.log(`Prepared ${chunks.length} vectors for listing ${listing.id}`);
  }

  // Conditional Pinecone upsert
  if (process.env.ENABLE_PINECONE_UPSERT === 'true') {
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    const namespace = index.namespace(clientId);

    // CLEANUP STEP: Delete existing vectors for all processed listings to prevent stale data
    const listingIds = listings.map(l => l.id);
    if (listingIds.length > 0) {
        console.log(`Cleaning up existing vectors for listings: ${listingIds.join(', ')}`);
        try {
            // Primary Method: Delete by metadata filter.
            await namespace.deleteMany({
                filter: {
                    "listing_id": { "$in": listingIds }
                }
            });
            console.log(`Successfully submitted delete request for listings: ${listingIds.join(', ')}`);
        } catch (error) {
            console.warn(`Could not delete by metadata filter, attempting to delete by vector IDs as a fallback. Error: ${error.message}`);
            
            // Fallback Method: Delete by individual vector IDs.
            const vectorIdsToDelete = allVectors
                .filter(v => listingIds.includes(v.metadata.listing_id))
                .map(v => v.id);

            if (vectorIdsToDelete.length > 0) {
                console.log(`Attempting to delete ${vectorIdsToDelete.length} vector IDs as a fallback...`);
                try {
                    await namespace.deleteMany(vectorIdsToDelete);
                    console.log(`Successfully deleted ${vectorIdsToDelete.length} vectors by ID.`);
                } catch (fallbackError) {
                    console.error(`Fallback deletion by vector ID also failed: ${fallbackError.message}`);
                }
            } else {
                console.log('No vectors to delete in fallback method.');
            }
        }
    }

    // Batch upsert in groups of 100
    for (let i = 0; i < allVectors.length; i += 100) {
      const batch = allVectors.slice(i, i + 100);
      await namespace.upsert(batch);
      console.log(`Upserted batch ${Math.floor(i / 100) + 1} of ${Math.ceil(allVectors.length / 100)}`);
    }

    console.log(`Successfully upserted ${allVectors.length} vectors to Pinecone for client ${clientId}`);
  } else {
    console.log('Pinecone upsert disabled (ENABLE_PINECONE_UPSERT not set to true), processed vectors without upserting');
  }

  // Return processed count and whether more might be available.
  return {
    processedCount: listings.length,
    moreAvailable: listings.length === batchSize,
  };
}

export {
  processListings,
};