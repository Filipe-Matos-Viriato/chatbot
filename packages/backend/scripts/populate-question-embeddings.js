const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const googleApiKey = process.env.GOOGLE_API_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey || !googleApiKey) {
  console.error('Supabase URL, Service Role Key, or Google API Key is missing in environment variables.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);
const genAI = new GoogleGenerativeAI(googleApiKey);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

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
      const embeddingResult = await embeddingModel.embedContent({
        content: { parts: [{ text: q.question_text }] },
        taskType: "RETRIEVAL_QUERY",
      });
      embeddingsToInsert.push({
        question_id: q.id,
        listing_id: q.listing_id,
        embedding: embeddingResult.embedding.values,
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