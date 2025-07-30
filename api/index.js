// Import all the backend dependencies and logic
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const { generateResponse, generateSuggestedQuestions, embeddingModel } = require('../packages/backend/src/rag-service');
const cron = require('node-cron');
const { clusterQuestions } = require('../packages/backend/scripts/cluster-questions');
// Import client configuration service for database lookups
const { getClientConfig } = require('../packages/backend/src/services/client-config-service');
const { processDocument } = require('../packages/backend/src/services/ingestion-service');
const visitorService = require('../packages/backend/src/services/visitor-service');
const onboardingService = require('../packages/backend/src/services/onboarding-service');
const supabase = require('../packages/backend/src/config/supabase');
const multer = require('multer');

// Configure multer for in-memory file storage
const upload = multer({ storage: multer.memoryStorage() });

const app = express();

// Updated CORS configuration for third-party websites
app.use(cors({
  origin: true, // Allow requests from any origin (necessary for embedded widgets)
  credentials: true, // Allow cookies and auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Id', 'X-User-Id', 'X-User-Role']
}));
app.use(express.json());

// Middleware to load client configuration and attach it to the request
const clientConfigMiddleware = async (req, res, next) => {
  const clientId = req.body.clientId || req.headers['x-client-id'] || req.query.clientId;

  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required' });
  }

  try {
    // Load client configuration from database
    const clientConfig = await getClientConfig(clientId);
    req.clientConfig = clientConfig;
    next();
  } catch (error) {
    console.error(`Failed to load configuration for client: ${clientId}`, error);
    return res.status(404).json({ error: `Configuration not found for client: ${clientId}` });
  }
};

// Root endpoint
app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// ===== ONBOARDING ENDPOINTS =====

// Session creation endpoint (existing)
app.post('/v1/sessions', async (req, res) => {
  try {
    const { clientId } = req.body;
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }
    
    // For now, create a simple visitor session with onboarding needed
    const visitorId = `visitor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Always require onboarding for new visitors for this hardcoded client
    const needsOnboarding = clientId === 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c';
    
    res.status(201).json({ 
      visitor_id: visitorId,
      needs_onboarding: needsOnboarding
    });
  } catch (error) {
    console.error('Error creating visitor session:', error);
    res.status(500).json({ error: 'Failed to create visitor session.' });
  }
});

// Add onboarding questions endpoint
app.get('/v1/visitors/:visitorId/onboarding', async (req, res) => {
  try {
    const { visitorId } = req.params;
    const { clientId } = req.query;
    
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }
    
    // For the specific hardcoded client, return the onboarding questions
    if (clientId === 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c') {
      const onboardingQuestions = {
        "questions": [
          {
            "id": "tipologia",
            "type": "multiple_choice", 
            "question": "Que tipo de imóvel procura?",
            "options": [
              { "value": "T0", "label": "T0 - Estúdio" },
              { "value": "T1", "label": "T1 - 1 Quarto" },
              { "value": "T2", "label": "T2 - 2 Quartos" },
              { "value": "T3", "label": "T3 - 3 Quartos" },
              { "value": "T4+", "label": "T4+ - 4 ou mais Quartos" },
              { "value": "moradia", "label": "Moradia" },
              { "value": "comercial", "label": "Comercial" }
            ],
            "required": true
          },
          {
            "id": "orcamento",
            "type": "range_select",
            "question": "Qual o seu orçamento?",
            "options": [
              { "value": "<150k", "label": "Até 150.000€" },
              { "value": "150k-300k", "label": "150.000€ - 300.000€" },
              { "value": "300k-500k", "label": "300.000€ - 500.000€" },
              { "value": "500k-750k", "label": "500.000€ - 750.000€" },
              { "value": ">750k", "label": "Mais de 750.000€" }
            ],
            "required": true
          },
          {
            "id": "objetivo",
            "type": "multiple_choice",
            "question": "Qual o objetivo da compra?",
            "options": [
              { "value": "habitacao", "label": "Habitação Própria" },
              { "value": "investimento", "label": "Investimento" },
              { "value": "ambos", "label": "Ambos" }
            ],
            "required": true
          },
          {
            "id": "prazo",
            "type": "multiple_choice",
            "question": "Em que prazo pretende comprar?",
            "options": [
              { "value": "imediato", "label": "Imediatamente" },
              { "value": "3-6meses", "label": "3-6 meses" },
              { "value": "6-12meses", "label": "6-12 meses" },
              { "value": "+12meses", "label": "Mais de 12 meses" }
            ],
            "required": true
          },
          {
            "id": "localizacao",
            "type": "text_input",
            "question": "Onde prefere que seja localizado o imóvel? (Concelho, Distrito)",
            "placeholder": "Ex: Lisboa, Porto, Cascais...",
            "required": false
          },
          {
            "id": "caracteristicas",
            "type": "multiple_select",
            "question": "Que características considera importantes?",
            "options": [
              { "value": "varanda", "label": "Varanda/Terraço" },
              { "value": "garagem", "label": "Garagem" },
              { "value": "elevador", "label": "Elevador" },
              { "value": "piscina", "label": "Piscina" },
              { "value": "jardim", "label": "Jardim" },
              { "value": "vista_mar", "label": "Vista Mar" },
              { "value": "centro_cidade", "label": "Centro da Cidade" },
              { "value": "transportes", "label": "Perto de Transportes" }
            ],
            "required": false
          }
        ],
        "settings": {
          "completion_message": "Obrigado! Com base nas suas preferências, posso agora ajudá-lo a encontrar o imóvel perfeito.",
          "skip_option": "Continuar sem responder",
          "title": "Ajude-nos a encontrar o seu imóvel ideal",
          "subtitle": "Responda a algumas perguntas para recebermos recomendações personalizadas"
        }
      };
      
      console.log(`Returning onboarding questions for visitor ${visitorId}, client ${clientId}`);
      res.json(onboardingQuestions);
      return;
    }
    
    // For other clients, return no questions
    res.status(404).json({ error: 'Onboarding not configured for this client' });
    
  } catch (error) {
    console.error(`Error fetching onboarding questions for visitor ${req.params.visitorId}:`, error);
    res.status(500).json({ error: 'Failed to fetch onboarding questions' });
  }
});

// Add onboarding submission endpoint
app.post('/v1/visitors/:visitorId/onboarding', async (req, res) => {
  try {
    const { visitorId } = req.params;
    const { answers, completed } = req.body;
    
    // For the hardcoded implementation, we'll just simulate success
    // In a real implementation, this would save to database
    console.log(`Onboarding answers received for visitor ${visitorId}:`, answers);
    console.log(`Onboarding completed: ${completed}`);
    
    res.status(200).json({ 
      success: true,
      message: 'Onboarding answers submitted successfully',
      visitor_id: visitorId,
      answers: answers,
      completed: completed
    });
    
  } catch (error) {
    console.error(`Error submitting onboarding for visitor ${req.params.visitorId}:`, error);
    res.status(500).json({ error: 'Failed to submit onboarding answers' });
  }
});

// Update onboarding answers
app.put('/v1/visitors/:visitorId/onboarding', async (req, res) => {
  try {
    const { visitorId } = req.params;
    const { answers } = req.body;

    if (!answers) {
      return res.status(400).json({ error: 'Answers are required' });
    }

    const result = await onboardingService.updateOnboardingAnswers(visitorId, answers);
    res.json(result);
  } catch (error) {
    console.error('Error updating onboarding answers:', error);
    res.status(500).json({ error: 'Failed to update onboarding answers' });
  }
});

// Get client onboarding template
app.get('/v1/clients/:clientId/onboarding-template', async (req, res) => {
  try {
    const { clientId } = req.params;
    const template = await onboardingService.getClientOnboardingTemplate(clientId);
    res.json(template);
  } catch (error) {
    console.error('Error fetching onboarding template:', error);
    res.status(500).json({ error: 'Failed to fetch onboarding template' });
  }
});

// Update client onboarding template
app.put('/v1/clients/:clientId/onboarding-template', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { template } = req.body;

    if (!template) {
      return res.status(400).json({ error: 'Template is required' });
    }

    const result = await onboardingService.updateClientOnboardingTemplate(clientId, template);
    res.json(result);
  } catch (error) {
    console.error('Error updating onboarding template:', error);
    res.status(500).json({ error: 'Failed to update onboarding template' });
  }
});

// ===== CHAT ENDPOINT =====

// API endpoint to handle chat requests (updated with onboarding support)
app.post('/api/chat', clientConfigMiddleware, async (req, res) => {
  try {
    const { query, visitorId, sessionId, context, onboardingAnswers } = req.body;
    const { clientConfig } = req;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    // Get onboarding answers if not provided but visitorId is available
    let formattedOnboardingAnswers = null;
    try {
      if (onboardingAnswers) {
        formattedOnboardingAnswers = onboardingAnswers;
      } else if (visitorId) {
        const onboardingStatus = await onboardingService.getVisitorOnboardingStatus(visitorId, clientConfig.clientId);
        if (onboardingStatus.completed && onboardingStatus.answers && onboardingStatus.questions) {
          formattedOnboardingAnswers = onboardingService.formatOnboardingAnswersForRAG(
            onboardingStatus.answers,
            onboardingStatus.questions
          );
        }
      }
    } catch (error) {
      console.warn('Could not retrieve onboarding answers for visitor:', error.message);
    }

    const responseText = await generateResponse(
      query, 
      clientConfig, 
      context, 
      null, // userContext
      "Histórico não disponível no modo serverless", // chatHistory
      formattedOnboardingAnswers
    );

    // Log the user's question and its embedding
    try {
      const { data: insertedQuestion, error: insertQuestionError } = await supabase
        .from('questions')
        .insert([
          {
            question_text: query,
            listing_id: context?.listingId || null,
            status: 'answered',
            visitor_id: visitorId || sessionId,
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

// ===== CLIENT MANAGEMENT ENDPOINTS =====

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

// GET individual client
app.get('/api/v1/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .eq('client_id', id)
      .single();

    if (error) {
      console.error('Error fetching client:', error);
      return res.status(500).json({ error: 'Failed to fetch client.' });
    }

    if (!data) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    res.json(data);
  } catch (error) {
    console.error('Error in /api/v1/clients/:id GET endpoint:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.put('/api/v1/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Debug: Log what we're trying to save
    console.log(`🔄 Updating client ${id} with data:`, {
      hasOnboardingQuestions: !!updateData.default_onboarding_questions,
      onboardingQuestionCount: updateData.default_onboarding_questions?.questions?.length || 0,
      dataKeys: Object.keys(updateData)
    });

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

    // Debug: Log what was saved
    console.log(`✅ Client ${id} updated successfully:`, {
      hasOnboardingQuestions: !!data.default_onboarding_questions,
      onboardingQuestionCount: data.default_onboarding_questions?.questions?.length || 0
    });

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
    
    // Load client configuration from database
    const clientConfig = await getClientConfig(clientId);
    
    // Debug: Log what config is being returned to widget
    console.log(`📋 Widget config for ${clientId}:`, {
      hasOnboardingQuestions: !!clientConfig.defaultOnboardingQuestions,
      onboardingQuestionCount: clientConfig.defaultOnboardingQuestions?.questions?.length || 0,
      firstQuestionId: clientConfig.defaultOnboardingQuestions?.questions?.[0]?.id || 'none',
      firstQuestionType: clientConfig.defaultOnboardingQuestions?.questions?.[0]?.type || 'none'
    });
    
    console.log(`Returning database config for client ${clientId}`);
    res.json(clientConfig);
    
  } catch (error) {
    console.error(`Error fetching widget config for client ${req.params.clientId}:`, error);
    res.status(404).json({ error: 'Configuration not found.' });
  }
});

// Global error handler to catch JSON parsing errors
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('Invalid JSON received:', err);
    return res.status(400).send({ message: 'Invalid JSON payload passed to server.' });
  }
  // Pass other errors on
  next(err);
});

module.exports = app; 