// packages/backend/src/index.js
// Main entry point for the Node.js backend server, setting up Express app with routes for chat, document ingestion, visitor management, and API endpoints.
// To serve as the central API gateway for the RAG chatbot system, handling requests, middleware, and routing to appropriate services.
// Relevant files: rag-service.js, client-config-service.js, listing-service.js, visitor-service.js, user-service.js, unanswered_question_service.js, communication_service.js
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });
console.log('[DEBUG] Dotenv config loaded. Checking environment variables...');
console.log(`[DEBUG] OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Loaded' : 'Not Loaded'}`);
console.log(`[DEBUG] PINECONE_API_KEY: ${process.env.PINECONE_API_KEY ? 'Loaded' : 'Not Loaded'}`);
console.log(`[DEBUG] SUPABASE_URL: ${process.env.SUPABASE_URL ? 'Loaded' : 'Not Loaded'}`);
console.log(`[DEBUG] SUPABASE_ANON_KEY: ${process.env.SUPABASE_ANON_KEY ? 'Loaded' : 'Not Loaded'}`);

import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import multer from 'multer';

import { generateResponse, generateSuggestedQuestions, embeddingModel } from './rag-service.js';
import * as clientConfigServiceModule from './services/client-config-service.js';
// Simple PDF/Text ingestion service
import { processDocument } from './services/ingestion-service-pdf.js';
import listingService from './services/listing-service.js';
import visitorService from './services/visitor-service.js';
import supabaseModule from './config/supabase.js';
import ChatHistoryService from './services/chat-history-service.js';
import * as developmentService from './services/development-service.js';
import userService from './services/user-service.js';
import unansweredQuestionService from './services/unanswered_question_service.js';
import communicationService from './services/communication_service.js';
import { extractListingIdFromUrl as parseListingFromUrl, extractListingIdFromQuery as parseListingFromQuery } from './utils/rag-parsing.js';
import scoreDecayScheduler from './schedulers/score-decay-scheduler.js';

/**
 * Extract contact information from user message
 * @param {string} message - User message
 * @returns {Object} - Extracted contact info {email, phone}
 */
function extractContactInfo(message) {
  const contactInfo = { email: null, phone: null };

  // Email regex
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
  const emailMatch = message.match(emailRegex);
  if (emailMatch) {
    contactInfo.email = emailMatch[0];
  }

  // Phone regex (Portuguese format)
  const phoneRegex = /(\+351\s?)?[9|2|3]\d{1,2}(\s|\.)?\d{3}(\s|\.)?\d{3}/g;
  const phoneMatch = message.match(phoneRegex);
  if (phoneMatch) {
    contactInfo.phone = phoneMatch[0].replace(/[\s\.]/g, ''); // Clean up formatting
  }

  return contactInfo;
}
console.log('[DEBUG] All imports in index.js completed.');
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Configure multer for in-memory file storage
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const port = process.env.PORT || 3007; // Changed default port to 3007 to match frontend
console.log(`[DEBUG] process.env.PORT is: ${process.env.PORT}`);

// Middleware to load client configuration and attach it to the request, along with a placeholder user context
const clientConfigMiddleware = (clientConfigService) => async (req, res, next) => {
  const clientId = req.body.clientId || req.headers['x-client-id'] || req.query.clientId || req.params.id || req.params.clientId;

  // Placeholder for user authentication. In a real scenario, this would come from an auth system.
  // For now, we'll assume a default admin user for testing purposes if no user ID is provided.
  const userId = req.headers['x-user-id'] || 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'; // Example UUID for a placeholder user
  const userRole = req.headers['x-user-role'] || 'admin'; // Example role: 'admin' or 'promoter'

  if (!clientId) {
    return res.status(400).json({ error: 'Client ID is required.' });
  }

  try {
    req.clientConfig = await clientConfigService.getClientConfig(clientId);
    // Attach user context to the request
    req.userContext = { userId, role: userRole };
    next();
  } catch (error) {
    console.error(`Failed to load configuration for client: ${clientId} (Name: ${req.clientConfig?.clientName || 'N/A'})`, error);
    return res.status(404).json({ error: `Configuration not found for client: ${clientId}` });
  }
};

// Function to create and configure the Express app
const createApp = (dependencies = {}, applyClientConfigMiddleware = true, testMiddleware = null) => {
  const {
    clientConfigService = clientConfigServiceModule,
    supabase = supabaseModule,
    ingestionService = { processDocument },
  } = dependencies;

  const app = express();
  
  // Updated CORS configuration for third-party websites
  app.use(cors({
    origin: true, // Allow requests from any origin (necessary for embedded widgets)
    credentials: true, // Allow cookies and auth headers
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Client-Id', 'X-User-Id', 'X-User-Role']
  }));
  
  app.use(express.json());
  // Global request logger for debugging
  app.use((req, res, next) => {
    console.log(`[Global Logger] Request received: ${req.method} ${req.url}`);
    next();
  });

  // Apply test middleware if provided (must be before clientConfigMiddleware)
  if (testMiddleware) {
    app.use(testMiddleware);
  }

  // API endpoints for Client Management (moved before clientConfigMiddleware)
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

  // Also handle the /api/v1/clients path for frontend compatibility
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

  // API endpoint to get widget configuration (moved before middleware)
  app.get('/api/v1/widget/config/:clientId', async (req, res) => {
    try {
      const { clientId } = req.params;
      const clientConfig = await clientConfigService.getClientConfig(clientId);
      res.json(clientConfig);
    } catch (error) {
      console.error(`Error fetching widget config for client ${req.params.clientId}:`, error);
      res.status(404).json({ error: 'Configuration not found.' });
    }
  });

   



  app.get('/', (req, res) => {
    res.send('Backend server is running!');
  });

  // API endpoint to handle chat requests
  app.post('/api/chat', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
            const { query, visitor_id, sessionId, context, pageUrl } = req.body; // Changed visitorId to visitor_id
            const { clientConfig, userContext } = req; // Config and userContext are attached by middleware
            const timestamp = new Date().toISOString();
            const turnId = Date.now().toString(); // Simple unique ID for this turn
            const chatHistoryService = new ChatHistoryService();

            // Retrieve recent chat history for this visitor (across all sessions)
            let recentMessages = [];
            let chatHistory = null;
            let contextShifted = false; // Declare here so it is in scope for generateResponse

            try {
              if (visitor_id) {
                recentMessages = await chatHistoryService.getVisitorChatHistory(visitor_id, clientConfig.clientId, 10);
                console.log(`[${clientConfig.clientName || clientConfig.clientId}] Retrieved ${recentMessages.length} recent messages for visitor ${visitor_id}`);
              } else {
                console.warn('No visitorId provided, skipping chat history retrieval');
              }
            } catch (error) {
              console.error('Error retrieving chat history:', error);
            }
      
      // Helper: derive effective listing_id and development_id to persist with messages
      // Includes deictic resolution from prior assistant response
      const isDeictic = /\b(este|esta|isto|isso|aquilo|aquele|aquela|this one|that one)\b/i.test(String(query || ''));
      const resolveDeicticListingId = async (recentMessages) => {
        if (!isDeictic || !recentMessages || recentMessages.length === 0) return null;
        const lastAssistant = recentMessages.find(m => m.sender_role === 'assistant'); // Use sender_role from chat_messages table
        if (!lastAssistant?.message_text) return null; // Use message_text
        // Try to recover a numeric ID from any URL mentioned previously
        const urlIdMatch = lastAssistant.message_text.match(/\/(\d{3,})(?!.*\d)/);
        if (urlIdMatch) {
          const candidateId = urlIdMatch[1];
          const { data: row, error: err } = await supabase
            .from('listings')
            .select('id, development_id')
            .eq('id', candidateId)
            .eq('client_id', clientConfig.clientId)
            .single();
          if (!err && row) return row.id;
        }
        // Try to recover a numeric ID from explicit "ID: 4271" patterns in prior suggestions
        const idTagMatch = lastAssistant.message_text.match(/\bID\s*[:#-]?\s*(\d{3,})\b/i);
        if (idTagMatch) {
          const candidateId = idTagMatch[1];
          const { data: row2, error: err2 } = await supabase
            .from('listings')
            .select('id, development_id')
            .eq('id', candidateId)
            .eq('client_id', clientConfig.clientId)
            .single();
          if (!err2 && row2) return row2.id;
        }
        // Try to parse a typology + letter + block mention, e.g., "T2 D - Bloco 2"
        const m = lastAssistant.message_text.match(/\bT\s*([1-4])\s*([A-H])\b.*?\bBloco\s*(\d+)/i);
        if (m) {
          const typology = `T${m[1]}`;
          const letter = m[2].toUpperCase();
          const block = m[3];
          try {
            const row = await listingService.findByTypologyLetterBlock(clientConfig.clientId, typology, letter, block);
            if (row?.id) return row.id;
          } catch (_) {}
        }
        return null;
      };
      const deriveContextIds = async (recentMessages) => { // Pass recentMessages here
        // Determine if the frontend explicitly sent a null listingId, meaning "no listing selected"
        const isExplicitlyNoListing = req.body.context === null || req.body.context.listingId === null;

        let effectiveListingId = context?.listingId || null;
        let effectiveDevelopmentId = context?.developmentId || clientConfig.defaultDevelopmentId || null;

        // Detect context shift (moved here from main handler)
        const currentListingId = effectiveListingId; // The listing ID from the current request
        // Find the most recent message that had a listing_id to detect shifts
        const lastMessageWithListing = recentMessages.find(m => m.listing_id);

        if (effectiveListingId && (!lastMessageWithListing || lastMessageWithListing.listing_id !== effectiveListingId)) {
            // This covers shifting TO a new listing from either no listing or a different listing.
            console.log(`[${clientConfig.clientName}] Context shift detected: moving TO listing ${effectiveListingId} from ${lastMessageWithListing?.listing_id || 'no listing'}.`);
            contextShifted = true;
        } else if (!effectiveListingId && lastMessageWithListing) {
            // This covers shifting FROM a listing TO no listing.
            console.log(`[${clientConfig.clientName}] Context shift detected: moving FROM listing ${lastMessageWithListing.listing_id} TO no listing.`);
            contextShifted = true;
            // If context shifted to null, filter out listing/development specific messages from history
            console.log(`[${clientConfig.clientName}] Filtering chat history due to context shift to no listing.`);
            recentMessages = recentMessages.filter(msg => !msg.listing_id && !msg.development_id);
        }


        // Try to extract listing id from pageUrl using shared util
        if (pageUrl) {
          try {
            const candidate = parseListingFromUrl(String(pageUrl));
            if (candidate) {
              console.log(`[${clientConfig.clientName}] URL-derived candidate listing id: ${candidate}`);
              const { data: listingRow, error: listingErr } = await supabase
                .from('listings')
                .select('id, development_id')
                .eq('id', candidate)
                .eq('client_id', clientConfig.clientId)
                .single();
              if (!listingErr && listingRow) {
                // Tentatively set from URL; may be overridden by explicit query reference below
                effectiveListingId = listingRow.id;
                effectiveDevelopmentId = listingRow.development_id || effectiveDevelopmentId; // Ensure development_id is updated
                console.log(`[${clientConfig.clientName}] Context from URL → listing ${effectiveListingId}, development ${effectiveDevelopmentId || 'null'}`);
              }
            }
          } catch (_) {
            // ignore URL parsing errors
          }
        }

        // Try to extract listing id from the user's query using shared util
        if (query) {
          const candidate = parseListingFromQuery(query);
          if (candidate) {
            console.log(`[${clientConfig.clientName}] Query-derived candidate listing id: ${candidate}`);
            const { data: listingRowQ, error: listingErrQ } = await supabase
              .from('listings')
              .select('id, development_id')
              .eq('id', candidate)
              .eq('client_id', clientConfig.clientId)
              .single();
            if (!listingErrQ && listingRowQ) {
              effectiveListingId = listingRowQ.id;
              effectiveDevelopmentId = listingRowQ.development_id || effectiveDevelopmentId; // Ensure development_id is updated
              console.log(`[${clientConfig.clientName}] Resolved query candidate directly to listing ${effectiveListingId}`);
            }
          }
          // If the shared util didn't map to a numeric id, try typology+letter+block resolution (e.g., "T1 B Bloco 1")
          {
            const m = String(query).match(/\bT\s*([1-4])\s*([A-H])\b.*?\bBloco\s*(\d+)/i);
            if (m) {
              const typology = `T${m[1]}`;
              const letter = m[2].toUpperCase();
              const block = m[3];
              console.log(`[${clientConfig.clientName}] Attempting TLBlock resolution → typology=${typology}, letter=${letter}, block=${block}`);
              try {
                const row = await listingService.findByTypologyLetterBlock(clientConfig.clientId, typology, letter, block);
                if (row?.id) {
                  effectiveListingId = row.id;
                  effectiveDevelopmentId = row.development_id || effectiveDevelopmentId; // Ensure development_id is updated
                  console.log(`[${clientConfig.clientName}] TLBlock resolved to listing ${effectiveListingId}`);
                }
              } catch (_) {}
            }
            // Also allow explicit "ID 4271" in the query itself
            {
              const idInQuery = String(query).match(/\bID\s*[:#-]?\s*(\d{3,})\b/i);
              if (idInQuery) {
                const numericId = idInQuery[1];
                console.log(`[${clientConfig.clientName}] Explicit ID in query detected: ${numericId}`);
                const { data: row3, error: err3 } = await supabase
                  .from('listings')
                  .select('id, development_id')
                  .eq('id', numericId)
                  .eq('client_id', clientConfig.clientId)
                  .single();
                if (!err3 && row3) {
                  effectiveListingId = row3.id;
                  effectiveDevelopmentId = row3.development_id || effectiveDevelopmentId; // Ensure development_id is updated
                  console.log(`[${clientConfig.clientName}] Explicit ID resolved to listing ${effectiveListingId}`);
                }
              }
            }
          }
        }

        // If still no listing AND it's not explicitly "no listing selected" from frontend,
        // then try deictic resolution based on last assistant turn
        if (!effectiveListingId && !isExplicitlyNoListing) {
          const deicticId = await resolveDeicticListingId(recentMessages); // Pass recentMessages here
          if (deicticId) {
            effectiveListingId = deicticId;
            // When deictic resolution finds a listing, also fetch its development_id
            try {
              const { data: deicticListing, error: deicticErr } = await supabase
                .from('listings')
                .select('development_id')
                .eq('id', deicticId)
                .eq('client_id', clientConfig.clientId)
                .single();
              if (!deicticErr && deicticListing) {
                effectiveDevelopmentId = deicticListing.development_id || effectiveDevelopmentId;
              }
            } catch (e) {
              console.warn(`[${clientConfig.clientName}] Failed to fetch development_id for deictic listing ${deicticId}:`, e.message);
            }
            console.log(`[${clientConfig.clientName}] Deictic resolution resolved to listing ${effectiveListingId}, development ${effectiveDevelopmentId || 'null'}`);
          }
        }

        return { effectiveListingId, effectiveDevelopmentId };
      };

      const { effectiveListingId, effectiveDevelopmentId } = await deriveContextIds(recentMessages); // Pass recentMessages here
      
      // Format chat history AFTER context shift detection and filtering
      chatHistory = chatHistoryService.formatChatHistoryForPrompt(recentMessages);
      console.log(`[${clientConfig.clientName || clientConfig.clientId}] Formatted Chat History:\n---\n${chatHistory}\n---`);

      // Check for contact information in user message and update visitor record
      try {
        const contactInfo = extractContactInfo(query);
        if (contactInfo.email || contactInfo.phone) {
          console.log(`[${clientConfig.clientName}] Detected contact info in user message:`, contactInfo);
          await visitorService.updateVisitorContact(visitor_id, clientConfig.clientId, contactInfo);

          // Log contact submission as an event for lead scoring
          await visitorService.logEvent(visitor_id, 'SUBMITTED_CONTACT', clientConfig.clientId, effectiveListingId);
        }
      } catch (contactError) {
        console.error('Error processing contact information:', contactError);
      }

      // Upsert user message to Pinecone (for RAG context)
      try {
        await chatHistoryService.upsertMessage({
          text: query,
          role: 'user',
          client_id: clientConfig.clientId,
          visitor_id: visitor_id, // Use visitor_id
          session_id: sessionId,
          timestamp: timestamp,
          turn_id: `${turnId}-user`,
        }, clientConfig);
      } catch (error) {
        console.error('Failed to upsert user message to Pinecone, continuing without it.', error);
      }
      
      if (!query) {
        return res.status(400).json({ error: 'Query is required' });
      }

      console.log(`[${clientConfig.clientName || clientConfig.clientId}] Received query: ${query}`);
      console.log(`[${clientConfig.clientName || clientConfig.clientId}] Received context: ${JSON.stringify(context)}`);

      // Generate embedding for the query
      let queryEmbedding;
      try {
        queryEmbedding = await openai.embeddings.create({
          model: embeddingModel,
          input: query,
        });
      } catch (error) {
        console.error(`[${clientConfig.clientName || clientConfig.clientId}] Error generating embedding:`, error);
        return res.status(500).json({ 
          error: 'Failed to generate embedding for query',
          details: error.message
        });
      }

      // Validate embedding before proceeding
      if (!queryEmbedding || !queryEmbedding.data || !queryEmbedding.data[0] || !queryEmbedding.data[0].embedding) {
        console.error(`[${clientConfig.clientName || clientConfig.clientId}] Invalid embedding response:`, queryEmbedding);
        return res.status(500).json({ 
          error: 'Failed to generate embedding for query',
          details: 'The embedding service returned an invalid response'
        });
      }

      const embeddingVector = queryEmbedding.data[0].embedding;
      
      // Validate that embedding is an array of numbers
      if (!Array.isArray(embeddingVector) || embeddingVector.length === 0 || typeof embeddingVector[0] !== 'number') {
        console.error(`[${clientConfig.clientName || clientConfig.clientId}] Invalid embedding vector format:`, embeddingVector);
        return res.status(500).json({ 
          error: 'Invalid embedding vector format',
          details: 'The embedding vector is not properly formatted'
        });
      }

      console.log(`[${clientConfig.clientName || clientConfig.clientId}] Generated embedding vector with ${embeddingVector.length} dimensions`);

      // Generate response with enhanced context including chat history
      console.log(`[${clientConfig.clientName}] Final resolved context ids → listing=${effectiveListingId || 'null'}, development=${effectiveDevelopmentId || 'null'}`);

      let externalCtx = null;
      if (effectiveListingId) {
        externalCtx = {
          type: 'listing',
          value: effectiveListingId,
          developmentId: effectiveDevelopmentId, // Pass developmentId for richer context
        };
      } else if (effectiveDevelopmentId) {
        externalCtx = {
          type: 'development',
          value: effectiveDevelopmentId,
        };
      } else {
        externalCtx = context || null;
      }

      console.log(`[${clientConfig.clientName}] External context passed to RAG: ${JSON.stringify(externalCtx)}`);

      const { response: responseText, debug: debugPayload, isUnanswered } = await generateResponse(
        query,
        clientConfig,
        embeddingVector,
        externalCtx,
        userContext,
        chatHistory,
        pageUrl,
        contextShifted, // Pass the contextShifted flag
        visitor_id // Pass visitor_id for unanswered question handling
      );

      // Store user message in chat_messages table (moved here to access isUnanswered)
      try {
        // Fetch visitor name
        const { data: visitorData, error: visitorError } = await supabase
          .from('visitors')
          .select('name')
          .eq('visitor_id', visitor_id)
          .eq('client_id', clientConfig.clientId)
          .single();

        const visitorName = visitorData?.name || null;

        const userMessageData = {
          visitor_id: visitor_id,
          session_id: sessionId,
          client_id: clientConfig.clientId,
          message_text: query,
          name: visitorName,
          sender_role: 'user',
          timestamp: timestamp,
          listing_id: effectiveListingId,
          development_id: effectiveDevelopmentId,
          is_unanswered: isUnanswered || false, // Mark as unanswered if no matches found
        };
        console.log('Attempting to insert user message into chat_messages:', userMessageData);
        const { data: insertedChatMessage, error: chatMessageError } = await supabase
          .from('chat_messages')
          .insert([userMessageData])
          .select('id'); // Select the ID of the inserted message

        if (chatMessageError) {
          console.error('Error inserting user message into chat_messages:', chatMessageError);
        } else if (insertedChatMessage && insertedChatMessage.length > 0) {
          console.log('User message inserted successfully:', insertedChatMessage[0]);
          const chatMessageId = insertedChatMessage[0].id;

          // Generate embedding for the user's question and insert into question_embeddings
          try {
            const embeddingResult = await openai.embeddings.create({
              model: embeddingModel,
              input: query,
            });

            const embeddingData = {
              question_id: chatMessageId, // Link to the chat_messages ID
              embedding: embeddingResult.data[0].embedding,
              client_id: clientConfig.clientId, // Add client_id here
              ...(context?.listingId && { listing_id: context.listingId }),
            };
            console.log('Attempting to insert question embedding:', embeddingData);
            const { error: insertEmbeddingError } = await supabase
              .from('question_embeddings')
              .insert([embeddingData]);

            if (insertEmbeddingError) {
              console.error('Error inserting question embedding into Supabase:', insertEmbeddingError);
            } else {
              console.log('Question embedding inserted successfully.');
            }
          } catch (embeddingError) {
            console.error('Error generating or inserting question embedding:', embeddingError);
          }
        }
      } catch (logError) {
        console.error('Error logging user message to chat_messages:', logError);
      }

      // Store assistant response in chat_messages table
      try {
        // Fetch visitor name (reuse from earlier if possible, but for consistency fetch again)
        const { data: visitorData, error: visitorError } = await supabase
          .from('visitors')
          .select('name')
          .eq('visitor_id', visitor_id)
          .eq('client_id', clientConfig.clientId)
          .single();

        const visitorName = visitorData?.name || null;

        const assistantMessageData = {
          visitor_id: visitor_id,
          session_id: sessionId,
          client_id: clientConfig.clientId,
          message_text: responseText || 'Desculpe, ocorreu um erro ao processar a sua pergunta.', // Still log the string response
          name: visitorName,
          sender_role: 'assistant',
          timestamp: new Date().toISOString(),
          listing_id: effectiveListingId,
          development_id: effectiveDevelopmentId,
        };
        console.log('Attempting to insert assistant message into chat_messages:', assistantMessageData);
        const { error: chatMessageError } = await supabase
          .from('chat_messages')
          .insert([assistantMessageData]);
        if (chatMessageError) {
          console.error('Error inserting assistant message into chat_messages:', chatMessageError);
        } else {
          console.log('Assistant message inserted successfully.');
        }
      } catch (logError) {
        console.error('Error logging assistant message to chat_messages:', logError);
      }

      // Upsert assistant response to Pinecone (for RAG context)
      try {
        await chatHistoryService.upsertMessage({
          text: responseText || 'Desculpe, ocorreu um erro ao processar a sua pergunta.',
          role: 'assistant',
          client_id: clientConfig.clientId,
          visitor_id: visitor_id, // Use visitor_id
          session_id: sessionId,
          timestamp: new Date().toISOString(),
          turn_id: `${turnId}-assistant`,
        }, clientConfig);
      } catch (error) {
        console.error('Failed to upsert assistant message to Pinecone, continuing without it.', error);
      }


      res.json({ response: responseText, debug: debugPayload });
    } catch (error) {
      console.error('Error processing chat request:', error);
      const errorMessage = error.status === 503
        ? 'The AI model is temporarily overloaded. Please try again in a few moments.'
        : 'Failed to process chat request.';
      res.status(error.status || 500).json({ error: errorMessage });
    }
  });

  // API endpoint to generate suggested questions
  app.post('/api/suggested-questions', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { context, chatHistory } = req.body;
      const { clientConfig, userContext } = req; // Config and userContext are attached by middleware

      console.log(`[BACKEND] /api/suggested-questions called for client: ${clientConfig.clientName || clientConfig.clientId}`);
      console.log(`[BACKEND] Context received:`, context);
      console.log(`[BACKEND] Chat history length:`, chatHistory ? chatHistory.length : 0);
      console.log(`[BACKEND] Chat history:`, chatHistory);

      const questions = await generateSuggestedQuestions(clientConfig, context, chatHistory, userContext);
      console.log(`[BACKEND] Generated questions:`, questions);
      res.json({ questions });
    } catch (error) {
      console.error('[BACKEND] Error generating suggested questions:', error);
      res.status(500).json({ error: 'Failed to generate suggested questions.' });
    }
  });

  // API endpoint to retrieve pre-clustered common questions
  app.get('/api/common-questions', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig } = req;
      const listingId = req.query.listingId || null; // listingId is optional

      console.log(`[API] /api/common-questions received: clientId=${clientConfig.clientId}, listingId=${listingId}`);

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
        console.error('Supabase error details:', error.message, error.details, error.hint);
        return res.status(500).json({ error: 'Failed to fetch common questions.' });
      }

      console.log(`[API] Fetched common questions data:`, data);
      res.json({ commonQuestions: data || [] });
    } catch (error) {
      console.error('Error in /api/common-questions endpoint:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });

  // API endpoint to handle document uploads
  app.post('/v1/documents/upload', clientConfigMiddleware(clientConfigService), upload.fields([
    { name: 'files', maxCount: 10 },
    { name: 'document_category' },
    { name: 'listing_id' },
    { name: 'development_id' }
  ]), async (req, res) => {
    try {
      const { clientConfig, body } = req;
      const { document_category, listing_id, development_id } = body;
      const uploadedFiles = req.files.files; // Access files from req.files.files

      if (!uploadedFiles || uploadedFiles.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      if (!document_category || !['client', 'development', 'listing'].includes(document_category)) {
        return res.status(400).json({ error: 'document_category (client, development, or listing) is required' });
      }

      const metadata = {
        client_id: clientConfig.clientId,
        document_category: document_category,
      };

      if (document_category === 'listing') {
        if (!listing_id) {
          return res.status(400).json({ error: 'listing_id is required for listing documents' });
        }
        metadata.listing_id = listing_id;
        if (development_id) { // Add this check
          metadata.development_id = development_id; // Add development_id to metadata
        }
      }
      // Always include development_id if provided, regardless of document_category
      else if (document_category === 'development') {
        console.log(`[DEBUG] document_category: ${document_category}, development_id: ${development_id}`);
        if (!development_id) {
          return res.status(400).json({ error: 'development_id is required for development documents' });
        }
        metadata.development_id = development_id;
      }
      // Always include development_id if provided, regardless of document_category
      else if (development_id) {
        metadata.development_id = development_id;
      }

      // Process each uploaded file
      for (const file of uploadedFiles) {
        // Hand off to the service for async processing
        // We don't wait for the processing to finish to send a response
        ingestionService.processDocument({
          clientConfig: clientConfig,
          file,
          documentCategory: document_category,
          metadata,
        });
      }

      res.status(202).json({
        message: 'Files received and are being processed.',
        filenames: uploadedFiles.map(file => file.originalname),
      });
    } catch (error) {
      console.error('Error processing document upload request:', error);
      res.status(500).json({ error: 'Failed to process document upload request.' });
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
      
      res.status(201).json({ 
        visitor_id: newVisitor.visitor_id
      });
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
        clientConfig = await clientConfigService.getClientConfig(clientId);
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
      console.error('Error logging visitor event:', error.message, error.stack);
      res.status(500).json({ error: 'Failed to log visitor event.', details: error.message });
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

  // API endpoint to get visitor score history for sparklines
  app.get('/v1/visitors/:visitorId/score-history', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { visitorId } = req.params;
      const { clientConfig } = req;
      const { maxPoints } = req.query;

      if (!visitorId) {
        return res.status(400).json({ error: 'Visitor ID is required' });
      }

      // Verify visitor belongs to this client
      const visitor = await visitorService.getVisitor(visitorId);
      if (!visitor || visitor.client_id !== clientConfig.clientId) {
        return res.status(404).json({ error: 'Visitor not found or unauthorized' });
      }

      const scoreHistory = await visitorService.getVisitorScoreHistory(
        visitorId,
        maxPoints ? parseInt(maxPoints) : 15
      );

      res.json({ scoreHistory });
    } catch (error) {
      console.error('Error getting visitor score history:', error);
      res.status(500).json({ error: 'Failed to get visitor score history.' });
    }
  });

  // API endpoint to save onboarding answers for a visitor
  app.post('/v1/visitors/:visitorId/onboarding', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { visitorId } = req.params;
      const { clientConfig } = req;
      const { typology, budget_bucket, buying_timeframe, name, email, consent_marketing } = req.body || {};

      if (!visitorId) {
        return res.status(400).json({ error: 'Visitor ID is required' });
      }

      const onboardingPayload = {
        typology: typology || null,
        budget_bucket: budget_bucket || null,
        buying_timeframe: buying_timeframe || null,
        name: name || null,
        email: email || null,
        consent_marketing: Boolean(consent_marketing),
      };

      const updated = await visitorService.saveOnboarding(visitorId, clientConfig.clientId, onboardingPayload);

      // Automatically recommend listings based on onboarding preferences
      let recommendations = [];
      try {
        recommendations = await listingService.findListingsByOnboarding(clientConfig.clientId, onboardingPayload, 4);
      } catch (e) {
        console.warn('Failed to fetch onboarding-based recommendations:', e?.message);
      }

      // Compose assistant message with recommendations
      const now = new Date().toISOString();
      let assistantText;
      if (recommendations && recommendations.length > 0) {
        const lines = recommendations.map(r => {
          const priceStr = (r.price != null) ? `€${Number(r.price).toLocaleString('pt-PT')}` : '';
          const display = r.name || `${r.type || ''} ${r.id}`.trim();
          const urlPt = `https://upinvestments.pt/pt/imoveis/aveiro/${r.id}`;
          return `- ${display} — ${priceStr} (ID: ${r.id})\n  Link: ${urlPt}`;
        }).join('\n');
        assistantText = `Com base nas suas preferências, aqui estão algumas opções:\n\n${lines}\n\nQuer falar sobre algum destes?`;
      } else {
        assistantText = 'Obrigado pelas suas respostas! De momento não encontrei opções que correspondam exatamente às suas preferências. Quer ajustar o orçamento ou a tipologia para eu procurar alternativas?';
      }

      // Persist assistant message to Pinecone and Supabase for immediate visibility in chat
      try {
        const chatHistoryService = new ChatHistoryService();
        const sessionId = `onboarding_${visitorId}`;
        const turnId = `${Date.now()}-assistant`;
        await chatHistoryService.upsertMessage({
          text: assistantText,
          role: 'assistant',
          client_id: clientConfig.clientId,
          visitor_id: visitorId,
          session_id: sessionId,
          timestamp: now,
          turn_id: turnId,
        }, clientConfig);
      } catch (e) {
        console.warn('Failed to upsert onboarding recommendation to Pinecone:', e?.message);
      }

      try {
        // Fetch visitor name
        const { data: visitorData, error: visitorError } = await supabase
          .from('visitors')
          .select('name')
          .eq('visitor_id', visitorId)
          .eq('client_id', clientConfig.clientId)
          .single();

        const visitorName = visitorData?.name || null;

        await supabase
          .from('chat_messages')
          .insert([
            {
              visitor_id: visitorId,
              session_id: `onboarding_${visitorId}`,
              client_id: clientConfig.clientId,
              message_text: assistantText,
              name: visitorName,
              sender_role: 'assistant',
              timestamp: now,
              listing_id: null,
              development_id: clientConfig.defaultDevelopmentId || null,
            },
          ]);
      } catch (e) {
        console.warn('Failed to insert onboarding recommendation into chat_messages:', e?.message);
      }

      res.json({ success: true, visitor: updated, recommendations, assistantMessage: assistantText });
    } catch (error) {
      console.error('Error saving onboarding for visitor:', error);
      res.status(500).json({ error: 'Failed to save onboarding.' });
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
  app.post('/v1/developments', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig } = req;
      const { name, location, amenities } = req.body;

      if (!name || !location || !amenities) {
        return res.status(400).json({ error: 'Name, location, and amenities are required for development creation.' });
      }

      const developmentData = { name, location, amenities, client_id: clientConfig.clientId };
      const newDevelopment = await developmentService.createDevelopment(developmentData);
      console.log('[DEBUG] POST /v1/developments response:', newDevelopment);
      res.status(201).json(newDevelopment);
    } catch (error) {
      console.error('Error creating development:', error);
      res.status(500).json({ error: 'Failed to create development.' });
    }
  });

  app.get('/v1/developments/:id', clientConfigMiddleware(clientConfigService), async (req, res) => {
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

  app.get('/v1/developments', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig } = req;
      const developments = await developmentService.getDevelopmentsByClientId(clientConfig.clientId);
      res.json(developments);
    } catch (error) {
      console.error('Error fetching developments by client ID:', error);
      res.status(500).json({ error: 'Failed to fetch developments.' });
    }
  });

  app.get('/v1/clients/:clientId/developments', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientId } = req.params;
      if (clientId !== req.clientConfig.clientId) {
        return res.status(403).json({ error: 'Unauthorized access to client developments.' });
      }
      const developments = await developmentService.getDevelopmentsByClientId(clientId);
      console.log('[DEBUG] GET /v1/clients/:clientId/developments response:', developments);
      res.json(developments);
    } catch (error) {
      console.error('Error fetching developments by client ID:', error);
      res.status(500).json({ error: 'Failed to fetch developments.' });
    }
  });

  app.put('/v1/developments/:id', clientConfigMiddleware(clientConfigService), async (req, res) => {
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

  app.delete('/v1/developments/:id', clientConfigMiddleware(clientConfigService), async (req, res) => {
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

  // API endpoints for Listings
  app.post('/v1/listings', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig } = req;
      const { listing_id, name, num_bedrooms, total_area_sqm, price_eur, listing_status, current_state, development_id } = req.body;

      // Basic validation for required fields when creating a new listing
      if (!listing_id && (!name || !num_bedrooms || !total_area_sqm || !price_eur || !listing_status || !current_state)) {
        return res.status(400).json({ error: 'Missing required fields for new listing.' });
      }

      const listingData = {
        name,
        num_bedrooms,
        total_area_sqm,
        price_eur,
        listing_status,
        current_state,
        client_id: clientConfig.clientId,
        development_id: development_id || null, // Allow development_id to be optional
        ...req.body // Include any other fields passed in the body
      };

      let result;
      if (listing_id) {
        // Update existing listing by its original 'id'
        result = await listingService.updateListing(listing_id, listingData);
      } else {
        // Create new listing, database will generate listing_uuid
        result = await listingService.createListing(listingData);
      }
      console.log('[DEBUG] POST /v1/listings response:', result);
      // For new listings, return the generated listing_uuid along with the old id
      res.status(listing_id ? 200 : 201).json(result);
    } catch (error) {
      console.error('Error processing listing request:', error);
      res.status(500).json({ error: 'Failed to process listing request.' });
    }
  });

  app.get('/v1/clients/:clientId/listings', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientId } = req.params;
      // Ensure the requested clientId matches the authenticated client's ID
      if (clientId !== req.clientConfig.clientId) {
        return res.status(403).json({ error: 'Unauthorized access to client listings.' });
      }
      const listings = await listingService.getListingsByClientId(clientId);
      console.log('[DEBUG] GET /v1/clients/:clientId/listings response:', listings);
      res.json(listings);
    } catch (error) {
      console.error('Error fetching listings by client ID:', error);
      res.status(500).json({ error: 'Failed to fetch listings.' });
    }
  });

  app.get('/v1/listings/:listingUuid', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { listingUuid } = req.params;
      const listing = await listingService.getListingByUuid(listingUuid);
      if (!listing || listing.client_id !== req.clientConfig.clientId) {
        return res.status(404).json({ error: 'Listing not found or unauthorized.' });
      }
      res.json(listing);
    } catch (error) {
      console.error('Error fetching listing by UUID:', error);
      res.status(500).json({ error: 'Failed to fetch listing.' });
    }
  });

  app.put('/v1/listings/:listingUuid', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { listingUuid } = req.params;
      const { clientConfig } = req;
      const existingListing = await listingService.getListingByUuid(listingUuid);

      if (!existingListing || existingListing.client_id !== clientConfig.clientId) {
        return res.status(404).json({ error: 'Listing not found or unauthorized.' });
      }

      const updatedListing = await listingService.updateListingByUuid(listingUuid, req.body);
      res.json(updatedListing);
    } catch (error) {
      console.error('Error updating listing:', error);
      res.status(500).json({ error: 'Failed to update listing.' });
    }
  });

  app.delete('/v1/listings/:listingUuid', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { listingUuid } = req.params;
      const { clientConfig } = req;
      const existingListing = await listingService.getListingByUuid(listingUuid);

      if (!existingListing || existingListing.client_id !== clientConfig.clientId) {
        return res.status(404).json({ error: 'Listing not found or unauthorized.' });
      }

      await listingService.deleteListingByUuid(listingUuid);
      res.json({ success: true, message: 'Listing deleted successfully.' });
    } catch (error) {
      console.error('Error deleting listing:', error);
      res.status(500).json({ error: 'Failed to delete listing.' });
    }
  });

  // API endpoints for Client Management
  app.post('/v1/clients', async (req, res) => {
    try {
      const newClient = await clientConfigService.createClientConfig(req.body);
      res.status(201).json(newClient);
    } catch (error) {
      console.error('Error creating client:', error);
      res.status(500).json({ error: 'Failed to create client.' });
    }
  });

  // Also handle the /api/v1/clients path for frontend compatibility
  app.post('/api/v1/clients', async (req, res) => {
    try {
      const newClient = await clientConfigService.createClientConfig(req.body);
      res.status(201).json(newClient);
    } catch (error) {
      console.error('Error creating client:', error);
      res.status(500).json({ error: 'Failed to create client.' });
    }
  });

  app.get('/v1/clients/:id', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { id } = req.params;
      const client = await clientConfigService.getClientConfig(id);
      res.json(client);
    } catch (error) {
      console.error('Error fetching client:', error);
      res.status(500).json({ error: 'Failed to fetch client.' });
    }
  });

  app.put('/v1/clients/:id', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { id } = req.params;
      const updatedClient = await clientConfigService.updateClientConfig(id, req.body);
      res.json(updatedClient);
    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({ error: 'Failed to update client.' });
    }
  });

  // Also handle the /api/v1/clients/:id path for frontend compatibility
  app.put('/api/v1/clients/:id', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      // Ensure complex fields are stringified if they are provided as objects
      if (updates.prompts && typeof updates.prompts === 'object') {
        updates.prompts = JSON.stringify(updates.prompts);
      }
      if (updates.leadScoringRules && typeof updates.leadScoringRules === 'object') {
        updates.leadScoringRules = JSON.stringify(updates.leadScoringRules);
      }
      if (updates.documentExtraction && typeof updates.documentExtraction === 'object') {
        updates.documentExtraction = JSON.stringify(updates.documentExtraction);
      }
      if (updates.chatHistoryTaggingRules && typeof updates.chatHistoryTaggingRules === 'object') {
        updates.chatHistoryTaggingRules = JSON.stringify(updates.chatHistoryTaggingRules);
      }
      if (updates.widgetSettings && typeof updates.widgetSettings === 'object') {
        updates.widgetSettings = JSON.stringify(updates.widgetSettings);
      }

      const updatedClient = await clientConfigService.updateClientConfig(id, updates);
      res.json(updatedClient);
    } catch (error) {
      console.error('Error updating client:', error);
      res.status(500).json({ error: 'Failed to update client.' });
    }
  });

  app.delete('/v1/clients/:id', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { id } = req.params;
      await clientConfigService.deleteClientConfig(id);
      res.json({ success: true, message: 'Client deleted successfully.' });
    } catch (error) {
      console.error('Error deleting client:', error);
      res.status(500).json({ error: 'Failed to delete client.' });
    }
  });

  // Also handle the /api/v1/clients/:id path for frontend compatibility
  app.delete('/api/v1/clients/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await clientConfigService.deleteClientConfig(id);
      res.json({ success: true, message: 'Client deleted successfully.' });
    } catch (error) {
      console.error('Error deleting client:', error);
      res.status(500).json({ error: 'Failed to delete client.' });
    }
  });

  // API endpoints for User Management
  app.post('/v1/users', clientConfigMiddleware(clientConfigService), async (req, res) => {
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

  app.get('/v1/users/:id', clientConfigMiddleware(clientConfigService), async (req, res) => {
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

  app.put('/v1/users/:id', clientConfigMiddleware(clientConfigService), async (req, res) => {
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

  app.delete('/v1/users/:id', clientConfigMiddleware(clientConfigService), async (req, res) => {
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

  app.get('/v1/clients/:clientId/users', clientConfigMiddleware(clientConfigService), async (req, res) => {
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

  app.get('/v1/clients/:clientId/agents', clientConfigMiddleware(clientConfigService), async (req, res) => {
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

  app.post('/v1/users/:userId/listings/:listingUuid', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { userId, listingUuid } = req.params;
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

      await userService.assignListingToAgent(userId, listingUuid);
      res.json({ success: true, message: 'Listing assigned to agent successfully.' });
    } catch (error) {
      console.error('Error assigning listing to agent:', error);
      res.status(500).json({ error: 'Failed to assign listing to agent.' });
    }
  });

  app.delete('/v1/users/:userId/listings/:listingUuid', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { userId, listingUuid } = req.params;
      const { clientConfig } = req;

      // Ensure the user belongs to the client
      const user = await userService.getUserById(userId);
      if (!user || user.client_id !== clientConfig.clientId) {
        return res.status(404).json({ error: 'User not found or unauthorized for this client.' });
      }

      await userService.removeListingFromAgent(userId, listingUuid);
      res.json({ success: true, message: 'Listing removed from agent successfully.' });
    } catch (error) {
      console.error('Error removing listing from agent:', error);
      res.status(500).json({ error: 'Failed to remove listing from agent.' });
    }
  });

  app.get('/v1/users/:userId/listings', clientConfigMiddleware(clientConfigService), async (req, res) => {
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
  app.get('/api/listing/:id', clientConfigMiddleware(clientConfigService), async (req, res) => {
    console.log(`[Backend] Received request for listing ID: ${req.params.id}`);
    try {
      const { id } = req.params;
      const clientId = req.clientConfig.clientId; // Get clientId from req.clientConfig
      const { session_id } = req.query; // Extract session_id from query parameters
      console.log(`[Backend] Fetching listing details for ID: ${id} and Client ID: ${clientId}`);

      // Fetch listing details, metrics, unanswered questions, and handoffs concurrently
      const [
        { data: listing, error: listingError },
        { data: metrics, error: metricsError },
        { data: unansweredQuestions, error: unansweredQuestionsError },
        { data: handoffs, error: handoffsError },
        { data: fullChatHistory, error: fullChatHistoryError }, // New line for full chat history
      ] = await Promise.all([
        supabase.from('listings').select('*').eq('id', id).eq('client_id', req.clientConfig.clientId).single(),
        supabase.from('listing_metrics').select('*').eq('listing_id', id).single(),
        supabase.from('chat_messages').select('message_text, timestamp, answered_at, answered_by').eq('listing_id', id).eq('client_id', req.clientConfig.clientId).eq('is_unanswered', true).eq('sender_role', 'user'),
        (() => {
          // Get listing_uuid first, then query handoffs
          const listingQuery = supabase.from('listings').select('listing_uuid').eq('id', id).eq('client_id', req.clientConfig.clientId).single();
          return listingQuery.then(({ data: listingData }) => {
            if (listingData?.listing_uuid) {
              return supabase.from('handoffs').select('reason').eq('listing_uuid', listingData.listing_uuid).eq('client_id', req.clientConfig.clientId);
            }
            return { data: [], error: null }; // Return empty array if no listing found
          });
        })(),
        (() => {
          let query = supabase.from('chat_messages').select('message_text, sender_role, timestamp, visitor_id').eq('listing_id', id);
          if (session_id) {
            query = query.eq('session_id', session_id);
          }
          return query.order('timestamp', { ascending: true });
        })(),
      ]);

      if (listingError) {
        if (listingError.code === 'PGRST116') { // No rows found from single() call
          console.warn(`[Backend] Listing with ID ${id} not found for client ID ${clientId}.`);
          return res.status(404).json({ error: 'Listing not found for this client.' });
        }
        console.error(`[Backend] Error fetching listing:`, listingError);
        throw listingError;
      }
      console.log(`[Backend] Listing data for ID ${id} and Client ID ${clientId}:`, listing);
      console.log(`[Backend] Listing error for ID ${id} and Client ID ${clientId}:`, listingError);

      if (metricsError && metricsError.code !== 'PGRST116') {
        console.error(`[Backend] Error fetching metrics:`, metricsError);
        throw metricsError;
      }
      console.log(`[Backend] Metrics data:`, metrics);

      if (unansweredQuestionsError) {
        console.error(`[Backend] Error fetching unanswered questions:`, unansweredQuestionsError);
        throw unansweredQuestionsError;
      }
      console.log(`[Backend] Unanswered questions count:`, unansweredQuestions?.length || 0);

      if (fullChatHistoryError) {
        console.error(`[Backend] Error fetching full chat history:`, fullChatHistoryError);
        throw fullChatHistoryError;
      }
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

      const processedUnansweredQuestions = unansweredQuestions.filter(q => q.message_text).map(q => ({
        message_text: q.message_text,
        timestamp: q.timestamp
      })) || [];

      res.json({
        listing: listing || null,
        metrics: metrics || null,
        commonQuestions: [], // Common questions are now fetched via a separate API
        unansweredQuestions: processedUnansweredQuestions,
        chatHandoffs: formattedHandoffs || [],
        fullChatHistory: fullChatHistory.map(entry => ({
          question: entry.message_text,
          answer: entry.sender_role === 'assistant' ? entry.message_text : null, // Assuming assistant's message is the answer
          timestamp: entry.timestamp,
          visitor_id: entry.visitor_id,
          sender: entry.sender_role, // Include sender role for more context
        })) || [],
      });
    } catch (error) {
      console.error(`Error fetching listing details for ID ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to fetch listing details.' });
    }
  });

  // API endpoint to get individual leads for a listing
  app.get('/api/listing/:id/leads', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { id: listingId } = req.params;
      const { clientId } = req.query; // Get clientId from query parameters

      if (!listingId || !clientId) {
        return res.status(400).json({ error: 'Listing ID and Client ID are required.' });
      }

      const leads = await visitorService.getLeadsByListingId(listingId, clientId);
      res.json({ leads });
    } catch (error) {
      console.error(`Error fetching leads for listing ${req.params.id}:`, error);
      res.status(500).json({ error: 'Failed to fetch leads for listing.' });
    }
  });

  // API endpoint to get chatbot resolution rate
  app.get('/api/metrics/chatbot-resolution-rate', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig } = req;

      // Get total messages and unanswered messages for this client
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('is_unanswered')
        .eq('client_id', clientConfig.clientId)
        .eq('sender_role', 'user'); // Only count user messages

      if (error) {
        console.error('Error fetching messages for resolution rate:', error);
        return res.status(500).json({ error: 'Failed to fetch resolution rate data.' });
      }

      if (!messages || messages.length === 0) {
        return res.json({ rate: 0, total: 0, answered: 0 });
      }

      const total = messages.length;
      const unanswered = messages.filter(msg => msg.is_unanswered).length;
      const answered = total - unanswered;
      const rate = total > 0 ? Math.round((answered / total) * 100) : 0;

      res.json({ rate, total, answered });
    } catch (error) {
      console.error('Error calculating chatbot resolution rate:', error);
      res.status(500).json({ error: 'Failed to calculate resolution rate.' });
    }
  });

  // API endpoint to get average chat duration
  app.get('/api/metrics/average-chat-duration', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig } = req;

      // Get all messages grouped by session_id
      const { data: messages, error } = await supabase
        .from('chat_messages')
        .select('session_id, timestamp')
        .eq('client_id', clientConfig.clientId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching messages for chat duration:', error);
        return res.status(500).json({ error: 'Failed to fetch chat duration data.' });
      }

      if (!messages || messages.length === 0) {
        return res.json({ averageDuration: 0, totalSessions: 0 });
      }

      // Group messages by session_id and calculate duration for each session
      const sessionDurations = {};
      messages.forEach(msg => {
        if (!sessionDurations[msg.session_id]) {
          sessionDurations[msg.session_id] = {
            start: new Date(msg.timestamp),
            end: new Date(msg.timestamp)
          };
        } else {
          const msgTime = new Date(msg.timestamp);
          if (msgTime < sessionDurations[msg.session_id].start) {
            sessionDurations[msg.session_id].start = msgTime;
          }
          if (msgTime > sessionDurations[msg.session_id].end) {
            sessionDurations[msg.session_id].end = msgTime;
          }
        }
      });

      // Calculate average duration in minutes
      const durations = Object.values(sessionDurations).map(session => {
        const durationMs = session.end - session.start;
        return durationMs / (1000 * 60); // Convert to minutes
      });

      const totalSessions = durations.length;
      const averageDuration = totalSessions > 0
        ? Math.round((durations.reduce((sum, dur) => sum + dur, 0) / totalSessions) * 10) / 10
        : 0;

      res.json({ averageDuration, totalSessions });
    } catch (error) {
      console.error('Error calculating average chat duration:', error);
      res.status(500).json({ error: 'Failed to calculate average chat duration.' });
    }
  });

  // API endpoint to get property viewings booked
  app.get('/api/metrics/property-viewings-booked', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig } = req;

      // Get events that indicate property viewings booked
      const { data: events, error } = await supabase
        .from('events')
        .select('event_type')
        .eq('client_id', clientConfig.clientId);

      if (error) {
        console.error('Error fetching events for property viewings:', error);
        return res.status(500).json({ error: 'Failed to fetch property viewings data.' });
      }

      if (!events || events.length === 0) {
        return res.json({ count: 0 });
      }

      // Count events that indicate property viewings booked
      // Look for event types that contain booking/viewing related terms
      const bookingEvents = events.filter(event =>
        event.event_type &&
        (event.event_type.toLowerCase().includes('book') ||
         event.event_type.toLowerCase().includes('view') ||
         event.event_type.toLowerCase().includes('visit') ||
         event.event_type === 'booked_viewing' ||
         event.event_type === 'property_viewing_booked')
      );

      res.json({ count: bookingEvents.length });
    } catch (error) {
      console.error('Error calculating property viewings booked:', error);
      res.status(500).json({ error: 'Failed to calculate property viewings booked.' });
    }
  });

  // API endpoint to get client qualification metrics
  app.get('/api/metrics/client-qualification', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig } = req;

      const { data: metrics, error } = await supabase
        .from('client_qualification_metrics')
        .select('*')
        .eq('client_id', clientConfig.clientId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error fetching client qualification metrics:', error);
        return res.status(500).json({ error: 'Failed to fetch qualification metrics.' });
      }

      if (!metrics) {
        // Return default values if no metrics exist yet
        return res.json({
          avgQualificationTimeHours: 0,
          qualifiedVisitorsCount: 0,
          totalQualificationTimeHours: 0,
          qualificationThreshold: 40
        });
      }

      res.json({
        avgQualificationTimeHours: metrics.avg_qualification_time_hours || 0,
        qualifiedVisitorsCount: metrics.qualified_visitors_count || 0,
        totalQualificationTimeHours: metrics.total_qualification_time_hours || 0,
        qualificationThreshold: metrics.qualification_threshold || 40
      });
    } catch (error) {
      console.error('Error in /api/metrics/client-qualification endpoint:', error);
      res.status(500).json({ error: 'Failed to fetch client qualification metrics.' });
    }
  });

  // API endpoint to get conversion rate by lead score threshold
  app.get('/api/metrics/conversion-rate-by-score-threshold', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig } = req;
      const { conversionMetric } = req.query;

      if (!conversionMetric) {
        return res.status(400).json({ error: 'Conversion metric is required.' });
      }

      // Define score ranges in groups of 10 (0-10, 11-20, 21-30, etc.)
      const scoreRanges = [
        { min: 0, max: 10, label: '0-10' },
        { min: 11, max: 20, label: '11-20' },
        { min: 21, max: 30, label: '21-30' },
        { min: 31, max: 40, label: '31-40' },
        { min: 41, max: 50, label: '41-50' },
        { min: 51, max: 60, label: '51-60' },
        { min: 61, max: 70, label: '61-70' },
        { min: 71, max: 80, label: '71-80' },
        { min: 81, max: 90, label: '81-90' },
        { min: 91, max: 100, label: '91-100' }
      ];

      const results = [];

      for (const range of scoreRanges) {
        // Get total visitors in this score range
        const { data: totalVisitors, error: totalError } = await supabase
          .from('visitors')
          .select('visitor_id')
          .eq('client_id', clientConfig.clientId)
          .gte('lead_score', range.min)
          .lte('lead_score', range.max);

        if (totalError) {
          console.error('Error fetching total visitors:', totalError);
          return res.status(500).json({ error: 'Failed to fetch visitor data.' });
        }

        const totalCount = totalVisitors ? totalVisitors.length : 0;

        // Get visitors who have the specific conversion event
        const { data: convertedVisitors, error: convertedError } = await supabase
          .from('events')
          .select('visitor_id')
          .eq('client_id', clientConfig.clientId)
          .eq('event_type', conversionMetric);

        if (convertedError) {
          console.error('Error fetching converted visitors:', convertedError);
          return res.status(500).json({ error: 'Failed to fetch conversion data.' });
        }

        // Get unique visitor IDs who have the conversion event
        const convertedVisitorIds = new Set(convertedVisitors ? convertedVisitors.map(e => e.visitor_id) : []);

        // Count how many visitors in this score range have converted
        let convertedCount = 0;
        if (totalVisitors) {
          for (const visitor of totalVisitors) {
            if (convertedVisitorIds.has(visitor.visitor_id)) {
              convertedCount++;
            }
          }
        }

        // Calculate conversion rate
        const conversionRate = totalCount > 0 ? Math.round((convertedCount / totalCount) * 100) : 0;

        results.push({
          scoreRange: range.label,
          totalLeads: totalCount,
          convertedLeads: convertedCount,
          conversionRate: conversionRate
        });
      }

      res.json({ data: results });
    } catch (error) {
      console.error('Error calculating conversion rate by score threshold:', error);
      res.status(500).json({ error: 'Failed to calculate conversion rate by score threshold.' });
    }
  });

  // API endpoint to get a summary of unanswered questions per listing
  app.get('/api/unanswered-questions-summary', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig } = req;
      const { data, error } = await supabase
        .rpc('get_unanswered_questions_summary', { p_client_id: clientConfig.clientId });

      if (error) {
        console.error('Error calling get_unanswered_questions_summary function:', error);
        return res.status(500).json({ error: 'Failed to fetch unanswered questions summary.' });
      }

      // The RPC function already returns listing_id and unanswered_count.
      // We still need to fetch listing names.
      const listingIds = data.map(item => item.listing_id);
      const { data: listings, error: listingsError } = await supabase
        .from('listings')
        .select('id, name')
        .in('id', listingIds)
        .eq('client_id', clientConfig.clientId);

      if (listingsError) {
        console.error('Error fetching listing names:', listingsError);
        return res.status(500).json({ error: 'Failed to fetch listing names.' });
      }

      const listingNameMap = new Map(listings.map(listing => [listing.id, listing.name]));

      const summary = data.map(item => ({
        listing_id: item.listing_id,
        listing_name: listingNameMap.get(item.listing_id) || 'Unknown Listing',
        unanswered_count: item.unanswered_count, // Use unanswered_count from RPC result
      }));

      res.json({ summary });
    } catch (error) {
      console.error('Error in /api/unanswered-questions-summary endpoint:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });

  // API endpoint to get new vs returning users data
  app.get('/api/metrics/new-vs-returning-users', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig } = req;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'startDate and endDate are required.' });
      }

      // Query to get session counts per visitor
      const { data: sessionData, error } = await supabase
        .from('chat_messages')
        .select('visitor_id, session_id')
        .eq('client_id', clientConfig.clientId)
        .gte('timestamp', startDate)
        .lte('timestamp', endDate);

      if (error) {
        console.error('Error fetching chat messages for new vs returning users:', error);
        return res.status(500).json({ error: 'Failed to fetch data.' });
      }

      // Group by visitor_id and count distinct session_id
      const visitorSessionCounts = {};
      sessionData.forEach(row => {
        if (!visitorSessionCounts[row.visitor_id]) {
          visitorSessionCounts[row.visitor_id] = new Set();
        }
        visitorSessionCounts[row.visitor_id].add(row.session_id);
      });

      let newUsers = 0;
      let returningUsers = 0;

      Object.values(visitorSessionCounts).forEach(sessionSet => {
        const count = sessionSet.size;
        if (count === 1) {
          newUsers++;
        } else if (count > 1) {
          returningUsers++;
        }
      });

      const totalUsers = newUsers + returningUsers;
      const newPercentage = totalUsers > 0 ? Math.round((newUsers / totalUsers) * 100) : 0;
      const returningPercentage = totalUsers > 0 ? Math.round((returningUsers / totalUsers) * 100) : 0;

      res.json({
        newUsers,
        returningUsers,
        newPercentage,
        returningPercentage,
        totalUsers
      });
    } catch (error) {
      console.error('Error in /api/metrics/new-vs-returning-users endpoint:', error);
      res.status(500).json({ error: 'Internal server error.' });
    }
  });

  // API endpoint to get chat history for a specific visitor
  app.get('/v1/chat-history/:visitorId', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { visitorId } = req.params;
      const { clientConfig } = req;

      if (!visitorId) {
        return res.status(400).json({ error: 'Visitor ID is required.' });
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .select('message_text, sender_role, timestamp')
        .eq('visitor_id', visitorId)
        .eq('client_id', clientConfig.clientId)
        .order('timestamp', { ascending: true });

      if (error) {
        console.error('Error fetching chat history from Supabase:', error);
        return res.status(500).json({ error: 'Failed to fetch chat history.' });
      }

      const formattedHistory = data.map(entry => ({
        sender: entry.sender_role === 'user' ? 'user' : 'chatbot', // Map 'assistant' to 'chatbot' for frontend
        text: entry.message_text,
        timestamp: entry.timestamp,
      }));

      console.log('[DEBUG] Formatted chat history sent to frontend:', formattedHistory);
      res.json(formattedHistory);
    } catch (error) {
      console.error(`Error fetching chat history for visitor ${req.params.visitorId}:`, error);
      res.status(500).json({ error: 'Failed to fetch chat history.' });
    }
  });

  // API endpoints for Unanswered Questions Management
  app.get('/api/unanswered-questions', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig, userContext } = req;
      const { listingId, dateRange, searchQuery, status, page, pageSize } = req.query;

      // Parse date range if provided
      let parsedDateRange = null;
      if (dateRange) {
        try {
          parsedDateRange = JSON.parse(dateRange);
        } catch (e) {
          console.warn('Invalid dateRange format, ignoring:', dateRange);
        }
      }

      const filters = {
        listingId: listingId || null,
        dateRange: parsedDateRange,
        searchQuery: searchQuery || null,
        status: status || null
      };

      const pagination = {
        page: parseInt(page) || 1,
        pageSize: parseInt(pageSize) || 20
      };

      const result = await unansweredQuestionService.getUnansweredQuestions(
        clientConfig.clientId,
        userContext.userId,
        filters,
        pagination
      );

      res.json(result);
    } catch (error) {
      console.error('Error fetching unanswered questions:', error);
      res.status(500).json({ error: 'Failed to fetch unanswered questions.' });
    }
  });

  app.post('/api/unanswered-questions/:id/status', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig, userContext } = req;
      const { id } = req.params;
      const { status, notes } = req.body;

      if (!status || !['resolved', 'kb_update_needed'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be "resolved" or "kb_update_needed".' });
      }

      const updateData = { status, notes };
      const result = await unansweredQuestionService.updateQuestionStatus(
        id,
        clientConfig.clientId,
        userContext.userId,
        updateData
      );

      res.json({ success: true, question: result });
    } catch (error) {
      console.error('Error updating question status:', error);
      if (error.message.includes('Unauthorized')) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to update question status.' });
      }
    }
  });

  app.post('/api/unanswered-questions/:id/reply', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { clientConfig, userContext } = req;
      const { id } = req.params;
      const { channel, message } = req.body;

      if (!channel || !['email', 'sms', 'whatsapp'].includes(channel)) {
        return res.status(400).json({ error: 'Invalid channel. Must be "email", "sms", or "whatsapp".' });
      }

      if (!message || message.trim().length === 0) {
        return res.status(400).json({ error: 'Message is required.' });
      }

      const replyData = { channel, message: message.trim() };
      const result = await unansweredQuestionService.sendReply(
        id,
        clientConfig.clientId,
        userContext.userId,
        replyData
      );

      res.json(result);
    } catch (error) {
      console.error('Error sending reply:', error);
      if (error.message.includes('Unauthorized') || error.message.includes('not found')) {
        res.status(403).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Failed to send reply.' });
      }
    }
  });

  // AI endpoints for reply assistance
  app.post('/api/ai/suggest-reply', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { question, chatHistory } = req.body;

      if (!question || question.trim().length === 0) {
        return res.status(400).json({ error: 'Question is required.' });
      }

      // Create a prompt for the AI to suggest a reply
      const systemPrompt = `You are a helpful customer service assistant. Based on the following customer question and chat history, suggest a professional and helpful reply. Keep the reply concise but comprehensive.`;
      const userPrompt = `Question: ${question}\n\nChat History:\n${chatHistory || 'No previous chat history'}\n\nPlease suggest a reply:`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini', // Using a cost-effective model for suggestions
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 300,
        temperature: 0.7
      });

      const suggestedReply = completion.choices[0]?.message?.content?.trim();

      if (!suggestedReply) {
        return res.status(500).json({ error: 'Failed to generate reply suggestion.' });
      }

      res.json({ suggestedReply });
    } catch (error) {
      console.error('Error generating reply suggestion:', error);
      res.status(500).json({ error: 'Failed to generate reply suggestion.' });
    }
  });

  app.post('/api/ai/improve-reply', clientConfigMiddleware(clientConfigService), async (req, res) => {
    try {
      const { draftReply, question } = req.body;

      if (!draftReply || draftReply.trim().length === 0) {
        return res.status(400).json({ error: 'Draft reply is required.' });
      }

      if (!question || question.trim().length === 0) {
        return res.status(400).json({ error: 'Question is required.' });
      }

      // Create a prompt for the AI to improve the draft reply
      const systemPrompt = `You are a professional customer service assistant. Review and improve the following draft reply to make it more professional, helpful, and engaging while maintaining its core message.`;
      const userPrompt = `Original Question: ${question}\n\nDraft Reply: ${draftReply}\n\nPlease improve this reply:`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 400,
        temperature: 0.6
      });

      const improvedReply = completion.choices[0]?.message?.content?.trim();

      if (!improvedReply) {
        return res.status(500).json({ error: 'Failed to improve reply.' });
      }

      res.json({ improvedReply });
    } catch (error) {
      console.error('Error improving reply:', error);
      res.status(500).json({ error: 'Failed to improve reply.' });
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

  return app;
};

// Start the server if this file is run directly
console.log(`[DEBUG] process.argv[1]: ${process.argv[1]}`);
console.log(`[DEBUG] new URL(import.meta.url).pathname: ${new URL(import.meta.url).pathname}`);
if (import.meta.url.startsWith('file:') && path.resolve(process.argv[1]) === __filename) {
  console.log('[DEBUG] Creating app instance...');
  const appInstance = createApp();
  console.log(`Attempting to start backend server on port: ${port}`);
  appInstance.listen(port, () => {
    console.log(`Backend server successfully listening at http://localhost:${port}`);

    // Start the score decay scheduler
    scoreDecayScheduler.start();
  }).on('error', (err) => {
    console.error(`Failed to start backend server on port ${port}:`, err);
    process.exit(1); // Exit with an error code
  });
}

export { createApp, clientConfigMiddleware, upload };