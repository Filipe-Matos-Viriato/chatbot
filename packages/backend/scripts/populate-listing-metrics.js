const dotenv = require('dotenv');
dotenv.config({ path: './.env' });

const supabase = require('../src/config/supabase');

async function populateListingMetrics() {
  console.log('Populating listing_metrics table with fake data...');

  // 1. Fetch existing listing_ids from the listings table
  const { data: listings, error: listingsError } = await supabase
    .from('listings')
    .select('id');

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

    // 2. Generate random metrics for each listing_id
    const chatbotViews = Math.floor(Math.random() * 1000) + 50; // 50-1050 views
    const inquiries = Math.floor(Math.random() * 50) + 5; // 5-55 inquiries
    const hotLeads = Math.floor(Math.random() * 10) + 1; // 1-11 hot leads
    const conversionRate = `${((inquiries / chatbotViews) * 100).toFixed(2)}%`;

    const leadScoreDistributionHot = Math.floor(Math.random() * 30) + 5;
    const leadScoreDistributionWarm = Math.floor(Math.random() * 50) + 10;
    const leadScoreDistributionCold = Math.floor(Math.random() * 20) + 5;

    metricsToInsert.push({
      listing_id: listingId,
      chatbot_views: chatbotViews,
      inquiries: inquiries,
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