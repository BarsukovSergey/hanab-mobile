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

  test('clears clue preview when the clue target changes', () => {
    const targeted = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-clue-target', playerIndex: 1 });
    const previewed = gameplayInteractionReducer(targeted, { type: 'preview-clue', clueType: 'color', value: 0 });
    expect(previewed.cluePreview).toEqual({ type: 'color', value: 0 });
    const retargeted = gameplayInteractionReducer(previewed, { type: 'select-clue-target', playerIndex: 2 });
    expect(retargeted.cluePreview).toBeNull();
  });

  test('models empathy as momentary player state', () => {
    const held = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'hold-empathy', playerIndex: 1 });
    expect(held.empathyPlayer).toBe(1);
    const released = gameplayInteractionReducer(held, { type: 'hold-empathy', playerIndex: null });
    expect(released.empathyPlayer).toBeNull();
  });

  test('clears empathy when another interaction takes over', () => {
    const held = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'hold-empathy', playerIndex: 1 });
    expect(gameplayInteractionReducer(held, { type: 'open-note', order: 20 }).empathyPlayer).toBeNull();
    expect(gameplayInteractionReducer(held, { type: 'select-clue-target', playerIndex: 2 }).empathyPlayer).toBeNull();
    expect(gameplayInteractionReducer(held, { type: 'cancel-transient' }).empathyPlayer).toBeNull();
  });

  test('drops stale interaction references without silently selecting replacements', () => {
    const stale = {
      selectedCard: 99,
      clueTarget: 4,
      cluePreview: { type: 'rank' as const, value: 3 },
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
      selectedCard: null,
      clueTarget: null,
      cluePreview: null,
      empathyPlayer: null,
      noteCard: null,
    });
  });

  test('preserves still-valid explicit selections through authoritative updates', () => {
    const selected = {
      selectedCard: 11,
      clueTarget: 2,
      cluePreview: { type: 'color' as const, value: 0 },
      empathyPlayer: null,
      noteCard: 20,
    };
    expect(gameplayInteractionReducer(selected, {
      type: 'sync-hands',
      ownOrders: [10, 11, 12],
      clueTargets: [1, 2],
      visibleOrders: [10, 11, 12, 20, 21],
    })).toEqual(selected);
  });
});
