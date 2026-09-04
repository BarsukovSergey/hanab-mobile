import { describe, expect, test } from '@jest/globals';

import {
  gameplayInteractionReducer,
  initialGameplayInteractionState,
} from './gameplayInteraction';

describe('gameplayInteractionReducer', () => {
  test('keeps card selection and card note selection coupled deliberately', () => {
    const state = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-card', order: 12 });
    expect(state).toMatchObject({ selectedCard: 12, noteCard: 12 });
  });

  test('keeps clue targeting independent from card notes', () => {
    const selected = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-card', order: 12 });
    const targeted = gameplayInteractionReducer(selected, { type: 'select-clue-target', playerIndex: 2 });
    expect(targeted).toMatchObject({ selectedCard: 12, noteCard: 12, clueTarget: 2 });
  });

  test('models empathy as momentary player state', () => {
    const held = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'hold-empathy', playerIndex: 1 });
    expect(held.empathyPlayer).toBe(1);
    const released = gameplayInteractionReducer(held, { type: 'hold-empathy', playerIndex: null });
    expect(released.empathyPlayer).toBeNull();
  });

  test('syncs stale references to authoritative visible hands', () => {
    const stale = {
      selectedCard: 99,
      clueTarget: 4,
      empathyPlayer: 4,
      noteCard: 88,
    };
    const synced = gameplayInteractionReducer(stale, {
      type: 'sync-hands',
      ownOrders: [10, 11, 12],
      clueTargets: [1, 2],
      visibleOrders: [10, 11, 12, 20, 21],
    });

    expect(synced).toEqual({
      selectedCard: 12,
      clueTarget: 1,
      empathyPlayer: null,
      noteCard: 12,
    });
  });
});
