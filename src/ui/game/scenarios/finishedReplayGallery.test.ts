import { describe, expect, test } from '@jest/globals';

import { getFinishedReplayScenario, getGameplayGalleryScenarios } from './gameplayScenarios';

describe('finished replay gallery fixture', () => {
  test('reaches authoritative finished shared replay state', () => {
    const scenario = getFinishedReplayScenario();
    const room = scenario.store.getState().room.room;

    expect(scenario.id).toBe('finished-shared-replay');
    expect(scenario.family).toBe('finished-replay');
    expect(room.kind).toBe('live_game');
    if (room.kind !== 'live_game') return;

    expect(room.clientState).toMatchObject({
      playing: false,
      finished: true,
      replay: {
        active: true,
        databaseID: 456,
        shared: {
          leader: 'Alice',
          amLeader: true,
          useSharedSegments: true,
        },
      },
    });
    expect(room.gameHistory).toMatchObject({ id: 456, endCondition: 1 });
    expect(room.clientState.ongoingGame.deck[0]).toMatchObject({ suitIndex: 0, rank: 1 });
  });

  test('is exposed by the developer gallery without changing the live scenario registry', () => {
    const gallery = getGameplayGalleryScenarios();
    expect(gallery.at(-1)?.id).toBe('finished-shared-replay');
  });
});
