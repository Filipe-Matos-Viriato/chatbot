// packages/backend/scripts/run-ingestion-v2.js
// This script runs the Enriched Ingestion Service (V2) for testing and validation purposes.
// It allows specifying client ID, optional development ID, and batch size to process listings.
// Relevant files: packages/backend/src/services/ingestion-service_V2.js, packages/backend/src/services/client-config-service.js

require('dotenv').config({ path: './.env' });

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { processListings } = require('../src/services/ingestion-service_V2.js');

async function main() {
  const argv = yargs(hideBin(process.argv))
    .option('clientId', {
      alias: 'c',
      type: 'string',
      description: 'Client ID (required)',
      demandOption: true,
    })
    .option('developmentId', {
      alias: 'd',
      type: 'string',
      description: 'Development ID (optional)',
    })
    .option('listingId', {
      alias: 'l',
      type: 'string',
      description: 'Specific listing ID to process (optional)',
    })
    .option('batchSize', {
      alias: 'b',
      type: 'number',
      description: 'Batch size (default 10)',
      default: 10,
    })
    .help()
    .argv;

  try {
    console.log('Starting ingestion V2 for client:', argv.clientId);
    let page = 0;
    let hasMore = true;
    let totalProcessed = 0;

    while (hasMore) {
      console.log(`Processing page ${page + 1} with batch size ${argv.batchSize}...`);
      const { processedCount, moreAvailable } = await processListings(
        argv.clientId,
        argv.developmentId,
        argv.listingId,
        argv.batchSize,
        page * argv.batchSize // Calculate offset
      );
      totalProcessed += processedCount;
      hasMore = moreAvailable;
      page++;
    }

    console.log(`Ingestion completed successfully. Total listings processed: ${totalProcessed}`);
  } catch (error) {
    console.error('Error during ingestion:', error);
    process.exit(1);
  }
}

main();