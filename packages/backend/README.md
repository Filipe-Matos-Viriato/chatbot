# Backend Package

## Overview

This package contains the Node.js backend for the RAG chatbot system, providing RESTful APIs for chat functionality, visitor management, and analytics.

## Features

- **RAG Pipeline**: Retrieval-Augmented Generation for contextual responses
- **Intelligent Model Selection**: Dynamic model routing based on query complexity
- **Analytics Logging**: Comprehensive tracking of model performance and costs
- **Multi-tenant Architecture**: Client-specific configurations and data isolation
- **Visitor Management**: Session tracking and lead scoring

## Key Components

### Core Services

- **`src/rag-service.js`**: Main RAG pipeline implementation
- **`src/index.js`**: Express server and API routes
- **`src/services/`**: Business logic services (user, visitor, listing management)

### Utilities

- **`src/utils/analytics-logger.js`**: Analytics data collection and logging
- **`src/utils/model-router.js`**: Intelligent model selection logic
- **`src/utils/performance-tracker.js`**: Performance monitoring and metrics

## Analytics System

The backend includes a comprehensive analytics system for tracking model selection and performance:

### Features

- **Model Selection Tracking**: Logs which model was selected for each query and why
- **Performance Metrics**: Captures response times, token usage, and costs
- **Query Analysis**: Tracks query complexity, match quality, and response completeness
- **Asynchronous Logging**: Non-blocking analytics insertion that won't affect user experience

### Configuration

Analytics logging can be controlled via environment variables:

```bash
# Enable/disable analytics logging
RAG_ANALYTICS_LOGGING_ENABLED=true

# Enable intelligent model selection
RAG_INTELLIGENT_MODEL_SELECTION_ENABLED=true

# Default model when intelligent selection is disabled
RAG_DEFAULT_MODEL=gpt-4o-mini
```

### Database Schema

Analytics data is stored in the `chat_message_analytics` table:

```sql
CREATE TABLE chat_message_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_message_id UUID NOT NULL REFERENCES chat_messages(id),
  client_id UUID NOT NULL REFERENCES clients(id),

  -- Model selection data
  model_selected TEXT NOT NULL,
  query_complexity_score DECIMAL,
  selection_confidence DECIMAL,
  estimated_cost DECIMAL,
  model_reasoning TEXT,
  fallback_used BOOLEAN DEFAULT false,

  -- Response metrics
  response_tokens INTEGER,
  response_time_ms INTEGER,
  actual_cost DECIMAL,
  is_complete_response BOOLEAN,
  has_questions BOOLEAN,
  query_scope TEXT,
  matches_found INTEGER,
  contextual_match_status TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### API Endpoints

#### Chat API

```
POST /v1/chat
```

Main chat endpoint that processes user queries and returns AI responses.

**Request Body:**
```json
{
  "query": "What apartments are available?",
  "clientId": "client-uuid",
  "visitorId": "visitor-uuid",
  "externalContext": {
    "type": "listing",
    "value": "listing-id"
  }
}
```

**Response:**
```json
{
  "response": "Based on your preferences...",
  "suggestedQuestions": ["Question 1", "Question 2"],
  "debug": {...},
  "isUnanswered": false
}
```

#### Analytics Integration

Analytics are automatically logged during chat processing:

1. **Model Selection**: Logged when a model is selected for a query
2. **Response Metrics**: Logged after response generation completes
3. **Cost Tracking**: Actual costs calculated and stored

### Testing

Run analytics-specific tests:

```bash
# Run all analytics tests
npm test -- --grep "analytics"

# Run specific analytics test file
npx mocha test/analytics-logger.test.js --require ./test/setup.js
```

### Monitoring

Analytics data can be monitored through:

- **Database Queries**: Direct SQL queries on `chat_message_analytics`
- **Application Logs**: Console output with analytics events
- **Performance Dashboards**: Custom dashboards using analytics data

## Development

### Environment Setup

1. Copy `.env.example` to `.env`
2. Configure required environment variables:
   - Database connection (Supabase)
   - OpenAI API key
   - Pinecone configuration

### Running the Server

```bash
# Development mode
npm run dev

# Production mode
npm start
```

### Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage
```

## Architecture

### Request Flow

1. **API Gateway** (`src/index.js`): Validates requests and routes to services
2. **RAG Service** (`src/rag-service.js`): Main processing pipeline
3. **Model Router**: Selects optimal AI model for the query
4. **Analytics Logger**: Records performance and selection data
5. **Response Generation**: Calls OpenAI/Pinecone APIs
6. **Post-processing**: Formats response and suggested questions

### Key Design Patterns

- **Dependency Injection**: Services receive dependencies through constructor injection
- **Middleware Pattern**: Express middleware for authentication, logging, error handling
- **Observer Pattern**: Analytics logging observes service operations without coupling
- **Strategy Pattern**: Different model selection strategies based on configuration

## Error Handling

The system includes comprehensive error handling:

- **Analytics Failures**: Don't break main chat flow
- **Model Selection Errors**: Graceful fallback to default model
- **Database Errors**: Logged but don't prevent responses
- **API Timeouts**: Configurable timeouts with retry logic

## Performance Considerations

- **Async Operations**: All I/O operations are asynchronous
- **Connection Pooling**: Database connections are pooled
- **Caching**: Model configurations and client data are cached
- **Token Limits**: Strict token budgeting to control costs
- **Timeout Management**: Prevents hanging requests

## Security

- **Input Validation**: All user inputs are validated and sanitized
- **Rate Limiting**: API endpoints include rate limiting
- **Authentication**: Client-specific authentication required
- **Data Isolation**: Multi-tenant data isolation enforced
- **Audit Logging**: All operations are logged for security monitoring