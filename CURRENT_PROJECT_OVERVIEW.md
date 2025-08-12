## Project Overview (Current State)

### Monorepo Layout

- Root `package.json` uses npm workspaces: `packages/*`.
- Key packages and modules:
  - `packages/backend`: Node.js/Express API, Supabase integration, OpenAI usage (LLM-only chat; RAG removed).
  - `packages/frontend`: React (Vite) dashboard + simple chat UI (`ChatInterface.jsx`).
  - `packages/widget`: Embeddable widget (Webpack/Preact) artifacts and build pipeline (loader distributed under `packages/frontend/public/widget/`).
  - `api/`: Vercel serverless entrypoints; `api/database-backend.js` wraps and serves the Express app.

### Runtime Architecture (Today)

- Backend server created in `packages/backend/src/index.js` and also exported for Vercel:
  - Loads env via `packages/backend/.env`.
  - Creates Express app with CORS, JSON parsing, basic request logging.
  - Injects per-request client configuration via `clientConfigMiddleware` (reads `x-client-id` header or `clientId` param) using `services/client-config-service.js` (cached with `node-cache`).
  - Uses Supabase (`src/config/supabase.js`) as the system of record for visitors, events, clients, listings, metrics, and chat messages.
  - Uses OpenAI for LLM responses and some extraction tasks. Vector RAG is explicitly removed in code comments and disabled scripts.

### Key Endpoints

- Health/root: `GET /` → "Backend server is running!".
- Client management:
  - `GET /v1/clients` and `GET /api/v1/clients` → list all clients (db-driven).
  - CRUD: `POST/PUT/DELETE /v1/clients/:id` (+ compatible `/api/v1/...` routes) using `client-config-service`.
  - Widget config: `GET /api/v1/widget/config/:clientId` → returns client config from DB.
- Chat:
  - `POST /api/chat` → LLM-only flow. Persists user and assistant turns to `chat_messages`. Also logs the question in `questions`. No retrieval or vector store involved.
    - Notes: expects `query`, `visitorId`, `sessionId`, and optional `context`. Frontend example sends `session_id`/`visitor_id` (snake_case), which may not match current destructuring (camelCase) — verify/request normalization.
- Suggested questions:
  - `POST /api/suggested-questions` → LLM-only generation of 3 prompts.
- Analytics/Listing insights:
  - `GET /api/listing/:id` → aggregates listing details, metrics, unanswered questions, handoffs, and full chat history for that listing.
  - `GET /api/listing/:id/leads` → leads for a listing via `events`/`visitors`.
- Visitors & events:
  - `POST /v1/sessions` → creates visitor record in Supabase.
  - `POST /v1/events` → logs visitor events and updates listing metrics (engaged_users, total_conversions, inquiries, conversion_rate, hot leads counters).
  - `POST /v1/visitor` → fetches a visitor by id.
  - `POST /v1/visitors/:visitorId/onboarding` → saves onboarding answers to `visitors.onboarding_questions`, updates `lead_score`, and writes an assistant message with recommendations based on `listing-service` filters.
  - `POST /v1/leads/acknowledge` → batch acknowledge leads.
- Developments CRUD: `POST/GET/PUT/DELETE /v1/developments...` (scoped by client).
- Listings CRUD: `POST/GET/PUT/DELETE /v1/listings...` and `GET /v1/clients/:clientId/listings` (scoped by client).
- Users/Agents:
  - CRUD on `/v1/users...`, list client users and agents, and assign/remove listings to agents.
- Chat history for visitor: `GET /v1/chat-history/:visitorId` → reads from `chat_messages`.

### Backend Services

- `services/client-config-service.js`:
  - Fetches/caches `clients` row (prompts, lead scoring rules, onboarding rules, widgetSettings/theme, etc.).
- `services/visitor-service.js`:
  - Creates visitor, logs events, updates listing metrics, computes lead score updates.
  - Saves onboarding, merges payload with existing, updates `lead_score` using per-client rules.
- `services/listing-service.js`:
  - CRUD and helper queries (min/max price, cheapest listings by typology, name search, typology-letter-block resolution, onboarding-based recommendations).
- `services/development-service.js` and `services/user-service.js`: CRUD utilities.
- `src/config/openai.js` and `src/config/supabase.js`: client initializers. `openai.getEmbedding` helper exists but vector use is disabled elsewhere.

### Frontend (packages/frontend)

- Vite app with routes for:
  - `/` renders `ChatInterface.jsx` (simple demo chat UI calling `/api/chat`).
  - `/dashboard/*` dashboard with tabs for overview, listing performance, user insights, chatbot analytics.
  - `/admin/*` admin dashboard with client management and editors (prompts, tagging, chunking rules UI still present but RAG disabled server-side).
  - `/chat-history/:visitorId` viewer page.

### Widget

- Build pipeline exists (`packages/widget`) with loader artifact copied into `packages/frontend/public/widget/` via root scripts (`copy:widget`).
- Widget configuration endpoint is provided by backend and used in PRDs to enable dynamic settings; current runtime serves via Vercel rewrites in `vercel.json`.

### Deployment (Vercel)

- `api/database-backend.js` lazily initializes the Express app from `packages/backend/src/index.js` and proxies requests.
- `vercel.json` rewrites `/api/*` and `/v1/*` to the database-backed function, and falls back SPA routes to `/index.html`.

### Data Layer (Supabase)

- Supabase is the authoritative store for clients, visitors, events, chat_messages, listings, listing_metrics, clustered_questions, etc.
- Vector and Pinecone integrations were removed. No embeddings are persisted for chat; questions are logged with `status` and chatbot responses for analytics.

### Notable Removed/Disabled Components

- RAG flow and Pinecone vectors (commented/removed modules and scripts; many RAG-related scripts show as deleted in repo history).
- Ingestion endpoints disabled: `/v1/documents/upload` returns 410.

### Environment Variables (in use)

- `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PORT`.
- `PINECONE_API_KEY` may exist but unused in the current backend runtime.

### Known Gaps / Inconsistencies

- Chat payload naming mismatch potential: backend expects `visitorId/sessionId`; the demo `ChatInterface.jsx` sends `visitor_id/session_id` (snake_case). Consider normalizing inputs.
- RAG is removed but some UI and documentation still reference tagging/chunking; server ignores vector steps.
- No retrieval or knowledge/document context in answers; all responses are LLM-only with provided system prompt per client.


