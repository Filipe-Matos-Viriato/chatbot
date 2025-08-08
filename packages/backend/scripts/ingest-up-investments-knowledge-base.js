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
import { processDocument, extractText } from '../src/services/ingestion-service-imoprime.js';
import { getClientConfig } from '../src/services/client-config-service.js';
import * as developmentService from '../src/services/development-service.js';
import { v4 as uuidv4 } from 'uuid';
import supabase from '../src/config/supabase.js';

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

          const match = baseFilename.match(/^(\d+)_([a-h])$/);
        if (match) {
          documentCategory = 'listing';
          metadata.development_id = evergreenPureDevId;
          const block = match[1];
          const apartment = match[2];
          metadata.listing_id = `block_${block}_apt_${apartment}`; // Standardize listing_id

          // Create a rich contextual string and extract URLs
          const filePath = path.join(KNOWLEDGE_BASE_PATH, filename);
          const fileContent = await fs.readFile(filePath, 'utf-8');
          const listingData = JSON.parse(fileContent);
          
          // Extract price from the JSON (may be in 'preço' or 'preco' field)
          const price = listingData.preco || listingData.preço || (listingData.preço ? listingData.preço.replace('€', '') : null);
          
          // Extract URLs
          if (listingData.url_pt) metadata.url_pt = listingData.url_pt;
          if (listingData.url_en) metadata.url_en = listingData.url_en;
          
          // Create listing ID and name for database
          const listingId = `block_${block}_apt_${apartment.toUpperCase()}`;
          const listingName = `Apartamento ${listingData.tipologia} no bloco ${block}, Fração ${apartment.toUpperCase()}`;
          
          // Store ID and name in metadata for database insertion
          metadata.listing_id = listingId;
          metadata.listing_name = listingName;
          
          // Rich contextual string for vector search
          metadata.contextual_string = `Apartamento ${listingData.tipologia} no bloco ${block}, Fração ${apartment.toUpperCase()} com ${listingData.area_bruta_m2} m² por ${price}€. ${listingData.url_pt ? 'URL: ' + listingData.url_pt : ''}`;
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

        // Insert or update the listing in the database if it's a listing type
        if (documentCategory === 'listing') {
          try {
            // Check if listing already exists
            const { data: existingListing, error: queryError } = await supabase
              .from('listings')
              .select('id')
              .eq('id', metadata.listing_id)
              .single();
            
            if (queryError && queryError.code !== 'PGRST116') { // PGRST116 = not found
              console.error(`Error checking if listing exists: ${queryError.message}`);
            }
            
            // Prepare listing data
            const listingData = {
              id: metadata.listing_id,
              name: metadata.listing_name,
              type: 'apartamento',
              price: parseFloat(metadata.price || listingData.preco || listingData.preço?.replace('€', '') || 0),
              beds: parseInt(listingData.tipologia?.replace('T', '') || 0),
              amenities: listingData.descricao?.detalhes_extra || [],
              client_id: CLIENT_ID,
              development_id: evergreenPureDevId,
              listing_status: 'available',
              current_state: 'finished',
              url: listingData.url_pt || ''
            };
            
            // Insert or update listing
            if (!existingListing) {
              const { error: insertError } = await supabase
                .from('listings')
                .insert([listingData]);
              
              if (insertError) {
                console.error(`Error inserting listing: ${insertError.message}`);
              } else {
                console.log(`✅ Inserted listing in database: ${metadata.listing_id}`);
              }
            } else {
              const { error: updateError } = await supabase
                .from('listings')
                .update(listingData)
                .eq('id', metadata.listing_id);
              
              if (updateError) {
                console.error(`Error updating listing: ${updateError.message}`);
              } else {
                console.log(`✅ Updated listing in database: ${metadata.listing_id}`);
              }
            }
          } catch (dbError) {
            console.error(`Error managing listing in database: ${dbError.message}`);
          }
        }
        
        // Process document for vector search
        const result = await processDocument({
          clientConfig,
          file: fileObject,
          documentCategory,
          metadata,
          contextual_string: metadata.contextual_string
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