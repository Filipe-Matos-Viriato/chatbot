# System Architecture

## Overview
The application is a multi-tenant, enterprise-grade RAG (Retrieval-Augmented Generation) system designed to be sold as a service to different clients. It is architected as a monorepo with a Node.js backend and a React frontend.

- **Backend:** `packages/backend`
- **Frontend:** `packages/frontend` (includes the embeddable chat widget and will house the client dashboard)
- **Test Harness:** `packages/test-harness`

## Multi-Tenant Backend Architecture
The backend is a Node.js application using Express.js. Its primary responsibility is to serve a highly-configurable, multi-tenant RAG pipeline and manage client-specific configurations.

### Core Principles:
- **Multi-Tenancy by Default:** Every service is designed around a `client_id`. Data, configurations, and behavior are strictly partitioned by client.
- **Configuration Management:** Client-specific configurations are now stored in the **Supabase `clients` table**, enabling dynamic management and a future admin UI.
- **Modular Ingestion:** A flexible document ingestion pipeline allows for creating custom tagging and chunking workflows for each client's unique data sources.

### Core Components:
- **`src/index.js` (API Gateway):** The main entry point. It validates `client_id` on all incoming requests and routes them to the appropriate services.
- **Client Configuration Service (`src/services/client-config-service.js`):** Loads and serves client-specific configurations from the **Supabase `clients` table**. This governs everything from URL pattern matching for context extraction to fallback behavior.
- **`src/rag-service.js` (RAG Service):** Executes the RAG pipeline.
-   **Context-Filtered Retrieval:** It performs a **Hybrid Search** that is strictly filtered by `client_id` and, when available, `listing_id`, `development_id`, or **user-specific assigned listings** (for agents). It also now directly queries the Supabase `listings` table for aggregative data (e.g., min/max prices) when relevant queries are detected.
-   **Dynamic Prompt Construction:** Creates a detailed prompt using instructions and templates defined in the client's configuration, now also incorporating aggregated structured data from Supabase when applicable.
- **`src/services/user-service.js` (User Management Service):** Manages user accounts (admins and promoters) in the **Supabase `users` table** and their assigned listings in the **Supabase `agent_listings` table**. Provides CRUD operations and methods for fetching user-specific data.
- **Chat History for RAG:** Chat history turns are now stored in Pinecone for RAG context via `src/services/chat-history-service.js`. Each message embedding includes `visitor_id`, `client_id`, and `session_id` as metadata. Full text of chat history is referenced in Supabase.
- **Asynchronous Document Ingestion Pipeline:** A separate, configurable service responsible for:
  - **Source Processing:** Applying client-specific rules for chunking and tagging documents. This includes structured metadata ingestion, template-based chunking, and NLP-based analysis.
  - **Embedding & Upserting:** Generating vector embeddings and writing the data to the data to the vector database with rich metadata (`client_id`, `listing_id`, `development_id`, etc.).
- **`src/services/development-service.js` (Development Service):** Manages development records in Supabase.
- **Fallback & Notification Service:** Manages behavior when context validation fails (e.g., an invalid `listing_id`). Triggers admin notifications for critical errors like data sync issues.
- **`src/services/visitor-service.js` (Visitor Service):** Manages visitor sessions and tracks interactions for lead scoring.

### Lead Scoring & Visitor Tracking System
This system tracks visitor interactions and assigns a lead score to prioritize high-intent individuals. The lead score is a hybrid score (maximum 100 points) composed of three main components: Engagement Behavior, Question Intent & Quality, and Conversion Actions.

#### Scoring Components:

-   **Engagement Behavior (max 30 points):**
    -   Number of questions asked (3–5): +5 points
    -   Number of questions asked (6–10): +10 points
    -   Number of questions asked (10+): +15 points
    -   Time spent chatting (5–10 min): +5 points
    -   Time spent chatting (10+ min): +10 points
    -   Clicked on a listing: +5 points
    -   Returned to chat within 48h: +10 points

-   **Question Intent & Quality (max 40 points):**
    -   Asking about price, financing, or ROI: +10 points
    -   Asking about location, neighborhood, or schools: +10 points
    -   Asking about legal process, taxes, or documentation: +10 points
    -   Asking about remote buying or investment options: +10 points
    -   Asking about property details, condition, amenities, or layout: +5 points
    -   Asking about availability or urgency: +5 points

-   **Conversion Actions (max 30 points):**
    -   Submitted contact info: +15 points
    -   Booked a property viewing: +30 points
    -   Asked to be contacted by an agent: +20 points
    -   Requested a brochure or floor plan: +10 points

#### Lead Qualification Thresholds:

-   **Hot Lead (70–100 pts):** Ready for agent follow-up or direct sales.
-   **Warm Lead (40–69 pts):** Nurture with follow-up content or offers.
-   **Cold Lead (<40 pts):** Keep in CRM for future re-engagement.

- **Visitor Data Storage:** Visitor data, including `visitor_id`, `client_id`, `lead_score`, timestamps, and interaction `events`, is now persistently stored in **Supabase** (PostgreSQL database).
- **Lead Scoring Rules:** Now retrieved from the `clients` table in Supabase.
- **API Endpoints:**
    - `POST /v1/sessions`: Creates a new visitor record and returns a unique `visitor_id`.
    - `POST /v1/events`: Logs an interaction event and updates the corresponding visitor's lead score.
    - **User Management Endpoints:** New API endpoints for CRUD operations on users, fetching users/agents by client, and managing agent-listing assignments.

### Visitor Interaction Data Updates:
Tables updated based on real visitor interactions include:
- **Visitors Database (Supabase):** Stores `visitor_id`, `client_id`, `lead_score`, timestamps, and `is_acknowledged` (for new hot leads tracking). Updated via `POST /v1/sessions` (new visitor records), `POST /v1/events` (logging events and updating lead scores), and `POST /v1/leads/acknowledge` (marking hot leads as acknowledged).
- **Events:** Records specific visitor actions and chatbot responses, including associated `listing_id` and `development_id`.
- **Questions:** Tracks user queries for analysis and lead scoring.
- **Handoffs (if applicable):** Records instances where a conversation is escalated or handed off to a human agent.
- **Listing Metrics:** Tracks engagement and performance metrics per listing, updated as visitors interact with specific listings. Now includes `engaged_users` (unique visitors who interacted with the chatbot), `total_conversions` (sum of conversion actions), `conversion_rate` (`total_conversions / engaged_users`), `unacknowledged_hot_leads`, `lead_score_distribution_hot`, `lead_score_distribution_warm`, and `lead_score_distribution_cold`.

### Data Flow & Logic:
```mermaid
graph TD
    subgraph Client-Side
        A[Client Webpage] -- iframe --> B{Chatbot Frontend};
        A -- "URL with Listing ID" --> B;
    end

    subgraph Backend Services
        B -- "POST /chat (query, client_id, listing_id?)" --> C{API Gateway / Main Server};
        C -- "Validate client_id, listing_id" --> D[Client Config Service];
        D -- "Return Config" --> C;
        C -- "If valid, construct query" --> E[RAG Service];
        C -- "If invalid, trigger fallback" --> F[Fallback Service];
        F -- "Notify Admin" --> G((Admin Notifications));
        
        B -- "POST /v1/sessions (clientId)" --> C;
        B -- "POST /v1/events (visitorId, eventType, scoreImpact)" --> C;
        C -- "Create Visitor" --> H[Visitor Service];
        C -- "Log Event / Update Score" --> H;
        H -- "Stores/Updates" --> I[(Visitors Database <br> Supabase)];

        subgraph User Management
            U[Admin/Promoter Dashboard] -- "API Calls" --> C;
            C -- "Manage Users" --> V[User Service];
            C -- "Manage Client Configs" --> D;
            V -- "Stores/Updates" --> W[(Users Database <br> Supabase)];
            V -- "Stores/Updates" --> X[(Agent Listings Database <br> Supabase)];
            D -- "Stores/Updates" --> Y[(Clients Database <br> Supabase)];
        end
    end

    subgraph Data & Ingestion
        J[Data Sources] -- "Manual/Scheduled" --> K{Document Ingestion Pipeline};
        Z[Admin] -- "Manages" --> Y;
        Y -- "Drives" --> K;
        K -- "Chunk, Tag, Embed" --> N[(Vector DB <br> Pinecone)];
        E -- "Hybrid Search with client_id, listing_id, development_id, user_id filters" --> N;
        C -- "Aggregative Queries (e.g., min/max price)" --> S[(Supabase <br> Listings Table)];
        S -- "Aggregated Data" --> E;
    end

    style G fill:#f9f,stroke:#333,stroke-width:2px
    style I fill:#f9f,stroke:#333,stroke-width:2px
    style W fill:#f9f,stroke:#333,stroke-width:2px
    style X fill:#f9f,stroke:#333,stroke-width:2px
    style Y fill:#f9f,stroke:#333,stroke-width:2px
```

### Client-Managed Data Ingestion
The system allows clients to manage their own knowledge bases directly from their dashboard, ensuring data is always current.

#### Ingestion Workflow
Clients can upload two types of documents:
- **Listing-Specific:** Tied to a unique `listing_id` and `listing_url`. This is the default and recommended option.
- **Development-Specific:** Tied to a unique `development_id`.
- **General:** Account-wide documents (e.g., company FAQs) not tied to a specific listing or development. The `listing_id` and `development_id` are stored as `null`.

The frontend UI includes confirmation dialogues to prevent miscategorization. On the backend, an asynchronous worker processes these submissions, chunks and tags the content based on client rules, and **simultaneously updates the Supabase `listings` table with extracted structured metadata and upserts the vectors into Pinecone** with the appropriate `{ client_id, listing_id, development_id }` metadata.

#### Retrieval Logic
The RAG service uses a refined retrieval strategy to ensure comprehensive and context-aware responses. When a query is received:

-   **If a `listing_id` is present in the external context:**
    1.  A **targeted search** is performed to retrieve chunks specifically matching that `listing_id`.
    2.  If an associated `development_id` is also present, an additional **targeted search** is performed for documents matching that `development_id`.
    3.  A **broad search** is also performed to retrieve general documents (where `listing_id` and `development_id` are `null`) and other relevant documents that match query filters (e.g., for comparative queries).
    4.  Results from all targeted and broad searches are combined and re-ranked to form the context for the generative model. This ensures that specific listing details are prioritized, followed by development details, while still allowing for broader comparisons and general information retrieval.

-   **If only a `development_id` is present in the external context:**
    1.  A **targeted search** is performed to retrieve chunks specifically matching that `development_id`.
    2.  A **broad search** is also performed.
    3.  Results are combined and re-ranked.

-   **If no `listing_id` or `development_id` is present (e.g., on the homepage):**
    1.  A **broad search** is performed to retrieve relevant documents based on the query and any extracted filters.

```mermaid
graph TD
    subgraph Client Dashboard
        A[Client User] --> B{Select Upload Type<br>('Listing', 'Development' or 'General')};
        B --> C{Confirmation Popup};
        C --> D{Fill Metadata<br>('listing_id' or 'development_id' if required)};
        D -- "Upload" --> E[API Gateway];
    end

    subgraph Backend
        E -- "Adds to" --> F[Ingestion Queue];
        G[Async Worker] -- "Processes job" --> F;
        G -- "Extracts structured metadata" --> I[(Supabase <br> Listings Table)];
        G -- "Upserts vector with metadata<br>(listing_id: '123' or null, development_id: 'dev-456' or null)" --> H[(Vector DB)];
    end

    subgraph RAG Service (Query Time)
        I[User Query] --> J{RAG Service};
        J -- "If listing_id present" --> K{Targeted Search<br>(listing_id)};
        J -- "If development_id present" --> L{Targeted Search<br>(development_id)};
        J -- "Always" --> M{Broad Search<br>(general/filtered)};
        K --> N[Combine Results];
        L --> N;
        M --> N;
        N --> O[Re-rank & Generate Response];
        O --> P((Chatbot Response));
    end

    style A fill:#f9f,stroke:#333,stroke-width:2px
    style I fill:#f9f,stroke:#333,stroke-width:2px
    style H fill:#f9f,stroke:#333,stroke-width:2px
    style P fill:#f9f,stroke:#333,stroke-width:2px
end
```

#### Automated Tagging Strategies
The ingestion pipeline is designed to support a multi-tiered approach to automated tagging, allowing for flexibility and future expansion.

- **Standard Tagging (Default):** At a minimum, every document chunk is automatically tagged with its essential context: `client_id`, `listing_id` (which is `null` for general or development documents), and `development_id` (which is `null` for general or listing documents). This forms the foundation for context-aware retrieval.

- **Client-Configured Rules:** The system allows clients to define their own custom tagging rules within their configuration stored in the `clients` table. This could include keyword or regex-based rules to tag content based on their specific data patterns (e.g., tagging chunks containing "price" with a "pricing" tag).

- **Premium LLM-based Tagging (Future):** The architecture is designed to accommodate a premium tier for automated tagging using a Large Language Model (LLM). When enabled, this feature would send document chunks to an LLM with a specialized prompt to perform sophisticated NLP tasks, such as named entity recognition (extracting amenities, locations) and topic modeling, returning a rich set of structured tags. This will be offered as an opt-in, premium feature due to its higher computational cost.

- **Flexible Metadata Extraction:** To handle varied client document structures, the ingestion pipeline now supports flexible metadata extraction for fields like `listings.name` and `listings.baths`. This leverages client-specific configurations (regex patterns) defined in their JSON configuration files (`documentExtraction` section).

## Frontend Architecture
The frontend remains a React/Vite SPA, but it will be enhanced to:
- Pass a hardcoded or dynamically retrieved `client_id` with every backend request.
- Potentially receive UI configuration details (colors, logos, welcome messages) from the backend based on the client configuration.

## Admin & Client Dashboards

### Client Dashboard (Vision)
A dedicated dashboard for each client to provide actionable insights into chatbot usage and performance. Key features will include:
- **Usage Analytics:** General and listing-specific metrics on conversation volume, user engagement, etc.
- **Content Insights:** Reports on the most common unanswered questions to identify gaps in the knowledge base.
- **Performance Metrics:** Tracking the most frequently asked topics per listing.
- **Conversation History:** Access to full conversation transcripts for quality assurance.
- **User Roles & Data Access (Future):**
  - **Administrator:** Access to all data for their client (`client_id` filtered).
  - **Agent:** Access to data filtered by `client_id` and `agent_id`.

### Admin Controls & Feature Flags
The system is designed to be managed by the service provider through the "configuration-as-code" principle.
- **Centralized Configuration:** All client-specific settings, including the chatbot's "role" and behavior (`systemInstruction`), are now stored in the **Supabase `clients` table**.
- **Feature Flags:** Features, such as enabling user feedback (e.g., thumbs up/down), can be turned on or off via boolean flags stored in the `clients` table. This allows for creating different service tiers and customizing functionality without code changes.
- **Admin UI:** The database-driven configuration serves as the backend for a future web-based admin dashboard, which will provide a user-friendly interface for managing these settings.