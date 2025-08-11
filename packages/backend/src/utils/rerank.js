// Heuristic re-ranking with a simple scoring function and pluggable interface

export function reRankMatches({
  matches,
  contextListingId,
  contextDevelopmentId,
  originalQuery,
  queryFilters,
  topN = 20,
}) {
  if (!Array.isArray(matches) || matches.length === 0) return [];

  const qLower = String(originalQuery || '').toLowerCase();
  const isLookingForT1 = qLower.includes('t1') || qLower.includes('1 quarto');
  const isLookingForT2 = qLower.includes('t2') || qLower.includes('2 quartos');
  const isLookingForStudio = qLower.includes('estúdio') || qLower.includes('studio');

  const debugBoostLogs = [];
  const reRanked = matches.map((match, idx) => {
    let score = match.score;
    const meta = match.metadata || {};
    if (contextListingId && meta.listing_id === contextListingId) score += 1.0;
    if (contextDevelopmentId && meta.development_id === contextDevelopmentId) score += 0.8;

    const queryListingId = queryFilters?.listing_id || null;
    if (queryListingId && meta.listing_id === queryListingId) score += 1.5;

    if (queryFilters && Object.keys(queryFilters).length > 0) {
      let filterMatchCount = 0;
      for (const key in queryFilters) {
        if (key === 'total_area_sqm' || key === 'price_eur' || key === 'num_bedrooms') {
          const filter = queryFilters[key];
          if (filter?.$lt != null && meta[key] < filter.$lt) filterMatchCount++;
          else if (filter?.$gt != null && meta[key] > filter.$gt) filterMatchCount++;
          else if (meta[key] === filter) filterMatchCount++;
        } else if (key === 'typology') {
          if (meta.typology === queryFilters.typology || meta.type === queryFilters.typology) filterMatchCount++;
        } else if (meta[key] === queryFilters[key]) {
          filterMatchCount++;
        }
      }
      score += (filterMatchCount * 0.2);
      if (filterMatchCount > 0 && idx < 8) {
        debugBoostLogs.push({ id: meta?.listing_id || meta?.development_id || match.id, filterMatches: filterMatchCount });
      }
    }

    const text = (meta.text || meta.chunk || meta.content || meta.body || meta.page_text || '').toString().toLowerCase();
    if (text) {
      if (isLookingForT1 && (text.includes(' t1 ') || text.includes(' tipologia t1') || text.includes(' 1 quarto') || text.includes(' t1,') || text.includes(' t1.'))) {
        score += 0.3;
        if (idx < 8) debugBoostLogs.push({ id: meta.listing_id || meta.development_id || match.id, hint: 'T1' });
      }
      if (isLookingForT2 && (text.includes(' t2 ') || text.includes(' tipologia t2') || text.includes(' 2 quartos') || text.includes(' t2,') || text.includes(' t2.'))) {
        score += 0.3;
        if (idx < 8) debugBoostLogs.push({ id: meta.listing_id || meta.development_id || match.id, hint: 'T2' });
      }
      if (isLookingForStudio && (text.includes(' estúdio') || text.includes(' studio'))) {
        score += 0.2;
        if (idx < 8) debugBoostLogs.push({ id: meta.listing_id || meta.development_id || match.id, hint: 'studio' });
      }
    }

    return { ...match, score };
  });

  const ranked = reRanked.sort((a, b) => b.score - a.score).slice(0, topN);
  try {
    const preview = ranked.slice(0, 5).map(m => ({
      id: m.metadata?.listing_id || m.metadata?.development_id || m.id,
      score: Number(m.score?.toFixed?.(6) || m.score),
      typology: m.metadata?.typology || m.metadata?.type || null,
      docCategory: m.metadata?.document_category,
      hasText: Boolean(m.metadata?.text || m.metadata?.chunk || m.metadata?.content || m.metadata?.body || m.metadata?.page_text),
    }));
    console.log('📊 Top results after re-ranking:', JSON.stringify(preview, null, 2));
    console.log('🔎 Re-ranking debug (top up to 8 shown):', JSON.stringify(debugBoostLogs, null, 2));
  } catch (_) {}

  return ranked;
}


