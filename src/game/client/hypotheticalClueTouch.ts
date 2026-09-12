import { ClueType } from '../upstream/enums/ClueType';
import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
import type { CardNote } from '../upstream/interfaces/CardNote';
import type { GameState } from '../upstream/interfaces/GameState';
import type { CardOrder } from '../upstream/types/CardOrder';
import type { Clue } from '../upstream/types/Clue';
import type { Variant } from '../upstream/interfaces/Variant';
import { isCardTouchedByClue } from '../upstream/rules/clues';
import { getCardIdentityToShow, possibleCardsFromNoteAndClues } from './cardPresentation';

export type HypotheticalClueTouchContext = {
  readonly cardIdentities: readonly CardIdentity[];
  readonly morphedIdentities: readonly CardIdentity[];
  readonly notes: readonly CardNote[];
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

    const identity = getMorphedIdentity(cardIdentity, state, note, morph);
    const visibleIdentity = getCardIdentityToShow({
      cardIdentity: identity,
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

    return getMorphedPossibilities(identity, state, note).every(([suitIndex, rank]) => (
      isCardTouchedByClue(variant, clue, suitIndex, rank)
    ));
  });
}

function getMorphedIdentity(
  cardIdentity: CardIdentity,
  state: GameState['deck'][number],
  note: CardNote,
  morph: CardIdentity | undefined,
): CardIdentity {
  if (morph !== undefined) return morph;
  const possibilities = possibleCardsFromNoteAndClues(note, state);
  if (possibilities.length === 1) {
    const [suitIndex, rank] = possibilities[0]!;
    return { suitIndex, rank };
  }
  return cardIdentity;
}

function getMorphedPossibilities(
  identity: CardIdentity,
  state: GameState['deck'][number],
  note: CardNote,
) {
  if (identity.suitIndex !== null && identity.rank !== null) {
    return [[identity.suitIndex, identity.rank]] as const;
  }
  return possibleCardsFromNoteAndClues(note, state).filter(([suitIndex, rank]) => (
    state.possibleCards.some(([possibleSuitIndex, possibleRank]) => (
      suitIndex === possibleSuitIndex && rank === possibleRank
    ))
  ));
}
