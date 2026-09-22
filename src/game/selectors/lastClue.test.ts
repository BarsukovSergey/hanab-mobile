import { describe, expect, test } from '@jest/globals';

import type { GameState } from '../bootstrap/types';
import { ClueType } from '../upstream/enums/ClueType';
import { getLastCluePresentation, getLastCluePresentationFromState } from './lastClue';

function stateWithLatestClue({
  clues = [{ giver: 0, target: 1, type: ClueType.Rank, value: 3, list: [12, 14], segment: 5 }],
  deck = [],
}: {
  clues?: readonly { giver: number; target: number; type: ClueType; value: number; list: readonly number[]; segment: number }[];
  deck?: readonly { segmentPlayed?: number | null; segmentDiscarded?: number | null }[];
} = {}): GameState {
  return {
    clues: clues.map((clue) => ({ ...clue, negativeList: [] })),
    deck: deck.map((card, order) => ({
      order,
      segmentPlayed: null,
      segmentDiscarded: null,
      ...card,
    })),
  } as unknown as GameState;
}

describe('getLastCluePresentation', () => {
  test('keeps the latest clue through trailing bookkeeping records', () => {
    expect(getLastCluePresentation([
      { type: 'play' },
      { type: 'clue', clue: { type: 1, value: 3 }, giver: 0, list: [12, 14], target: 1 },
      { type: 'turn' },
      { type: 'status' },
      { type: 'draw' },
    ])).toEqual({
      giverPlayerIndex: 0,
      targetPlayerIndex: 1,
      clueType: 'rank',
      value: 3,
      touchedOrders: [12, 14],
    });
  });

  test('clears the previous clue after the next play or discard action', () => {
    const clue = { type: 'clue' as const, clue: { type: 0 as const, value: 2 }, giver: 0, list: [9], target: 1 };
    expect(getLastCluePresentation([clue, { type: 'play' }, { type: 'turn' }])).toBeNull();
    expect(getLastCluePresentation([clue, { type: 'discard' }, { type: 'status' }])).toBeNull();
  });

  test('returns the newer clue when clues happen consecutively', () => {
    expect(getLastCluePresentation([
      { type: 'clue', clue: { type: 0, value: 0 }, giver: 0, list: [1], target: 1 },
      { type: 'turn' },
      { type: 'clue', clue: { type: 1, value: 5 }, giver: 1, list: [4], target: 0 },
    ])?.value).toBe(5);
  });
});

describe('getLastCluePresentationFromState', () => {
  test('returns the latest clue from the displayed state', () => {
    expect(getLastCluePresentationFromState(stateWithLatestClue())).toEqual({
      giverPlayerIndex: 0,
      targetPlayerIndex: 1,
      clueType: 'rank',
      value: 3,
      touchedOrders: [12, 14],
    });
  });

  test('does not clear a clue for trailing non-play/discard state', () => {
    expect(getLastCluePresentationFromState(stateWithLatestClue({
      deck: [{ segmentPlayed: null, segmentDiscarded: null }],
    }))).not.toBeNull();
  });

  test('clears a clue after a later play', () => {
    expect(getLastCluePresentationFromState(stateWithLatestClue({
      deck: [{ segmentPlayed: 6 }],
    }))).toBeNull();
  });

  test('clears a clue after a later discard', () => {
    expect(getLastCluePresentationFromState(stateWithLatestClue({
      deck: [{ segmentDiscarded: 6 }],
    }))).toBeNull();
  });

  test('replaces an older clue with the newest clue', () => {
    expect(getLastCluePresentationFromState(stateWithLatestClue({
      clues: [
        { giver: 0, target: 1, type: ClueType.Color, value: 2, list: [3], segment: 4 },
        { giver: 1, target: 0, type: ClueType.Rank, value: 5, list: [7], segment: 6 },
      ],
    }))).toMatchObject({ giverPlayerIndex: 1, targetPlayerIndex: 0, clueType: 'rank', value: 5, touchedOrders: [7] });
  });
});
