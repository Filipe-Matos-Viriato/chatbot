import { encode } from 'gpt-3-encoder';

export function pickText(meta) {
  return (meta?.text || meta?.chunk || meta?.content || meta?.body || meta?.page_text || '').toString();
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


