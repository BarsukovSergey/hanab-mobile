import type { GameState } from '../bootstrap/types';
import { ClueType } from '../upstream/enums/ClueType';

type RelevantAction = {
  type: string;
  clue?: { type: number; value: number };
  giver?: number;
  list?: readonly number[];
  target?: number;
};

export type LastCluePresentation = {
  giverPlayerIndex: number;
  targetPlayerIndex: number;
  clueType: 'color' | 'rank';
  value: number;
  touchedOrders: readonly number[];
};

export function getLastCluePresentationFromState(state: GameState): LastCluePresentation | null {
  const clue = state.clues.at(-1);
  if (clue === undefined) return null;

  const hasLaterCardAction = state.deck.some((card) => (
    (card.segmentPlayed !== null && card.segmentPlayed > clue.segment)
    || (card.segmentDiscarded !== null && card.segmentDiscarded > clue.segment)
  ));
  if (hasLaterCardAction) return null;

  return {
    giverPlayerIndex: clue.giver,
    targetPlayerIndex: clue.target,
    clueType: clue.type === ClueType.Color ? 'color' : 'rank',
    value: clue.value,
    touchedOrders: clue.list,
  };
}

export function getLastCluePresentation(actions: readonly RelevantAction[]): LastCluePresentation | null {
  for (let index = actions.length - 1; index >= 0; index -= 1) {
    const action = actions[index];
    if (action === undefined) continue;
    if (action.type === 'play' || action.type === 'discard') return null;
    if (
      action.type !== 'clue'
      || action.clue === undefined
      || action.giver === undefined
      || action.list === undefined
      || action.target === undefined
    ) continue;
    return {
      giverPlayerIndex: action.giver,
      targetPlayerIndex: action.target,
      clueType: action.clue.type === 0 ? 'color' : 'rank',
      value: action.clue.value,
      touchedOrders: action.list,
    };
  }
  return null;
}
