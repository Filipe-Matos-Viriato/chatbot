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

export function buildContextFromMatches(matches, contextListingId = null, contextDevelopmentId = null, isBroadOverview = false) {
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
    // For broad overview queries, show more listings to give comprehensive view
    const maxOtherListings = isBroadOverview ? 12 : 5;
    uniqueOthers.slice(0, maxOtherListings).forEach(m => {
      const mMeta = m.metadata;
      let summary = `- **ID:** ${mMeta.id || mMeta.listing_id || 'N/A'}`;
      if (mMeta.name) summary += `, **Nome:** ${mMeta.name}`;
      if (mMeta.type) summary += `, **Tipo:** ${mMeta.type}`;
      if (mMeta.beds) summary += `, **Quartos:** ${mMeta.beds}`;
      if (mMeta.price_eur) summary += `, **Preço:** €${Number(mMeta.price_eur).toLocaleString('pt-PT')}`;

      // For broad overview queries (like onboarding), include amenity information from generated_tags
      if (isBroadOverview && Array.isArray(mMeta.generated_tags) && mMeta.generated_tags.length > 0) {
        const amenityTags = mMeta.generated_tags
          .filter(tag => tag.startsWith('comodidade:'))
          .map(tag => tag.replace('comodidade:', ''))
          .join(', ');
        if (amenityTags) {
          summary += `, **Comodidades:** ${amenityTags}`;
        }
      }

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

export function buildStructuredListingSummary(matches, queryFilters) {
  if (!matches || matches.length === 0) {
    return null;
  }

  const listingsMap = new Map();
  // Extract the first feature tag for context. A more robust solution might handle multiple tags.
  const requestedFeature = queryFilters?.generated_tags?.$all[0] || 'Unknown Feature';

  for (const match of matches) {
    const metadata = match.metadata;
    const listingId = metadata?.listing_id;

    if (listingId && !listingsMap.has(listingId)) {
      listingsMap.set(listingId, {
        id: listingId,
        name: metadata.name || 'Nome não disponível',
        type: metadata.type || 'Tipo não disponível',
        beds: metadata.beds || 'N/A',
        price_eur: metadata.price || 'Preço não disponível',
        hasFeature: true // Since filtering ensures the feature is present
      });
    }
  }

  if (listingsMap.size === 0) {
    return null;
  }

  let summary = `Característica solicitada: ${requestedFeature.replace(/comodidade:|feature:/, '')}\n\n`;
  summary += 'Imóveis correspondentes:\n';
  for (const listing of Array.from(listingsMap.values())) {
    summary += `- Nome: ${listing.name}, Tipo: ${listing.type}, Quartos: ${listing.beds}, Preço: ${listing.price_eur}\n`;
  }

  return summary;
}

