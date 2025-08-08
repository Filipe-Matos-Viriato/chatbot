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
