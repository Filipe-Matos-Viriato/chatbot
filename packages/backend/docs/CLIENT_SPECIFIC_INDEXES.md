# Client-Specific Pinecone Indexes

This guide explains how to set up and use client-specific Pinecone indexes for improved isolation and performance.

## Overview

By default, the chatbot uses shared Pinecone indexes for all clients:
- `rachatbot-1536` - For storing knowledge base content (listings, developments, etc.)
- `chat-history-1536` - For storing chat history

We've now implemented the ability to use a dedicated Pinecone index for each client, which offers several benefits:

1. **Better data isolation** - Each client's data is stored in its own index
2. **Improved performance** - Smaller, focused indexes with only relevant data
3. **Reduced cross-client contamination** - Prevents accidental recommendations of properties from other clients
4. **Simplified migrations** - Easier to back up or move individual client data

## Setting Up a Client-Specific Index

### Step 1: Create a new Pinecone index

1. Log into the [Pinecone console](https://app.pinecone.io/)
2. Click "Create Index"
3. Enter the following settings:
   - Name: `[client-name]-1536` (e.g., `upinvestments-1536`)
   - Dimensions: 1536
   - Metric: Cosine
   - Pod Type: s1.x1 (or appropriate size based on expected data volume)

### Step 2: Update client configuration

Add the `pineconeIndex` field to the client's configuration file:

```json
{
  "clientId": "client-uuid",
  "clientName": "Client Name",
  "chatbotName": "Real Estate Chatbot",
  "pineconeIndex": "client-name-1536",
  ...
}
```

### Step 3: Migrate existing data (if needed)

Use the migration script to transfer existing data from the shared indexes to the client-specific index:

```bash
node packages/backend/scripts/migrate-client-data-to-dedicated-index.js client-uuid
```

## Implementation Details

The system is designed to work with both shared and client-specific indexes:

1. If a client has a `pineconeIndex` field in its configuration, that index will be used for:
   - RAG queries (knowledge base retrieval)
   - Chat history storage and retrieval
   - Document ingestion

2. If no `pineconeIndex` is specified, the system falls back to the shared indexes:
   - `rachatbot-1536` for knowledge base content
   - `chat-history-1536` for chat history

## Monitoring and Maintenance

### Monitoring Index Usage

You can monitor Pinecone index usage in the Pinecone console to ensure proper resource allocation.

### Backing Up Client Data

To back up a client's data, you can use the Pinecone export functionality or create a script to fetch and store all vectors from the client's index.

## Troubleshooting

### Diagnosing Index Issues

If you encounter issues with a client-specific index:

1. Check the logs for any errors related to the index
2. Verify the index exists in the Pinecone console
3. Ensure the index has the correct dimensions (1536)
4. Test queries directly against the index using the Pinecone console

### Fallback to Shared Indexes

If needed, you can temporarily remove the `pineconeIndex` field from the client's configuration to fall back to the shared indexes.

## Best Practices

1. Use a consistent naming convention for client indexes (e.g., `clientname-1536`)
2. Monitor index size and performance regularly
3. Consider the appropriate pod type based on expected data volume and query traffic
4. Document any client-specific index settings or requirements