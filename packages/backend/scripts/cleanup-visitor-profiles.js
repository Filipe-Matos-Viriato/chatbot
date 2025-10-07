#!/usr/bin/env node

/**
 * Cleanup script to remove visitor profile vectors from Pinecone
 * These were causing contamination of the knowledge base retrieval
 */

import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const INDEX_NAME = process.env.PINECONE_INDEX || 'rachatbot-1536';

async function cleanupVisitorProfiles() {
  console.log('🧹 Starting cleanup of visitor profile vectors from Pinecone...');
  console.log(`📍 Target index: ${INDEX_NAME}`);

  try {
    const index = pinecone.index(INDEX_NAME);

    // Get index stats to see current state
    console.log('📊 Checking index stats...');
    const stats = await index.describeIndexStats();
    console.log(`📈 Total vectors before cleanup: ${stats.totalVectorCount || 'Unknown'}`);

    // Query for visitor profile vectors
    // Since Pinecone doesn't support direct metadata filtering in delete operations,
    // we need to query first to get the IDs, then delete them
    console.log('🔍 Querying for visitor profile vectors...');

    // Get all namespaces (clients)
    const namespaces = Object.keys(stats.namespaces || {});
    console.log(`🏢 Found ${namespaces.length} namespaces: ${namespaces.join(', ')}`);

    let totalDeleted = 0;

    for (const namespace of namespaces) {
      console.log(`\n🏠 Processing namespace: ${namespace}`);

      try {
        // Query for vectors with category: 'visitor_profile'
        const queryResponse = await index.namespace(namespace).query({
          vector: new Array(1536).fill(0), // Dummy vector for metadata filtering
          filter: {
            category: 'visitor_profile'
          },
          topK: 10000, // Large number to get all matching vectors
          includeMetadata: true,
          includeValues: false // We only need IDs and metadata
        });

        const visitorProfileIds = queryResponse.matches
          .filter(match => match.metadata?.category === 'visitor_profile')
          .map(match => match.id);

        if (visitorProfileIds.length === 0) {
          console.log(`   ✅ No visitor profile vectors found in namespace ${namespace}`);
          continue;
        }

        console.log(`   🔍 Found ${visitorProfileIds.length} visitor profile vectors in namespace ${namespace}`);
        console.log(`   📝 Sample IDs: ${visitorProfileIds.slice(0, 3).join(', ')}${visitorProfileIds.length > 3 ? '...' : ''}`);

        // Delete the vectors in batches
        const batchSize = 100;
        for (let i = 0; i < visitorProfileIds.length; i += batchSize) {
          const batch = visitorProfileIds.slice(i, i + batchSize);
          console.log(`   🗑️ Deleting batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(visitorProfileIds.length / batchSize)} (${batch.length} vectors)`);

          await index.namespace(namespace).deleteMany(batch);
        }

        console.log(`   ✅ Deleted ${visitorProfileIds.length} visitor profile vectors from namespace ${namespace}`);
        totalDeleted += visitorProfileIds.length;

      } catch (error) {
        console.error(`   ❌ Error processing namespace ${namespace}:`, error.message);
      }
    }

    // Final stats
    console.log('\n📊 Cleanup Summary:');
    console.log(`   🗑️ Total visitor profile vectors deleted: ${totalDeleted}`);

    if (totalDeleted > 0) {
      console.log('   ✅ Cleanup completed successfully!');
      console.log('   🔄 The knowledge base should now be free of visitor profile contamination.');
    } else {
      console.log('   ℹ️ No visitor profile vectors found to clean up.');
    }

  } catch (error) {
    console.error('❌ Cleanup failed:', error);
    process.exit(1);
  }
}

// Run the cleanup
cleanupVisitorProfiles().then(() => {
  console.log('\n🎉 Visitor profile cleanup script completed.');
  process.exit(0);
}).catch((error) => {
  console.error('\n💥 Script failed:', error);
  process.exit(1);
});