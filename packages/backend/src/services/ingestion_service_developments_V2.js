// packages/backend/src/services/ingestion_service_developments_V2.js
// This file implements the Enriched Ingestion Service for Developments (V2), adapted from ingestion-service_V2.js.
// It processes structured data from the Supabase developments table, generates precise, semantically-aware text chunks and metadata tags based on client-specific rules stored in the clients table, then vectorizes and upserts to Pinecone.
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
    .select('chunking_rules, tagging_rules, document_extraction, development_tagging_prompt')
    .eq('client_id', clientId)
    .single();

  if (error) {
    throw new Error(`Failed to fetch client configuration: ${error.message}`);
  }

  return data;
}

/**
 * Fetches developments from the Supabase developments table, filtered by client_id and optional development_id.
 * @param {string} clientId - The client ID.
 * @param {string|null} developmentId - Optional development ID to fetch a specific development.
 * @param {number} batchSize - Number of developments to fetch (ignored if developmentId is provided).
 * @returns {array} Array of development objects.
 */
async function fetchDevelopments(clientId, developmentId = null, batchSize = 10) {
  let query = supabase
    .from('developments')
    .select('*')
    .eq('client_id', clientId);

  if (developmentId) {
    query = query.eq('id', developmentId);
  } else {
    query = query.limit(batchSize);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch developments: ${error.message}`);
  }

  return data;
}

/**
 * Creates a metadata summary chunk for developments without descriptions.
 * @param {object} development - The development object.
 * @returns {string} A summary string of the development's metadata.
 */
function createMetadataSummary(development) {
  // explain what this function does: creates a textual summary of the development's key metadata for embedding when no description is available
  const summary = `This is a development named ${development.name || 'unknown name'} located at ${development.location || 'unknown location'}. ` +
    `Amenities include: ${development.amenities ? JSON.stringify(development.amenities) : 'none specified'}.`;

  return summary;
}

/**
 * Generates propositional chunks from the development description using configurable LLM prompt.
 * @param {string} description - The development description.
 * @param {object} clientConfig - The client configuration object.
 * @returns {array} Array of chunk strings.
 */
async function getPropositionalChunks(description, clientConfig) {
  // explain what this function does: uses the client's chunking prompt to break down the description into propositional chunks via LLM
  const chunkingPrompt = clientConfig.chunking_rules?.prompt || 'Break down this property development description into propositional chunks, each representing a distinct aspect or proposition. Return as a JSON array of strings.';

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
 * @param {object} development - The development object.
 * @param {object} clientConfig - The client configuration object.
 * @returns {array} Array of generated tag strings.
 */
async function generateEnrichedTags(development, clientConfig) {
  // explain what this function does: constructs a dynamic prompt with client-specific rules and uses LLM to generate semantically diverse tags
  // Use database prompt (required - no fallback)
  if (!clientConfig.development_tagging_prompt) {
    throw new Error(`Missing development_tagging_prompt for client ${clientId}. Please ensure the client configuration includes a development tagging prompt.`);
  }
  const basePrompt = clientConfig.development_tagging_prompt;

  const taggingRules = clientConfig.tagging_rules ? JSON.stringify(clientConfig.tagging_rules) : '{}';
  const extractionRules = clientConfig.document_extraction ? JSON.stringify(clientConfig.document_extraction) : '{}';

  const authoritativeTags = {
    id: development.id,
    name: development.name,
    location: development.location,
    // amenities are already a top-level field, exclude them from here to prevent LLM from re-processing them into duplicate tags
    description: development.description,
  };

  console.log(`Authoritative tags for development ${development.id}:`, authoritativeTags);

  const fullPrompt = `${basePrompt}
${taggingRules}

Use these regex patterns for additional extraction:
${extractionRules}

Authoritative tags from database:
${JSON.stringify(authoritativeTags)}

Return only a JSON object with a single key "generated_tags" containing an array of strings, each being a tag like "feature:pool" or "location:city_center".`;

  const content = development.description || createMetadataSummary(development);

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
    name: development.name,
    location: development.location,
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
 * Main function to process developments for a given client.
 * @param {string} clientId - The client ID.
 * @param {string|null} developmentId - Optional development ID to process a specific development.
 * @param {number} batchSize - Number of developments to process in each batch (default 10, ignored if developmentId is provided).
 */
async function processDevelopments(clientId, developmentId = null, batchSize = 10) {
  const target = developmentId ? `development ${developmentId}` : `all developments`;
  console.log(`Processing ${target} for client ${clientId}, batch size ${batchSize}`);

  // Fetch client configuration
  const clientConfig = await fetchClientConfiguration(clientId);
  // Removed logging of full client configuration to save console space (prompts are verbose)

  // Fetch developments
  const developments = await fetchDevelopments(clientId, developmentId, batchSize);
  console.log(`Fetched ${developments.length} developments`);

  const allVectors = [];

  // Process each development
  for (const development of developments) {
    console.log(`Processing development ${development.id}: ${development.name}`);

    // Always create metadata summary chunk
    const metadataSummary = createMetadataSummary(development);
    let chunks = [{ text: metadataSummary, has_description: !!development.description }];

    if (development.description) {
      // Proceed to chunking
      console.log(`Development has description, proceeding to chunking`);
      const propositionalChunks = await getPropositionalChunks(development.description, clientConfig);
      chunks.push(...propositionalChunks.map(text => ({ text, has_description: true })));
    } else {
      console.log(`Development has no description, using only metadata summary`);
    }

    // Generate enriched tags
    const generatedTags = await generateEnrichedTags(development, clientConfig);
    console.log(`Generated ${generatedTags.length} tags for development ${development.id}:`, generatedTags);

    // Generate embeddings
    const embeddings = await createEmbeddings(chunks);
    console.log(`Generated ${embeddings.length} embeddings for development ${development.id}`);

    // Construct vectors for upsert
    for (let i = 0; i < chunks.length; i++) {
      const metadata = {
        chunk_text: chunks[i].text,
        client_id: development.client_id,
        development_id: development.id,
        id: development.id,
        name: development.name,
        location: development.location,
        generated_tags: generatedTags,
        has_description: chunks[i].has_description,
        content_type: 'development',
      };

      // Only add amenities if it's not null
      if (development.amenities !== null) {
        metadata.amenities = development.amenities;
      }

      const vector = {
        id: `${development.client_id}-${development.id}-chunk-${i}`,
        values: embeddings[i],
        metadata: metadata
      };
      allVectors.push(vector);

      console.log(`Metadata for chunk ${i} of development ${development.id}:`, JSON.stringify(vector.metadata, null, 2));
    }

    console.log(`Prepared ${chunks.length} vectors for development ${development.id}`);
  }

  // Conditional Pinecone upsert
  if (process.env.ENABLE_PINECONE_UPSERT === 'true') {
    const index = pinecone.index(process.env.PINECONE_INDEX_NAME);
    const namespace = index.namespace(clientId);

    // CLEANUP STEP: Delete existing vectors for all processed developments to prevent stale data
    const developmentIds = developments.map(d => d.id);
    if (developmentIds.length > 0) {
        console.log(`Cleaning up existing vectors for developments: ${developmentIds.join(', ')}`);
        try {
            // Primary Method: Delete by metadata filter. This is the most efficient way.
            await namespace.deleteMany({
                filter: {
                    "development_id": { "$in": developmentIds }
                }
            });
            console.log(`Successfully submitted delete request for developments: ${developmentIds.join(', ')}`);
        } catch (error) {
            console.warn(`Could not delete by metadata filter, attempting to delete by vector IDs as a fallback. Error: ${error.message}`);
            
            // Fallback Method: If metadata filtering fails, delete by individual vector IDs.
            // This is slower but more reliable if metadata indexing is not ready.
            const vectorIdsToDelete = allVectors
                .filter(v => developmentIds.includes(v.metadata.development_id))
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
}

export {
  processDevelopments,
};