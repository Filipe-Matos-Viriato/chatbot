# New Chatbot Sandbox

A standalone playground to build and test a new chatbot architecture locally using the same stack (Node/Express, OpenAI, Pinecone, Supabase, React/Vite) without touching the main app.

## Structure

- backend/ — Express API with minimal RAG pipeline
- frontend/ — Vite + React minimal chat UI

## Setup

1) Backend

- Copy `.env.example` to `.env` and fill values:
  - OPENAI_API_KEY, PINECONE_API_KEY, SUPABASE_URL, SUPABASE_ANON_KEY
  - Optional: PINECONE_INDEX (default rachatbot-1536), PINECONE_NAMESPACE
- Install deps and run:

Commands:
- cd sandbox/new-chatbot/backend
- npm i
- npm run dev

Backend runs on http://localhost:4107.

2) Frontend

Commands:
- cd sandbox/new-chatbot/frontend
- npm i
- npm run dev

Frontend dev server runs on http://localhost:5173 and calls backend at http://localhost:4107.

## Customize

- Iterate on `backend/src/index.js` to plug your new RAG flow (retrieval strategies, rerank, prompts, etc.).
- Add your own routes, services, and data models as needed.
- Keep DB isolation by using separate Supabase schema or tables/namespace.

## Notes

- This sandbox is intentionally minimal and isolated (different ports, separate env).
- You can duplicate or import logic from the main app incrementally.
