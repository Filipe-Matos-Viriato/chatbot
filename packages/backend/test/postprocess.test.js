import { expect } from 'chai';
import { removeRedundantClosingCTA } from '../src/utils/postprocess.js';

describe('postprocess removeRedundantClosingCTA', () => {
  it('removes trailing CTA if previous had CTA', () => {
    const prev = 'Posso ajudar com mais alguma coisa?';
    const curr = 'O preço é 100€. Como posso ajudar mais?';
    const out = removeRedundantClosingCTA(curr, prev);
    expect(out).to.equal('O preço é 100€.');
  });
  it('keeps CTA if previous did not have CTA and no other question in text', () => {
    const prev = 'Ok, entendido.';
    const curr = 'Temos T2 disponíveis. Como posso ajudar mais?';
    const out = removeRedundantClosingCTA(curr, prev);
    expect(out).to.equal(curr.trim());
  });
  it('removes CTA if message already contains a question elsewhere', () => {
    const prev = '';
    const curr = 'Tem preferência por vista ou piso? Como posso ajudar mais?';
    const out = removeRedundantClosingCTA(curr, prev);
    expect(out).to.equal('Tem preferência por vista ou piso?');
  });
});


