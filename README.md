Enterprise RAG Chatbot (Real Estate)

### Overview

Multi-tenant Retrieval-Augmented Generation (RAG) chatbot for real estate. The system ingests client documents and listings, stores semantic vectors in Pinecone, structured entities in Supabase, and serves context-grounded answers via an embeddable website widget and an admin-facing frontend.

### Key Features

- Multi-tenant by design: every operation is scoped by `client_id`
- Hybrid retrieval: Pinecone semantic search + structured filters (price, bedrooms, amenities)
- Context awareness: uses current page URL/listing for targeted answers
- Client-specific Pinecone indexes for isolation and performance
- Supabase-backed listings, events, questions, metrics and chat history analytics
- Chat history storage and replay; suggested questions generation
- Admin dashboard: manage clients, listings, developments, users, rules and prompts
- Lightweight embeddable widget (Webpack + Preact) with dynamic configuration

### Monorepo Layout

- packages/backend/ (Node.js + Express)
  - src/index.js: Express app factory, routes and middleware
  - src/rag-service.js: embeddings, hybrid search, prompt assembly, LLM calls
  - src/services/*: client config, listings, ingestion, chat history, users, visitors
  - supabase_sql_tables/*.sql: database schema (listings, events, questions, metrics, documents)
  - scripts/*: ingestion, clustering, migrations, Pinecone maintenance
- packages/frontend/ (Vite + React + Tailwind)
  - Admin dashboard and analytics UI
  - public/widget/loader.js: compiled widget loader served statically at /widget/loader.js
- packages/widget/ (Webpack + Preact)
  - Embeddable chatbot widget
  - src/index.js: window.initViriatoChatbot(config) + auto-init with script data-attributes
  - src/App.jsx: chat UI; calls backend /api/chat and related endpoints
- api/ (Vercel serverless entry)
  - database-backend.js: bootstraps the Express app from packages/backend/src/index.js
- Docs: RAG_SYSTEM_DEVELOPER_GUIDE.md, CLIENT_SPECIFIC_INDEXES.md, PRDs

### Technology Stack

- Backend: Node.js, Express, OpenAI API (text-embedding-3-small, gpt-3.5-turbo), Pinecone, Supabase
- Frontend: React, Vite, Tailwind
- Widget: Preact, Webpack (UMD loader)

### Environment Variables (backend)

Create packages/backend/.env with:

- OPENAI_API_KEY (required)
- PINECONE_API_KEY (required)
- SUPABASE_URL (required)
- SUPABASE_ANON_KEY (required)
- PORT (optional, default 3007)

Note: Pinecone index name can be set per-client in the client config (pineconeIndex), else defaults to rachatbot-1536.

### Database Setup (Supabase)

Run the SQL files in packages/backend/supabase_sql_tables/:

- listings.sql
- listing_metrics.sql
- events.sql
- questions.sql
- questions_embeddings.sql
 - documents.sql (optional registry of uploaded docs)

These define the core structured entities. Additional tables (e.g., clients, users, visitors, handoffs, clustered_questions) should exist per your environment.

### Install & Run (local)

1) Install dependencies (workspace root):

```
npm install
```

2) Start backend (loads packages/backend/.env):

```
npm run start:backend
```

Backend listens on http://localhost:3007 by default.

3) Start frontend (admin dashboard):

```
npm run dev
```

Frontend serves on Vite’s dev port (e.g., http://localhost:5173).

4) Optional: test harness for the widget demo:

```
npm run start:harness
```

Then open http://localhost:5175.

### Data Ingestion (PDF/Text simplified)

- Upload documents via API (asynchronous processing): POST /v1/documents/upload
  - Multipart fields: files, document_category (client|development|listing), listing_id (optional), development_id (optional)
- Backend extracts text (pdf-parse for PDF), chunks with LangChain, embeds with OpenAI, and upserts to Pinecone with `metadata.text` for RAG. It best-effort logs the file to Supabase `documents`.
- The ingestion service now lives at `packages/backend/src/services/ingestion-service-pdf.js` and is wired into `/v1/documents/upload`.

### Core API Endpoints (selected)

- Health
  - GET / → backend up
- Chat
  - POST /api/chat → body: { query, visitorId, sessionId, context, pageUrl } (requires X-Client-Id)
  - POST /api/suggested-questions
  - GET  /api/common-questions?listingId=
  - GET  /api/v1/history/:visitorId
- Widget configuration
  - GET /api/v1/widget/config/:clientId
- Visitors & sessions
  - POST /v1/sessions → { clientId, listingId? } returns { visitor_id }
  - POST /v1/visitor → { visitorId }
  - POST /v1/events → { visitorId, eventType, clientId, listingId? }
- Listings
  - POST /v1/listings create/update
  - GET  /v1/clients/:clientId/listings
  - GET  /v1/listings/:id
  - PUT  /v1/listings/:id
  - DELETE /v1/listings/:id
- Clients
  - GET  /v1/clients and /api/v1/clients
  - POST /v1/clients and /api/v1/clients
  - GET  /v1/clients/:id
  - PUT  /v1/clients/:id and /api/v1/clients/:id
  - DELETE /v1/clients/:id and /api/v1/clients/:id
- Users (agents/promoters)
  - CRUD: /v1/users … /v1/users/:id
  - Assign/remove listing: POST/DELETE /v1/users/:userId/listings/:listingId
  - By client: GET /v1/clients/:clientId/users, GET /v1/clients/:clientId/agents
- Listing analytics bundle
  - GET /api/listing/:id?session_id= → details, metrics, unanswered, handoffs, full chat history

Headers: most authenticated endpoints expect X-Client-Id and optionally X-User-Id, X-User-Role (admin|promoter) to scope/authorise requests.

### Embeddable Widget

Serve the compiled loader at /widget/loader.js (part of the frontend build). Embed on any page:

```html
<script
  src="/widget/loader.js"
  data-client-id="<client-uuid>"
  data-api-url="https://your-domain.example"
  data-primary-color="#1f2937"
  data-font-family="Inter, sans-serif"
></script>
```

The loader auto-initialises by default. Alternatively, initialise manually:

```html
<script src="/widget/loader.js" data-auto-init="false"></script>
<script>
  window.initViriatoChatbot({
    clientId: '<client-uuid>',
    apiUrl: 'https://your-domain.example',
    theme: { primaryColor: '#1f2937', fontFamily: 'Inter, sans-serif' }
  });
  // The widget automatically includes pageUrl in chat requests
  // and will reuse visitorId via localStorage when available.
</script>
```

Widget calls:

- GET /api/v1/widget/config/:clientId → dynamic configuration and copy
- POST /v1/sessions → creates a visitor session, saves visitor_id in localStorage
- GET /api/v1/history/:visitorId → loads chat history
- POST /api/chat → sends messages and gets grounded responses

### Client-Specific Pinecone Indexes

To isolate data per client, set pineconeIndex in the client’s configuration record. See packages/backend/docs/CLIENT_SPECIFIC_INDEXES.md for details and migration tips.

### Deployment (Vercel)

- The frontend is built to packages/frontend/dist (see vercel.json)
- Serverless functions route /api/* and /v1/* to api/database-backend.js, which initialises the Express app
- Root scripts:
  - npm run build → builds widget + frontend and copies the widget to frontend public/
  - npm run vercel-build (CI convenience)

Ensure all required environment variables are set in the Vercel project.

### Troubleshooting

- 500 from /api/chat: verify OPENAI_API_KEY and that embeddings/LLM models are available
- No results from Pinecone: confirm client index name, dimensions (1536) and that vectors exist
- Widget CORS: backend CORS is permissive (origin: true) for embedding; ensure correct API URL
- Supabase auth: ensure SUPABASE_URL and SUPABASE_ANON_KEY and tables exist

### Licensing

UNLICENSED (internal project). Update package.json and this section if publishing.


