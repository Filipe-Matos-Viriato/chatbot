// Import all the backend dependencies and logic
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { generateResponse, generateSuggestedQuestions, embeddingModel } = require('../packages/backend/src/rag-service');
const cron = require('node-cron');
const { clusterQuestions } = require('../packages/backend/scripts/cluster-questions');
const { getClientConfig } = require('../packages/backend/src/services/client-config-service');
const { processDocument } = require('../packages/backend/src/services/ingestion-service');
const visitorService = require('../packages/backend/src/services/visitor-service');
const supabase = require('../packages/backend/src/config/supabase');
const multer = require('multer');

// Configure multer for in-memory file storage
const upload = multer({ storage: multer.memoryStorage() });

const app = express();

app.use(cors());
app.use(express.json());

// Import and use all the routes from the original backend
// Copy all the middleware and routes from the original index.js

// Middleware to load client configuration an attach it to the request
const clientConfigMiddleware = async (req, res, next) => {
 const clientId = req.body.clientId || req.headers['x-client-id'] || req.query.clientId;

 if (!clientId) {
   return res.status(400).json({ error: 'Client ID is required' });
 }

 try {
   req.clientConfig = await getClientConfig(clientId);
   next();
 } catch (error) {
   console.error(`Failed to load configuration for client: ${clientId}`, error);
   return res.status(404).json({ error: `Configuration not found for client: ${clientId}` });
 }
};

// All the routes from the original backend - I'll include the essential ones
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// API endpoint to handle chat requests
app.post('/api/chat', clientConfigMiddleware, async (req, res) => {
  try {
    const { query, sessionId, context } = req.body;
    const { clientConfig } = req;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const responseText = await generateResponse(query, clientConfig, context);

    // Log the user's question and its embedding
    try {
      const { data: insertedQuestion, error: insertQuestionError } = await supabase
        .from('questions')
        .insert([
          {
            question_text: query,
            listing_id: context?.listingId || null,
            status: 'answered',
            visitor_id: req.body.sessionId,
          },
        ])
        .select('id');

      if (insertQuestionError) {
        console.error('Error inserting question into Supabase:', insertQuestionError);
      } else if (insertedQuestion && insertedQuestion.length > 0) {
        const questionId = insertedQuestion[0].id;

        const embeddingResult = await embeddingModel.embedContent({
          content: { parts: [{ text: query }] },
          taskType: "RETRIEVAL_QUERY",
        });

        const { error: insertEmbeddingError } = await supabase
          .from('question_embeddings')
          .insert([
            {
              question_id: questionId,
              listing_id: context?.listingId || null,
              embedding: embeddingResult.embedding.values,
            },
          ]);

        if (insertEmbeddingError) {
          console.error('Error inserting question embedding into Supabase:', insertEmbeddingError);
        }
      }
    } catch (logError) {
      console.error('Error logging question or embedding:', logError);
    }

    res.json({ response: responseText });
  } catch (error) {
    console.error('Error processing chat request:', error);
    const errorMessage = error.status === 503
      ? 'The AI model is temporarily overloaded. Please try again in a few moments.'
      : 'Failed to process chat request.';
    res.status(error.status || 500).json({ error: errorMessage });
  }
});

// Widget configuration endpoint
app.get('/api/v1/widget/config/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const clientConfig = await getClientConfig(clientId);
    res.json(clientConfig);
  } catch (error) {
    console.error(`Error fetching widget config for client ${req.params.clientId}:`, error);
    res.status(404).json({ error: 'Configuration not found.' });
  }
});

// Add other essential routes as needed...

module.exports = app; 