// packages/backend/src/utils/context.js
// Utility functions for building and managing context from vector search results.
// To prepare contextual information for LLM prompts in the RAG system.
// Relevant files: rag-service.js
import { encode } from 'gpt-3-encoder';

export function pickText(meta) {
  return (meta?.chunk_text || meta?.text || meta?.chunk || meta?.content || meta?.body || meta?.page_text || '').toString();
}

export function buildContext({ pageContext = '', matches = [] }) {
  const texts = matches.map(m => pickText(m.metadata)).filter(Boolean);
  return pageContext + texts.join('\n\n---\n\n');
}

export function truncateByTokenBudget(text, budget) {
  const tokens = encode(text);
  if (tokens.length <= budget) return { text, tokenCount: tokens.length };
  // naive cut by proportion
  const ratio = budget / tokens.length;
  const cut = Math.max(0, Math.floor(text.length * ratio) - 1);
  return { text: text.slice(0, cut), tokenCount: budget };
}


