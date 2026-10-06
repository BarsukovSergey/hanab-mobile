import { ClueType } from '../upstream/enums/ClueType';
import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
import type { CardNote } from '../upstream/interfaces/CardNote';
import type { GameState } from '../upstream/interfaces/GameState';
import type { CardOrder } from '../upstream/types/CardOrder';
import type { Clue } from '../upstream/types/Clue';
import type { ColorIndex } from '../upstream/types/ColorIndex';
import type { MsgClue } from '../upstream/types/MsgClue';
import type { Variant } from '../upstream/interfaces/Variant';
import { getCardIdentityToShow } from './cardPresentation';
import { getHypotheticalCard, getHypotheticalTouchedCards, type HypotheticalCardView } from './hypotheticalPlanning';

export type HypotheticalClueTouchContext = {
  readonly cardIdentities: readonly CardIdentity[];
  readonly morphedIdentities: readonly CardIdentity[];
  readonly notes: readonly CardNote[];
  readonly playing: boolean;
};

/** Keep mobile visibility/availability policy outside the source-faithful U2 helpers. */
export function getHypotheticalCluePlanningInput(
  game: Pick<GameState, 'hands' | 'deck'>,
  targetPlayerIndex: number,
  clueType: ClueType,
  context: HypotheticalClueTouchContext,
): {
  readonly orders: readonly CardOrder[];
  readonly cardViews: readonly HypotheticalCardView[];
  readonly morphedIdentities: ReadonlyArray<CardIdentity | undefined>;
} {
  const cardViews: HypotheticalCardView[] = [];
  const morphedIdentities: Array<CardIdentity | undefined> = [...context.morphedIdentities];
  for (const order of game.hands[targetPlayerIndex] ?? []) {
    const state = game.deck[order];
    const identity = context.cardIdentities[order];
    const note = context.notes[order];
    // Mobile preview has always skipped cards with unavailable input.
    if (state === undefined || identity === undefined || note === undefined) continue;
    const morph = context.morphedIdentities[order];
    if (morph?.suitIndex === null && morph.rank === null) {
      cardViews.push({ state, isStackBase: false, visibleSuitIndex: null, visibleRank: null });
      continue;
    }
    const card = getHypotheticalCard({
      state, identity, note, morphedIdentity: morph, playing: context.playing,
      isStackBase: false, visibleSuitIndex: null, visibleRank: null,
    });
    const visible = getCardIdentityToShow({
      cardIdentity: card.identity, state, note, empathy: false,
      morphedIdentity: morph, isStackBase: false, finished: false,
    });
    cardViews.push({
      state, isStackBase: false,
      visibleSuitIndex: visible.suitIndex, visibleRank: visible.rank,
    });
    if ((clueType === ClueType.Color ? visible.suitIndex : visible.rank) === null) {
      // U2's empty-possibilities every() bypasses visibility. Mobile still excludes it.
      morphedIdentities[order] = { suitIndex: null, rank: null };
    } else if (morph === undefined && card.identity.suitIndex === null && card.identity.rank === null) {
      // Mobile can display a note-derived dimension while reviewing an unknown identity.
      // A partial identity preserves U2's possibilities intersection without a blank-card exclusion.
      morphedIdentities[order] = visible.suitIndex !== null
        ? { suitIndex: visible.suitIndex, rank: null }
        : { suitIndex: null, rank: visible.rank };
    }
  }
  return { orders: cardViews.map(({ state }) => state.order), cardViews, morphedIdentities };
}

/** Compatibility adapter for the rich Clue API used by cluePreview. */
export function getHypotheticalTouchedOrders(
  game: Pick<GameState, 'hands' | 'deck'>,
  variant: Variant,
  targetPlayerIndex: number,
  clue: Clue,
  context: HypotheticalClueTouchContext,
): readonly CardOrder[] {
  const message: MsgClue = clue.type === ClueType.Color
    ? { type: ClueType.Color, value: variant.clueColors.findIndex((color) => color.name === clue.value.name) as ColorIndex }
    : clue;
  if (message.type === ClueType.Color && message.value < 0) return [];
  const input = getHypotheticalCluePlanningInput(game, targetPlayerIndex, clue.type, context);
  return getHypotheticalTouchedCards(input.cardViews.map((view) => getHypotheticalCard({
    ...view, identity: context.cardIdentities[view.state.order]!,
    note: context.notes[view.state.order]!, morphedIdentity: input.morphedIdentities[view.state.order],
    playing: context.playing,
  })), message, variant);
}
