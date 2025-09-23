// packages/backend/src/utils/async-timeout.js
// Utility for adding timeout functionality to asynchronous operations.
// To prevent hanging operations in the RAG pipeline and other async tasks.
// Relevant files: rag-service.js
export function withTimeout(promise, ms, label = 'operation') {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(timeoutId)), timeoutPromise]);
}


