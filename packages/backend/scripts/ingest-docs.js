/*
 Simple ingestion script: reads files from a directory, chunks them, embeds, and upserts into Pinecone
 Usage: node -r dotenv/config packages/backend/scripts/ingest-docs.js ./path/to/docs --namespace=marketing --project=<project_id>
*/
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function chunkText(text, maxTokens = 600, overlap = 100) {
  // naive char-based chunking approximating tokens
  const approxChars = maxTokens * 4;
  const approxOverlap = overlap * 4;
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    const end = Math.min(text.length, i + approxChars);
    const slice = text.slice(i, end);
    chunks.push(slice);
    if (end === text.length) break;
    i = end - approxOverlap;
  }
  return chunks;
}

async function embedBatch(texts) {
  const res = await openai.embeddings.create({ model: 'text-embedding-3-small', input: texts });
  return res.data.map(d => d.embedding);
}

async function main() {
  const dir = process.argv[2];
  if (!dir) {
    console.error('Provide a directory of .txt/.md/.html/.pdf (text-extracted) files.');
    process.exit(1);
  }
  const namespace = (process.argv.find(a => a.startsWith('--namespace=')) || '').split('=')[1] || 'marketing';
  const projectId = (process.argv.find(a => a.startsWith('--project=')) || '').split('=')[1] || null;
  const indexName = process.env.PINECONE_INDEX || 'viriato_chatbot_1536';

  const pinecone = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });
  const index = pinecone.index(indexName);

  const files = fs.readdirSync(dir).filter(f => /\.(txt|md|html)$/i.test(f));
  for (const f of files) {
    const filepath = path.join(dir, f);
    const raw = fs.readFileSync(filepath, 'utf8');
    const title = path.basename(f, path.extname(f));
    const chunks = chunkText(`${title}\n\n${raw}`, 600, 120);
    const embeddings = await embedBatch(chunks);
    const upserts = chunks.map((text, i) => ({
      id: `${title}::${i}`,
      values: embeddings[i],
      metadata: {
        text,
        title,
        project_id: projectId,
        locale: 'pt-PT',
        doc_type: 'brochure',
        audience: 'family',
      }
    }));
    await index.namespace(namespace).upsert(upserts);
    console.log(`Upserted ${upserts.length} chunks from ${f} into ${indexName}/${namespace}`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });


