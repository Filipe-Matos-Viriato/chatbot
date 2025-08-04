# Chatbot Latency Improvement PRD

## 1. Executive Summary

**Problem**: The chatbot's response time is approaching 4 seconds, creating a noticeable delay for the user. This latency is primarily caused by sequential, blocking network calls in the backend to various services, including the Pinecone vector database and the OpenAI API.

**Solution**: This document outlines a two-phased plan to significantly reduce both actual and perceived latency.
*   **Phase 1** focuses on immediate, high-impact backend optimizations by parallelizing independent network calls.
*   **Phase 2** introduces response streaming, a more advanced technique that will dramatically improve the user's perception of speed by showing an immediate response.

**Goal**: Reduce the end-to-end response time to under 2 seconds and improve the time-to-first-token to under 500ms.

---

## 2. Problem Analysis

### 2.1. Sequential Database Queries
- **Location**: `performHybridSearch` function in `packages/backend/src-rag-service.js`.
- **Issue**: The function makes up to three separate `await` calls to the Pinecone database sequentially (for listing, development, and broad context). The total wait time is the sum of all three queries.
- **Impact**: This is a major contributor to backend processing time, adding unnecessary delay.

### 2.2. Sequential Initial Data Calls
- **Location**: `/api/chat` handler in `api/index.js`.
- **Issue**: The handler first `await`s the result of fetching chat history from Pinecone, and only then calls `generateResponse`, which in turn makes another `await` call to get the query embedding from OpenAI. These are independent operations that can be run concurrently.
- **Impact**: This adds another layer of sequential delay before the main response generation can even begin.

### 2.3. Lack of Response Streaming
- **Location**: `generateResponse` function in `packages/backend/src-rag-service.js` and the frontend chat interface.
- **Issue**: The application waits for the OpenAI API to generate the *entire* response before sending anything back to the user.
- **Impact**: The user sees no activity for several seconds, making the chatbot feel slow, even if the total generation time is reasonable.

---

## 3. Implementation Plan

### PHASE 1: Backend Parallelization (High Priority)

#### Task 1.1: Parallelize Pinecone Queries in `performHybridSearch`
**Objective**: Reduce the database query time from the sum of all queries to the time of the single longest query.

**Implementation**:
- [ ] **Refactor `performHybridSearch` in `packages/backend/src/rag-service.js`**.
- [ ] **Identify Independent Queries**: Isolate the Pinecone queries for `contextListingId`, `contextDevelopmentId`, and the broad search.
- [ ] **Execute in Parallel**: Use `Promise.all` to launch all three queries simultaneously.
- [ ] **Process Results**: Await the results from `Promise.all` and then process the resolved data (targeted matches, development matches, broad matches) as is currently done.

**Files to Modify**:
- `packages/backend/src/rag-service.js`

**Acceptance Criteria**:
- The three Pinecone queries are executed in parallel.
- The chatbot's response time is measurably reduced, especially in scenarios involving both listing and development context.

#### Task 1.2: Parallelize Initial Data Fetching in Chat Endpoint
**Objective**: Reduce the initial wait time before the main RAG process begins.

**Implementation**:
- [ ] **Refactor the `/api/chat` handler in `api/index.js`**.
- [ ] **Identify Independent Calls**: The `chatHistoryService.getVisitorChatHistory()` call and the `openai.embeddings.create()` call (inside `generateResponse`) are independent.
- [ ] **Execute in Parallel**: Move the embedding creation call out of `generateResponse` and into the `/api/chat` handler. Run it in parallel with the chat history retrieval using `Promise.all`.
- [ ] **Pass Results**: Pass the pre-fetched chat history and query embedding to the `generateResponse` function.

**Files to Modify**:
- `api/index.js`
- `packages/backend/src/rag-service.js` (to accept the pre-computed embedding)

**Acceptance Criteria**:
- Chat history retrieval and query embedding happen concurrently.
- The time between receiving a request and calling the main OpenAI completion is reduced.

---

### PHASE 2: Response Streaming (Medium Priority)

#### Task 2.1: Implement Backend Support for Streaming
**Objective**: Modify the backend to stream responses from the OpenAI API directly to the client.

**Implementation**:
- [ ] **Update OpenAI Call**: In the `generateResponse` function in `rag-service.js`, change the `openai.chat.completions.create` call to include the `stream: true` parameter.
- [ ] **Modify `/api/chat` Handler**:
    - Instead of `await`ing the full response from `generateResponse`, handle the returned stream.
    - Set the appropriate `Content-Type` header for a streaming response (`text/event-stream`).
    - Pipe the data from the OpenAI stream directly to the `res` object.

**Files to Modify**:
- `packages/backend/src/rag-service.js`
- `api/index.js`

**Acceptance Criteria**:
- The `/api/chat` endpoint successfully streams token-by-token responses from OpenAI.

#### Task 2.2: Implement Frontend Handling of Streamed Responses
**Objective**: Update the chat interface to render the AI's response as it arrives.

**Implementation**:
- [ ] **Refactor API Call**: In `packages/frontend/src/chatbot/ChatInterface.jsx`, change the `fetch` call to handle a streamed response body (`response.body.getReader()`).
- [ ] **Update State Token-by-Token**: As each chunk of data (token) is received from the stream, append it to the message being displayed in the UI.
- [ ] **Handle Stream Completion**: When the stream is finished, finalize the message state.

**Files to Modify**:
- `packages/frontend/src/chatbot/ChatInterface.jsx`

**Acceptance Criteria**:
- The user sees the chatbot's response appearing on-screen almost instantly after sending a message.
- The perceived latency is significantly reduced.
