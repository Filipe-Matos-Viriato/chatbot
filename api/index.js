// Import all the backend dependencies and logic
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
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

// API endpoints for Client Management
app.get('/api/v1/clients', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('clients')
      .select('*');

    if (error) {
      console.error('Error fetching clients:', error);
      return res.status(500).json({ error: 'Failed to fetch clients.' });
    }
    res.json(data);
  } catch (error) {
    console.error('Error in /api/v1/clients endpoint:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.post('/api/v1/clients', async (req, res) => {
  try {
    const { client_name, chatbot_name } = req.body;
    
    if (!client_name || !chatbot_name) {
      return res.status(400).json({ error: 'Client name and chatbot name are required.' });
    }

    // Generate a UUID for the new client
    const clientId = uuidv4();

    const { data, error } = await supabase
      .from('clients')
      .insert([
        {
          client_id: clientId,
          client_name,
          chatbot_name,
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Error creating client:', error);
      return res.status(500).json({ error: 'Failed to create client.' });
    }

    res.status(201).json(data);
  } catch (error) {
    console.error('Error in /api/v1/clients POST endpoint:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.put('/api/v1/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const { data, error } = await supabase
      .from('clients')
      .update(updateData)
      .eq('client_id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating client:', error);
      return res.status(500).json({ error: 'Failed to update client.' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in /api/v1/clients PUT endpoint:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.delete('/api/v1/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('clients')
      .delete()
      .eq('client_id', id);

    if (error) {
      console.error('Error deleting client:', error);
      return res.status(500).json({ error: 'Failed to delete client.' });
    }

    res.json({ success: true, message: 'Client deleted successfully.' });
  } catch (error) {
    console.error('Error in /api/v1/clients DELETE endpoint:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// Debug endpoint to test Pinecone retrieval
app.get('/api/debug/pinecone/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;
    const testQuery = req.query.q || "apartamentos disponíveis";
    
    // Import required modules for this debug endpoint
    const { Pinecone } = require('@pinecone-database/pinecone');
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    
    const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
    const pineconeIndex = pinecone.index(process.env.PINECONE_INDEX_NAME);
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });
    
    console.log(`[DEBUG] Testing Pinecone retrieval for client: ${clientId}`);
    console.log(`[DEBUG] Using index: ${process.env.PINECONE_INDEX_NAME}`);
    console.log(`[DEBUG] Using namespace: ${process.env.PINECONE_NAMESPACE}`);
    console.log(`[DEBUG] Test query: ${testQuery}`);
    
    // Generate embedding for test query
    const queryEmbedding = await embeddingModel.embedContent({
      content: { parts: [{ text: testQuery }] },
      taskType: "RETRIEVAL_QUERY",
    });
    
    // Test search with client filter
    const searchResponse = await pineconeIndex
      .namespace(process.env.PINECONE_NAMESPACE)
      .query({
        vector: queryEmbedding.embedding.values,
        topK: 10,
        includeMetadata: true,
        filter: { client_id: clientId },
      });
    
    // Test search without client filter to see all data
    const allDataResponse = await pineconeIndex
      .namespace(process.env.PINECONE_NAMESPACE)
      .query({
        vector: queryEmbedding.embedding.values,
        topK: 5,
        includeMetadata: true,
      });
    
    const debugInfo = {
      config: {
        index: process.env.PINECONE_INDEX_NAME,
        namespace: process.env.PINECONE_NAMESPACE,
        clientId: clientId,
        testQuery: testQuery
      },
      clientSpecificResults: {
        count: searchResponse.matches?.length || 0,
        matches: searchResponse.matches?.map(match => ({
          id: match.id,
          score: match.score,
          metadata: {
            client_id: match.metadata?.client_id,
            source: match.metadata?.source,
            text_preview: match.metadata?.text?.substring(0, 200) + "...",
            listing_id: match.metadata?.listing_id,
            development_id: match.metadata?.development_id
          }
        })) || []
      },
      allDataSample: {
        count: allDataResponse.matches?.length || 0,
        matches: allDataResponse.matches?.map(match => ({
          id: match.id,
          score: match.score,
          metadata: {
            client_id: match.metadata?.client_id,
            source: match.metadata?.source,
            text_preview: match.metadata?.text?.substring(0, 100) + "..."
          }
        })) || []
      }
    };
    
    res.json(debugInfo);
  } catch (error) {
    console.error('Debug endpoint error:', error);
    res.status(500).json({ 
      error: error.message,
      stack: error.stack 
    });
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