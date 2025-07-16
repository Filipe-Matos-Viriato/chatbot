# Project Context

## Current Work Focus
The primary focus is on refining the RAG (Retrieval-Augmented Generation) pipeline to ensure accurate and complete answers for both general and context-specific queries, particularly for attribute-based and comparative questions.

## Recent Changes
- **Resolved `ap-01` Price Accuracy:** The chatbot now correctly provides price information for specific listings.
- **Enhanced `extractQueryFilters`:** `extractQueryFilters` in `rag-service.js` now correctly handles comparative queries for `num_bedrooms` (e.g., "mais de X quartos").
- **Improved RAG Strategy in `rag-service.js`:**
    - Implemented a strategy to **always perform both targeted and broad searches** when a `listing_id` context is present.
    - Results from both searches are combined and re-ranked to ensure comprehensive context for the LLM. This allows comparative queries and general information requests to be answered correctly even on specific listing pages.
- **Structured Metadata Extraction Implemented:** `ingestion-service.js` extracts and stores structured metadata (e.g., `num_bedrooms`, `total_area_sqm`, `price_eur`, boolean features) from documents during ingestion.
- **Chatbot System Instruction Refined:** `client-abc.json`'s `systemInstruction` was updated for more direct and professional chatbot responses.
- **Context Passing Mechanism Updated:** The HTML snippet for iframe context injection was updated with a `setTimeout` to improve reliability.

## Next Steps
- **Lead Scoring & Visitor Tracking System:** Backend implemented (Phase 1 complete). Frontend integration (Phase 2) for visitor ID management and event publishing is implemented in the chat widget, but the form submission issue needs further debugging. Cross-domain link enhancement is a future task.
- **Data Gaps:** Information regarding "horário de funcionamento do escritório" (office hours) and explicit "jardim" (garden) features is not present in the current ingested documents. This is a data limitation, not a retrieval issue.
- **Ensure Consistent Context Passing:** Further debug the frontend-to-iframe `postMessage` mechanism to guarantee consistent context delivery, as some inconsistencies were observed.
- **Optimize LLM Prompts:** Continue refining prompts to ensure comprehensive and accurate answers, particularly for aggregative queries.
- **Re-enable Suggested Questions (Future):** Once core RAG functionality is stable, re-enable and optimize the suggested questions feature.
- **URL-to-listing_id Validation:** Still on hold, detailed plan in `tasks.md`.