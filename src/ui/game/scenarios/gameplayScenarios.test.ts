import { describe, expect, test } from '@jest/globals';

import { getCluePreview } from '../../../game/selectors/cluePreview';
import { getGameplayLayout } from '../gameplayLayout';
import { gameplayScenarios } from './gameplayScenarios';

describe('gameplay scenario harness', () => {
  test('keeps canonical ids unique and bootstraps every scenario through the real headless client', () => {
    expect(new Set(gameplayScenarios.map((scenario) => scenario.id)).size).toBe(gameplayScenarios.length);

    for (const scenario of gameplayScenarios) {
      const room = scenario.store.getState().room.room;
      expect(room.kind).toBe('live_game');
      if (room.kind !== 'live_game') continue;
      expect(room.clientState.visibleState).not.toBeNull();
      expect(room.clientState.visibleState).toBe(room.clientState.ongoingGame);
      expect(room.clientState.ongoingGame.turn.currentPlayerIndex).toBe(0);
    }
  });

  test('keeps scenario stores isolated from one another', () => {
    const stores = gameplayScenarios.map((scenario) => scenario.store);
    expect(new Set(stores).size).toBe(stores.length);
  });

  test('contains a deterministic one-card clue preview source', () => {
    const scenario = gameplayScenarios.find((candidate) => candidate.id === 'clue-preview-source');
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;
    const room = scenario.store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live clue-preview scenario.');
    const game = room.clientState.visibleState;
    if (game === null) throw new Error('Expected visible clue-preview game.');

    const previewState = scenario.expectedInteraction.cluePreview;
    const target = scenario.expectedInteraction.clueTarget;
    expect(previewState).not.toBeNull();
    expect(target).toBe(1);
    if (previewState === null || target === null) return;

    const preview = getCluePreview(
      game,
      room.clientState.metadata.options.variantName,
      target,
      previewState.type,
      previewState.value,
    );
    expect(preview?.touchedOrders).toHaveLength(1);
  });

  test('runs canonical viewport targets through the production layout calculation', () => {
    const expectedOrientations = new Map<string, 'portrait' | 'landscape'>([
      ['three-player-base', 'portrait'],
      ['clue-preview-source', 'portrait'],
      ['six-player-landscape', 'landscape'],
    ]);

    for (const scenario of gameplayScenarios) {
      const room = scenario.store.getState().room.room;
      if (room.kind !== 'live_game') throw new Error(`Missing live room for ${scenario.id}.`);
      const game = room.clientState.visibleState;
      if (game === null) throw new Error(`Missing visible game for ${scenario.id}.`);

      const layout = getGameplayLayout({
        viewportWidth: scenario.viewport.width,
        viewportHeight: scenario.viewport.height,
        handSizes: game.hands.map((hand) => hand.length),
        ourPlayerIndex: room.clientState.metadata.ourPlayerIndex,
      });

      expect(layout.orientation).toBe(expectedOrientations.get(scenario.id));
      expect(layout.ownCardHeight).toBeGreaterThan(0);
      expect(layout.opponentCardHeight).toBeGreaterThan(0);
      expect(layout.ownCardHeight).toBeGreaterThanOrEqual(layout.opponentCardHeight);
    }
  });

  test('keeps the dense six-player fixture honest', () => {
    const scenario = gameplayScenarios.find((candidate) => candidate.id === 'six-player-landscape');
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;
    const room = scenario.store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live six-player scenario.');
    const game = room.clientState.visibleState;
    if (game === null) throw new Error('Expected visible six-player game.');

    expect(room.clientState.metadata.playerNames).toHaveLength(6);
    expect(game.hands).toHaveLength(6);
    expect(game.hands.map((hand) => hand.length)).toEqual([4, 4, 4, 4, 4, 4]);
  });
});
