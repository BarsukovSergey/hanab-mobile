import type { NetworkSession, NetworkSocket } from '../network/types';
import {
  decodeServerFrame,
  encodeClientFrame,
  encodeTableSpectateFrame,
  type LobbyTable,
  type ServerEvent,
} from '../protocol/lobbyProtocol';
import { lobbyActions } from '../store/lobbySlice';
import { roomActions } from '../store/roomSlice';
import { sessionActions } from '../store/sessionSlice';
import type { AppStore } from '../store/store';

const SOCKET_OPEN = 1;
const SOCKET_CLOSING = 2;
const DEFAULT_WELCOME_TIMEOUT_MS = 10_000;
const MAX_STATUS_LENGTH = 240;

export type RuntimeTimers = {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
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
};

function safeStatus(value: unknown, fallback: string): string {
  const message = value instanceof Error ? value.message : fallback;
  return message.slice(0, MAX_STATUS_LENGTH);
}

export class LobbyRuntime {
  private current: OwnedConnection | null = null;
  private connectionEpoch: number;
  private connectPromise: Promise<void> | null = null;

  constructor(
    private readonly networkSession: NetworkSession,
    private readonly store: AppStore,
    private readonly timers: RuntimeTimers = {
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: (timer) => clearTimeout(timer),
    },
    private readonly welcomeTimeoutMs = DEFAULT_WELCOME_TIMEOUT_MS,
  ) {
    this.connectionEpoch = store.getState().session.connectionEpoch;
  }

  connect(): Promise<void> {
    const phase = this.store.getState().session.phase;
    if (
      this.current !== null
      && (phase === 'connecting'
        || phase === 'openAwaitingWelcome'
        || phase === 'ready')
    ) {
      return this.connectPromise ?? Promise.resolve();
    }

    const previous = this.current;
    const epoch = this.connectionEpoch + 1;
    this.connectionEpoch = epoch;

    // Establish new ownership before disposal because close() may synchronously callback.
    const owned: OwnedConnection = {
      epoch,
      socket: null,
      timer: null,
      listeners: null,
    };
    this.current = owned;
    this.store.dispatch(sessionActions.connectionStarted({ epoch }));
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

  disconnect(): void {
    const owned = this.current;
    if (owned === null) return;
    this.current = null;
    this.dispose(owned, true);
    this.store.dispatch(
      sessionActions.connectionClosed({ epoch: owned.epoch, error: null }),
    );
  }

  /** Internal no-queue send gate for later typed client commands. */
  send(command: string, payload?: unknown): boolean {
    return this.sendEncoded(encodeClientFrame(command, payload));
  }

  spectate(tableID: number): boolean {
    const state = this.store.getState();
    const table = state.lobby.tables.entities[tableID];
    if (
      table === undefined
      || !isSpectateEligible(table)
      || state.room.room.kind !== 'none'
      || state.room.pendingSpectateTableID !== null
    ) {
      return false;
    }

    const sent = this.sendEncoded(encodeTableSpectateFrame(tableID));
    if (!sent) return false;

    this.store.dispatch(roomActions.spectateRequested({
      epoch: state.session.connectionEpoch,
      tableID,
    }));
    return true;
  }

  private async open(owned: OwnedConnection): Promise<void> {
    let socket: NetworkSocket;
    try {
      socket = await this.networkSession.openSocket();
    } catch (error) {
      if (this.isCurrent(owned)) {
        this.failCurrent(owned, safeStatus(error, 'WebSocket creation failed'));
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
      message: (event) => this.onMessage(owned, event),
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
    this.store.dispatch(sessionActions.socketOpened({ epoch: owned.epoch }));
  }

  private onMessage(owned: OwnedConnection, event: WebSocketMessageEvent): void {
    if (!this.isCurrent(owned) || typeof event.data !== 'string') return;
    const decoded = decodeServerFrame(event.data);

    if (decoded.kind === 'unknown') return;
    if (decoded.kind === 'malformed') {
      const command = decoded.command ?? 'frame';
      this.store.dispatch(sessionActions.protocolIssue({
        epoch: owned.epoch,
        issue: `${command}: ${decoded.issue}`,
      }));
      return;
    }

    this.applyEvent(owned, decoded.event);
  }

  private applyEvent(owned: OwnedConnection, event: ServerEvent): void {
    const epoch = owned.epoch;
    switch (event.command) {
      case 'welcome':
        if (owned.timer !== null) {
          this.timers.clearTimeout(owned.timer);
          owned.timer = null;
        }
        this.store.dispatch(sessionActions.welcomeReceived({ epoch, welcome: event.data }));
        break;
      case 'userList':
        this.store.dispatch(lobbyActions.userListReceived({ epoch, users: event.data }));
        break;
      case 'user':
        this.store.dispatch(lobbyActions.userReceived({ epoch, user: event.data }));
        break;
      case 'userLeft':
        this.store.dispatch(lobbyActions.userLeft({ epoch, userID: event.data.userID }));
        break;
      case 'tableList':
        this.store.dispatch(lobbyActions.tableListReceived({ epoch, tables: event.data }));
        break;
      case 'table':
        this.store.dispatch(lobbyActions.tableReceived({ epoch, table: event.data }));
        break;
      case 'tableGone':
        this.store.dispatch(lobbyActions.tableGone({ epoch, tableID: event.data.tableID }));
        break;
      case 'tableStart':
        this.store.dispatch(roomActions.tableStartReceived({
          epoch,
          tableStart: event.data,
        }));
        break;
      case 'warning':
        this.store.dispatch(lobbyActions.noticeReceived({
          epoch,
          notice: { kind: 'warning', message: event.data.warning.slice(0, MAX_STATUS_LENGTH) },
        }));
        break;
      case 'error':
        this.store.dispatch(lobbyActions.noticeReceived({
          epoch,
          notice: { kind: 'error', message: event.data.error.slice(0, MAX_STATUS_LENGTH) },
        }));
        break;
    }
  }

  private onClose(owned: OwnedConnection, event: WebSocketCloseEvent): void {
    if (!this.isCurrent(owned)) return;
    this.current = null;
    this.dispose(owned, false);
    this.store.dispatch(sessionActions.connectionClosed({
      epoch: owned.epoch,
      error: event.code === 1000 ? null : `WebSocket closed (${event.code})`,
    }));
  }

  private failCurrent(owned: OwnedConnection, error: string): void {
    if (!this.isCurrent(owned)) return;
    this.current = null;
    this.dispose(owned, true);
    this.store.dispatch(sessionActions.connectionFailed({
      epoch: owned.epoch,
      error,
    }));
  }

  private isCurrent(owned: OwnedConnection): boolean {
    return this.current === owned && owned.epoch === this.connectionEpoch;
  }

  private sendEncoded(frame: string): boolean {
    const owned = this.current;
    if (
      owned === null
      || owned.epoch !== this.connectionEpoch
      || owned.socket === null
      || owned.socket.readyState !== SOCKET_OPEN
      || this.store.getState().session.phase !== 'ready'
    ) {
      return false;
    }

    owned.socket.send(frame);
    return true;
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

export function isSpectateEligible(table: LobbyTable): boolean {
  return table.running && !table.sharedReplay && !table.joined;
}
