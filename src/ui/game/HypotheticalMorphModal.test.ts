import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

const modalSource = fs.readFileSync(
  path.join(process.cwd(), 'src/ui/game/HypotheticalMorphModal.tsx'),
  'utf8',
).replace(/\r\n/g, '\n');

test('morph picker uses a static title and does not expose card numbering', () => {
  expect(modalSource).toContain('>Morph</Text>');
  expect(modalSource).not.toContain('position');
  expect(modalSource).not.toContain('Card {');
});

test('Original is selected when no explicit morph exists and uses the identity accent border', () => {
  expect(modalSource).toContain('accessibilityState={{ selected: current === undefined }}');
  expect(modalSource).toContain('borderColor: current === undefined ? theme.colors.accent : theme.colors.border');
  expect(modalSource).toContain('const selected = current?.suitIndex === identity.suitIndex && current.rank === identity.rank;');
});

test('morph picker gives a concise identity selection instruction', () => {
  expect(modalSource).toContain('Select the card you want to morph it into.');
});
