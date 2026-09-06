import { describe, expect, test } from '@jest/globals';
import type { GameState } from '../../game/bootstrap/types';
import { getC17TemporalContext, getHumanTurnNumber } from './c17Temporal';

function state({
  turnNum = 0,
  log = [],
  hands = [[10, 11, 12, 13, 14], [20, 21, 22, 23, 24]],
  clues = [],
  score = 0,
  clueTokens = 8,
  strikes = [],
  deck = 30,
}: {
  turnNum?: number;
  log?: readonly { turn: number; text: string }[];
  hands?: readonly (readonly number[])[];
  clues?: readonly unknown[];
  score?: number;
  clueTokens?: number;
  strikes?: readonly unknown[];
  deck?: number;
} = {}): GameState {
  return {
    turn: { turnNum },
    log,
    hands,
    clues,
    score,
    clueTokens,
    strikes,
    cardsRemainingInTheDeck: deck,
  } as unknown as GameState;
}

describe('C17 temporal presentation', () => {
  test('presents upstream zero-based turns as human one-based turns', () => {
    expect(getHumanTurnNumber(0)).toBe(1);
    expect(getHumanTurnNumber(1)).toBe(2);
  });

  test('keeps authoritative action text and appends resource deltas', () => {
    const before = state({ log: [{ turn: 1, text: 'Ada goes first' }] });
    const after = state({
      turnNum: 1,
      log: [
        { turn: 1, text: 'Ada goes first' },
        { turn: 1, text: 'Ada plays red 1 from slot #3' },
      ],
      score: 1,
      deck: 29,
    });
    const context = getC17TemporalContext({
      states: [before, after],
      selectedSegment: 1,
      variantName: 'No Variant',
    });

    expect(context.last.turn).toBe(2);
    expect(context.last.summary).toContain('Ada plays red 1 from slot #3');
    expect(context.last.summary).toContain('Score +1');
    expect(context.last.summary).toContain('Deck -1');
  });

  test('reports clue touched slots in displayed ascending order', () => {
    const before = state();
    const after = state({
      log: [{ turn: 1, text: 'Ada tells Bea about two reds' }],
      clueTokens: 7,
      clues: [{ giver: 0, target: 0, segment: 1, list: [11, 14], negativeList: [], type: 0, value: 0 }],
    });
    const context = getC17TemporalContext({
      states: [before, after],
      selectedSegment: 1,
      variantName: 'No Variant',
    });

    expect(context.last.summary).toContain('Touched 1/4');
    expect(context.last.summary).toContain('Clues -1');
  });

  test('exposes before/after navigation and counts newer stored action segments', () => {
    const context = getC17TemporalContext({
      states: [state(), state({ turnNum: 1 }), state({ turnNum: 2 }), state({ turnNum: 3 })],
      selectedSegment: 1,
      variantName: 'No Variant',
    });

    expect(context.previousSegment).toBe(0);
    expect(context.nextSegment).toBe(2);
    expect(context.newerActionCount).toBe(2);
  });
});
