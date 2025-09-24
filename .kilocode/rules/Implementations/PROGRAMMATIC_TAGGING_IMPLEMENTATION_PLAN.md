# Detailed Implementation Plan: Programmatic Feature Tagging

**Objective:** Modify the `ingestion-service_V2.js` to programmatically add feature tags based on structured listing data and the client's `tagging_rules`. This will ensure data integrity and enable reliable, keyword-driven filtering.

**Target File:** `packages/backend/src/services/ingestion-service_V2.js`
**Target Function:** `generateEnrichedTags`

---

#### Step 1: Create a New Helper Function `generateProgrammaticFeatureTags`

To keep the logic clean and modular, I will create a new helper function within `ingestion-service_V2.js`.

**Function Signature:** `function generateProgrammaticFeatureTags(listing, taggingRules)`

**Logic:**
1.  Initialize an empty array, `featureTags`.
2.  For each feature tag (e.g., `feature:bathroom`), we need a way to map it back to a structured field in the `listing` object. Since the `tagging_rules` don't contain this mapping, we will have to create a simple, hardcoded map inside this function for now. This is not ideal, but it's a pragmatic first step. A future improvement could be to store this mapping in the client configuration as well.

    *Example Internal Mapping:*
    ```javascript
    const featureToFieldMap = {
      'feature:bathroom': 'baths',
      'feature:pool': 'amenities', // Check if 'pool' is in the amenities string
      'feature:suite': 'amenities', // Check if 'suite' is in the amenities string
      'comodidade:garagem': 'amenities', // etc.
    };
    ```
3.  Iterate through the `featureToFieldMap`. For each `[tag, field]` pair:
    *   Check if the `field` exists in the `listing` object.
    *   If the field is numerical (e.g., `baths`), the logic will be: `if (listing[field] > 0) { featureTags.push(tag); }`.
    *   If the field is boolean (e.g., `duplex`), the logic will be: `if (listing[field]) { featureTags.push(tag); }`.
    *   If the field is a string (e.g., `amenities`), we must check if any of the associated keywords for that tag are present in the string. We'll need to find the keywords from the `taggingRules` that correspond to the current `tag`.
        *   `const keywords = taggingRules[tag];`
        *   `if (keywords && Array.isArray(keywords) && keywords.some(kw => listing[field].toLowerCase().includes(kw))) { featureTags.push(tag); }`
4.  Return the `featureTags` array.

---

#### Step 2: Integrate the New Function into `generateEnrichedTags`

I will modify the `generateEnrichedTags` function to call our new helper and merge the results.

**New Logic Flow:**
1.  The function will continue to perform the LLM-based semantic tagging and the existing programmatic `key:value` tagging as it does now.
2.  **New Step:** Call `generateProgrammaticFeatureTags(listing, clientConfig.tagging_rules)` to get the new boolean feature tags.
3.  **Merge All Tags:** The final `combinedTags` will be a result of merging three sources, ensuring no duplicates using a `Set`:
    *   LLM-generated tags.
    *   Existing programmatic `key:value` tags (e.g., `baths:1`).
    *   **New** programmatic feature tags (e.g., `feature:bathroom`).
4. The rest of the function (cleaning and returning the tags) will remain the same.

---

#### Step 3: Create a Re-ingestion Plan

After the code is modified, the existing data in Pinecone will be stale. We need to re-process the listings to update their metadata.

1.  **Identify Affected Listings:** We will plan to re-ingest all listings for the "Up Investments" client (`e6f484a3-c3cb-4e01-b8ce-a276f4b7355c`).
2.  **Use Existing Script:** The existing script `packages/backend/scripts/run-ingestion-v2.cjs` is perfect for this. I will formulate a command to execute it, targeting the specific client and ensuring the `ENABLE_PINECONE_UPSERT` flag is set. The script's built-in cleanup logic will handle the removal of old vectors before upserting the new, corrected ones.

---

#### Step 4: Verification

1.  After re-ingestion, I will ask you to re-run the problematic query: "qual a area do wc?".
2.  I will analyze the new logs to confirm that the `generated_tags` filter for `feature:bathroom` now successfully matches for listing `4270`.
3.  The final confirmation will be the chatbot providing the correct answer, with no context bleed from other listings.