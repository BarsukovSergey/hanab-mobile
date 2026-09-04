import { describe, expect, test } from '@jest/globals';

import { GameBootstrapCoordinator } from '../../../game/bootstrap/GameBootstrapCoordinator';
import { getCluePreview, isCluePreviewConfirmable } from '../../../game/selectors/cluePreview';
import { getGameplayClueChoicesForPlayer } from '../../../game/selectors/gameplay';
import { gameActionListSchema, gameInitSchema } from '../../../protocol/gameProtocol';
import { makeInit } from '../../../protocol/gameProtocol.fixtures';
import { roomActions } from '../../../store/roomSlice';
import { sessionActions } from '../../../store/sessionSlice';
import { createAppStore } from '../../../store/store';

const TABLE_ID = 123;

function buildGame(emptyClues: boolean) {
  const store = createAppStore();
  store.dispatch(sessionActions.connectionStarted({ epoch: 1 }));
  store.dispatch(sessionActions.welcomeReceived({
    epoch: 1,
    welcome: { userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [] },
  }));
  store.dispatch(roomActions.joinRequested({ epoch: 1, tableID: TABLE_ID }));
  store.dispatch(roomActions.tableStartReceived({
    epoch: 1,
    tableStart: { tableID: TABLE_ID, replay: false },
  }));

  const coordinator = new GameBootstrapCoordinator(store, () => true);
  const gameLoadEpoch = coordinator.startFromAuthoritativeRoom(1);
  if (gameLoadEpoch === null) throw new Error('Expected bootstrap to start.');

  const base = makeInit();
  const init = gameInitSchema.parse(makeInit({
    tableID: TABLE_ID,
    playerNames: ['Ada', 'Bob'],
    ourPlayerIndex: 0,
    options: {
      ...base.options,
      numPlayers: 2,
      emptyClues,
    },
  }));
  expect(coordinator.receiveInit(1, gameLoadEpoch, init)).toBe(true);
  expect(coordinator.receiveHistory(1, gameLoadEpoch, gameActionListSchema.parse({
    tableID: TABLE_ID,
    list: [
      ...Array.from({ length: 5 }, (_, order) => ({
        type: 'draw' as const,
        playerIndex: 0,
        order,
        suitIndex: -1,
        rank: -1,
      })),
      ...Array.from({ length: 5 }, (_, position) => ({
        type: 'draw' as const,
        playerIndex: 1,
        order: position + 5,
        suitIndex: 1,
        rank: position + 1,
      })),
      { type: 'turn', num: 0, currentPlayerIndex: 0 },
    ],
  }))).toBe(true);

  const room = store.getState().room.room;
  if (room.kind !== 'live_game') throw new Error('Expected live game.');
  return room;
}

describe('Empty Clues acceptance', () => {
  test('uses authoritative option to decide whether a zero-touch clue can be confirmed', () => {
    const disabled = buildGame(false);
    const enabled = buildGame(true);

    const disabledPreview = getCluePreview(
      disabled.clientState.ongoingGame,
      disabled.clientState.metadata.options.variantName,
      1,
      'color',
      0,
    );
    const enabledPreview = getCluePreview(
      enabled.clientState.ongoingGame,
      enabled.clientState.metadata.options.variantName,
      1,
      'color',
      0,
    );

    expect(disabledPreview?.touchedOrders).toEqual([]);
    expect(enabledPreview?.touchedOrders).toEqual([]);

    const disabledChoices = getGameplayClueChoicesForPlayer(disabled.clientState.metadata);
    const enabledChoices = getGameplayClueChoicesForPlayer(enabled.clientState.metadata);
    expect(disabledChoices.allowEmptyClues).toBe(false);
    expect(enabledChoices.allowEmptyClues).toBe(true);

    expect(isCluePreviewConfirmable(disabledPreview, disabledChoices.allowEmptyClues)).toBe(false);
    expect(isCluePreviewConfirmable(enabledPreview, enabledChoices.allowEmptyClues)).toBe(true);
  });
});
