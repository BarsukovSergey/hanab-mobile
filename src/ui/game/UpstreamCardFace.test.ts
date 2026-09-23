import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

test('the central card face resolves the Redux-backed upstream presentation mode', () => {
  const source = fs.readFileSync(path.join(
    process.cwd(),
    'src',
    'ui',
    'game',
    'UpstreamCardFace.tsx',
  ), 'utf8');

  expect(source).toContain('state.session.cardPresentationSettings');
  expect(source).toContain('resolveUpstreamCardPresentationMode(presentation)');
  expect(source).toContain('getUpstreamCardSvg(variantName, cardKey, mode)');
  expect(source).toContain('parsedCardCache.has(svg)');
  expect(source).toContain('<MissingUpstreamCard />');
});
