// packages/backend/scripts/populate-prerequisites.js
// This script populates the clients, visitors, and developments tables with prerequisite data for testing.
// This script exists to ensure foreign key constraints are met for populating chat_messages.
// Relevant files: packages/backend/src/config/supabase.js, packages/backend/scripts/populate-chat-messages.js

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid'; // For generating UUIDs

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing in environment variables. Please ensure your .env file is correctly configured.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);


const CLIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Imoprime client ID

async function populatePrerequisites() {
  console.log('Populating prerequisite tables (visitors)...');

  // 1. Insert visitor data
  const visitorsToGenerate = 20;
  const visitorsData = [];
  for (let i = 1; i <= visitorsToGenerate; i++) {
    const visitorId = `visitor-${i.toString().padStart(2, '0')}`;
    visitorsData.push({
      visitor_id: visitorId,
      client_id: CLIENT_ID,
      lead_score: Math.floor(Math.random() * 100), // Random lead score
    });
  }

  for (const visitor of visitorsData) {
    const { error } = await supabase.from('visitors').upsert(visitor, { onConflict: 'visitor_id' });
    if (error) {
      console.error(`Error upserting visitor ${visitor.visitor_id}:`, error);
    } else {
      console.log(`Visitor ${visitor.visitor_id} upserted.`);
    }
  }

  console.log(`Generated and upserted ${visitorsToGenerate} visitors.`);
  console.log('Prerequisite data population complete.');
}

populatePrerequisites();