// packages/backend/scripts/run-ingestion-developments-v2.cjs
// This script runs the Enriched Ingestion Service for Developments (V2) for testing and validation purposes.
// It allows specifying client ID and batch size to process developments.
// Relevant files: packages/backend/src/services/ingestion_service_developments_V2.js, packages/backend/src/services/client-config-service.js

require('dotenv').config({ path: './packages/backend/.env' });

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const { processDevelopments } = require('../src/services/ingestion_service_developments_V2.js');

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
      description: 'Development ID (optional - if provided, only this development will be processed)',
    })
    .option('batchSize', {
      alias: 'b',
      type: 'number',
      description: 'Batch size (default 10, ignored if developmentId is provided)',
      default: 10,
    })
    .help()
    .argv;

  try {
    const target = argv.developmentId ? `development ${argv.developmentId}` : 'all developments';
    console.log(`Starting developments ingestion V2 for client: ${argv.clientId}, processing: ${target}`);
    await processDevelopments(argv.clientId, argv.developmentId, argv.batchSize);
    console.log('Developments ingestion completed successfully.');
  } catch (error) {
    console.error('Error during developments ingestion:', error);
    process.exit(1);
  }
}

main();