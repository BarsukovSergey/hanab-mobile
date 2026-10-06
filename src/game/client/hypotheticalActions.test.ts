import { describe, expect, test } from '@jest/globals';
import { getDefaultMetadata } from '../upstream/metadata';
import { getDefaultVariant } from '../upstream/gameData';
import { getInitialGameState } from '../upstream/reducers/initialStates/initialGameState';
import { getInitialCardState } from '../upstream/reducers/initialStates/initialCardState';
import type { CardOrder } from '../upstream/types/CardOrder';
import type { PlayerIndex } from '../upstream/types/PlayerIndex';
import type { SuitIndex } from '../upstream/types/SuitIndex';
import type { CardIdentity } from '../upstream/interfaces/CardIdentity';
import { getHypotheticalActions, type HypotheticalClientAction } from './hypotheticalActions';

const metadata = getDefaultMetadata(2);
const variant = getDefaultVariant();
const initial = getInitialGameState(metadata);
const game = {
  ...initial,
  turn: { ...initial.turn, currentPlayerIndex: 0 as PlayerIndex, segment: 0 },
  deck: [0, 1, 2].map((order) => getInitialCardState(order as CardOrder, variant, 2)),
  hands: [[0 as CardOrder], [1 as CardOrder]],
} as typeof initial;
const identities: readonly CardIdentity[] = Array.from({ length: 3 }, () => ({ suitIndex: 0 as SuitIndex, rank: 1 }));
const notes = identities.map(() => ({
  possibilities: [], knownTrash: false, needsFix: false, questionMark: false,
  exclamationMark: false, chopMoved: false, finessed: false, discardPermission: false,
  blank: false, unclued: false, clued: false, text: '',
}));
const plan = (action: HypotheticalClientAction, state = game, cards = identities, cardNotes = notes) =>
  getHypotheticalActions(action, state, metadata, cards, [], cardNotes, false);

describe('mobile hypothetical policy', () => {
  test.each(['play', 'discard'] as const)('%s rejects another hand and deck orders', (type) => {
    expect(plan({ type, order: 0 })).not.toBeNull();
    expect(plan({ type, order: 1 })).toBeNull();
    expect(plan({ type, order: 2 })).toBeNull();
    expect(plan({ type, order: 999 })).toBeNull();
  });

  test.each(['colorClue', 'rankClue'] as const)('%s rejects invalid and self targets', (type) => {
    const value = type === 'colorClue' ? 0 : 1;
    for (const target of [0, -1, 2, 0.5, NaN, Infinity]) {
      expect(plan({ type, target, value })).toBeNull();
    }
  });

  test.each(['colorClue', 'rankClue'] as const)('%s rejects invalid values', (type) => {
    for (const value of [-1, 6, 99, 0.5, NaN, Infinity]) {
      expect(plan({ type, target: 1, value })).toBeNull();
    }
    expect(plan({ type: 'rankClue', target: 1, value: 0 })).toBeNull();
  });

  test.each(['play', 'discard'] as const)('%s rejects unavailable card data and incomplete identity', (type) => {
    const action = { type, order: 0 };
    expect(plan(action, { ...game, deck: [] })).toBeNull();
    expect(plan(action, game, [])).toBeNull();
    expect(plan(action, game, identities, [])).toBeNull();
    expect(plan(action, game, [{ suitIndex: null, rank: 1 }])).toBeNull();
    expect(plan(action, game, [{ suitIndex: 0 as SuitIndex, rank: null }])).toBeNull();
    expect(plan(action, { ...game, turn: { ...game.turn, currentPlayerIndex: null } })).toBeNull();
  });

  test('invalid play-stack data rejects without throwing', () => {
    for (const state of [
      { ...game, playStacks: [] },
      { ...game, playStackDirections: [] },
      { ...game, playStackDirections: [999] },
    ]) {
      expect(() => plan({ type: 'play', order: 0 }, state as unknown as typeof game)).not.toThrow();
      expect(plan({ type: 'play', order: 0 }, state as unknown as typeof game)).toBeNull();
    }
  });
});
