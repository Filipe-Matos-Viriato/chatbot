# Enterprise RAG Chatbot Platform

An enterprise-grade chatbot platform built with React, Node.js, and advanced AI capabilities. This system provides multi-tenant support, real-time analytics, lead scoring, and document-based question answering for real estate agencies.

## 🏗️ Architecture Overview

The platform consists of three main packages:

- **Backend**: Node.js/Express API with RAG (Retrieval Augmented Generation) capabilities
- **Frontend**: React dashboard with comprehensive analytics and chat interface
- **Test Harness**: Development testing environment

## 🚀 Key Features

### 🤖 AI-Powered Chat
- **RAG Pipeline**: Context-aware responses using Pinecone vector database
- **Document Ingestion**: PDF processing for property listings and general information
- **Multi-language Support**: Configurable for different languages
- **Fallback Handling**: Graceful degradation when information isn't available

### 🏢 Multi-Tenant Architecture
- **Client Configurations**: JSON-based per-client customization
- **Brand Customization**: Colors, fonts, messages, and prompts
- **URL Pattern Matching**: Automatic context detection from URLs
- **Lead Scoring Rules**: Configurable scoring algorithms per client

### 📊 Advanced Analytics
- **Real-time Dashboard**: Performance metrics and insights
- **Lead Performance**: Conversion tracking and qualification metrics
- **Listing Analytics**: Property-specific performance data
- **User Insights**: Visitor behavior and engagement analysis
- **Question Clustering**: AI-powered question categorization

### 🎯 Lead Management
- **Behavioral Scoring**: Points-based lead qualification
- **Event Tracking**: User interaction monitoring
- **Hot Lead Alerts**: Real-time notifications for high-value prospects
- **Conversion Tracking**: Multi-stage funnel analysis

## 🛠️ Technology Stack

### Backend
- **Runtime**: Node.js with Express.js
- **Database**: Supabase (PostgreSQL)
- **Vector Store**: Pinecone
- **AI Services**: Google Generative AI (Gemini 2.5 Flash)
- **Document Processing**: PDF-parse, Mammoth (for Word docs)
- **Scheduling**: Node-cron for automated tasks

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI primitives
- **Charts**: Chart.js with React wrapper
- **Routing**: React Router v7

### Infrastructure
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **Deployment**: Vercel-ready configuration
- **Monitoring**: Built-in logging and error handling

## 📋 Database Schema

### Core Tables
- `listings`: Property information and metadata
- `listing_metrics`: Performance metrics per property
- `visitors`: User sessions with lead scores
- `events`: User interaction tracking
- `questions`: User queries with embeddings
- `clustered_questions`: AI-grouped common questions
- `handoffs`: Chat escalations to human agents

## 🚦 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- Pinecone account
- Google AI API key

### Environment Variables

Create `.env` files in both backend and frontend packages:

**Backend (.env)**
```env
# Database
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AI Services
GOOGLE_API_KEY=your_google_ai_key
PINECONE_API_KEY=your_pinecone_key
PINECONE_INDEX_NAME=your_index_name
PINECONE_NAMESPACE=your_namespace

# Server
PORT=3006
```

**Frontend (.env)**
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_API_URL=http://localhost:3006
```

### Installation

1. **Clone and Install**
```bash
git clone <repository-url>
cd chatbot
npm install
```

2. **Setup Database**
```bash
# Create database tables
cd packages/backend
node scripts/create-supabase-tables.js

# Create question embeddings table
node scripts/create-question-embeddings-table.js

# Create clustered questions table
node scripts/create-clustered-questions-table.js

# Populate with test data (optional)
node scripts/ingest-test-data.js
```

3. **Start Development**
```bash
# Terminal 1: Start backend
npm run start:backend

# Terminal 2: Start frontend
npm run dev

# Terminal 3: Start test harness (optional)
npm run start:harness
```

## 📁 Project Structure

chatbot/
├── packages/
│ ├── backend/ # Node.js API server
│ │ ├── configs/ # Client configurations
│ │ │ └── client-abc.json # Example client config
│ │ ├── scripts/ # Database and utility scripts
│ │ │ ├── create-supabase-tables.js
│ │ │ ├── cluster-questions.js
│ │ │ ├── ingest-test-data.js
│ │ │ └── populate-.js
│ │ ├── src/
│ │ │ ├── config/ # Database connections
│ │ │ │ └── supabase.js
│ │ │ ├── services/ # Business logic
│ │ │ │ ├── client-config-service.js
│ │ │ │ ├── ingestion-service.js
│ │ │ │ └── visitor-service.js
│ │ │ ├── index.js # Express server
│ │ │ └── rag-service.js # AI/RAG implementation
│ │ └── test-data/ # Sample PDFs
│ ├── frontend/ # React dashboard
│ │ ├── src/
│ │ │ ├── chatbot/ # Chat interface
│ │ │ │ └── ChatInterface.jsx
│ │ │ ├── dashboard/ # Analytics components
│ │ │ │ ├── overview-tab/
│ │ │ │ ├── lead-performance-tab/
│ │ │ │ ├── listing-performance-tab/
│ │ │ │ ├── chatbot-analytics-tab/
│ │ │ │ └── user-insights-tab/
│ │ │ ├── components/ # Reusable UI components
│ │ │ │ └── ui/
│ │ │ └── config/ # Configuration
│ │ │ └── supabaseClient.js
│ │ └── public/ # Static assets
│ └── test-harness/ # Development testing
└── package.json # Workspace configuration

## 🔧 Configuration

### Client Setup

Each client requires a configuration file in `packages/backend/configs/`:

```json
{
  "clientId": "client-abc",
  "chatbotName": "PropertyBot",
  "theme": {
    "primaryColor": "#007bff",
    "secondaryColor": "#6c757d",
    "fontFamily": "Arial, sans-serif"
  },
  "urlPattern": "https://example-client.com/listings/(?<listingId>[a-zA-Z0-9-]+)",
  "prompts": {
    "systemInstruction": "You are a helpful assistant for the real estate agency...",
    "fallbackResponse": "I'm sorry, I can't find specific information..."
  },
  "leadScoringRules": {
    "engagementBehavior": {
      "questions_3_5": 5,
      "questions_6_10": 10,
      "time_5_10_min": 5,
      "clicked_listing": 5
    },
    "questionIntentQuality": {
      "asked_pricing": 10,
      "asked_location": 10,
      "asked_details": 5
    },
    "conversionActions": {
      "submitted_contact": 15,
      "booked_viewing": 30,
      "asked_contact_agent": 20
    }
  }
}
```

### Document Ingestion

Upload documents via the API:

```bash
curl -X POST http://localhost:3006/api/ingest/file \
  -H "x-client-id: client-abc" \
  -F "file=@document.pdf" \
  -F "ingestionType=listing" \
  -F "listingId=ap-01" \
  -F "listingUrl=https://example.com/listings/ap-01"
```

## 📊 API Endpoints

### Chat & AI
- `POST /api/chat` - Send chat message and get AI response
- `POST /api/suggested-questions` - Get suggested questions
- `GET /api/common-questions` - Get clustered common questions

### Session Management
- `POST /v1/sessions` - Create visitor session
- `POST /v1/events` - Log visitor events
- `POST /v1/visitor` - Get visitor information
- `POST /v1/leads/acknowledge` - Acknowledge hot leads

### Analytics
- `GET /api/listing/:id` - Get listing details and metrics

### Configuration
- Widget config endpoint (to be implemented)

## 🧪 Testing

The project includes a test harness for development:

```bash
npm run start:harness
```

This provides a minimal testing environment for the chat functionality.

## 🔄 Background Jobs

The system runs scheduled tasks:

- **Question Clustering**: Hourly analysis of user questions
- **Lead Scoring**: Real-time calculation based on user behavior
- **Metrics Updates**: Automatic performance metric calculations

## 📈 Analytics Features

### Overview Dashboard
- Total leads generated
- Conversion rates
- Hot leads alerts
- Chatbot resolution rates
- Average chat duration

### Lead Performance
- Lead qualification metrics
- Conversion rate thresholds
- Individual lead progression
- Lead score distribution

### Listing Analytics
- Property-specific performance
- Common questions per listing
- Unanswered questions tracking
- Chat handoff analysis

### User Insights
- New vs returning users
- Recent chat histories
- Engagement patterns

## 🚀 Deployment

The project is configured for Vercel deployment:

1. **Environment Setup**: Configure all environment variables in Vercel
2. **Database**: Ensure Supabase is properly configured
3. **Build Process**: Uses npm workspaces for optimized builds
4. **Static Assets**: Frontend builds to `dist/` directory

## 🤝 Contributing

1. Follow the existing code structure
2. Add tests for new features
3. Update documentation for API changes
4. Use TypeScript for new components (migration in progress)

## 📝 License

This project is licensed under UNLICENSED - see the package.json for details.

## 🆘 Support

For support and questions:
1. Check the existing documentation
2. Review the example configurations
3. Test with the provided test harness
4. Contact the development team

---

**Note**: This is an enterprise-grade system designed for real estate agencies. Ensure proper configuration and testing before production deployment.
