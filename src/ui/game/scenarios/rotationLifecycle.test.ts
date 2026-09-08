import { describe, expect, test } from '@jest/globals';

import {
  gameplayInteractionReducer,
} from '../gameplayInteraction';
import { getGameplayLayout } from '../gameplayLayout';
import { getGameplayScenarios } from './gameplayScenarios';

describe('gameplay rotation lifecycle', () => {
  test('recomputes portrait/landscape geometry without mutating authoritative game state', () => {
    const scenario = getGameplayScenarios().find((candidate) => candidate.id === 'three-player-extra-card');
    expect(scenario).toBeDefined();
    if (scenario === undefined) return;

    const room = scenario.store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live extra-card scenario.');
    const game = room.clientState.ongoingGame;
    const before = room.clientState.replay.actions;
    const input = {
      handSizes: game.hands.map((hand) => hand.length),
      ourPlayerIndex: room.clientState.metadata.ourPlayerIndex,
    };

    const portrait = getGameplayLayout({
      ...input,
      viewportWidth: 320,
      viewportHeight: 568,
    });
    const landscape = getGameplayLayout({
      ...input,
      viewportWidth: 568,
      viewportHeight: 320,
    });
    const portraitAgain = getGameplayLayout({
      ...input,
      viewportWidth: 320,
      viewportHeight: 568,
    });

    expect(portrait.orientation).toBe('portrait');
    expect(landscape.orientation).toBe('landscape');
    expect(portraitAgain).toEqual(portrait);
    expect(portrait.ownCardHeight).toBeGreaterThanOrEqual(portrait.opponentCardHeight);
    expect(landscape.ownCardHeight).toBeGreaterThanOrEqual(landscape.opponentCardHeight);
    expect(room.clientState.replay.actions).toBe(before);
    expect(room.clientState.ongoingGame).toBe(game);
  });

  test('preserves recoverable reasoning context at orientation and background boundaries', () => {
    const active = {
      selectedCard: 3,
      clueTarget: 1,
      cluePreview: { type: 'rank' as const, value: 2 },
      empathyPlayer: 1,
      persistentEmpathyPlayer: 1,
      globalEmpathy: false,
      noteCard: 5,
    };

    const afterRotation = gameplayInteractionReducer(active, { type: 'reset-lifecycle-transients' });
    expect(afterRotation).toEqual(active);

    const afterBackground = gameplayInteractionReducer(active, { type: 'reset-lifecycle-transients' });
    expect(afterBackground).toEqual(active);
  });
});
