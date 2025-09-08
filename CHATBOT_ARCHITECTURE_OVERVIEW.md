## Chatbot Architecture Overview

### Components

- **Frontend/UI**
  - `packages/frontend/src/chatbot/ChatInterface.jsx`: basic React chat UI for local testing.
  - Embeddable widget (loader) served from `packages/frontend/public/widget/` for third‑party sites.
  - Sends requests to the backend with headers/body including `x-client-id`, `visitor_id`, `session_id`, optional `context`.

- **Backend API (Express)**
  - File: `packages/backend/src/index.js`.
  - Loads client configuration via `clientConfigMiddleware` from Supabase (`clients` table).
  - Persists chat messages and embeddings to Supabase; upserts conversation turns to Pinecone for context recall.

- **RAG Service**
  - File: `packages/backend/src/rag-service.js`.
  - Generates query embeddings (OpenAI), performs hybrid retrieval from Pinecone, enriches with listing/development data from Supabase, assembles prompts, and calls OpenAI Chat for responses.

- **Data Stores**
  - **Supabase**: system of record for `clients`, `listings`, `developments`, `visitors`, `chat_messages`, `question_embeddings`, analytics RPCs, etc.
  - **Pinecone**: vector store for document chunks and chat message vectors (namespaced per client).

### Request Flow (User Message → Assistant Reply)

1) Frontend calls `POST /api/chat` with `x-client-id`, `visitor_id`, `session_id`, optional `context` (e.g., `{ listingId }`), and `query`.
2) `clientConfigMiddleware` attaches `req.clientConfig` and a placeholder `userContext`.
3) Recent messages are fetched (Pinecone) and formatted via `ChatHistoryService` to avoid context bleeding when the listing context shifts.
4) Listing/development context is resolved from explicit `context`, `pageUrl`, query parsing, or prior assistant messages (with Supabase lookups to `listings`/`developments`).
5) The RAG service:
   - Computes a query embedding (OpenAI).
   - Performs hybrid retrieval in Pinecone (client namespace/index) using chunk metadata.text.
   - Optionally enriches with live listing/development details from Supabase.
   - Builds the final prompt (client‑specific system prompt) and calls OpenAI Chat.
6) Persistence and telemetry:
   - Inserts the user question and the assistant reply into Supabase `chat_messages`.
   - Generates and stores the user question embedding into `question_embeddings`.
   - Upserts both turns to Pinecone via `ChatHistoryService.upsertMessage` (for future context).
7) Returns `{ response, debug }` to the frontend.

### Knowledge Ingestion

- Generic ingestion: `packages/backend/src/services/ingestion-service-pdf.js`
  - Extracts text, chunks, embeds, upserts vectors to Pinecone (namespace = client).
  - Best‑effort logs a row to Supabase `documents` (if available under RLS).

- UpInvestments ingestion: `packages/backend/scripts/ingest-up-investments-knowledge-base.js`
  - Ensures `listings` in Supabase are created/updated (for listing PDFs) and captures `listing_uuid`.
  - Calls an ingestion flow to upsert vectors to Pinecone with enriched metadata.

### Key Endpoints (selected)

- Chat: `POST /api/chat` — main chat entrypoint.
- Suggested questions: `POST /api/suggested-questions`.
- Visitor/session: `POST /v1/sessions` (creates `visitor_id` in Supabase), `POST /v1/events`.
- Document upload: `POST /v1/documents/upload` (processes files asynchronously, upserts to Pinecone; logs to Supabase `documents`).
- Listings & developments CRUD: multiple `/v1/*` endpoints backed by Supabase services.
- Analytics: `/api/unanswered-questions-summary` (Supabase RPC + join for names).

### Files of Interest

- Backend API: `packages/backend/src/index.js`
- RAG core: `packages/backend/src/rag-service.js`
- Chat history service: `packages/backend/src/services/chat-history-service.js`
- Listing/development services: `packages/backend/src/services/listing-service.js`, `packages/backend/src/services/development-service.js`
- Ingestion: `packages/backend/src/services/ingestion-service-pdf.js`, `packages/backend/scripts/ingest-up-investments-knowledge-base.js`
- Frontend chat: `packages/frontend/src/chatbot/ChatInterface.jsx`

### Configuration

- Required env: `OPENAI_API_KEY`, `PINECONE_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, plus optional per‑client Pinecone index in `clients` config.
- Pinecone vectors are namespaced by `client_id`. If a client‑specific index is set, it is used; otherwise defaults to `rachatbot-1536`.

### Notes on UpInvestments

- The UpInvestments KB ingestion script writes to both:
  - Supabase `listings` (insert/update and capture `listing_uuid`).
  - Pinecone vectors with listing metadata for retrieval.


