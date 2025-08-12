- Removed the onboarding feature entirely from the project. This included deleting the onboarding service, frontend components, and backend endpoints. The RAG service was also updated to remove the onboarding context.
- Updated `chatHistoryTaggingRules` in `e6f484a3-c3cb-4e01-b8ce-a276f4b7355c.json` to use Portuguese keywords and expanded the word lists.
- Updated `documentExtraction` patterns to match JSON listing format with fields like `fracao`, `preco`, `tipologia`, `area_privativa_m2`, etc.
- Updated `ingestionPipeline` to use `json-structure-chunker` with a template that properly formats apartment information from JSON structure.
- Added new extraction fields: `listingPrice`, `listingType`, `listingFloor`, `listingBlock`, `privateArea`, `totalArea`, `terraceArea`, `garageSpaces`.
- Added `defaultDevelopmentId` to client config to prevent context leakage.
- Updated `rag-service.js` to use `defaultDevelopmentId` in hybrid search.
- Changed the placeholder text in `packages/widget/src/App.jsx` to "Escreva aqui...".
- Fixed issue with chatbot recommending listings that don't belong to upinvestments by adding explicit client filtering to RAG context.
- Enhanced system prompt to emphasize that only upinvestments properties should be recommended.
- Fixed user preferences recall by improving the onboarding-service.js formatOnboardingAnswersForRAG method to include additional preferences.
- Implemented client-specific Pinecone indexes for better data isolation and performance:
  - Added `pineconeIndex` field to client configuration
  - Updated `rag-service.js` to use client-specific indexes
  - Updated `chat-history-service.js` to use client-specific indexes
  - Updated `ingestion-service.js` to use client-specific indexes
  - Created migration script to transfer data to client-specific indexes
  - Added documentation for setting up client-specific indexes
- Added console logs to the migration script to debug Pinecone queries and upserts.
- Added detailed console logs to the RAG service to debug the vector search process.
- Created a script to delete vectors by `client_id` from a Pinecone index to resolve data leakage.
- Deleted the unsafe `ingest-test-data.js` script to prevent future data contamination.
- Implemented a new filter conversion function (`convertOnboardingToFilters`) to correctly use onboarding answers in Pinecone searches.
- Refined the RAG service to apply more specific filters, improving search accuracy and efficiency.
- Created a new script to ingest the Up Investments knowledge base into Pinecone.
- Corrected the OpenAI API key and attempted to rerun the ingestion script.
- Added explicit dotenv loading in `src/config/supabase.js` to support standalone scripts.
- Successfully ingested the Up Investments knowledge base into the `rachatbot-1536` index via `scripts/up_investments-ingest-test-data.js`, processing text and JSON files and upserting embeddings.
- Created new focused ingestion script `ingest-up-investments-knowledge-base.js` that only processes files from the Up Investments knowledge-base directory, preventing ImoPrime test-data contamination.
- Deleted the old `up_investments-ingest-test-data.js` script and replaced it with the cleaner, more focused version.
- Resolved Git merge conflict in `packages/backend/.env` by keeping the `OPENAI_API_KEY` from the incoming branch, successfully integrating the OpenAI API key into the environment configuration.
- Implemented URL detection feature for the chatbot widget:
  - Modified `packages/widget/src/index.js` to capture `window.location.href` and pass it to the widget configuration
  - Updated `packages/widget/src/App.jsx` to include `pageUrl` in the chat request payload
  - Enhanced `packages/backend/src/index.js` chat endpoint to extract and forward `pageUrl` to the RAG service
  - Modified `packages/backend/src/rag-service.js` to accept `pageUrl` parameter and include it in template variables for system prompts
  - The chatbot can now access the URL of the page where it's embedded, enabling context-aware responses based on the current page

- Created a comprehensive `README.md` describing project architecture, setup, environment variables, APIs, widget integration, ingestion workflow, and deployment on Vercel. This helps onboard contributors and users quickly.

- Replaced JSON-focused ingestion with a simplified PDF/Text ingestion service:
  - Added `packages/backend/src/services/ingestion-service-pdf.js` using `pdf-parse` + LangChain chunking + OpenAI embeddings
  - Upserts vectors to Pinecone with `metadata.text` for compatibility with `rag-service.js`
  - Best-effort logs uploads to Supabase `documents` table
  - Wired backend `POST /v1/documents/upload` to use the new service by default
  - Added `packages/backend/supabase_sql_tables/documents.sql`
  - Updated `README.md` ingestion section

- Ran JSON → Supabase listings importer:
  - Command: node -r dotenv/config packages/backend/scripts/import-listings-from-json.js --dir "packages/backend/client-data/Up Investments/knowledge-base/supabase" --clientId e6f484a3-c3cb-4e01-b8ce-a276f4b7355c --clientName "Up Investments" --developmentId ada4b13b-a135-434e-9e72-9f0f3e201558
  - Result: Upserted 16 rows into `public.listings` with proper mappings (id, name, type, price, beds, baths, amenities, client_id, client_name, development_id, listing_status, current_state).

- Switched Pinecone ingestion to PDFs:
  - Added `packages/backend/src/services/ingestion-service-pdf.js` (pdfjs-based), bulk script `scripts/ingest-pdfs-from-dir.js`, and npm script `ingest-pdfs`.
  - Confirmed TXT ingestion works; addressed Uint8Array conversion for PDFs and wired commands to run bulk ingestion from `client-data/Up Investments/knowledge-base`.
  - Added NLP extraction for structured metadata (price_eur, typology, areas, features) and filtered nulls to satisfy Pinecone; verified 21/21 PDF/TXT ingests succeeded.

- RAG query updates and debug logging:
  - Added `namespace: clientConfig.clientId` to all Pinecone queries in `rag-service.js` to match per-client ingestion namespaces
  - Fixed typology filter key (`filters.typology` instead of `filters.type`) to match ingestion metadata
  - Added namespace/filter/match debug logs in `rag-service.js` and chat request logging in `/api/chat`
  - Switched to semantic-only Pinecone search within client namespace (removed query-derived filters from query stage). Query filters are now used only for re-ranking, avoiding filter mismatches when metadata is sparse. Added fallback broad search and resilient context extraction from multiple metadata keys (`text`, `chunk`, `content`, `body`, `page_text`).
  - Added granular debug logs for re-ranking and context assembly, including top results preview (id/score/typology/category), hint boosts applied (e.g., T1), candidate listing URLs, and context snippet sampling.
  - Improved page context binding: widget now sends the live `window.location.href` with every message; backend URL parser upgraded to robustly extract listing IDs from paths with trailing slashes, query strings, or hash.

- Query understanding improvements for listing resolution:
  - Enhanced `extractListingIdFromQuery()` to parse natural phrases like "T2 E Bloco 1" / "fração E bloco 1" and normalize to `block_<n>_apt_<LETTER>`.
  - `extractQueryFilters()` now sets `filters.listing_id` from natural-language patterns, not just "apartamento A no bloco 1".
  - Added a query-stage targeted Pinecone query when a listing_id is derived from the user's text (in addition to URL/context-based targeting). This ensures queries like "t2 e bloco 1" retrieve the correct apartment vectors and enable redirect/URL presentation.
  - Extra debug logs: query-derived listing query result counts.

- Onboarding scoring refinement:
  - Added per-bucket budget weights in client config under `onboardingScoringRules.weights.budgetBuckets`.
  - Updated `computeLeadScoreFromOnboarding()` to use fine-grained budget bucket scores (fallbacks to `budgetProvided` when unspecified, and to 0 for "prefer not to say").

- Added high-level PRD for onboarding & lead qualification:
  - Created `ONBOARDING_LEAD_QUALIFICATION_PRD.md` describing a post-first-message survey (typology, budget, timeframe), contact capture (name, email), Supabase storage using existing `public.visitors` table (`onboarding_questions`, `onboarding_completed`, `lead_score`), Pinecone non-PII preference profile, intent routing for immediate listing recommendations, and per-client configurability.

- Implemented onboarding & lead qualification (v1):
  - Backend: added `POST /v1/visitors/:visitorId/onboarding` to save onboarding to `visitors.onboarding_questions`, set `onboarding_completed`, update `lead_score`; added non-PII Pinecone preference upsert in `visitor-service.js`.
  - Widget: added first-message onboarding flow (typology, budget, timeframe → name/email + consent), submits to onboarding endpoint, then either recommends listings or proceeds with the original request.

- Centralized onboarding scoring configuration:
  - Added `onboardingScoringRules` to `packages/backend/configs/e6f484a3-c3cb-4e01-b8ce-a276f4b7355c.json` with weights, min and max.
  - Extended `client-config-service` to expose `onboardingScoringRules` from DB.
  - Updated `visitor-service` to compute onboarding lead score from client rules and enforce a minimum on completion.
  - Updated migration script to upsert `onboarding_scoring_rules` to the `clients` table.

- Resolved merge conflict in `packages/backend/src/index.js`:
  - Removed duplicated `/v1/visitor` route.
  - Fixed development routes to call `developmentService` methods explicitly (`createDevelopment`, `getDevelopmentById`, `getDevelopmentsByClientId`, `updateDevelopment`, `deleteDevelopment`).
  - Verified no new linter issues; server boot remains unchanged.

- Implemented persistent chat message logging to Supabase `public.chat_messages`:
  - Added `packages/backend/supabase_sql_tables/chat_messages.sql` defining the table schema (id, visitor_id, session_id, client_id, message_text, sender_role, timestamp, listing_id, development_id).
  - Updated `/api/chat` in `packages/backend/src/index.js` to insert a row into `chat_messages` for each user message and assistant response, including optional `listing_id` and `development_id` when present.
  - Kept Pinecone upserts for semantic history; Supabase now stores structured transcripts for analytics.

- Reverted RAG refactor attempts post-PRD: removed temporary shared utils and two-query mode changes; restored `rag-service.js` and `index.js` to prior behavior. PRD remains for future planning.
 - Implemented RAG simplification per PRD:
   - Added shared utils: `utils/rag-parsing.js`, `utils/async-timeout.js`, `utils/rerank.js`, `utils/context.js`, `utils/prompt.js`, `utils/structured-logger.js`.
   - Refactored `src/rag-service.js` to use two-query retrieval (targeted + broad) with timeouts, centralized parsing, modular re-ranking, normalized context text picking, and safe prompt templating. Added structured logs.
   - Reduced broad topK to 30; kept client namespace isolation and promoter filtering.
   - Added unit tests for parsing utilities under `packages/backend/test`.
   - Added env-configurable flags/timeouts: `RAG_TWO_QUERY_ENABLED`, `RAG_BROAD_TOPK`, `RAG_PINECONE_TIMEOUT_MS`, `RAG_OPENAI_TIMEOUT_MS`.
   - Logged lightweight citations (ids/urls) for top matches; added timing logs for Pinecone and OpenAI calls.
   - Improved token accounting by truncating context within budget.
 - Implemented hallucination guard for aggregative pricing queries:
   - Added `getCheapestListingsByTypology()` in `listing-service.js` and wired SQL-backed fallback for queries like "mais barato/mais caro" (typology-aware, development-aware) in `rag-service.js`.
   - Aggregative Price Context now uses precise DB values (also lists second-cheapest when available) to avoid fabricated figures.
 - Reduced repetitive CTAs:
   - Added `utils/postprocess.js` and integrated into `rag-service.js` to trim redundant trailing phrases like "Como posso ajudar mais?" when unnecessary.

2025-08-11
- Implemented deictic reference resolution and explicit link surfacing for UpInvestments:
  - Added resolver to map pronouns and explicit patterns (e.g., "T1 B Bloco 1", "ID: 4271") to real `listing_id` using chat history and helper lookups.
  - Enhanced `/api/chat` to pass a targeted external context (`type: 'listing'|'development'`) into RAG when a referenced property is detected.
  - Updated `rag-service.js` to inject top citation URLs into the prompt context, increasing the likelihood that the assistant includes the correct link.
  - Added `findByNameLike` and `findByTypologyLetterBlock` helpers to `listing-service.js` to resolve typology+letter+block to a listing.
  - Improved query parsing in the chat handler to detect "ID 4271" style references and typology+letter+block directly from user input.
  - Files edited: `packages/backend/src/index.js`, `packages/backend/src/rag-service.js`, `packages/backend/src/services/listing-service.js`.
  - Impact: Queries like "mostra-me este" and "mostra-me o T1 B do Bloco 1" now resolve to the intended apartment and include the listing link instead of falling back to a generic domain response.

2025-08-11
- Added deep debug logging for UpInvestments resolution and retrieval flow:
  - Logs URL-derived candidate id, query-derived candidate id, TLBlock (typology+letter+block) parsing and resolution, explicit ID detection, deictic resolution outcome.
  - Logs final resolved context ids and the exact external context passed into RAG.
  - In retrieval, logs original query, queryFilters, targetedFilter mapping from `block_X_apt_Y` to numeric listing id, and targeted vs broad match counts.
  - Files edited: `packages/backend/src/index.js`, `packages/backend/src/rag-service.js`.
  - Impact: Enables precise diagnostics when Pinecone returns 0 matches or when the assistant falls back to page context, helping pinpoint where resolution fails.

2025-08-11
- Implemented automatic post-onboarding recommendations:
  - New helper `findListingsByOnboarding` in `listing-service.js` filters by typology and budget bucket.
  - `/v1/visitors/:visitorId/onboarding` now returns and pushes an assistant message with the top 4 matching listings, including direct links.
  - Persisted the assistant message to both Pinecone chat history and Supabase `chat_messages` for immediate display.
  - Files edited: `packages/backend/src/index.js`, `packages/backend/src/services/listing-service.js`.
