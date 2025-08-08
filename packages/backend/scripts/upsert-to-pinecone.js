/**
 * @fileoverview Script to upsert Up Investments listing data to Pinecone
 * @filelocation packages/backend/scripts/upsert-to-pinecone.js
 * @description This script reads JSON files from the Up Investments knowledge base,
 * creates a contextual string for each, generates an embedding, and upserts it to Pinecone.
 */

// Load the backend .env explicitly so OPENAI_API_KEY/PINECONE_API_KEY are available
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename_env = fileURLToPath(import.meta.url);
const __dirname_env = path.dirname(__filename_env);
dotenv.config({ path: path.resolve(__dirname_env, '../.env') });
import fs from 'fs/promises';
// reuse path and fileURLToPath already imported
import { getEmbedding } from '../src/config/openai.js';
import pinecone from '../src/config/pinecone.js';
import { getClientConfig } from '../src/services/client-config-service.js';
import * as developmentService from '../src/services/development-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const CLIENT_ID = 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c'; // Up Investments client_id
const KNOWLEDGE_BASE_PATH = path.join(__dirname, '../client-data/Up Investments/knowledge-base');
const EVERGREEN_PURE_DEV_NAME = "Evergreen Pure";

/**
 * Main function to create and upsert vectors to Pinecone
 */
async function upsertToPinecone() {
  console.log('🚀 Starting Pinecone upsert for Up Investments listings...');
  
  try {
    // Get client configuration
    const clientConfig = await getClientConfig(CLIENT_ID);
    if (!clientConfig) {
      console.error(`Client configuration not found for client ID: ${CLIENT_ID}`);
      return;
    }
    console.log(`📋 Client config loaded for: ${clientConfig.clientName || CLIENT_ID}`);

    // Read all files from knowledge base directory
    const files = await fs.readdir(KNOWLEDGE_BASE_PATH);
    console.log(`📁 Found ${files.length} files in knowledge base directory`);
    
    // Filter only JSON files that match the apartment naming pattern
    const apartmentFiles = files.filter(filename => {
      const fileExtension = path.extname(filename).toLowerCase();
      const baseFilename = path.basename(filename, fileExtension);
      return fileExtension === '.json' && baseFilename.match(/^\d+_[a-h]$/);
    });
    
    console.log(`🏠 Found ${apartmentFiles.length} apartment JSON files`);
    
    let successCount = 0;
    let errorCount = 0;

    // Process each apartment file
    for (const filename of apartmentFiles) {
        console.log(`\n📄 Processing ${filename}...`);

        try {
            const filePath = path.join(KNOWLEDGE_BASE_PATH, filename);
            const fileContent = await fs.readFile(filePath, 'utf-8');
            const apartmentData = JSON.parse(fileContent);

            // Derive listingId from the URL
            const url_pt = apartmentData.url_pt;
            if (!url_pt) {
              console.error(`  ❌ Error: Missing 'url_pt' in ${filename}. Skipping.`);
              errorCount++;
              continue;
            }
            const listingId = url_pt.split('/').pop();

            // Construct listingName from other fields
            const listingName = `Apartamento ${apartmentData.tipologia || ''} ${apartmentData.fracao || ''}`;

            // Extract price and URLs
            const priceString = apartmentData.preco || apartmentData.preço || '0€';
            const price = parseFloat(priceString.replace('€', '').replace(',', ''));
            const url_en = apartmentData.url_en || '';
            const area = apartmentData.area_bruta_m2 || apartmentData.area_privativa_m2 || 0;
            const tipologia = apartmentData.tipologia || '';
            
            // Create a rich contextual string for the embedding
            const contextualString = `${listingName}. Tipologia: ${tipologia}, Área: ${area} m², Preço: €${price.toLocaleString()}. URL: ${url_pt}`;
            
            console.log(`  📝 Contextual String: "${contextualString}"`);

            // Get embedding for the contextual string
            const embedding = await getEmbedding(contextualString);
            
            // Prepare metadata for Pinecone
            const metadata = {
                document_id: listingId,
                document_name: listingName,
                document_category: 'listing',
                client_id: CLIENT_ID,
                listing_id: listingId,
                url_pt,
                url_en,
                chunk: contextualString,
                chunk_index: 0,
                created_at: new Date().toISOString()
            };
            
            // Create Pinecone record
            const record = {
                id: `${CLIENT_ID}_${listingId}_0`,
                values: embedding,
                metadata: metadata
            };
            
            // Upsert to Pinecone (v2 client)
            const index = pinecone.index(clientConfig.pineconeIndex || 'rachatbot-1536');
            await index.upsert([record], { namespace: CLIENT_ID });
            
            console.log(`  ✅ Successfully upserted vector for ${listingName}`);
            successCount++;

        } catch (vectorError) {
            console.error(`  ❌ Error processing vector for ${filename}:`, vectorError);
            errorCount++;
        }
    }
    
    console.log('\n=== 🌲 PINECONE UPSERT SUMMARY ===');
    console.log(`🔄 Total files processed: ${apartmentFiles.length}`);
    console.log(`✅ Successful upserts: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('🎉 Pinecone upsert completed!');
    
  } catch (error) {
    console.error('💥 Error during Pinecone upsert:', error);
    process.exit(1);
  }
}

// Execute the upsert
upsertToPinecone();
