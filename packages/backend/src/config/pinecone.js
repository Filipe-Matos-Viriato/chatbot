import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

// Ensure .env is loaded for scripts and local dev
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const apiKey = process.env.PINECONE_API_KEY;

let pinecone = null;
if (!apiKey) {
  console.warn('[Pinecone] PINECONE_API_KEY is not set; RAG retrieval will be disabled.');
} else {
  pinecone = new Pinecone({ apiKey });
}

export default pinecone;


