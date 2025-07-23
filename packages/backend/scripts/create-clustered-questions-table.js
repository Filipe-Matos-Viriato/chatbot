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

async function createClusteredQuestionsTable() {
  console.log('Creating clustered_questions table...');

  const { error } = await supabase.rpc('execute_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS clustered_questions (
        id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        client_id TEXT NOT NULL,
        listing_id TEXT,
        cluster_id TEXT NOT NULL,
        question_text TEXT NOT NULL,
        count INT DEFAULT 1,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_clustered_questions_client_id ON clustered_questions(client_id);
      CREATE INDEX IF NOT EXISTS idx_clustered_questions_listing_id ON clustered_questions(listing_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_clustered_questions_cluster_id_listing_id ON clustered_questions(cluster_id, listing_id);
    `
  });

  if (error) {
    console.error('Error creating clustered_questions table:', error);
  } else {
    console.log('Successfully created clustered_questions table.');
  }
}

createClusteredQuestionsTable().catch(console.error);