import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type {
  NetworkSession,
  NetworkSocket,
  SessionCheckResult,
} from '../network/types';
import type { LobbyTable } from '../protocol/lobbyProtocol';
import { lobbyActions } from '../store/lobbySlice';
import { createAppStore, userSelectors } from '../store/store';
import { isSpectateEligible, LobbyRuntime } from './LobbyRuntime';

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

function addRunningTable(store: ReturnType<typeof createAppStore>, epoch = 1): void {
  store.dispatch(lobbyActions.tableReceived({ epoch, table: runningTable }));
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
      room: {
        kind: 'awaiting_game_bootstrap',
        tableID: 123,
        role: 'spectator',
        tableStartReceived: true,
        bootstrap: 'pending_c5',
      },
    });
    expect(socket.sent).toHaveLength(1);
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
});
