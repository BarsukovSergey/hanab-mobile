import { ClueType } from '../upstream/enums/ClueType';
import { getVariant } from '../upstream/gameData';
import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import type { GameState } from '../upstream/interfaces/GameState';
import type { MsgClue } from '../upstream/types/MsgClue';
import { newColorClue, newRankClue } from '../upstream/types/Clue';
import type { CardOrder } from '../upstream/types/CardOrder';
import type { PlayerIndex } from '../upstream/types/PlayerIndex';
import { getNextPlayableRanks } from '../upstream/rules/playStacks';
import { isCardTouchedByClue } from '../upstream/rules/clues';
import type { ActionIncludingHypothetical } from './types/actions';

/** Platform-independent port of upstream sendHypotheticalAction's input. */
export type HypotheticalClientAction =
  | { readonly type: 'play' | 'discard'; readonly order: number }
  | { readonly type: 'colorClue' | 'rankClue'; readonly target: number; readonly value: number };

/**
 * Expands one deliberate hypothetical UI action into the authoritative replay-action sequence.
 * It deliberately does not dispatch or send: LobbyRuntime owns that boundary.
 */
export function getHypotheticalActions(
  action: HypotheticalClientAction,
  game: GameState,
  metadata: GameMetadata,
  cardIdentities: readonly CardIdentity[],
  morphedIdentities: readonly CardIdentity[],
): readonly ActionIncludingHypothetical[] | null {
  const actor = game.turn.currentPlayerIndex;
  if (actor === null) return null;
  const variant = getVariant(metadata.options.variantName);

  if (action.type === 'play' || action.type === 'discard') {
    const order = action.order as CardOrder;
    if (!(game.hands[actor] ?? []).includes(order)) return null;
    const card = game.deck[order];
    const identity = morphedIdentities[order] ?? card;
    if (card === undefined || identity === undefined || identity.suitIndex === null || identity.rank === null) return null;
    const { suitIndex, rank } = identity;
    const suit = variant.suits[suitIndex];
    let actualType: 'play' | 'discard' = action.type;
    if (suit?.inverted) actualType = actualType === 'play' ? 'discard' : 'play';
    let failed = false;
    if (actualType === 'play') {
      const direction = game.playStackDirections[suitIndex];
      if (direction === undefined) return null;
      const nextRanks = getNextPlayableRanks(
        suitIndex,
        game.playStacks[suitIndex] ?? [],
        direction,
        game.playStackStarts,
        variant,
        game.deck,
      );
      if (!nextRanks.includes(rank)) {
        actualType = 'discard';
        failed = true;
      }
    }
    const actions: ActionIncludingHypothetical[] = [actualType === 'play'
      ? { type: 'play', playerIndex: actor, order, suitIndex, rank }
      : { type: 'discard', playerIndex: actor, order, suitIndex, rank, failed }];
    if (failed) actions.push({
      type: 'strike', num: game.strikes.length + 1, turn: game.turn.segment ?? 0, order,
    });
    if (game.deck.length < cardIdentities.length) {
      const order = game.deck.length as CardOrder;
      const drawn = cardIdentities[order];
      actions.push({ type: 'draw', playerIndex: actor, order, suitIndex: drawn?.suitIndex ?? -1, rank: drawn?.rank ?? -1 });
    }
    actions.push(nextTurn(game, metadata.options.numPlayers));
    return actions;
  }

  const clueAction = action as Extract<HypotheticalClientAction, { readonly target: number }>;
  if (!Number.isInteger(clueAction.target) || clueAction.target === actor || game.hands[clueAction.target] === undefined) return null;
  const clue = action.type === 'colorClue'
    ? (() => {
      const color = variant.clueColors.find((candidate) => Number(candidate) === clueAction.value);
      return color === undefined ? null : newColorClue(color);
    })()
    : (() => {
      const rank = variant.clueRanks.find((candidate) => candidate === clueAction.value);
      return rank === undefined ? null : newRankClue(rank);
    })();
  if (clue === null) return null;
  const list = game.hands[clueAction.target]!.filter((order) => {
    const card = game.deck[order];
    return card !== undefined && card.suitIndex !== null && card.rank !== null
      && isCardTouchedByClue(variant, clue, card.suitIndex, card.rank);
  });
  return [{ type: 'clue', clue: clue as unknown as MsgClue, giver: actor, list, target: clueAction.target as PlayerIndex, ignoreNegative: false }, nextTurn(game, metadata.options.numPlayers)];
}

function nextTurn(game: GameState, numPlayers: number): ActionIncludingHypothetical {
  const actor = game.turn.currentPlayerIndex;
  // actor is non-null at each caller; preserve upstream's simple hypothetical next-player behavior.
  return { type: 'turn', num: game.turn.turnNum + 1, currentPlayerIndex: ((actor! + 1) % numPlayers) as PlayerIndex };
}
