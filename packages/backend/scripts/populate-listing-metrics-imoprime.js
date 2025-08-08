import 'dotenv/config'; // Loads .env from the root of the project or where the script is run
import supabase from '../src/config/supabase.js';
import * as clientConfigService from '../src/services/client-config-service.js';

async function populateListingMetrics() {
  console.log('Populating listing_metrics table with fake data...');

  // 1. Fetch existing listing_ids and client_ids from the listings table
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('id, client_id')
    .eq('client_id', 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');

  if (listingsError) {
    console.error('Error fetching listings:', listingsError);
    return;
  }

  if (!listings || listings.length === 0) {
    console.log('No listings found. Please ensure the listings table is populated.');
    return;
  }

  console.log(`Found ${listings.length} listings. Generating metrics...`);

  const metricsToInsert = [];

  for (const listing of listings) {
    const listingId = listing.id;
    const clientId = listing.client_id;
    let clientName = null;

    if (clientId) {
      try {
        const clientConfig = await clientConfigService.getClientConfig(clientId);
        if (clientConfig && clientConfig.clientName) {
          clientName = clientConfig.clientName;
        }
      } catch (error) {
        console.error(`Error fetching client name for client ${clientId}:`, error);
      }
    }

    // 2. Generate random metrics for each listing_id
    const engaged_users = Math.floor(Math.random() * 1000) + 50; // 50-1050 engaged users
    const inquiries = Math.floor(Math.random() * 50) + 5; // 5-55 inquiries
    const hotLeads = Math.floor(Math.random() * 10) + 1; // 1-11 hot leads
    const total_conversions = Math.floor(Math.random() * hotLeads) + 1; // 1 to hotLeads conversions
    const conversionRate = (total_conversions / engaged_users) * 100; // Store as a number, not a formatted string

    const leadScoreDistributionHot = Math.floor(Math.random() * 30) + 5;
    const leadScoreDistributionWarm = Math.floor(Math.random() * 50) + 10;
    const leadScoreDistributionCold = Math.floor(Math.random() * 20) + 5;

    metricsToInsert.push({
      listing_id: listingId,
      client_id: clientId, // Include client_id
      client_name: clientName, // Include client_name
      engaged_users: engaged_users,
      inquiries: inquiries,
      total_conversions: total_conversions,
      unacknowledged_hot_leads: hotLeads,
      conversion_rate: conversionRate,
      lead_score_distribution_hot: leadScoreDistributionHot,
      lead_score_distribution_warm: leadScoreDistributionWarm,
      lead_score_distribution_cold: leadScoreDistributionCold,
    });
  }

  // 3. Insert the fake data into the listing_metrics table
  const { error: insertError } = await supabase
    .from('listing_metrics')
    .upsert(metricsToInsert, { onConflict: 'listing_id' }); // Use upsert to update if listing_id already exists

  if (insertError) {
    console.error('Error inserting listing metrics:', insertError);
  } else {
    console.log('Successfully populated listing_metrics table.');
  }
}

populateListingMetrics();