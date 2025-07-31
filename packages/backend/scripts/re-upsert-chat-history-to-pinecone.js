// File: packages/backend/scripts/re-upsert-chat-history-to-pinecone.js
// Description: This script fetches chat history (questions) from the Supabase 'questions' table
//              and re-upserts them to the Pinecone 'chat-history-1536' index using ChatHistoryService.
// Why this file exists: To re-populate the Pinecone chat history index after schema changes or data migration.
// Relevant files: packages/backend/src/services/chat-history-service.js, packages/backend/src/config/supabase.js, packages/backend/.env

import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), './packages/backend/.env') });

import { createClient } from '@supabase/supabase-js';
import ChatHistoryService from '../src/services/chat-history-service.js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const chatHistoryService = new ChatHistoryService();

async function reUpsertChatHistoryToPinecone() {
  console.log('Starting re-upsert of chat history to Pinecone...');

  // Fetch all questions from the questions table, joining with listings to get client_id
  const { data: questions, error: fetchQuestionsError } = await supabase
    .from('questions')
    .select(`
      id,
      question_text,
      listing_id,
      asked_at,
      visitor_id,
      listings (
        client_id
      )
    `);

  if (fetchQuestionsError) {
    console.error('Error fetching questions:', fetchQuestionsError);
    return;
  }

  if (!questions || questions.length === 0) {
    console.log('No questions found in the questions table. Exiting.');
    return;
  }

  console.log(`Found ${questions.length} questions to upsert.`);

  let successfulUpserts = 0;
  let failedUpserts = 0;

  for (const q of questions) {
    // Extract client_id from the joined listings data
    const client_id = q.listings ? q.listings.client_id : 'default-client'; // Use a default if listing_id is null or client_id is missing

    // Construct a unique session_id and turn_id for each message
    // For historical questions, we can create a pseudo session_id and turn_id
    const safe_visitor_id = String(q.visitor_id || 'unknown_visitor'); // Ensure visitor_id is always a string
    const session_id = `${safe_visitor_id}-${new Date(q.asked_at || new Date()).getTime()}`; // Use current timestamp if asked_at is null
    const turn_id = q.id; // Use question ID as turn_id for uniqueness

    const message = {
      text: q.question_text,
      role: 'user', // Assuming questions are from the user
      client_id: client_id,
      visitor_id: safe_visitor_id,
      session_id: session_id,
      timestamp: q.asked_at ? new Date(q.asked_at).toISOString() : new Date().toISOString(), // Ensure timestamp is a valid ISO string
      turn_id: turn_id,
    };

    try {
      await chatHistoryService.upsertMessage(message);
      successfulUpserts++;
    } catch (upsertError) {
      console.error(`Error upserting message for question "${q.question_text}" (ID: ${q.id}):`, upsertError.message);
      failedUpserts++;
    }
  }

  console.log(`Re-upsert process completed.`);
  console.log(`Successful upserts: ${successfulUpserts}`);
  console.log(`Failed upserts: ${failedUpserts}`);
}

reUpsertChatHistoryToPinecone().catch(console.error);