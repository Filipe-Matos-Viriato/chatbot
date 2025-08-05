// This script migrates client data from shared Pinecone indexes to a client-specific index
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import { getClientConfig } from '../src/services/client-config-service.js';

dotenv.config();

// Initialize clients
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

// Source indexes - shared indexes across all clients
const sourceRAGIndex = pinecone.index('rachatbot-1536');
const sourceChatHistoryIndex = pinecone.index('chat-history-1536');

// Batch size for retrieving and upserting vectors
const BATCH_SIZE = 100;

async function migrateClientData(clientId) {
  try {
    // Get client configuration
    const clientConfig = await getClientConfig(clientId);
    
    if (!clientConfig.pineconeIndex) {
      console.error(`Client ${clientId} does not have a dedicated pineconeIndex configured`);
      return false;
    }
    
    // Create target index for the client if it doesn't exist already
    const targetIndex = pinecone.index(clientConfig.pineconeIndex);
    
    console.log(`Starting migration for client: ${clientConfig.clientName} (${clientId})`);
    console.log(`Target index: ${clientConfig.pineconeIndex}`);
    
    // Migrate RAG data
    console.log("Migrating RAG data...");
    await migrateData(sourceRAGIndex, targetIndex, clientId);
    
    // Migrate chat history data
    console.log("Migrating chat history data...");
    await migrateData(sourceChatHistoryIndex, targetIndex, clientId);
    
    console.log(`Migration completed successfully for client: ${clientConfig.clientName}`);
    return true;
  } catch (error) {
    console.error(`Error migrating data for client ${clientId}:`, error);
    return false;
  }
}

async function migrateData(sourceIndex, targetIndex, clientId, namespace = process.env.PINECONE_NAMESPACE) {
  let totalVectorsMigrated = 0;
  let pagingId = null;
  
  // Process batches until no more vectors are found
  while (true) {
    // Query vectors by client_id filter
    const queryParams = {
      filter: { client_id: clientId },
      topK: BATCH_SIZE,
      includeMetadata: true,
      includeValues: true,
    };
    
    // Add pagingToken if we're continuing from a previous batch
    if (pagingId) {
      queryParams.pagingToken = pagingId;
    }
    
    // Get vectors from source index
    const queryResult = await sourceIndex.namespace(namespace).query(queryParams);
    
    // If no matches found, we're done
    if (!queryResult.matches || queryResult.matches.length === 0) {
      break;
    }
    
    // Transform matches to vectors for upserting
    const vectors = queryResult.matches.map(match => ({
      id: match.id,
      values: match.values,
      metadata: match.metadata,
    }));
    
    // Upsert vectors to target index
    await targetIndex.namespace(namespace).upsert(vectors);
    
    // Update counters
    totalVectorsMigrated += vectors.length;
    console.log(`Migrated ${vectors.length} vectors, total: ${totalVectorsMigrated}`);
    
    // Update pagingId for next batch
    pagingId = queryResult.pagingToken;
    
    // If no paging token returned, we're done
    if (!pagingId) {
      break;
    }
  }
  
  console.log(`Total vectors migrated: ${totalVectorsMigrated}`);
  return totalVectorsMigrated;
}

async function main() {
  // Get client ID from command line arguments
  const clientId = process.argv[2];
  
  if (!clientId) {
    console.error("Error: Client ID is required.");
    console.log("Usage: node migrate-client-data-to-dedicated-index.js <clientId>");
    process.exit(1);
  }
  
  console.log(`Starting migration for client ID: ${clientId}`);
  const success = await migrateClientData(clientId);
  
  if (success) {
    console.log("Migration completed successfully!");
    process.exit(0);
  } else {
    console.error("Migration failed!");
    process.exit(1);
  }
}

main().catch(error => {
  console.error("Unhandled error:", error);
  process.exit(1);
});