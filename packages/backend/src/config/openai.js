/**
 * @fileoverview Configuration for OpenAI API.
 * @filelocation packages/backend/src/config/openai.js
 * @description Provides functions to interact with OpenAI's API, particularly for embeddings.
 */

import OpenAI from 'openai';
// Ensure environment variables are loaded when running standalone scripts
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates an embedding for the given text using OpenAI's embedding model.
 * @param {string} text - The text to generate an embedding for.
 * @returns {Promise<number[]>} The embedding vector.
 */
export async function getEmbedding(text) {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    
    return response.data[0].embedding;
  } catch (error) {
    console.error('Error getting embedding from OpenAI:', error);
    throw new Error(`OpenAI embedding failed: ${error.message}`);
  }
}

export default openai;
