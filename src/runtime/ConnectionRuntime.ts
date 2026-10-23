import type { NetworkSession, NetworkSocket } from '../network/types';
import type { ConnectionPhase } from '../store/sessionSlice';

const SOCKET_OPEN = 1;
const SOCKET_CLOSING = 2;
const MAX_STATUS_LENGTH = 240;
const MAX_DIAGNOSTIC_COMMAND_LENGTH = 32;

/** Never include raw message bodies (which may contain PMs or other private data) in diagnostics. */
function safeCommandName(rawFrame: string): string {
  const separator = rawFrame.indexOf(' ');
  if (separator < 1 || separator > MAX_DIAGNOSTIC_COMMAND_LENGTH) return 'unknown';
  const command = rawFrame.slice(0, separator);
  return /^[A-Za-z][A-Za-z0-9]*$/.test(command) ? command : 'unknown';
}
export const DEFAULT_WELCOME_TIMEOUT_MS = 10_000;
export const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;

export type RuntimeTimers = {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
};

type ConnectionCallbacks = {
  /** Preserve the facade's session-phase guards without owning Redux or domain state. */
  getPhase(): ConnectionPhase;
  onStarted(epoch: number): void;
  onOpened(epoch: number): void;
  /** Ownership is already invalidated; domain work must be invalidated before disposal. */
  onInvalidated(): void;
  onClosed(epoch: number, error: string | null): void;
  onFailed(epoch: number, error: string): void;
  onFrame(epoch: number, rawFrame: string): void;
  onAppActiveChanged(active: boolean): void;
};

type SocketListeners = {
  open: () => void;
  message: (event: WebSocketMessageEvent) => void;
  error: () => void;
  close: (event: WebSocketCloseEvent) => void;
};

type OwnedConnection = {
  epoch: number;
  socket: NetworkSocket | null;
  timer: ReturnType<typeof setTimeout> | null;
  listeners: SocketListeners | null;
  ready: boolean;
};

/** Raw transport ownership only. The facade validates welcome and handles domain events. */
export class ConnectionRuntime {
  private current: OwnedConnection | null = null;
  private connectionEpoch: number;
  private connectPromise: Promise<void> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private appActive = true;
  private maintainConnection = false;

  constructor(
    private readonly networkSession: Pick<NetworkSession, 'openSocket'>,
    private readonly callbacks: ConnectionCallbacks,
    initialEpoch = 0,
    private readonly timers: RuntimeTimers = {
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: (timer) => clearTimeout(timer),
    },
    private readonly welcomeTimeoutMs = DEFAULT_WELCOME_TIMEOUT_MS,
    private readonly retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
  ) {
    // Never derive subsequent epochs from Redux, which resets on signedOut.
    this.connectionEpoch = initialEpoch;
  }

  connect(): Promise<void> {
    this.maintainConnection = true;
    if (!this.appActive) return Promise.resolve();
    this.cancelRetry();
    return this.startConnectionAttempt();
  }

  disconnect(): void {
    this.reset();
    this.callbacks.onClosed(this.connectionEpoch, null);
  }

  /** Dispose ownership without a closed event, for an authoritative missing-session reset. */
  reset(): void {
    this.maintainConnection = false;
    this.retryAttempt = 0;
    this.cancelRetry();
    const owned = this.current;
    this.current = null;
    this.callbacks.onInvalidated();
    if (owned !== null) this.dispose(owned, true);
  }

  setAppActive(active: boolean): void {
    if (this.appActive === active) return;
    this.appActive = active;
    try {
      this.callbacks.onAppActiveChanged(active);
    } catch {
      // Presence is advisory and is never queued or retried.
    }
    if (!active) {
      this.cancelRetry();
      return;
    }
    if (this.maintainConnection) {
      this.cancelRetry();
      void this.startConnectionAttempt();
    }
  }

  /** Called only after the facade has decoded a valid welcome, before domain handling. */
  confirmWelcome(epoch: number): boolean {
    const owned = this.current;
    if (owned === null || !this.isCurrent(owned) || owned.epoch !== epoch) return false;
    if (owned.timer !== null) {
      this.timers.clearTimeout(owned.timer);
      owned.timer = null;
    }
    owned.ready = true;
    this.retryAttempt = 0;
    return true;
  }

  isReady(epoch: number): boolean {
    const owned = this.current;
    return owned !== null
      && this.isCurrent(owned)
      && owned.epoch === epoch
      && owned.ready
      && this.callbacks.getPhase() === 'ready'
      && owned.socket !== null
      && owned.socket.readyState === SOCKET_OPEN;
  }

  /** Fail closed before domain diagnostics can notify synchronous subscribers. */
  invalidateCurrent(epoch: number, error: string): void {
    const owned = this.current;
    if (owned === null || owned.epoch !== epoch) return;
    this.failCurrent(owned, error);
  }

  /** No queue: a failed or premature frame is dropped permanently. */
  send(frame: string): boolean {
    const owned = this.current;
    if (owned === null || !this.isReady(owned.epoch) || owned.socket === null) return false;
    try {
      owned.socket.send(frame);
      return true;
    } catch {
      return false;
    }
  }

  private startConnectionAttempt(): Promise<void> {
    const phase = this.callbacks.getPhase();
    if (this.current !== null
      && (phase === 'connecting' || phase === 'openAwaitingWelcome' || phase === 'ready')) {
      return this.connectPromise ?? Promise.resolve();
    }

    const previous = this.current;
    const epoch = this.connectionEpoch + 1;
    this.connectionEpoch = epoch;
    const owned: OwnedConnection = {
      epoch, socket: null, timer: null, listeners: null, ready: false,
    };
    // Establish ownership before invoking lifecycle callbacks or disposing old resources.
    this.current = owned;
    this.callbacks.onStarted(epoch);
    if (previous !== null) this.dispose(previous, true);

    owned.timer = this.timers.setTimeout(() => {
      if (!this.isCurrent(owned)) return;
      this.failCurrent(owned, 'Timed out waiting for a valid welcome');
    }, this.welcomeTimeoutMs);

    const opening = this.open(owned);
    this.connectPromise = opening;
    void opening.finally(() => {
      if (this.connectPromise === opening) this.connectPromise = null;
    });
    return opening;
  }

  private async open(owned: OwnedConnection): Promise<void> {
    let socket: NetworkSocket;
    try {
      socket = await this.networkSession.openSocket();
    } catch (error) {
      if (this.isCurrent(owned)) {
        const message = error instanceof Error ? error.message : 'WebSocket creation failed';
        this.failCurrent(owned, message.slice(0, MAX_STATUS_LENGTH));
      }
      return;
    }

    if (!this.isCurrent(owned)) {
      socket.close(1000, 'Stale connection');
      return;
    }

    owned.socket = socket;
    const listeners: SocketListeners = {
      open: () => this.onOpen(owned),
      message: (event) => {
        if (!this.isCurrent(owned) || typeof event.data !== 'string') return;
        try {
          this.callbacks.onFrame(owned.epoch, event.data);
        } catch (error) {
          // A domain handler may have partially applied the frame. Invalidate the
          // entire connection and rebuild from server authority, never replay sends.
          const command = safeCommandName(event.data);
          const kind = error instanceof TypeError ? 'TypeError'
            : error instanceof RangeError ? 'RangeError' : 'Error';
          console.error(`[Hanab] Inbound ${command} handler failed (${kind})`);
          this.failCurrent(owned, `Unable to process server event (${command})`);
        }
      },
      error: () => this.failCurrent(owned, 'WebSocket error'),
      close: (event) => this.onClose(owned, event),
    };
    owned.listeners = listeners;
    socket.addEventListener('open', listeners.open);
    socket.addEventListener('message', listeners.message);
    socket.addEventListener('error', listeners.error);
    socket.addEventListener('close', listeners.close);
    if (socket.readyState === SOCKET_OPEN) this.onOpen(owned);
  }

  private onOpen(owned: OwnedConnection): void {
    if (!this.isCurrent(owned)) return;
    this.callbacks.onOpened(owned.epoch);
  }

  private onClose(owned: OwnedConnection, event: WebSocketCloseEvent): void {
    if (!this.isCurrent(owned)) return;
    this.current = null;
    this.callbacks.onInvalidated();
    this.dispose(owned, false);
    this.callbacks.onClosed(
      owned.epoch, event.code === 1000 ? null : `WebSocket closed (${event.code})`,
    );
    this.scheduleRetry();
  }

  private failCurrent(owned: OwnedConnection, error: string): void {
    if (!this.isCurrent(owned)) return;
    this.current = null;
    this.callbacks.onInvalidated();
    this.dispose(owned, true);
    this.callbacks.onFailed(owned.epoch, error);
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (
      !this.maintainConnection
      || !this.appActive
      || this.retryTimer !== null
      || this.retryDelaysMs.length === 0
    ) return;
    const delayIndex = Math.min(this.retryAttempt, this.retryDelaysMs.length - 1);
    const delayMs = this.retryDelaysMs[delayIndex];
    if (delayMs === undefined) return;
    this.retryAttempt += 1;
    let timer!: ReturnType<typeof setTimeout>;
    timer = this.timers.setTimeout(() => {
      if (this.retryTimer !== timer) return;
      this.retryTimer = null;
      if (!this.maintainConnection || !this.appActive) return;
      void this.startConnectionAttempt();
    }, delayMs);
    this.retryTimer = timer;
  }

  private cancelRetry(): void {
    if (this.retryTimer === null) return;
    this.timers.clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }

  private isCurrent(owned: OwnedConnection): boolean {
    return this.current === owned && owned.epoch === this.connectionEpoch;
  }

  private dispose(owned: OwnedConnection, closeSocket: boolean): void {
    if (owned.timer !== null) {
      this.timers.clearTimeout(owned.timer);
      owned.timer = null;
    }
    const { socket, listeners } = owned;
    if (socket !== null && listeners !== null) {
      socket.removeEventListener('open', listeners.open);
      socket.removeEventListener('message', listeners.message);
      socket.removeEventListener('error', listeners.error);
      socket.removeEventListener('close', listeners.close);
      owned.listeners = null;
    }
    if (closeSocket && socket !== null && socket.readyState < SOCKET_CLOSING) {
      socket.close(1000, 'Connection disposed');
    }
  }
}
