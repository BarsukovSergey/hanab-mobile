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
    };

    expect(getCluePreview(game as never, 'No Variant', 1, 'rank', 1, context)?.touchedOrders).toEqual([]);
    expect(getHypotheticalActions(
      { type: 'rankClue', target: 1, value: 1 }, game as never, metadata as never,
      cardIdentities, context.morphedIdentities, context.notes,
    )?.[0]).toMatchObject({ type: 'clue', list: [] });
  });

  test('partial morph possibilities override the recorded identity for both preview and action', () => {
    const context = {
      cardIdentities,
      morphedIdentities: [undefined, { suitIndex: null, rank: 1 }] as unknown as readonly CardIdentity[],
      notes: [note, note],
    };
    const preview = getCluePreview(game as never, 'No Variant', 1, 'rank', 1, context);
    const actions = getHypotheticalActions(
      { type: 'rankClue', target: 1, value: 1 }, game as never, metadata as never,
      cardIdentities, context.morphedIdentities, context.notes,
    );

    expect(preview?.touchedOrders).toEqual([1]);
    expect(actions?.[0]).toMatchObject({ type: 'clue', list: preview?.touchedOrders });
  });
});
