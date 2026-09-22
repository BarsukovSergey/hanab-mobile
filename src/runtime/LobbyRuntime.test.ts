import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type {
  NetworkSession,
  NetworkSocket,
  SessionCheckResult,
} from '../network/types';
import type { LobbyTable } from '../protocol/lobbyProtocol';
import { makeInit } from '../protocol/gameProtocol.fixtures';
import { noteCommandSchema } from '../protocol/gameProtocol';
import { getCardKnowledgeViewModel } from '../game/selectors/cardKnowledge';
import type { ActionIncludingHypothetical } from '../game/client/types/actions';
import { lobbyActions } from '../store/lobbySlice';
import { roomActions } from '../store/roomSlice';
import { sessionActions } from '../store/sessionSlice';
import { createAppStore, userSelectors } from '../store/store';
import { ChatRuntime, getVariantFromArgs } from './ChatRuntime';
import {
  isJoinEligible,
  isPregameSpectateEligible,
  isQuickRematchEligible,
  isRestartToPregameEligible,
  isReattendEligible,
  isSpectateEligible,
  LobbyRuntime,
} from './LobbyRuntime';
import { TerminationRuntime } from './terminationRuntime';

type ListenerMap = {
  open: Set<() => void>;
  message: Set<(event: WebSocketMessageEvent) => void>;
  error: Set<() => void>;
  close: Set<(event: WebSocketCloseEvent) => void>;
};

class FakeSocket implements NetworkSocket {
  readyState = 0;
  failSend = false;
  failOnSendNumber: number | null = null;
  readonly sent: string[] = [];
  readonly closeCalls: Array<{ code?: number; reason?: string }> = [];
  private readonly listeners: ListenerMap = {
    open: new Set(), message: new Set(), error: new Set(), close: new Set(),
  };

  addEventListener(type: 'open', listener: () => void): void;
  addEventListener(type: 'message', listener: (event: WebSocketMessageEvent) => void): void;
  addEventListener(type: 'error', listener: () => void): void;
  addEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  addEventListener(type: keyof ListenerMap, listener: never): void {
    (this.listeners[type] as Set<never>).add(listener);
  }

  removeEventListener(type: 'open', listener: () => void): void;
  removeEventListener(type: 'message', listener: (event: WebSocketMessageEvent) => void): void;
  removeEventListener(type: 'error', listener: () => void): void;
  removeEventListener(type: 'close', listener: (event: WebSocketCloseEvent) => void): void;
  removeEventListener(type: keyof ListenerMap, listener: never): void {
    (this.listeners[type] as Set<never>).delete(listener);
  }

  send(data: string): void {
    if (this.failSend || this.failOnSendNumber === this.sent.length + 1) throw new Error('send failed');
    this.sent.push(data);
  }
  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.readyState = 3;
  }
  emitOpen(): void {
    this.readyState = 1;
    for (const listener of [...this.listeners.open]) listener();
  }
  emitMessage(data: string): void {
    for (const listener of [...this.listeners.message]) {
      listener({ data } as WebSocketMessageEvent);
    }
  }
  emitClose(code = 1006): void {
    this.readyState = 3;
    for (const listener of [...this.listeners.close]) {
      listener({ code } as WebSocketCloseEvent);
    }
  }
  snapshotCloseListeners(): Array<(event: WebSocketCloseEvent) => void> {
    return [...this.listeners.close];
  }
  snapshotMessageListeners(): Array<(event: WebSocketMessageEvent) => void> {
    return [...this.listeners.message];
  }
}

class FakeSession implements NetworkSession {
  readonly sockets: Array<Promise<NetworkSocket>> = [];
  openCalls = 0;
  logoutCalls = 0;
  checkCalls = 0;
  sessionCheckResult: SessionCheckResult = { kind: 'valid' };
  checkSession(): Promise<SessionCheckResult> {
    this.checkCalls += 1;
    return Promise.resolve(this.sessionCheckResult);
  }
  submitLogin(): Promise<void> { return Promise.resolve(); }
  logout(): Promise<void> { this.logoutCalls += 1; return Promise.resolve(); }
  openSocket(): Promise<NetworkSocket> {
    const socket = this.sockets[this.openCalls++];
    if (socket === undefined) throw new Error('No fake socket configured');
    return socket;
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

const welcomeFrame = 'welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[]}';
const userFrame = 'user {"userID":1,"name":"Ada","status":0,"hyphenated":false,"inactive":false}';
const bobUserFrame = 'user {"userID":2,"name":"Bob","status":0,"hyphenated":false,"inactive":false}';
const tableOptions = {
  variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
  speedrun: false, cardCycle: false, deckPlays: false, emptyClues: false,
  oneExtraCard: false, oneLessCard: false, allOrNothing: false,
  detrimentalCharacters: false,
};
const runningTable: LobbyTable = {
  id: 123,
  name: 'Running table',
  numPlayers: 3,
  maxPlayers: 5,
  running: true,
  variant: 'No Variant',
  options: tableOptions,
  passwordProtected: false,
  joined: false,
  progress: 7,
  players: ['Ada', 'Bob', 'Cy'],
  sharedReplay: false,
};

const joinableTable: LobbyTable = {
  ...runningTable,
  name: 'Pregame table',
  numPlayers: 1,
  running: false,
  progress: 0,
  players: ['Bob'],
};

const pregameFrame = (tableID = 123, name = 'Pregame table') => (
  `game {"tableID":${tableID},"name":"${name}","owner":2,`
  + '"players":[{"index":0,"name":"Bob","you":false,"present":true,"stats":{}},'
  + '{"index":1,"name":"Ada","you":true,"present":true,"stats":{}}],'
  + `"options":${JSON.stringify(tableOptions)},"passwordProtected":false,"maxPlayers":5}`
);

function createdPregameFrame(
  players: readonly string[] = ['Ada'],
  tableID = 321,
  name = 'Mobile table',
  options: Record<string, unknown> = tableOptions,
  maxPlayers = 5,
): string {
  return `game ${JSON.stringify({
    tableID,
    name,
    owner: 1,
    players: players.map((playerName, index) => ({
      index,
      name: playerName,
      you: index === 0,
      present: true,
    })),
    options,
    passwordProtected: false,
    maxPlayers,
  })}`;
}

function historicalGame(id: number, optionChanges: Record<string, unknown> = {}) {
  return {
    id,
    options: {
      numPlayers: 2, startingPlayer: 0, variantID: 0, ...tableOptions, ...optionChanges,
    },
    seed: `seed-${id}`, score: 20, numTurns: 30, endCondition: 1,
    datetimeStarted: '2026-09-01T00:00:00Z',
    datetimeFinished: '2026-09-01T00:10:00Z', numGamesOnThisSeed: 1,
    playerNames: ['Ada', 'Bob'], incrementNumGames: true, tags: '',
  };
}

async function makeReadyRuntime() {
  const session = new FakeSession();
  const socket = new FakeSocket();
  session.sockets.push(Promise.resolve(socket));
  const store = createAppStore();
  const runtime = new LobbyRuntime(session, store);
  await runtime.connect();
  socket.emitOpen();
  socket.emitMessage(welcomeFrame);
  return { session, socket, store, runtime };
}

function addRunningTable(store: ReturnType<typeof createAppStore>, epoch = 1): void {
  store.dispatch(lobbyActions.tableReceived({ epoch, table: runningTable }));
}

function addJoinableTable(store: ReturnType<typeof createAppStore>, epoch = 1): void {
  store.dispatch(lobbyActions.tableReceived({ epoch, table: joinableTable }));
}

async function makeLiveRuntime(role: 'player' | 'spectator') {
  const ready = await makeReadyRuntime();
  if (role === 'player') {
    addJoinableTable(ready.store);
    ready.runtime.join(123);
    ready.socket.emitMessage(pregameFrame());
    ready.socket.emitMessage('joined {"tableID":123}');
  } else {
    addRunningTable(ready.store);
    ready.runtime.spectate(123);
  }
  ready.socket.emitMessage('tableStart {"tableID":123,"replay":false}');
  ready.socket.emitMessage(`init ${JSON.stringify(makeInit({
    spectating: role === 'spectator',
  }))}`);
  ready.socket.emitMessage(`gameActionList ${JSON.stringify({
    tableID: 123,
    list: [
      ...Array.from({ length: 5 }, (_, order) => ({
        type: 'draw', playerIndex: 0, order, suitIndex: -1, rank: -1,
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        type: 'draw', playerIndex: 1, order: index + 5, suitIndex: index, rank: index + 1,
      })),
      { type: 'status', clues: 8, score: 0, maxScore: 25 },
      { type: 'turn', num: 0, currentPlayerIndex: 0 },
    ],
  })}`);
  expect(ready.store.getState().room.room).toMatchObject({ kind: 'live_game', role });
  return ready;
}

async function makeSharedReplayRuntime(
  leader = 'Ada',
  playerNames: readonly string[] = ['Ada', 'Bob'],
  sharedReplay = true,
) {
  const ready = await makeReadyRuntime();
  ready.store.dispatch(lobbyActions.tableReceived({
    epoch: 1,
    table: { ...runningTable, sharedReplay, joined: sharedReplay },
  }));
  expect(ready.runtime.spectate(123)).toBe(true);
  ready.socket.emitMessage('tableStart {"tableID":123,"replay":true}');
  ready.socket.emitMessage(`init ${JSON.stringify(makeInit({
    replay: true,
    sharedReplay,
    databaseID: 77,
    datetimeFinished: '2026-08-31T00:10:00Z',
    sharedReplayLeader: leader,
    sharedReplaySegment: 1,
    playerNames,
    ourPlayerIndex: Math.max(0, playerNames.indexOf('Ada')),
    spectating: !playerNames.includes('Ada'),
    options: { ...makeInit().options, numPlayers: playerNames.length },
  }))}`);
  ready.socket.emitMessage(`gameActionList ${JSON.stringify({
    tableID: 123,
    list: [
      ...Array.from({ length: 5 }, (_, order) => ({
        type: 'draw', playerIndex: 0, order, suitIndex: 0, rank: 1,
      })),
      ...Array.from({ length: 5 }, (_, index) => ({
        type: 'draw', playerIndex: 1, order: index + 5, suitIndex: index, rank: index + 1,
      })),
      { type: 'turn', num: 0, currentPlayerIndex: 0 },
      {
        type: 'clue', clue: { type: 1, value: 1 }, giver: 0,
        list: [5], target: 1, turn: 0,
      },
      { type: 'turn', num: 1, currentPlayerIndex: 1 },
    ],
  })}`);
  ready.socket.emitMessage(
    'spectators {"tableID":123,"spectators":['
    + '{"name":"Ada","shadowingPlayerIndex":-1,"shadowingPlayerUsername":""},'
    + '{"name":"Bob","shadowingPlayerIndex":-1,"shadowingPlayerUsername":""}]}',
  );
  expect(ready.store.getState().room.room).toMatchObject({
    kind: 'live_game', sharedReplay,
  });
  return ready;
}

function getSentHypotheticalActions(
  frames: readonly string[],
): ActionIncludingHypothetical[] {
  return frames.map((frame) => {
    const payload = JSON.parse(frame.slice(frame.indexOf(' ') + 1)) as { actionJSON: string };
    return JSON.parse(payload.actionJSON) as ActionIncludingHypothetical;
  });
}

function emitHypotheticalAction(socket: FakeSocket, action: ActionIncludingHypothetical): void {
  socket.emitMessage(`hypoAction ${JSON.stringify(JSON.stringify(action))}`);
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('deterministic lobby runtime', () => {
  test.each(['player', 'spectator'] as const)(
    '%s live game sends one exact unattend without optimistic exit',
    async (role) => {
      const { runtime, socket, store } = await makeLiveRuntime(role);
      const sentBefore = socket.sent.length;

      expect(runtime.unattendLiveGame(123)).toBe(true);
      expect(runtime.unattendLiveGame(123)).toBe(false);

      expect(socket.sent.slice(sentBefore)).toEqual(['tableUnattend {"tableID":123}']);
      expect(store.getState().room.pendingUnattendTableID).toBe(123);
      expect(store.getState().room.room).toMatchObject({ kind: 'live_game', tableID: 123, role });
    },
  );

  test.each(['player', 'spectator'] as const)(
    '%s sends notes once, then applies the local edit outside replay actions',
    async (role) => {
      const { runtime, socket, store } = await makeLiveRuntime(role);
      const roomBefore = store.getState().room.room;
      if (roomBefore.kind !== 'live_game') throw new Error('Expected live game');
      const order = role === 'player' ? 0 : 5;
      const replayCount = roomBefore.clientState.replay.actions.length;

      expect(runtime.editNote(order, 'r1')).toBe(true);
      expect(socket.sent.at(-1)).toBe(`note {"tableID":123,"order":${order},"note":"r1"}`);
      const roomAfter = store.getState().room.room;
      if (roomAfter.kind !== 'live_game') throw new Error('Expected live game');
      expect(roomAfter.clientState.notes.ourNotes[order]).toMatchObject({
        text: 'r1', knownTrash: false,
      });
      expect(roomAfter.clientState.notes.ourNotes[order]?.possibilities).toEqual([[0, 1]]);
      expect(roomAfter.clientState.replay.actions).toHaveLength(replayCount);
      expect(runtime.editNote(order, 'x'.repeat(301))).toBe(false);
    },
  );

  test('edits a historical card while locally rewinding after it has left the live hand', async () => {
    const { runtime, socket, store } = await makeLiveRuntime('player');
    let room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live game');

    store.dispatch(roomActions.reviewSegmentSelected({
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      segment: 0,
    }));
    socket.emitMessage(
      'gameAction {"tableID":123,"action":{"type":"discard","playerIndex":1,"order":5,"suitIndex":0,"rank":1,"failed":false}}',
    );

    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live game');
    expect(room.clientState.replay.active).toBe(true);
    expect(room.clientState.visibleState?.hands[1]).toContain(5);
    expect(room.clientState.ongoingGame.hands[1]).not.toContain(5);

    expect(runtime.editNote(5, 'rewind note')).toBe(true);
    expect(socket.sent.at(-1)).toBe('note {"tableID":123,"order":5,"note":"rewind note"}');
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live game');
    expect(room.clientState.notes.ourNotes[5]?.text).toBe('rewind note');
  });

  test('accepts current note/presence events and ignores wrong table or cardinality', async () => {
    const { socket, store } = await makeLiveRuntime('spectator');
    socket.emitMessage('noteListPlayer {"tableID":999,"notes":["wrong"]}');
    socket.emitMessage('noteListPlayer {"tableID":123,"notes":["r1"]}');
    socket.emitMessage(
      'note {"tableID":123,"order":0,"notes":[{"name":"Ada","text":"kt","isSpectator":true}]}',
    );
    socket.emitMessage('connected {"tableID":123,"list":[false]}');
    socket.emitMessage('connected {"tableID":123,"list":[true,false]}');
    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live game');
    expect(room.clientState.notes.ourNotes[0]).toMatchObject({ text: 'r1', knownTrash: false });
    expect(room.clientState.notes.allNotes[0]).toEqual([
      { name: 'Ada', text: 'kt', isSpectator: true },
    ]);
    expect(room.connected).toEqual([true, false]);

    store.dispatch(roomActions.noteActionAccepted({
      connectionEpoch: 1,
      tableID: 123,
      gameLoadEpoch: room.gameLoadEpoch + 1,
      noteAction: {
        type: 'editNote',
        order: noteCommandSchema.parse({ tableID: 123, order: 0, note: 'stale' }).order,
        text: 'stale',
      },
    }));
    store.dispatch(roomActions.connectedReceived({
      connectionEpoch: 1,
      tableID: 123,
      gameLoadEpoch: room.gameLoadEpoch + 1,
      list: [false, false],
    }));
    const afterStale = store.getState().room.room;
    if (afterStale.kind !== 'live_game') throw new Error('Expected live game');
    expect(afterStale.clientState.notes.ourNotes[0]?.text).toBe('r1');
    expect(afterStale.connected).toEqual([true, false]);
  });

  test('patches inactivity only for known users and sends lifecycle presence once', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    socket.emitMessage(userFrame);
    socket.emitMessage('userInactive {"userID":1,"inactive":true}');
    socket.emitMessage('userInactive {"userID":99,"inactive":true}');
    expect(userSelectors.selectById(store.getState(), 1)?.inactive).toBe(true);
    expect(userSelectors.selectById(store.getState(), 99)).toBeUndefined();

    runtime.setAppActive(false);
    runtime.setAppActive(true);
    expect(socket.sent.slice(-2)).toEqual([
      'inactive {"inactive":true}',
      'inactive {"inactive":false}',
    ]);
  });

  test('unattend rejects a wrong table and a non-READY live game', async () => {
    const { runtime, socket, store } = await makeLiveRuntime('player');
    const sentBefore = [...socket.sent];
    expect(runtime.unattendLiveGame(999)).toBe(false);
    expect(socket.sent).toEqual(sentBefore);

    runtime.disconnect();
    expect(store.getState().room.room.kind).toBe('live_game');
    expect(runtime.unattendLiveGame(123)).toBe(false);
    expect(socket.sent).toEqual(sentBefore);
  });

  test('only authoritative own-user Lobby status completes unattend', async () => {
    const { runtime, socket, store } = await makeLiveRuntime('spectator');
    expect(runtime.unattendLiveGame(123)).toBe(true);

    socket.emitMessage(
      'user {"userID":2,"name":"Bob","status":0,"hyphenated":false,"inactive":false}',
    );
    expect(store.getState().room.pendingUnattendTableID).toBe(123);
    expect(store.getState().room.room.kind).toBe('live_game');
    socket.emitMessage(
      'user {"userID":1,"name":"Ada","status":2,"tableID":123,'
      + '"hyphenated":false,"inactive":false}',
    );
    expect(store.getState().room.room.kind).toBe('live_game');

    socket.emitMessage(userFrame);
    expect(store.getState().room.pendingUnattendTableID).toBeNull();
    expect(store.getState().room.room).toEqual({ kind: 'none' });
  });

  test('connection replacement clears unattend and never replays it', async () => {
    const { session, runtime, socket: first, store } = await makeLiveRuntime('player');
    expect(runtime.unattendLiveGame(123)).toBe(true);
    const second = new FakeSocket();
    session.sockets.push(Promise.resolve(second));

    first.emitClose();
    expect(store.getState().room.pendingUnattendTableID).toBeNull();
    jest.advanceTimersByTime(1_000);
    await Promise.resolve();
    second.emitOpen();
    second.emitMessage(welcomeFrame);

    expect(store.getState().room.pendingUnattendTableID).toBeNull();
    expect(second.sent).toEqual([]);
  });

  test('chat is READY-only, trimmed, bounded, and routed to the current room', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    expect(runtime.sendChat('too early')).toBe(false);
    socket.emitMessage(welcomeFrame);
    expect(runtime.sendChat('  hello lobby  ')).toBe(true);
    expect(store.getState().chat.messagesByRoom).toEqual({});
    expect(runtime.sendChat('   ')).toBe(false);
    expect(runtime.sendChat('x'.repeat(301))).toBe(false);

    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage(pregameFrame());
    socket.emitMessage('joined {"tableID":123}');
    expect(runtime.sendChat('table hello')).toBe(true);
    expect(socket.sent).toEqual([
      'chat {"msg":"hello lobby","room":"lobby"}',
      'tableJoin {"tableID":123}',
      'chat {"msg":"table hello","room":"table123"}',
    ]);
  });

  test('chat submission preserves normal and server-side slash-command frames', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);

    for (const message of [
      'hello', '/help', '/random 1 5', '/replay 123', '/findvariant', '/whatever', '/copy', '/',
    ]) {
      expect(chat.submit(message)).toBe(true);
    }

    expect(socket.sent).toEqual([
      'chat {"msg":"hello","room":"lobby"}',
      'chat {"msg":"/help","room":"lobby"}',
      'chat {"msg":"/random 1 5","room":"lobby"}',
      'chat {"msg":"/replay 123","room":"lobby"}',
      'chat {"msg":"/findvariant","room":"lobby"}',
      'chat {"msg":"/whatever","room":"lobby"}',
      'chat {"msg":"/copy","room":"lobby"}',
      'chat {"msg":"/","room":"lobby"}',
    ]);
  });

  test('termination slash commands use the termination runtime without raw-chat fallback', async () => {
    const { socket, store, runtime } = await makeLiveRuntime('player');
    const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);
    const sentBefore = socket.sent.length;

    expect(chat.submit('/TeRmInAtE')).toBe(true);
    expect(chat.submit('/vote')).toBe(true);

    expect(socket.sent.slice(sentBefore)).toEqual([
      'tableTerminate {"tableID":123}',
      'tableVoteForTermination {"tableID":123}',
    ]);
  });

  test('ineligible termination slash command fails without raw-chat fallback', async () => {
    const { socket, store, runtime } = await makeLiveRuntime('spectator');
    const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);
    const sentBefore = [...socket.sent];

    expect(chat.submit('/terminate')).toBe(false);
    expect(socket.sent).toEqual(sentBefore);
  });

  test.each(['/setleader Bob', '/changelead Bob'])(
    'leadership slash command %s resolves canonical player name through setTableLeader',
    async (command) => {
      const { socket, store, runtime } = await makeReadyRuntime();
      expect(runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
      socket.emitMessage(createdPregameFrame(['Ada', 'Bob']));
      socket.emitMessage('joined {"tableID":321}');
      const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);

      const mixedCaseCommand = command === '/setleader Bob' ? '/SeTlEaDeR bOb' : command;
      expect(chat.submit(mixedCaseCommand)).toBe(true);
      expect(socket.sent.at(-1)).toBe('tableSetLeader {"tableID":321,"name":"Bob"}');
      expect(store.getState().room.pendingLeaderName).toBe('Bob');
    },
  );

  test('invalid leadership slash commands fail without raw-chat fallback', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    expect(runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
    socket.emitMessage(createdPregameFrame(['Ada', 'Bob']));
    socket.emitMessage('joined {"tableID":321}');
    const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);
    const sentBefore = [...socket.sent];

    expect(chat.submit('/setleader')).toBe(false);
    expect(chat.submit('/setowner Missing')).toBe(false);
    expect(chat.submit('/changeowner Ada')).toBe(false);
    expect(socket.sent).toEqual(sentBefore);
  });

  test('PM commands resolve online names canonically and reject invalid recipients locally', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    socket.emitMessage(bobUserFrame);
    const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);

    expect(chat.submit('/pm bob hello there')).toBe(true);
    expect(chat.submit('/w BOB alias works')).toBe(true);
    const sentBeforeFailures = [...socket.sent];
    expect(chat.submit('/pm')).toBe(false);
    expect(chat.submit('/pm Cy hello')).toBe(false);

    expect(socket.sent).toEqual([
      'chatPM {"msg":"hello there","recipient":"Bob","room":"lobby"}',
      'chatPM {"msg":"alias works","recipient":"Bob","room":"lobby"}',
    ]);
    expect(socket.sent).toEqual(sentBeforeFailures);
    expect(store.getState().chat.messagesByRoom.lobby?.map((message) => message.msg)).toEqual([
      'The format of a private message is: /w Alice hello',
      'User "Cy" is not currently online.',
    ]);
  });

  test('sender sees one authoritative blank-room PM echo without an optimistic copy', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    socket.emitMessage(bobUserFrame);
    const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);

    expect(chat.submit('/pm Bob hello')).toBe(true);
    expect(store.getState().chat.messagesByRoom.lobby).toBeUndefined();
    socket.emitMessage('chat {"msg":"hello","who":"Ada","discord":false,'
      + '"server":false,"datetime":"2026-09-01T10:00:00Z","room":"",'
      + '"recipient":"Bob"}');

    expect(store.getState().chat.messagesByRoom.lobby).toEqual([
      expect.objectContaining({
        msg: 'hello', room: 'lobby', who: 'Ada', recipient: 'Bob',
      }),
    ]);
  });

  test('recipient receives a blank-room PM in the currently active lobby', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(
      'welcome {"userID":2,"username":"Bob","totalGames":0,"playingAtTables":[]}',
    );
    socket.emitMessage('chat {"msg":"hello","who":"Ada","discord":false,'
      + '"server":false,"datetime":"2026-09-01T10:00:00Z","room":"",'
      + '"recipient":"Bob"}');

    expect(store.getState().chat.messagesByRoom.lobby).toEqual([
      expect.objectContaining({
        msg: 'hello', room: 'lobby', who: 'Ada', recipient: 'Bob',
      }),
    ]);
  });

  test('blank-room PM events and history use the current table room', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage(pregameFrame());
    socket.emitMessage('joined {"tableID":123}');

    const privateMessage = {
      msg: 'live private', who: 'Ada', discord: false, server: false,
      datetime: '2026-09-01T10:00:00Z', room: '', recipient: 'Bob',
    };
    socket.emitMessage(`chat ${JSON.stringify(privateMessage)}`);
    expect(store.getState().chat.messagesByRoom.table123).toEqual([
      expect.objectContaining({ ...privateMessage, room: 'table123', rawMsg: 'live private' }),
    ]);
    expect(store.getState().chat.messagesByRoom.lobby).toBeUndefined();

    socket.emitMessage(`chatList ${JSON.stringify({
      list: [{ ...privateMessage, msg: 'history private' }], unread: 0,
    })}`);
    expect(store.getState().chat.messagesByRoom.table123).toEqual([
      expect.objectContaining({
        msg: 'history private', room: 'table123', who: 'Ada', recipient: 'Bob',
      }),
    ]);
    expect(store.getState().chat.messagesByRoom.lobby).toBeUndefined();
  });

  test('welcome and friends events retain only the latest authoritative friends list', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(
      'welcome {"userID":1,"username":"Ada","totalGames":0,'
      + '"playingAtTables":[],"friends":["Bob","Cy"]}',
    );
    expect(store.getState().session.friends).toEqual(['Bob', 'Cy']);

    socket.emitMessage('friends {"friends":["Dee"]}');
    expect(store.getState().session.friends).toEqual(['Dee']);
    store.dispatch(sessionActions.connectionStarted({ epoch: 2 }));
    expect(store.getState().session.friends).toEqual([]);
  });

  test('friend mutations use exact frames and friend-list aliases are local-only', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    store.dispatch(sessionActions.friendsReceived({ epoch: 1, friends: ['Bob', 'Cy'] }));
    const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);

    expect(chat.submit('/friend Bob')).toBe(true);
    expect(chat.submit('/addfriend Cy')).toBe(true);
    expect(chat.submit('/unfriend Bob')).toBe(true);
    const sentBeforeList = [...socket.sent];
    expect(chat.submit('/friends')).toBe(true);
    expect(chat.submit('/f')).toBe(true);

    expect(socket.sent).toEqual([
      'chatFriend {"name":"Bob"}',
      'chatFriend {"name":"Cy"}',
      'chatUnfriend {"name":"Bob"}',
    ]);
    expect(socket.sent).toEqual(sentBeforeList);
    expect(store.getState().chat.messagesByRoom.lobby?.at(-1)?.msg)
      .toBe('Current friends: Bob, Cy');
  });

  test('link commands and aliases use exact upstream frames', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);

    expect(chat.submit('/link Bob')).toBe(true);
    expect(chat.submit('/unlink Bob')).toBe(true);
    expect(chat.submit('/linked')).toBe(true);
    expect(chat.submit('/links')).toBe(true);
    expect(socket.sent).toEqual([
      'chatLink {"name":"Bob"}',
      'chatUnlink {"name":"Bob"}',
      'chatLinked {}',
      'chatLinked {}',
    ]);
  });

  test('variant normalization and aliases prefix-match only supported variants', async () => {
    expect(getVariantFromArgs(['black', '', '&', 'rainbow', '(', '6', 'suits', ')']))
      .toBe('Black & Rainbow (6 Suits)');
    const { socket, store, runtime } = await makeReadyRuntime();
    expect(runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
    socket.emitMessage(createdPregameFrame(['Ada', 'Bob']));
    socket.emitMessage('joined {"tableID":321}');
    const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);
    const sentBefore = socket.sent.length;

    expect(chat.submit('/sv no var')).toBe(true);
    expect(chat.submit('/cv no variant')).toBe(true);
    expect(chat.submit('/setvariant definitely missing')).toBe(false);
    expect(socket.sent.slice(sentBefore)).toEqual([
      'tableSetVariant {"tableID":321,"options":{"variantName":"No Variant"}}',
      'tableSetVariant {"tableID":321,"options":{"variantName":"No Variant"}}',
    ]);
    expect(store.getState().chat.messagesByRoom.table321?.at(-1)?.msg)
      .toBe('The variant of "definitely missing" is not valid.');
  });

  test('suggest validates locally and emits the exact valid frame', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    expect(runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
    socket.emitMessage(createdPregameFrame(['Ada', 'Bob']));
    socket.emitMessage('joined {"tableID":321}');
    const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);
    const sentBefore = socket.sent.length;

    expect(chat.submit('/suggest 12')).toBe(true);
    expect(chat.submit('/suggest nope')).toBe(false);
    expect(chat.submit('/suggest')).toBe(false);
    expect(socket.sent.slice(sentBefore)).toEqual(['tableSuggest {"tableID":321,"segment":12}']);
  });

  test('tag commands and alias emit exact upstream frames', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    expect(runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
    socket.emitMessage(createdPregameFrame(['Ada', 'Bob']));
    socket.emitMessage('joined {"tableID":321}');
    const chat = new ChatRuntime(runtime, new TerminationRuntime(runtime, store), store);
    const sentBefore = socket.sent.length;

    expect(chat.submit('/tag finesse')).toBe(true);
    expect(chat.submit('/tagdelete finesse')).toBe(true);
    expect(chat.submit('/untag bluff')).toBe(true);
    expect(chat.submit('/tagsearch layered finesse')).toBe(true);
    expect(chat.submit('/tagsdeleteall')).toBe(true);
    expect(socket.sent.slice(sentBefore)).toEqual([
      'tag {"tableID":321,"msg":"finesse"}',
      'tagDelete {"tableID":321,"msg":"finesse"}',
      'tagDelete {"tableID":321,"msg":"bluff"}',
      'tagSearch {"msg":"layered finesse","room":"table321"}',
      'tagsDeleteAll {"tableID":321}',
    ]);
  });

  test('player-info aliases send explicit names, self, and loaded-game players', async () => {
    const ready = await makeReadyRuntime();
    const chat = new ChatRuntime(
      ready.runtime,
      new TerminationRuntime(ready.runtime, ready.store),
      ready.store,
    );
    expect(chat.submit('/p Bob Cy')).toBe(true);
    expect(chat.submit('/stats')).toBe(true);
    expect(ready.socket.sent).toEqual([
      'chatPlayerInfo {"name":"Bob"}',
      'chatPlayerInfo {"name":"Cy"}',
      'chatPlayerInfo {"name":"Ada"}',
    ]);

    const live = await makeLiveRuntime('player');
    const liveChat = new ChatRuntime(
      live.runtime,
      new TerminationRuntime(live.runtime, live.store),
      live.store,
    );
    const sentBefore = live.socket.sent.length;
    expect(liveChat.submit('/games')).toBe(true);
    expect(live.socket.sent.slice(sentBefore)).toEqual([
      'chatPlayerInfo {"name":"Ada"}',
      'chatPlayerInfo {"name":"Bob"}',
    ]);
  });

  test('version is local-only and renders the mobile client version', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    const chat = new ChatRuntime(
      runtime,
      new TerminationRuntime(runtime, store),
      store,
      () => new Date('2026-09-22T10:00:00Z'),
    );

    expect(chat.submit('/version')).toBe(true);
    expect(socket.sent).toEqual([]);
    expect(store.getState().chat.messagesByRoom.lobby?.at(-1)).toMatchObject({
      msg: 'You are running version 1.0.0 of the client.',
      datetime: '2026-09-22T10:00:00.000Z',
      server: true,
      localType: 'info',
    });
  });

  test('chat frames and history route by room and reset on connection replacement', async () => {
    const { session, socket: first, store, runtime } = await makeReadyRuntime();
    first.emitMessage('chatList {"list":[{"msg":"old &amp; <strong>clear</strong>",'
      + '"who":"Ada","discord":false,"server":false,'
      + '"datetime":"2026-09-01T10:00:00Z","room":"lobby","recipient":""},'
      + '{"msg":"<strong>Server ready</strong>","who":"","discord":false,'
      + '"server":true,"datetime":"2026-09-01T10:00:30Z","room":"lobby",'
      + '"recipient":""}],"unread":0}');
    first.emitMessage('chat {"msg":"&lt;b&gt;safe&lt;/b&gt;",'
      + '"who":"Bob","discord":false,"server":false,'
      + '"datetime":"2026-09-01T10:01:00Z","room":"lobby","recipient":""}');
    expect(store.getState().chat.messagesByRoom.lobby?.map((message) => message.msg)).toEqual([
      'old & clear',
      'Server ready',
      '<b>safe</b>',
    ]);
    expect(store.getState().chat.messagesByRoom.lobby?.[1]).toMatchObject({
      who: '', recipient: '', server: true,
    });

    const second = new FakeSocket();
    session.sockets.push(Promise.resolve(second));
    runtime.disconnect();
    await runtime.connect();
    expect(store.getState().chat.messagesByRoom).toEqual({});
  });

  test('logout stops the socket and fully resets authenticated state', async () => {
    const { session, socket, store, runtime } = await makeReadyRuntime();
    store.dispatch(lobbyActions.userReceived({
      epoch: 1,
      user: { userID: 1, name: 'Ada', status: 0, hyphenated: false, inactive: false },
    }));
    socket.emitMessage('chat {"msg":"hello","who":"Ada","discord":false,'
      + '"server":false,"datetime":"2026-09-01T10:00:00Z","room":"lobby",'
      + '"recipient":""}');
    addJoinableTable(store);
    runtime.join(123);
    socket.emitMessage(pregameFrame());
    socket.emitMessage('joined {"tableID":123}');
    session.sessionCheckResult = { kind: 'missing' };

    await expect(runtime.signOut()).resolves.toEqual({ kind: 'signedOut' });

    expect(session.logoutCalls).toBe(1);
    expect(session.checkCalls).toBe(1);
    expect(socket.closeCalls).toEqual([{ code: 1000, reason: 'Connection disposed' }]);
    expect(store.getState().session).toMatchObject({
      connectionEpoch: 0, phase: 'idle', authenticatedUser: null, resumeHints: null,
    });
    expect(userSelectors.selectTotal(store.getState())).toBe(0);
    expect(store.getState().lobby.tables.ids).toEqual([]);
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().chat.messagesByRoom).toEqual({});
  });

  test('later confirmed missing resets stale state after indeterminate logout verification', async () => {
    const { session, socket, store, runtime } = await makeReadyRuntime();
    store.dispatch(lobbyActions.userReceived({
      epoch: 1,
      user: { userID: 1, name: 'Ada', status: 0, hyphenated: false, inactive: false },
    }));
    socket.emitMessage('chat {"msg":"hello","who":"Ada","discord":false,'
      + '"server":false,"datetime":"2026-09-01T10:00:00Z","room":"lobby",'
      + '"recipient":""}');
    addJoinableTable(store);
    runtime.join(123);
    socket.emitMessage(pregameFrame());
    socket.emitMessage('joined {"tableID":123}');
    session.sessionCheckResult = {
      kind: 'indeterminate',
      error: { kind: 'transport', message: 'offline' },
    };

    await expect(runtime.signOut()).resolves.toEqual({
      kind: 'failed', message: 'offline', sessionValid: false,
    });
    expect(store.getState().session.authenticatedUser).toEqual({ userID: 1, username: 'Ada' });
    expect(store.getState().room.room.kind).toBe('pregame');
    expect(store.getState().chat.messagesByRoom.lobby).toHaveLength(1);

    session.sessionCheckResult = { kind: 'missing' };
    await expect(runtime.checkSession()).resolves.toEqual({ kind: 'missing' });

    expect(session.openCalls).toBe(1);
    expect(store.getState().session).toMatchObject({
      connectionEpoch: 0, phase: 'idle', authenticatedUser: null, resumeHints: null,
    });
    expect(userSelectors.selectTotal(store.getState())).toBe(0);
    expect(store.getState().lobby.tables.ids).toEqual([]);
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().chat.messagesByRoom).toEqual({});
  });

  test('running shared replays remain spectate eligible even when joined', () => {
    expect(isSpectateEligible(runningTable)).toBe(true);
    expect(isSpectateEligible({ ...runningTable, running: false })).toBe(false);
    expect(isSpectateEligible({ ...runningTable, sharedReplay: true })).toBe(true);
    expect(isSpectateEligible({
      ...runningTable, sharedReplay: true, joined: true,
    })).toBe(true);
    expect(isSpectateEligible({ ...runningTable, joined: true })).toBe(false);
  });

  test('only supported open non-replay non-joined tables with a seat are join eligible', () => {
    expect(isJoinEligible(joinableTable)).toBe(true);
    expect(isJoinEligible({ ...joinableTable, running: true })).toBe(false);
    expect(isJoinEligible({ ...joinableTable, sharedReplay: true })).toBe(false);
    expect(isJoinEligible({ ...joinableTable, joined: true })).toBe(false);
    expect(isJoinEligible({ ...joinableTable, passwordProtected: true })).toBe(true);
    expect(isJoinEligible({ ...joinableTable, numPlayers: 5 })).toBe(false);
    expect(isJoinEligible({
      ...joinableTable,
      options: { ...tableOptions, timed: true, timeBase: 120, timePerTurn: 20 },
    })).toBe(true);
    for (const unsupported of ['speedrun', 'deckPlays', 'detrimentalCharacters'] as const) {
      expect(isJoinEligible({
        ...joinableTable,
        options: { ...tableOptions, [unsupported]: true },
      })).toBe(false);
    }
  });

  test('only own running non-replay tables are reattend eligible', () => {
    const ownRunningTable = { ...runningTable, joined: true };
    expect(isReattendEligible(ownRunningTable)).toBe(true);
    expect(isReattendEligible({ ...ownRunningTable, running: false })).toBe(false);
    expect(isReattendEligible({ ...ownRunningTable, joined: false })).toBe(false);
    expect(isReattendEligible({ ...ownRunningTable, sharedReplay: true })).toBe(false);
    expect(isReattendEligible({
      ...ownRunningTable,
      options: { ...tableOptions, timed: true, timeBase: 120, timePerTurn: 20 },
    })).toBe(true);
  });

  test('unsupported pregame recovery unattends, clears recovery, and warns', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage('welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[123]}');
    socket.emitMessage(createdPregameFrame(
      ['Ada'], 123, 'Unsupported', { ...tableOptions, speedrun: true },
    ));
    expect(socket.sent).toEqual([
      'tableReattend {"tableID":123}',
      'tableUnattend {"tableID":123}',
    ]);
    expect(store.getState().room.pendingRecovery).toBeNull();
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().lobby.notice).toMatchObject({ kind: 'warning' });
  });

  test('timed bootstrap init is supported', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    addRunningTable(store);
    expect(runtime.spectate(123)).toBe(true);
    socket.emitMessage('tableStart {"tableID":123,"replay":false}');
    socket.emitMessage(`init ${JSON.stringify(makeInit({
      spectating: true,
      options: { ...makeInit().options, timed: true, timeBase: 120, timePerTurn: 20 },
    }))}`);
    expect(socket.sent.at(-1)).toBe('getGameInfo2 {"tableID":123}');
    expect(store.getState().room.room).toMatchObject({
      kind: 'awaiting_game_bootstrap', bootstrap: { phase: 'waiting_history' },
    });
  });

  test('runtime enforces the adjusted Clue Starved clue threshold', async () => {
    const variantName = 'Clue Starved (5 Suits)';
    const { runtime, socket, store } = await makeReadyRuntime();
    store.dispatch(lobbyActions.tableReceived({
      epoch: 1,
      table: {
        ...joinableTable,
        variant: variantName,
        options: { ...tableOptions, variantName },
        players: ['Bob'],
      },
    }));
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage(createdPregameFrame(
      ['Ada', 'Bob'], 123, 'Pregame table', { ...tableOptions, variantName },
    ));
    socket.emitMessage('joined {"tableID":123}');
    socket.emitMessage('tableStart {"tableID":123,"replay":false}');
    socket.emitMessage(`init ${JSON.stringify(makeInit({
      options: { ...makeInit().options, variantName },
    }))}`);
    socket.emitMessage(`gameActionList ${JSON.stringify({
      tableID: 123,
      list: [
        ...Array.from({ length: 5 }, (_, order) => ({
          type: 'draw', playerIndex: 0, order, suitIndex: -1, rank: -1,
        })),
        ...Array.from({ length: 5 }, (_, index) => ({
          type: 'draw', playerIndex: 1, order: index + 5, suitIndex: index, rank: 1,
        })),
        ...Array.from({ length: 8 }, (_, turn) => ({
          type: 'clue', clue: { type: 0, value: 0 }, giver: 0,
          list: [5], target: 1, turn,
        })),
        {
          type: 'discard', playerIndex: 0, order: 0,
          suitIndex: 0, rank: 1, failed: false,
        },
        { type: 'turn', num: 0, currentPlayerIndex: 0 },
      ],
    })}`);
    expect(runtime.colorClue(1, 0)).toBe(false);
    socket.emitMessage(
      'gameAction {"tableID":123,"action":{"type":"discard","playerIndex":0,'
      + '"order":1,"suitIndex":0,"rank":1,"failed":false}}',
    );
    expect(runtime.colorClue(1, 0)).toBe(true);
    expect(socket.sent.at(-1)).toBe(
      'action {"tableID":123,"type":2,"target":1,"value":0}',
    );
  });

  test('live runtime rejects zero-touch clues before creating pending gameplay state', async () => {
    const { runtime, socket, store } = await makeLiveRuntime('player');
    socket.emitMessage(
      'gameAction {"tableID":123,"action":{"type":"discard","playerIndex":1,'
      + '"order":9,"suitIndex":4,"rank":5,"failed":false}}',
    );
    let room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected live game');
    expect(room.clientState.ongoingGame.hands[1]).not.toContain(9);
    const sentBefore = socket.sent.length;

    expect(runtime.rankClue(1, 5)).toBe(false);
    expect(socket.sent).toHaveLength(sentBefore);
    expect(store.getState().room.pendingGameplayAction).toBeNull();

    expect(runtime.rankClue(1, 1)).toBe(true);
    expect(socket.sent.at(-1)).toBe('action {"tableID":123,"type":3,"target":1,"value":1}');
  });

  test('reattend uses the existing player recovery path and attendance guard', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    store.dispatch(lobbyActions.tableReceived({
      epoch: 1,
      table: { ...runningTable, joined: true },
    }));

    expect(runtime.reattend(123)).toBe(true);
    expect(runtime.reattend(123)).toBe(false);
    expect(socket.sent).toEqual(['tableReattend {"tableID":123}']);
    expect(store.getState().room.pendingRecovery).toEqual({
      tableID: 123,
      role: 'player',
    });

    socket.emitMessage('tableStart {"tableID":123,"replay":false}');
    expect(store.getState().room.room).toMatchObject({
      kind: 'awaiting_game_bootstrap',
      tableID: 123,
      role: 'player',
    });
  });

  test('detached leader moves visible replay knowledge only on authoritative echo', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime('Bob');
    expect(runtime.navigateReplaySegment(0)).toBe(true);
    socket.emitMessage('replayLeader {"tableID":123,"name":"Ada"}');

    let room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.shared).toMatchObject({
      segment: 1, useSharedSegments: false, leader: 'Ada', amLeader: true,
    });
    expect(room.clientState.replay.segment).toBe(0);
    const beforeVisible = room.clientState.visibleState;
    if (beforeVisible === null) throw new Error('Expected visible replay state');
    expect(beforeVisible.turn.turnNum).toBe(0);
    const beforeCard = beforeVisible.deck[5];
    if (beforeCard === undefined) throw new Error('Expected replay card');
    expect(getCardKnowledgeViewModel('No Variant', beforeCard).positiveRanks).toEqual([]);

    const sentBefore = socket.sent.length;
    expect(runtime.navigateReplaySegment(1)).toBe(true);
    expect(socket.sent.slice(sentBefore)).toEqual([
      'replayAction {"tableID":123,"type":0,"segment":1}',
    ]);
    const stillWaiting = store.getState().room.room;
    if (stillWaiting.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(stillWaiting.clientState.replay.segment).toBe(0);
    expect(stillWaiting.clientState.replay.shared?.segment).toBe(1);
    const waitingVisible = stillWaiting.clientState.visibleState;
    if (waitingVisible === null) throw new Error('Expected visible replay state');
    expect(waitingVisible.turn.turnNum).toBe(0);

    socket.emitMessage('replaySegment {"tableID":123,"segment":1}');
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.segment).toBe(1);
    expect(room.clientState.replay.shared).toMatchObject({
      segment: 1, useSharedSegments: false, amLeader: true,
    });
    const confirmedVisible = room.clientState.visibleState;
    if (confirmedVisible === null) throw new Error('Expected visible replay state');
    expect(confirmedVisible.turn.turnNum).toBe(1);
    const confirmedCard = confirmedVisible.deck[5];
    if (confirmedCard === undefined) throw new Error('Expected replay card');
    expect(getCardKnowledgeViewModel('No Variant', confirmedCard).positiveRanks).toEqual([1]);
  });

  test('detached follower keeps its viewed segment when shared truth changes', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime('Bob');
    const sentBefore = socket.sent.length;
    expect(runtime.navigateReplaySegment(0)).toBe(true);
    expect(runtime.navigateReplaySegment(1)).toBe(true);
    let room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.segment).toBe(1);
    expect(room.clientState.replay.shared).toMatchObject({
      segment: 1, useSharedSegments: false, leader: 'Bob', amLeader: false,
    });
    expect(socket.sent).toHaveLength(sentBefore);

    socket.emitMessage('replaySegment {"tableID":123,"segment":0}');
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.segment).toBe(1);
    expect(room.clientState.replay.shared?.segment).toBe(0);

    expect(runtime.followReplayLeader()).toBe(true);
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.segment).toBe(0);
    expect(room.clientState.replay.shared?.useSharedSegments).toBe(true);
    expect(socket.sent).toHaveLength(sentBefore);
  });

  test('shared replay follower takes leadership only after the authoritative echo', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime('Bob');

    expect(runtime.setSharedReplayLeader('Ada')).toBe(true);
    expect(socket.sent.at(-1)).toBe('tableSetLeader {"tableID":123,"name":"Ada"}');
    let room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.shared).toMatchObject({ leader: 'Bob', amLeader: false });

    socket.emitMessage('replayLeader {"tableID":123,"name":"Ada"}');
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.shared).toMatchObject({ leader: 'Ada', amLeader: true });
  });

  test('shared replay leader can pass only to an active spectator', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime();

    expect(runtime.setSharedReplayLeader('Cy')).toBe(false);
    expect(runtime.setSharedReplayLeader('Ada')).toBe(false);
    expect(runtime.setSharedReplayLeader('Bob')).toBe(true);
    expect(socket.sent.at(-1)).toBe('tableSetLeader {"tableID":123,"name":"Bob"}');
    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.shared).toMatchObject({ leader: 'Ada', amLeader: true });
  });

  test('hypothetical shared leader waits for authoritative action events and followers cannot send', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime();
    expect(runtime.startHypothetical()).toBe(true);
    expect(socket.sent.at(-1)).toBe('replayAction {"tableID":123,"type":3}');
    let room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.hypothetical).toBeNull();
    socket.emitMessage('hypoStart {"TableID":123}');
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    const touchedOrder = room.clientState.replay.hypothetical?.ongoing.hands[0]?.[0];
    if (touchedOrder === undefined) throw new Error('Expected a touched card in the hypothetical state');
    const hypotheticalClue = {
      type: 'clue' as const, clue: { type: 1 as const, value: 1 as const }, giver: 1 as const, list: [touchedOrder], target: 0 as const,
      ignoreNegative: false,
    };
    expect(runtime.sendHypotheticalAction(hypotheticalClue)).toBe(true);
    expect(socket.sent.at(-1)).toContain('"type":5');
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.hypothetical?.ongoing.turn.turnNum).toBe(1);
    socket.emitMessage('hypoAction "{\\"type\\":\\"clue\\",\\"clue\\":{\\"type\\":1,\\"value\\":1},\\"giver\\":1,\\"list\\":[0],\\"target\\":0,\\"ignoreNegative\\":false}"');
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.hypothetical?.ongoing.clueTokens).toBe(6);

    socket.emitMessage('replayLeader {"tableID":123,"name":"Bob"}');
    const sent = socket.sent.length;
    expect(runtime.backHypothetical()).toBe(false);
    expect(runtime.endHypothetical()).toBe(false);
    expect(socket.sent).toHaveLength(sent);
  });

  test('hypothetical runtime rejects discard at maximum clue tokens', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime();
    expect(runtime.navigateReplaySegment(0)).toBe(true);
    socket.emitMessage('replaySegment {"tableID":123,"segment":0}');
    expect(runtime.startHypothetical()).toBe(true);
    socket.emitMessage('hypoStart {"TableID":123}');

    const roomBefore = store.getState().room.room;
    if (roomBefore.kind !== 'live_game') throw new Error('Expected shared replay');
    const hypotheticalBefore = roomBefore.clientState.replay.hypothetical;
    if (hypotheticalBefore === null) throw new Error('Expected hypothetical state');
    expect(hypotheticalBefore.ongoing.clueTokens).toBe(8);
    const order = hypotheticalBefore.ongoing.hands[0]?.[0];
    if (order === undefined) throw new Error('Expected actionable hypothetical card');
    const sentBefore = socket.sent.length;

    expect(runtime.hypotheticalDiscard(order)).toBe(false);
    expect(socket.sent).toHaveLength(sentBefore);
    const roomAfter = store.getState().room.room;
    if (roomAfter.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(roomAfter.clientState.replay.hypothetical).toBe(hypotheticalBefore);
  });

  test('hypothetical runtime rejects clues with zero clue tokens', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime();
    expect(runtime.navigateReplaySegment(0)).toBe(true);
    socket.emitMessage('replaySegment {"tableID":123,"segment":0}');
    expect(runtime.startHypothetical()).toBe(true);
    socket.emitMessage('hypoStart {"TableID":123}');

    for (let turn = 0; turn < 8; turn += 1) {
      const giver = turn % 2;
      const target = giver === 0 ? 1 : 0;
      const order = target === 0 ? 0 : 5;
      socket.emitMessage(
        `hypoAction ${JSON.stringify(
          `{"type":"clue","clue":{"type":1,"value":1},"giver":${giver},`
          + `"list":[${order}],"target":${target},"ignoreNegative":false}`,
        )}`,
      );
      socket.emitMessage(
        `hypoAction ${JSON.stringify(
          `{"type":"turn","num":${turn + 1},"currentPlayerIndex":${target}}`,
        )}`,
      );
    }

    const roomBefore = store.getState().room.room;
    if (roomBefore.kind !== 'live_game') throw new Error('Expected shared replay');
    const hypotheticalBefore = roomBefore.clientState.replay.hypothetical;
    if (hypotheticalBefore === null) throw new Error('Expected hypothetical state');
    expect(hypotheticalBefore.ongoing.clueTokens).toBe(0);
    const sentBefore = socket.sent.length;

    expect(runtime.hypotheticalRankClue(1, 1)).toBe(false);
    expect(socket.sent).toHaveLength(sentBefore);
    const roomAfter = store.getState().room.room;
    if (roomAfter.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(roomAfter.clientState.replay.hypothetical).toBe(hypotheticalBefore);
  });

  test('hypothetical runtime rejects zero-touch clues before generating actions', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime();
    expect(runtime.startHypothetical()).toBe(true);
    socket.emitMessage('hypoStart {"TableID":123}');

    let room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    const hypotheticalBefore = room.clientState.replay.hypothetical;
    if (hypotheticalBefore === null) throw new Error('Expected hypothetical state');
    const actionsBefore = hypotheticalBefore.actions;
    const sentBefore = socket.sent.length;

    expect(runtime.hypotheticalRankClue(0, 2)).toBe(false);
    expect(socket.sent).toHaveLength(sentBefore);
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.hypothetical).toBe(hypotheticalBefore);
    expect(room.clientState.replay.hypothetical?.actions).toBe(actionsBefore);

    expect(runtime.hypotheticalRankClue(0, 1)).toBe(true);
    expect(socket.sent.slice(sentBefore)).toHaveLength(2);
    expect(socket.sent.slice(sentBefore).every((frame) => frame.startsWith('replayAction '))).toBe(true);
  });

  test('shared hypothetical operation stays pending through intermediate echoes and rejects another operation', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime();
    expect(runtime.startHypothetical()).toBe(true);
    socket.emitMessage('hypoStart {"TableID":123}');
    const sentBefore = socket.sent.length;

    expect(runtime.hypotheticalRankClue(0, 1)).toBe(true);
    const frames = socket.sent.slice(sentBefore);
    const actions = getSentHypotheticalActions(frames);
    expect(actions).toHaveLength(2);
    expect(store.getState().room.pendingHypotheticalOperation).toMatchObject({
      connectionEpoch: 1,
      tableID: 123,
      finalAction: actions.at(-1),
    });

    expect(runtime.hypotheticalPlay(5)).toBe(false);
    expect(runtime.sendHypotheticalAction(actions[0]!)).toBe(false);
    expect(socket.sent.slice(sentBefore)).toEqual(frames);

    emitHypotheticalAction(socket, actions[0]!);
    expect(store.getState().room.pendingHypotheticalOperation).not.toBeNull();
    expect(runtime.hypotheticalPlay(5)).toBe(false);
    expect(runtime.backHypothetical()).toBe(false);

    emitHypotheticalAction(socket, actions[1]!);
    expect(store.getState().room.pendingHypotheticalOperation).toBeNull();
    expect(runtime.hypotheticalPlay(0)).toBe(true);
  });

  test('shared hypothetical first-frame failure clears pending and sends nothing', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime();
    expect(runtime.startHypothetical()).toBe(true);
    socket.emitMessage('hypoStart {"TableID":123}');
    const sentBefore = socket.sent.length;
    socket.failOnSendNumber = sentBefore + 1;

    expect(runtime.hypotheticalRankClue(0, 1)).toBe(false);
    expect(socket.sent).toHaveLength(sentBefore);
    expect(store.getState().room.pendingHypotheticalOperation).toBeNull();
  });

  test('shared hypothetical partial send failure stays uncertain without retry until authoritative end', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime();
    expect(runtime.startHypothetical()).toBe(true);
    socket.emitMessage('hypoStart {"TableID":123}');
    const sentBefore = socket.sent.length;
    socket.failOnSendNumber = sentBefore + 2;

    expect(runtime.hypotheticalRankClue(0, 1)).toBe(false);
    expect(socket.sent.slice(sentBefore)).toHaveLength(1);
    expect(store.getState().room.pendingHypotheticalOperation).not.toBeNull();
    expect(runtime.hypotheticalPlay(5)).toBe(false);
    expect(socket.sent.slice(sentBefore)).toHaveLength(1);

    socket.failOnSendNumber = null;
    expect(runtime.endHypothetical()).toBe(true);
    expect(store.getState().room.pendingHypotheticalOperation).not.toBeNull();
    socket.emitMessage('hypoEnd {"TableID":123}');
    expect(store.getState().room.pendingHypotheticalOperation).toBeNull();
  });

  test('connection replacement clears a shared hypothetical operation without replay', async () => {
    const { session, runtime, socket: first, store } = await makeSharedReplayRuntime();
    expect(runtime.startHypothetical()).toBe(true);
    first.emitMessage('hypoStart {"TableID":123}');
    expect(runtime.hypotheticalRankClue(0, 1)).toBe(true);
    expect(store.getState().room.pendingHypotheticalOperation).not.toBeNull();
    const second = new FakeSocket();
    session.sockets.push(Promise.resolve(second));

    first.emitClose();
    expect(store.getState().room.pendingHypotheticalOperation).toBeNull();
    jest.advanceTimersByTime(1_000);
    await Promise.resolve();
    second.emitOpen();
    second.emitMessage(welcomeFrame);

    expect(store.getState().room.pendingHypotheticalOperation).toBeNull();
    expect(second.sent).toEqual([]);
  });

  test('solo hypothetical operations remain local and immediately composable', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime('Ada', ['Ada', 'Bob'], false);
    const sentBefore = socket.sent.length;
    expect(runtime.startHypothetical()).toBe(true);
    const room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected solo replay');
    const actor = room.clientState.replay.hypothetical?.ongoing.turn.currentPlayerIndex;
    if (actor === null || actor === undefined) throw new Error('Expected hypothetical actor');
    expect(runtime.hypotheticalRankClue(actor === 0 ? 1 : 0, 1)).toBe(true);
    expect(store.getState().room.pendingHypotheticalOperation).toBeNull();
    expect(runtime.backHypothetical()).toBe(true);
    expect(socket.sent).toHaveLength(sentBefore);
  });

  test('detached follower promoted to shared replay leader can start hypothetical', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime('Bob');
    expect(runtime.navigateReplaySegment(0)).toBe(true);

    let room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.shared).toMatchObject({
      useSharedSegments: false, amLeader: false,
    });

    socket.emitMessage('replayLeader {"tableID":123,"name":"Ada"}');
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.shared).toMatchObject({
      amLeader: true, useSharedSegments: false,
    });

    const sentBefore = socket.sent.length;
    expect(runtime.startHypothetical()).toBe(true);
    expect(socket.sent.slice(sentBefore)).toEqual([
      'replayAction {"tableID":123,"type":3}',
    ]);
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.hypothetical).toBeNull();

    socket.emitMessage('hypoStart {"TableID":123}');
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.replay.hypothetical).not.toBeNull();
    expect(room.clientState.replay.shared?.useSharedSegments).toBe(true);
    expect(room.clientState.replay.segment).toBe(room.clientState.replay.shared?.segment);
  });

  test('leader and spectator events are table-scoped and drive rematch eligibility', async () => {
    const { socket, store } = await makeSharedReplayRuntime();
    let room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(isQuickRematchEligible(room.clientState, null)).toBe(true);
    expect(isQuickRematchEligible(room.clientState, 123)).toBe(false);
    expect(isQuickRematchEligible({
      ...room.clientState,
      metadata: {
        ...room.clientState.metadata,
        ourUsername: 'Viewer',
      },
    }, null)).toBe(false);

    socket.emitMessage('spectators {"tableID":999,"spectators":[]}');
    socket.emitMessage('replayLeader {"tableID":999,"name":"Bob"}');
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(room.clientState.spectators).toHaveLength(2);
    expect(room.clientState.replay.shared?.leader).toBe('Ada');

    socket.emitMessage(
      'spectators {"tableID":123,"spectators":['
      + '{"name":"Ada","shadowingPlayerIndex":-1,"shadowingPlayerUsername":""}]}',
    );
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(isQuickRematchEligible(room.clientState, null)).toBe(false);
    socket.emitMessage(
      'spectators {"tableID":123,"spectators":['
      + '{"name":"Ada","shadowingPlayerIndex":-1,"shadowingPlayerUsername":""},'
      + '{"name":"Cy","shadowingPlayerIndex":-1,"shadowingPlayerUsername":""}]}',
    );
    room = store.getState().room.room;
    if (room.kind !== 'live_game') throw new Error('Expected shared replay');
    expect(isQuickRematchEligible(room.clientState, null)).toBe(false);
    expect(isRestartToPregameEligible(room.clientState, null)).toBe(true);
    socket.emitMessage('replayLeader {"tableID":123,"name":"Bob"}');
    expect(store.getState().room.room).toMatchObject({
      clientState: { replay: { shared: { leader: 'Bob', amLeader: false } } },
    });
  });

  test('quick rematch follows boot to a new table across reordered duplicate events', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime();
    const sentBefore = socket.sent.length;
    expect(runtime.quickRematch()).toBe(true);
    expect(runtime.quickRematch()).toBe(false);
    expect(socket.sent.slice(sentBefore)).toEqual([
      'tableRestart {"tableID":123,"hidePregame":true}',
    ]);
    expect(store.getState().room.pendingRestartTableID).toBe(123);

    socket.emitMessage('boot {"TableID":123}');
    expect(store.getState().room.room).toMatchObject({ kind: 'live_game', tableID: 123 });
    expect(store.getState().room.rematchTransition).toMatchObject({
      oldTableID: 123,
      newTableID: null,
      role: 'player',
    });

    const newGame = createdPregameFrame(['Ada', 'Bob'], 456, 'Running table (#2)');
    socket.emitMessage(newGame);
    socket.emitMessage('joined {"tableID":456}');
    expect(store.getState().room.room).toMatchObject({ kind: 'live_game', tableID: 123 });
    socket.emitMessage(
      'user {"userID":1,"name":"Ada","status":1,"tableID":456,'
      + '"hyphenated":false,"inactive":false}',
    );
    socket.emitMessage(newGame);
    socket.emitMessage('joined {"tableID":456}');
    socket.emitMessage('joined {"tableID":456}');
    socket.emitMessage('chatList {"list":[],"unread":0}');
    socket.emitMessage('chatList {"list":[],"unread":0}');
    expect(store.getState().room.rematchTransition).toMatchObject({
      newTableID: 456,
      joinedConfirmed: true,
      stagedGame: { tableID: 456 },
    });

    socket.emitMessage('tableStart {"tableID":456,"replay":false}');
    expect(store.getState().room.rematchTransition).toBeNull();
    expect(store.getState().room.room).toMatchObject({
      kind: 'awaiting_game_bootstrap',
      tableID: 456,
      role: 'player',
      replay: false,
      expectedDatabaseID: null,
      bootstrap: { phase: 'waiting_init' },
    });
    expect(socket.sent.at(-1)).toBe('getGameInfo1 {"tableID":456}');

    socket.emitMessage('boot {"TableID":123}');
    socket.emitMessage('replaySegment {"tableID":123,"segment":0}');
    socket.emitMessage('joined {"tableID":456}');
    socket.emitMessage(newGame);
    expect(store.getState().room.room).toMatchObject({
      kind: 'awaiting_game_bootstrap', tableID: 456,
    });
    socket.emitMessage(`init ${JSON.stringify(makeInit({ tableID: 456 }))}`);
    expect(socket.sent.at(-1)).toBe('getGameInfo2 {"tableID":456}');
  });

  test('restart-to-pregame reuses restart transition with hidePregame false', async () => {
    const { runtime, socket, store } = await makeSharedReplayRuntime();
    const sentBefore = socket.sent.length;
    expect(runtime.restartToPregame()).toBe(true);
    expect(runtime.quickRematch()).toBe(false);
    expect(socket.sent.slice(sentBefore)).toEqual([
      'tableRestart {"tableID":123,"hidePregame":false}',
    ]);

    socket.emitMessage('boot {"TableID":123}');
    expect(store.getState().room.rematchTransition).toMatchObject({
      oldTableID: 123, hidePregame: false,
    });
    socket.emitMessage(
      'user {"userID":1,"name":"Ada","status":2,"tableID":456,'
      + '"hyphenated":false,"inactive":false}',
    );
    socket.emitMessage('joined {"tableID":456}');
    socket.emitMessage(createdPregameFrame(['Ada'], 456, 'Running table (#2)'));
    expect(store.getState().room.rematchTransition).toBeNull();
    expect(store.getState().room.room).toMatchObject({
      kind: 'pregame', tableID: 456, role: 'player',
    });
    expect(socket.sent.slice(sentBefore)).toEqual([
      'tableRestart {"tableID":123,"hidePregame":false}',
    ]);
  });

  test('non-initiator restart migration preserves original player role', async () => {
    const { socket, store } = await makeSharedReplayRuntime('Bob');
    socket.emitMessage('boot {"TableID":123}');
    socket.emitMessage('tableStart {"tableID":456,"replay":false}');
    expect(store.getState().room.room).toMatchObject({ kind: 'live_game', tableID: 123 });
    socket.emitMessage(
      'user {"userID":1,"name":"Ada","status":1,"tableID":456,'
      + '"hyphenated":false,"inactive":false}',
    );
    socket.emitMessage('tableStart {"tableID":999,"replay":false}');
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    socket.emitMessage('tableStart {"tableID":456,"replay":false}');
    expect(store.getState().room.room).toMatchObject({
      kind: 'awaiting_game_bootstrap', tableID: 456, role: 'player',
    });
  });

  test('non-initiator restart migration preserves original spectator role', async () => {
    const { socket, store } = await makeSharedReplayRuntime('Bob', ['Bob', 'Cy']);
    socket.emitMessage('boot {"TableID":123}');
    socket.emitMessage(
      'user {"userID":1,"name":"Ada","status":3,"tableID":456,'
      + '"hyphenated":false,"inactive":false}',
    );
    socket.emitMessage('joined {"tableID":456}');
    socket.emitMessage(createdPregameFrame(['Bob'], 456, 'Running table (#2)').replace(
      '"you":true', '"you":false',
    ));
    expect(store.getState().room.room).toMatchObject({
      kind: 'pregame', tableID: 456, role: 'spectator',
    });
  });

  test('shared replay boot stages migration but own lobby status does not confirm it', async () => {
    const { socket, store } = await makeSharedReplayRuntime();

    socket.emitMessage('boot {"TableID":999}');
    expect(store.getState().room.room).toMatchObject({
      kind: 'live_game', tableID: 123,
    });
    expect(store.getState().room.rematchTransition).toBeNull();

    socket.emitMessage('boot {"TableID":123}');
    expect(store.getState().room.room).toMatchObject({ kind: 'live_game', tableID: 123 });
    expect(store.getState().room.pendingRestartTableID).toBeNull();
    expect(store.getState().room.rematchTransition).toMatchObject({
      oldTableID: 123, newTableID: null, role: 'player', hidePregame: null,
    });
    socket.emitMessage(userFrame);
    expect(store.getState().room.room).toMatchObject({ kind: 'live_game', tableID: 123 });
  });

  test('OPEN is not READY; only a valid welcome makes it ready', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    expect(store.getState().session.phase).toBe('openAwaitingWelcome');
    socket.emitMessage(welcomeFrame);
    expect(store.getState().session.phase).toBe('ready');
    expect(socket.sent).toEqual([]);
    expect(store.getState().room.room).toEqual({ kind: 'none' });
  });

  test('player welcome reattends and matching tableStart enters shared bootstrap', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(
      'welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[123]}',
    );

    expect(socket.sent).toEqual(['tableReattend {"tableID":123}']);
    expect(store.getState().room.pendingRecovery).toEqual({
      tableID: 123,
      role: 'player',
    });

    socket.emitMessage('tableStart {"tableID":123,"replay":false}');
    expect(store.getState().room.room).toMatchObject({
      kind: 'awaiting_game_bootstrap',
      tableID: 123,
      role: 'player',
      bootstrap: { phase: 'waiting_init' },
    });
    expect(socket.sent).toEqual([
      'tableReattend {"tableID":123}',
      'getGameInfo1 {"tableID":123}',
    ]);

    socket.emitMessage(`init ${JSON.stringify(makeInit())}`);
    socket.emitMessage(`gameActionList ${JSON.stringify({
      tableID: 123,
      list: [
        ...Array.from({ length: 5 }, (_, order) => ({
          type: 'draw', playerIndex: 0, order, suitIndex: -1, rank: -1,
        })),
        ...Array.from({ length: 5 }, (_, index) => ({
          type: 'draw', playerIndex: 1, order: index + 5,
          suitIndex: index, rank: index + 1,
        })),
        { type: 'status', clues: 8, score: 0, maxScore: 25 },
        { type: 'turn', num: 0, currentPlayerIndex: 0 },
      ],
    })}`);
    expect(store.getState().room.room).toMatchObject({
      kind: 'live_game',
      tableID: 123,
      role: 'player',
      historyActionCount: 12,
    });
    expect(socket.sent).toEqual([
      'tableReattend {"tableID":123}',
      'getGameInfo1 {"tableID":123}',
      'getGameInfo2 {"tableID":123}',
      'loaded {"tableID":123}',
    ]);
  });

  test.each(['player', 'spectator'] as const)(
    'pregame %s recovery completes from reordered game and joined',
    async (role) => {
      const session = new FakeSession();
      const socket = new FakeSocket();
      session.sockets.push(Promise.resolve(socket));
      const store = createAppStore();
      const runtime = new LobbyRuntime(session, store);
      await runtime.connect();
      socket.emitOpen();
      socket.emitMessage(role === 'player'
        ? 'welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[123]}'
        : 'welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[],'
          + '"disconSpectatingTable":123,"disconShadowingSeat":-1}');

      const game = role === 'player'
        ? pregameFrame()
        : pregameFrame().replace('"you":true', '"you":false');
      socket.emitMessage(game);
      expect(store.getState().room.room).toEqual({ kind: 'none' });
      socket.emitMessage('joined {"tableID":123}');
      expect(store.getState().room.room).toMatchObject({
        kind: 'pregame', tableID: 123, role,
      });
      expect(store.getState().room.pendingRecovery).toBeNull();
    },
  );

  test('welcome recovery prioritizes playingAtTables over spectator recovery', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(
      'welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[123],'
      + '"disconSpectatingTable":123,"disconShadowingSeat":-1}',
    );

    expect(socket.sent).toEqual(['tableReattend {"tableID":123}']);
    expect(store.getState().room.pendingRecovery).toEqual({
      tableID: 123,
      role: 'player',
    });
  });

  test('spectator welcome resumes with the server-provided shadowing seat', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(
      'welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[],'
      + '"disconSpectatingTable":123,"disconShadowingSeat":1}',
    );

    expect(socket.sent).toEqual([
      'tableSpectate {"tableID":123,"shadowingPlayerIndex":1}',
    ]);
    expect(store.getState().room.pendingRecovery).toEqual({
      tableID: 123,
      role: 'spectator',
    });
    socket.emitMessage('tableStart {"tableID":123,"replay":false}');
    expect(store.getState().room.room).toMatchObject({
      kind: 'awaiting_game_bootstrap',
      tableID: 123,
      role: 'spectator',
      bootstrap: { phase: 'waiting_init' },
    });
  });

  test('unexpected close retries with backoff and welcome resets the delay', async () => {
    const session = new FakeSession();
    const first = new FakeSocket();
    const second = new FakeSocket();
    const third = new FakeSocket();
    session.sockets.push(
      Promise.resolve(first),
      Promise.resolve(second),
      Promise.resolve(third),
    );
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    first.emitOpen();
    first.emitMessage(welcomeFrame);

    first.emitClose();
    jest.advanceTimersByTime(999);
    expect(session.openCalls).toBe(1);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(session.openCalls).toBe(2);
    second.emitOpen();
    second.emitMessage(welcomeFrame);

    second.emitClose();
    jest.advanceTimersByTime(999);
    expect(session.openCalls).toBe(2);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(session.openCalls).toBe(3);
  });

  test('background keeps a healthy READY socket and foreground opens no duplicate', async () => {
    const session = new FakeSession();
    const first = new FakeSocket();
    session.sockets.push(Promise.resolve(first));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    first.emitOpen();
    first.emitMessage(welcomeFrame);

    runtime.setAppActive(false);
    expect(first.closeCalls).toHaveLength(0);
    expect(store.getState().session.phase).toBe('ready');
    runtime.setAppActive(true);
    await Promise.resolve();
    expect(session.openCalls).toBe(1);
    expect(store.getState().session.connectionEpoch).toBe(1);
    expect(store.getState().session.phase).toBe('ready');
  });

  test('close while inactive waits, then foreground reconnects immediately', async () => {
    const session = new FakeSession();
    const first = new FakeSocket();
    const second = new FakeSocket();
    session.sockets.push(Promise.resolve(first), Promise.resolve(second));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    first.emitOpen();
    first.emitMessage(welcomeFrame);

    runtime.setAppActive(false);
    first.emitClose();
    expect(store.getState().session.phase).toBe('closed');
    jest.advanceTimersByTime(60_000);
    expect(session.openCalls).toBe(1);

    runtime.setAppActive(true);
    await Promise.resolve();
    expect(session.openCalls).toBe(2);
    expect(store.getState().session.connectionEpoch).toBe(2);
    expect(store.getState().session.phase).toBe('connecting');
  });

  test('explicit disconnect cancels an already scheduled retry', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    socket.emitClose();

    runtime.disconnect();
    runtime.setAppActive(false);
    runtime.setAppActive(true);
    jest.advanceTimersByTime(60_000);
    expect(session.openCalls).toBe(1);
    expect(store.getState().session.phase).toBe('closed');
  });

  test('stale messages and closes cannot mutate current state', async () => {
    const session = new FakeSession();
    const first = new FakeSocket();
    const second = new FakeSocket();
    session.sockets.push(Promise.resolve(first), Promise.resolve(second));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    const staleMessages = first.snapshotMessageListeners();
    const staleCloses = first.snapshotCloseListeners();
    runtime.disconnect();
    await runtime.connect();
    for (const listener of staleMessages) listener({ data: userFrame } as WebSocketMessageEvent);
    for (const listener of staleCloses) listener({ code: 1006 } as WebSocketCloseEvent);
    expect(store.getState().session.connectionEpoch).toBe(2);
    expect(store.getState().session.phase).toBe('connecting');
    expect(userSelectors.selectTotal(store.getState())).toBe(0);
  });

  test('a stale openSocket result is disposed immediately', async () => {
    const session = new FakeSession();
    const pending = deferred<NetworkSocket>();
    const stale = new FakeSocket();
    const current = new FakeSocket();
    session.sockets.push(pending.promise, Promise.resolve(current));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    const firstConnect = runtime.connect();
    runtime.disconnect();
    await runtime.connect();
    pending.resolve(stale);
    await firstConnect;
    expect(stale.closeCalls).toHaveLength(1);
    expect(store.getState().session.connectionEpoch).toBe(2);
  });

  test('repeated connect calls are single-flight', async () => {
    const session = new FakeSession();
    const pending = deferred<NetworkSocket>();
    session.sockets.push(pending.promise);
    const runtime = new LobbyRuntime(session, createAppStore());
    const first = runtime.connect();
    const second = runtime.connect();
    expect(second).toBe(first);
    expect(session.openCalls).toBe(1);
    pending.resolve(new FakeSocket());
    await first;
  });

  test('welcome timeout fails and disposes the current attempt', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store, undefined, 500);
    await runtime.connect();
    socket.emitOpen();
    jest.advanceTimersByTime(500);
    expect(store.getState().session.phase).toBe('failed');
    expect(socket.closeCalls).toHaveLength(1);
  });

  test('send before welcome is dropped and never replayed; ready send occurs once', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const runtime = new LobbyRuntime(session, createAppStore());
    await runtime.connect();
    socket.emitOpen();
    expect(runtime.send('futureCommand', { value: 1 })).toBe(false);
    socket.emitMessage(welcomeFrame);
    expect(socket.sent).toEqual([]);
    expect(runtime.send('futureCommand', { value: 1 })).toBe(true);
    expect(socket.sent).toEqual(['futureCommand {"value":1}']);
  });

  test('spectate sends exactly once and does not transition before tableStart', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    addRunningTable(store);

    expect(runtime.spectate(123)).toBe(true);
    expect(socket.sent).toEqual([
      'tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}',
    ]);
    expect(store.getState().room.pendingSpectateTableID).toBe(123);
    expect(store.getState().room.room).toEqual({ kind: 'none' });
  });

  test('valid matching non-replay tableStart enters awaiting game bootstrap', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    addRunningTable(store);
    expect(runtime.spectate(123)).toBe(true);

    socket.emitMessage('tableStart {"tableID":123,"replay":false}');

    expect(store.getState().room).toEqual({
      connectionEpoch: 1,
      pendingSpectateTableID: null,
      pendingRecovery: null,
      recoveryJoinedConfirmed: false,
      recoveryStagedGame: null,
      pendingJoin: null,
      pendingCreate: null,
      pendingRoleSwitch: null,
      pendingLeaveTableID: null,
      pendingUnattendTableID: null,
      pendingUpdate: null,
      pendingLeaderName: null,
      pendingRestartTableID: null,
      pendingRestartHidePregame: null,
      rematchTransition: null,
      pendingStart: null,
      pendingGameplayAction: null,
      pendingHypotheticalOperation: null,
      room: {
        kind: 'awaiting_game_bootstrap',
        tableID: 123,
        role: 'spectator',
        replay: false,
        expectedDatabaseID: null,
        tableStartReceived: true,
        bootstrap: {
          gameLoadEpoch: 1,
          phase: 'waiting_init',
          historyActionCount: 0,
        },
      },
    });
    expect(socket.sent).toEqual([
      'tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}',
      'getGameInfo1 {"tableID":123}',
    ]);
  });

  test('malformed and mismatched tableStart do not transition', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    addRunningTable(store);
    expect(runtime.spectate(123)).toBe(true);

    socket.emitMessage('tableStart {"tableID":123}');
    socket.emitMessage('tableStart {"tableID":999,"replay":false}');

    expect(store.getState().session.protocolIssueCount).toBe(1);
    expect(store.getState().room.pendingSpectateTableID).toBe(123);
    expect(store.getState().room.room).toEqual({ kind: 'none' });
  });

  test('new epoch resets pending and room; stale tableStart cannot restore them', async () => {
    const session = new FakeSession();
    const first = new FakeSocket();
    const second = new FakeSocket();
    session.sockets.push(Promise.resolve(first), Promise.resolve(second));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    first.emitOpen();
    first.emitMessage(welcomeFrame);
    addRunningTable(store);
    expect(runtime.spectate(123)).toBe(true);
    const staleMessages = first.snapshotMessageListeners();
    first.emitMessage('tableStart {"tableID":123,"replay":false}');
    expect(store.getState().room.room.kind).toBe('awaiting_game_bootstrap');

    runtime.disconnect();
    await runtime.connect();
    for (const listener of staleMessages) {
      listener({ data: 'tableStart {"tableID":123,"replay":false}' } as WebSocketMessageEvent);
    }

    expect(store.getState().room).toEqual({
      connectionEpoch: 2,
      pendingSpectateTableID: null,
      pendingRecovery: null,
      recoveryJoinedConfirmed: false,
      recoveryStagedGame: null,
      pendingJoin: null,
      pendingCreate: null,
      pendingRoleSwitch: null,
      pendingLeaveTableID: null,
      pendingUnattendTableID: null,
      pendingUpdate: null,
      pendingLeaderName: null,
      pendingRestartTableID: null,
      pendingRestartHidePregame: null,
      rematchTransition: null,
      pendingStart: null,
      pendingGameplayAction: null,
      pendingHypotheticalOperation: null,
      room: { kind: 'none' },
    });
  });

  test('spectate uses READY gate and is never replayed on a new connection', async () => {
    const session = new FakeSession();
    const first = new FakeSocket();
    const second = new FakeSocket();
    session.sockets.push(Promise.resolve(first), Promise.resolve(second));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    first.emitOpen();
    addRunningTable(store);

    expect(runtime.spectate(123)).toBe(false);
    first.emitMessage(welcomeFrame);
    expect(first.sent).toEqual([]);
    expect(runtime.spectate(123)).toBe(true);
    expect(first.sent).toHaveLength(1);

    runtime.disconnect();
    await runtime.connect();
    second.emitOpen();
    second.emitMessage(welcomeFrame);
    expect(second.sent).toEqual([]);
    expect(store.getState().room.pendingSpectateTableID).toBeNull();
  });

  test('join uses the READY gate, sends exactly once, and never optimistically attends', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    addJoinableTable(store);

    expect(runtime.join(123)).toBe(false);
    socket.emitMessage(welcomeFrame);
    expect(socket.sent).toEqual([]);
    expect(runtime.join(123)).toBe(true);
    expect(runtime.join(123)).toBe(false);
    expect(socket.sent).toEqual(['tableJoin {"tableID":123}']);
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().room.pendingJoin).toEqual({
      tableID: 123,
      role: 'player',
      joinedConfirmed: false,
      stagedGame: null,
    });
  });

  test('protected join sends the password once without putting it in application state', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    store.dispatch(lobbyActions.tableReceived({
      epoch: 1, table: { ...joinableTable, passwordProtected: true },
    }));

    expect(runtime.join(123)).toBe(false);
    expect(runtime.join(123, 'open sesame')).toBe(true);
    expect(socket.sent).toEqual([
      'tableJoin {"tableID":123,"password":"open sesame"}',
    ]);
    expect(JSON.stringify(store.getState())).not.toContain('open sesame');
    socket.emitMessage('warning {"warning":"Invalid table password."}');
    expect(store.getState().room.pendingJoin).toBeNull();
    expect(runtime.join(123, 'second try')).toBe(true);
    expect(JSON.stringify(store.getState())).not.toContain('second try');
  });

  test.each(['game-first', 'joined-first'] as const)(
    'pregame spectate reuses authoritative attendance ordering (%s)',
    async (order) => {
      const { runtime, socket, store } = await makeReadyRuntime();
      addJoinableTable(store);
      expect(isPregameSpectateEligible(joinableTable)).toBe(true);
      expect(runtime.spectate(123)).toBe(true);
      const spectatorGame = pregameFrame().replace('"you":true', '"you":false');
      if (order === 'game-first') {
        socket.emitMessage(spectatorGame);
        socket.emitMessage('joined {"tableID":123}');
      } else {
        socket.emitMessage('joined {"tableID":123}');
        socket.emitMessage(spectatorGame);
      }
      expect(store.getState().room.room).toMatchObject({
        kind: 'pregame', tableID: 123, role: 'spectator',
      });
      expect(runtime.leave(123)).toBe(true);
      expect(socket.sent).toEqual([
        'tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}',
        'tableUnattend {"tableID":123}',
      ]);
      expect(store.getState().room.room.kind).toBe('pregame');
      socket.emitMessage(userFrame);
      expect(store.getState().room.room).toEqual({ kind: 'none' });
    },
  );

  test('pregame player-to-spectator sends leave then spectate, stays present through left, and confirms from game plus joined', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage(pregameFrame());
    socket.emitMessage('joined {"tableID":123}');

    expect(runtime.switchToSpectator()).toBe(true);
    expect(socket.sent).toEqual([
      'tableJoin {"tableID":123}',
      'tableLeave {"tableID":123}',
      'tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}',
    ]);
    expect(store.getState().room.room).toMatchObject({ kind: 'pregame', role: 'player' });
    socket.emitMessage('left {"TableID":123}');
    expect(store.getState().room.room.kind).toBe('pregame');
    socket.emitMessage(createdPregameFrame(['Bob'], 123).replace('"you":true', '"you":false'));
    expect(store.getState().room.room).toMatchObject({ kind: 'pregame', role: 'player' });
    socket.emitMessage('joined {"tableID":123}');
    expect(store.getState().room.room).toMatchObject({ kind: 'pregame', role: 'spectator' });
    expect(store.getState().room.pendingRoleSwitch).toBeNull();
  });

  test('player-to-spectator retains the leave transition when local spectate send fails and authoritative left exits pregame', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage(pregameFrame());
    socket.emitMessage('joined {"tableID":123}');
    socket.failOnSendNumber = 3;

    expect(runtime.switchToSpectator()).toBe(false);
    expect(socket.sent).toEqual(['tableJoin {"tableID":123}', 'tableLeave {"tableID":123}']);
    expect(store.getState().room.pendingRoleSwitch).toMatchObject({
      targetRole: 'spectator', leaveSent: true, spectateSent: false,
    });
    socket.emitMessage('left {"TableID":123}');
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().room.pendingRoleSwitch).toBeNull();
  });

  test.each(['warning', 'error'] as const)(
    'player-to-spectator %s before or after left safely exits the stale player room',
    async (rejection) => {
      for (const order of ['before-left', 'after-left'] as const) {
        const { runtime, socket, store } = await makeReadyRuntime();
        addJoinableTable(store);
        expect(runtime.join(123)).toBe(true);
        socket.emitMessage(pregameFrame());
        socket.emitMessage('joined {"tableID":123}');
        expect(runtime.switchToSpectator()).toBe(true);
        const rejected = `${rejection} ${JSON.stringify({ [rejection]: 'Rejected' })}`;
        if (order === 'before-left') {
          socket.emitMessage(rejected);
          expect(store.getState().room.room).toMatchObject({ kind: 'pregame', role: 'player' });
          expect(store.getState().room.pendingRoleSwitch).toMatchObject({ rejected: true });
          socket.emitMessage('left {"TableID":123}');
        } else {
          socket.emitMessage('left {"TableID":123}');
          expect(store.getState().room.room.kind).toBe('pregame');
          socket.emitMessage(rejected);
        }
        expect(store.getState().room.room).toEqual({ kind: 'none' });
        expect(store.getState().room.pendingRoleSwitch).toBeNull();
      }
    },
  );

  test('pregame spectator-to-player requires and passes password, then confirms only after game plus joined', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    addJoinableTable(store);
    expect(runtime.spectate(123)).toBe(true);
    socket.emitMessage(pregameFrame().replace('"you":true', '"you":false'));
    socket.emitMessage('joined {"tableID":123}');
    const spectatorRoom = store.getState().room.room;
    if (spectatorRoom.kind !== 'pregame') throw new Error('Expected pregame spectator room');
    store.dispatch(roomActions.gameReceived({
      epoch: 1,
      game: { ...spectatorRoom.data, passwordProtected: true },
    }));

    expect(runtime.joinAsPlayer()).toBe(false);
    expect(runtime.joinAsPlayer('open sesame')).toBe(true);
    expect(socket.sent).toEqual([
      'tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}',
      'tableJoin {"tableID":123,"password":"open sesame"}',
    ]);
    socket.emitMessage(pregameFrame());
    expect(store.getState().room.room).toMatchObject({ kind: 'pregame', role: 'spectator' });
    socket.emitMessage('joined {"tableID":123}');
    expect(store.getState().room.room).toMatchObject({ kind: 'pregame', role: 'player' });
    expect(JSON.stringify(store.getState())).not.toContain('open sesame');
  });

  test.each(['warning', 'error'] as const)('spectator-to-player %s clears only its intent and remains spectator', async (rejection) => {
    const { runtime, socket, store } = await makeReadyRuntime();
    addJoinableTable(store);
    expect(runtime.spectate(123)).toBe(true);
    socket.emitMessage(pregameFrame().replace('"you":true', '"you":false'));
    socket.emitMessage('joined {"tableID":123}');
    expect(runtime.joinAsPlayer()).toBe(true);
    socket.emitMessage(`${rejection} ${JSON.stringify({ [rejection]: 'Rejected' })}`);
    expect(store.getState().room.pendingRoleSwitch).toBeNull();
    expect(store.getState().room.room).toMatchObject({ kind: 'pregame', role: 'spectator' });
  });

  test('pregame mutations do not send while a role switch is pending', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage(createdPregameFrame(['Ada', 'Bob'], 123));
    socket.emitMessage('joined {"tableID":123}');
    expect(runtime.switchToSpectator()).toBe(true);

    expect(runtime.leave(123)).toBe(false);
    expect(runtime.startGame()).toBe(false);
    expect(runtime.updateTable('Changed', 3, {
      variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
      cardCycle: false, emptyClues: false, oneExtraCard: false, oneLessCard: false,
      allOrNothing: false,
    })).toBe(false);
    expect(runtime.setTableLeader('Bob')).toBe(false);
    expect(socket.sent).toEqual([
      'tableJoin {"tableID":123}',
      'tableLeave {"tableID":123}',
      'tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}',
    ]);
  });

  test.each(['warning', 'error'] as const)('pregame role switching rejects a full spectator seat and a solo player, and %s clears its pending intent', async (rejection) => {
    const { runtime, socket, store } = await makeReadyRuntime();
    addJoinableTable(store);
    expect(runtime.spectate(123)).toBe(true);
    socket.emitMessage(createdPregameFrame(['Bob'], 123, 'Pregame table', tableOptions, 1)
      .replace('"you":true', '"you":false'));
    socket.emitMessage('joined {"tableID":123}');
    expect(runtime.joinAsPlayer()).toBe(false);
    store.dispatch(roomActions.roleSwitchRequested({ epoch: 1, tableID: 123, targetRole: 'player' }));
    socket.emitMessage(`${rejection} ${JSON.stringify({ [rejection]: 'Rejected' })}`);
    expect(store.getState().room.pendingRoleSwitch).toBeNull();
    expect(store.getState().room.room).toMatchObject({ kind: 'pregame', role: 'spectator' });

    const playerReady = await makeReadyRuntime();
    addJoinableTable(playerReady.store);
    expect(playerReady.runtime.join(123)).toBe(true);
    playerReady.socket.emitMessage(createdPregameFrame(['Ada'], 123));
    playerReady.socket.emitMessage('joined {"tableID":123}');
    expect(playerReady.runtime.switchToSpectator()).toBe(false);
  });

  test('create validates v1 input, sends the exact frame once, and is not optimistic', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();

    expect(runtime.createTable(' ', 5, 'No Variant')).toBe(false);
    expect(runtime.createTable('Table', 1, 'No Variant')).toBe(false);
    expect(runtime.createTable('Table', 5, 'Clue Starved')).toBe(false);
    expect(runtime.createTable('  Mobile table  ', 5, 'No Variant')).toBe(true);
    expect(runtime.createTable('Other', 4, '6 Suits')).toBe(false);

    expect(socket.sent).toEqual([
      'tableCreate {"name":"Mobile table","options":{'
      + '"variantName":"No Variant","timed":false,"timeBase":0,"timePerTurn":0,'
      + '"speedrun":false,"cardCycle":false,"deckPlays":false,"emptyClues":false,'
      + '"oneExtraCard":false,"oneLessCard":false,"allOrNothing":false,'
      + '"detrimentalCharacters":false},"password":"","maxPlayers":5}',
    ]);
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().room.pendingCreate).toMatchObject({
      name: 'Mobile table',
      creatorUserID: 1,
      joinedTableID: null,
      stagedGame: null,
    });
  });

  test('owner edit preserves unavailable and additive options until authoritative game echo', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    runtime.createTable('Mobile table', 5, 'No Variant');
    const existingOptions = {
      ...tableOptions, timed: true, timeBase: 90, timePerTurn: 15,
      speedrun: true, deckPlays: true, detrimentalCharacters: true,
      futureOption: 'keep',
    };
    socket.emitMessage(createdPregameFrame(['Ada', 'Bob'], 321, 'Mobile table', existingOptions));
    socket.emitMessage('joined {"tableID":321}');

    expect(runtime.updateTable('Changed', 4, {
      variantName: '6 Suits', timed: true, timeBase: 90, timePerTurn: 15,
      cardCycle: true, emptyClues: true,
      oneExtraCard: true, oneLessCard: false, allOrNothing: true,
    })).toBe(true);
    expect(store.getState().room.room).toMatchObject({
      data: { name: 'Mobile table', options: { variantName: 'No Variant' } },
    });
    const updateFrame = socket.sent.at(-1);
    expect(updateFrame?.startsWith('tableUpdate ')).toBe(true);
    const updatePayload = JSON.parse(updateFrame!.slice(updateFrame!.indexOf(' ') + 1));
    expect(updatePayload).toMatchObject({
      tableID: 321, name: 'Changed', maxPlayers: 4,
      options: {
        variantName: '6 Suits', timed: true, speedrun: true, deckPlays: true,
        detrimentalCharacters: true, futureOption: 'keep', cardCycle: true,
      },
    });
    expect(store.getState().room.pendingUpdate).toMatchObject({ tableID: 321, name: 'Changed' });

    socket.emitMessage(createdPregameFrame(['Ada', 'Bob'], 321, 'Changed', {
      ...existingOptions, variantName: '6 Suits', cardCycle: true, emptyClues: true,
      oneExtraCard: true, oneLessCard: false, allOrNothing: true,
    }, 4));
    expect(store.getState().room.pendingUpdate).toBeNull();
    expect(store.getState().room.room).toMatchObject({ data: { name: 'Changed' } });
  });

  test('a non-owner pregame attendee sends a proposal without local update state', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage(pregameFrame());
    socket.emitMessage('joined {"tableID":123}');
    const before = store.getState().room.room;
    const changes = {
      variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
      cardCycle: true, emptyClues: false, oneExtraCard: false, oneLessCard: false,
      allOrNothing: false,
    };

    expect(runtime.updateTable('Suggested', 4, changes)).toBe(true);
    expect(socket.sent.at(-1)).toBe(
      'tableUpdate {"tableID":123,"name":"Suggested","options":{'
      + '"variantName":"No Variant","timed":false,"timeBase":0,"timePerTurn":0,'
      + '"speedrun":false,"cardCycle":true,"deckPlays":false,"emptyClues":false,'
      + '"oneExtraCard":false,"oneLessCard":false,"allOrNothing":false,'
      + '"detrimentalCharacters":false},"maxPlayers":4}',
    );
    expect(store.getState().room.pendingUpdate).toBeNull();
    expect(store.getState().room.room).toEqual(before);
  });

  test('owner leader transfer waits for the authoritative reordered game snapshot', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    runtime.createTable('Mobile table', 5, 'No Variant');
    socket.emitMessage(createdPregameFrame(['Ada', 'Bob']));
    socket.emitMessage('joined {"tableID":321}');

    expect(runtime.setTableLeader('Bob')).toBe(true);
    expect(runtime.setTableLeader('Bob')).toBe(false);
    expect(socket.sent.at(-1)).toBe('tableSetLeader {"tableID":321,"name":"Bob"}');
    expect(store.getState().room.room).toMatchObject({ data: { owner: 1 } });
    socket.emitMessage(pregameFrame(321, 'Mobile table'));
    expect(store.getState().room.pendingLeaderName).toBeNull();
    expect(store.getState().room.room).toMatchObject({
      data: { owner: 2, players: [{ name: 'Bob' }, { name: 'Ada' }] },
    });
  });

  test('non-owner player can take pregame leadership, but a spectator cannot', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage(pregameFrame());
    socket.emitMessage('joined {"tableID":123}');

    expect(runtime.setTableLeader('Ada')).toBe(true);
    expect(socket.sent.at(-1)).toBe('tableSetLeader {"tableID":123,"name":"Ada"}');
    expect(store.getState().room.pendingLeaderName).toBe('Ada');
    expect(runtime.setTableLeader('Bob')).toBe(false);

    socket.emitMessage(pregameFrame());
    expect(store.getState().room.pendingLeaderName).toBe('Ada');
    socket.emitMessage(createdPregameFrame(['Ada', 'Bob'], 123, 'Pregame table'));
    expect(store.getState().room.pendingLeaderName).toBeNull();

    const spectator = await makeReadyRuntime();
    addJoinableTable(spectator.store);
    expect(spectator.runtime.spectate(123)).toBe(true);
    spectator.socket.emitMessage(pregameFrame().replace('"you":true', '"you":false'));
    spectator.socket.emitMessage('joined {"tableID":123}');
    expect(spectator.runtime.setTableLeader('Ada')).toBe(false);
  });

  test.each(['game-first', 'joined-first'] as const)(
    'create enters pregame only after matching authoritative game + joined (%s)',
    async (order) => {
      const { runtime, socket, store } = await makeReadyRuntime();
      expect(runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);

      if (order === 'game-first') {
        socket.emitMessage(createdPregameFrame());
        expect(store.getState().room.room).toEqual({ kind: 'none' });
        socket.emitMessage('joined {"tableID":321}');
      } else {
        socket.emitMessage('joined {"tableID":321}');
        expect(store.getState().room.room).toEqual({ kind: 'none' });
        socket.emitMessage(createdPregameFrame());
      }

      expect(store.getState().room.pendingCreate).toBeNull();
      expect(store.getState().room.room).toMatchObject({
        kind: 'pregame',
        tableID: 321,
        role: 'player',
        data: { name: 'Mobile table', owner: 1 },
      });
    },
  );

  test('mismatched create traffic cannot establish attendance', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    expect(runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);

    socket.emitMessage(createdPregameFrame(['Ada'], 321, 'Other table'));
    socket.emitMessage(pregameFrame(321, 'Mobile table'));
    socket.emitMessage('joined {"tableID":999}');

    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().room.pendingCreate).toMatchObject({
      name: 'Mobile table',
      creatorUserID: 1,
      joinedTableID: 999,
      stagedGame: null,
    });
  });

  test('owner start sends authoritative intendedPlayers once and reuses bootstrap', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    expect(runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
    socket.emitMessage(createdPregameFrame(['Ada', 'Bob']));
    socket.emitMessage('joined {"tableID":321}');

    expect(runtime.startGame()).toBe(true);
    expect(runtime.startGame()).toBe(false);
    expect(socket.sent.at(-1)).toBe(
      'tableStart {"tableID":321,"intendedPlayers":["Ada","Bob"]}',
    );
    expect(store.getState().room.pendingStart).toEqual({
      tableID: 321,
      intendedPlayers: ['Ada', 'Bob'],
    });

    socket.emitMessage('tableStart {"tableID":321,"replay":false}');
    expect(store.getState().room.room).toMatchObject({
      kind: 'awaiting_game_bootstrap',
      tableID: 321,
      role: 'player',
      bootstrap: { phase: 'waiting_init' },
    });
    expect(store.getState().room.pendingStart).toBeNull();
    expect(socket.sent.slice(-2)).toEqual([
      'tableStart {"tableID":321,"intendedPlayers":["Ada","Bob"]}',
      'getGameInfo1 {"tableID":321}',
    ]);
  });

  test('non-owner and fewer-than-two-player pregames cannot start', async () => {
    const nonOwner = await makeReadyRuntime();
    addJoinableTable(nonOwner.store);
    expect(nonOwner.runtime.join(123)).toBe(true);
    nonOwner.socket.emitMessage(pregameFrame());
    nonOwner.socket.emitMessage('joined {"tableID":123}');
    const nonOwnerFrames = [...nonOwner.socket.sent];
    expect(nonOwner.runtime.startGame()).toBe(false);
    expect(nonOwner.socket.sent).toEqual(nonOwnerFrames);

    const soloOwner = await makeReadyRuntime();
    expect(soloOwner.runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
    soloOwner.socket.emitMessage(createdPregameFrame());
    soloOwner.socket.emitMessage('joined {"tableID":321}');
    const soloFrames = [...soloOwner.socket.sent];
    expect(soloOwner.runtime.startGame()).toBe(false);
    expect(soloOwner.socket.sent).toEqual(soloFrames);
  });

  test('authoritative player-list change releases pending start and permits retry', async () => {
    const { runtime, socket, store } = await makeReadyRuntime();
    expect(runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
    socket.emitMessage(createdPregameFrame(['Ada', 'Bob']));
    socket.emitMessage('joined {"tableID":321}');
    expect(runtime.startGame()).toBe(true);

    socket.emitMessage(createdPregameFrame(['Ada', 'Bob']));
    expect(store.getState().room.pendingStart).not.toBeNull();
    expect(runtime.startGame()).toBe(false);
    socket.emitMessage(createdPregameFrame(['Ada', 'Cy']));
    expect(store.getState().room.pendingStart).toBeNull();
    expect(runtime.startGame()).toBe(true);
    expect(socket.sent.slice(-2)).toEqual([
      'tableStart {"tableID":321,"intendedPlayers":["Ada","Bob"]}',
      'tableStart {"tableID":321,"intendedPlayers":["Ada","Cy"]}',
    ]);
  });

  test.each(['warning', 'error'] as const)(
    '%s clears create and start pending state',
    async (command) => {
      const create = await makeReadyRuntime();
      expect(create.runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
      create.socket.emitMessage(`${command} {"${command}":"rejected"}`);
      expect(create.store.getState().room.pendingCreate).toBeNull();

      const start = await makeReadyRuntime();
      expect(start.runtime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
      start.socket.emitMessage(createdPregameFrame(['Ada', 'Bob']));
      start.socket.emitMessage('joined {"tableID":321}');
      expect(start.runtime.startGame()).toBe(true);
      start.socket.emitMessage(`${command} {"${command}":"rejected"}`);
      expect(start.store.getState().room.pendingStart).toBeNull();
    },
  );

  test('connection replacement clears create/start intent and never replays either command', async () => {
    const createSession = new FakeSession();
    const createFirst = new FakeSocket();
    const createSecond = new FakeSocket();
    createSession.sockets.push(Promise.resolve(createFirst), Promise.resolve(createSecond));
    const createStore = createAppStore();
    const createRuntime = new LobbyRuntime(createSession, createStore);
    await createRuntime.connect();
    createFirst.emitOpen();
    createFirst.emitMessage(welcomeFrame);
    expect(createRuntime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
    createRuntime.disconnect();
    await createRuntime.connect();
    expect(createStore.getState().room.pendingCreate).toBeNull();
    createSecond.emitOpen();
    createSecond.emitMessage(welcomeFrame);
    expect(createSecond.sent).toEqual([]);

    const startSession = new FakeSession();
    const startFirst = new FakeSocket();
    const startSecond = new FakeSocket();
    startSession.sockets.push(Promise.resolve(startFirst), Promise.resolve(startSecond));
    const startStore = createAppStore();
    const startRuntime = new LobbyRuntime(startSession, startStore);
    await startRuntime.connect();
    startFirst.emitOpen();
    startFirst.emitMessage(welcomeFrame);
    expect(startRuntime.createTable('Mobile table', 5, 'No Variant')).toBe(true);
    startFirst.emitMessage(createdPregameFrame(['Ada', 'Bob']));
    startFirst.emitMessage('joined {"tableID":321}');
    expect(startRuntime.startGame()).toBe(true);
    startFirst.emitClose();
    expect(startStore.getState().room.pendingStart).toBeNull();
    jest.advanceTimersByTime(1_000);
    await Promise.resolve();
    startSecond.emitOpen();
    startSecond.emitMessage(welcomeFrame);
    expect(startSecond.sent).toEqual([]);
  });

  test('pinned game-before-joined ordering stages data until join confirmation', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);

    socket.emitMessage(pregameFrame());
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().room.pendingJoin?.stagedGame?.tableID).toBe(123);

    socket.emitMessage('joined {"tableID":123}');
    expect(store.getState().room.pendingJoin).toBeNull();
    expect(store.getState().room.room).toMatchObject({
      kind: 'pregame',
      tableID: 123,
      role: 'player',
      data: { name: 'Pregame table', options: { variantName: 'No Variant' } },
    });
    expect(socket.sent).toEqual(['tableJoin {"tableID":123}']);
  });

  test('joined-before-game ordering waits for authoritative pregame data', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);

    socket.emitMessage('joined {"tableID":123}');
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().room.pendingJoin?.joinedConfirmed).toBe(true);

    socket.emitMessage(pregameFrame());
    expect(store.getState().room.room).toMatchObject({
      kind: 'pregame',
      tableID: 123,
      data: { players: [{ name: 'Bob' }, { name: 'Ada' }] },
    });
  });

  test('unmatched and malformed C4-B events cannot create attendance', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);

    socket.emitMessage(pregameFrame(999, 'Other table'));
    socket.emitMessage('joined {"tableID":999}');
    socket.emitMessage('left {"TableID":123}');
    socket.emitMessage('game {"tableID":123}');
    socket.emitMessage('joined {"tableID":"123"}');
    socket.emitMessage('left {"tableID":123}');

    expect(store.getState().session.protocolIssueCount).toBe(3);
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().room.pendingJoin).toEqual({
      tableID: 123,
      role: 'player',
      joinedConfirmed: false,
      stagedGame: null,
    });
  });

  test('leave sends exactly once and returns to lobby only on matching authoritative left', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage(pregameFrame());
    socket.emitMessage('joined {"tableID":123}');

    expect(runtime.leave(123)).toBe(true);
    expect(runtime.leave(123)).toBe(false);
    expect(socket.sent).toEqual([
      'tableJoin {"tableID":123}',
      'tableLeave {"tableID":123}',
    ]);
    expect(store.getState().room.room.kind).toBe('pregame');
    socket.emitMessage('left {"TableID":999}');
    expect(store.getState().room.room.kind).toBe('pregame');
    socket.emitMessage('left {"TableID":123}');
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().room.pendingLeaveTableID).toBeNull();
  });

  test('new epoch clears pending and staged C4-B state; stale events cannot restore it', async () => {
    const session = new FakeSession();
    const first = new FakeSocket();
    const second = new FakeSocket();
    session.sockets.push(Promise.resolve(first), Promise.resolve(second));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    first.emitOpen();
    first.emitMessage(welcomeFrame);
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    first.emitMessage(pregameFrame());
    expect(store.getState().room.pendingJoin?.stagedGame).not.toBeNull();
    const staleMessages = first.snapshotMessageListeners();

    runtime.disconnect();
    await runtime.connect();
    for (const listener of staleMessages) {
      listener({ data: 'joined {"tableID":123}' } as WebSocketMessageEvent);
      listener({ data: pregameFrame() } as WebSocketMessageEvent);
      listener({ data: 'left {"TableID":123}' } as WebSocketMessageEvent);
    }

    expect(store.getState().room).toEqual({
      connectionEpoch: 2,
      pendingSpectateTableID: null,
      pendingRecovery: null,
      recoveryJoinedConfirmed: false,
      recoveryStagedGame: null,
      pendingJoin: null,
      pendingCreate: null,
      pendingRoleSwitch: null,
      pendingLeaveTableID: null,
      pendingUnattendTableID: null,
      pendingUpdate: null,
      pendingLeaderName: null,
      pendingRestartTableID: null,
      pendingRestartHidePregame: null,
      rematchTransition: null,
      pendingStart: null,
      pendingGameplayAction: null,
      pendingHypotheticalOperation: null,
      room: { kind: 'none' },
    });
    second.emitOpen();
    second.emitMessage(welcomeFrame);
    expect(second.sent).toEqual([]);
  });

  test('new epoch clears an authoritative pregame room and pending leave intent', async () => {
    const session = new FakeSession();
    const first = new FakeSocket();
    const second = new FakeSocket();
    session.sockets.push(Promise.resolve(first), Promise.resolve(second));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    first.emitOpen();
    first.emitMessage(welcomeFrame);
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    first.emitMessage(pregameFrame());
    first.emitMessage('joined {"tableID":123}');
    expect(runtime.leave(123)).toBe(true);
    expect(store.getState().room.room.kind).toBe('pregame');
    expect(store.getState().room.pendingLeaveTableID).toBe(123);

    runtime.disconnect();
    await runtime.connect();

    expect(store.getState().room).toEqual({
      connectionEpoch: 2,
      pendingSpectateTableID: null,
      pendingRecovery: null,
      recoveryJoinedConfirmed: false,
      recoveryStagedGame: null,
      pendingJoin: null,
      pendingCreate: null,
      pendingRoleSwitch: null,
      pendingLeaveTableID: null,
      pendingUnattendTableID: null,
      pendingUpdate: null,
      pendingLeaderName: null,
      pendingRestartTableID: null,
      pendingRestartHidePregame: null,
      rematchTransition: null,
      pendingStart: null,
      pendingGameplayAction: null,
      pendingHypotheticalOperation: null,
      room: { kind: 'none' },
    });
    second.emitOpen();
    second.emitMessage(welcomeFrame);
    expect(second.sent).toEqual([]);
  });

  test('same-table tableStart overrides a pending join and late pregame events cannot restore it', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage(pregameFrame());

    socket.emitMessage('tableStart {"tableID":123,"replay":false}');
    socket.emitMessage('joined {"tableID":123}');
    socket.emitMessage(pregameFrame(123, 'Late game'));

    expect(store.getState().room.room).toEqual({
      kind: 'awaiting_game_bootstrap',
      tableID: 123,
      role: 'player',
      replay: false,
      expectedDatabaseID: null,
      tableStartReceived: true,
      bootstrap: {
        gameLoadEpoch: 1,
        phase: 'waiting_init',
        historyActionCount: 0,
      },
    });
    expect(store.getState().room.pendingJoin).toBeNull();
    expect(socket.sent).toEqual([
      'tableJoin {"tableID":123}',
      'getGameInfo1 {"tableID":123}',
    ]);
  });

  test('same-table tableStart overrides an established pregame room', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage(pregameFrame());
    socket.emitMessage('joined {"tableID":123}');
    expect(store.getState().room.room.kind).toBe('pregame');

    socket.emitMessage('tableStart {"tableID":123,"replay":false}');

    expect(store.getState().room.room).toMatchObject({
      kind: 'awaiting_game_bootstrap',
      tableID: 123,
      role: 'player',
      replay: false,
      expectedDatabaseID: null,
      bootstrap: {
        gameLoadEpoch: 1,
        phase: 'waiting_init',
        historyActionCount: 0,
      },
    });
    expect(socket.sent).toEqual([
      'tableJoin {"tableID":123}',
      'getGameInfo1 {"tableID":123}',
    ]);
  });

  test('same-table tableStart overrides pregame and a pending leave, then starts C5 once', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    addJoinableTable(store);
    expect(runtime.join(123)).toBe(true);
    socket.emitMessage('joined {"tableID":123}');
    socket.emitMessage(pregameFrame());
    expect(store.getState().room.room.kind).toBe('pregame');
    expect(runtime.leave(123)).toBe(true);

    socket.emitMessage('tableStart {"tableID":123,"replay":false}');
    socket.emitMessage('left {"TableID":123}');
    socket.emitMessage('joined {"tableID":123}');
    socket.emitMessage(pregameFrame(123, 'Late game'));

    expect(store.getState().room.room).toEqual({
      kind: 'awaiting_game_bootstrap',
      tableID: 123,
      role: 'player',
      replay: false,
      expectedDatabaseID: null,
      tableStartReceived: true,
      bootstrap: {
        gameLoadEpoch: 1,
        phase: 'waiting_init',
        historyActionCount: 0,
      },
    });
    expect(store.getState().room.pendingLeaveTableID).toBeNull();
    expect(socket.sent).toEqual([
      'tableJoin {"tableID":123}',
      'tableLeave {"tableID":123}',
      'getGameInfo1 {"tableID":123}',
    ]);
  });

  test('a malformed known event reports an issue without mutating lobby state', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage('user {"userID":1}');
    expect(store.getState().session.protocolIssueCount).toBe(1);
    expect(userSelectors.selectTotal(store.getState())).toBe(0);
  });

  test('records bounded sanitized known, unknown, and malformed inbound diagnostics', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    socket.emitMessage('clock {"tableID":123,"times":[1000,1000]}');
    socket.emitMessage('gameAction {"tableID":123}');

    expect(store.getState().session.inboundDiagnostics).toEqual([
      { command: 'welcome', classification: 'known' },
      { command: 'clock', classification: 'malformed' },
      { command: 'gameAction', classification: 'malformed' },
    ]);
    expect(store.getState().session.protocolIssueCount).toBe(2);
    expect(store.getState().session.gameActionFramesSeen).toBe(1);
    expect(store.getState().session.gameActionDiagnostics).toEqual([]);

    for (let index = 0; index < 12; index += 1) {
      socket.emitMessage(`unknownDiagnostic${index} {}`);
    }
    const diagnostics = store.getState().session.inboundDiagnostics;
    expect(diagnostics).toHaveLength(10);
    expect(diagnostics[0]).toEqual({
      command: 'unknownDiagnostic2',
      classification: 'unknown',
    });
    expect(diagnostics[9]).toEqual({
      command: 'unknownDiagnostic11',
      classification: 'unknown',
    });
  });

  test('records a sanitized gameAction coordinator rejection reason', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);

    socket.emitMessage(
      'gameAction {"tableID":123,"action":{"type":"turn","num":1,"currentPlayerIndex":1}}',
    );

    expect(store.getState().session.inboundDiagnostics.at(-1)).toEqual({
      command: 'gameAction',
      classification: 'known',
      gameAction: {
        tableID: 123,
        actionType: 'turn',
        accepted: false,
        rejectionReason: 'wrong-room-table',
      },
    });
    expect(store.getState().session.gameActionFramesSeen).toBe(1);
    expect(store.getState().session.gameActionDiagnostics).toEqual([{
      tableID: 123,
      actionType: 'turn',
      accepted: false,
      rejectionReason: 'wrong-room-table',
    }]);
  });

  test('heavy lobby traffic cannot evict bounded current-connection gameAction diagnostics', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);

    for (let actionIndex = 0; actionIndex < 12; actionIndex += 1) {
      socket.emitMessage(
        `gameAction {"tableID":${200 + actionIndex},`
        + `"action":{"type":"turn","num":${actionIndex},"currentPlayerIndex":1}}`,
      );
      for (let lobbyIndex = 0; lobbyIndex < 20; lobbyIndex += 1) {
        socket.emitMessage(userFrame);
        socket.emitMessage(`tableGone {"tableID":${1000 + lobbyIndex}}`);
      }
    }

    const state = store.getState().session;
    expect(state.gameActionFramesSeen).toBe(12);
    expect(state.gameActionDiagnostics).toHaveLength(10);
    expect(state.gameActionDiagnostics.map((diagnostic) => diagnostic.tableID)).toEqual(
      Array.from({ length: 10 }, (_, index) => 202 + index),
    );
    expect(state.gameActionDiagnostics.every((diagnostic) => (
      diagnostic.actionType === 'turn'
      && !diagnostic.accepted
      && diagnostic.rejectionReason === 'wrong-room-table'
    ))).toBe(true);
    expect(state.inboundDiagnostics.every((diagnostic) => (
      diagnostic.command !== 'gameAction'
    ))).toBe(true);
  });

  test('new connection clears prior inbound diagnostics and stale frames cannot restore them', async () => {
    const session = new FakeSession();
    const first = new FakeSocket();
    const second = new FakeSocket();
    session.sockets.push(Promise.resolve(first), Promise.resolve(second));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    first.emitOpen();
    first.emitMessage(welcomeFrame);
    first.emitMessage('clock {}');
    const staleMessages = first.snapshotMessageListeners();
    expect(store.getState().session.inboundDiagnostics).toHaveLength(2);

    first.emitMessage(
      'gameAction {"tableID":123,"action":{"type":"turn","num":1,"currentPlayerIndex":1}}',
    );
    expect(store.getState().session.gameActionFramesSeen).toBe(1);

    runtime.disconnect();
    await runtime.connect();
    expect(store.getState().session.inboundDiagnostics).toEqual([]);
    expect(store.getState().session.gameActionFramesSeen).toBe(0);
    expect(store.getState().session.gameActionDiagnostics).toEqual([]);
    for (const listener of staleMessages) {
      listener({ data: 'lateUnknown {}' } as WebSocketMessageEvent);
      listener({
        data: 'gameAction {"tableID":123,"action":{"type":"turn","num":2,"currentPlayerIndex":0}}',
      } as WebSocketMessageEvent);
    }
    expect(store.getState().session.inboundDiagnostics).toEqual([]);
    expect(store.getState().session.gameActionFramesSeen).toBe(0);
    expect(store.getState().session.gameActionDiagnostics).toEqual([]);
    second.emitOpen();
    second.emitMessage(welcomeFrame);
    expect(store.getState().session.inboundDiagnostics).toEqual([
      { command: 'welcome', classification: 'known' },
    ]);
  });

  test('matching spectator LIVE gameAction reduces state without sending an outbound frame', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(welcomeFrame);
    addRunningTable(store);
    expect(runtime.spectate(123)).toBe(true);
    socket.emitMessage('tableStart {"tableID":123,"replay":false}');
    socket.emitMessage(`init ${JSON.stringify(makeInit({ spectating: true }))}`);
    const history = {
      tableID: 123,
      list: [
        ...Array.from({ length: 5 }, (_, order) => ({
          type: 'draw', playerIndex: 0, order, suitIndex: -1, rank: -1,
        })),
        ...Array.from({ length: 5 }, (_, index) => ({
          type: 'draw', playerIndex: 1, order: index + 5, suitIndex: index, rank: index + 1,
        })),
        { type: 'status', clues: 8, score: 0, maxScore: 25 },
        { type: 'turn', num: 0, currentPlayerIndex: 0 },
      ],
    };
    socket.emitMessage(`gameActionList ${JSON.stringify(history)}`);
    const sentBeforeLiveAction = [...socket.sent];

    socket.emitMessage('gameAction {"tableID":123,"action":{"type":"draw","playerIndex":0,"order":10,"suitIndex":-1,"rank":-1}}');

    const room = store.getState().room.room;
    expect(room).toMatchObject({
      kind: 'live_game', role: 'spectator', liveActionCount: 1,
      clientState: { ongoingGame: { cardsRemainingInTheDeck: 39 } },
    });
    if (room.kind !== 'live_game') throw new Error('Expected LIVE');
    expect(room.clientState.ongoingGame.hands[0]).toEqual([0, 1, 2, 3, 4, 10]);
    expect(socket.sent).toEqual(sentBeforeLiveAction);
    expect(store.getState().session.inboundDiagnostics.at(-1)).toEqual({
      command: 'gameAction',
      classification: 'known',
      gameAction: {
        tableID: 123,
        actionType: 'draw',
        accepted: true,
        rejectionReason: null,
      },
    });
    expect(store.getState().session.gameActionFramesSeen).toBe(1);
    expect(store.getState().session.gameActionDiagnostics).toEqual([{
      tableID: 123,
      actionType: 'draw',
      accepted: true,
      rejectionReason: null,
    }]);
  });

  test('automatic history page is not requested twice and Load More is exact and one-shot', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage('welcome {"userID":1,"username":"Ada","totalGames":20,"playingAtTables":[]}');
    expect(socket.sent).toEqual([]);
    socket.emitMessage(`gameHistory ${JSON.stringify(
      Array.from({ length: 10 }, (_, i) => historicalGame(20 - i)),
    )}`);
    expect(runtime.loadMoreHistory()).toBe(true);
    expect(runtime.loadMoreHistory()).toBe(false);
    expect(socket.sent).toEqual(['historyGet {"offset":10,"amount":10}']);
    socket.emitMessage(`gameHistory ${JSON.stringify(
      Array.from({ length: 10 }, (_, i) => historicalGame(10 - i)),
    )}`);
    expect(store.getState().history.items).toHaveLength(20);
    expect(store.getState().history.hasMore).toBe(false);
  });

  test('history and replay send failures leave no fake pending state', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    store.dispatch(sessionActions.welcomeReceived({
      epoch: 1,
      welcome: { userID: 1, username: 'Ada', totalGames: 11, playingAtTables: [] },
    }));
    socket.emitMessage(`gameHistory ${JSON.stringify(
      Array.from({ length: 10 }, (_, i) => historicalGame(11 - i)),
    )}`);
    socket.failSend = true;
    expect(runtime.loadMoreHistory()).toBe(false);
    expect(runtime.watchHistoricalGame(11)).toBe(false);
    expect(store.getState().history.pendingRequest).toBeNull();
    expect(store.getState().history.pendingReplayCreate).toBeNull();
  });

  test('historical Watch waits for a new authoritative replay table and bootstraps solo', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    store.dispatch(sessionActions.welcomeReceived({
      epoch: 1,
      welcome: { userID: 1, username: 'Ada', totalGames: 1, playingAtTables: [] },
    }));
    socket.emitMessage(`gameHistory ${JSON.stringify([historicalGame(77)])}`);
    expect(runtime.watchHistoricalGame(999)).toBe(false);
    expect(runtime.watchHistoricalGame(77)).toBe(true);
    expect(socket.sent).toEqual([
      'replayCreate {"source":"id","databaseID":77,"visibility":"solo"}',
    ]);
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().history.pendingReplayCreate).toMatchObject({ databaseID: 77 });

    socket.emitMessage('tableStart {"tableID":9001,"replay":true}');
    expect(store.getState().room.room).toMatchObject({
      kind: 'awaiting_game_bootstrap', tableID: 9001, role: 'spectator',
      replay: true, expectedDatabaseID: 77,
    });
    expect(store.getState().history.pendingReplayCreate).toBeNull();
    socket.emitMessage(`init ${JSON.stringify(makeInit({
      tableID: 9001, replay: true, sharedReplay: false, spectating: false,
      databaseID: 77, datetimeFinished: '2026-09-01T00:10:00Z',
    }))}`);
    socket.emitMessage(`gameActionList ${JSON.stringify({ tableID: 9001, list: [] })}`);
    expect(socket.sent).toEqual([
      'replayCreate {"source":"id","databaseID":77,"visibility":"solo"}',
      'getGameInfo1 {"tableID":9001}',
      'getGameInfo2 {"tableID":9001}',
    ]);
    expect(store.getState().room.room).toMatchObject({
      kind: 'live_game', tableID: 9001, role: 'spectator', sharedReplay: false,
      clientState: { replay: { active: true, shared: null } },
    });
    expect(runtime.unattendLiveGame(9001)).toBe(true);
    expect(socket.sent.at(-1)).toBe('tableUnattend {"tableID":9001}');
  });

  test('Watch rejects unsupported or conflicting history and mismatched init fails closed', async () => {
    const { socket, store, runtime } = await makeReadyRuntime();
    store.dispatch(sessionActions.welcomeReceived({
      epoch: 1,
      welcome: { userID: 1, username: 'Ada', totalGames: 2, playingAtTables: [] },
    }));
    socket.emitMessage(`gameHistory ${JSON.stringify([
      historicalGame(80, { speedrun: true }), historicalGame(79),
    ])}`);
    expect(runtime.watchHistoricalGame(80)).toBe(false);
    store.dispatch(roomActions.spectateRequested({ epoch: 1, tableID: 123 }));
    expect(runtime.watchHistoricalGame(79)).toBe(false);
    store.dispatch(roomActions.commandPendingCleared({ epoch: 1 }));
    expect(runtime.watchHistoricalGame(79)).toBe(true);
    socket.emitMessage('tableStart {"tableID":9002,"replay":true}');
    socket.emitMessage(`init ${JSON.stringify(makeInit({
      tableID: 9002, replay: true, sharedReplay: false, spectating: false,
      databaseID: 999,
    }))}`);
    expect(socket.sent.at(-1)).toBe('tableUnattend {"tableID":9002}');
    expect(store.getState().room.room).toEqual({ kind: 'none' });
    expect(store.getState().lobby.notice?.kind).toBe('warning');
  });
});
