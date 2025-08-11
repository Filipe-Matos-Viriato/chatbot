// packages/backend/scripts/populate-events-imoprime.cjs
// This script populates the 'events' table based on existing 'chat_messages' data.
// It ensures that leads displayed in the dashboard are linked to actual chat history.
// Relevant files: packages/backend/src/index.js, packages/backend/src/services/visitor-service.js, packages/backend/supabase_sql_tables/chat_messages.sql

const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const fetch = require('node-fetch');
const supabase = require('../src/config/supabase.js').default; // Import Supabase client

const BASE_URL = 'http://localhost:3007'; // Ensure this matches your backend server port
const CLIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Hardcoded Client ID for Imoprime

async function fetchChatMessages() {
  console.log('Fetching chat messages to identify visitor_id and listing_id pairs...');
  const { data, error } = await supabase
    .from('chat_messages')
    .select('visitor_id, listing_id')
    .eq('client_id', CLIENT_ID);

  if (error) {
    console.error('Error fetching chat messages:', error);
    throw error;
  }

  console.log(`Found ${data.length} chat messages.`);
  return data;
}

async function logEvent(visitorId, eventType, listingId = null) {
  try {
    const response = await fetch(`${BASE_URL}/v1/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': CLIENT_ID,
      },
      body: JSON.stringify({ visitorId, eventType, listingId, clientId: CLIENT_ID }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Failed to log event ${eventType} for ${visitorId} (Status: ${response.status}): ${errorText}`);
      return false;
    }

    const data = await response.json();
    console.log(`Logged event ${eventType} for ${visitorId}. New score: ${data.new_lead_score}`);
    return true;
  } catch (error) {
    console.error(`Error logging event ${eventType} for ${visitorId}:`, error);
    return false;
  }
}

async function populateEvents() {
  const chatMessages = await fetchChatMessages();
  const uniquePairs = new Set(); // To store unique 'visitor_id-listing_id' combinations

  for (const message of chatMessages) {
    if (message.visitor_id && message.listing_id) {
      const pair = `${message.visitor_id}-${message.listing_id}`;
      if (!uniquePairs.has(pair)) {
        uniquePairs.add(pair);
        console.log(`Processing unique pair: visitor_id=${message.visitor_id}, listing_id=${message.listing_id}`);
        // Log a 'CLICKED_LISTING' event for each unique visitor-listing interaction
        await logEvent(message.visitor_id, 'CLICKED_LISTING', message.listing_id);
      }
    } else if (message.visitor_id && !message.listing_id) {
      // Handle general interactions not tied to a specific listing
      const pair = `${message.visitor_id}-general`;
      if (!uniquePairs.has(pair)) {
        uniquePairs.add(pair);
        console.log(`Processing unique general interaction: visitor_id=${message.visitor_id}`);
        await logEvent(message.visitor_id, 'QUESTIONS_3_5', null); // Log a general engagement event
      }
    }
  }
  console.log('Event population complete.');
}

populateEvents().catch(console.error);