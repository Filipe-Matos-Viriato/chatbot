# Implementation Plan: Enriched Ingestion Service (V2)

## 1. Project Goal

To create a new, sophisticated and **highly-configurable** ingestion service (`ingestion-service_V2.js`). This service will operate on structured data from the Supabase `listings` table. Its primary goal is to enrich this data by generating precise, semantically-aware text chunks and metadata tags based on **client-specific rules** stored in the `clients` table. The generated data will be vectorized and upserted to Pinecone.

## 2. Core Architectural Principles

-   **Database-Driven Configuration:** All key logic, including prompts, dictionaries, and rules, will be dynamically loaded from the client's configuration in the Supabase `clients` table. This eliminates hard-coded logic and allows for per-client customization.
-   **Hybrid Tag Generation Process:**
    1.  **Configurable Chunking:** An LLM call breaks down listing descriptions into semantic chunks based on a client-defined prompt.
    2.  **Hybrid Tag Generation:** A sophisticated two-part process for creating a comprehensive and clean set of tags:
        -   **LLM-based Semantic Tagging:** The LLM analyzes the listing's free-text `description` to extract contextual and semantic tags (e.g., `location:near_beach`, `feature:natural_light`).
        -   **Programmatic Tagging:** The service programmatically converts key structured fields from the listing (e.g., `price`, `beds`, `baths`, `duplex`, `listing_status`) into standardized `key:value` tags.
        This hybrid approach ensures that all critical structured data is consistently tagged while leveraging the LLM for nuanced understanding of the unstructured text, and prevents data duplication.

## 3. Repurposing `clients` Table Columns

-   `chunking_rules` (JSONB): Will store the configuration for chunking, including the strategy (e.g., "propositional"), the system prompt for the LLM, and parameters like chunk overlap.
-   `tagging_rules` (JSONB): Will store the client-specific **Dictionary-Based Mapping** (canonical tags and their synonyms).
-   `document_extraction` (JSONB): Will store the client-specific **Rule-Based Normalization (Regex)** patterns.

---

## 4. Phased Implementation Plan

### **Phase 1: Core Logic & Service Implementation**

-   **[ ] Task 1.1: Create Service File & Basic Structure**
    -   **File:** `packages/backend/src/services/ingestion-service_V2.js`.
    -   **Structure:** Main function `processListings(clientId, developmentId = null, batchSize = 10)`.
    -   **Dependencies:** Supabase, OpenAI.

-   **[ ] Task 1.2: Implement Configurable Data Retrieval**
    -   Implement `fetchClientConfiguration(clientId)` to retrieve `chunking_rules`, `tagging_rules`, and `document_extraction` from the `clients` table.
    -   Implement `fetchListings(clientId, developmentId, batchSize)` to retrieve listings, filtering by `client_id` and optional `development_id`.

-   **[ ] Task 1.3: Handle Listings With and Without Descriptions**
    -   **With Description:** For listings with a `description`, proceed to the chunking step (1.4).
    -   **Without Description:**
        -   Create a single "metadata summary" chunk by calling `createMetadataSummary(listing)`.
        -   This chunk will be the only one embedded for this listing.
        -   Add a `"has_description": false` flag to the metadata to be created in the vector construction step (3.1).

-   **[ ] Task 1.4: Implement Configurable Propositional Chunking**
    -   Create `getPropositionalChunks(description, clientConfig)`.
    -   **Logic:** Use the prompt stored in `clientConfig.chunking_rules.prompt` to instruct the LLM on how to break down the description. Also consider the `chunk_overlap` parameter from this configuration.
    -   **Output:** An array of text chunks. Also, create the "metadata summary" chunk via `createMetadataSummary(listing)` and add it to the list of chunks to be embedded.

-   **[X] Task 1.5: Implement Hybrid Tag Generation**
    -   Update `generateEnrichedTags(listing, clientConfig)`.
    -   **LLM-based Semantic Tagging:**
        1.  The LLM is prompted to analyze only the free-text `description` of the listing.
        2.  `authoritative_tags` sent to the LLM now strategically exclude fields that are handled programmatically (like `price`, `beds`) or that cause duplication (like `amenities` and `type`) to ensure the LLM focuses on semantic extraction from text.
    -   **Programmatic Tagging:**
        1.  A new step is added within the function to iterate over a predefined list of structured fields (`price`, `beds`, `baths`, `duplex`, `listing_status`, `current_state`, `total_area`, `private_area`).
        2.  It programmatically creates `key:value` tags for each of these fields (e.g., `price:224910`, `beds:2`).
    -   **Tag Combination:** The function combines the tags from the LLM and the programmatic step into a single `generated_tags` array, using a `Set` to remove any potential duplicates.

-   **[ ] Task 1.6: Implement Embedding Generation**
    -   Create `createEmbeddings(chunks)` using the OpenAI `text-embedding-3-small` model for all generated text chunks.

### **Phase 2: Testing & Validation**

-   **[ ] Task 2.1: Create Flexible Test Script**
    -   **File:** `packages/backend/scripts/run-ingestion-v2.js`.
    -   **Argument Parsing:** Use `yargs` to accept `--clientId` (required) and `--developmentId` (optional).

-   **[ ] Task 2.2: Implement Comprehensive Logging**
    -   Add detailed `console.log` statements to show loaded configs, constructed prompts (including the diversity instruction), and the final generated data.

-   **[ ] Task 2.3: Manual Validation**
    -   Execute the script and review logs, paying special attention to the diversity and accuracy of the generated tags.

### **Phase 3: Pinecone Integration & Production Readiness**

-   **[X] Task 3.1: Implement Conditional Pinecone Upsert with Cleanup**
    -   **Control Flow:** The entire upsert process will be wrapped in a conditional block: `if (process.env.ENABLE_PINECONE_UPSERT === 'true') { ... }`.
    -   **Cleanup Step:** Before upserting new vectors, delete existing vectors for all processed listings using `deleteMany()` with metadata filter `{ listing_id: listingId }` to prevent stale data when listing information changes.
    -   **Namespace Targeting:** All Pinecone `upsert` operations will be directed to a specific namespace using `.namespace(clientId)`. This is critical for maintaining client data isolation.
    -   **Vector Construction:** For each chunk, a vector object will be created with the following structure:
        -   `id`: A unique string identifier. The format will be: `${listing.client_id}-${listing.id}-chunk-${chunkIndex}`.
        -   `values`: The numerical vector from the embedding model.
        -   `metadata`: A rich JSON object containing:
            -   `chunk_text`: The original text of the chunk itself (for RAG context).
            -   `client_id`, `listing_id`, `development_id`.
            -   All other authoritative tags from the Supabase `listings` table:
                id
                name
                address
                type
                price
                beds
                duplex
                baths
                amenities
                listing_status
                current_state
                total_area
                private_area
            -   A complete list of the `generated_tags` from the hybrid tag generation process.
            -   The `has_description` flag (if applicable).
            -   **Note:** This metadata structure is designed to support future re-ranking logic.
    -   **Batch Upserting:** The generated vectors will be collected into an array and upserted to Pinecone in batches of 100 to optimize performance.

-   **[ ] Task 3.2: Plan Production Integration (Future)**
    -   **Architectural Goal:** Document the design for a robust, queue-based system to ensure reliable, asynchronous processing.
    -   **Proposed Workflow:**
        1. A Supabase webhook on the `listings` table triggers a simple function.
        2. This function pushes a message containing the `listing_id` and `client_id` to a message queue (e.g., a dedicated Supabase table or AWS SQS).
        3. A separate worker process consumes messages from this queue and calls `ingestion-service_V2.js` to process the specific listing, guaranteeing that no updates are missed.

### **5. Future Enhancements**

-   **Programmatic Diversity Check:** If prompt-engineering for tag diversity proves insufficient, a more robust programmatic approach can be implemented. This would involve a post-processing step after the Unified NLP call:
    1.  Embed the list of generated tags.
    2.  Perform a similarity calculation on the tag embeddings.
    3.  For any cluster of tags that exceeds a similarity threshold, select only one representative tag and discard the others.
