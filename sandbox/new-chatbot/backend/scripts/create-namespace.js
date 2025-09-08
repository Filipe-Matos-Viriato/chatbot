import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--namespace' || a === '-n') args.namespace = argv[++i];
    else if (a === '--index' || a === '-i') args.index = argv[++i];
    else if (a === '--dims' || a === '--dimension' || a === '-d') args.dimension = parseInt(argv[++i], 10);
    else if (a === '--cleanup' || a === '--delete') args.cleanup = true;
  }
  return args;
}

async function main() {
  const { namespace, index, dimension, cleanup } = parseArgs(process.argv);
  const indexName = index || process.env.PINECONE_INDEX || 'new-chatbot-1536';
  const dims = Number(dimension || process.env.PINECONE_DIMENSION || 1536);

  if (!process.env.PINECONE_API_KEY) {
    console.error('PINECONE_API_KEY is required');
    process.exit(1);
  }
  if (!namespace) {
    console.error('Usage: node scripts/create-namespace.js --namespace <name> [--index <indexName>] [--dims <n>] [--cleanup]');
    process.exit(1);
  }

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  // Validate index exists
  try {
    await pc.describeIndex(indexName);
  } catch (err) {
    console.error(`Index '${indexName}' not found or not accessible. Create it first or set PINECONE_INDEX.`);
    process.exit(1);
  }

  const indexRef = pc.index(indexName);
  const dummyId = `ns_init_${namespace}_${Date.now()}`;
  // Pinecone requires dense vectors to contain at least one non-zero value
  const values = Array.from({ length: dims }, (_, i) => (i === 0 ? 1 : 0));

  console.log(`Creating namespace '${namespace}' in index '${indexName}' by upserting a dummy vector...`);
  await indexRef.upsert([{ id: dummyId, values }], { namespace });
  console.log(`Upserted dummy vector id=${dummyId} into namespace='${namespace}'.`);

  if (cleanup) {
    try {
      await indexRef.deleteMany({ ids: [dummyId] }, { namespace });
      console.log(`Cleanup enabled: deleted dummy vector ${dummyId}.`);
    } catch (e) {
      console.warn('Cleanup failed (non-fatal):', e?.message || e);
    }
  }

  console.log(`Namespace '${namespace}' is ready for use.`);
}

main().catch(err => {
  console.error('Failed to create namespace:', err);
  process.exit(1);
});


