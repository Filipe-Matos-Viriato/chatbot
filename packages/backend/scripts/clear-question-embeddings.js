// File: packages/backend/scripts/clear-question-embeddings.js
// Description: This script truncates the 'question_embeddings' table in Supabase.
// Why this file exists: To clear old embeddings before re-populating with new ones.
// Relevant files: packages/backend/src/config/supabase.js, packages/backend/scripts/populate-question-embeddings.js

const supabase = require('../src/config/supabase');

async function clearQuestionEmbeddings() {
  console.log('Truncating question_embeddings table...');
  const { error } = await supabase.from('question_embeddings').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all rows
  // Supabase doesn't have a direct TRUNCATE equivalent via client, so we delete all rows.
  // Using a dummy condition like .neq('id', '00000000-0000-0000-0000-000000000000') ensures all rows are targeted.

  if (error) {
    console.error('Error truncating question_embeddings table:', error);
  } else {
    console.log('Successfully truncated question_embeddings table.');
  }
}

clearQuestionEmbeddings().catch(console.error);