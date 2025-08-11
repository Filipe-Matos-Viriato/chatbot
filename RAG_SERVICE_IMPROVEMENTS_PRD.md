## RAG Service Simplification & Optimization PRD

### Goals
- Simplify retrieval-augmented generation (RAG) pipeline for maintainability
- Improve retrieval precision/recall and reduce latency/cost
- Strengthen safety/guardrails and observability

### Non-goals
- Major frontend protocol changes (e.g., streaming UI or response shape changes) in this phase
- Migrating the codebase to TypeScript (can be future work)

### Current State (summary)
- Multiple Pinecone queries (4-way fanout), then heuristic re-ranking
- Duplicated query/url parsing logic across `rag-service.js` and `index.js`
- Mixed metadata text keys (`text|chunk|content|body|page_text`)
- Ad-hoc logging, limited timeout/retry handling

### Proposed Changes (high level)
1) Architecture: modularize and deduplicate
2) Retrieval: consolidate to 2 queries with timeouts; optional hybrid/rerank
3) Re-ranking: extract module; enable advanced rerankers later
4) Context: normalize text extraction and add citations plumbed internally
5) Prompting: robust templating and token accounting
6) Observability: structured logs with timings and retrieval stats

### Milestones & Tasks

Milestone A — Foundations
- A1. Create PRD (this file) and track tasks
- A2. Extract shared parsing utilities: `extractListingIdFromUrl`, `extractListingIdFromQuery`, `isAggregativePriceQuery`
- A3. Refactor `rag-service.js` and `index.js` to use shared utilities

Milestone B — Retrieval consolidation & resilience
- B1. Introduce request-level timeouts for Pinecone and OpenAI calls
- B2. Add a 2-query retrieval path (targeted + broad) behind a config flag; default to 2-query
- B3. Reduce broad `topK` to 30 (configurable), rely on reranker for precision

Milestone C — Re-ranking module
- C1. Extract current heuristic re-ranking into `reRankMatches()` helper with clear inputs/outputs
- C2. Add interface to plug a cross-encoder reranker later without code churn

Milestone D — Context building & safety
- D1. Centralize text picking from metadata in a `pickText(meta)` helper
- D2. Add lightweight citations list internally (ids/urls) surfaced in logs (no API change yet)

Milestone E — Prompting & tokens
- E1. Add small templating utility to safely render the system prompt (escape braces)
- E2. Ensure tokenizer parity with the generation model (keep `gpt-3-encoder` or swap when needed)

Milestone F — Observability
- F1. Add structured logging helper with step timings and retrieval stats

Future Work (not in this phase)
- Cross-encoder reranker adoption (e.g., Cohere Rerank or OpenAI re-ranking)
- Streaming responses end-to-end (API + widget)
- Rich response envelope with citations for the frontend

### Acceptance Criteria
- Unit-tested helpers for parsing, re-ranking, context text picking, and prompt rendering
- Measurable latency reduction (>15% vs. baseline) under typical queries
- No loss in answer quality based on sampled manual evaluation (>= baseline)


