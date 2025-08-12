## Activity Log

- 2025-08-12: Added `packages/backend/scripts/dump-supabase-tables.js` and npm script `dump:supabase:tables` in `packages/backend/package.json` to dump all tables into `packages/backend/supabase_sql_tables/` as individual SQL files. Script supports `pg_dump` (preferred) and falls back to Supabase CLI.


- 2025-08-12: Documented current architecture and RAG implementation plan. Added `CURRENT_PROJECT_OVERVIEW.md` and `RAG_SUPABASE_PINECONE_IMPLEMENTATION_PLAN.md` describing the present system and a concrete plan to integrate Supabase+Pinecone RAG per `rag_architecture.txt`.

- 2025-08-12: Began RAG integration skeleton:
  - Added `packages/backend/src/config/pinecone.js` and `packages/backend/src/services/rag-orchestrator.js` (intent routing, tools, retrieval, answer composition).
  - Wired orchestrator into `/api/chat` behind `ENABLE_RAG` flag; added snake_case context compatibility.
  - Added ingestion script `packages/backend/scripts/ingest-docs.js` and npm script `ingest:docs`.
  - Added Supabase SQL `packages/backend/supabase_sql_tables/rag_fresh_tables.sql` for units/status/timeline/price_history/visits/faq.

