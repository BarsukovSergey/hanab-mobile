import { parseNote } from '../client/reducers/notesReducer';
import { START_CARD_RANK } from '../upstream/constants';
import { getVariant } from '../upstream/gameData';
import type { CardState } from '../upstream/interfaces/CardState';
import { canCardPossiblyBeFromEmpathy } from '../upstream/rules/card';

/**
 * Mirrors the upstream advisory check for a submitted personal note.
 *
 * Stack-base callers may opt into the upstream different-suit safeguard. C17
 * currently has no stack-base note editor, but keeping it here preserves the
 * shared semantic boundary for a future caller.
 */
export function getNoteImpossibilityWarning({
  card,
  cardIsStackBase = false,
  noteText,
  ourPlayerIndex,
  variantName,
}: {
  card: CardState | undefined;
  cardIsStackBase?: boolean;
  noteText: string;
  ourPlayerIndex: number;
  variantName: string;
}): string | null {
  if (card === undefined) return null;

  const variant = getVariant(variantName);
  const { possibilities } = parseNote(variant, noteText);
  if (possibilities.length === 0) return null;

  if (
    cardIsStackBase
    && possibilities.every(([suitIndex]) => suitIndex !== card.suitIndex)
  ) {
    return 'You cannot morph a stack base to have a different suit.';
  }

  if (
    card.location !== ourPlayerIndex
    || possibilities.some(([suitIndex, rank]) => (
      canCardPossiblyBeFromEmpathy(card, suitIndex, rank)
    ))
  ) return null;

  const impossibilities = possibilities.map(([suitIndex, rank]) => {
    const suitName = variant.suits[suitIndex]?.displayName ?? 'Unknown';
    const rankName = rank === START_CARD_RANK ? 'START' : rank.toString();
    return `${suitName.toLowerCase()} ${rankName}`;
  });

  return impossibilities.length === 1
    ? `That card cannot possibly be ${impossibilities[0]}`
    : `That card cannot possibly be any of ${impossibilities.join(', ')}`;
}
