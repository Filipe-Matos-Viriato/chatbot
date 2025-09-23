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

export function buildContextFromMatches(matches, contextListingId = null, contextDevelopmentId = null) {
  if (!matches || matches.length === 0) {
    return '';
  }

  // Identify the primary match
  let primaryMatch = null;
  let primaryId = null;
  if (contextListingId) {
    primaryMatch = matches.find(m => m.metadata?.listing_id === contextListingId);
    primaryId = contextListingId;
  } else if (contextDevelopmentId) {
    primaryMatch = matches.find(m => m.metadata?.development_id === contextDevelopmentId);
    primaryId = contextDevelopmentId;
  }
  if (!primaryMatch) {
    // Fallback to highest score
    primaryMatch = matches.reduce((best, current) => (current.score > best.score ? current : best), matches[0]);
    primaryId = primaryMatch.metadata?.listing_id || primaryMatch.metadata?.development_id;
  }

  if (!primaryMatch || !primaryMatch.metadata) {
    return matches.map(m => pickText(m.metadata)).filter(Boolean).join('\n\n---\n\n');
  }

  const meta = primaryMatch.metadata;

  // Ficha Técnica (structured data)
  let structuredSummary = '### Imóvel Principal: Ficha Técnica\n';
  const excludeKeys = new Set(['client_id', 'generated_tags', 'chunk_text', 'content_type', 'has_description', 'id']);
  for (const [key, value] of Object.entries(meta)) {
    if (excludeKeys.has(key) || value === null || value === undefined || value === '') continue;
    let displayKey = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    let displayValue = value;
    if (key === 'price_eur' && typeof value === 'number') {
      displayValue = `€${value.toLocaleString('pt-PT')}`;
    } else if (key === 'duplex' && typeof value === 'boolean') {
      displayValue = value ? 'Sim' : 'Não';
    } else if (Array.isArray(value)) {
      displayValue = value.join(', ');
    } else if (typeof value === 'number' && key.includes('area')) {
      displayValue = `${value} m²`;
    }
    structuredSummary += `- **${displayKey}:** ${displayValue}\n`;
  }
  structuredSummary += '\n';

  // Descrição Adicional (unstructured text)
  const primaryChunks = matches.filter(m => (m.metadata?.listing_id === primaryId || m.metadata?.development_id === primaryId));
  const primaryTexts = primaryChunks.map(m => pickText(m.metadata)).filter(Boolean);
  if (primaryTexts.length > 0) {
    structuredSummary += '### Imóvel Principal: Descrição Adicional\n';
    structuredSummary += primaryTexts.join('\n\n') + '\n\n';
  }

  // Comparative context for other matches
  const otherMatches = matches.filter(m => m.metadata?.listing_id !== primaryId && m.metadata?.development_id !== primaryId);
  if (otherMatches.length > 0) {
    structuredSummary += '### Outros Imóveis Relevantes\n';
    const uniqueOthers = [];
    const seenIds = new Set();
    for (const m of otherMatches) {
      const id = m.metadata?.listing_id || m.metadata?.development_id;
      if (!seenIds.has(id)) {
        seenIds.add(id);
        uniqueOthers.push(m);
      }
    }
    uniqueOthers.slice(0, 5).forEach(m => { // Limit to top 5 to avoid too much text
      const mMeta = m.metadata;
      let summary = `- **ID:** ${mMeta.id || mMeta.listing_id || 'N/A'}`;
      if (mMeta.name) summary += `, **Nome:** ${mMeta.name}`;
      if (mMeta.type) summary += `, **Tipo:** ${mMeta.type}`;
      if (mMeta.beds) summary += `, **Quartos:** ${mMeta.beds}`;
      if (mMeta.price_eur) summary += `, **Preço:** €${Number(mMeta.price_eur).toLocaleString('pt-PT')}`;
      structuredSummary += summary + '\n';
    });
  }

  return structuredSummary;
}

export function truncateByTokenBudget(text, budget) {
  const tokens = encode(text);
  if (tokens.length <= budget) return { text, tokenCount: tokens.length };
  // naive cut by proportion
  const ratio = budget / tokens.length;
  const cut = Math.max(0, Math.floor(text.length * ratio) - 1);
  return { text: text.slice(0, cut), tokenCount: budget };
}


