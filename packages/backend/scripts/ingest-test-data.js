const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const pdf = require('pdf-parse');

const API_BASE_URL = 'http://localhost:3006';
const TEST_DATA_DIR = path.join(__dirname, '../test-data');
const CLIENT_ID = 'client-abc'; // As defined in our configs

/**
 * Extracts the listing ID from the PDF content.
 * Assumes the ID is in the format 'ap-XX'.
 * @param {string} filePath - The path to the PDF file.
 * @returns {Promise<string|null>} The found listing ID or null.
 */
const getListingIdFromPdf = async (filePath) => {
  try {
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdf(dataBuffer);
    const match = data.text.match(/ap-\d+/);
    return match ? match[0] : null;
  } catch (error) {
    console.error(`Error reading listing ID from ${path.basename(filePath)}:`, error);
    return null;
  }
};

/**
 * Uploads a single file to the ingestion API.
 * @param {string} filePath - The full path to the file.
 * @param {string} ingestionType - 'listing' or 'general'.
 * @param {object} metadata - The metadata object for the upload.
 */
const uploadFile = async (filePath, ingestionType, metadata = {}) => {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('ingestionType', ingestionType);

  for (const key in metadata) {
    if (metadata[key]) {
      form.append(key, metadata[key]);
    }
  }

  try {
    const response = await axios.post(`${API_BASE_URL}/api/ingest/file`, form, {
      headers: {
        ...form.getHeaders(),
        'x-client-id': CLIENT_ID,
      },
    });
    console.log(
      `Successfully uploaded ${path.basename(
        filePath
      )}. Server response: ${response.data.message}`
    );
  } catch (error) {
    console.error(
      `Error uploading ${path.basename(filePath)}:`,
      error.response ? error.response.data : error.message
    );
  }
};

/**
 * Main function to scan the directory and process all files.
 */
const processTestData = async () => {
  console.log(`Scanning for test data in: ${TEST_DATA_DIR}`);
  const files = fs.readdirSync(TEST_DATA_DIR);

  // Process general files (only PDF)
  const generalPdfFile = files.find(file => file.toLowerCase().includes('sobre a imoprime') && file.toLowerCase().endsWith('.pdf'));
  if (generalPdfFile) {
    const filePath = path.join(TEST_DATA_DIR, generalPdfFile);
    console.log(`Processing general document: ${path.basename(filePath)}`);
    await uploadFile(filePath, 'general');
  } else {
    console.warn('No general PDF document found for ingestion.');
  }

  // Process listing-specific files (only PDF)
  const listingPdfs = files.filter(file => file.toLowerCase().startsWith('ap-') && file.toLowerCase().endsWith('.pdf'));

  for (const file of listingPdfs) {
    const filePath = path.join(TEST_DATA_DIR, file);
    const match = file.toLowerCase().match(/ap-\d+/);
    if (match) {
      const listingId = match[0];
      console.log(`Processing listing document for ${listingId}: ${path.basename(filePath)}`);
      const listingUrl = `https://html.viriatoeviriato.com/ar/imoprime/${listingId}.html`;
      await uploadFile(filePath, 'listing', { listingId, listingUrl });
    } else {
      console.warn(`Could not determine listing ID for file: ${file}. Skipping.`);
    }
  }
  console.log('Test data ingestion process complete.');
};

processTestData();