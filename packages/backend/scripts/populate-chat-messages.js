// packages/backend/scripts/populate-chat-messages.js
// This script populates the chat_messages table with fake data for testing purposes.
// This script exists to provide sample chat history for frontend display verification.
// Relevant files: packages/backend/src/config/supabase.js, packages/backend/src/index.js

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing in environment variables. Please ensure your .env file is correctly configured.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

const CLIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Imoprime client ID

async function populateChatMessages() {
  console.log('Populating chat_messages table with fake data...');

  const numVisitors = 20;
  const fakeMessages = [];

  for (let i = 1; i <= numVisitors; i++) {
    const visitorId = `visitor-${i.toString().padStart(2, '0')}`;
    const sessionId = `session-${Math.random().toString(36).substring(2, 15)}`;
    const listingNum = Math.floor(Math.random() * 10) + 1;
    const listingId = `ap-${listingNum < 10 ? '0' + listingNum : listingNum}`; // Random listing ID (lowercase with leading zero for 1-9)

    // User message
    fakeMessages.push({
      visitor_id: visitorId,
      session_id: sessionId,
      client_id: CLIENT_ID,
      message_text: `Olá, estou interessado no apartamento ${listingId}. Qual é o preço?`,
      sender_role: 'user',
      timestamp: new Date(Date.now() - (numVisitors - i) * 60000 - 10000).toISOString(), // Spread out timestamps
      listing_id: listingId,
      development_id: null,
    });

    // Assistant response
    fakeMessages.push({
      visitor_id: visitorId,
      session_id: sessionId,
      client_id: CLIENT_ID,
      message_text: `O apartamento ${listingId} está disponível por ${Math.floor(Math.random() * 200000) + 200000} EUR. Posso ajudar com mais alguma informação?`,
      sender_role: 'assistant',
      timestamp: new Date(Date.now() - (numVisitors - i) * 60000 - 5000).toISOString(), // Slightly after user message
      listing_id: listingId,
      development_id: null,
    });
  }

  for (const message of fakeMessages) {
    const { error } = await supabase.from('chat_messages').insert([message]);
    if (error) {
      console.error('Error inserting fake message:', error);
    } else {
      console.log(`Inserted message for visitor ${message.visitor_id}`);
    }
  }

  console.log('Fake data population complete.');
}

populateChatMessages();