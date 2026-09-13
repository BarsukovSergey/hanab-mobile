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
