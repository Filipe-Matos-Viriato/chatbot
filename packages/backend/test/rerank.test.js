import { expect } from 'chai';
import { reRankMatches } from '../src/utils/rerank.js';

describe('rerank utils', () => {
  it('boosts context listing and typology hints', () => {
    const matches = [
      { id: 'a', score: 0.5, metadata: { listing_id: 'L1', typology: 'T2', text: 'Apartamento T2 com varanda' } },
      { id: 'b', score: 0.6, metadata: { listing_id: 'L2', typology: 'T1', text: 'Apartamento T1' } },
    ];
    const result = reRankMatches({ matches, contextListingId: 'L1', contextDevelopmentId: null, originalQuery: 'procuro T2', queryFilters: {}, isOnboardingRecommendation: false });
    expect(result.rankedMatches[0].metadata.listing_id).to.equal('L1');
  });
});


