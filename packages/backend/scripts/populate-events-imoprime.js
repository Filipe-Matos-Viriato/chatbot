/**
 * Script to populate events table with historical score impacts for Imoprime visitors
 * This creates realistic event sequences to generate rich sparkline data
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const IMOPRIME_CLIENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

// Event types with their score impacts (from visitor service)
const EVENT_TYPES = {
  // Engagement Behavior (Positive)
  TIME_5_10_MIN: { impact: 5, category: 'engagement' },
  TIME_10_PLUS_MIN: { impact: 10, category: 'engagement' },
  CLICKED_LISTING: { impact: 5, category: 'engagement' },
  RETURNED_WITHIN_48H: { impact: 10, category: 'engagement' },
  QUESTIONS_3_5: { impact: 5, category: 'engagement' },
  QUESTIONS_6_10: { impact: 10, category: 'engagement' },
  QUESTIONS_10_PLUS: { impact: 15, category: 'engagement' },

  // Question Intent & Quality (Positive)
  ASKED_PRICING: { impact: 10, category: 'intent' },
  ASKED_LOCATION: { impact: 10, category: 'intent' },
  ASKED_LEGAL: { impact: 10, category: 'intent' },
  ASKED_REMOTE_BUYING: { impact: 10, category: 'intent' },
  ASKED_DETAILS: { impact: 5, category: 'intent' },
  ASKED_AVAILABILITY: { impact: 5, category: 'intent' },

  // Conversion Actions (Positive)
  SUBMITTED_CONTACT: { impact: 15, category: 'conversion' },
  BOOKED_VIEWING: { impact: 30, category: 'conversion' },
  ASKED_CONTACT_AGENT: { impact: 20, category: 'conversion' },
  REQUESTED_BROCHURE: { impact: 10, category: 'conversion' },

  // Negative Events (for decreasing trends)
  SCORE_DECAY_LIGHT: { impact: -3, category: 'decay' },
  SCORE_DECAY_MEDIUM: { impact: -5, category: 'decay' },
  SCORE_DECAY_HEAVY: { impact: -8, category: 'decay' },
  NEGATIVE_INTERACTION: { impact: -2, category: 'decay' },
  SPAM_BEHAVIOR: { impact: -10, category: 'decay' }
};

// Available listing IDs from the chat messages
const LISTING_IDS = ['ap-01', 'ap-02', 'ap-03', 'ap-04', 'ap-05', 'ap-06', 'ap-07', 'ap-08', 'ap-09', 'ap-10'];

// Generate realistic event sequences for sparklines
function generateEventSequence(visitorId, baseTimestamp, numEvents = 8) {
  const events = [];
  let currentTimestamp = new Date(baseTimestamp);

  // Start with some basic engagement
  const initialEvents = [
    { type: 'CLICKED_LISTING', delay: 0 },
    { type: 'TIME_5_10_MIN', delay: 5 * 60 * 1000 }, // 5 minutes
    { type: 'ASKED_PRICING', delay: 2 * 60 * 1000 }, // 2 minutes later
  ];

  // Add initial events
  for (const event of initialEvents) {
    currentTimestamp = new Date(currentTimestamp.getTime() + event.delay);
    events.push({
      visitor_id: visitorId,
      event_type: event.type,
      timestamp: currentTimestamp.toISOString(),
      score_impact: EVENT_TYPES[event.type].impact,
      listing_id: LISTING_IDS[Math.floor(Math.random() * LISTING_IDS.length)],
      client_id: IMOPRIME_CLIENT_ID
    });
  }

  // Generate additional random events
  const remainingEvents = numEvents - initialEvents.length;
  for (let i = 0; i < remainingEvents; i++) {
    // Random delay between 1-30 minutes
    const delay = (1 + Math.random() * 29) * 60 * 1000;
    currentTimestamp = new Date(currentTimestamp.getTime() + delay);

    // Weight event selection by category (including negative events for variety)
    let selectedEvent;
    const rand = Math.random();
    console.log(`🎲 Random value: ${rand.toFixed(3)}`);

    if (rand < 0.35) { // 35% engagement events
      const engagementEvents = Object.keys(EVENT_TYPES).filter(key => EVENT_TYPES[key].category === 'engagement');
      selectedEvent = engagementEvents[Math.floor(Math.random() * engagementEvents.length)];
      console.log(`📈 Selected engagement event: ${selectedEvent}`);
    } else if (rand < 0.7) { // 35% intent events
      const intentEvents = Object.keys(EVENT_TYPES).filter(key => EVENT_TYPES[key].category === 'intent');
      selectedEvent = intentEvents[Math.floor(Math.random() * intentEvents.length)];
      console.log(`🎯 Selected intent event: ${selectedEvent}`);
    } else if (rand < 0.85) { // 15% conversion events
      const conversionEvents = Object.keys(EVENT_TYPES).filter(key => EVENT_TYPES[key].category === 'conversion');
      selectedEvent = conversionEvents[Math.floor(Math.random() * conversionEvents.length)];
      console.log(`💰 Selected conversion event: ${selectedEvent}`);
    } else { // 15% decay/negative events (for decreasing trends)
      const decayEvents = Object.keys(EVENT_TYPES).filter(key => EVENT_TYPES[key].category === 'decay');
      selectedEvent = decayEvents[Math.floor(Math.random() * decayEvents.length)];
      console.log(`🔴 Selected negative event: ${selectedEvent} with impact: ${EVENT_TYPES[selectedEvent].impact}`);
    }

    events.push({
      visitor_id: visitorId,
      event_type: selectedEvent,
      timestamp: currentTimestamp.toISOString(),
      score_impact: EVENT_TYPES[selectedEvent].impact,
      listing_id: LISTING_IDS[Math.floor(Math.random() * LISTING_IDS.length)],
      client_id: IMOPRIME_CLIENT_ID
    });
  }

  return events;
}

async function populateEventsForVisitors() {
  console.log('🚀 Starting event population for Imoprime visitors...');

  try {
    // Get all visitors for Imoprime client
    const { data: visitors, error: visitorsError } = await supabase
      .from('visitors')
      .select('visitor_id, created_at')
      .eq('client_id', IMOPRIME_CLIENT_ID);

    if (visitorsError) {
      console.error('❌ Error fetching visitors:', visitorsError);
      return;
    }

    if (!visitors || visitors.length === 0) {
      console.log('⚠️ No visitors found for Imoprime client');
      return;
    }

    console.log(`📊 Found ${visitors.length} visitors to populate with events`);

    let totalEventsCreated = 0;

    // Process each visitor
    for (const visitor of visitors) {
      console.log(`\n👤 Processing visitor: ${visitor.visitor_id}`);

      // Check existing events for this visitor
      const { data: existingEvents, error: checkError } = await supabase
        .from('events')
        .select('id')
        .eq('visitor_id', visitor.visitor_id);

      if (checkError) {
        console.error(`❌ Error checking existing events for ${visitor.visitor_id}:`, checkError);
        continue;
      }

      const existingCount = existingEvents ? existingEvents.length : 0;
      console.log(`   📈 Existing events: ${existingCount}`);

      // Generate new events (aim for 8-12 total events per visitor)
      const targetTotalEvents = 8 + Math.floor(Math.random() * 5); // 8-12 events
      const eventsToCreate = Math.max(0, targetTotalEvents - existingCount);

      if (eventsToCreate === 0) {
        console.log(`   ✅ Already has sufficient events (${existingCount})`);
        continue;
      }

      console.log(`   🎯 Creating ${eventsToCreate} new events`);

      // Generate event sequence
      let newEvents = generateEventSequence(
        visitor.visitor_id,
        visitor.created_at,
        eventsToCreate
      );

      // Force at least one negative event per visitor for testing
      if (eventsToCreate > 0 && !newEvents.some(e => e.score_impact < 0)) {
        console.log(`⚡ Forcing negative event for ${visitor.visitor_id}`);
        const decayEvents = Object.keys(EVENT_TYPES).filter(key => EVENT_TYPES[key].category === 'decay');
        const randomDecayEvent = decayEvents[Math.floor(Math.random() * decayEvents.length)];

        // Replace the last event with a negative one
        if (newEvents.length > 0) {
          newEvents[newEvents.length - 1] = {
            visitor_id: visitor.visitor_id,
            event_type: randomDecayEvent,
            timestamp: newEvents[newEvents.length - 1].timestamp,
            score_impact: EVENT_TYPES[randomDecayEvent].impact,
            listing_id: LISTING_IDS[Math.floor(Math.random() * LISTING_IDS.length)],
            client_id: IMOPRIME_CLIENT_ID
          };
        }
      }

      // Insert events in batches
      const batchSize = 5;
      for (let i = 0; i < newEvents.length; i += batchSize) {
        const batch = newEvents.slice(i, i + batchSize);

        const { error: insertError } = await supabase
          .from('events')
          .insert(batch);

        if (insertError) {
          console.error(`❌ Error inserting batch for ${visitor.visitor_id}:`, insertError);
        } else {
          console.log(`   ✅ Inserted ${batch.length} events`);
          totalEventsCreated += batch.length;
        }
      }
    }

    console.log(`\n🎉 Event population complete!`);
    console.log(`📈 Total events created: ${totalEventsCreated}`);

    // Check how many negative events were created
    const { data: allNewEvents, error: countError } = await supabase
      .from('events')
      .select('score_impact')
      .eq('client_id', IMOPRIME_CLIENT_ID)
      .lt('score_impact', 0);

    if (!countError && allNewEvents) {
      console.log(`🔴 Negative events created: ${allNewEvents.length}`);
    }

    console.log(`🎨 Sparklines should now show rich historical data with both increasing and decreasing trends!`);

  } catch (error) {
    console.error('❌ Fatal error during event population:', error);
  }
}

// Run the script
populateEventsForVisitors().catch(console.error);