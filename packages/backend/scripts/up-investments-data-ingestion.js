
import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

dotenv.config({ path: 'packages/backend/.env' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const ingestData = async () => {
  const indexName = 'rachatbot-1536';
  const dataFolderPath = path.resolve(__dirname, '../client-data/Up Investments/knowledge-base');
  const maxTokens = 8192;

  const chunkText = (text, maxTokens) => {
    const chunks = [];
    const words = text.split(' ');
    let currentChunk = '';

    for (const word of words) {
      if (currentChunk.length + word.length + 1 > maxTokens) {
        chunks.push(currentChunk);
        currentChunk = word;
      } else {
        currentChunk += ` ${word}`;
      }
    }
    chunks.push(currentChunk);
    return chunks;
  };

  try {
    const index = pinecone.index(indexName);
    const files = fs.readdirSync(dataFolderPath);

    for (const file of files) {
      const filePath = path.join(dataFolderPath, file);
      const fileContent = fs.readFileSync(filePath, 'utf-8');
      const chunks = chunkText(fileContent, maxTokens);

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embedding = await openai.embeddings.create({
          model: 'text-embedding-ada-002',
          input: chunk,
        });

        const vector = {
          id: `${file}-${i}`,
          values: embedding.data[0].embedding,
          metadata: {
            source: file,
            chunk: i,
          },
        };

        await index.upsert([vector]);
        console.log(`Ingested chunk ${i} from '${file}' into index '${indexName}'.`);
      }
    }
  } catch (error) {
    console.error(`Error ingesting data:`, error);
  }
};

ingestData();
