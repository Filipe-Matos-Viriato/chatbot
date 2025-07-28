import { Pinecone } from '@pinecone-database/pinecone';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from 'dotenv';

config(); // Load environment variables

const PINECONE_API_KEY = process.env.PINECONE_API_KEY;
const PINECONE_ENVIRONMENT = process.env.PINECONE_ENVIRONMENT;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

const pinecone = new Pinecone({
  apiKey: PINECONE_API_KEY,
});

const genAI = new GoogleGenerativeAI(GOOGLE_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "text-embedding-004" });

class ChatHistoryService {
  constructor() {
    this.pineconeIndex = pinecone.Index('chat-history'); // Assuming a Pinecone index named 'chat-history'
  }

  async generateEmbedding(text) {
    try {
      const result = await embeddingModel.embedContent({ content: { parts: [{ text: text }] } });
      return result.embedding.values;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  applyContentTags(message, clientConfig) {
    const tags = {};
    // Placeholder for content-based tagging logic
    // clientConfig.chatHistoryTaggingRules will contain regex patterns
    if (clientConfig && clientConfig.chatHistoryTaggingRules) {
      for (const rule of clientConfig.chatHistoryTaggingRules) {
        const regex = new RegExp(rule.pattern, rule.flags || '');
        if (regex.test(message.text)) {
          tags[rule.tagName] = true; // Apply tag if pattern matches
        }
      }
    }
    return tags;
  }

  async upsertMessage(message, clientConfig) {
    const { text, role, client_id, visitor_id, session_id, timestamp, turn_id } = message;

    const embedding = await this.generateEmbedding(text);
    const contentTags = this.applyContentTags(message, clientConfig);

    const vector = {
      id: `${session_id}-${turn_id}`, // Unique ID for the vector
      values: embedding,
      metadata: {
        role,
        client_id,
        visitor_id,
        session_id,
        timestamp,
        turn_id,
        ...contentTags, // Add content-based tags
      },
    };

    try {
      await this.pineconeIndex.upsert([vector]);
      console.log(`Message upserted to Pinecone: ${vector.id}`);
    } catch (error) {
      console.error("Error upserting message to Pinecone:", error);
      throw error;
    }
  }
}

export default ChatHistoryService;