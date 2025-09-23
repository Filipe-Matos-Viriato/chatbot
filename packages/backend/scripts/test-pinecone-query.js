/**
 * Simple script to test Pinecone queries directly.
 * This helps verify data accessibility and namespace configuration.
 */

import 'dotenv/config';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

// Initialize clients
const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Define constants
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME || 'rachatbot-1536';
const CLIENT_ID = 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c'; // Up Investments client_id

/**
 * Simple function to get embedding for a query
 */
async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  
  return response.data[0].embedding;
}

/**
 * Test query with empty filter (all documents)
 */
async function testQueryAll() {
  console.log('\n🔍 TESTING QUERY: ALL DOCUMENTS (NO NAMESPACE)');
  
  const index = pinecone.index(PINECONE_INDEX_NAME);
  const embedding = await getEmbedding("apartamento em Aveiro");
  
  try {
    // Query the default namespace (no namespace specified)
    const queryResponse = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true
    });
    
    console.log(`✅ Found ${queryResponse.matches.length} matches in default namespace`);
    
    if (queryResponse.matches.length > 0) {
      console.log('\n📝 FIRST MATCH METADATA:');
      console.log(JSON.stringify(queryResponse.matches[0].metadata, null, 2));
    }
  } catch (error) {
    console.error('❌ Error querying default namespace:', error);
  }
}

/**
 * Test query with client ID filter
 */
async function testQueryWithClientFilter() {
  console.log('\n🔍 TESTING QUERY: WITH CLIENT FILTER (NO NAMESPACE)');
  
  const index = pinecone.index(PINECONE_INDEX_NAME);
  const embedding = await getEmbedding("apartamento em Aveiro");
  
  try {
    // Query with client_id filter
    const queryResponse = await index.query({
      vector: embedding,
      topK: 5,
      includeMetadata: true,
      filter: {
        client_id: CLIENT_ID
      }
    });
    
    console.log(`✅ Found ${queryResponse.matches.length} matches with client_id filter`);
    
    if (queryResponse.matches.length > 0) {
      console.log('\n📝 FIRST MATCH METADATA:');
      console.log(JSON.stringify(queryResponse.matches[0].metadata, null, 2));
    }
  } catch (error) {
    console.error('❌ Error querying with client filter:', error);
  }
}

/**
 * Test query in client namespace
 */
async function testQueryInClientNamespace() {
  console.log('\n🔍 TESTING QUERY: IN CLIENT NAMESPACE');
  
  const index = pinecone.index(PINECONE_INDEX_NAME);
  const embedding = await getEmbedding("apartamento em Aveiro");
  
  try {
    // Query in client namespace
    const queryResponse = await index.namespace(CLIENT_ID).query({
      vector: embedding,
      topK: 5,
      includeMetadata: true
    });
    
    console.log(`✅ Found ${queryResponse.matches.length} matches in client namespace`);
    
    if (queryResponse.matches.length > 0) {
      console.log('\n📝 FIRST MATCH METADATA:');
      console.log(JSON.stringify(queryResponse.matches[0].metadata, null, 2));
    }
  } catch (error) {
    console.error('❌ Error querying client namespace:', error);
  }
}

/**
 * List namespaces in index
 */
async function listNamespaces() {
  console.log('\n📋 LISTING NAMESPACES:');
  
  const index = pinecone.index(PINECONE_INDEX_NAME);
  
  try {
    // This requires Pinecone Enterprise plan - may not work on all accounts
    const stats = await index.describeIndexStats();
    console.log('Index stats:', stats);
    
    if (stats.namespaces) {
      console.log('Available namespaces:');
      Object.keys(stats.namespaces).forEach(namespace => {
        console.log(`- "${namespace}" (${stats.namespaces[namespace].vectorCount} vectors)`);
      });
    } else {
      console.log('No namespace information available in stats');
    }
  } catch (error) {
    console.error('❌ Error listing namespaces (may require Enterprise plan):', error);
  }
}

/**
 * Test specific queries that are failing in the chatbot
 */
async function testSpecificQueries() {
  console.log('\n🔍 TESTING SPECIFIC FAILING QUERIES FOR LISTING 4270');

  const index = pinecone.index(PINECONE_INDEX_NAME);
  const queries = [
    "tem terraço?",
    "qual é a area do quarto?"
  ];

  for (const query of queries) {
    console.log(`\n--- Testing query: "${query}" ---`);

    const embedding = await getEmbedding(query);

    try {
      // Query in client namespace with listing_id filter
      const queryResponse = await index.namespace(CLIENT_ID).query({
        vector: embedding,
        topK: 10,
        includeMetadata: true,
        filter: {
          listing_id: "4270"
        }
      });

      console.log(`✅ Found ${queryResponse.matches.length} matches for "${query}"`);
      if (queryResponse.matches.length > 0) {
        console.log('Top matches:');
        queryResponse.matches.slice(0, 3).forEach((match, i) => {
          console.log(`  ${i+1}. Score: ${match.score.toFixed(4)}`);
          console.log(`     Chunk: "${match.metadata.chunk_text?.substring(0, 100)}..."`);
          console.log(`     Tags: ${JSON.stringify(match.metadata.generated_tags?.slice(0, 5))}`);
        });
      } else {
        console.log('❌ No matches found!');
      }
    } catch (error) {
      console.error(`❌ Error testing "${query}":`, error);
    }
  }
}

/**
 * Main function
 */
async function main() {
  console.log('🚀 PINECONE TEST QUERY SCRIPT');
  console.log(`📊 Index: ${PINECONE_INDEX_NAME}`);
  console.log(`👤 Client ID: ${CLIENT_ID}`);

  try {
    await listNamespaces();
    await testQueryAll();
    await testQueryWithClientFilter();
    await testQueryInClientNamespace();
    await testSpecificQueries();

    console.log('\n✅ TEST COMPLETE');
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
  }
}

// Run the tests
main().catch(console.error);