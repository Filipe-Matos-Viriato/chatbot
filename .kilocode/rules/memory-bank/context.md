# Project Context

## Current Work Focus
The primary focus is on refining the RAG (Retrieval-Augmented Generation) pipeline to ensure accurate and complete answers for both general and context-specific queries, particularly for attribute-based and comparative questions. The Supabase integration for persistent visitor data storage has been successfully completed.

## Recent Changes
- **Resolved `ap-01` Price Accuracy:** The chatbot now correctly provides price information for specific listings.
- **Enhanced `extractQueryFilters`:** `extractQueryFilters` in `rag-service.js` now correctly handles comparative queries for `num_bedrooms` (e.g., "mais de X quartos").
- **Improved RAG Strategy in `rag-service.js`:**
    - Implemented a strategy to **always perform both targeted and broad searches** when a `listing_id` context is present.
    - Results from both searches are combined and re-ranked to ensure comprehensive context for the LLM. This allows comparative queries and general information requests to be answered correctly even on specific listing pages.
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

## Next Steps
- **Client Dashboard Implementation:**
    - **Phase 1 (Current Focus):**
        - Connect to Supabase (Frontend - Initial): Directly fetch existing visitor data from Supabase within Dashboard.jsx to replace fake data.
        - Refine `listings.name` extraction: **COMPLETED**
        - Refine `listings.baths` extraction: **COMPLETED**
        - Populate `listing_metrics` table: **COMPLETED**
        - Implement mechanism to update `listing_metrics` based on real visitor interactions: **COMPLETED**
    - **Phase 2 (Future):** Backend API Development: Develop new backend API endpoints in `packages/backend` for aggregated and filtered dashboard data, ensuring client-specific and agent-specific filtering.
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

## Current Dashboard Implementation Status
We are currently facing persistent issues with Tailwind CSS not applying styles to the client dashboard, despite extensive troubleshooting. The `postcss` error persists, and the layout is not rendering correctly. We have decided to rebuild the dashboard from scratch to ensure a clean and functional implementation.

### Persistent Tailwind CSS Issue
Despite numerous attempts to resolve the issue, including:
- Correcting `postcss.config.js` syntax (`module.exports` vs `export default`).
- Ensuring `index.css` is imported in `main.jsx`.
- Installing `@tailwindcss/vite` plugin.
- Performing clean `npm install` operations.
- Verifying `tailwind.config.js` content paths.
- Testing with simplified components.

Tailwind CSS utility classes are still not being processed and applied to the frontend components. The `index.css` file itself is being loaded (as evidenced by global CSS rules applying), but the `@tailwind` directives are not being transformed into functional CSS. This indicates a deeper, unresolved issue with Vite's PostCSS integration or a conflict within the build pipeline.

### Current Todo List for New Dashboard Implementation:
- [x] Plan new client dashboard implementation from scratch
- [x] Create new dashboard component file (e.g., `packages/frontend/src/dashboard/NewDashboard.jsx`)
- [x] Implement basic structure and layout based on reference image
- [x] Refactor `OverviewTab` and its sub-components into separate files.
- [x] Refactor individual metric components into separate files within `packages/frontend/src/dashboard/overview-tab/metrics`.
- [ ] Integrate Supabase data fetching for visitors, listings, and metrics
- [ ] Populate dashboard fields with actual data
- [ ] Implement dynamic styling based on client configuration
- [ ] Implement dynamic content per tab based on client configuration
- [x] Update routing in `packages/frontend/src/main.jsx` to use the new dashboard component
- [x] Verify new dashboard functionality and appearance