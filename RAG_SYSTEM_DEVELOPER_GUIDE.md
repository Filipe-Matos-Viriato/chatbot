# RAG System Developer Guide

## Overview

This guide provides a comprehensive understanding of the Retrieval-Augmented Generation (RAG) system implemented in this enterprise chatbot platform. The system is designed as a multi-tenant, AI-powered solution for real estate agencies and other businesses requiring intelligent document-based question answering.

## What is RAG?

**Retrieval-Augmented Generation (RAG)** is an AI technique that combines:
- **Retrieval**: Finding relevant information from a knowledge base
- **Generation**: Using an LLM to create natural language responses based on retrieved context

This approach allows the chatbot to provide accurate, grounded responses based on your specific documents and data, rather than relying solely on the LLM's training data.

## System Architecture

### High-Level Components

```
┌─────────────────────────────────────────────────────────┐
│                    RAG PIPELINE                         │
├─────────────────────────────────────────────────────────┤
│  User Query → Embedding → Vector Search → Context →    │
│  Prompt Construction → LLM Generation → Response       │
└─────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Data Sources  │    │  Vector Storage │    │   AI Services   │
│                 │    │                 │    │                 │
│ • PDFs          │    │ • Pinecone      │    │ • Google Gemini │
│ • Documents     │ ──▶│ • Embeddings    │◀──▶│ • Embeddings    │
│ • Listings      │    │ • Metadata      │    │ • Generation    │
└─────────────────┘    └─────────────────┘    └─────────────────┘

┌─────────────────────────────────────────────────────────┐
│                MULTI-TENANT BACKEND                     │
├─────────────────────────────────────────────────────────┤
│ • Client Configuration Management                       │
│ • User Management & Role-Based Access                  │
│ • Lead Scoring & Analytics                             │
│ • Document Ingestion Pipeline                          │
└─────────────────────────────────────────────────────────┘
```

### Core Principles

1. **Multi-Tenancy**: Every operation is scoped by `client_id`
2. **Context-Awareness**: Responses are tailored to current page context (listing, development)
3. **Hybrid Search**: Combines semantic similarity with structured filtering
4. **Role-Based Access**: Different access levels for admins vs. agents
5. **Scalable Ingestion**: Flexible document processing with client-specific rules

## Technology Stack

### Backend Dependencies
- **Node.js + Express.js**: Web server framework
- **Google Generative AI**: 
  - `gemini-2.5-flash`: Text generation
  - `text-embedding-004`: Vector embeddings
- **Pinecone**: Vector database for semantic search
- **Supabase**: PostgreSQL database for structured data
- **LangChain**: Text chunking and processing
- **Mammoth + PDF-Parse**: Document text extraction

### Key Libraries
```json
{
  "@google/generative-ai": "^0.12.0",
  "@pinecone-database/pinecone": "^2.2.2", 
  "@supabase/supabase-js": "^2.51.0",
  "langchain": "^0.3.29",
  "mammoth": "^1.9.1",
  "pdf-parse": "^1.1.1"
}
```

## RAG Pipeline Deep Dive

### 1. Document Ingestion Pipeline

**Location**: `src/services/ingestion-service.js`

**Process Flow**:
```
Document Upload → Text Extraction → Chunking → Embedding → Vector Storage
```

**Key Features**:
- **Smart Chunking**: Uses `RecursiveCharacterTextSplitter` with client-configurable chunk sizes
- **Metadata Enrichment**: Extracts structured data (price, bedrooms, etc.) from documents
- **Client-Specific Rules**: Custom tagging and processing rules per client
- **Multi-Category Support**: Handles listing-specific, development-specific, and general documents

**Example Chunking Configuration**:
```javascript
const chunkingStrategy = clientConfig.chunking_rules?.document_types?.[documentType]?.strategy || 'semantic_paragraph';
const chunkSize = clientConfig.chunking_rules?.document_types?.[documentType]?.max_tokens || 1000;
const chunkOverlap = clientConfig.chunking_rules?.document_types?.[documentType]?.overlap_tokens || 200;
```

### 2. Hybrid Search System

**Location**: `src/rag-service.js` - `performHybridSearch()`

**Multi-Stage Search Strategy**:

1. **Targeted Search** (if context available):
   - Search by specific `listing_id` when user is on a listing page
   - Search by `development_id` when user is on a development page

2. **Broad Search** (always performed):
   - General search across all client documents
   - Applies structured filters extracted from the query

3. **Result Combination & Re-ranking**:
   - Combines targeted and broad results
   - Removes duplicates
   - Applies sophisticated scoring boosts

**Re-ranking Algorithm**:
```javascript
// Context Boosts
if (contextListingId && match.metadata.listing_id === contextListingId) {
  score += 1.0; // Current page listing
}

if (queryListingId && match.metadata.listing_id === queryListingId) {
  score += 1.5; // Explicitly mentioned listing
}

if (contextDevelopmentId && match.metadata.development_id === contextDevelopmentId) {
  score += 0.8; // Current page development
}

// Filter Match Boosts
score += (filterMatchCount * 0.2); // Structured metadata matches
```

### 3. Query Processing & Context Extraction

**Smart Filter Extraction**:
The system automatically extracts structured filters from natural language queries:

```javascript
// Examples of extracted filters:
"3 quartos" → { num_bedrooms: 3 }
"menos de 500000€" → { price_eur: { "$lt": 500000 } }
"com piscina" → { has_pool: true }
"mais de 2 quartos" → { num_bedrooms: { "$gt": 2 } }
```

**Price Context Intelligence**:
- Detects comparative price queries ("mais barato", "mais caro")
- Uses current listing price for relative comparisons
- Handles aggregative queries (min/max prices across all listings)

### 4. Response Generation

**Location**: `src/rag-service.js` - `generateResponse()`

**Process**:
1. **Query Embedding**: Convert user query to vector using `text-embedding-004`
2. **Hybrid Search**: Retrieve relevant context chunks
3. **Context Assembly**: Combine retrieved text chunks
4. **Prompt Construction**: Build prompt with system instructions + context + query
5. **LLM Generation**: Generate response using `gemini-2.5-flash`
6. **Fallback Handling**: Return configured fallback if needed

**Template System**:
```javascript
const templateVariables = {
  onboardingAnswers: onboardingAnswers || "Não disponível",
  chatHistory: chatHistory || "Nenhum histórico anterior disponível", 
  context: context + (aggregativeContext ? `\n\nInformação Adicional:\n${aggregativeContext}` : ''),
  question: query
};

// Apply template variable substitution
let systemPrompt = clientConfig.prompts.systemInstruction;
Object.keys(templateVariables).forEach(key => {
  const placeholder = `{${key}}`;
  systemPrompt = systemPrompt.replace(new RegExp(placeholder, 'g'), templateVariables[key]);
});
```

## Key Services

### 1. RAG Service (`src/rag-service.js`)

**Primary Functions**:
- `generateResponse()`: Main RAG pipeline execution
- `performHybridSearch()`: Multi-stage vector search with re-ranking
- `extractQueryFilters()`: NLP-based structured filter extraction
- `isAggregativePriceQuery()`: Detects queries requiring database aggregation

### 2. Ingestion Service (`src/services/ingestion-service.js`)

**Primary Functions**:
- `processDocument()`: End-to-end document processing pipeline
- `extractText()`: Multi-format document text extraction
- `applyClientTaggingRules()`: Custom metadata enrichment
- `cleanMetadataForPinecone()`: Metadata sanitization for vector storage

### 3. Client Configuration Service (`src/services/client-config-service.js`)

**Manages**:
- Client-specific system prompts and instructions
- Chunking and tagging rules
- URL pattern matching for context extraction
- Fallback responses and behavior
- Lead scoring configurations

### 4. User Service (`src/services/user-service.js`)

**Provides**:
- User authentication and role management
- Agent-specific listing access control
- Role-based search filtering (promoters see only assigned listings)

## Data Flow Examples

### 1. User Asks Question on Listing Page

```
1. User on listing page "ap-123" asks "What's the price?"
2. Frontend sends: { query: "What's the price?", context: { type: 'listing', value: 'ap-123' }}
3. RAG Service:
   - Generates embedding for query
   - Performs targeted search for listing_id: 'ap-123'
   - Performs broad search for general pricing info
   - Re-ranks results (listing-specific content boosted)
   - Constructs prompt with retrieved context
   - Generates response using Gemini
4. Returns: "This property is priced at 450,000€..."
```

### 2. Comparative Query

```
1. User asks "Show me cheaper properties"
2. System:
   - Extracts current listing price from context: 450,000€
   - Applies filter: { price_eur: { "$lt": 450000 }}
   - Searches for properties under 450,000€
   - Returns comparative listings with context
```

### 3. Agent Access Control

```
1. Agent (promoter role) asks question
2. System:
   - Retrieves agent's assigned listings from database
   - Applies filter: { listing_id: { "$in": [assigned_listing_ids] }}
   - Only searches within agent's permitted listings
   - Prevents data leakage to unauthorized listings
```

## Environment Setup

### Required Environment Variables

```bash
# AI Services
GOOGLE_API_KEY=""                 # Google Generative AI API key

# Vector Database  
PINECONE_API_KEY=""              # Pinecone API key
PINECONE_INDEX_NAME=""           # Pinecone index name
PINECONE_NAMESPACE=""            # Pinecone namespace

# Database
SUPABASE_URL=""                  # Supabase project URL  
SUPABASE_ANON_KEY=""            # Supabase anonymous key
SUPABASE_SERVICE_ROLE_KEY=""     # Supabase service role key (for admin operations)

# Server Configuration
PORT=3000                        # Server port
NODE_ENV=development             # Environment mode
```

### Database Schema (Supabase)

**Key Tables**:
- `clients`: Client configurations and settings
- `listings`: Property listings with structured metadata
- `developments`: Property developments
- `users`: User accounts (admins, promoters)
- `agent_listings`: Agent-to-listing assignments
- `visitors`: Visitor tracking and lead scoring
- `events`: User interaction events
- `questions`: Query history and analytics

## Important Concepts

### 1. Multi-Tenancy

Every operation is scoped by `client_id`:
```javascript
const baseFilter = {
  client_id: clientConfig.clientId,
};
```

All vector searches, database queries, and configurations are client-specific.

### 2. Context-Aware Responses

The system understands page context:
- **Listing pages**: Prioritizes listing-specific information
- **Development pages**: Focuses on development-level details
- **General pages**: Provides broad, comparative information

### 3. Metadata-Rich Vectors

Each vector in Pinecone contains rich metadata:
```javascript
{
  id: "client-123-document-0",
  values: [...], // 768-dimensional embedding
  metadata: {
    client_id: "client-123",
    listing_id: "ap-456", 
    development_id: "dev-789",
    source: "apartment_brochure.pdf",
    text: "This luxury apartment features...",
    price_eur: 450000,
    num_bedrooms: 3,
    has_pool: true,
    // ... other extracted metadata
  }
}
```

### 4. Intelligent Query Understanding

The system extracts meaning from natural language:
- **Structured filters**: "3 bedroom apartment" → `{num_bedrooms: 3}`
- **Price comparisons**: "cheaper than this" → `{price_eur: {"$lt": current_price}}`
- **Boolean features**: "with swimming pool" → `{has_pool: true}`

### 5. Scalable Document Processing

The ingestion pipeline supports:
- **Multiple formats**: PDF, DOCX, TXT
- **Client-specific rules**: Custom chunking and tagging
- **Structured extraction**: Automatic metadata extraction using regex patterns
- **Flexible categorization**: Listing-specific, development-specific, or general documents

## Performance Considerations

### 1. Vector Search Optimization
- **Targeted searches** first (smaller topK for specific context)
- **Broad searches** with larger topK for comprehensive results
- **Re-ranking** to optimize final result quality

### 2. Embedding Efficiency
- Reuses embedding model instances
- Batches document processing where possible
- Implements retry logic for API rate limits

### 3. Database Optimization
- **Supabase RLS**: Row-level security for multi-tenancy
- **Pinecone namespaces**: Logical data separation
- **Indexed metadata**: Fast filtering on common fields

## Development Best Practices

### 1. Adding New Features
- Always scope by `client_id`
- Consider multi-tenant implications
- Test with different user roles
- Update client configuration schema if needed

### 2. Debugging RAG Issues
- Check embedding quality and similarity scores
- Verify metadata filtering is working correctly
- Ensure context extraction matches expected format
- Review prompt construction and template variables

### 3. Performance Monitoring
- Track vector search latency
- Monitor LLM generation times  
- Watch for rate limiting issues
- Analyze search result quality and relevance

## Testing

### Unit Tests
- Mock external services (Pinecone, Google AI, Supabase)
- Test individual components in isolation
- Verify filter extraction and query processing logic

### Integration Tests  
- End-to-end RAG pipeline testing
- Multi-tenant data isolation verification
- Role-based access control validation

This RAG system represents a sophisticated, production-ready implementation that balances performance, accuracy, and scalability while maintaining strict multi-tenant security and providing intelligent, context-aware responses.