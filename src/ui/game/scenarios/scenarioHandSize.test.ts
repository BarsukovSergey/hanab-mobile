import { describe, expect, test } from '@jest/globals';

import { getGameplayCardsPerHand } from '../../../game/selectors/gameplay';
import { getGameplayLayout, getHandRowWidth } from '../gameplayLayout';
import { getGameplayScenarios } from './gameplayScenarios';

describe('scenario hand-size parity', () => {
  const scenarios = getGameplayScenarios();

  test('every canonical initial deal matches the pinned upstream hand-size rule', () => {
    for (const scenario of scenarios) {
      const room = scenario.store.getState().room.room;
      if (room.kind !== 'live_game') throw new Error(`Expected live room for ${scenario.id}.`);
      const expected = getGameplayCardsPerHand(room.clientState.metadata);
      expect(room.clientState.ongoingGame.hands.map((hand) => hand.length)).toEqual(
        Array.from({ length: room.clientState.metadata.options.numPlayers }, () => expected),
      );
    }
  });

  test('fits a six-card 3P One Extra Card deal on the narrow portrait target', () => {
    const scenario = scenarios.find((candidate) => candidate.id === 'three-player-extra-card');
    if (scenario === undefined) throw new Error('Missing three-player-extra-card scenario.');
    const room = scenario.store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live extra-card room.');
    const game = room.clientState.ongoingGame;

    expect(room.clientState.metadata.options.oneExtraCard).toBe(true);
    expect(getGameplayCardsPerHand(room.clientState.metadata)).toBe(6);
    expect(game.hands.map((hand) => hand.length)).toEqual([6, 6, 6]);

    const layout = getGameplayLayout({
      viewportWidth: scenario.viewport.width,
      viewportHeight: scenario.viewport.height,
      handSizes: game.hands.map((hand) => hand.length),
      ourPlayerIndex: room.clientState.metadata.ourPlayerIndex,
    });
    expect(layout.orientation).toBe('portrait');
    expect(getHandRowWidth(layout.ownCardHeight, 6, layout.cardGap)).toBeLessThanOrEqual(layout.ownLaneWidth);
    expect(getHandRowWidth(layout.opponentCardHeight, 6, layout.cardGap)).toBeLessThanOrEqual(layout.opponentLaneWidth);
  });

  test('makes the four-card 6P dense landscape fixture explicit One Extra Card', () => {
    const scenario = scenarios.find((candidate) => candidate.id === 'six-player-landscape');
    if (scenario === undefined) throw new Error('Missing six-player-landscape scenario.');
    const room = scenario.store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live six-player room.');

    expect(room.clientState.metadata.options.oneExtraCard).toBe(true);
    expect(getGameplayCardsPerHand(room.clientState.metadata)).toBe(4);
    expect(room.clientState.ongoingGame.hands.map((hand) => hand.length)).toEqual([4, 4, 4, 4, 4, 4]);
  });
});
