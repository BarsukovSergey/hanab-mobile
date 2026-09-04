import { GameBootstrapCoordinator } from '../../../game/bootstrap/GameBootstrapCoordinator';
import { gameActionListSchema, gameInitSchema } from '../../../protocol/gameProtocol';
import { makeInit } from '../../../protocol/gameProtocol.fixtures';
import { roomActions } from '../../../store/roomSlice';
import { sessionActions } from '../../../store/sessionSlice';
import { createAppStore, type AppStore } from '../../../store/store';
import {
  initialGameplayInteractionState,
  type GameplayInteractionState,
} from '../gameplayInteraction';

export type GameplayScenarioViewport = {
  readonly width: number;
  readonly height: number;
};

export type GameplayScenario = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly viewport: GameplayScenarioViewport;
  readonly store: AppStore;
  readonly expectedInteraction: GameplayInteractionState;
};

type ScenarioSpec = {
  id: string;
  title: string;
  description: string;
  numPlayers: 2 | 3 | 4 | 5 | 6;
  viewport: GameplayScenarioViewport;
  expectedInteraction?: GameplayInteractionState;
};

const PLAYER_NAMES = ['Alice', 'Bob', 'Cathy', 'Donald', 'Emily', 'Frank'] as const;

export const gameplayScenarios: readonly GameplayScenario[] = [
  buildScenario({
    id: 'three-player-base',
    title: '3P base · portrait',
    description: 'Ordinary three-player live turn with five-card hands and no transient interaction.',
    numPlayers: 3,
    viewport: { width: 390, height: 844 },
  }),
  buildScenario({
    id: 'clue-preview-source',
    title: '3P clue source · portrait',
    description: 'Deterministic three-player deal containing a known one-card red clue target for interaction checks.',
    numPlayers: 3,
    viewport: { width: 390, height: 844 },
    expectedInteraction: {
      ...initialGameplayInteractionState,
      clueTarget: 1,
      cluePreview: { type: 'color', value: 0 },
    },
  }),
  buildScenario({
    id: 'six-player-landscape',
    title: '6P dense · landscape',
    description: 'Six-player narrow Android-like landscape geometry with four-card hands.',
    numPlayers: 6,
    viewport: { width: 720, height: 360 },
  }),
];

function buildScenario(spec: ScenarioSpec): GameplayScenario {
  const store = createAppStore();
  const connectionEpoch = 1;
  const tableID = 123;
  const playerNames = PLAYER_NAMES.slice(0, spec.numPlayers);
  const baseInit = makeInit();
  const baseOptions = baseInit.options as Record<string, unknown>;

  store.dispatch(sessionActions.connectionStarted({ epoch: connectionEpoch }));
  store.dispatch(sessionActions.welcomeReceived({
    epoch: connectionEpoch,
    welcome: { userID: 1, username: playerNames[0] ?? 'Alice', totalGames: 0, playingAtTables: [] },
  }));
  store.dispatch(roomActions.joinRequested({ epoch: connectionEpoch, tableID }));
  store.dispatch(roomActions.tableStartReceived({
    epoch: connectionEpoch,
    tableStart: { tableID, replay: false },
  }));

  const coordinator = new GameBootstrapCoordinator(store, () => true);
  const gameLoadEpoch = coordinator.startFromAuthoritativeRoom(connectionEpoch);
  if (gameLoadEpoch === null) throw new Error(`Failed to start scenario ${spec.id}.`);

  const initAccepted = coordinator.receiveInit(connectionEpoch, gameLoadEpoch, gameInitSchema.parse(makeInit({
    tableID,
    playerNames,
    ourPlayerIndex: 0,
    seed: `scenario-${spec.id}`,
    options: {
      ...baseOptions,
      numPlayers: spec.numPlayers,
    },
    characterAssignments: [],
    characterMetadata: [],
  })));
  if (!initAccepted) throw new Error(`Scenario ${spec.id} init was rejected.`);

  const handSize = spec.numPlayers <= 3 ? 5 : 4;
  const historyAccepted = coordinator.receiveHistory(connectionEpoch, gameLoadEpoch, gameActionListSchema.parse({
    tableID,
    list: [
      ...makeDeal(spec.numPlayers, handSize),
      { type: 'turn', num: 0, currentPlayerIndex: 0 },
    ],
  }));
  if (!historyAccepted) throw new Error(`Scenario ${spec.id} history was rejected.`);

  const room = store.getState().room.room;
  if (room.kind !== 'live_game') throw new Error(`Scenario ${spec.id} did not reach live_game.`);

  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    viewport: spec.viewport,
    store,
    expectedInteraction: spec.expectedInteraction ?? initialGameplayInteractionState,
  };
}

function makeDeal(numPlayers: number, handSize: number) {
  let order = 0;
  return Array.from({ length: numPlayers }).flatMap((_, playerIndex) => (
    Array.from({ length: handSize }, (_, position) => {
      const cardOrder = order;
      order += 1;
      if (playerIndex === 0) {
        return {
          type: 'draw' as const,
          playerIndex,
          order: cardOrder,
          suitIndex: -1,
          rank: -1,
        };
      }
      return {
        type: 'draw' as const,
        playerIndex,
        order: cardOrder,
        suitIndex: (position + playerIndex - 1) % 5,
        rank: (position % 5) + 1,
      };
    })
  ));
}
