import { expect } from 'chai';
import { extractListingIdFromUrl, extractListingIdFromQuery, isAggregativePriceQuery, extractQueryFilters } from '../src/utils/rag-parsing.js';

describe('rag-parsing utils', () => {
  it('extracts listing id from url', () => {
    expect(extractListingIdFromUrl('https://site/pt/imoveis/1234')).to.equal('1234');
    expect(extractListingIdFromUrl('https://site/x/ap-555#foo')).to.equal('ap-555');
  });
  it('extracts listing id from query natural language', () => {
    expect(extractListingIdFromQuery('T2 E Bloco 1')).to.equal('block_1_apt_E');
    expect(extractListingIdFromQuery('ap-999')).to.equal('ap-999');
  });
  it('detects aggregative price queries', () => {
    expect(isAggregativePriceQuery('qual o mais barato?')).to.equal(true);
    expect(isAggregativePriceQuery('ola')).to.equal(false);
  });
  it('extracts query filters', () => {
    const filters = extractQueryFilters('menos de 300.000€ e 2 quartos com varanda', null, null);
    expect(filters.price_eur).to.be.an('object');
    expect(filters.num_bedrooms === 2 || (filters.num_bedrooms && filters.num_bedrooms.$eq === 2)).to.be.true;
    // Note: has_balcony is no longer supported without clientConfig - dynamic tagging_rules required
  });
  it('detects intent for bedroom area', () => {
    const filters = extractQueryFilters('qual o tamanho do quarto?', null, null);
    expect(filters.intent_query_bedroom_area).to.equal(true);
    expect(filters.intent_query_bathroom_area).to.be.undefined;
  });
  it('detects intent for bathroom area with casa de banho', () => {
    const filters = extractQueryFilters('qual o tamanho da casa de banho?', null, null);
    expect(filters.intent_query_bathroom_area).to.equal(true);
    expect(filters.intent_query_bedroom_area).to.be.undefined;
  });
  it('detects intent for bathroom area with quarto de banho', () => {
    const filters = extractQueryFilters('qual o tamanho do quarto de banho?', null, null);
    expect(filters.intent_query_bathroom_area).to.equal(true);
    expect(filters.intent_query_bedroom_area).to.be.undefined;
  });
  it('does not misclassify quarto de banho as bedroom', () => {
    const filters = extractQueryFilters('qual o tamanho do quarto de banho?', null, null);
    expect(filters.intent_query_bedroom_area).to.be.undefined;
  });
});


