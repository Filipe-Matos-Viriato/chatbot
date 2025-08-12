## Supabase + Pinecone RAG Integration Plan

This document describes how to implement the new RAG architecture (per `rag_architecture.txt`) and integrate it into the current system.

### Goals

- Classify intent and route between fresh-data tools (Supabase) vs. contextual answers (Pinecone) vs. actions.
- Store authoritative “fresh” facts in Supabase; store long-form content in Pinecone with rich metadata.
- Keep responses persuasive, concise, and CTA-driven in pt-PT.

### High-Level Components

1) Supabase tables (fresh data): `units`, `unit_status`, `build_timeline`, `price_history`, `visits`, `faq`.
2) Pinecone index: `realestate-index` with namespaces `marketing`, `legal`, `faq_long`; metadata as in `rag_architecture.txt`.
3) Backend agent/orchestrator inside `packages/backend/src/index.js` (new module):
   - Intent classifier.
   - Retrieval functions (Pinecone + optional re-ranking).
   - Tool functions (Supabase RPC/queries) per signatures.
   - Answer composer with CTA and scarcity hooks when justified.
4) Ingestion pipeline script(s): parse PDFs/HTML, chunk, embed with OpenAI `text-embedding-3-small`, upsert to Pinecone.

---

## Step-by-Step Implementation

### 0. Prerequisites

- Environment vars: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `PINECONE_API_KEY`, `PINECONE_ENVIRONMENT`/project config.
- Pinecone index `viriato_chatbot_1536` created with suitable dimensions (OpenAI `text-embedding-3-small` → 1536 dims) and pods.

### 1. Database Schema (Supabase)

Create the new tables described in `rag_architecture.txt` if they don’t exist. Recommended DDL (adapt to your naming conventions/IDs):

- `units(id uuid pk, project_id uuid, typology text, area_m2 numeric, floor int, view text, base_price numeric, media_urls jsonb, features jsonb, created_at timestamptz)`
- `unit_status(unit_id uuid pk ref units, status text check in ('available','reserved','sold'), price numeric, last_update timestamptz)`
- `build_timeline(project_id uuid, phase text, eta_date date, notes text)`
- `price_history(unit_id uuid, dt date, price numeric)`
- `visits(id uuid pk, unit_id uuid, visitor_name text, visitor_phone text, visitor_email text, scheduled_at timestamptz, created_at timestamptz)`
- `faq(id serial pk, category text, q text, a text)`

Actions:
- Add SQL migration scripts under `packages/backend/supabase_sql_tables/` and a `scripts/create-supabase-tables.js` runner (already present; extend as needed).
- Ensure row-level security policies as appropriate.

### 2. Backend: Config and Clients

- Add Pinecone client initializer, e.g., `src/config/pinecone.js` using `@pinecone-database/pinecone`.
- Ensure `src/config/openai.js` exports embedding helper (already present) and chat client.

### 3. Backend: RAG Orchestrator

Create `src/services/rag-orchestrator.js` with:

- Intent classifier: lightweight heuristic + few-shot prompt to choose among `INFO_FRESH | STORY_COMPARE | ACTION`.
- Tools (Supabase):
  - `get_unit(params)` query `units` (and optionally filter by `project_id`, `typology`, `maxPrice`, etc.).
  - `get_availability(unit_id)` from `unit_status`.
  - `get_timeline(project_id)` from `build_timeline`.
  - `simulate_mortgage(price, down, rate, termYears)` using PMT.
  - `schedule_visit(unit_id, when, contact)` inserts into `visits`.
  - `get_price_status(unit_id)` joins `price_history` + `unit_status` to return price, trend, last_change.
- Retrieval:
  - Embed query with OpenAI, query Pinecone `topK=6`, metadata filter by `project_id` and `typology` when available.
  - Optional cross-encoder rerank (phase 2), else use similarity order.
- Answer composition:
  - Consolidate top 3–4 passages (cap ~1.2–1.5k tokens) and fresh data from tools.
  - Apply system prompt from `rag_architecture.txt` to produce final answer with CTA.

Wire into `POST /api/chat`:
- Replace LLM-only flow with: classify → route:
  - `INFO_FRESH`: call appropriate tools; compose concise factual response + CTA.
  - `STORY_COMPARE`: retrieve from Pinecone, enrich with Supabase fresh fields for any units mentioned; compose persuasive answer + CTA.
  - `ACTION`: call `schedule_visit` or `simulate_mortgage`, confirm results.
  - Always log turns to `chat_messages` and questions to `questions` as today.

### 4. Ingestion Pipeline

Create new scripts under `packages/backend/scripts/`:

- `ingest-docs.js` (or per-client `ingest-<client>.js`):
  - Extract text from PDFs/HTML (use existing `nlp-extraction-service` for heuristics where useful).
  - Normalize, add title + 1–2 lines summary, chunk (400–700 tokens, overlap 80–120), prepend breadcrumb/title.
  - Compute embeddings with OpenAI and upsert to Pinecone with metadata `{ project_id, typology, phase, locale:"pt-PT", doc_type, audience, passage_id }`.
  - Skip fresh facts (price/stock) from vector store per “Freshness first”.

Add npm scripts in `packages/backend/package.json`:
- `ingest:docs`, `ingest:client:<id>`, `pinecone:delete:namespace`, etc.

### 5. Frontend/Widget Adjustments

- Chat widget and demo `ChatInterface.jsx` can remain unchanged in UI, but ensure payload fields align:
  - Use `visitorId`/`sessionId` camelCase in requests (or update backend to accept snake_case aliases).
- Optionally add “CTA quick actions” surfaced by the orchestrator (e.g., schedule viewing at suggested slots).

### 6. Security & Observability

- Add input validation and rate limiting to `/api/chat`.
- Log classifier labels and retrieval stats for analytics (e.g., `questions` table extensions or a new `chat_turns` table).
- Feature flag RAG via `CLIENTS.enableRag` in `clients` table to allow gradual rollout per client.

### 7. Testing

- Unit tests for tools/utilities (PMT calc; Supabase queries with mocks).
- Integration tests for `/api/chat` across the three intents.
- E2E smoke: ingestion → retrieval → chat answer quality gating (top-k sanity).

### 8. Deployment

- Ensure `vercel.json` continues to route `/api/*` and `/v1/*` to the database-backed function.
- Configure Vercel env with Pinecone and OpenAI secrets.
- Backfill minimal `units`/`unit_status` seed data for demo client.

---

## API/Code Changes Checklist

Backend (new/updated files):
- `src/config/pinecone.js` (new)
- `src/services/rag-orchestrator.js` (new)
- `src/index.js` → update `/api/chat` to call orchestrator
- `scripts/ingest-docs.js` (new) and client-specific variants

Database:
- Create/verify tables: `units`, `unit_status`, `build_timeline`, `price_history`, `visits`, `faq`.
- Optional: `chat_turns` for richer RAG analytics.

Environment:
- Add `PINECONE_API_KEY` and project settings to Vercel + local `.env`.

---

## Prompts and Policies (MVP)

- System (pt-PT): "És um agente imobiliário persuasivo e honesto. Usa dados fresh dos tools para preço/stock. Conclui com um único CTA claro. Evita floreados; foca em valor, escassez legítima e utilidade."
- Classifier prompt: few-shot mapping to `{INFO_FRESH, STORY_COMPARE, ACTION}`.
- Answer template when unit identified: `{typology}, {area_m2} m², vista {view}. Preço atual: €{price} | Estado: {status}. Entrega estimada: {phase} → {eta}. Próximo passo: reserva visita {11h/18h}?`.
- Scarcity hooks only when supported by Supabase data (recent reservations, price changes).

---

## Open Questions for Product/Stakeholders

1) Which client(s) should get RAG first (rollout plan)?
2) Source of ground-truth for `units` and `unit_status` — do we migrate from `listings` or maintain both? If both, how should `/api/chat` reference and display these coherently?
3) Do we require cross-encoder re-ranking for v1, or defer to v2? Any preferred model?
4) Expected languages beyond pt-PT for metadata and prompts?
5) Any compliance constraints for storing PDFs or long-form content in Pinecone for these clients?
6) Should the orchestrator expose tools as structured function-calls for future multi-agent use, or keep a single-agent prompt flow for now?

---

## Rollout Plan

- Phase A (dev): schema + orchestrator stub + Pinecone client; local ingest of 3–5 sample PDFs; manual tests.
- Phase B (staging): enable feature flag for one client; compare LLM-only vs. RAG quality; monitor latency.
- Phase C (prod): enable for target clients; SLOs: P95 chat latency < 2.5s with RAG; fall back to LLM-only on Pinecone/Supabase failures.


