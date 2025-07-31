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
        text, // Store the original text in metadata for retrieval
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

  async getRecentChatHistory(sessionId, clientId, limit = 10) {
    try {
      console.log(`Retrieving chat history for session: ${sessionId}, client: ${clientId}`);
      
      // Query Pinecone for recent messages in this session
      const queryResponse = await this.pineconeIndex.query({
        topK: limit * 2, // Get more than needed in case we need to filter
        includeMetadata: true,
        filter: {
          session_id: sessionId,
          client_id: clientId
        }
      });

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        return [];
      }

      // Sort by timestamp and take the most recent messages
      const sortedMessages = queryResponse.matches
        .map(match => ({
          role: match.metadata.role,
          text: match.metadata.text,
          timestamp: match.metadata.timestamp,
          turn_id: match.metadata.turn_id
        }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Most recent first
        .slice(0, limit); // Take only the requested number

      return sortedMessages;
    } catch (error) {
      console.error("Error retrieving chat history:", error);
      return []; // Return empty array on error to not break the chat
    }
  }

  async getVisitorChatHistory(visitorId, clientId, limit = 10) {
    try {
      console.log(`Retrieving visitor chat history for visitor: ${visitorId}, client: ${clientId}`);
      
      // Query Pinecone for recent messages from this visitor across all sessions
      const queryResponse = await this.pineconeIndex.query({
        topK: limit * 2, // Get more than needed in case we need to filter
        includeMetadata: true,
        filter: {
          visitor_id: visitorId,
          client_id: clientId
        }
      });

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        return [];
      }

      // Sort by timestamp and take the most recent messages
      const sortedMessages = queryResponse.matches
        .map(match => ({
          role: match.metadata.role,
          text: match.metadata.text,
          timestamp: match.metadata.timestamp,
          turn_id: match.metadata.turn_id,
          session_id: match.metadata.session_id
        }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)) // Most recent first
        .slice(0, limit); // Take only the requested number

      return sortedMessages;
    } catch (error) {
      console.error("Error retrieving visitor chat history:", error);
      return []; // Return empty array on error to not break the chat
    }
  }

  formatChatHistoryForPrompt(chatHistory) {
    if (!chatHistory || chatHistory.length === 0) {
      return "Nenhum histórico anterior disponível.";
    }

    return chatHistory
      .reverse() // Show oldest first in the prompt
      .map(msg => `${msg.role === 'user' ? 'Utilizador' : 'Assistente'}: ${msg.text}`)
      .join('\n');
  }
}

export default ChatHistoryService;