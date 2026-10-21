import { afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';

import type { NetworkSocket } from '../network/types';
import { sessionActions } from '../store/sessionSlice';
import { createAppStore } from '../store/store';
import { ConnectionRuntime, type RuntimeTimers } from './ConnectionRuntime';

type ListenerMap = {
  open: Set<() => void>;
  message: Set<(event: WebSocketMessageEvent) => void>;
  error: Set<() => void>;
  close: Set<(event: WebSocketCloseEvent) => void>;
};

class FakeSocket implements NetworkSocket {
  readyState = 0;
  failSend = false;
  readonly sent: string[] = [];
  readonly closeCalls: Array<{ code?: number; reason?: string }> = [];
  readonly listeners: ListenerMap = {
    open: new Set(), message: new Set(), error: new Set(), close: new Set(),
  };
  onDispose: (() => void) | null = null;

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

  send(frame: string): void {
    if (this.failSend) throw new Error('send failed');
    this.sent.push(frame);
  }

  close(code?: number, reason?: string): void {
    this.closeCalls.push({ code, reason });
    this.readyState = 3;
    this.onDispose?.();
  }

  emitOpen(): void {
    this.readyState = 1;
    for (const listener of [...this.listeners.open]) listener();
  }

  emitMessage(data: unknown): void {
    for (const listener of [...this.listeners.message]) listener({ data } as WebSocketMessageEvent);
  }

  emitClose(code = 1006): void {
    this.readyState = 3;
    for (const listener of [...this.listeners.close]) listener({ code } as WebSocketCloseEvent);
  }

  emitError(): void {
    for (const listener of [...this.listeners.error]) listener();
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fixture(options: {
  initialEpoch?: number;
  timers?: RuntimeTimers;
  welcomeTimeoutMs?: number;
  retryDelaysMs?: readonly number[];
} = {}) {
  const store = createAppStore();
  const initialEpoch = options.initialEpoch ?? 0;
  if (initialEpoch > 0) store.dispatch(sessionActions.connectionStarted({ epoch: initialEpoch }));
  const sockets: Array<Promise<NetworkSocket>> = [];
  const openSocket = jest.fn<() => Promise<NetworkSocket>>(() => {
    const pending = sockets.shift();
    if (pending === undefined) throw new Error('No fake socket configured');
    return pending;
  });
  const callbacks = {
    getPhase: () => store.getState().session.phase,
    onStarted: jest.fn((epoch: number) => { store.dispatch(sessionActions.connectionStarted({ epoch })); }),
    onOpened: jest.fn((epoch: number) => { store.dispatch(sessionActions.socketOpened({ epoch })); }),
    onInvalidated: jest.fn<() => void>(),
    onClosed: jest.fn((epoch: number, error: string | null) => {
      store.dispatch(sessionActions.connectionClosed({ epoch, error }));
    }),
    onFailed: jest.fn((epoch: number, error: string) => {
      store.dispatch(sessionActions.connectionFailed({ epoch, error }));
    }),
    onFrame: jest.fn<(epoch: number, rawFrame: string) => void>(),
    onAppActiveChanged: jest.fn<(active: boolean) => void>(),
  };
  const runtime = new ConnectionRuntime(
    { openSocket }, callbacks, initialEpoch, options.timers,
    options.welcomeTimeoutMs, options.retryDelaysMs,
  );
  function welcome(epoch = store.getState().session.connectionEpoch): void {
    expect(runtime.confirmWelcome(epoch)).toBe(true);
    store.dispatch(sessionActions.welcomeReceived({
      epoch, welcome: { userID: 1, username: 'Ada', totalGames: 0, playingAtTables: [] },
    }));
  }
  return { runtime, store, sockets, openSocket, callbacks, welcome };
}

function expectNoListeners(socket: FakeSocket): void {
  expect(Object.values(socket.listeners).map((listeners) => listeners.size)).toEqual([0, 0, 0, 0]);
}

describe('ConnectionRuntime transport ownership', () => {
  beforeEach(() => { jest.useFakeTimers(); });
  afterEach(() => { jest.clearAllTimers(); jest.useRealTimers(); });

  test('connect is single-flight while opening, awaiting welcome, and READY', async () => {
    const { runtime, sockets, openSocket, callbacks, welcome } = fixture();
    const pending = deferred<NetworkSocket>();
    const socket = new FakeSocket();
    sockets.push(pending.promise);
    const opening = runtime.connect();
    expect(runtime.connect()).toBe(opening);
    expect(openSocket).toHaveBeenCalledTimes(1);
    pending.resolve(socket);
    await opening;
    await runtime.connect();
    socket.emitOpen();
    await runtime.connect();
    welcome();
    await runtime.connect();
    expect(openSocket).toHaveBeenCalledTimes(1);
    expect(callbacks.onStarted).toHaveBeenCalledTimes(1);
  });

  test('OPEN is not READY; acknowledgement cancels the welcome watchdog', async () => {
    const { runtime, sockets, callbacks, welcome } = fixture({ welcomeTimeoutMs: 500 });
    const socket = new FakeSocket();
    socket.readyState = 1;
    sockets.push(Promise.resolve(socket));
    await runtime.connect();
    expect(callbacks.onOpened).toHaveBeenCalledWith(1);
    expect(runtime.isReady(1)).toBe(false);
    expect(runtime.confirmWelcome(0)).toBe(false);
    socket.emitMessage('welcome invalid');
    expect(callbacks.onFrame).toHaveBeenCalledWith(1, 'welcome invalid');
    expect(runtime.isReady(1)).toBe(false);
    jest.advanceTimersByTime(499);
    welcome();
    jest.advanceTimersByTime(60_000);
    expect(callbacks.onFailed).not.toHaveBeenCalled();
    expect(runtime.isReady(1)).toBe(true);
    expect(runtime.isReady(2)).toBe(false);
  });

  test('welcome timeout fails, invalidates, closes, removes listeners, and retries', async () => {
    const { runtime, sockets, callbacks, openSocket } = fixture({ welcomeTimeoutMs: 500 });
    const first = new FakeSocket();
    sockets.push(Promise.resolve(first), Promise.resolve(new FakeSocket()));
    await runtime.connect();
    first.emitOpen();
    first.emitMessage('unacknowledged raw frame');
    jest.advanceTimersByTime(500);
    expect(callbacks.onFailed).toHaveBeenCalledWith(1, 'Timed out waiting for a valid welcome');
    expect(callbacks.onInvalidated).toHaveBeenCalledTimes(1);
    expect(first.closeCalls).toEqual([{ code: 1000, reason: 'Connection disposed' }]);
    expectNoListeners(first);
    jest.advanceTimersByTime(999);
    expect(openSocket).toHaveBeenCalledTimes(1);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(openSocket).toHaveBeenCalledTimes(2);
  });

  test('watchdog includes unresolved openSocket work and disposes its late result', async () => {
    const { runtime, sockets, callbacks } = fixture({ welcomeTimeoutMs: 500 });
    const pending = deferred<NetworkSocket>();
    const late = new FakeSocket();
    sockets.push(pending.promise);
    const opening = runtime.connect();
    jest.advanceTimersByTime(500);
    expect(callbacks.onFailed).toHaveBeenCalledTimes(1);
    pending.resolve(late);
    await opening;
    expect(late.closeCalls).toEqual([{ code: 1000, reason: 'Stale connection' }]);
    expectNoListeners(late);
    expect(callbacks.onOpened).not.toHaveBeenCalled();
  });

  test('backoff grows and caps through OPEN; only acknowledged welcome resets it', async () => {
    const { runtime, sockets, openSocket, welcome } = fixture();
    const attempts = Array.from({ length: 8 }, () => new FakeSocket());
    sockets.push(...attempts.map((socket) => Promise.resolve(socket)));
    await runtime.connect();
    for (const [index, delay] of [1_000, 2_000, 4_000, 8_000, 16_000, 16_000].entries()) {
      const socket = attempts[index]!;
      socket.emitOpen();
      socket.emitClose();
      jest.advanceTimersByTime(delay - 1);
      expect(openSocket).toHaveBeenCalledTimes(index + 1);
      jest.advanceTimersByTime(1);
      await Promise.resolve();
      expect(openSocket).toHaveBeenCalledTimes(index + 2);
    }
    attempts[6]!.emitOpen();
    welcome();
    attempts[6]!.emitClose();
    jest.advanceTimersByTime(999);
    expect(openSocket).toHaveBeenCalledTimes(7);
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    expect(openSocket).toHaveBeenCalledTimes(8);
  });

  test('stale open/message/error/close callbacks and welcome cannot affect the replacement', async () => {
    const { runtime, sockets, callbacks, store, welcome } = fixture();
    const first = new FakeSocket();
    const second = new FakeSocket();
    sockets.push(Promise.resolve(first), Promise.resolve(second));
    await runtime.connect();
    const staleOpen = [...first.listeners.open];
    const staleMessage = [...first.listeners.message];
    const staleError = [...first.listeners.error];
    const staleClose = [...first.listeners.close];
    runtime.disconnect();
    await runtime.connect();
    second.emitOpen();
    welcome();
    for (const listener of staleOpen) listener();
    for (const listener of staleMessage) listener({ data: 'stale frame' } as WebSocketMessageEvent);
    for (const listener of staleError) listener();
    for (const listener of staleClose) listener({ code: 1006 } as WebSocketCloseEvent);
    expect(runtime.confirmWelcome(1)).toBe(false);
    expect(store.getState().session).toMatchObject({ connectionEpoch: 2, phase: 'ready' });
    expect(callbacks.onFrame).not.toHaveBeenCalled();
    expect(callbacks.onOpened).toHaveBeenCalledTimes(1);
    expect(callbacks.onClosed).toHaveBeenCalledTimes(1);
    expect(callbacks.onFailed).not.toHaveBeenCalled();
    expectNoListeners(first);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a stale open result cannot clear the replacement single-flight promise', async () => {
    const { runtime, sockets, callbacks } = fixture();
    const first = deferred<NetworkSocket>();
    const second = deferred<NetworkSocket>();
    const stale = new FakeSocket();
    sockets.push(first.promise, second.promise);
    const oldOpening = runtime.connect();
    runtime.disconnect();
    const newOpening = runtime.connect();
    first.resolve(stale);
    await oldOpening;
    expect(runtime.connect()).toBe(newOpening);
    expect(stale.closeCalls).toEqual([{ code: 1000, reason: 'Stale connection' }]);
    expect(callbacks.onOpened).not.toHaveBeenCalled();
    second.resolve(new FakeSocket());
    await newOpening;
  });

  test('a stale open rejection cannot fail or schedule a retry for the replacement', async () => {
    const { runtime, sockets, callbacks, welcome } = fixture();
    const first = deferred<NetworkSocket>();
    const second = new FakeSocket();
    sockets.push(first.promise, Promise.resolve(second));
    const oldOpening = runtime.connect();
    runtime.disconnect();
    await runtime.connect();
    second.emitOpen();
    welcome();
    first.reject(new Error('old failure'));
    await oldOpening;
    expect(callbacks.onFailed).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
    expect(runtime.isReady(2)).toBe(true);
  });

  test('replacement ownership and start notification precede synchronous old-socket disposal', async () => {
    const { runtime, sockets, store, callbacks } = fixture();
    const first = new FakeSocket();
    sockets.push(Promise.resolve(first), Promise.resolve(new FakeSocket()));
    await runtime.connect();
    const staleClose = [...first.listeners.close];
    first.onDispose = () => {
      expect(store.getState().session).toMatchObject({ connectionEpoch: 2, phase: 'connecting' });
      expect(runtime.confirmWelcome(1)).toBe(false);
      for (const listener of staleClose) listener({ code: 1006 } as WebSocketCloseEvent);
      expectNoListeners(first);
    };
    // Exercise the existing replacement path when the facade phase has been reset.
    store.dispatch(sessionActions.signedOut());
    await runtime.connect();
    expect(first.closeCalls).toHaveLength(1);
    expect(callbacks.onClosed).not.toHaveBeenCalled();
    expect(callbacks.onFailed).not.toHaveBeenCalled();
    expect(store.getState().session.connectionEpoch).toBe(2);
  });

  test('background preserves a READY socket and repeated foreground does not duplicate it', async () => {
    const { runtime, sockets, openSocket, callbacks, welcome } = fixture();
    const socket = new FakeSocket();
    sockets.push(Promise.resolve(socket));
    await runtime.connect();
    socket.emitOpen();
    welcome();
    runtime.setAppActive(false);
    runtime.setAppActive(false);
    expect(runtime.isReady(1)).toBe(true);
    expect(socket.closeCalls).toEqual([]);
    runtime.setAppActive(true);
    runtime.setAppActive(true);
    expect(openSocket).toHaveBeenCalledTimes(1);
    expect(callbacks.onAppActiveChanged.mock.calls).toEqual([[false], [true]]);
  });

  test('connect while inactive waits for foreground', async () => {
    const { runtime, sockets, openSocket } = fixture();
    sockets.push(Promise.resolve(new FakeSocket()));
    runtime.setAppActive(false);
    await runtime.connect();
    jest.advanceTimersByTime(60_000);
    expect(openSocket).not.toHaveBeenCalled();
    runtime.setAppActive(true);
    await Promise.resolve();
    expect(openSocket).toHaveBeenCalledTimes(1);
  });

  test('close while inactive waits for foreground, then reconnects immediately', async () => {
    const { runtime, sockets, openSocket, welcome } = fixture();
    const first = new FakeSocket();
    sockets.push(Promise.resolve(first), Promise.resolve(new FakeSocket()));
    await runtime.connect();
    first.emitOpen();
    welcome();
    runtime.setAppActive(false);
    first.emitClose();
    expectNoListeners(first);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(60_000);
    expect(openSocket).toHaveBeenCalledTimes(1);
    runtime.setAppActive(true);
    await Promise.resolve();
    expect(openSocket).toHaveBeenCalledTimes(2);
  });

  test('background cancels a scheduled retry; foreground/manual connect stay single-flight', async () => {
    const { runtime, sockets, openSocket } = fixture();
    const first = new FakeSocket();
    const second = deferred<NetworkSocket>();
    sockets.push(Promise.resolve(first), second.promise);
    await runtime.connect();
    first.emitClose();
    runtime.setAppActive(false);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(60_000);
    expect(openSocket).toHaveBeenCalledTimes(1);
    runtime.setAppActive(true);
    const opening = runtime.connect();
    expect(openSocket).toHaveBeenCalledTimes(2);
    second.resolve(new FakeSocket());
    await opening;
  });

  test('disconnect cancels retry and disables foreground reconnect', async () => {
    const { runtime, sockets, openSocket, callbacks } = fixture();
    const first = new FakeSocket();
    sockets.push(Promise.resolve(first));
    await runtime.connect();
    first.emitClose();
    runtime.disconnect();
    expect(jest.getTimerCount()).toBe(0);
    runtime.setAppActive(false);
    runtime.setAppActive(true);
    jest.advanceTimersByTime(60_000);
    expect(openSocket).toHaveBeenCalledTimes(1);
    expect(callbacks.onClosed.mock.calls).toEqual([[1, 'WebSocket closed (1006)'], [1, null]]);
  });

  test('cancelled retry and watchdog callbacks cannot mutate a new connection', async () => {
    const scheduled: Array<() => void> = [];
    const timers: RuntimeTimers = {
      setTimeout: (callback, delay) => { scheduled.push(callback); return setTimeout(callback, delay); },
      clearTimeout: (timer) => clearTimeout(timer),
    };
    const { runtime, sockets, openSocket, callbacks, welcome } = fixture({ timers });
    const first = new FakeSocket();
    const second = new FakeSocket();
    sockets.push(Promise.resolve(first), Promise.resolve(second));
    await runtime.connect();
    const oldWatchdog = scheduled[0]!;
    first.emitClose();
    const oldRetry = scheduled[1]!;
    await runtime.connect();
    second.emitOpen();
    welcome();
    oldWatchdog();
    oldRetry();
    expect(runtime.isReady(2)).toBe(true);
    expect(openSocket).toHaveBeenCalledTimes(2);
    expect(callbacks.onFailed).not.toHaveBeenCalled();
    expect(jest.getTimerCount()).toBe(0);
  });

  test('READY send gate drops premature/failed sends without replay across boundaries', async () => {
    const { runtime, sockets, openSocket, welcome, store } = fixture();
    const first = new FakeSocket();
    const second = new FakeSocket();
    sockets.push(Promise.resolve(first), Promise.resolve(second));
    expect(runtime.send('before connect')).toBe(false);
    await runtime.connect();
    expect(runtime.send('before open')).toBe(false);
    first.emitOpen();
    expect(runtime.send('before welcome')).toBe(false);
    welcome();
    expect(first.sent).toEqual([]);
    expect(runtime.send('one command')).toBe(true);
    first.failSend = true;
    expect(runtime.send('uncertain command')).toBe(false);
    expect(openSocket).toHaveBeenCalledTimes(1);
    runtime.disconnect();
    await runtime.connect();
    second.emitOpen();
    welcome();
    expect(second.sent).toEqual([]);
    second.readyState = 2;
    expect(runtime.send('closing socket')).toBe(false);
    second.readyState = 1;
    store.dispatch(sessionActions.connectionClosed({ epoch: 2, error: null }));
    expect(runtime.send('closed session')).toBe(false);
    expect(first.sent).toEqual(['one command']);
    expect(second.sent).toEqual([]);
  });

  test.each(['error', 'disconnect', 'reset', 'close'] as const)(
    '%s invalidates domain work before disposal, removes all listeners and watchdog', async (boundary) => {
      const { runtime, sockets, callbacks } = fixture();
      const socket = new FakeSocket();
      sockets.push(Promise.resolve(socket));
      await runtime.connect();
      socket.onDispose = () => {
        expect(callbacks.onInvalidated).toHaveBeenCalledTimes(1);
        expect(runtime.confirmWelcome(1)).toBe(false);
        expectNoListeners(socket);
      };
      if (boundary === 'error') socket.emitError();
      else if (boundary === 'close') socket.emitClose(1000);
      else runtime[boundary]();
      expectNoListeners(socket);
      expect(callbacks.onInvalidated).toHaveBeenCalledTimes(1);
      expect(runtime.isReady(1)).toBe(false);
      expect(socket.closeCalls).toHaveLength(boundary === 'close' ? 0 : 1);
      expect(jest.getTimerCount()).toBe(boundary === 'close' || boundary === 'error' ? 1 : 0);
      if (boundary === 'reset') expect(callbacks.onClosed).not.toHaveBeenCalled();
      if (boundary === 'error') expect(callbacks.onFailed).toHaveBeenCalledWith(1, 'WebSocket error');
      if (boundary === 'close') expect(callbacks.onClosed).toHaveBeenCalledWith(1, null);
    },
  );

  test('open failure preserves the bounded status and schedules a retry', async () => {
    const { runtime, sockets, callbacks } = fixture();
    sockets.push(Promise.reject(new Error('x'.repeat(300))));
    await runtime.connect();
    expect(callbacks.onInvalidated).toHaveBeenCalledTimes(1);
    expect(callbacks.onFailed).toHaveBeenCalledWith(1, 'x'.repeat(240));
    expect(jest.getTimerCount()).toBe(1);
  });

  test('non-string messages are discarded and raw strings are delivered unchanged', async () => {
    const { runtime, sockets, callbacks } = fixture();
    const socket = new FakeSocket();
    sockets.push(Promise.resolve(socket));
    await runtime.connect();
    socket.emitMessage({ command: 'welcome' });
    socket.emitMessage('unparsed raw frame');
    expect(callbacks.onFrame.mock.calls).toEqual([[1, 'unparsed raw frame']]);
  });

  test('inbound handler exception fails the owned connection instead of crashing or replaying', async () => {
    const { runtime, sockets, callbacks, store, openSocket, welcome } = fixture();
    const first = new FakeSocket();
    const second = new FakeSocket();
    sockets.push(Promise.resolve(first), Promise.resolve(second));
    await runtime.connect();
    first.emitOpen();
    welcome();
    expect(runtime.send('one committed gameplay command')).toBe(true);

    const report = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      callbacks.onFrame.mockImplementationOnce(() => {
        throw new TypeError('Do not leak the original private frame or error');
      });
      expect(() => first.emitMessage('gameAction {"sensitive":"private"}')).not.toThrow();
      expect(report).toHaveBeenCalledWith('[Hanab] Inbound gameAction handler failed (TypeError)');
      expect(callbacks.onFailed).toHaveBeenCalledWith(
        1, 'Unable to process server event (gameAction)',
      );
      expect(callbacks.onInvalidated).toHaveBeenCalledTimes(1);
      expect(store.getState().session.phase).toBe('failed');
      expectNoListeners(first);
      expect(first.closeCalls).toEqual([{ code: 1000, reason: 'Connection disposed' }]);
      expect(runtime.send('uncertain old command')).toBe(false);
      expect(first.sent).toEqual(['one committed gameplay command']);

      jest.advanceTimersByTime(1_000);
      await Promise.resolve();
      expect(openSocket).toHaveBeenCalledTimes(2);
      second.emitOpen();
      welcome();
      expect(runtime.isReady(2)).toBe(true);
      expect(second.sent).toEqual([]);
    } finally {
      report.mockRestore();
    }
  });

  test('inbound failure diagnostics do not print arbitrary frame tokens', async () => {
    const { runtime, sockets, callbacks } = fixture();
    const socket = new FakeSocket();
    sockets.push(Promise.resolve(socket));
    await runtime.connect();

    const report = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      callbacks.onFrame.mockImplementationOnce(() => { throw new Error('secret'); });
      expect(() => socket.emitMessage('malformed! {"private":"secret"}')).not.toThrow();
      expect(report).toHaveBeenCalledWith('[Hanab] Inbound unknown handler failed (Error)');
      expect(callbacks.onFailed).toHaveBeenCalledWith(
        1, 'Unable to process server event (unknown)',
      );
    } finally {
      report.mockRestore();
    }
  });

  test('reset cancels retry without closed event; epoch stays monotonic across signedOut', async () => {
    const { runtime, sockets, store, callbacks, welcome } = fixture({ initialEpoch: 7 });
    const first = new FakeSocket();
    const second = new FakeSocket();
    sockets.push(Promise.resolve(first), Promise.resolve(second));
    await runtime.connect();
    first.emitClose();
    callbacks.onClosed.mockClear();
    runtime.reset();
    store.dispatch(sessionActions.signedOut());
    expect(callbacks.onClosed).not.toHaveBeenCalled();
    expect(store.getState().session.connectionEpoch).toBe(0);
    expect(jest.getTimerCount()).toBe(0);
    jest.advanceTimersByTime(60_000);
    await runtime.connect();
    expect(store.getState().session.connectionEpoch).toBe(9);
    second.emitOpen();
    welcome();
    expect(runtime.isReady(9)).toBe(true);
    expect(runtime.confirmWelcome(8)).toBe(false);
  });
});
