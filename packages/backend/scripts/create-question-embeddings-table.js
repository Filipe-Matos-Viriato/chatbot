const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Supabase URL or Service Role Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

async function createQuestionEmbeddingsTable() {
  console.log('Creating question_embeddings table...');

  const { error } = await supabase.rpc('execute_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS question_embeddings (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        question_id UUID NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
        listing_id TEXT NOT NULL,
        embedding VECTOR(768) NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_question_embeddings_question_id ON question_embeddings(question_id);
    `
  });

  if (error) {
    console.error('Error creating question_embeddings table:', error);
  } else {
    console.log('Successfully created question_embeddings table.');
  }
}

createQuestionEmbeddingsTable().catch(console.error);