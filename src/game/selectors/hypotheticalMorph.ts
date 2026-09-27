import { getVariant } from '../upstream/gameData';
import type { Rank } from '../upstream/types/Rank';
import type { SuitIndex } from '../upstream/types/SuitIndex';

export type HypotheticalMorphChoice = { readonly suitIndex: SuitIndex; readonly rank: Rank };

/** Full card identities supported by the pinned upstream variant. */
export function getHypotheticalMorphChoices(variantName: string): readonly HypotheticalMorphChoice[] {
  const variant = getVariant(variantName);
  return variant.suits.flatMap((_, suitIndex) =>
    variant.ranks.map((rank) => ({ suitIndex: suitIndex as SuitIndex, rank })),
  );
}
