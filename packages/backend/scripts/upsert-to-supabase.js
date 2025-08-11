/**
 * @fileoverview Script to upsert Up Investments listing data to Supabase
 * @filelocation packages/backend/scripts/upsert-to-supabase.js
 * @description This script reads JSON files from the Up Investments knowledge base
 * and upserts the listing data (with name, id, and other fields) to Supabase
 */

import 'dotenv/config';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import supabase from '../src/config/supabase.js';
import * as developmentService from '../src/services/development-service.js';
import { v4 as uuidv4 } from 'uuid';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
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
 * Main function to upsert listing data to Supabase
 */
async function upsertToSupabase() {
  console.log('🚀 Starting Supabase upsert for Up Investments listings...');
  
  try {
    // Get or create Evergreen Pure development
    const evergreenPureDevId = await getOrCreateDevelopment(CLIENT_ID, EVERGREEN_PURE_DEV_NAME);
    console.log(`📋 Evergreen Pure Development ID: ${evergreenPureDevId}`);

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
        
        const fileExtension = path.extname(filename).toLowerCase();
        const baseFilename = path.basename(filename, fileExtension);
        const match = baseFilename.match(/^(\d+)_([a-h])$/);
        
        if (match) {
                     // Derive listingId from the URL
           const url_pt = apartmentData.url_pt;
           if (!url_pt) {
             console.error(`  ❌ Error: Missing 'url_pt' in ${filename}. Skipping.`);
             errorCount++;
             continue;
           }
           const listingId = url_pt.split('/').pop();
           const url_en = apartmentData.url_en || '';
           
           // Construct listingName from other fields
           const listingName = `Apartamento ${apartmentData.tipologia || ''} ${apartmentData.fracao || ''}`;
          
          // Extract price (handle different price field names)
          const priceString = apartmentData.preco || apartmentData.preço || '0€';
          const price = parseFloat(priceString.replace('€', '').replace(',', ''));
                     
           // Extract other details
          const beds = parseInt(apartmentData.tipologia?.replace('T', '') || 0);
          const area = apartmentData.area_bruta_m2 || apartmentData.area_privativa_m2 || 0;
          const amenities = apartmentData.descricao?.detalhes_extra || [];
          
          // Prepare listing data for database
          const listingData = {
            id: listingId,
            name: listingName,
            type: 'apartamento',
            price: price,
            beds: beds,
            baths: 1, // Default value - could be extracted from JSON if available
            amenities: amenities,
            client_id: CLIENT_ID,
            development_id: evergreenPureDevId,
            listing_status: 'available',
            current_state: 'finished'
          };
          
          console.log(`  📊 ID: ${listingId}`);
          console.log(`  🏷️  Name: ${listingName}`);
          console.log(`  💰 Price: €${price.toLocaleString()}`);
          console.log(`  🌐 URL PT: ${url_pt}`);
          console.log(`  🌐 URL EN: ${url_en}`);
          console.log(`  📐 Area: ${area} m²`);
          
          // Check if listing already exists
          const { data: existingListing, error: queryError } = await supabase
            .from('listings')
            .select('id')
            .eq('id', listingId)
            .single();
          
          if (queryError && queryError.code !== 'PGRST116') { // PGRST116 = not found
            console.error(`  ❌ Error checking if listing exists: ${queryError.message}`);
            errorCount++;
            continue;
          }
          
          // Insert or update listing
          if (!existingListing) {
            const { error: insertError } = await supabase
              .from('listings')
              .insert([listingData]);
            
            if (insertError) {
              console.error(`  ❌ Error inserting listing: ${insertError.message}`);
              errorCount++;
            } else {
              console.log(`  ✅ Inserted listing in database: ${listingId}`);
              successCount++;
            }
          } else {
            const { error: updateError } = await supabase
              .from('listings')
              .update(listingData)
              .eq('id', listingId);
            
            if (updateError) {
              console.error(`  ❌ Error updating listing: ${updateError.message}`);
              errorCount++;
            } else {
              console.log(`  ✅ Updated listing in database: ${listingId}`);
              successCount++;
            }
          }
        } else {
          console.log(`  ⚠️  Filename ${filename} doesn't match expected pattern`);
        }
      } catch (fileError) {
        console.error(`  ❌ Error processing file ${filename}:`, fileError.message);
        errorCount++;
      }
    }
    
    console.log('\n=== 📊 SUPABASE UPSERT SUMMARY ===');
    console.log(`📁 Total files processed: ${apartmentFiles.length}`);
    console.log(`✅ Successful operations: ${successCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('🎉 Supabase upsert completed!');
    
  } catch (error) {
    console.error('💥 Error during Supabase upsert:', error);
    process.exit(1);
  }
}

// Execute the upsert
upsertToSupabase();
