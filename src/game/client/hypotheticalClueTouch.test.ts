import { describe, expect, test } from '@jest/globals';

import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
import type { CardNote } from '../upstream/interfaces/CardNote';
import { getCluePreview } from '../selectors/cluePreview';
import { getHypotheticalActions } from './hypotheticalActions';

const note: CardNote = {
  possibilities: [[1, 1]],
  knownTrash: false,
  needsFix: false,
  questionMark: false,
  exclamationMark: false,
  chopMoved: false,
  finessed: false,
  discardPermission: false,
  blank: false,
  unclued: false,
  clued: false,
  text: '',
};

const game = {
  turn: { currentPlayerIndex: 0, turnNum: 0 },
  hands: [[0], [1]],
  deck: [
    { order: 0, possibleCardsFromClues: [], possibleCards: [] },
    { order: 1, suitIndex: 0, rank: 2, possibleCardsFromClues: [[1, 1]], possibleCards: [[1, 1]] },
  ],
};

const metadata = { options: { variantName: 'No Variant', numPlayers: 2 } };
const cardIdentities: readonly CardIdentity[] = [
  { suitIndex: 0, rank: 2 },
  { suitIndex: 0, rank: 2 },
];

describe('hypothetical clue touches', () => {
  test('builds color clues from numeric message-color indexes', () => {
    const context = {
      cardIdentities,
      morphedIdentities: [] as readonly CardIdentity[],
      notes: [note, note],
      playing: true,
    };
    const preview = getCluePreview(game as never, 'No Variant', 1, 'color', 1, context);
    const actions = getHypotheticalActions(
      { type: 'colorClue', target: 1, value: 1 }, game as never, metadata as never,
      cardIdentities, context.morphedIdentities, context.notes, context.playing,
    );

    expect(preview?.touchedOrders).toEqual([1]);
    expect(actions?.[0]).toEqual({
      type: 'clue', clue: { type: 0, value: 1 }, giver: 0, list: preview?.touchedOrders,
      target: 1, ignoreNegative: false,
    });
  });

  test('supports color message index zero and rejects invalid color indexes', () => {
    const colorZeroGame = {
      ...game,
      deck: [
        game.deck[0],
        { ...game.deck[1], possibleCardsFromClues: [[0, 2]], possibleCards: [[0, 2]] },
      ],
    };
    const colorZeroNote: CardNote = { ...note, possibilities: [[0, 2]] };
    const context = {
      cardIdentities,
      morphedIdentities: [] as readonly CardIdentity[],
      notes: [note, colorZeroNote],
      playing: true,
    };
    const preview = getCluePreview(colorZeroGame as never, 'No Variant', 1, 'color', 0, context);
    const actions = getHypotheticalActions(
      { type: 'colorClue', target: 1, value: 0 }, colorZeroGame as never, metadata as never,
      cardIdentities, context.morphedIdentities, context.notes, context.playing,
    );

    expect(preview?.touchedOrders).toEqual([1]);
    expect(actions?.[0]).toMatchObject({ clue: { type: 0, value: 0 }, list: preview?.touchedOrders });
    expect(getHypotheticalActions(
      { type: 'colorClue', target: 1, value: 6 }, game as never, metadata as never,
      cardIdentities, context.morphedIdentities, context.notes, context.playing,
    )).toBeNull();
  });

  test('preserves rank clue message values', () => {
    const context = {
      cardIdentities,
      morphedIdentities: [] as readonly CardIdentity[],
      notes: [note, note],
      playing: true,
    };
    const preview = getCluePreview(game as never, 'No Variant', 1, 'rank', 1, context);
    const actions = getHypotheticalActions(
      { type: 'rankClue', target: 1, value: 1 }, game as never, metadata as never,
      cardIdentities, context.morphedIdentities, context.notes, context.playing,
    );

    expect(actions?.[0]).toMatchObject({ clue: { type: 1, value: 1 }, list: preview?.touchedOrders });
  });

  test('an explicit blank morph is never touched', () => {
    const context = {
      cardIdentities,
      morphedIdentities: [undefined, { suitIndex: null, rank: null }] as unknown as readonly CardIdentity[],
      notes: [note, note],
      playing: true,
    };

    expect(getCluePreview(game as never, 'No Variant', 1, 'rank', 1, context)?.touchedOrders).toEqual([]);
    expect(getHypotheticalActions(
      { type: 'rankClue', target: 1, value: 1 }, game as never, metadata as never,
      cardIdentities, context.morphedIdentities, context.notes, context.playing,
    )?.[0]).toMatchObject({ type: 'clue', list: [] });
  });

  test('partial morph possibilities override the recorded identity for both preview and action', () => {
    const context = {
      cardIdentities,
      morphedIdentities: [undefined, { suitIndex: null, rank: 1 }] as unknown as readonly CardIdentity[],
      notes: [note, note],
      playing: true,
    };
    const preview = getCluePreview(game as never, 'No Variant', 1, 'rank', 1, context);
    const actions = getHypotheticalActions(
      { type: 'rankClue', target: 1, value: 1 }, game as never, metadata as never,
      cardIdentities, context.morphedIdentities, context.notes, context.playing,
    );

    expect(preview?.touchedOrders).toEqual([1]);
    expect(actions?.[0]).toMatchObject({ type: 'clue', list: preview?.touchedOrders });
  });

  test('uses a singleton note-and-clue possibility for actions and clue touches only while playing', () => {
    const actionGame = {
      ...game,
      deck: [
        { ...game.deck[0], possibleCardsFromClues: [[1, 1]], possibleCards: [[1, 1]] },
        game.deck[1],
      ],
    };
    const context = {
      cardIdentities,
      morphedIdentities: [] as readonly CardIdentity[],
      notes: [note, note],
      playing: true,
    };
    const playingActions = getHypotheticalActions(
      { type: 'discard', order: 0 }, actionGame as never, metadata as never,
      cardIdentities, context.morphedIdentities, context.notes, context.playing,
    );
    const playingPreview = getCluePreview(game as never, 'No Variant', 1, 'rank', 1, context);

    expect(playingActions?.[0]).toMatchObject({ type: 'discard', suitIndex: 1, rank: 1, failed: false });
    expect(playingPreview?.touchedOrders).toEqual([1]);

    const reviewingContext = { ...context, playing: false };
    const reviewingActions = getHypotheticalActions(
      { type: 'discard', order: 0 }, actionGame as never, metadata as never,
      cardIdentities, reviewingContext.morphedIdentities, reviewingContext.notes, reviewingContext.playing,
    );
    const reviewingPreview = getCluePreview(game as never, 'No Variant', 1, 'rank', 1, reviewingContext);

    expect(reviewingActions?.[0]).toMatchObject({ type: 'discard', suitIndex: 0, rank: 2, failed: false });
    expect(reviewingPreview?.touchedOrders).toEqual([]);
  });
});

describe('mobile clue visibility compatibility at the U2 boundary', () => {
  const emptyNote: CardNote = { ...note, possibilities: [] };
  test.each([
    { morph: { suitIndex: 0, rank: null }, rankVisible: false, expected: [] },
    { morph: { suitIndex: null, rank: 1 }, rankVisible: true, expected: [1] },
  ])('empty possibilities preserve mobile visibility: %j', ({ morph, rankVisible, expected }) => {
    const state = {
      ...game,
      deck: [game.deck[0], { ...game.deck[1], possibleCardsFromClues: [], possibleCards: [] }],
    };
    const context = {
      cardIdentities, morphedIdentities: [undefined, morph] as unknown as readonly CardIdentity[],
      notes: [emptyNote, emptyNote], playing: true,
    };
    const preview = getCluePreview(state as never, 'No Variant', 1, 'rank', 1, context);
    const actions = getHypotheticalActions(
      { type: 'rankClue', target: 1, value: 1 }, state as never, metadata as never,
      cardIdentities, context.morphedIdentities, context.notes, context.playing,
    );
    expect(preview?.touchedOrders).toEqual(expected);
    expect(actions?.[0]).toMatchObject({ list: preview?.touchedOrders });
    expect(context.morphedIdentities[1]?.rank !== null).toBe(rankVisible);
  });

  test('reviewing unknown recorded identity can touch its visible note-derived rank', () => {
    const state = {
      ...game,
      deck: [game.deck[0], {
        ...game.deck[1], possibleCardsFromClues: [[0, 1], [1, 1]], possibleCards: [[0, 1], [1, 1]],
      }],
    };
    const context = {
      cardIdentities: [cardIdentities[0]!, { suitIndex: null, rank: null }],
      morphedIdentities: [] as readonly CardIdentity[], notes: [emptyNote, emptyNote], playing: false,
    };
    const preview = getCluePreview(state as never, 'No Variant', 1, 'rank', 1, context);
    const actions = getHypotheticalActions(
      { type: 'rankClue', target: 1, value: 1 }, state as never, metadata as never,
      context.cardIdentities, context.morphedIdentities, context.notes, context.playing,
    );
    expect(preview?.touchedOrders).toEqual([1]);
    expect(actions?.[0]).toMatchObject({ list: preview?.touchedOrders });
    expect(context.morphedIdentities).toEqual([]);
  });

  test.each([true, false])('ordinary visible cards agree for preview and planner, playing=%s', (playing) => {
    const context = { cardIdentities, morphedIdentities: [] as readonly CardIdentity[], notes: [emptyNote, emptyNote], playing };
    const state = {
      ...game, deck: [game.deck[0], { ...game.deck[1], possibleCardsFromClues: [[0, 2], [1, 1]], possibleCards: [[0, 2], [1, 1]] }],
    };
    for (const type of ['color', 'rank'] as const) {
      const value = type === 'color' ? 0 : 2;
      const preview = getCluePreview(state as never, 'No Variant', 1, type, value, context);
      const actions = getHypotheticalActions(
        { type: type === 'color' ? 'colorClue' : 'rankClue', target: 1, value },
        state as never, metadata as never, cardIdentities, context.morphedIdentities, context.notes, playing,
      );
      expect(preview?.touchedOrders).toEqual([1]);
      expect(actions?.[0]).toMatchObject({ list: preview?.touchedOrders });
    }
  });

  test('unavailable clue card input is skipped equally by preview and planning', () => {
    const context = { cardIdentities, morphedIdentities: [] as readonly CardIdentity[], notes: [], playing: true };
    const preview = getCluePreview(game as never, 'No Variant', 1, 'rank', 1, context);
    const actions = getHypotheticalActions(
      { type: 'rankClue', target: 1, value: 1 }, game as never, metadata as never,
      cardIdentities, context.morphedIdentities, context.notes, context.playing,
    );
    expect(preview?.touchedOrders).toEqual([]);
    expect(actions?.[0]).toMatchObject({ list: [] });
    expect(game.hands).toEqual([[0], [1]]);
  });
});

test('blank morph with empty clue possibilities never needs a visibility lookup', () => {
  const state = {
    ...game, deck: [game.deck[0], { ...game.deck[1], possibleCardsFromClues: [], possibleCards: [] }],
  };
  const context = {
    cardIdentities, morphedIdentities: [undefined, { suitIndex: null, rank: null }] as unknown as readonly CardIdentity[],
    notes: [note, note], playing: false,
  };
  expect(getCluePreview(state as never, 'No Variant', 1, 'rank', 1, context)?.touchedOrders).toEqual([]);
  expect(getHypotheticalActions(
    { type: 'rankClue', target: 1, value: 1 }, state as never, metadata as never,
    cardIdentities, context.morphedIdentities, context.notes, context.playing,
  )?.[0]).toMatchObject({ list: [] });
});
