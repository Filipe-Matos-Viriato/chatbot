# Detailed Implementation Plan: Dynamic Intent Recognition

This document outlines the step-by-step technical plan to refactor the intent recognition system, moving it from hardcoded logic in the source code to a dynamic, database-driven model.

### 1. Modify `packages/backend/src/utils/rag-parsing.js`

-   **Target Function:** `extractQueryFilters`
-   **Objective:** Replace hardcoded intent detection with a dynamic system that reads from `tagging_rules`.

**New Logic:**

1.  **Modify Return Value:** The function's return object will change.
    -   **From:** A flat object with boolean flags (e.g., `intent_query_bedroom_area: true`).
    -   **To:** An object containing an `intents` array (e.g., `intents: ["INSTRUÇÃO CRÍTICA..."]`).

2.  **Refactor the Core Loop:**
    -   Initialize `const filters = { intents: [] };` and `const matchedTags = [];`.
    -   Remove the static `if` statements for intent detection (currently lines 120-146).
    -   The main loop will iterate through the `taggingRules` object from the client configuration.
    -   For each `[key, value]` pair:
        -   **If `value` is an Array:** Treat as a **feature**. Check its keywords against the query. If a match is found, add the `key` to `matchedTags`.
        -   **If `value` is an Object:** Treat as an **intent**. Check `value.keywords` against the query. If a match is found, add `value.prompt_instruction` to the `filters.intents` array.
    -   After the loop, construct the `filters.generated_tags` property from the `matchedTags` array.
    -   Return the `filters` object, which now contains both feature filters and intent instructions.

### 2. Modify `packages/backend/src/rag-service.js`

-   **Target Function:** `generateResponse`
-   **Objective:** Dynamically inject prompt instructions received from `extractQueryFilters`.

**New Logic:**

1.  **Remove Static Injections:** Delete the hardcoded `if` blocks that check for boolean intent flags and append instructions (currently lines 591-602).

2.  **Implement Dynamic Injection:**
    -   After the main `systemPrompt` is constructed, access the `queryFilters.intents` array.
    -   Add the following logic:
        ```javascript
        if (queryFilters.intents && queryFilters.intents.length > 0) {
          systemPrompt += `\n\n${queryFilters.intents.join('\n\n')}`;
        }
        ```
    -   This will append all matched intent instructions from the database directly into the final prompt.

### 3. Database Migration

-   This step was completed manually by the user, who updated the `tagging_rules` in the `clients` table. No migration script is necessary.
