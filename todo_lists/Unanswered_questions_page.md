# Feature: Unanswered Questions Review Page

## 1. Project Goal & Business Value

**Goal:** To create a centralized and intelligent interface for client administrators and agents to review, manage, and respond to user questions that the chatbot could not answer.

**Business Value:**
-   **Improve Chatbot Accuracy:** Directly address knowledge gaps by turning unanswered questions into new knowledge base content.
-   **Increase Lead Conversion:** Re-engage potential customers by providing timely and accurate answers to their specific questions.
-   **Enhance Customer Satisfaction:** Demonstrates proactive support and closes the communication loop with users.
-   **Boost Operational Efficiency:** Streamlines the process for support staff and agents to handle chatbot escalations.

---

## 2. Functional & Non-Functional Requirements

### Functional Requirements:
-   The system must provide a unified page to view unanswered questions.
-   The page must be accessible from both the main "Overview" dashboard and individual "Listing Details" pages.
-   The view must be context-aware, filtering by a specific `listing_id` when accessed from a listing page.
-   The system must enforce Role-Based Access Control (RBAC):
    -   **Administrators** can view all unanswered questions for their client.
    -   **Agents/Promoters** can only view questions related to their specifically assigned listings.
-   Users must be able to mark questions as "Resolved".
-   Users must be able to flag questions as "Requires KB Update".
-   Users must be able to compose and send direct replies to visitors via Email and SMS/WhatsApp if contact information is available.
-   The reply composition interface must include optional AI-powered assistance:
    -   "Suggest Answer" button to generate a draft reply.
    -   "Improve Answer" button to refine a manually written draft.
-   The system must be configurable per client to either allow immediate `Add to KB` or require an approval workflow.

### Non-Functional Requirements:
-   **Security:** All API endpoints must be secure, enforcing RBAC at the backend/database level. Data must be segregated by client and, where applicable, by agent.
-   **Performance:** The page must load quickly, even with thousands of unanswered questions. API queries must be optimized, and frontend rendering should use pagination.
-   **Usability:** The interface must be intuitive, minimizing clicks required to perform common actions (resolving, replying, flagging).
-   **Scalability:** The architecture for both the database and backend services must handle a growing volume of questions and communication events.
-   **Extensibility:** The design should allow for future integration of new communication channels (e.g., Facebook Messenger) and more advanced analytics.

---

## 3. Phased Implementation Plan

### Phase 1: Core Review & Action Framework (MVP)

This phase focuses on building a secure, functional, and valuable tool for reviewing and actioning questions.

#### **Step 1: Backend - Database Schema Changes**
-   **Location**: `packages/backend/supabase_sql_tables/`
-   **Task 1.1**: Modify the `visitors` table.
    -   Add a `phone` (text, nullable) column.
-   **Task 1.2**: Modify the `chat_messages` table.
    -   Add `requires_kb_update` (boolean, default `false`).
    -   Add `answered_by_user_id` (UUID, nullable, foreign key to `users.id`).
    -   Add `resolution_notes` (text, nullable).
    -   Add `follow_up_sent_at` (timestamp, nullable).
    -   Add `follow_up_channel` (text, nullable, e.g., 'email', 'sms').

#### **Step 2: Backend - API Development**
-   **Location**: `packages/backend/src/index.js` and new service files.
-   **Task 2.1**: Create a new service `unanswered_question_service.js`.
-   **Task 2.2**: Develop `GET /api/unanswered-questions` endpoint.
    -   Must accept `listingId` (optional), `dateRange`, `searchQuery`, `status` as query parameters.
    -   **CRITICAL**: Implement mandatory RBAC. The service must check the user's role. If 'promoter', it will fetch their assigned listings and inject a `WHERE listing_id IN (...)` clause into the main query.
    -   The query should join with the `visitors` table to fetch the visitor's email and phone number.
    -   Implement efficient pagination (`page`, `pageSize`).
-   **Task 2.3**: Develop `POST /api/unanswered-questions/:id/status` endpoint.
    -   Accepts a payload like `{ status: 'resolved' | 'kb_update_needed', notes: '...' }`.
    -   Updates `is_unanswered`, `requires_kb_update`, `answered_by_user_id`, and `resolution_notes` fields.
    -   Must verify the user has permission to update the question for that listing.
-   **Task 2.4**: Create a new service `communication_service.js`.
    -   This service will contain placeholder functions like `sendEmail(to, subject, body)` and `sendSms(to, body)`. It will log to the console for the MVP.
-   **Task 2.5**: Develop `POST /api/unanswered-questions/:id/reply` endpoint.
    -   Accepts `{ channel: 'email' | 'sms', message: '...' }`.
    -   Retrieves visitor contact info.
    -   Calls the relevant function in `communication_service.js`.
    -   On success, updates `is_unanswered` to `false` and logs the follow-up in `follow_up_sent_at` and `follow_up_channel`.
-   **Task 2.6**: Develop `POST /api/ai/suggest-reply` and `POST /api/ai/improve-reply` endpoints.
    -   These will call the LLM with specific prompts to generate or refine text. They will take a user's question (and chat history) or a draft response as input.

#### **Step 3: Frontend - Component & Page Development**
-   **Location**: `packages/frontend/src/dashboard/`
-   **Task 3.1**: Create a new folder `unanswered-questions-tab/`.
-   **Task 3.2**: Create the main page component `UnansweredQuestionsPage.jsx`.
    -   It will use `react-router`'s `useSearchParams` to detect `listingId` and set the initial state.
-   **Task 3.3**: Create a `QuestionTable.jsx` component.
    -   Displays questions with columns for `Question`, `Listing`, `Date`, `Visitor Contact`, and `Actions`.
    -   Contact info should be partially masked (e.g., `test@****.com`).
    -   Includes pagination controls.
-   **Task 3.4**: Create a `FilterSidebar.jsx` component.
    -   Includes a date picker, search input, and status toggles.
    -   The "Listing" dropdown is only rendered if the user is an Admin and no `listingId` is in the URL.
-   **Task 3.5**: Create a `ReplyModal.jsx` component.
    -   This modal opens when a user clicks a "Reply" button in the table.
    -   It displays the visitor's question and contact info.
    -   Contains a large textarea for the reply.
    -   Includes the "Suggest Answer" and "Improve Answer" buttons.
    -   Includes "Send via Email" and "Send via SMS" buttons (disabled if contact info is missing).
-   **Task 3.6**: Implement State Management (e.g., using `useState`, `useEffect`) to fetch data from the new APIs and manage filters, pagination, and modal state.

#### **Step 4: Frontend - Navigation Integration**
-   **Task 4.1**: Update `packages/frontend/src/App.jsx` or router config to include the new `/dashboard/unanswered-questions` route.
-   **Task 4.2**: In `UnansweredQuestions.jsx` (`packages/frontend/src/dashboard/listing-performance-tab/components/listing-details/`), add an `onClick` handler to the "Review All Unanswered Questions" button that navigates to the new page with the correct `listingId`.
-   **Task 4.3**: In `UnansweredQuestionsMetric.jsx` (`packages/frontend/src/dashboard/overview-tab/metrics/`), make the card clickable and navigate to the new page without a `listingId`.

---

### Phase 2: Advanced Workflow & Automation

-   **Task 5.1**: Implement the full "Add to Knowledge Base" feature with a client-configurable approval workflow.
-   **Task 5.2**: Implement UI for bulk actions (selecting multiple questions in the table and applying a status update).
-   **Task 5.3**: Integrate real Email/SMS services (e.g., SendGrid, Twilio) into `communication_service.js`.
-   **Task 5.4**: Create a "Templates" feature allowing users to save and reuse common replies.

---

### Phase 3: Analytics & Insights

-   **Task 6.1**: Develop backend asynchronous jobs to analyze and cluster unanswered questions to identify common themes.
-   **Task 6.2**: Build UI dashboard widgets to display trends and theme analysis.
-   **Task 6.3**: Implement analytics to track resolution rates and average time-to-resolve.