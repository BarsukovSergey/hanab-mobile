import { expect, test } from '@jest/globals';
import { getVariant } from '../upstream/gameData';
import type { SuitIndex } from '../upstream/types/SuitIndex';
import { getHypotheticalMorphChoices } from './hypotheticalMorph';

test('morph choices are every full identity from the selected upstream variant', () => {
  for (const variantName of ['No Variant', 'Rainbow (5 Suits)', 'Rainbow (3 Suits)']) {
    const variant = getVariant(variantName);
    const choices = getHypotheticalMorphChoices(variantName);
    expect(choices).toEqual(variant.suits.flatMap((_, suitIndex) =>
      variant.ranks.map((rank) => ({ suitIndex: suitIndex as SuitIndex, rank })),
    ));
    expect(choices.every(({ suitIndex, rank }) =>
      Number.isInteger(suitIndex) && suitIndex >= 0 && suitIndex < variant.suits.length
      && variant.ranks.includes(rank),
    )).toBe(true);
  }
});
