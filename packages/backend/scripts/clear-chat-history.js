// packages/backend/scripts/clear-chat-history.js
// Script to clear chat history from Pinecone for specific listings or all history

import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
dotenv.config();

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

async function clearChatHistoryForListing(listingId) {
  console.log(`Clearing chat history containing listing ${listingId} from Pinecone...`);

  // Use the default chat history index
  const indexName = 'chat-history-1536';
  const index = pinecone.index(indexName);

  try {
    // Query with a dummy vector to get all vectors
    const dummyVector = new Array(1536).fill(0);

    // Get all chat history vectors (we'll need to paginate if there are many)
    const allQuery = await index.query({
      vector: dummyVector,
      topK: 10000, // Large number to get most vectors
      includeMetadata: true,
      filter: {} // No filter to get all
    });

    if (!allQuery.matches || allQuery.matches.length === 0) {
      console.log('No chat history vectors found in Pinecone');
      return;
    }

    console.log(`Found ${allQuery.matches.length} total chat history vectors`);

    // Filter vectors that contain the listing ID in their text
    const listingVectors = allQuery.matches.filter(match => {
      const text = match.metadata?.text || '';
      return text.includes(listingId) || text.includes(`ID: ${listingId}`);
    });

    console.log(`Found ${listingVectors.length} vectors containing listing ${listingId}`);

    if (listingVectors.length === 0) {
      console.log(`No chat history found for listing ${listingId}`);
      return;
    }

    // Show some examples before deleting
    console.log('Sample messages to be deleted:');
    listingVectors.slice(0, 3).forEach((match, i) => {
      console.log(`${i + 1}. ${match.metadata?.text?.substring(0, 100)}...`);
    });

    // Ask for confirmation
    console.log(`\n⚠️  This will delete ${listingVectors.length} chat history vectors.`);
    console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get the IDs to delete
    const idsToDelete = listingVectors.map(match => match.id);

    console.log(`Deleting ${idsToDelete.length} chat history vectors for listing ${listingId}...`);

    // Delete in batches of 100 (Pinecone limit)
    const batchSize = 100;
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      await index.deleteMany(batch);
      console.log(`Deleted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} vectors`);
    }

    console.log(`✅ Cleared ${idsToDelete.length} chat history vectors for listing ${listingId}!`);

  } catch (error) {
    console.error('Error clearing chat history from Pinecone:', error);
  }
}

async function clearAllChatHistory() {
  console.log('Clearing ALL chat history from Pinecone...');

  // Use the default chat history index
  const indexName = 'chat-history-1536';
  const index = pinecone.index(indexName);

  try {
    // Query with a dummy vector to get all vectors
    const dummyVector = new Array(1536).fill(0);

    const allQuery = await index.query({
      vector: dummyVector,
      topK: 10000,
      includeMetadata: true,
      filter: {}
    });

    if (!allQuery.matches || allQuery.matches.length === 0) {
      console.log('No chat history vectors found in Pinecone');
      return;
    }

    console.log(`Found ${allQuery.matches.length} total chat history vectors`);

    // Ask for confirmation
    console.log(`\n⚠️  This will delete ALL ${allQuery.matches.length} chat history vectors.`);
    console.log('Press Ctrl+C to cancel or wait 5 seconds to continue...');

    await new Promise(resolve => setTimeout(resolve, 5000));

    const idsToDelete = allQuery.matches.map(match => match.id);

    // Delete in batches of 100 (Pinecone limit)
    const batchSize = 100;
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batch = idsToDelete.slice(i, i + batchSize);
      await index.deleteMany(batch);
      console.log(`Deleted batch ${Math.floor(i/batchSize) + 1}: ${batch.length} vectors`);
    }

    console.log(`✅ Cleared all ${idsToDelete.length} chat history vectors!`);

  } catch (error) {
    console.error('Error clearing chat history from Pinecone:', error);
  }
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];
const listingId = args[1];

if (command === 'listing' && listingId) {
  clearChatHistoryForListing(listingId);
} else if (command === 'all') {
  clearAllChatHistory();
} else {
  console.log('Usage:');
  console.log('  node scripts/clear-chat-history.js listing <listingId>  # Clear history for specific listing');
  console.log('  node scripts/clear-chat-history.js all                  # Clear all chat history');
  console.log('');
  console.log('Examples:');
  console.log('  node scripts/clear-chat-history.js listing 4270');
  console.log('  node scripts/clear-chat-history.js all');
}