import { GameBootstrapCoordinator } from '../../../game/bootstrap/GameBootstrapCoordinator';
import { gameActionListSchema, gameInitSchema } from '../../../protocol/gameProtocol';
import { makeInit } from '../../../protocol/gameProtocol.fixtures';
import { roomActions } from '../../../store/roomSlice';
import { sessionActions } from '../../../store/sessionSlice';
import { createAppStore } from '../../../store/store';
import { initialGameplayInteractionState } from '../gameplayInteraction';
import type { GameplayScenario } from './gameplayScenarios';

const TABLE_ID = 123;
const VIEWPORT = { width: 390, height: 844 } as const;
let cachedScenarios: readonly GameplayScenario[] | null = null;

export function getEmptyClueGalleryScenarios(): readonly GameplayScenario[] {
  cachedScenarios ??= [
    buildEmptyClueScenario(false),
    buildEmptyClueScenario(true),
  ];
  return cachedScenarios;
}

function buildEmptyClueScenario(emptyClues: boolean): GameplayScenario {
  const store = createAppStore();
  const connectionEpoch = 1;
  const playerNames = ['Alice', 'Bob'] as const;

  store.dispatch(sessionActions.connectionStarted({ epoch: connectionEpoch }));
  store.dispatch(sessionActions.welcomeReceived({
    epoch: connectionEpoch,
    welcome: { userID: 1, username: playerNames[0], totalGames: 0, playingAtTables: [] },
  }));
  store.dispatch(roomActions.joinRequested({ epoch: connectionEpoch, tableID: TABLE_ID }));
  store.dispatch(roomActions.tableStartReceived({
    epoch: connectionEpoch,
    tableStart: { tableID: TABLE_ID, replay: false },
  }));

  const coordinator = new GameBootstrapCoordinator(store, () => true);
  const gameLoadEpoch = coordinator.startFromAuthoritativeRoom(connectionEpoch);
  if (gameLoadEpoch === null) throw new Error('Failed to start Empty Clues scenario.');

  const base = makeInit();
  const init = gameInitSchema.parse(makeInit({
    tableID: TABLE_ID,
    playerNames,
    ourPlayerIndex: 0,
    seed: `scenario-empty-clues-${emptyClues ? 'on' : 'off'}`,
    options: {
      ...base.options,
      numPlayers: 2,
      emptyClues,
    },
  }));
  if (!coordinator.receiveInit(connectionEpoch, gameLoadEpoch, init)) {
    throw new Error('Empty Clues scenario init was rejected.');
  }

  const history = gameActionListSchema.parse({
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
      { type: 'turn' as const, num: 0, currentPlayerIndex: 0 },
    ],
  });
  if (!coordinator.receiveHistory(connectionEpoch, gameLoadEpoch, history)) {
    throw new Error('Empty Clues scenario history was rejected.');
  }

  const id = emptyClues ? 'empty-clue-on' : 'empty-clue-off';
  return {
    id,
    title: emptyClues ? 'Empty clue · ON' : 'Empty clue · OFF',
    description: emptyClues
      ? 'Bob has no red cards and Empty Clues is enabled. Select Bob then Red: zero cards should highlight and Give clue should remain available.'
      : 'Bob has no red cards and Empty Clues is disabled. Select Bob then Red: zero cards should highlight and Give clue must stay disabled.',
    viewport: VIEWPORT,
    store,
    expectedInteraction: {
      ...initialGameplayInteractionState,
      clueTarget: 1,
      cluePreview: { type: 'color', value: 0 },
    },
    expectedCurrentPlayerIndex: 0,
    family: 'clue-flow',
  };
}
