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

async function populateQuestionEmbeddings() {
  console.log('Populating question_embeddings table...');

  // Fetch all questions from the questions table
  const { data: questions, error: fetchQuestionsError } = await supabase
    .from('questions')
    .select('id, question_text, listing_id');

  if (fetchQuestionsError) {
    console.error('Error fetching questions:', fetchQuestionsError);
    return;
  }

  if (!questions || questions.length === 0) {
    console.log('No questions found in the questions table. Please populate it first.');
    return;
  }

  const embeddingsToInsert = [];
  for (const q of questions) {
    try {
      const embedding = await chatHistoryService.generateEmbedding(q.question_text);
      embeddingsToInsert.push({
        question_id: q.id,
        listing_id: q.listing_id,
        embedding: embedding,
      });
    } catch (embedError) {
      console.error(`Error generating embedding for question "${q.question_text}" (ID: ${q.id}):`, embedError);
      // Continue to next question even if one embedding fails
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