require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { generateResponse, generateSuggestedQuestions } = require('./rag-service');
const { getClientConfig } = require('./services/client-config-service');
const { processDocument } = require('./services/ingestion-service');
const visitorService = require('./services/visitor-service');
const multer = require('multer');

// Configure multer for in-memory file storage
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const port = process.env.PORT || 3006;

app.use(cors());
app.use(express.json());

// Middleware to load client configuration an attach it to the request
const clientConfigMiddleware = async (req, res, next) => {
 const clientId = req.body.clientId || req.headers['x-client-id'];

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

// Load client configuration for all API routes
app.use('/api', clientConfigMiddleware);

app.get('/', (req, res) => {
  res.send('Backend server is running!');
});

// API endpoint to handle chat requests
app.post('/api/chat', async (req, res) => {
  try {
    const { query, sessionId, context } = req.body;
    const { clientConfig } = req; // Config is attached by middleware

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    console.log(`[${clientConfig.clientId}] Received query: ${query}`);
    console.log(`[${clientConfig.clientId}] Received context: ${JSON.stringify(context)}`);

    const responseText = await generateResponse(query, clientConfig, context);
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
app.post('/api/suggested-questions', async (req, res) => {
  try {
    const { context, chatHistory } = req.body;
    const { clientConfig } = req; // Config is attached by middleware

    console.log(`[${clientConfig.clientId}] Generating suggested questions.`);

    const questions = await generateSuggestedQuestions(clientConfig, context, chatHistory);
    res.json({ questions });
  } catch (error) {
    console.error('Error generating suggested questions:', error);
    res.status(500).json({ error: 'Failed to generate suggested questions.' });
  }
});

// API endpoint to handle file ingestion
app.post('/api/ingest/file', upload.single('file'), async (req, res) => {
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
      console.error(`Failed to load configuration for client: ${clientId}`, error);
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
app.post('/v1/visitor', (req, res) => {
  try {
    const { visitorId } = req.body;
    if (!visitorId) {
      return res.status(400).json({ error: 'Visitor ID is required' });
    }
    const visitor = visitorService.getVisitor(visitorId);
    if (!visitor) {
      return res.status(404).json({ error: 'Visitor not found' });
    }
    res.json(visitor);
  } catch (error) {
    console.error('Error getting visitor:', error);
    res.status(500).json({ error: 'Failed to get visitor.' });
  }
});

 app.listen(port, () => {
   console.log(`Server listening at http://localhost:${port}`);
 });