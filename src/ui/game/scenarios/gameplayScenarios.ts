import { GameBootstrapCoordinator } from '../../../game/bootstrap/GameBootstrapCoordinator';
import {
  gameActionListSchema,
  gameInitSchema,
  incrementalGameActionSchema,
  noteCommandSchema,
} from '../../../protocol/gameProtocol';
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
  readonly expectedCurrentPlayerIndex: number;
  readonly family: 'base' | 'clue-flow' | 'note-flow' | 'responsive';
};

type ScenarioSpec = {
  id: string;
  title: string;
  description: string;
  numPlayers: 2 | 3 | 4 | 5 | 6;
  viewport: GameplayScenarioViewport;
  family: GameplayScenario['family'];
  expectedCurrentPlayerIndex?: number;
  expectedInteraction?: GameplayInteractionState;
  history?: readonly unknown[];
  characterAssignments?: readonly number[];
  acceptedNote?: { order: number; text: string };
  incrementalActions?: readonly unknown[];
};

const PLAYER_NAMES = ['Alice', 'Bob', 'Cathy', 'Donald', 'Emily', 'Frank'] as const;
const PORTRAIT_PHONE = { width: 390, height: 844 } as const;
const LANDSCAPE_PHONE = { width: 720, height: 360 } as const;
const BOB_RED_ORDER = 5;
const NOTE_TEXT = 'Finesse | r1';
let cachedScenarios: readonly GameplayScenario[] | null = null;

export function getGameplayScenarios(): readonly GameplayScenario[] {
  cachedScenarios ??= [
    buildScenario({
      id: 'three-player-base',
      title: '3P base · portrait',
      description: 'Ordinary three-player live turn with five-card hands and no transient interaction.',
      numPlayers: 3,
      viewport: PORTRAIT_PHONE,
      family: 'base',
    }),
    buildScenario({
      id: 'clue-preview-source',
      title: 'Clue · preview source',
      description: 'Deterministic deal with a one-card red clue target. Tap Bob then Red to inspect the production local preview flow.',
      numPlayers: 3,
      viewport: PORTRAIT_PHONE,
      family: 'clue-flow',
      expectedInteraction: {
        ...initialGameplayInteractionState,
        clueTarget: 1,
        cluePreview: { type: 'color', value: 0 },
      },
    }),
    buildScenario({
      id: 'clue-committed',
      title: 'Clue · committed',
      description: 'Authoritative red clue from Alice to Bob after the server has advanced the turn. The compact last-clue marker and orange semantic border must both remain visible.',
      numPlayers: 3,
      viewport: PORTRAIT_PHONE,
      family: 'clue-flow',
      expectedCurrentPlayerIndex: 1,
      history: makeCommittedClueHistory(),
    }),
    buildScenario({
      id: 'clue-retouched-quacker',
      title: 'Clue · retouched Quacker',
      description: 'Bob’s red card is positively clued a second time by Cathy as Quacker. The committed marker must use the actual giver semantics and render as a retouch.',
      numPlayers: 3,
      viewport: PORTRAIT_PHONE,
      family: 'clue-flow',
      characterAssignments: [-1, -1, 34],
      history: makeRetouchedQuackerHistory(),
    }),
    buildScenario({
      id: 'clue-cleanup-after-discard',
      title: 'Clue · post-discard cleanup',
      description: 'The next authoritative discard clears the transient last-clue marker, while Bob’s upstream positive-clue knowledge and orange semantic border remain.',
      numPlayers: 3,
      viewport: LANDSCAPE_PHONE,
      family: 'clue-flow',
      expectedCurrentPlayerIndex: 1,
      characterAssignments: [-1, -1, 34],
      history: makeClueCleanupHistory(),
    }),
    buildScenario({
      id: 'note-edit-source',
      title: 'Note · opponent edit',
      description: 'Bob’s first card is a live editable opponent card. Tap it to open the production note editor.',
      numPlayers: 3,
      viewport: PORTRAIT_PHONE,
      family: 'note-flow',
      expectedInteraction: {
        ...initialGameplayInteractionState,
        noteCard: BOB_RED_ORDER,
      },
    }),
    buildScenario({
      id: 'note-saved',
      title: 'Note · saved',
      description: 'The local accepted note action is stored outside replay history and is visible on Bob’s live card.',
      numPlayers: 3,
      viewport: PORTRAIT_PHONE,
      family: 'note-flow',
      acceptedNote: { order: BOB_RED_ORDER, text: NOTE_TEXT },
    }),
    buildScenario({
      id: 'note-survives-turn',
      title: 'Note · next turn',
      description: 'The saved opponent note survives a real authoritative clue that advances Alice’s turn to Bob while the noted card remains in Bob’s hand.',
      numPlayers: 3,
      viewport: PORTRAIT_PHONE,
      family: 'note-flow',
      expectedCurrentPlayerIndex: 1,
      acceptedNote: { order: BOB_RED_ORDER, text: NOTE_TEXT },
      incrementalActions: [
        colorClueToCathy(0),
      ],
    }),
    buildScenario({
      id: 'note-card-left-hand',
      title: 'Note · card left hand',
      description: 'Alice clues Cathy to advance to Bob; Bob discards the noted card and draws a replacement. Saved note knowledge may remain by card order, but live editing must no longer target that card.',
      numPlayers: 3,
      viewport: LANDSCAPE_PHONE,
      family: 'note-flow',
      expectedCurrentPlayerIndex: 2,
      acceptedNote: { order: BOB_RED_ORDER, text: NOTE_TEXT },
      incrementalActions: [
        colorClueToCathy(0),
        {
          type: 'discard',
          playerIndex: 1,
          order: BOB_RED_ORDER,
          suitIndex: 0,
          rank: 1,
          failed: false,
        },
        {
          type: 'draw',
          playerIndex: 1,
          order: 15,
          suitIndex: 0,
          rank: 2,
        },
      ],
    }),
    buildScenario({
      id: 'six-player-landscape',
      title: '6P dense · landscape',
      description: 'Six-player narrow Android-like landscape geometry with four-card hands.',
      numPlayers: 6,
      viewport: LANDSCAPE_PHONE,
      family: 'responsive',
    }),
  ];
  return cachedScenarios;
}

export function getClueFlowScenarios(): readonly GameplayScenario[] {
  return getGameplayScenarios().filter((scenario) => scenario.family === 'clue-flow');
}

export function getNoteFlowScenarios(): readonly GameplayScenario[] {
  return getGameplayScenarios().filter((scenario) => scenario.family === 'note-flow');
}

export const clueFlowFixtureOrders = {
  bobRed: BOB_RED_ORDER,
} as const;

export const noteFlowFixture = {
  opponentOrder: BOB_RED_ORDER,
  text: NOTE_TEXT,
} as const;

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
    characterAssignments: spec.characterAssignments ?? [],
    characterMetadata: [],
  })));
  if (!initAccepted) throw new Error(`Scenario ${spec.id} init was rejected.`);

  const handSize = spec.numPlayers <= 3 ? 5 : 4;
  const history = spec.history ?? [
    ...makeDeal(spec.numPlayers, handSize),
    { type: 'turn', num: 0, currentPlayerIndex: 0 },
  ];
  const historyAccepted = coordinator.receiveHistory(connectionEpoch, gameLoadEpoch, gameActionListSchema.parse({
    tableID,
    list: history,
  }));
  if (!historyAccepted) throw new Error(`Scenario ${spec.id} history was rejected.`);

  if (spec.acceptedNote !== undefined) {
    const parsed = noteCommandSchema.parse({
      tableID,
      order: spec.acceptedNote.order,
      note: spec.acceptedNote.text,
    });
    store.dispatch(roomActions.noteActionAccepted({
      connectionEpoch,
      tableID,
      gameLoadEpoch,
      noteAction: { type: 'editNote', order: parsed.order, text: parsed.note },
    }));
  }

  for (const action of spec.incrementalActions ?? []) {
    const event = incrementalGameActionSchema.parse({ tableID, action });
    const accepted = coordinator.receiveIncrementalDetailed(connectionEpoch, event);
    if (!accepted.accepted) {
      throw new Error(`Scenario ${spec.id} incremental action was rejected: ${accepted.rejectionReason}.`);
    }
  }

  const room = store.getState().room.room;
  if (room.kind !== 'live_game') throw new Error(`Scenario ${spec.id} did not reach live_game.`);

  return {
    id: spec.id,
    title: spec.title,
    description: spec.description,
    viewport: spec.viewport,
    store,
    expectedInteraction: spec.expectedInteraction ?? initialGameplayInteractionState,
    expectedCurrentPlayerIndex: spec.expectedCurrentPlayerIndex ?? 0,
    family: spec.family,
  };
}

function makeCommittedClueHistory(): readonly unknown[] {
  return [
    ...makeDeal(3, 5),
    { type: 'turn', num: 0, currentPlayerIndex: 0 },
    redClueToBob(0, 0),
    { type: 'turn', num: 1, currentPlayerIndex: 1 },
  ];
}

function makeRetouchedQuackerHistory(): readonly unknown[] {
  return [
    ...makeCommittedClueHistory(),
    {
      type: 'clue',
      clue: { type: 1, value: 1 },
      giver: 1,
      list: [10],
      target: 2,
      turn: 1,
    },
    { type: 'turn', num: 2, currentPlayerIndex: 2 },
    redClueToBob(2, 2),
    { type: 'turn', num: 3, currentPlayerIndex: 0 },
  ];
}

function makeClueCleanupHistory(): readonly unknown[] {
  return [
    ...makeRetouchedQuackerHistory(),
    {
      type: 'discard',
      playerIndex: 0,
      order: 0,
      suitIndex: 0,
      rank: 1,
      failed: false,
    },
    {
      type: 'draw',
      playerIndex: 0,
      order: 15,
      suitIndex: -1,
      rank: -1,
    },
    { type: 'turn', num: 4, currentPlayerIndex: 1 },
  ];
}

function redClueToBob(giver: number, turn: number) {
  return {
    type: 'clue' as const,
    clue: { type: 0 as const, value: 0 },
    giver,
    list: [BOB_RED_ORDER],
    target: 1,
    turn,
  };
}

function colorClueToCathy(turn: number) {
  return {
    type: 'clue' as const,
    clue: { type: 0 as const, value: 1 },
    giver: 0,
    list: [10],
    target: 2,
    turn,
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
