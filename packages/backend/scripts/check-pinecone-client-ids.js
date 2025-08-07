/**
 * @fileoverview Script to check Pinecone for vectors that do not have a client_id or have an unexpected client_id.
 * @filelocation packages/backend/scripts/check-pinecone-client-ids.js
 * @description This script helps diagnose multi-tenancy issues in Pinecone by identifying vectors that might be incorrectly tagged or untagged with client_id.
 * @why This script exists to provide a direct, programmatic way to inspect Pinecone data for client_id consistency, aiding in debugging multi-tenancy issues.
 * @relevant_files packages/backend/src/rag-service.js, packages/backend/src/services/ingestion-service-imoprime.js, packages/backend/.env
 */

import 'dotenv/config'; // Loads .env from root or current directory
import { Pinecone } from '@pinecone-database/pinecone';

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;

if (!PINECONE_API_KEY || !PINECONE_INDEX_NAME) {
  console.error('Please ensure PINECONE_API_KEY and PINECONE_INDEX_NAME are set in your .env file.');
  process.exit(1);
}

const pinecone = new Pinecone({ apiKey: PINECONE_API_KEY });
const index = pinecone.index(PINECONE_INDEX_NAME);

/**
 * Checks Pinecone for vectors that do not have a client_id or have an unexpected client_id.
 * Replace 'YOUR_EXPECTED_CLIENT_ID' with the actual client ID you expect for your data.
 */
const checkPineconeClientIds = async () => {
  console.log(`Checking Pinecone index: ${PINECONE_INDEX_NAME} for client_id consistency and counts...`);

  try {
    // Query for all vectors (or a large topK) to get metadata for counting
    console.log('\n--- Retrieving vectors for client_id counting ---');
    const allVectorsResponse = await index.query({
      vector: Array(1536).fill(0), // Dummy vector
      topK: 1000, // Retrieve a large number of vectors for counting
      includeMetadata: true,
    });

    const clientIdCounts = {};
    let unassignedClientIdCount = 0;

    if (allVectorsResponse.matches && allVectorsResponse.matches.length > 0) {
      console.log(`Retrieved ${allVectorsResponse.matches.length} vectors.`);
      allVectorsResponse.matches.forEach(match => {
        const clientId = match.metadata.client_id;
        if (clientId) {
          clientIdCounts[clientId] = (clientIdCounts[clientId] || 0) + 1;
        } else {
          unassignedClientIdCount++;
        }
      });

      console.log('\n--- Vectors per Client ID ---');
      for (const clientId in clientIdCounts) {
        console.log(`Client ID '${clientId}': ${clientIdCounts[clientId]} vectors`);
      }

      console.log(`\n--- Unassigned Client IDs ---`);
      if (unassignedClientIdCount > 0) {
        console.log(`Found ${unassignedClientIdCount} vectors with unassigned (missing or null) 'client_id'.`);
      } else {
        console.log('No vectors found with unassigned (missing or null) "client_id".');
      }

    } else {
      console.log('No vectors found in the index.');
    }

    // Explicit check for vectors where client_id does not exist (top 10, for detailed inspection)
    console.log('\n--- Explicit check for vectors missing "client_id" metadata (top 10) ---');
    const missingClientIdResponse = await index.query({
      vector: Array(1536).fill(0), // Dummy vector
      topK: 10,
      includeMetadata: true,
      filter: {
        client_id: { "$exists": false }
      }
    });

    if (missingClientIdResponse.matches && missingClientIdResponse.matches.length > 0) {
      console.log(`Found ${missingClientIdResponse.matches.length} vectors explicitly missing "client_id":`);
      missingClientIdResponse.matches.forEach(match => {
        console.log(`  ID: ${match.id}, Metadata: ${JSON.stringify(match.metadata)}`);
      });
    } else {
      console.log('No vectors explicitly found missing "client_id" metadata.');
    }

  } catch (error) {
    console.error('An error occurred during Pinecone query:', error);
  }
};

checkPineconeClientIds();