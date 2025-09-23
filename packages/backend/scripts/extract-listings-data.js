// c:/VS Projects/Chatbot/packages/backend/scripts/extract-listings-data.js
// Temporary script to extract listings data from Up Investments PDFs
// This script processes PDFs ending with four digits in the knowledge-base directory
// and extracts total_area, private_area, and duplex information for display purposes.
// relevant files: packages/backend/client-data/Up Investments/knowledge-base/*.pdf

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const KNOWLEDGE_BASE_DIR = path.join(__dirname, '../client-data/Up Investments/knowledge-base');

// Supabase configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const CLIENT_ID = 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase environment variables');
  console.error('SUPABASE_URL:', SUPABASE_URL ? 'Found' : 'Missing');
  console.error('SUPABASE_ANON_KEY:', SUPABASE_ANON_KEY ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Function to extract data from PDF text
function extractData(text, filename) {
  // Normalize text: replace line breaks and multiple spaces with single space
  const normalizedText = text.replace(/\s+/g, ' ').toLowerCase();

  let totalArea = null;
  let privateArea = null;

  // Extract total area (área bruta)
  const totalAreaMatch = normalizedText.match(/(\d+(?:[.,]\d+)?)\s*m²\s*(?:de\s+)?área bruta/i);
  if (totalAreaMatch) {
    totalArea = parseFloat(totalAreaMatch[1].replace(',', '.'));
  }

  // Extract private area
  // First, check if "área bruta e privativa" - means private = total
  if (normalizedText.includes('área bruta e privativa') && totalArea) {
    privateArea = totalArea;
  } else {
    // Look for private area in parentheses after total area
    const parenMatch = normalizedText.match(/área bruta\s*\(\s*(\d+(?:[.,]\d+)?)\s*m²\s*privativos?\s*\)/i);
    if (parenMatch) {
      privateArea = parseFloat(parenMatch[1].replace(',', '.'));
    } else {
      // Look for standalone private area
      const privateMatch = normalizedText.match(/(\d+(?:[.,]\d+)?)\s*m²\s*área privativ/i);
      if (privateMatch) {
        privateArea = parseFloat(privateMatch[1].replace(',', '.'));
      } else {
        // Additional pattern for "são área privativa"
        const saoMatch = normalizedText.match(/(\d+(?:[.,]\d+)?)\s*m²\s*são\s*área privativ/i);
        if (saoMatch) {
          privateArea = parseFloat(saoMatch[1].replace(',', '.'));
        }
      }
    }
  }

  // Check for duplex (from text or filename)
  const isDuplex = normalizedText.includes('duplex') || filename.toLowerCase().includes('duplex');

  return {
    totalArea,
    privateArea,
    isDuplex
  };
}

// Function to process a single PDF
async function processPDF(filePath, filename) {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParse(dataBuffer);
    const extracted = extractData(data.text, filename);

    console.log(`\n--- Processing: ${filename} ---`);
    console.log(`Listing ID: ${path.basename(filename, '.pdf').match(/\d{4}$/)[0]}`);
    console.log(`Total Area: ${extracted.totalArea ? extracted.totalArea + ' m²' : 'Not found'}`);
    console.log(`Private Area: ${extracted.privateArea ? extracted.privateArea + ' m²' : 'Not found'}`);
    console.log(`Duplex: ${extracted.isDuplex ? 'Yes' : 'No'}`);
    // Debug: print first 500 chars of text
    console.log(`Text preview: ${data.text.substring(0, 500)}...`);
  } catch (error) {
    console.error(`Error processing ${filename}:`, error.message);
  }
}

// Function to upsert listing data to database
async function upsertListing(listingId, extractedData) {
  try {
    const updateData = {
      total_area: extractedData.totalArea,
      private_area: extractedData.privateArea,
      duplex: extractedData.isDuplex
    };

    // Only update if we have at least one value to update
    if (extractedData.totalArea !== null || extractedData.privateArea !== null || extractedData.isDuplex !== null) {
      const { data, error } = await supabase
        .from('listings')
        .update(updateData)
        .eq('id', listingId)
        .eq('client_id', CLIENT_ID)
        .select('id, total_area, private_area, duplex');

      if (error) {
        console.error(`Error upserting listing ${listingId}:`, error.message);
        return false;
      }

      console.log(`✅ Updated listing ${listingId}:`, data[0]);
      return true;
    } else {
      console.log(`⚠️  Skipping listing ${listingId} - no data to update`);
      return false;
    }
  } catch (error) {
    console.error(`Error upserting listing ${listingId}:`, error.message);
    return false;
  }
}

// Main function
async function main() {
  try {
    const files = fs.readdirSync(KNOWLEDGE_BASE_DIR);
    const pdfFiles = files.filter(file => file.endsWith('.pdf') && /\d{4}\.pdf$/.test(file));

    console.log(`Found ${pdfFiles.length} PDFs to process\n`);

    const results = [];
    let updatedCount = 0;

    for (const file of pdfFiles) {
      const filePath = path.join(KNOWLEDGE_BASE_DIR, file);
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      const extracted = extractData(data.text, file);

      const listingId = path.basename(file, '.pdf').match(/\d{4}$/)[0];

      // Attempt to upsert to database
      const wasUpdated = await upsertListing(listingId, extracted);

      results.push({
        'Apartment': path.basename(file, '.pdf'),
        'Listing ID': listingId,
        'Total Area (m²)': extracted.totalArea || 'Not found',
        'Private Area (m²)': extracted.privateArea || 'Not found',
        'Duplex': extracted.isDuplex ? 'Yes' : 'No',
        'Database Update': wasUpdated ? '✅ Updated' : '⚠️ Skipped'
      });

      if (wasUpdated) updatedCount++;
    }

    console.table(results);
    console.log(`\n--- Extraction Complete ---`);
    console.log(`📊 Summary: ${updatedCount}/${pdfFiles.length} listings updated in database`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the script
main();