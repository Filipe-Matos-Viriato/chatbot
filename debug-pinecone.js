// Debug script to query Pinecone directly
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

async function debugPinecone() {
  const clientId = 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c';
  const indexName = process.env.PINECONE_INDEX_NAME || 'rachatbot-1536';

  console.log(`Querying Pinecone index: ${indexName}, namespace: ${clientId}`);

  try {
    const index = pinecone.index(indexName);
    const namespace = index.namespace(clientId);

    // Query for all records with a minimal filter
    const allRecordsQuery = await namespace.query({
      vector: new Array(1536).fill(0.1), // dummy vector
      topK: 50, // Check more records
      includeMetadata: true,
      filter: { client_id: clientId } // Minimal filter
    });

    console.log(`Found ${allRecordsQuery.matches?.length || 0} total records`);

    // Show sample of ALL records
    allRecordsQuery.matches?.slice(0, 5).forEach((match, idx) => {
      const meta = match.metadata || {};
      console.log(`\nRecord ${idx + 1}:`);
      console.log(`  ID: ${match.id}`);
      console.log(`  Score: ${match.score}`);
      console.log(`  Metadata keys: ${Object.keys(meta).join(', ')}`);
      console.log(`  listing_id: ${meta.listing_id || 'NOT SET'}`);
      console.log(`  content_type: ${meta.content_type || 'NOT SET'}`);
      console.log(`  beds: ${meta.beds || 'NOT SET'}`);
      console.log(`  price: ${meta.price || 'NOT SET'}`);
      console.log(`  typology: ${meta.typology || 'NOT SET'}`);
      console.log(`  generated_tags: ${meta.generated_tags ? meta.generated_tags.slice(0, 3).join(', ') + '...' : 'NOT SET'}`);
    });

    // Count different content types
    const contentTypes = {};
    allRecordsQuery.matches?.forEach(match => {
      const type = match.metadata?.content_type || 'unknown';
      contentTypes[type] = (contentTypes[type] || 0) + 1;
    });
    console.log(`\nContent type breakdown:`, contentTypes);

    // Count records with listing_id
    const withListingId = allRecordsQuery.matches?.filter(match => match.metadata?.listing_id).length || 0;
    console.log(`Records with listing_id: ${withListingId}`);

    // Check for T1 listings specifically (beds = 1)
    const t1Listings = allRecordsQuery.matches?.filter(match => {
      const meta = match.metadata || {};
      return meta.beds === 1;
    }) || [];
    console.log(`T1 listings (beds = 1): ${t1Listings.length}`);

    // Check for listings in price range €200k-300k
    const priceRangeListings = allRecordsQuery.matches?.filter(match => {
      const meta = match.metadata || {};
      const price = meta.price;
      return price && price >= 200000 && price <= 300000;
    }) || [];
    console.log(`Listings in €200k-300k range: ${priceRangeListings.length}`);

    // Check for T1 listings in price range (should be the onboarding matches)
    const t1InPriceRange = allRecordsQuery.matches?.filter(match => {
      const meta = match.metadata || {};
      return meta.beds === 1 && meta.price >= 200000 && meta.price <= 300000;
    }) || [];
    console.log(`T1 listings in €200k-300k range: ${t1InPriceRange.length}`);

  } catch (error) {
    console.error('Error querying Pinecone:', error);
  }
}

debugPinecone();