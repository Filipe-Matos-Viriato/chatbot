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
    if (a === '--name' || a === '-n') args.name = argv[++i];
    else if (a === '--dims' || a === '--dimension' || a === '-d') args.dimension = parseInt(argv[++i], 10);
    else if (a === '--metric' || a === '-m') args.metric = argv[++i];
    else if (a === '--cloud') args.cloud = argv[++i];
    else if (a === '--region') args.region = argv[++i];
  }
  return args;
}

async function main() {
  const {
    name = process.env.PINECONE_INDEX || 'new-chatbot-1536',
    dimension = Number(process.env.PINECONE_DIMENSION || 1536),
    metric = process.env.PINECONE_METRIC || 'cosine',
    cloud = process.env.PINECONE_CLOUD || 'aws',
    region = process.env.PINECONE_REGION || 'us-east-1',
  } = parseArgs(process.argv);

  if (!process.env.PINECONE_API_KEY) {
    console.error('PINECONE_API_KEY is required');
    process.exit(1);
  }

  const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

  // If index already exists, exit gracefully
  try {
    const existing = await pc.describeIndex(name);
    if (existing) {
      console.log(`Index '${name}' already exists. Status: ${existing.status?.state || 'Unknown'}`);
      process.exit(0);
    }
  } catch (_) {
    // describeIndex throws if not found; proceed to create
  }

  console.log(`Creating index '${name}' (dimension=${dimension}, metric=${metric}, ${cloud}/${region})...`);
  await pc.createIndex({
    name,
    dimension,
    metric,
    spec: {
      serverless: { cloud, region },
    },
  });

  // wait until ready
  const start = Date.now();
  const timeoutMs = 5 * 60 * 1000; // 5 minutes
  while (true) {
    const desc = await pc.describeIndex(name);
    const state = desc?.status?.state;
    console.log(`  - status: ${state}`);
    if (state === 'Ready') break;
    if (Date.now() - start > timeoutMs) {
      throw new Error('Timed out waiting for index to become Ready');
    }
    await new Promise(r => setTimeout(r, 5000));
  }

  console.log(`Index '${name}' is Ready.`);
}

main().catch(err => {
  console.error('Failed to create index:', err);
  process.exit(1);
});


