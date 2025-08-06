
import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv';

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const createIndex = async () => {
  const indexName = 'upinvestments-1536';

  try {
    const existingIndexes = await pinecone.listIndexes();
    if (existingIndexes.indexes.some(index => index.name === indexName)) {
      console.log(`Index '${indexName}' already exists. Skipping creation.`);
      return;
    }

    console.log(`Creating index '${indexName}'...`);
    await pinecone.createIndex({
      name: indexName,
      dimension: 1536,
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1',
        },
      },
    });
    console.log(`Index '${indexName}' created successfully.`);
  } catch (error) {
    console.error(`Error creating index '${indexName}':`, error);
  }
};

createIndex();
