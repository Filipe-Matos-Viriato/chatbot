import { Pinecone } from '@pinecone-database/pinecone';
import OpenAI from 'openai';
import { config } from 'dotenv';

config(); 

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const pinecone = new Pinecone({
  apiKey: process.env.PINECONE_API_KEY,
});

const embeddingModel = 'text-embedding-3-small';
const pineconeIndexName = 'chat-history-1536';

class ChatHistoryService {
  constructor() {
    this.pineconeIndex = pinecone.Index(pineconeIndexName);
    this.embeddingDimension = 1536; 
  }

  async generateEmbedding(text) {
    try {
      const response = await openai.embeddings.create({
        model: embeddingModel,
        input: text,
      });
      return response.data[0].embedding;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw error;
    }
  }

  applyContentTags(message, clientConfig) {
    const tags = {};
    if (clientConfig && clientConfig.chatHistoryTaggingRules) {
      for (const rule of clientConfig.chatHistoryTaggingRules) {
        const regex = new RegExp(rule.pattern, rule.flags || '');
        if (regex.test(message.text)) {
          tags[rule.tagName] = true;
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
      id: `${session_id}-${turn_id}`,
      values: embedding,
      metadata: {
        text,
        role,
        client_id,
        visitor_id,
        session_id,
        timestamp,
        turn_id,
        ...contentTags,
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

  async getVisitorChatHistory(visitorId, clientId, limit = 10) {
    try {
      console.log(`Retrieving visitor chat history for visitor: ${visitorId}, client: ${clientId}`);
      
      const queryResponse = await this.pineconeIndex.query({
        topK: limit * 2,
        includeMetadata: true,
        filter: {
          visitor_id: visitorId,
          client_id: clientId
        },
        // Provide a dummy vector for metadata-only queries
        vector: new Array(this.embeddingDimension).fill(0),
      });

      if (!queryResponse.matches || queryResponse.matches.length === 0) {
        return [];
      }

      const sortedMessages = queryResponse.matches
        .map(match => ({
          role: match.metadata.role,
          text: match.metadata.text,
          timestamp: match.metadata.timestamp,
          turn_id: match.metadata.turn_id,
          session_id: match.metadata.session_id
        }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, limit);

      return sortedMessages;
    } catch (error) {
      console.error("Error retrieving visitor chat history:", error);
      return [];
    }
  }

  formatChatHistoryForPrompt(chatHistory) {
    if (!chatHistory || chatHistory.length === 0) {
      return "Nenhum histórico anterior disponível.";
    }

    return chatHistory
      .reverse()
      .map(msg => `${msg.role === 'user' ? 'Utilizador' : 'Assistente'}: ${msg.text}`)
      .join('\n');
  }
}

module.exports = ChatHistoryService;