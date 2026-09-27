import { describe, expect, test } from '@jest/globals';
import type { GameState } from '../../game/bootstrap/types';
import {
  countC17TemporalStatesAfter,
  getC17TemporalContext,
  getHumanTurnNumber,
} from './c17Temporal';

type CardState = GameState['deck'][number];

function cardState({
  order,
  location = 0,
  suitIndex = null,
  rank = null,
  segmentPlayed = null,
  segmentDiscarded = null,
}: {
  order: number;
  location?: 'deck' | 'discard' | 'playStack' | number;
  suitIndex?: number | null;
  rank?: number | null;
  segmentPlayed?: number | null;
  segmentDiscarded?: number | null;
}): CardState {
  return {
    order,
    location,
    suitIndex,
    rank,
    segmentPlayed,
    segmentDiscarded,
  } as unknown as CardState;
}

function deckWith(...cards: CardState[]): GameState['deck'] {
  const deck: CardState[] = [];
  for (const card of cards) deck[card.order] = card;
  return deck;
}

function state({
  turnNum = 0,
  log = [],
  hands = [[10, 11, 12, 13, 14], [20, 21, 22, 23, 24]],
  clues = [],
  score = 0,
  clueTokens = 8,
  strikes = [],
  deckCount = 30,
  deckState = [],
}: {
  turnNum?: number;
  log?: readonly { turn: number; text: string }[];
  hands?: readonly (readonly number[])[];
  clues?: readonly unknown[];
  score?: number;
  clueTokens?: number;
  strikes?: readonly unknown[];
  deckCount?: number;
  deckState?: GameState['deck'];
} = {}): GameState {
  return {
    turn: { turnNum },
    log,
    hands,
    clues,
    score,
    clueTokens,
    strikes,
    deck: deckState,
    cardsRemainingInTheDeck: deckCount,
  } as unknown as GameState;
}

describe('C17 temporal presentation', () => {
  test('presents upstream zero-based turns as human one-based turns', () => {
    expect(getHumanTurnNumber(0)).toBe(1);
    expect(getHumanTurnNumber(1)).toBe(2);
  });

  test('counts only authoritative temporal states added after history entry', () => {
    const states: Array<GameState | undefined> = [
      state(),
      state({ turnNum: 1 }),
      undefined,
      state({ turnNum: 2 }),
      undefined,
      state({ turnNum: 3 }),
    ];

    expect(countC17TemporalStatesAfter(states, 1)).toBe(2);
    expect(countC17TemporalStatesAfter(states, 3)).toBe(1);
    expect(countC17TemporalStatesAfter(states, 5)).toBe(0);
  });

  test('exposes the initial state as explicit T0 rewind position', () => {
    const context = getC17TemporalContext({
      states: [state(), state({ turnNum: 1 })],
      selectedSegment: 0,
      variantName: 'No Variant',
      reverseHands: false,
    });

    expect(context.selectedSegment).toBe(0);
    expect(context.selectedTurn).toBe(0);
    expect(context.last.summary).toBe('Game start');
    expect(context.previousActionSegment).toBeNull();
    expect(context.nextActionSegment).toBe(1);
  });

  test('reconstructs the exact played card and old displayed slot from authoritative states', () => {
    const before = state({
      log: [{ turn: 1, text: 'Ada goes first' }],
      deckState: deckWith(cardState({ order: 10 })),
    });
    const after = state({
      turnNum: 1,
      log: [
        { turn: 1, text: 'Ada goes first' },
        { turn: 1, text: 'Ada plays a card' },
      ],
      hands: [[11, 12, 13, 14, 15], [20, 21, 22, 23, 24]],
      deckState: deckWith(cardState({
        order: 10,
        location: 'playStack',
        suitIndex: 0,
        rank: 3,
        segmentPlayed: 0,
      })),
      score: 1,
      deckCount: 29,
    });
    const context = getC17TemporalContext({
      states: [before, after],
      selectedSegment: 1,
      variantName: 'No Variant',
      reverseHands: false,
    });

    expect(context.last.turn).toBe(1);
    expect(context.liveTurn).toBe(2);
    expect(context.last.actionType).toBe('play');
    expect(context.last.actorIndex).toBe(0);
    expect(context.last.cardOrder).toBe(10);
    expect(context.last.preActionSlot).toBe(5);
    expect(context.last.cardIdentity).toBe('Red 3');
    expect(context.last.summary).toContain('Ada plays a card');
    expect(context.last.summary).toContain('Red 3 · from slot 5');
    expect(context.last.summary).toContain('Score +1');
    expect(context.last.summary).toContain('Deck -1');
    expect(context.last.summary).not.toContain('Before');
    const reversedContext = getC17TemporalContext({
      states: [before, after], selectedSegment: 1, variantName: 'No Variant', reverseHands: true,
    });
    expect(reversedContext.last.preActionSlot).toBe(1);
  });

  test('reconstructs discard identity independently of a log slot sentence', () => {
    const before = state({
      clueTokens: 7,
      deckState: deckWith(cardState({ order: 10 })),
    });
    const after = state({
      turnNum: 1,
      log: [{ turn: 1, text: 'Ada discards a card' }],
      hands: [[11, 12, 13, 14, 15], [20, 21, 22, 23, 24]],
      clueTokens: 8,
      deckState: deckWith(cardState({
        order: 10,
        location: 'discard',
        suitIndex: 0,
        rank: 4,
        segmentDiscarded: 0,
      })),
      deckCount: 29,
    });
    const context = getC17TemporalContext({
      states: [before, after],
      selectedSegment: 1,
      variantName: 'No Variant',
      reverseHands: false,
    });

    expect(context.last.actionType).toBe('discard');
    expect(context.last.cardOrder).toBe(10);
    expect(context.last.preActionSlot).toBe(5);
    expect(context.last.cardIdentity).toBe('Red 4');
    expect(context.last.summary).toContain('Red 4 · from slot 5');
    expect(context.last.summary).toContain('Clues +1');
    const reversedContext = getC17TemporalContext({
      states: [before, after], selectedSegment: 1, variantName: 'No Variant', reverseHands: true,
    });
    expect(reversedContext.last.preActionSlot).toBe(1);
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
      reverseHands: false,
    });

    expect(context.last.actionType).toBe('clue');
    expect(context.last.actorIndex).toBe(0);
    expect(context.last.targetIndex).toBe(0);
    expect(context.last.touchedSlots).toEqual([1, 4]);
    expect(context.last.summary).toContain('Cards 1, 4');
    expect(context.last.summary).toContain('Clues -1');
    const reversedContext = getC17TemporalContext({
      states: [before, after], selectedSegment: 1, variantName: 'No Variant', reverseHands: true,
    });
    expect(reversedContext.last.touchedSlots).toEqual([2, 5]);
  });

  test('exposes the exact before/after state pair for one focused action', () => {
    const context = getC17TemporalContext({
      states: [state(), state({ turnNum: 1 }), state({ turnNum: 2 }), state({ turnNum: 3 })],
      selectedSegment: 1,
      variantName: 'No Variant',
      reverseHands: false,
    });

    expect(context.beforeSegment).toBe(0);
    expect(context.afterSegment).toBe(1);
    expect(context.previousSegment).toBe(0);
    expect(context.nextSegment).toBe(2);
    expect(context.previousActionSegment).toBe(0);
    expect(context.nextActionSegment).toBe(2);
    expect(context.selectedTurn).toBe(2);
    expect(context.liveTurn).toBe(4);
    expect(context.newerActionCount).toBe(2);
  });

  test('navigates between timeline positions across sparse stored states', () => {
    const states: Array<GameState | undefined> = [
      state(),
      state({ turnNum: 1 }),
      undefined,
      state({ turnNum: 2 }),
      state({ turnNum: 3 }),
    ];
    const context = getC17TemporalContext({
      states,
      selectedSegment: 3,
      variantName: 'No Variant',
      reverseHands: false,
    });

    expect(context.beforeSegment).toBe(1);
    expect(context.afterSegment).toBe(3);
    expect(context.previousActionSegment).toBe(1);
    expect(context.nextActionSegment).toBe(4);
  });

  test('keeps the focused action while the live tail grows', () => {
    const states = [
      state(),
      state({ turnNum: 1 }),
      state({ turnNum: 2 }),
      state({ turnNum: 3 }),
      state({ turnNum: 4 }),
    ];
    const context = getC17TemporalContext({
      states,
      selectedSegment: 1,
      variantName: 'No Variant',
      reverseHands: false,
    });

    expect(context.selectedSegment).toBe(1);
    expect(context.beforeSegment).toBe(0);
    expect(context.afterSegment).toBe(1);
    expect(context.selectedTurn).toBe(2);
    expect(context.liveTurn).toBe(5);
    expect(context.newerActionCount).toBe(3);
  });

  test('keeps at least five recent actions and at least one full seating rotation', () => {
    const hands = [
      [10, 11, 12, 13],
      [20, 21, 22, 23],
      [30, 31, 32, 33],
      [40, 41, 42, 43],
      [50, 51, 52, 53],
    ];
    const states = Array.from({ length: 8 }, (_, turnNum) => state({ turnNum, hands }));
    const context = getC17TemporalContext({
      states,
      selectedSegment: 7,
      variantName: 'No Variant',
      reverseHands: false,
    });

    expect(context.recent).toHaveLength(5);
    expect(context.recent.map((entry) => entry.segment)).toEqual([2, 3, 4, 5, 6]);
  });

  test('keeps five recent actions even in a two-player game', () => {
    const states = Array.from({ length: 8 }, (_, turnNum) => state({ turnNum }));
    const context = getC17TemporalContext({
      states,
      selectedSegment: 7,
      variantName: 'No Variant',
      reverseHands: false,
    });

    expect(context.recent.map((entry) => entry.segment)).toEqual([2, 3, 4, 5, 6]);
  });
});
