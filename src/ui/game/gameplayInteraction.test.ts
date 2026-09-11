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

  test('card action takes over from clue planning', () => {
    const targeted = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-clue-target', playerIndex: 2 });
    const previewed = gameplayInteractionReducer(targeted, { type: 'preview-clue', clueType: 'rank', value: 3 });
    expect(gameplayInteractionReducer(previewed, { type: 'select-card', order: 12 })).toMatchObject({
      selectedCard: 12,
      clueTarget: null,
      cluePreview: null,
    });
  });

  test('opening notes replaces clue composer and clears the plan', () => {
    const targeted = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-clue-target', playerIndex: 2 });
    const previewed = gameplayInteractionReducer(targeted, { type: 'preview-clue', clueType: 'rank', value: 3 });
    expect(gameplayInteractionReducer(previewed, { type: 'open-note', order: 20 })).toMatchObject({
      noteCard: 20,
      clueTarget: null,
      cluePreview: null,
    });
  });

  test('retargeting preserves the clue candidate for authoritative recomputation', () => {
    const targeted = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-clue-target', playerIndex: 1 });
    const previewed = gameplayInteractionReducer(targeted, { type: 'preview-clue', clueType: 'color', value: 0 });
    const retargeted = gameplayInteractionReducer(previewed, { type: 'select-clue-target', playerIndex: 2 });
    expect(retargeted).toMatchObject({
      clueTarget: 2,
      cluePreview: { type: 'color', value: 0 },
    });
  });

  test('closing clue planning clears target and preview', () => {
    const targeted = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-clue-target', playerIndex: 2 });
    const previewed = gameplayInteractionReducer(targeted, { type: 'preview-clue', clueType: 'rank', value: 3 });
    expect(gameplayInteractionReducer(previewed, { type: 'clear-clue-preview' })).toMatchObject({
      clueTarget: null,
      cluePreview: null,
    });
  });

  test('entering clue mode disables global empathy', () => {
    const global = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'toggle-global-empathy' });
    expect(global.globalEmpathy).toBe(true);
    expect(gameplayInteractionReducer(global, { type: 'select-clue-target', playerIndex: 2 }))
      .toMatchObject({ clueTarget: 2, globalEmpathy: false, empathyPlayer: null });
  });

  test('per-hand empathy is temporary hold-only', () => {
    const held = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'hold-empathy', playerIndex: 2 });
    expect(held.empathyPlayer).toBe(2);
    expect(gameplayInteractionReducer(held, { type: 'hold-empathy', playerIndex: null }).empathyPlayer).toBeNull();
  });

  test('per-hand hold is a no-op while global empathy is on', () => {
    const global = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'toggle-global-empathy' });
    expect(gameplayInteractionReducer(global, { type: 'hold-empathy', playerIndex: 2 }))
      .toMatchObject({ globalEmpathy: true, empathyPlayer: null });
  });

  test('lifecycle interruption clears temporary empathy but keeps global empathy', () => {
    const global = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'toggle-global-empathy' });
    const resetGlobal = gameplayInteractionReducer(global, { type: 'reset-lifecycle-transients' });
    expect(resetGlobal).toMatchObject({ globalEmpathy: true, empathyPlayer: null });

    const held = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'hold-empathy', playerIndex: 2 });
    expect(gameplayInteractionReducer(held, { type: 'reset-lifecycle-transients' }))
      .toMatchObject({ globalEmpathy: false, empathyPlayer: null });
  });

  test('sync drops stale card/clue/empathy references without retargeting note order', () => {
    const stale = {
      selectedCard: 99,
      clueTarget: 4,
      cluePreview: { type: 'rank' as const, value: 3 },
      empathyPlayer: 4,
      globalEmpathy: false,
      noteCard: 88,
    };
    const synced = gameplayInteractionReducer(stale, {
      type: 'sync-hands',
      ownOrders: [10, 11, 12],
      clueTargets: [1, 2],
      empathyPlayers: [0, 1, 2],
      visibleOrders: [10, 11, 12, 20, 21],
    });

    expect(synced).toEqual({
      selectedCard: null,
      clueTarget: null,
      cluePreview: null,
      empathyPlayer: null,
      globalEmpathy: false,
      noteCard: 88,
    });
  });

  test('preserves valid clue candidate and durable note order through authoritative sync', () => {
    const selected = {
      selectedCard: 11,
      clueTarget: 2,
      cluePreview: { type: 'color' as const, value: 0 },
      empathyPlayer: null,
      globalEmpathy: false,
      noteCard: 20,
    };
    expect(gameplayInteractionReducer(selected, {
      type: 'sync-hands',
      ownOrders: [10, 11, 12],
      clueTargets: [1, 2],
      empathyPlayers: [0, 1, 2],
      visibleOrders: [10, 11, 12],
    })).toEqual(selected);
  });
});
