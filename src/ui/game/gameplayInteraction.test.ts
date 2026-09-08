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

  test('keeps clue targeting independent from an already selected card', () => {
    const selected = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-card', order: 12 });
    const targeted = gameplayInteractionReducer(selected, { type: 'select-clue-target', playerIndex: 2 });
    expect(targeted).toMatchObject({ selectedCard: 12, noteCard: 12, clueTarget: 2 });
  });

  test('clears stale clue mode when a card action takes over', () => {
    const targeted = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-clue-target', playerIndex: 2 });
    const previewed = gameplayInteractionReducer(targeted, { type: 'preview-clue', clueType: 'rank', value: 3 });
    expect(gameplayInteractionReducer(previewed, { type: 'select-card', order: 12 })).toMatchObject({
      selectedCard: 12,
      clueTarget: null,
      cluePreview: null,
    });
  });

  test('note inspection preserves an in-progress clue plan', () => {
    const targeted = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-clue-target', playerIndex: 2 });
    const previewed = gameplayInteractionReducer(targeted, { type: 'preview-clue', clueType: 'rank', value: 3 });
    expect(gameplayInteractionReducer(previewed, { type: 'open-note', order: 20 })).toMatchObject({
      noteCard: 20,
      clueTarget: 2,
      cluePreview: { type: 'rank', value: 3 },
    });
  });

  test('clears clue preview when the clue target changes', () => {
    const targeted = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-clue-target', playerIndex: 1 });
    const previewed = gameplayInteractionReducer(targeted, { type: 'preview-clue', clueType: 'color', value: 0 });
    expect(previewed.cluePreview).toEqual({ type: 'color', value: 0 });
    const retargeted = gameplayInteractionReducer(previewed, { type: 'select-clue-target', playerIndex: 2 });
    expect(retargeted.cluePreview).toBeNull();
  });

  test('closing clue planning clears target and preview without discarding preserved card context', () => {
    const selected = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'select-card', order: 12 });
    const targeted = gameplayInteractionReducer(selected, { type: 'select-clue-target', playerIndex: 2 });
    const previewed = gameplayInteractionReducer(targeted, { type: 'preview-clue', clueType: 'rank', value: 3 });

    expect(gameplayInteractionReducer(previewed, { type: 'clear-clue-preview' })).toMatchObject({
      selectedCard: 12,
      noteCard: 12,
      clueTarget: null,
      cluePreview: null,
    });
  });

  test('toggles persistent per-hand empathy', () => {
    const enabled = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'toggle-empathy-player', playerIndex: 1 });
    expect(enabled).toMatchObject({ empathyPlayer: 1, persistentEmpathyPlayer: 1, globalEmpathy: false });
    expect(gameplayInteractionReducer(enabled, { type: 'toggle-empathy-player', playerIndex: 1 }))
      .toMatchObject({ empathyPlayer: null, persistentEmpathyPlayer: null, globalEmpathy: false });
  });

  test('temporary hold empathy restores the persistent target on release', () => {
    const persistent = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'toggle-empathy-player', playerIndex: 1 });
    const held = gameplayInteractionReducer(persistent, { type: 'hold-empathy', playerIndex: 2 });
    expect(held).toMatchObject({ empathyPlayer: 2, persistentEmpathyPlayer: 1 });
    expect(gameplayInteractionReducer(held, { type: 'hold-empathy', playerIndex: null }))
      .toMatchObject({ empathyPlayer: 1, persistentEmpathyPlayer: 1 });
  });

  test('global empathy and per-hand empathy are explicit mutually exclusive persistent modes', () => {
    const perHand = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'toggle-empathy-player', playerIndex: 1 });
    const global = gameplayInteractionReducer(perHand, { type: 'toggle-global-empathy' });
    expect(global).toMatchObject({ empathyPlayer: null, persistentEmpathyPlayer: null, globalEmpathy: true });
    const otherHand = gameplayInteractionReducer(global, { type: 'toggle-empathy-player', playerIndex: 2 });
    expect(otherHand).toMatchObject({ empathyPlayer: 2, persistentEmpathyPlayer: 2, globalEmpathy: false });
  });

  test('note and clue inspection do not destroy persistent empathy', () => {
    const empathized = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'toggle-empathy-player', playerIndex: 1 });
    expect(gameplayInteractionReducer(empathized, { type: 'open-note', order: 20 }).persistentEmpathyPlayer).toBe(1);
    expect(gameplayInteractionReducer(empathized, { type: 'select-clue-target', playerIndex: 2 }).persistentEmpathyPlayer).toBe(1);
    expect(gameplayInteractionReducer(empathized, { type: 'select-card', order: 12 }).persistentEmpathyPlayer).toBe(1);
  });

  test('preserves valid empathy across authoritative hand sync', () => {
    const empathized = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'toggle-empathy-player', playerIndex: 1 });
    const synced = gameplayInteractionReducer(empathized, {
      type: 'sync-hands',
      ownOrders: [10, 11, 12],
      clueTargets: [1, 2],
      empathyPlayers: [1, 2],
      visibleOrders: [10, 11, 12, 20, 21],
    });
    expect(synced).toMatchObject({ empathyPlayer: 1, persistentEmpathyPlayer: 1 });
  });

  test('drops an empathy target that is no longer a valid other hand', () => {
    const empathized = gameplayInteractionReducer(initialGameplayInteractionState, { type: 'toggle-empathy-player', playerIndex: 4 });
    const synced = gameplayInteractionReducer(empathized, {
      type: 'sync-hands',
      ownOrders: [10, 11, 12],
      clueTargets: [1, 2],
      empathyPlayers: [1, 2],
      visibleOrders: [10, 11, 12, 20, 21],
    });
    expect(synced).toMatchObject({ empathyPlayer: null, persistentEmpathyPlayer: null });
  });

  test('disarms gameplay for temporal boundaries without discarding inspection modes', () => {
    const active = {
      selectedCard: 11,
      clueTarget: 2,
      cluePreview: { type: 'color' as const, value: 0 },
      empathyPlayer: 1,
      persistentEmpathyPlayer: 1,
      globalEmpathy: false,
      noteCard: 20,
    };
    expect(gameplayInteractionReducer(active, { type: 'disarm-gameplay' })).toEqual({
      selectedCard: null,
      clueTarget: null,
      cluePreview: null,
      empathyPlayer: 1,
      persistentEmpathyPlayer: 1,
      globalEmpathy: false,
      noteCard: 20,
    });
  });

  test('lifecycle transient reset restores persistent empathy and preserves reasoning context', () => {
    const active = {
      selectedCard: 11,
      clueTarget: 2,
      cluePreview: { type: 'color' as const, value: 0 },
      empathyPlayer: 2,
      persistentEmpathyPlayer: 1,
      globalEmpathy: false,
      noteCard: 20,
    };
    expect(gameplayInteractionReducer(active, { type: 'reset-lifecycle-transients' })).toEqual({
      ...active,
      empathyPlayer: 1,
    });
  });

  test('drops stale interaction references without silently selecting replacements', () => {
    const stale = {
      selectedCard: 99,
      clueTarget: 4,
      cluePreview: { type: 'rank' as const, value: 3 },
      empathyPlayer: 4,
      persistentEmpathyPlayer: 4,
      globalEmpathy: false,
      noteCard: 88,
    };
    const synced = gameplayInteractionReducer(stale, {
      type: 'sync-hands',
      ownOrders: [10, 11, 12],
      clueTargets: [1, 2],
      empathyPlayers: [1, 2],
      visibleOrders: [10, 11, 12, 20, 21],
    });

    expect(synced).toEqual({
      selectedCard: null,
      clueTarget: null,
      cluePreview: null,
      empathyPlayer: null,
      persistentEmpathyPlayer: null,
      globalEmpathy: false,
      noteCard: null,
    });
  });

  test('preserves durable still-valid reasoning context through authoritative updates', () => {
    const selected = {
      selectedCard: 11,
      clueTarget: 2,
      cluePreview: { type: 'color' as const, value: 0 },
      empathyPlayer: 1,
      persistentEmpathyPlayer: 1,
      globalEmpathy: false,
      noteCard: 20,
    };
    expect(gameplayInteractionReducer(selected, {
      type: 'sync-hands',
      ownOrders: [10, 11, 12],
      clueTargets: [1, 2],
      empathyPlayers: [1, 2],
      visibleOrders: [10, 11, 12, 20, 21],
    })).toEqual(selected);
  });
});
