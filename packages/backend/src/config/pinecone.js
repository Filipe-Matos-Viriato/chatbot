/**
 * @fileoverview Configuration for Pinecone vector database.
 * @filelocation packages/backend/src/config/pinecone.js
 * @description Initializes and exports the Pinecone client for vector storage and retrieval.
 */

import { Pinecone } from '@pinecone-database/pinecone';

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

export default pinecone;
