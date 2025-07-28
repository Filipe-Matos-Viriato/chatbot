const fs = require('fs').promises;
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Load environment variables
const { processDocument, extractText } = require('../src/services/ingestion-service');
const { getClientConfig } = require('../src/services/client-config-service');
const developmentService = require('../src/services/development-service'); // Import development service
const { v4: uuidv4 } = require('uuid'); // For generating UUIDs

const CLIENT_ID = 'e6f484a3-c3cb-4e01-b8ce-a276f4b7355c'; // Up Investments client_id
const KNOWLEDGE_BASE_PATH = path.join(__dirname, '../client-data/Up Investments/knowledge-base');

const EVERGREEN_PURE_DEV_NAME = "Evergreen Pure";

const getOrCreateDevelopment = async (clientId, developmentName) => {
  const developments = await developmentService.getDevelopmentsByClientId(clientId);
  let development = developments.find(dev => dev.name === developmentName);

  if (development) {
    console.log(`Found existing development: ${developmentName} with ID: ${development.id}`);
    return development.id;
  } else {
    const newDevId = uuidv4(); // Generate a new UUID
    console.log(`Creating new development: ${developmentName} with ID: ${newDevId}`);
    development = await developmentService.createDevelopment({
      id: newDevId, // Pass the generated UUID
      name: developmentName,
      client_id: clientId,
    });
    return development.id;
  }
};

const ingestUpInvestmentsData = async () => {
  console.log(`Starting ingestion for client: ${CLIENT_ID}`);
  try {
    const clientConfig = await getClientConfig(CLIENT_ID);
    if (!clientConfig) {
      console.error(`Client configuration not found for client ID: ${CLIENT_ID}`);
      return;
    }

    const evergreenPureDevId = await getOrCreateDevelopment(CLIENT_ID, EVERGREEN_PURE_DEV_NAME);
    console.log(`Evergreen Pure Development ID: ${evergreenPureDevId}`);

    const files = await fs.readdir(KNOWLEDGE_BASE_PATH);

    for (const filename of files) {
      // Skip DOCX files as PDFs are now preferred and DOCX processing has issues
      if (filename.endsWith('.docx')) {
        console.log(`Skipping DOCX file: ${filename}`);
        continue;
      }

      const filePath = path.join(KNOWLEDGE_BASE_PATH, filename);
      const fileExtension = path.extname(filename).toLowerCase();
      const baseFilename = path.basename(filename, fileExtension);

      let documentCategory = 'general'; // Default category
      let metadata = {};

      // Determine document category and initial metadata based on filename
      if (baseFilename.match(/^\d+_[a-h]$/)) { // e.g., 1_a.json, 2_h.json
        documentCategory = 'listing';
        metadata.development_id = evergreenPureDevId; // Link to Evergreen Pure development
      } else if (baseFilename.includes('Evergreen')) {
        documentCategory = 'development';
        metadata.development_id = evergreenPureDevId; // Link to Evergreen Pure development
      } else if (baseFilename.includes('upinvestments')) {
        documentCategory = 'company_info';
      } else if (filename.endsWith('.pdf') && baseFilename.includes('Evergreen - Lifestyle')) {
        documentCategory = 'lifestyle'; // For lifestyle documents (now using PDFs)
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
        }, { extractText }); // Pass extractText explicitly

        if (result.success) {
          console.log(`Successfully processed ${filename}`);
        } else {
          console.error(`Failed to process ${filename}: ${result.message}`);
        }
      } catch (fileError) {
        console.error(`Error reading or processing file ${filename}:`, fileError);
      }
    }
    console.log('Ingestion process completed.');
  } catch (error) {
    console.error('Error during ingestion process:', error);
  }
};

ingestUpInvestmentsData();