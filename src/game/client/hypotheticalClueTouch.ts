import { ClueType } from '../upstream/enums/ClueType';
import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
import type { CardNote } from '../upstream/interfaces/CardNote';
import type { GameState } from '../upstream/interfaces/GameState';
import type { CardOrder } from '../upstream/types/CardOrder';
import type { Clue } from '../upstream/types/Clue';
import type { Variant } from '../upstream/interfaces/Variant';
import { isCardTouchedByClue } from '../upstream/rules/clues';
import { getCardIdentityToShow } from './cardPresentation';
import { getHypotheticalCardRepresentation } from './hypotheticalCardRepresentation';

export type HypotheticalClueTouchContext = {
  readonly cardIdentities: readonly CardIdentity[];
  readonly morphedIdentities: readonly CardIdentity[];
  readonly notes: readonly CardNote[];
  readonly playing: boolean;
};

/** Pure equivalent of the pinned hypothetical card clue-touch representation. */
export function getHypotheticalTouchedOrders(
  game: Pick<GameState, 'hands' | 'deck'>,
  variant: Variant,
  targetPlayerIndex: number,
  clue: Clue,
  context: HypotheticalClueTouchContext,
): readonly CardOrder[] {
  const hand = game.hands[targetPlayerIndex];
  if (hand === undefined) return [];

  return hand.filter((order) => {
    const state = game.deck[order];
    const cardIdentity = context.cardIdentities[order];
    const note = context.notes[order];
    if (state === undefined || cardIdentity === undefined || note === undefined) return false;

    const morph = context.morphedIdentities[order];
    if (morph?.suitIndex === null && morph.rank === null) return false;

    const representation = getHypotheticalCardRepresentation(
      state, cardIdentity, note, morph, context.playing,
    );
    const visibleIdentity = getCardIdentityToShow({
      cardIdentity: representation.identity,
      state,
      note,
      empathy: false,
      morphedIdentity: morph,
      isStackBase: false,
      finished: false,
    });
    const visible = clue.type === ClueType.Color
      ? visibleIdentity.suitIndex !== null
      : visibleIdentity.rank !== null;
    if (!visible) return false;

    return representation.possibilities.every(([suitIndex, rank]) => (
      isCardTouchedByClue(variant, clue, suitIndex, rank)
    ));
  });
}
