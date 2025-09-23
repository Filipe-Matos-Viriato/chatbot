// packages/backend/src/config/pinecone.js
// Configuration module for Pinecone vector database client initialization.
// To provide a centralized way to connect to Pinecone for vector storage and retrieval operations.
// Relevant files: rag-service.js, config/openai.js

import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

export default pinecone;
