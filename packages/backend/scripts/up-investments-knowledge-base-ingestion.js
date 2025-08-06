
/**
 * @fileoverview Script to re-upsert the knowledge base for a specific client to Pinecone.
 * This script directly uses the ingestion-service to process documents.
 * @filelocation packages/backend/scripts/up-investments-knowledge-base-ingestion.js
 * @description This script automates the re-ingestion of knowledge base documents for a given client into the Pinecone vector database. It's useful for updating or refreshing the knowledge base.
 * @why This script exists to provide a direct, programmatic way to re-upsert documents, bypassing the API for specific administrative tasks.
 * @relevant_files packages/backend/src/services/ingestion-service.js, packages/backend/client-data/Up Investments/knowledge-base, packages/backend/.env
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processDocument, extractText } from '../src/services/ingestion-service.js';
import { getClientConfig } from '../src/services/client-config-service.js';
import pdfParse from 'pdf-parse';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');
const envFile = fs.readFileSync(envPath, 'utf8');
const envConfig = Object.fromEntries(
  envFile.split('\n').map(line => {
    const [key, ...value] = line.split('=');
    return [key, value.join('=')];
  })
);

// Set environment variables for other modules
process.env.SUPABASE_URL = envConfig.SUPABASE_URL;
process.env.SUPABASE_ANON_KEY = envConfig.SUPABASE_ANON_KEY;
process.env.PINECONE_API_KEY = envConfig.PINECONE_API_KEY;
process.env.OPENAI_API_KEY = envConfig.OPENAI_API_KEY;
process.env.PINECONE_INDEX_NAME = envConfig.PINECONE_INDEX_NAME;
process.env.PINECONE_NAMESPACE = envConfig.PINECONE_NAMESPACE;

const CLIENT_ID = 'up-investments';
const DATA_DIR = path.join(__dirname, '..', 'client-data', 'Up Investments', 'knowledge-base');

/**
 * Main function to re-upsert the knowledge base.
 */
const reUpsertKnowledgeBase = async () => {
  console.log(`Starting re-upsert for client_id: ${CLIENT_ID} to Pinecone index: ${PINECONE_INDEX_NAME} namespace: '${PINECONE_NAMESPACE}'`);

  try {
    const clientConfig = await getClientConfig(CLIENT_ID);
    if (!clientConfig) {
      console.error(`Client configuration not found for client_id: ${CLIENT_ID}`);
      return;
    }
    console.log(`Client config loaded for ${clientConfig.clientName || CLIENT_ID}`);

    const files = fs.readdirSync(DATA_DIR);

    for (const file of files) {
      const filePath = path.join(DATA_DIR, file);
      const fileBuffer = fs.readFileSync(filePath);
      const originalname = file;

      let documentCategory = 'general';
      let metadata = {};

      console.log(`Processing file: ${originalname} (Category: ${documentCategory})`);
      const result = await processDocument({
        clientConfig,
        file: { buffer: fileBuffer, originalname },
        documentCategory,
        metadata,
      }, { extractText, pdf: pdfParse, fs, path }); // Pass extractText, pdfParse function, fs, and path as dependencies

      if (result.success) {
        console.log(`Successfully processed ${originalname}`);
      } else {
        console.error(`Failed to process ${originalname}: ${result.message}`);
      }
    }
    console.log('Re-upsert process completed.');
  } catch (error) {
    console.error('An error occurred during re-upsert:', error);
  }
};

reUpsertKnowledgeBase();
