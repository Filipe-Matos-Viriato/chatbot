require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { generateResponse, generateSuggestedQuestions, embeddingModel } = require('./rag-service');
const cron = require('node-cron');
const { clusterQuestions } = require('../scripts/cluster-questions');
const { getClientConfig, createClientConfig, updateClientConfig, deleteClientConfig } = require('./services/client-config-service');
const { processDocument } = require('./services/ingestion-service');
const visitorService = require('./services/visitor-service');
const supabase = require('./config/supabase'); // Import Supabase client
const ChatHistoryService = require('./services/chat-history-service').default; // Import ChatHistoryService
const developmentService = require('./services/development-service'); // Import Development Service
const userService = require('./services/user-service'); // Import User Service

const chatHistoryService = new ChatHistoryService();
const multer = require('multer');

// Configure multer for in-memory file storage
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const port = process.env.PORT || 3006;

app.use(cors());
app.use(express.json());

// Middleware to load client configuration and attach it to the request, along with a placeholder user context
const clientConfigMiddleware = async (req, res, next) => {
  const clientId = req.body.clientId || req.headers['x-client-id'] || req.query.clientId;
  // Placeholder for user authentication. In a real scenario, this would come from an auth system.
  // For now, we'll assume a default admin user for testing purposes if no user ID is provided.
  const userId = req.headers['x-user-id'] || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Example UUID for a placeholder user
  const userRole = req.headers['x-user-role'] || 'admin'; // Example role: 'admin' or 'promoter'

  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required' });
  }

  try {
    req.clientConfig = await getClientConfig(clientId);
    // Attach user context to the request
    req.userContext = { userId, role: userRole };
    next();
  } catch (error) {
    console.error(`Failed to load configuration for client: ${clientId} (Name: ${req.clientConfig?.clientName || 'N/A'})`, error);
    return res.status(404).json({ error: `Configuration not found for client: ${clientId}` });
  }
};

// Load client configuration for all API routes

app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// API endpoint to handle chat requests
app.post('/api/chat', clientConfigMiddleware, async (req, res) => {
  try {
    const { query, sessionId, context } = req.body;
    const { clientConfig, userContext } = req; // Config and userContext are attached by middleware
    const timestamp = new Date().toISOString();
    const turnId = Date.now().toString(); // Simple unique ID for this turn

    // Upsert user message to Pinecone
    await chatHistoryService.upsertMessage({
      text: query,
      role: 'user',
      client_id: clientConfig.clientId,
      visitor_id: sessionId,
      session_id: sessionId,
      timestamp: timestamp,
      turn_id: `${turnId}-user`,
    }, clientConfig);

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`[${clientConfig.clientName || clientConfig.clientId}] Received query: ${query}`);
    console.log(`[${clientConfig.clientName || clientConfig.clientId}] Received context: ${JSON.stringify(context)}`);

    const responseText = await generateResponse(query, clientConfig, context, userContext);

    // Log the user's question and its embedding to the questions and question_embeddings tables
    try {
      const { data: insertedQuestion, error: insertQuestionError } = await supabase
        .from('questions')
        .insert([
          {
            question_text: query,
            chatbot_response: responseText,
            listing_id: context?.listingId || null, // Assuming listingId is passed in context
            status: 'answered', // Mark as answered since a response is generated
            visitor_id: req.body.sessionId, // Assuming sessionId is visitor_id
          },
        ])
        .select('id'); // Select the ID of the newly inserted question

      if (insertQuestionError) {
        console.error('Error inserting question into Supabase:', insertQuestionError);
      } else if (insertedQuestion && insertedQuestion.length > 0) {
        const questionId = insertedQuestion[0].id;

        // Generate embedding for the question
        const embeddingResult = await embeddingModel.embedContent({
          content: { parts: [{ text: query }] },
          taskType: "RETRIEVAL_QUERY",
        });

        // Insert embedding into question_embeddings table
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

    // Upsert chatbot response to Pinecone
    await chatHistoryService.upsertMessage({
      text: responseText,
      role: 'assistant',
      client_id: clientConfig.clientId,
      visitor_id: sessionId,
      session_id: sessionId,
      timestamp: new Date().toISOString(), // Use a new timestamp for the response
      turn_id: `${turnId}-assistant`,
    }, clientConfig);

    res.json({ response: responseText });
  } catch (error) {
    console.error('Error processing chat request:', error);
    const errorMessage = error.status === 503
      ? 'The AI model is temporarily overloaded. Please try again in a few moments.'
      : 'Failed to process chat request.';
    res.status(error.status || 500).json({ error: errorMessage });
  }
});

// API endpoint to generate suggested questions
app.post('/api/suggested-questions', clientConfigMiddleware, async (req, res) => {
  try {
    const { context, chatHistory } = req.body;
    const { clientConfig, userContext } = req; // Config and userContext are attached by middleware

    console.log(`[${clientConfig.clientName || clientConfig.clientId}] Generating suggested questions.`);

    const questions = await generateSuggestedQuestions(clientConfig, context, chatHistory, userContext);
    res.json({ questions });
  } catch (error) {
    console.error('Error generating suggested questions:', error);
    res.status(500).json({ error: 'Failed to generate suggested questions.' });
  }
});

// API endpoint to retrieve pre-clustered common questions
app.get('/api/common-questions', clientConfigMiddleware, async (req, res) => {
  try {
    const { clientConfig } = req;
    const listingId = req.query.listingId || null; // listingId is optional

    let query = supabase
      .from('clustered_questions')
      .select('question_text, count')
      .eq('client_id', clientConfig.clientId);

    if (listingId) {
      query = query.eq('listing_id', listingId);
    } else {
      query = query.is('listing_id', null); // For general common questions
    }

    query = query.order('count', { ascending: false }).limit(5); // Get top 5 common questions

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching clustered questions:', error);
      return res.status(500).json({ error: 'Failed to fetch common questions.' });
    }

    res.json({ commonQuestions: data || [] });
  } catch (error) {
    console.error('Error in /api/common-questions endpoint:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

// API endpoint to handle file ingestion
app.post('/api/ingest/file', clientConfigMiddleware, upload.single('file'), async (req, res) => {
  try {
    const { clientConfig, file, body } = req;
    const { ingestionType, listingId, listingUrl } = body;

    if (!file) {
      return res.status(400).json({ error: 'File is required' });
    }

    if (!ingestionType || !['listing', 'general'].includes(ingestionType)) {
      return res
        .status(400)
        .json({ error: 'ingestionType (listing or general) is required' });
    }

    const metadata = {};
    if (ingestionType === 'listing') {
      if (!listingId || !listingUrl) {
        return res
          .status(400)
          .json({ error: 'listingId and listingUrl are required for this ingestion type' });
      }
      metadata.listing_id = listingId;
      metadata.listing_url = listingUrl;
    } else {
      // For "general" type, listing_id is not set, as it's not applicable
      // and Pinecone does not allow null values for metadata fields.
    }

    // Hand off to the service for async processing
    // We don't wait for the processing to finish to send a response
    processDocument({
      clientConfig,
      file,
      ingestionType,
      metadata,
    });

    res.status(202).json({
      message: 'File received and is being processed.',
      filename: file.originalname,
    });
  } catch (error) {
    console.error('Error processing ingest request:', error);
    res.status(500).json({ error: 'Failed to process ingest request.' });
  }
});

// API endpoint to create a new visitor session
app.post('/v1/sessions', async (req, res) => {
  try {
    const { clientId, listingId } = req.body; // Add listingId
    if (!clientId) {
      return res.status(400).json({ error: 'Client ID is required' });
    }
    const newVisitor = await visitorService.createVisitor(clientId, listingId); // Pass listingId
    res.status(201).json({ visitor_id: newVisitor.visitor_id });
  } catch (error) {
    console.error('Error creating visitor session:', error);
    res.status(500).json({ error: 'Failed to create visitor session.' });
  }
});

// API endpoint to log a visitor event
app.post('/v1/events', async (req, res) => {
  try {
    const { visitorId, eventType, listingId } = req.body; // Add listingId
    const clientId = req.body.clientId || req.headers['x-client-id'];

    if (!visitorId || !eventType || !clientId) {
      return res.status(400).json({ error: 'Visitor ID, event type, and client ID are required' });
    }

    // Load client configuration manually
    let clientConfig;
    try {
      clientConfig = await getClientConfig(clientId);
    } catch (error) {
      console.error(`Failed to load configuration for client: ${clientId} (Name: ${clientConfig?.clientName || 'N/A'})`, error);
      return res.status(404).json({ error: `Configuration not found for client: ${clientId}` });
    }

    const updatedVisitor = await visitorService.logEvent(visitorId, eventType, clientId, listingId); // Pass listingId
    if (!updatedVisitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }
    res.json({ success: true, new_lead_score: updatedVisitor.lead_score });
  } catch (error) {
    console.error('Error logging visitor event:', error);
    res.status(500).json({ error: 'Failed to log visitor event.' });
  }
});
 
// API endpoint to get a visitor by ID
app.post('/v1/visitor', async (req, res) => {
  try {
    const { visitorId } = req.body;
    if (!visitorId) {
      return res.status(400).json({ error: 'Visitor ID is required' });
    }
    const visitor = await visitorService.getVisitor(visitorId);
    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }
    res.json(visitor);
  } catch (error) {
    console.error('Error getting visitor:', error);
    res.status(500).json({ error: 'Failed to get visitor.' });
  }
});

// API endpoint to acknowledge leads
app.post('/v1/leads/acknowledge', async (req, res) => {
  try {
    const { visitorIds } = req.body;
    if (!visitorIds || !Array.isArray(visitorIds) || visitorIds.length === 0) {
      return res.status(400).json({ error: 'An array of visitor IDs is required' });
    }

    await visitorService.acknowledgeLeads(visitorIds);
    res.json({ success: true, message: 'Leads acknowledged successfully' });
  } catch (error) {
    console.error('Error acknowledging leads:', error);
    res.status(500).json({ error: 'Failed to acknowledge leads.' });
  }
});

// API endpoints for Developments
app.post('/v1/developments', clientConfigMiddleware, async (req, res) => {
  try {
    const { clientConfig } = req;
    const developmentData = { ...req.body, client_id: clientConfig.clientId };
    const newDevelopment = await developmentService.createDevelopment(developmentData);
    res.status(201).json(newDevelopment);
  } catch (error) {
    console.error('Error creating development:', error);
    res.status(500).json({ error: 'Failed to create development.' });
  }
});

app.get('/v1/developments/:id', clientConfigMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const development = await developmentService.getDevelopmentById(id);
    if (!development || development.client_id !== req.clientConfig.clientId) {
      return res.status(404).json({ error: 'Development not found or unauthorized.' });
    }
    res.json(development);
  } catch (error) {
    console.error('Error fetching development:', error);
    res.status(500).json({ error: 'Failed to fetch development.' });
  }
});

app.get('/v1/developments', clientConfigMiddleware, async (req, res) => {
  try {
    const { clientConfig } = req;
    const developments = await developmentService.getDevelopmentsByClientId(clientConfig.clientId);
    res.json(developments);
  } catch (error) {
    console.error('Error fetching developments by client ID:', error);
    res.status(500).json({ error: 'Failed to fetch developments.' });
  }
});

app.put('/v1/developments/:id', clientConfigMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { clientConfig } = req;
    const existingDevelopment = await developmentService.getDevelopmentById(id);

    if (!existingDevelopment || existingDevelopment.client_id !== clientConfig.clientId) {
      return res.status(404).json({ error: 'Development not found or unauthorized.' });
    }

    const updatedDevelopment = await developmentService.updateDevelopment(id, req.body);
    res.json(updatedDevelopment);
  } catch (error) {
    console.error('Error updating development:', error);
    res.status(500).json({ error: 'Failed to update development.' });
  }
});

app.delete('/v1/developments/:id', clientConfigMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { clientConfig } = req;
    const existingDevelopment = await developmentService.getDevelopmentById(id);

    if (!existingDevelopment || existingDevelopment.client_id !== clientConfig.clientId) {
      return res.status(404).json({ error: 'Development not found or unauthorized.' });
    }

    await developmentService.deleteDevelopment(id);
    res.json({ success: true, message: 'Development deleted successfully.' });
  } catch (error) {
    console.error('Error deleting development:', error);
    res.status(500).json({ error: 'Failed to delete development.' });
  }
});

// API endpoints for Client Management
app.post('/v1/clients', async (req, res) => {
  try {
    const newClient = await createClientConfig(req.body);
    res.status(201).json(newClient);
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({ error: 'Failed to create client.' });
  }
});

app.get('/v1/clients', async (req, res) => {
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
    console.error('Error in /v1/clients endpoint:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
});

app.get('/v1/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const client = await getClientConfig(id);
    res.json(client);
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({ error: 'Failed to fetch client.' });
  }
});

app.put('/v1/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedClient = await updateClientConfig(id, req.body);
    res.json(updatedClient);
  } catch (error) {
    console.error('Error updating client:', error);
    res.status(500).json({ error: 'Failed to update client.' });
  }
});

app.delete('/v1/clients/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await deleteClientConfig(id);
    res.json({ success: true, message: 'Client deleted successfully.' });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({ error: 'Failed to delete client.' });
  }
});

// API endpoints for User Management
app.post('/v1/users', clientConfigMiddleware, async (req, res) => {
  try {
    const { clientConfig } = req;
    const userData = { ...req.body, client_id: clientConfig.clientId };
    const newUser = await userService.createUser(userData);
    res.status(201).json(newUser);
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

app.get('/v1/users/:id', clientConfigMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const user = await userService.getUserById(id);
    if (!user || user.client_id !== req.clientConfig.clientId) {
      return res.status(404).json({ error: 'User not found or unauthorized.' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ error: 'Failed to fetch user.' });
  }
});

app.put('/v1/users/:id', clientConfigMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { clientConfig } = req;
    const existingUser = await userService.getUserById(id);

    if (!existingUser || existingUser.client_id !== clientConfig.clientId) {
      return res.status(404).json({ error: 'User not found or unauthorized.' });
    }

    const updatedUser = await userService.updateUser(id, req.body);
    res.json(updatedUser);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

app.delete('/v1/users/:id', clientConfigMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { clientConfig } = req;
    const existingUser = await userService.getUserById(id);

    if (!existingUser || existingUser.client_id !== clientConfig.clientId) {
      return res.status(404).json({ error: 'User not found or unauthorized.' });
    }

    await userService.deleteUser(id);
    res.json({ success: true, message: 'User deleted successfully.' });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

app.get('/v1/clients/:clientId/users', clientConfigMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    if (clientId !== req.clientConfig.clientId) {
      return res.status(403).json({ error: 'Unauthorized access to client users.' });
    }
    const users = await userService.getAllUsersByClientId(clientId);
    res.json(users);
  } catch (error) {
    console.error('Error fetching users by client ID:', error);
    res.status(500).json({ error: 'Failed to fetch users.' });
  }
});

app.get('/v1/clients/:clientId/agents', clientConfigMiddleware, async (req, res) => {
  try {
    const { clientId } = req.params;
    if (clientId !== req.clientConfig.clientId) {
      return res.status(403).json({ error: 'Unauthorized access to client agents.' });
    }
    const agents = await userService.getAgentsByClientId(clientId);
    res.json(agents);
  } catch (error) {
    console.error('Error fetching agents by client ID:', error);
    res.status(500).json({ error: 'Failed to fetch agents.' });
  }
});

app.post('/v1/users/:userId/listings/:listingId', clientConfigMiddleware, async (req, res) => {
  try {
    const { userId, listingId } = req.params;
    const { clientConfig } = req;

    // Ensure the user belongs to the client
    const user = await userService.getUserById(userId);
    if (!user || user.client_id !== clientConfig.clientId) {
      return res.status(404).json({ error: 'User not found or unauthorized for this client.' });
    }

    // Ensure the user is a promoter
    if (user.role !== 'promoter') {
      return res.status(403).json({ error: 'Only promoters can be assigned listings.' });
    }

    await userService.assignListingToAgent(userId, listingId);
    res.json({ success: true, message: 'Listing assigned to agent successfully.' });
  } catch (error) {
    console.error('Error assigning listing to agent:', error);
    res.status(500).json({ error: 'Failed to assign listing to agent.' });
  }
});

app.delete('/v1/users/:userId/listings/:listingId', clientConfigMiddleware, async (req, res) => {
  try {
    const { userId, listingId } = req.params;
    const { clientConfig } = req;

    // Ensure the user belongs to the client
    const user = await userService.getUserById(userId);
    if (!user || user.client_id !== clientConfig.clientId) {
      return res.status(404).json({ error: 'User not found or unauthorized for this client.' });
    }

    await userService.removeListingFromAgent(userId, listingId);
    res.json({ success: true, message: 'Listing removed from agent successfully.' });
  } catch (error) {
    console.error('Error removing listing from agent:', error);
    res.status(500).json({ error: 'Failed to remove listing from agent.' });
  }
});

app.get('/v1/users/:userId/listings', clientConfigMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { clientConfig } = req;

    // Ensure the user belongs to the client
    const user = await userService.getUserById(userId);
    if (!user || user.client_id !== clientConfig.clientId) {
      return res.status(404).json({ error: 'User not found or unauthorized for this client.' });
    }

    const listings = await userService.getListingsByAgentId(userId);
    res.json(listings);
  } catch (error) {
    console.error('Error fetching listings for agent:', error);
    res.status(500).json({ error: 'Failed to fetch listings for agent.' });
  }
});

// API endpoint to get listing details and metrics by ID
app.get('/api/listing/:id', async (req, res) => {
  console.log(`[Backend] Received request for listing ID: ${req.params.id}`);
  try {
    const { id } = req.params;
    console.log(`[Backend] Fetching listing details for ID: ${id}`);

    // Fetch listing details, metrics, unanswered questions, and handoffs concurrently
    const [
      { data: listing, error: listingError },
      { data: metrics, error: metricsError },
      { data: unansweredQuestions, error: unansweredQuestionsError },
      { data: handoffs, error: handoffsError },
      { data: fullChatHistory, error: fullChatHistoryError }, // New line for full chat history
    ] = await Promise.all([
      supabase.from('listings').select('*').eq('id', id).single(),
      supabase.from('listing_metrics').select('*').eq('listing_id', id).single(),
      supabase.from('questions').select('question_text').eq('listing_id', id).eq('status', 'unanswered'),
      supabase.from('handoffs').select('reason').eq('listing_id', id),
      supabase.from('questions').select('question_text, chatbot_response, asked_at').eq('listing_id', id).order('asked_at', { ascending: true }),
    ]);

    if (listingError && listingError.code !== 'PGRST116') {
      console.error(`[Backend] Error fetching listing:`, listingError);
      throw listingError;
    }
    console.log(`[Backend] Listing data:`, listing);

    if (metricsError && metricsError.code !== 'PGRST116') {
      console.error(`[Backend] Error fetching metrics:`, metricsError);
      throw metricsError;
    }
    console.log(`[Backend] Metrics data:`, metrics);

    if (unansweredQuestionsError) {
      console.error(`[Backend] Error fetching unanswered questions:`, unansweredQuestionsError);
      throw unansweredQuestionsError;
    }
    console.log(`[Backend] Unanswered questions:`, unansweredQuestions);

    if (fullChatHistoryError) {
      console.error(`[Backend] Error fetching full chat history:`, fullChatHistoryError);
      throw fullChatHistoryError;
    }
    console.log(`[Backend] Full chat history:`, fullChatHistory);

    if (handoffsError) {
      console.error(`[Backend] Error fetching handoffs:`, handoffsError);
      throw handoffsError;
    }
    console.log(`[Backend] Handoffs:`, handoffs);


    // Aggregate handoffs by reason
    const aggregatedHandoffs = handoffs.reduce((acc, curr) => {
      acc[curr.reason] = (acc[curr.reason] || 0) + 1;
      return acc;
    }, {});

    const formattedHandoffs = Object.entries(aggregatedHandoffs).map(([reason, count]) => ({
      reason,
      count,
    }));

    res.json({
      listing: listing || null,
      metrics: metrics || null,
      commonQuestions: [], // Common questions are now fetched via a separate API
      unansweredQuestions: unansweredQuestions.map(q => q.question_text) || [],
      chatHandoffs: formattedHandoffs || [],
      fullChatHistory: fullChatHistory || [], // New line for full chat history
    });
  } catch (error) {
    console.error(`Error fetching listing details for ID ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to fetch listing details.' });
  }
});

 app.listen(port, () => {
   console.log(`Server listening at http://localhost:${port}`);

   // Schedule the clustering job to run every hour
   // In a production environment, consider a more robust scheduling solution
   // or a less frequent interval (e.g., daily, weekly)
   cron.schedule('0 * * * *', async () => {
     console.log('Running scheduled question clustering job...');
     try {
       await clusterQuestions();
       console.log('Scheduled question clustering job completed successfully.');
     } catch (error) {
       console.error('Error running scheduled question clustering job:', error);
     }
   });
 });