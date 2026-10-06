import { ClueType } from '../upstream/enums/ClueType';
import { getVariant } from '../upstream/gameData';
import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
import type { CardNote } from '../upstream/interfaces/CardNote';
import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import type { GameState } from '../upstream/interfaces/GameState';
import type { MsgClue } from '../upstream/types/MsgClue';
import { colorIndex } from '../upstream/types/ColorIndex';
import type { CardOrder } from '../upstream/types/CardOrder';
import type { PlayerIndex } from '../upstream/types/PlayerIndex';
import { getCardIdentityToShow } from './cardPresentation';
import { planHypotheticalAction, type HypotheticalActionIntent } from './hypotheticalPlanning';
import { getHypotheticalCardRepresentation } from './hypotheticalCardRepresentation';
import { getHypotheticalCluePlanningInput } from './hypotheticalClueTouch';
import type { ActionIncludingHypothetical } from './types/actions';

/** Platform-independent port of upstream sendHypotheticalAction's input. */
export type HypotheticalClientAction =
  | { readonly type: 'play' | 'discard'; readonly order: number }
  | { readonly type: 'colorClue' | 'rankClue'; readonly target: number; readonly value: number };

/**
 * Expands one deliberate hypothetical UI action into the authoritative replay-action sequence.
 * It deliberately does not dispatch or send: ReplayInteractionRuntime owns that boundary.
 */
export function getHypotheticalActions(
  action: HypotheticalClientAction,
  game: GameState,
  metadata: GameMetadata,
  cardIdentities: readonly CardIdentity[],
  morphedIdentities: readonly CardIdentity[],
  notes: readonly CardNote[],
  playing: boolean,
): readonly ActionIncludingHypothetical[] | null {
  const actor = game.turn.currentPlayerIndex;
  if (actor === null) return null;
  const variant = getVariant(metadata.options.variantName);

  if (action.type === 'play' || action.type === 'discard') {
    const order = action.order as CardOrder;
    if (!(game.hands[actor] ?? []).includes(order)) return null;
    const card = game.deck[order];
    const cardIdentity = cardIdentities[order];
    const note = notes[order];
    if (card === undefined || cardIdentity === undefined || note === undefined) return null;
    const { identity } = getHypotheticalCardRepresentation(
      card, cardIdentity, note, morphedIdentities[order], playing,
    );
    if (identity.suitIndex === null || identity.rank === null) return null;
    const { suitIndex } = identity;
    const suit = variant.suits[suitIndex];
    let actualType: 'play' | 'discard' = action.type;
    if (suit?.inverted) actualType = actualType === 'play' ? 'discard' : 'play';
    if (actualType === 'play' && (
      !Array.isArray(game.playStacks?.[suitIndex])
      || game.playStackDirections?.[suitIndex] === undefined
    )) return null;
    const visible = getCardIdentityToShow({
      cardIdentity: identity, state: card, note, empathy: false,
      morphedIdentity: morphedIdentities[order], isStackBase: false, finished: false,
    });
    // Malformed stack data must remain a rejected mobile input, not a planner assertion.
    try {
      return planHypotheticalAction({ type: action.type, order }, {
        gameState: game, metadata, variant, cardIdentities, morphedIdentities, notes, playing,
        cardViews: [{ state: card, isStackBase: false, visibleSuitIndex: visible.suitIndex, visibleRank: visible.rank }],
      });
    } catch {
      return null;
    }
  }

  const clueAction = action as Extract<HypotheticalClientAction, { readonly target: number }>;
  if (!Number.isInteger(clueAction.target) || clueAction.target === actor || game.hands[clueAction.target] === undefined) return null;
  const clueAndMessage = action.type === 'colorClue'
    ? (() => {
      const parsedColorIndex = colorIndex.safeParse(clueAction.value);
      if (!parsedColorIndex.success) return null;
      const color = variant.clueColors[parsedColorIndex.data];
      return color === undefined ? null : {
        message: { type: ClueType.Color, value: parsedColorIndex.data } satisfies MsgClue,
      };
    })()
    : (() => {
      const rank = variant.clueRanks.find((candidate) => candidate === clueAction.value);
      return rank === undefined ? null : {
        message: { type: ClueType.Rank, value: rank } satisfies MsgClue,
      };
    })();
  if (clueAndMessage === null) return null;
  const input = getHypotheticalCluePlanningInput(game, clueAction.target, clueAndMessage.message.type, {
    cardIdentities, morphedIdentities, notes, playing,
  });
  const intent: HypotheticalActionIntent = clueAndMessage.message.type === ClueType.Color
    ? { type: 'colorClue', target: clueAction.target as PlayerIndex, value: clueAndMessage.message.value }
    : { type: 'rankClue', target: clueAction.target as PlayerIndex, value: clueAndMessage.message.value };
  return planHypotheticalAction(intent, {
    // Missing clue-card input was already omitted by the mobile touch adapter.
    // This planning-only hand keeps that policy without mutating the ongoing game.
    gameState: {
      ...game,
      hands: game.hands.map((hand, index) => index === clueAction.target ? input.orders : hand) as unknown as GameState['hands'],
    },
    metadata, variant, cardIdentities, notes, playing,
    morphedIdentities: input.morphedIdentities, cardViews: input.cardViews,
  });
}
