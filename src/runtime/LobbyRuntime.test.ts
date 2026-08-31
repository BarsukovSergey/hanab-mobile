import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type {
  NetworkSession,
  NetworkSocket,
  SessionCheckResult,
} from '../network/types';
import type { LobbyTable } from '../protocol/lobbyProtocol';
import { makeInit } from '../protocol/gameProtocol.fixtures';
import { lobbyActions } from '../store/lobbySlice';
import { createAppStore, userSelectors } from '../store/store';
import { isJoinEligible, isSpectateEligible, LobbyRuntime } from './LobbyRuntime';

type ListenerMap = {
  open: Set<() => void>;
  message: Set<(event: WebSocketMessageEvent) => void>;
  error: Set<() => void>;
  close: Set<(event: WebSocketCloseEvent) => void>;
};

class FakeSocket implements NetworkSocket {
  readyState = 0;
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

  send(data: string): void { this.sent.push(data); }
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
  checkSession(): Promise<SessionCheckResult> { return Promise.resolve({ kind: 'valid' }); }
  submitLogin(): Promise<void> { return Promise.resolve(); }
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

const welcomeFrame = 'welcome {"userID":1,"username":"Ada","playingAtTables":[]}';
const userFrame = 'user {"userID":1,"name":"Ada","status":0,"hyphenated":false,"inactive":false}';
const runningTable: LobbyTable = {
  id: 123,
  name: 'Running table',
  numPlayers: 3,
  maxPlayers: 5,
  running: true,
  variant: 'No Variant',
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
  + '"options":{"variantName":"No Variant"},"passwordProtected":false,"maxPlayers":5}'
);

function addRunningTable(store: ReturnType<typeof createAppStore>, epoch = 1): void {
  store.dispatch(lobbyActions.tableReceived({ epoch, table: runningTable }));
}

function addJoinableTable(store: ReturnType<typeof createAppStore>, epoch = 1): void {
  store.dispatch(lobbyActions.tableReceived({ epoch, table: joinableTable }));
}

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('deterministic lobby runtime', () => {
  test('only running non-replay non-joined tables are spectate eligible', () => {
    expect(isSpectateEligible(runningTable)).toBe(true);
    expect(isSpectateEligible({ ...runningTable, running: false })).toBe(false);
    expect(isSpectateEligible({ ...runningTable, sharedReplay: true })).toBe(false);
    expect(isSpectateEligible({ ...runningTable, joined: true })).toBe(false);
  });

  test('only open unprotected non-replay non-joined tables with a seat are join eligible', () => {
    expect(isJoinEligible(joinableTable)).toBe(true);
    expect(isJoinEligible({ ...joinableTable, running: true })).toBe(false);
    expect(isJoinEligible({ ...joinableTable, sharedReplay: true })).toBe(false);
    expect(isJoinEligible({ ...joinableTable, joined: true })).toBe(false);
    expect(isJoinEligible({ ...joinableTable, passwordProtected: true })).toBe(false);
    expect(isJoinEligible({ ...joinableTable, numPlayers: 5 })).toBe(false);
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
      'welcome {"userID":1,"username":"Ada","playingAtTables":[123],'
      + '"disconSpectatingTable":999,"disconShadowingSeat":2}',
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

  test('spectator welcome resumes with the server-provided shadowing seat', async () => {
    const session = new FakeSession();
    const socket = new FakeSocket();
    session.sockets.push(Promise.resolve(socket));
    const store = createAppStore();
    const runtime = new LobbyRuntime(session, store);
    await runtime.connect();
    socket.emitOpen();
    socket.emitMessage(
      'welcome {"userID":1,"username":"Ada","playingAtTables":[],'
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

  test('foreground reconnects immediately without waiting for backoff', async () => {
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
    expect(first.closeCalls).toHaveLength(1);
    expect(store.getState().room.room).toEqual({ kind: 'none' });
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
      pendingJoin: null,
      pendingLeaveTableID: null,
      pendingGameplayAction: null,
      room: {
        kind: 'awaiting_game_bootstrap',
        tableID: 123,
        role: 'spectator',
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

  test('malformed, mismatched, and replay tableStart do not transition', async () => {
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
    socket.emitMessage('tableStart {"tableID":123,"replay":true}');

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
      pendingJoin: null,
      pendingLeaveTableID: null,
      pendingGameplayAction: null,
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
      joinedConfirmed: false,
      stagedGame: null,
    });
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
      pendingJoin: null,
      pendingLeaveTableID: null,
      pendingGameplayAction: null,
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
      pendingJoin: null,
      pendingLeaveTableID: null,
      pendingGameplayAction: null,
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
      { command: 'clock', classification: 'unknown' },
      { command: 'gameAction', classification: 'malformed' },
    ]);
    expect(store.getState().session.protocolIssueCount).toBe(1);
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
      game: { cardsRemainingInTheDeck: 39 },
    });
    if (room.kind !== 'live_game') throw new Error('Expected LIVE');
    expect(room.game.hands[0]).toEqual([0, 1, 2, 3, 4, 10]);
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
});
