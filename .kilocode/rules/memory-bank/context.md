# Project Context

## Current Work Focus
The primary focus is on ensuring accurate and complete data ingestion into Supabase and Pinecone, enabling robust RAG (Retrieval-Augmented Generation) capabilities for both general and context-specific queries, including aggregative questions. The Supabase integration for persistent visitor data storage has been successfully completed.

- **Common Questions Feature Status:** The "Common Questions about this Listing" feature now leverages pre-calculated and pre-clustered questions for improved performance and accuracy. The in-process K-Means clustering algorithm has been implemented to group semantically similar questions, and a dedicated API endpoint serves these pre-calculated common questions.

## Recent Changes
- **Ingestion Service Enhancements (`packages/backend/src/services/ingestion-service.js`):**
    - Prioritized JSON extraction for `num_bathrooms` and `price_eur`, ensuring values from JSON are not overwritten by text-based regex fallbacks.
    - Added `console.log` statements for debugging `price_eur` extraction.
    - Fixed `TypeError: Cannot read properties of undefined (reading 'id')` during listing creation.
    - Ensured `client_name` is populated in the `listings` table.
- **Listing Service Enhancements (`packages/backend/src/services/listing-service.js`):**
    - Added `getMinPrice(clientId)` and `getMaxPrice(clientId)` functions to efficiently retrieve minimum and maximum prices from the Supabase `listings` table.
- **RAG Service Enhancements (`packages/backend/src/rag-service.js`):**
    - Implemented logic to detect aggregative price queries (e.g., "mais barato", "mais caro").
    - When such queries are detected, it now fetches the min/max price directly from Supabase using the new `listingService` functions.
    - This aggregated price information is then injected into the LLM prompt as additional context, enabling the chatbot to answer these types of questions.
- **Client Configuration Updates (User Action):**
    - User updated the `document_extraction` column in Supabase for "Up Investments" with new regex patterns for `listingBaths` and `listingPrice`.
    - User fixed malformed JSON knowledge base files.
    - User changed the `price` column in the Supabase `listings` table to a numeric data type.
- **Streamlined Listing Ingestion:** Clarified and confirmed the process where adding a listing simultaneously updates both the Supabase `listings` table (with extracted structured metadata) and Pinecone (with processed content and metadata), ensuring data consistency and a streamlined workflow.
- **Common Questions Pre-calculation & API:** Implemented an in-process K-Means clustering algorithm in `packages/backend/scripts/cluster-questions.js` to pre-calculate and pre-cluster common questions. A new API endpoint `/api/common-questions` in `packages/backend/src/index.js` now serves this pre-calculated data, and the frontend (`packages/frontend/src/dashboard/listing-performance-tab/components/ListingDetailsPage.jsx`) has been updated to consume it. The old on-the-fly clustering logic has been removed from the `/api/listing/:id` endpoint.
- **Optimized Listing Details Page Data Fetching:** Implemented `Promise.all` for concurrent Supabase fetches (`listings`, `listing_metrics`, `unansweredQuestions`, `handoffs`) in `packages/backend/src/index.js` to improve page load performance.
- **Reduced Backend Console Verbosity:** Removed excessive `console.log` statements from the common questions grouping logic in `packages/backend/src/index.js` to prevent console flooding.
- **Improved Common Questions Aggregation (Initial Fix):** Adjusted the `SIMILARITY_THRESHOLD` to 0.7 and added an embedding type check in `packages/backend/src/index.js` to enhance the semantic grouping and correct the quantity display for common questions (this was a temporary fix before full pre-calculation).
- **Resolved `ap-01` Price Accuracy:** The chatbot now correctly provides price information for specific listings.
- **Enhanced `extractQueryFilters`:** `extractQueryFilters` in `rag-service.js` now correctly handles comparative queries for `num_bedrooms` (e.g., "mais de X quartos").
- **Improved RAG Strategy in `rag-service.js`:**
    - Implemented a strategy to **always perform both targeted and broad searches** when a `listing_id` context is present.
    - Results from both searches are combined and re-ranked to ensure comprehensive context for the LLM. This allows comparative queries and general information requests to be answered correctly even on specific listing pages.
- **Developments Feature Implemented:**
   - **Database Schema:** Created the `developments` table in Supabase and added a nullable `development_id` column to the `listings` table, referencing `developments`.
   - **Backend API:** Implemented API endpoints for managing developments (e.g., `POST /v1/developments`, `GET /v1/developments`).
   - **Ingestion Pipeline:** Modified `ingestion-service.js` to accept `development_id` as metadata, upsert development content to Pinecone with `development_id` and `client_id`, and ensure `development_id` is included in Pinecone entries for associated listings.
   - **RAG Service:** Updated `rag-service.js` to consider `development_id` during retrieval, performing targeted searches for developments and combining results with listing-specific and broad searches, with adjusted re-ranking.
- **Flexible, Client-Configurable Metadata Extraction Implemented:** `ingestion-service.js` now uses client-defined regex patterns from `client-abc.json` to accurately extract `listings.name` and `listings.baths` from document content during ingestion.
- **Structured Metadata Extraction Implemented:** `ingestion-service.js` extracts and stores structured metadata (e.g., `num_bedrooms`, `total_area_sqm`, `price_eur`, boolean features) from documents during ingestion.
- **Chatbot System Instruction Refined:** `client-abc.json`'s `systemInstruction` was updated for more direct and professional chatbot responses.
- **Context Passing Mechanism Updated:** The HTML snippet for iframe context injection was updated with a `setTimeout` to improve reliability.
- **Supabase Integration for Visitor Data:** Replaced in-memory visitor data storage with persistent storage in Supabase. This involved:
   - Installing `@supabase/supabase-js` in the backend.
   - Configuring Supabase client with environment variables (`SUPABASE_URL`, `SUPABASE_ANON_KEY`).
   - Modifying `visitor-service.js` to use Supabase for `createVisitor`, `logEvent`, and `getVisitor` operations.
   - Troubleshooting issues related to environment variable loading, Supabase table schema (`updated_at` column), and Row Level Security (RLS) policies.
   - Correcting asynchronous handling in `index.js` for the `/v1/sessions` endpoint.
- **Dashboard Overview Tab Refactoring:** The `OverviewTab` component and its sub-components (`MetricCard`, `HotLeadsAlert`, `ChartPlaceholder`, `TopListings`) have been refactored into separate files within `packages/frontend/src/dashboard/overview-tab` for better maintainability.
- **Dashboard Overview Tab Metrics Refactoring:** The individual metric components (`TotalLeadsGeneratedMetric`, `ChatbotResolutionRateMetric`, `NewHotLeadsMetric`, `AvgChatDurationMetric`, `PropertyViewingsBookedMetric`, `UnansweredQuestionsMetric`) have been refactored into separate files within `packages/frontend/src/dashboard/overview-tab/metrics` for better organization and maintainability.
- **Lead Score Distribution Chart Implemented:** A Pie chart displaying the percentage of Hot, Warm, and Cold leads is now integrated into the dashboard, fetching data from the `listing_metrics` table.
- **Total Leads Generated Metric Populated:** The `TotalLeadsGeneratedMetric` component now dynamically displays the sum of all hot, warm, and cold leads from the `listing_metrics` table.
- **"New Hot Leads" Tracking Implemented:**
    - `is_acknowledged` column added to the `visitors` table.
    - `unacknowledged_hot_leads` column in `listing_metrics` table tracks new hot leads.
    - Backend API (`POST /v1/leads/acknowledge`) and `visitor-service.js` logic implemented to mark hot leads as acknowledged.
    - Frontend components (`NewHotLeadsMetric.jsx`, `HotLeadsAlert.jsx`, `OverviewTab.jsx`) count and display unacknowledged hot leads, and trigger acknowledgment.
    - `listing_id` column removed from `visitors` table and added to `events` table for granular tracking of interactions.
- **Conversion Rate Metric Implemented:**
    - Backend logic in `visitor-service.js` updated to track `engaged_users` (unique visitors per listing) and `total_conversions` (sum of conversion actions).
    - `conversion_rate` calculation updated to `total_conversions / engaged_users`.
    - Frontend component `packages/frontend/src/dashboard/listing-performance-tab/components/OverallListingPerformance.jsx` updated to display these new metrics in a sortable, paginated table.

- **Client and User Management Implementation:**
    - **Database Schema:** Created `clients` table (for client configurations), `users` table (for admins/promoters), and `agent_listings` table (to link promoters to specific listings).
    - **Client Configuration Migration:** Implemented and executed `packages/backend/scripts/migrate-client-configs-to-db.js` to migrate client configurations from JSON files to the new `clients` table in the database.
    - **Backend Services Update:**
        - Modified `packages/backend/src/services/client-config-service.js` to fetch client configurations from the `clients` table.
        - Created `packages/backend/src/services/user-service.js` for user management (CRUD operations, agent-listing assignments).
        - Added new API endpoints in `packages/backend/src/index.js` for user management.
        - Modified `packages/backend/src/rag-service.js` to support user/agent filtering during Pinecone retrieval, ensuring agents only access their assigned listings.
- **Client Ingestion Configuration Refactoring:**
    - Split the `ingestion_pipeline` column in the Supabase `clients` table into two new JSONB columns: `chunking_rules` and `tagging_rules`.
    - Updated frontend components (`packages/frontend/src/dashboard/admin-dashboard/ClientManagementTab.jsx`, `packages/frontend/src/dashboard/admin-dashboard/components/EditClientForm.jsx`) to use the new `chunking_rules` and `tagging_rules` fields, and removed references to the old `ingestion_pipeline` field.
    - Created new React components `ChunkingRulesEditor.jsx` and `TaggingRulesEditor.jsx` to manage these new fields in the admin dashboard.
- **Knowledge Base Re-upsert & Embedding Model Update:**
    - Resolved `ENOENT` error by clarifying the location of `05-versions-space.pdf` (manual placement by user).
    - Fixed `TypeError: pdf is not a function` by correctly importing and passing the `pdf-parse` function.
    - Updated the embedding model in `ingestion-service.js` from Google's `text-embedding-004` to OpenAI's `text-embedding-3-small` to match the Pinecone index dimension (1536). All knowledge base documents were successfully re-upserted.

## Next Steps
- **Test Chatbot Functionality:** Verify that the chatbot can now correctly answer aggregative price queries (e.g., "qual é o preço mais barato?", "qual é o preço mais caro?").
- **Client Dashboard Implementation:**
    - **Phase 1 (Current Focus):**
        - Connect to Supabase (Frontend - Initial): Directly fetch existing visitor data from Supabase within Dashboard.jsx to replace fake data.
        - Refine `listings.name` extraction: **COMPLETED**
        - Refine `listings.baths` extraction: **COMPLETED**
        - Populate `listing_metrics` table: **COMPLETED**
        - Implement mechanism to update `listing_metrics` based on real visitor interactions: **COMPLETED**
    - **Phase 2 (Future):** Backend API Development: Develop new backend API endpoints in `packages/backend` for aggregated and filtered dashboard data, ensuring client-specific and agent-specific filtering.
    - **Future Client Dashboard Enhancement:** When inserting or updating a listing, the dashboard will include dropdowns for `listing_status` (options: 'available', 'reserved', 'sold') and `current_state` (options: 'project', 'building', 'finished') to populate these columns in the `listings` table.
    - **Phase 3 (Future):** Refine Frontend Data Fetching: Update the frontend to consume data from the new backend APIs.
    - **Phase 4 (Future):** Implement Authentication/Authorization: Implement robust authentication for dashboard users (agents) and authorization (admin user can access all agent data, agent user filtered by client_id and agent_id).
    - **Phase 5 (Future):** Implement Dynamic Language Switching: Integrate i18n for PT-PT and EN language support.
    - **Phase 6 (Future):** Ensure atomic updates to `listing_metrics` to prevent race conditions.
- **RAG Pipeline Enhancements:**
    - Optimize LLM Prompts: Continue refining prompts to ensure comprehensive and accurate answers, particularly for aggregative queries.
    - Re-enable Suggested Questions (Future): Once core RAG functionality is stable, re-enable and optimize the suggested questions feature.
- **Data Management:**
    - Data Gaps: Address information regarding "horário de funcionamento do escritório" (office hours) and explicit "jardim" (garden) features.
    - URL-to-listing_id Validation: Still on hold, detailed plan in `tasks.md`.
- **General Improvements:**
    - Ensure Consistent Context Passing: Further debug the frontend-to-iframe `postMessage` mechanism to guarantee consistent context delivery, as some inconsistencies were observed.
- **Future Enhancements:**
    - **NLP Analysis for Chat History Tagging:** Implement advanced NLP techniques (e.g., named entity recognition, topic modeling) to automatically generate richer, more granular tags for chat messages, enhancing context-aware retrieval.
- **Troubleshoot Ingestion Service Unit Test Failures:** Investigate and fix the `AssertionError` failures in `packages/backend/test/unit/ingestion.test.js` related to `mockExtractText.calledOnce` and `mockPineconeIndex.upsert.called`.

## Current Dashboard Implementation Status
The dashboard is now correctly displaying the "New Hot Leads" metric. The previous issues with Tailwind CSS and Supabase schema have been resolved.

### Current Todo List for New Dashboard Implementation:
- [x] Plan new client dashboard implementation from scratch
- [x] Create new dashboard component file (e.g., `packages/frontend/src/dashboard/NewDashboard.jsx`)
- [x] Implement basic structure and layout based on reference image
- [x] Refactor `OverviewTab` and its sub-components into separate files.
- [x] Refactor individual metric components into separate files within `packages/frontend/src/dashboard/overview-tab/metrics`.
- [x] Integrate Supabase data fetching for visitors, listings, and metrics
- [x] Populate dashboard fields with actual data
- [ ] Implement dynamic styling based on client configuration
- [ ] Implement dynamic content per tab based on client configuration
- [x] Update routing in `packages/frontend/src/main.jsx` to use the new dashboard component
- [x] Verify new dashboard functionality and appearance