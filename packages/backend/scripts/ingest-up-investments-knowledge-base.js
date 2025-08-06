/**
 * @fileoverview Script to ingest Up Investments knowledge base files to Pinecone.
 * This script processes only files from the Up Investments knowledge-base directory.
 * @filelocation packages/backend/scripts/ingest-up-investments-knowledge-base.js
 * @description This script automates the ingestion of Up Investments knowledge base documents into the Pinecone vector database.
 * @why This script exists to provide a clean, focused ingestion process for Up Investments data only.
 * @relevant_files packages/backend/src/services/ingestion-service.js, packages/backend/client-data/Up Investments/knowledge-base
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { processDocument, extractText } from '../src/services/ingestion-service.js';
import { getClientConfig } from '../src/services/client-config-service.js';
import * as developmentService from '../src/services/development-service.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CLIENT_ID = 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c'; // Up Investments client_id
const KNOWLEDGE_BASE_PATH = path.join(__dirname, '../client-data/Up Investments/knowledge-base');
const EVERGREEN_PURE_DEV_NAME = "Evergreen Pure";

/**
 * Get or create development record for Evergreen Pure
 */
const getOrCreateDevelopment = async (clientId, developmentName) => {
  const developments = await developmentService.getDevelopmentsByClientId(clientId);
  let development = developments.find(dev => dev.name === developmentName);

  if (development) {
    console.log(`Found existing development: ${developmentName} with ID: ${development.id}`);
    return development.id;
  } else {
    const newDevId = uuidv4();
    console.log(`Creating new development: ${developmentName} with ID: ${newDevId}`);
    development = await developmentService.createDevelopment({
      id: newDevId,
      name: developmentName,
      client_id: clientId,
    });
    return development.id;
  }
};

/**
 * Main ingestion function for Up Investments knowledge base
 */
const ingestUpInvestmentsKnowledgeBase = async () => {
  console.log(`Starting Up Investments knowledge base ingestion for client: ${CLIENT_ID}`);
  console.log(`Target index: rachatbot-1536`);
  
  try {
    // Get client configuration
    const clientConfig = await getClientConfig(CLIENT_ID);
    if (!clientConfig) {
      console.error(`Client configuration not found for client ID: ${CLIENT_ID}`);
      return;
    }
    console.log(`Client config loaded for: ${clientConfig.clientName || CLIENT_ID}`);

    // Get or create Evergreen Pure development
    const evergreenPureDevId = await getOrCreateDevelopment(CLIENT_ID, EVERGREEN_PURE_DEV_NAME);
    console.log(`Evergreen Pure Development ID: ${evergreenPureDevId}`);

    // Read all files from knowledge base directory
    const files = await fs.readdir(KNOWLEDGE_BASE_PATH);
    console.log(`Found ${files.length} files in knowledge base directory`);

    let processedCount = 0;
    let skippedCount = 0;

    for (const filename of files) {
      // Skip DOCX files (PDFs are preferred)
      if (filename.endsWith('.docx')) {
        console.log(`Skipping DOCX file: ${filename} (PDF version preferred)`);
        skippedCount++;
        continue;
      }

      const filePath = path.join(KNOWLEDGE_BASE_PATH, filename);
      const fileExtension = path.extname(filename).toLowerCase();
      const baseFilename = path.basename(filename, fileExtension);

      // Determine document category and metadata based on filename
      let documentCategory = 'general';
      let metadata = {};

      if (baseFilename.match(/^\d+_[a-h]$/)) {
        // Listing files (e.g., 1_a.json, 2_h.json)
        documentCategory = 'listing';
        metadata.development_id = evergreenPureDevId;
        metadata.listing_id = baseFilename; // Use the filename as listing ID
      } else if (baseFilename.includes('Evergreen')) {
        // Development-specific files
        documentCategory = 'development';
        metadata.development_id = evergreenPureDevId;
      } else if (baseFilename.includes('upinvestments')) {
        // Company information files
        documentCategory = 'company_info';
      } else if (filename.endsWith('.pdf') && baseFilename.includes('Evergreen - Lifestyle')) {
        // Lifestyle documents (PDFs only)
        documentCategory = 'lifestyle';
        metadata.development_id = evergreenPureDevId;
      } else if (baseFilename.startsWith('info_')) {
        // Info files
        documentCategory = 'development';
        if (baseFilename.includes('Evergreen')) {
          metadata.development_id = evergreenPureDevId;
        }
      }

      console.log(`Processing file: ${filename} (Category: ${documentCategory})`);

      try {
        const fileBuffer = await fs.readFile(filePath);
        const fileObject = {
          buffer: fileBuffer,
          originalname: filename,
        };

        const result = await processDocument({
          clientConfig,
          file: fileObject,
          documentCategory,
          metadata,
        }, { extractText });

        if (result.success) {
          console.log(`✅ Successfully processed: ${filename}`);
          processedCount++;
        } else {
          console.error(`❌ Failed to process ${filename}: ${result.message}`);
        }
      } catch (fileError) {
        console.error(`❌ Error reading or processing file ${filename}:`, fileError);
      }
    }

    console.log('\n=== INGESTION SUMMARY ===');
    console.log(`Total files found: ${files.length}`);
    console.log(`Successfully processed: ${processedCount}`);
    console.log(`Skipped: ${skippedCount}`);
    console.log(`Errors: ${files.length - processedCount - skippedCount}`);
    console.log('Up Investments knowledge base ingestion completed.');

  } catch (error) {
    console.error('Error during Up Investments knowledge base ingestion:', error);
  }
};

// Execute the ingestion
ingestUpInvestmentsKnowledgeBase();