const { Pinecone } = require('@pinecone-database/pinecone');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: path.resolve(__dirname, 'packages/backend/.env') });

async function testPineconeConnection() {
  try {
    console.log('🔧 Testing Pinecone Connection...');
    console.log('📊 Configuration:');
    console.log(`   Index: ${process.env.PINECONE_INDEX_NAME}`);
    console.log(`   Namespace: ${process.env.PINECONE_NAMESPACE}`);
    console.log(`   API Key: ${process.env.PINECONE_API_KEY ? 'Set ✅' : 'Missing ❌'}`);
    
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME);
    
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    console.log('\n🔍 Testing embedding generation...');
    const testQuery = "apartamentos T1 Evergreen Pure";
    const queryEmbedding = await embeddingModel.embedContent({
      content: { parts: [{ text: testQuery }] },
      taskType: "RETRIEVAL_QUERY",
    });
    console.log(`   Query: "${testQuery}"`);
    console.log(`   Embedding vector length: ${queryEmbedding.embedding.values.length}`);
    
    console.log('\n🎯 Testing Pinecone queries...');
    
    // Test 1: Search without any filters
    console.log('\n   Test 1: General search (no filters)');
    const allDataResponse = await pineconeIndex
      .namespace(process.env.PINECONE_NAMESPACE)
      .query({
        vector: queryEmbedding.embedding.values,
        topK: 5,
        includeMetadata: true,
      });
    
    console.log(`   Results: ${allDataResponse.matches?.length || 0} matches`);
    if (allDataResponse.matches && allDataResponse.matches.length > 0) {
      allDataResponse.matches.forEach((match, i) => {
        console.log(`     ${i+1}. ID: ${match.id}`);
        console.log(`        Score: ${match.score?.toFixed(3)}`);
        console.log(`        Client ID: ${match.metadata?.client_id || 'N/A'}`);
        console.log(`        Source: ${match.metadata?.source || 'N/A'}`);
        console.log(`        Text preview: ${match.metadata?.text?.substring(0, 100) || 'N/A'}...`);
        console.log('');
      });
    }
    
    // Test 2: Search with Up Investments client filter
    console.log('   Test 2: Client-filtered search (Up Investments)');
    const clientFilteredResponse = await pineconeIndex
      .namespace(process.env.PINECONE_NAMESPACE)
      .query({
        vector: queryEmbedding.embedding.values,
        topK: 10,
        includeMetadata: true,
        filter: { client_id: "e6f484a3-c3cb-4e01-b8ce-a276f4b7355c" },
      });
    
    console.log(`   Results: ${clientFilteredResponse.matches?.length || 0} matches`);
    if (clientFilteredResponse.matches && clientFilteredResponse.matches.length > 0) {
      clientFilteredResponse.matches.forEach((match, i) => {
        console.log(`     ${i+1}. ID: ${match.id}`);
        console.log(`        Score: ${match.score?.toFixed(3)}`);
        console.log(`        Client ID: ${match.metadata?.client_id || 'N/A'}`);
        console.log(`        Source: ${match.metadata?.source || 'N/A'}`);
        console.log(`        Listing ID: ${match.metadata?.listing_id || 'N/A'}`);
        console.log(`        Development ID: ${match.metadata?.development_id || 'N/A'}`);
        console.log(`        Text preview: ${match.metadata?.text?.substring(0, 150) || 'N/A'}...`);
        console.log('');
      });
    } else {
      console.log('   ❌ No matches found for Up Investments client ID');
      console.log('   This suggests the data might not be properly ingested or indexed');
    }
    
    // Test 3: Check index stats
    console.log('   Test 3: Index statistics');
    try {
      const stats = await pineconeIndex.describeIndexStats();
      console.log(`   Total vectors: ${stats.totalVectorCount || 'Unknown'}`);
      console.log(`   Namespaces: ${JSON.stringify(stats.namespaces || {}, null, 2)}`);
    } catch (error) {
      console.log(`   Could not get index stats: ${error.message}`);
    }
    
    console.log('\n✅ Pinecone test completed!');
    
  } catch (error) {
    console.error('❌ Error testing Pinecone:', error);
    console.error('Stack trace:', error.stack);
  }
}

// Run the test
testPineconeConnection();