/**
 * @fileoverview Script to re-upsert the knowledge base for a specific client to Pinecone.
 * This script directly uses the ingestion-service to process documents.
 * @filelocation packages/backend/scripts/re-upsert-knowledge-base.js
 * @description This script automates the re-ingestion of knowledge base documents for a given client into the Pinecone vector database. It's useful for updating or refreshing the knowledge base.
 * @why This script exists to provide a direct, programmatic way to re-upsert documents, bypassing the API for specific administrative tasks.
 * @relevant_files packages/backend/src/services/ingestion-service.js, packages/backend/test-data, packages/backend/.env
 */

import 'dotenv/config'; // Loads .env from root or current directory
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { processDocument, extractText } from '../src/services/ingestion-service.js';
import { getClientConfig } from '../src/services/client-config-service.js';
import pdfParse from 'pdf-parse'; // Import the pdf-parse function

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const TEST_DATA_DIR = path.join(__dirname, '..', 'test-data');

// Use environment variables directly
const PINECONE_INDEX_NAME = process.env.PINECONE_INDEX_NAME;
// Handle "( Default )" namespace by converting to empty string for Pinecone
const PINECONE_NAMESPACE = process.env.PINECONE_NAMESPACE === '( Default )' ? '' : process.env.PINECONE_NAMESPACE;

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

    const files = fs.readdirSync(TEST_DATA_DIR);

    for (const file of files) {
      const filePath = path.join(TEST_DATA_DIR, file);
      const fileBuffer = fs.readFileSync(filePath);
      const originalname = file;

      let documentCategory = 'general';
      let metadata = {};

      // Determine if it's a listing document based on filename pattern
      if (originalname.toLowerCase().startsWith('ap-') && originalname.toLowerCase().endsWith('.pdf')) {
        documentCategory = 'listing';
        const match = originalname.toLowerCase().match(/ap-\d+/);
        if (match) {
          metadata.listing_id = match[0];
          metadata.listing_url = `https://html.viriatoeviriato.com/ar/imoprime/${match[0]}.html`;
        }
      } else if (originalname.toLowerCase().includes('imoprime') && originalname.toLowerCase().endsWith('.pdf')) {
        documentCategory = 'general';
      }

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