import { expect } from 'chai';
import { renderTemplate } from '../src/utils/prompt.js';

describe('prompt utils', () => {
  it('renders placeholders', () => {
    const out = renderTemplate('Hello {name}, Q: {q}', { name: 'Ana', q: 'Preço?' });
    expect(out).to.equal('Hello Ana, Q: Preço?');
  });
});


