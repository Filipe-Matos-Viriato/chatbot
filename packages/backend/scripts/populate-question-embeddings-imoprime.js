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

const IMOPRIME_CLIENT_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

async function populateQuestionEmbeddings() {
  console.log('Populating question_embeddings table...');

  // Fetch all user messages from the chat_messages table
  const { data: userMessages, error: fetchMessagesError } = await supabase
    .from('chat_messages')
    .select('id, message_text, listing_id, client_id, listing_uuid')
    .eq('client_id', IMOPRIME_CLIENT_ID)
    .eq('sender_role', 'user');

  if (fetchMessagesError) {
    console.error('Error fetching user messages:', fetchMessagesError);
    return;
  }

  if (!userMessages || userMessages.length === 0) {
    console.log('No user messages found in the chat_messages table. Please populate it first.');
    return;
  }

  const embeddingsToInsert = [];
  for (const msg of userMessages) {
    try {
      const embedding = await chatHistoryService.generateEmbedding(msg.message_text);
      embeddingsToInsert.push({
        question_id: msg.id, // Use chat_messages.id as question_id
        listing_id: msg.listing_uuid, // Use listing_uuid from chat_messages
        embedding: embedding,
        client_id: msg.client_id, // Include client_id in the embedding
      });
    } catch (embedError) {
      console.error(`Error generating embedding for message "${msg.message_text}" (ID: ${msg.id}):`, embedError);
      // Continue to next message even if one embedding fails
    }
  }

  if (embeddingsToInsert.length > 0) {
    console.log(`Inserting ${embeddingsToInsert.length} embeddings into question_embeddings...`);
    const { error: insertError } = await supabase
      .from('question_embeddings')
      .insert(embeddingsToInsert);

    if (insertError) {
      console.error('Error inserting embeddings:', insertError);
    } else {
      console.log('Successfully populated question_embeddings table.');
    }
  } else {
    console.log('No embeddings to insert.');
  }
}

populateQuestionEmbeddings().catch(console.error);