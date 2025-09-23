# Architectural Plan: Implementing Scalable Pagination

The core of this change will be to introduce a `while` loop into the main execution script (`packages/backend/scripts/run-ingestion-v2.cjs`) and modify the service function (`processListings` in `packages/backend/src/services/ingestion-service_V2.js`) to handle paginated requests.

### 1. `run-ingestion-v2.cjs` - The Orchestrator

This script will be responsible for orchestrating the batched ingestion.

- **Looping Logic**: A `while` loop will be introduced. It will continue to execute as long as the service function indicates that more listings are available.
- **Page Counter**: A `page` or `offset` variable will be maintained to request the correct batch in each iteration.
- **Batch Size Control**: The existing `batchSize` parameter will be used to determine the size of each page requested from the database.

**Pseudo-code for `run-ingestion-v2.cjs`:**

```javascript
let page = 0;
let hasMore = true;
const batchSize = argv.batchSize;
let totalProcessed = 0;

while (hasMore) {
  console.log(`Processing page ${page + 1}...`);
  const { processedCount, moreAvailable } = await processListings(
    argv.clientId, 
    argv.developmentId, 
    batchSize,
    page * batchSize // Calculate offset
  );
  totalProcessed += processedCount;
  hasMore = moreAvailable;
  page++;
}

console.log(`Ingestion complete. Total listings processed: ${totalProcessed}`);
```

### 2. `ingestion-service_V2.js` - The Worker

The `processListings` function will be refactored to handle a single batch and report back.

- **`fetchListings` Modification**: This function will be updated to accept an `offset` parameter. It will use Supabase's `.range(offset, offset + batchSize - 1)` method instead of `.limit()` to fetch the correct slice of data.
- **Return Value**: `processListings` will now return an object: `{ processedCount: number, moreAvailable: boolean }`.
  - `processedCount`: The number of listings processed in the current batch.
  - `moreAvailable`: A boolean indicating if the number of records returned was equal to the batch size, suggesting more records may be available.

**Pseudo-code for `fetchListings` in `ingestion-service_V2.js`:**
```javascript
async function fetchListings(clientId, developmentId, batchSize, offset) {
  let query = supabase
    .from('listings')
    .select('*')
    .eq('client_id', clientId);
  
  if (developmentId) {
    query = query.eq('development_id', developmentId);
  }

  // Use range for pagination
  query = query.range(offset, offset + batchSize - 1);

  const { data, error } = await query;
  // ... error handling ...
  return data;
}
```
**Pseudo-code for `processListings` in `ingestion-service_V2.js`:**
```javascript
async function processListings(clientId, developmentId, batchSize, offset) {
  // ... (existing logic for fetching config, etc.)
  
  const listings = await fetchListings(clientId, developmentId, batchSize, offset);
  
  // ... (existing logic for processing the `listings` array)

  // Return processed count and whether more might be available.
  return {
    processedCount: listings.length,
    moreAvailable: listings.length === batchSize,
  };
}
```

This architecture ensures true batch processing, making the ingestion service robust and scalable for any number of listings.