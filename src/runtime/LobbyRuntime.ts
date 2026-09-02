import type {
  NetworkSession,
  NetworkSocket,
  SessionCheckResult,
} from '../network/types';
import { GameBootstrapCoordinator } from '../game/bootstrap/GameBootstrapCoordinator';
import {
  hasClueTokenForVariant,
  isCurrentVariantColorClueValue,
  isCurrentVariantRankClueValue,
} from '../game/selectors/gameplay';
import {
  areTableOptionsSupported,
  isVariantNameSupported,
} from '../game/client/supportedVariants';
import {
  clientGameplayActionSchema,
  encodeColorClueFrame,
  encodeDiscardFrame,
  encodePlayFrame,
  encodeRankClueFrame,
  encodeNoteFrame,
  encodePauseFrame,
  noteCommandSchema,
  type ClientGameplayAction,
} from '../protocol/gameProtocol';
import {
  decodeServerFrame,
  encodeChatFrame,
  encodeInactiveFrame,
  encodeClientFrame,
  encodeReplayActionFrame,
  encodeTableRestartFrame,
  encodeTableCreateFrame,
  encodeTableReattendFrame,
  encodeTableJoinFrame,
  encodeTableLeaveFrame,
  encodeTableSpectateFrame,
  encodeTableStartFrame,
  encodeTableSetLeaderFrame,
  encodeTableUpdateFrame,
  encodeTableUnattendFrame,
  type LobbyTable,
  type MobileTableOptions,
  type ServerEvent,
} from '../protocol/lobbyProtocol';
import { chatActions } from '../store/chatSlice';
import { lobbyActions } from '../store/lobbySlice';
import { roomActions } from '../store/roomSlice';
import { sessionActions } from '../store/sessionSlice';
import { terminationActions } from '../store/terminationSlice';
import type { AppStore } from '../store/store';

const SOCKET_OPEN = 1;
const SOCKET_CLOSING = 2;
const DEFAULT_WELCOME_TIMEOUT_MS = 10_000;
const DEFAULT_RETRY_DELAYS_MS = [1_000, 2_000, 4_000, 8_000, 16_000] as const;
const MAX_STATUS_LENGTH = 240;
const USER_STATUS_LOBBY = 0;
const USER_STATUS_PLAYER_MIN = 1;
const USER_STATUS_PLAYER_MAX = 2;
const USER_STATUS_SPECTATOR = 3;
const UNSUPPORTED_TABLE_WARNING = 'This table uses options that Hanab Mobile does not support.';

export type RuntimeTimers = {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
};

export type SignOutResult =
  | { kind: 'signedOut' }
  | { kind: 'failed'; message: string; sessionValid: boolean };

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
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private appActive = true;
  private maintainConnection = false;
  private readonly gameBootstrap: GameBootstrapCoordinator;

  constructor(
    private readonly networkSession: NetworkSession,
    private readonly store: AppStore,
    private readonly timers: RuntimeTimers = {
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: (timer) => clearTimeout(timer),
    },
    private readonly welcomeTimeoutMs = DEFAULT_WELCOME_TIMEOUT_MS,
    private readonly retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
    private readonly nowMs: () => number = Date.now,
  ) {
    this.connectionEpoch = store.getState().session.connectionEpoch;
    this.gameBootstrap = new GameBootstrapCoordinator(
      store,
      (frame) => this.sendEncoded(frame),
      timers,
    );
  }

  connect(): Promise<void> {
    this.maintainConnection = true;
    if (!this.appActive) return Promise.resolve();
    this.cancelRetry();
    return this.startConnectionAttempt();
  }

  private startConnectionAttempt(): Promise<void> {
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
    this.gameBootstrap.invalidateConnection(epoch);
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
    this.maintainConnection = false;
    this.retryAttempt = 0;
    this.cancelRetry();
    const owned = this.current;
    this.current = null;
    this.gameBootstrap.invalidate();
    if (owned !== null) this.dispose(owned, true);
    this.store.dispatch(
      sessionActions.connectionClosed({ epoch: this.connectionEpoch, error: null }),
    );
  }

  async checkSession(): Promise<SessionCheckResult> {
    const result = await this.networkSession.checkSession();
    if (result.kind === 'missing') this.resetConfirmedMissingSession();
    return result;
  }

  async signOut(): Promise<SignOutResult> {
    // Stop retry/socket ownership before the cookie-changing HTTP request.
    this.disconnect();
    let logoutError: string | null = null;
    try {
      await this.networkSession.logout();
    } catch (error) {
      logoutError = safeStatus(error, 'Logout request failed');
    }

    const check = await this.checkSession();
    if (check.kind === 'missing') {
      return { kind: 'signedOut' };
    }

    if (check.kind === 'valid') {
      void this.connect();
      return {
        kind: 'failed',
        message: logoutError ?? 'The server session is still active. Please try again.',
        sessionValid: true,
      };
    }

    return {
      kind: 'failed',
      message: logoutError ?? check.error.message,
      sessionValid: false,
    };
  }

  setAppActive(active: boolean): void {
    if (this.appActive === active) return;
    this.appActive = active;
    try {
      this.sendEncoded(encodeInactiveFrame(!active));
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

  /** Internal no-queue send gate for later typed client commands. */
  send(command: string, payload?: unknown): boolean {
    return this.sendEncoded(encodeClientFrame(command, payload));
  }

  sendChat(message: string): boolean {
    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > 300) return false;
    const room = this.currentChatRoom();
    let frame: string;
    try {
      frame = encodeChatFrame(trimmed, room);
    } catch {
      return false;
    }
    return this.sendEncoded(frame);
  }

  spectate(tableID: number): boolean {
    const state = this.store.getState();
    const table = state.lobby.tables.entities[tableID];
    if (
      table === undefined
      || (!isSpectateEligible(table) && !isPregameSpectateEligible(table))
      || state.room.room.kind !== 'none'
      || state.room.pendingRecovery !== null
      || state.room.pendingSpectateTableID !== null
      || state.room.pendingJoin !== null
      || state.room.pendingCreate !== null
    ) {
      return false;
    }

    const sent = this.sendEncoded(encodeTableSpectateFrame(tableID));
    if (!sent) return false;

    if (table.running) {
      this.store.dispatch(roomActions.spectateRequested({
        epoch: state.session.connectionEpoch,
        tableID,
      }));
    } else {
      this.store.dispatch(roomActions.joinRequested({
        epoch: state.session.connectionEpoch,
        tableID,
        role: 'spectator',
      }));
    }
    return true;
  }

  join(tableID: number, password?: string): boolean {
    const state = this.store.getState();
    const table = state.lobby.tables.entities[tableID];
    if (
      table === undefined
      || !isJoinEligible(table)
      || state.room.room.kind !== 'none'
      || state.room.pendingRecovery !== null
      || state.room.pendingSpectateTableID !== null
      || state.room.pendingJoin !== null
      || state.room.pendingCreate !== null
      || (table.passwordProtected && (password === undefined || password.length === 0))
    ) {
      return false;
    }

    const sent = this.sendEncoded(encodeTableJoinFrame(
      tableID,
      table.passwordProtected ? password : undefined,
    ));
    if (!sent) return false;

    this.store.dispatch(roomActions.joinRequested({
      epoch: state.session.connectionEpoch,
      tableID,
    }));
    return true;
  }

  reattend(tableID: number): boolean {
    const state = this.store.getState();
    const table = state.lobby.tables.entities[tableID];
    if (
      table === undefined
      || !isReattendEligible(table)
      || state.room.room.kind !== 'none'
      || state.room.pendingRecovery !== null
      || state.room.pendingSpectateTableID !== null
      || state.room.pendingJoin !== null
      || state.room.pendingCreate !== null
    ) {
      return false;
    }

    const sent = this.sendEncoded(encodeTableReattendFrame(tableID));
    if (!sent) return false;

    this.store.dispatch(roomActions.recoveryRequested({
      epoch: state.session.connectionEpoch,
      tableID,
      role: 'player',
    }));
    return this.store.getState().room.pendingRecovery?.tableID === tableID;
  }

  createTable(
    name: string,
    maxPlayers: number,
    options: MobileTableOptions | string,
    password = '',
  ): boolean {
    const state = this.store.getState();
    const creatorUserID = state.session.authenticatedUser?.userID;
    const trimmedName = name.trim();
    const exposed = typeof options === 'string' ? {
      variantName: options,
      timed: false,
      timeBase: 0,
      timePerTurn: 0,
      cardCycle: false,
      emptyClues: false,
      oneExtraCard: false,
      oneLessCard: false,
      allOrNothing: false,
    } : options;
    if (
      creatorUserID === undefined
      || trimmedName.length < 1
      || trimmedName.length > 45
      || !Number.isInteger(maxPlayers)
      || maxPlayers < 2
      || maxPlayers > 6
      || !isVariantNameSupported(exposed.variantName)
      || (exposed.oneExtraCard && exposed.oneLessCard)
      || state.room.room.kind !== 'none'
      || state.room.pendingRecovery !== null
      || state.room.pendingSpectateTableID !== null
      || state.room.pendingJoin !== null
      || state.room.pendingCreate !== null
    ) return false;

    let frame: string;
    try {
      frame = encodeTableCreateFrame(trimmedName, maxPlayers, exposed, password);
    } catch {
      return false;
    }
    if (!this.sendEncoded(frame)) return false;

    this.store.dispatch(roomActions.createRequested({
      epoch: state.session.connectionEpoch,
      name: trimmedName,
      creatorUserID,
    }));
    return true;
  }

  startGame(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const ownerUserID = state.session.authenticatedUser?.userID;
    if (
      ownerUserID === undefined
      || room.kind !== 'pregame'
      || room.data.owner !== ownerUserID
      || room.data.players.length < 2
      || state.room.pendingStart !== null
      || state.room.pendingLeaveTableID !== null
    ) return false;

    const intendedPlayers = room.data.players.map((player) => player.name);
    let frame: string;
    try {
      frame = encodeTableStartFrame(room.tableID, intendedPlayers);
    } catch {
      return false;
    }
    if (!this.sendEncoded(frame)) return false;

    this.store.dispatch(roomActions.startRequested({
      epoch: state.session.connectionEpoch,
      tableID: room.tableID,
      ownerUserID,
      intendedPlayers,
    }));
    return true;
  }

  updateTable(name: string, maxPlayers: number, changes: MobileTableOptions): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const ownerUserID = state.session.authenticatedUser?.userID;
    if (
      ownerUserID === undefined
      || room.kind !== 'pregame'
      || room.role !== 'player'
      || room.data.owner !== ownerUserID
      || state.room.pendingUpdate !== null
    ) return false;
    let frame: string;
    try {
      frame = encodeTableUpdateFrame(
        room.tableID, name, maxPlayers, room.data.options, changes,
      );
    } catch {
      return false;
    }
    if (!this.sendEncoded(frame)) return false;
    this.store.dispatch(roomActions.updateRequested({
      epoch: state.session.connectionEpoch, tableID: room.tableID, ownerUserID,
      name: name.trim(), maxPlayers, changes,
    }));
    return this.store.getState().room.pendingUpdate?.tableID === room.tableID;
  }

  setTableLeader(name: string): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const ownerUserID = state.session.authenticatedUser?.userID;
    if (
      ownerUserID === undefined
      || room.kind !== 'pregame'
      || room.role !== 'player'
      || room.data.owner !== ownerUserID
      || !room.data.players.some((player) => player.name === name && !player.you)
      || state.room.pendingLeaderName !== null
    ) return false;
    if (!this.sendEncoded(encodeTableSetLeaderFrame(room.tableID, name))) return false;
    this.store.dispatch(roomActions.leaderRequested({
      epoch: state.session.connectionEpoch, tableID: room.tableID, ownerUserID, name,
    }));
    return this.store.getState().room.pendingLeaderName === name;
  }

  leave(tableID: number): boolean {
    const state = this.store.getState();
    if (
      state.room.room.kind !== 'pregame'
      || state.room.room.tableID !== tableID
      || state.room.pendingLeaveTableID !== null
      || state.room.pendingStart !== null
    ) {
      return false;
    }

    const sent = this.sendEncoded(state.room.room.role === 'player'
      ? encodeTableLeaveFrame(tableID)
      : encodeTableUnattendFrame(tableID));
    if (!sent) return false;

    this.store.dispatch(roomActions.leaveRequested({
      epoch: state.session.connectionEpoch,
      tableID,
    }));
    return true;
  }

  unattendLiveGame(tableID: number): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'live_game'
      || room.tableID !== tableID
      || state.room.pendingUnattendTableID !== null
    ) return false;

    const sent = this.sendEncoded(encodeTableUnattendFrame(tableID));
    if (!sent) return false;

    this.store.dispatch(roomActions.unattendRequested({
      epoch: state.session.connectionEpoch,
      tableID,
    }));
    return this.store.getState().room.pendingUnattendTableID === tableID;
  }

  navigateReplaySegment(segment: number): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'live_game'
      || !Number.isInteger(segment)
      || segment < 0
      || room.clientState.replay.states[segment] === undefined
    ) return false;
    const shared = room.clientState.replay.shared;
    if (shared === null || !shared.amLeader) {
      this.store.dispatch(roomActions.reviewSegmentSelected({
        tableID: room.tableID,
        gameLoadEpoch: room.gameLoadEpoch,
        segment,
      }));
      return true;
    }
    if (!this.isReadyCurrentRoom(room.tableID)) return false;
    return this.sendEncoded(encodeReplayActionFrame(room.tableID, segment));
  }

  followReplayLeader(): boolean {
    const room = this.store.getState().room.room;
    if (
      room.kind !== 'live_game'
      || room.clientState.replay.shared === null
      || room.clientState.replay.shared.amLeader
      || room.clientState.replay.shared.useSharedSegments
    ) return false;
    this.store.dispatch(roomActions.followReplayLeader({
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
    }));
    return true;
  }

  quickRematch(): boolean {
    return this.restartSharedReplay(true);
  }

  restartToPregame(): boolean {
    return this.restartSharedReplay(false);
  }

  private restartSharedReplay(hidePregame: boolean): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'live_game'
      || !(hidePregame
        ? isQuickRematchEligible(room.clientState, state.room.pendingRestartTableID)
        : isRestartToPregameEligible(room.clientState, state.room.pendingRestartTableID))
      || !this.isReadyCurrentRoom(room.tableID)
    ) return false;
    this.store.dispatch(roomActions.restartRequested({
      epoch: state.session.connectionEpoch,
      tableID: room.tableID,
      hidePregame,
    }));
    if (this.store.getState().room.pendingRestartTableID !== room.tableID) return false;
    let sent = false;
    try {
      sent = this.sendEncoded(encodeTableRestartFrame(room.tableID, hidePregame));
    } catch {
      sent = false;
    }
    if (!sent) this.store.dispatch(roomActions.commandPendingCleared({
      epoch: state.session.connectionEpoch,
    }));
    return sent;
  }

  play(cardOrder: number): boolean {
    return this.sendGameplayAction({ type: 0, target: cardOrder });
  }

  discard(cardOrder: number): boolean {
    return this.sendGameplayAction({ type: 1, target: cardOrder });
  }

  colorClue(targetPlayerIndex: number, colorIndex: number): boolean {
    return this.sendGameplayAction({
      type: 2,
      target: targetPlayerIndex,
      value: colorIndex,
    });
  }

  rankClue(targetPlayerIndex: number, rank: number): boolean {
    return this.sendGameplayAction({
      type: 3,
      target: targetPlayerIndex,
      value: rank,
    });
  }

  pauseGame(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'live_game'
      || room.role !== 'player'
      || room.sharedReplay
      || room.clientState.finished
      || room.clientState.replay.active
      || room.clientState.ongoingGame.turn.currentPlayerIndex === null
      || !room.clientState.metadata.options.timed
      || !this.isReadyCurrentRoom(room.tableID)
    ) return false;
    const pause = room.clientState.pause;
    const ownTurn = room.clientState.ongoingGame.turn.currentPlayerIndex
      === room.clientState.metadata.ourPlayerIndex;
    const setting = pause.active
      ? 'unpause'
      : ownTurn
        ? 'pause'
        : pause.queued
          ? 'pause-unqueue'
          : 'pause-queue';
    let sent = false;
    try {
      sent = this.sendEncoded(encodePauseFrame(room.tableID, setting));
    } catch {
      sent = false;
    }
    if (!sent) return false;
    if (setting === 'pause-queue' || setting === 'pause-unqueue') {
      this.store.dispatch(roomActions.pauseQueueChanged({
        connectionEpoch: state.session.connectionEpoch,
        tableID: room.tableID,
        gameLoadEpoch: room.gameLoadEpoch,
        queued: setting === 'pause-queue',
      }));
    }
    return true;
  }

  editNote(cardOrder: number, text: string): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'live_game'
      || room.clientState.finished
      || room.sharedReplay
      || room.clientState.replay.active
      || !Number.isInteger(cardOrder)
      || cardOrder < 0
      || text.length > 300
      || !this.isReadyCurrentRoom(room.tableID)
    ) return false;

    const parsed = noteCommandSchema.safeParse({
      tableID: room.tableID,
      order: cardOrder,
      note: text,
    });
    if (!parsed.success) return false;
    const order = parsed.data.order;
    const hands = room.clientState.ongoingGame.hands;
    const editable = room.role === 'player'
      ? hands[room.clientState.metadata.ourPlayerIndex]?.includes(order) ?? false
      : hands.some((hand) => hand.includes(order));
    if (!editable) return false;

    let sent = false;
    try {
      sent = this.sendEncoded(encodeNoteFrame(room.tableID, order, text));
    } catch {
      sent = false;
    }
    if (!sent) return false;
    this.store.dispatch(roomActions.noteActionAccepted({
      connectionEpoch: state.session.connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      noteAction: { type: 'editNote', order, text },
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

    if (decoded.kind === 'unknown') {
      this.recordInboundDiagnostic(owned.epoch, {
        command: decoded.command,
        classification: 'unknown',
      });
      return;
    }
    if (decoded.kind === 'malformed') {
      const command = decoded.command ?? 'frame';
      if (command === 'gameAction') {
        this.store.dispatch(sessionActions.gameActionFrameSeen({ epoch: owned.epoch }));
      }
      this.recordInboundDiagnostic(owned.epoch, {
        command,
        classification: 'malformed',
      });
      this.store.dispatch(sessionActions.protocolIssue({
        epoch: owned.epoch,
        issue: `${command}: ${decoded.issue}`,
      }));
      return;
    }

    if (decoded.event.command === 'gameAction') {
      const result = this.gameBootstrap.receiveIncrementalDetailed(
        owned.epoch,
        decoded.event.data,
      );
      this.recordInboundDiagnostic(owned.epoch, {
        command: decoded.event.command,
        classification: 'known',
        gameAction: {
          tableID: decoded.event.data.tableID,
          actionType: decoded.event.data.action.type,
          accepted: result.accepted,
          rejectionReason: result.rejectionReason,
        },
      });
      this.store.dispatch(sessionActions.gameActionDiagnosticRecorded({
        epoch: owned.epoch,
        diagnostic: {
          tableID: decoded.event.data.tableID,
          actionType: decoded.event.data.action.type,
          accepted: result.accepted,
          rejectionReason: result.rejectionReason,
        },
      }));
      return;
    }

    this.recordInboundDiagnostic(owned.epoch, {
      command: decoded.event.command,
      classification: 'known',
    });

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
        this.retryAttempt = 0;
        this.store.dispatch(sessionActions.welcomeReceived({ epoch, welcome: event.data }));
        this.resumeAuthoritativeRoom(epoch, event.data);
        break;
      case 'userList':
        this.store.dispatch(lobbyActions.userListReceived({ epoch, users: event.data }));
        break;
      case 'user':
        this.store.dispatch(lobbyActions.userReceived({ epoch, user: event.data }));
        if (event.data.userID === this.store.getState().session.authenticatedUser?.userID) {
          const role = event.data.status >= USER_STATUS_PLAYER_MIN
            && event.data.status <= USER_STATUS_PLAYER_MAX
            ? 'player'
            : event.data.status === USER_STATUS_SPECTATOR ? 'spectator' : null;
          if (role !== null && event.data.tableID !== undefined && event.data.tableID > 0) {
            const before = this.store.getState().room.room;
            this.store.dispatch(roomActions.restartMigrationConfirmed({
              epoch, tableID: event.data.tableID, role,
            }));
            if (before.kind === 'live_game' && this.store.getState().room.room.kind === 'none') {
              this.gameBootstrap.invalidate();
            }
          }
        }
        if (
          event.data.userID === this.store.getState().session.authenticatedUser?.userID
          && event.data.status === USER_STATUS_LOBBY
        ) this.store.dispatch(roomActions.unattendConfirmed({ epoch }));
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
      case 'game':
        if (this.rejectUnsupportedRoom(epoch, event.data.tableID, event.data.options)) break;
        this.store.dispatch(roomActions.gameReceived({ epoch, game: event.data }));
        break;
      case 'joined':
        this.store.dispatch(roomActions.joinedReceived({ epoch, joined: event.data }));
        break;
      case 'left':
        this.store.dispatch(roomActions.leftReceived({ epoch, left: event.data }));
        break;
      case 'tableStart':
        this.store.dispatch(roomActions.tableStartReceived({
          epoch,
          tableStart: event.data,
        }));
        this.gameBootstrap.startFromAuthoritativeRoom(epoch);
        break;
      case 'init': {
        const gameLoadEpoch = this.gameBootstrap.currentGameLoadEpoch;
        if (gameLoadEpoch !== null) {
          this.gameBootstrap.receiveInit(epoch, gameLoadEpoch, event.data);
        }
        break;
      }
      case 'gameActionList': {
        const gameLoadEpoch = this.gameBootstrap.currentGameLoadEpoch;
        if (gameLoadEpoch !== null) {
          this.gameBootstrap.receiveHistory(epoch, gameLoadEpoch, event.data);
        }
        break;
      }
      case 'pause':
        this.gameBootstrap.receivePause(epoch, event.data, this.nowMs());
        break;
      case 'clock':
        this.gameBootstrap.receiveClock(epoch, event.data, this.nowMs());
        break;
      case 'gameHistory':
        this.gameBootstrap.receiveGameHistory(epoch, event.data);
        break;
      case 'cardIdentities':
        this.gameBootstrap.receiveCardIdentities(epoch, event.data);
        break;
      case 'finishOngoingGame':
        this.gameBootstrap.receiveFinishOngoingGame(epoch, event.data);
        break;
      case 'replaySegment':
        this.store.dispatch(roomActions.sharedReplaySegmentReceived({
          epoch,
          tableID: event.data.tableID,
          segment: event.data.segment,
        }));
        break;
      case 'replayLeader':
        this.store.dispatch(roomActions.sharedReplayLeaderReceived({
          epoch,
          tableID: event.data.tableID,
          name: event.data.name,
        }));
        break;
      case 'spectators':
        this.store.dispatch(roomActions.spectatorsReceived({
          epoch,
          tableID: event.data.tableID,
          spectators: event.data.spectators,
        }));
        break;
      case 'noteListPlayer': {
        const room = this.store.getState().room.room;
        if (room.kind !== 'live_game') break;
        this.store.dispatch(roomActions.noteActionAccepted({
          connectionEpoch: epoch,
          tableID: event.data.tableID,
          gameLoadEpoch: room.gameLoadEpoch,
          noteAction: { type: 'noteListPlayer', texts: event.data.notes },
        }));
        break;
      }
      case 'noteList': {
        const room = this.store.getState().room.room;
        if (room.kind !== 'live_game') break;
        this.store.dispatch(roomActions.noteActionAccepted({
          connectionEpoch: epoch,
          tableID: event.data.tableID,
          gameLoadEpoch: room.gameLoadEpoch,
          noteAction: {
            type: 'noteList',
            names: event.data.notes.map((notes) => notes.name),
            noteTextLists: event.data.notes.map((notes) => notes.notes),
            isSpectators: event.data.notes.map((notes) => notes.isSpectator),
          },
        }));
        break;
      }
      case 'note': {
        const room = this.store.getState().room.room;
        if (room.kind !== 'live_game') break;
        this.store.dispatch(roomActions.noteActionAccepted({
          connectionEpoch: epoch,
          tableID: event.data.tableID,
          gameLoadEpoch: room.gameLoadEpoch,
          noteAction: {
            type: 'receiveNote',
            order: event.data.order,
            notes: event.data.notes,
          },
        }));
        break;
      }
      case 'connected': {
        const room = this.store.getState().room.room;
        if (room.kind !== 'live_game') break;
        this.store.dispatch(roomActions.connectedReceived({
          connectionEpoch: epoch,
          tableID: event.data.tableID,
          gameLoadEpoch: room.gameLoadEpoch,
          list: event.data.list,
        }));
        break;
      }
      case 'userInactive':
        this.store.dispatch(lobbyActions.userInactiveReceived({
          epoch,
          userID: event.data.userID,
          inactive: event.data.inactive,
        }));
        break;
      case 'voteChange': {
        const state = this.store.getState();
        const room = state.room.room;
        if (
          state.session.connectionEpoch !== epoch
          || state.session.phase !== 'ready'
          || state.room.connectionEpoch !== epoch
          || room.kind !== 'live_game'
          || room.role !== 'player'
          || room.sharedReplay
          || room.clientState.finished
          || room.clientState.ongoingGame.turn.currentPlayerIndex === null
        ) break;
        this.store.dispatch(terminationActions.voteChanged({
          connectionEpoch: epoch,
          tableID: room.tableID,
          gameLoadEpoch: room.gameLoadEpoch,
          value: event.data.vote,
        }));
        break;
      }
      case 'boot':
        {
          const room = this.store.getState().room.room;
          if (
            room.kind === 'live_game'
            && room.tableID === event.data.TableID
            && room.clientState.replay.shared !== null
          ) {
            this.store.dispatch(roomActions.bootReceived({ epoch, boot: event.data }));
          }
        }
        break;
      case 'chat':
        this.store.dispatch(chatActions.messageReceived({
          epoch,
          message: event.data,
        }));
        break;
      case 'chatList':
        this.store.dispatch(chatActions.historyReceived({
          epoch,
          defaultRoom: this.currentHistoryRoom(),
          messages: event.data.list,
        }));
        break;
      case 'warning':
        this.store.dispatch(roomActions.commandPendingCleared({ epoch }));
        this.clearCurrentGameplayPending(epoch);
        this.store.dispatch(lobbyActions.noticeReceived({
          epoch,
          notice: { kind: 'warning', message: event.data.warning.slice(0, MAX_STATUS_LENGTH) },
        }));
        break;
      case 'error':
        this.store.dispatch(roomActions.commandPendingCleared({ epoch }));
        this.clearCurrentGameplayPending(epoch);
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
    this.gameBootstrap.invalidate();
    this.dispose(owned, false);
    this.store.dispatch(sessionActions.connectionClosed({
      epoch: owned.epoch,
      error: event.code === 1000 ? null : `WebSocket closed (${event.code})`,
    }));
    this.scheduleRetry();
  }

  private failCurrent(owned: OwnedConnection, error: string): void {
    if (!this.isCurrent(owned)) return;
    this.current = null;
    this.gameBootstrap.invalidate();
    this.dispose(owned, true);
    this.store.dispatch(sessionActions.connectionFailed({
      epoch: owned.epoch,
      error,
    }));
    this.scheduleRetry();
  }

  private resumeAuthoritativeRoom(
    epoch: number,
    welcome: Extract<ServerEvent, { command: 'welcome' }>['data'],
  ): void {
    const playerTableID = welcome.playingAtTables[0];
    if (playerTableID !== undefined) {
      if (this.sendEncoded(encodeTableReattendFrame(playerTableID))) {
        this.store.dispatch(roomActions.recoveryRequested({
          epoch,
          tableID: playerTableID,
          role: 'player',
        }));
      }
      return;
    }

    const spectatorTableID = welcome.disconSpectatingTable;
    if (spectatorTableID !== undefined && spectatorTableID > 0) {
      const shadowingPlayerIndex = welcome.disconShadowingSeat;
      if (shadowingPlayerIndex === undefined) {
        this.store.dispatch(sessionActions.protocolIssue({
          epoch,
          issue: 'welcome: missing disconShadowingSeat for spectator recovery',
        }));
        return;
      }
      if (this.sendEncoded(encodeTableSpectateFrame(
        spectatorTableID,
        shadowingPlayerIndex,
      ))) {
        this.store.dispatch(roomActions.recoveryRequested({
          epoch,
          tableID: spectatorTableID,
          role: 'spectator',
        }));
      }
      return;
    }
  }

  private isReadyCurrentRoom(tableID: number): boolean {
    const state = this.store.getState();
    const owned = this.current;
    return owned !== null
      && owned.epoch === this.connectionEpoch
      && owned.epoch === state.session.connectionEpoch
      && owned.socket !== null
      && owned.socket.readyState === SOCKET_OPEN
      && state.session.phase === 'ready'
      && state.room.connectionEpoch === owned.epoch
      && state.room.room.kind === 'live_game'
      && state.room.room.tableID === tableID;
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

  private sendGameplayAction(
    intent:
      | { type: 0 | 1; target: number }
      | { type: 2 | 3; target: number; value: number },
  ): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const owned = this.current;
    if (
      owned === null
      || owned.epoch !== this.connectionEpoch
      || owned.epoch !== state.session.connectionEpoch
      || owned.socket === null
      || owned.socket.readyState !== SOCKET_OPEN
      || state.session.phase !== 'ready'
      || state.room.connectionEpoch !== owned.epoch
      || room.kind !== 'live_game'
      || room.role !== 'player'
      || room.clientState.replay.active
      || room.clientState.pause.active
      || room.clientState.ongoingGame.turn.currentPlayerIndex
        !== room.clientState.metadata.ourPlayerIndex
      || state.room.pendingGameplayAction !== null
    ) return false;

    const candidate = { tableID: room.tableID, ...intent };
    const parsed = clientGameplayActionSchema.safeParse(candidate);
    if (!parsed.success) return false;
    const action = parsed.data;
    const ourPlayerIndex = room.clientState.metadata.ourPlayerIndex;
    if (
      (action.type === 0 || action.type === 1)
      && !(room.clientState.ongoingGame.hands[ourPlayerIndex]?.includes(action.target) ?? false)
    ) return false;
    if (action.type === 2 || action.type === 3) {
      if (
        action.target === ourPlayerIndex
        || action.target < 0
        || action.target >= room.clientState.metadata.options.numPlayers
      ) return false;
      const variantName = room.clientState.metadata.options.variantName;
      if (
        !hasClueTokenForVariant(room.clientState.ongoingGame.clueTokens, variantName)
        ||
        (action.type === 2
          && !isCurrentVariantColorClueValue(variantName, action.value))
        || (action.type === 3
          && !isCurrentVariantRankClueValue(variantName, action.value))
      ) return false;
    }

    const pending = {
      connectionEpoch: owned.epoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      action,
    };
    this.store.dispatch(roomActions.gameplayActionRequested(pending));
    if (this.store.getState().room.pendingGameplayAction === null) return false;

    let sent = false;
    try {
      sent = this.sendEncoded(this.encodeGameplayFrame(action));
    } catch {
      sent = false;
    }
    if (!sent) this.store.dispatch(roomActions.gameplayPendingCleared(pending));
    return sent;
  }

  private encodeGameplayFrame(action: ClientGameplayAction): string {
    switch (action.type) {
      case 0: return encodePlayFrame(action.tableID, action.target);
      case 1: return encodeDiscardFrame(action.tableID, action.target);
      case 2: return encodeColorClueFrame(action.tableID, action.target, action.value);
      case 3: return encodeRankClueFrame(action.tableID, action.target, action.value);
    }
  }

  private clearCurrentGameplayPending(connectionEpoch: number): void {
    const pending = this.store.getState().room.pendingGameplayAction;
    if (pending === null || pending.connectionEpoch !== connectionEpoch) return;
    this.store.dispatch(roomActions.gameplayPendingCleared({
      connectionEpoch,
      tableID: pending.tableID,
      gameLoadEpoch: pending.gameLoadEpoch,
    }));
  }

  private currentChatRoom(): string {
    const room = this.store.getState().room.room;
    return room.kind === 'none' ? 'lobby' : `table${room.tableID}`;
  }

  private rejectUnsupportedRoom(
    epoch: number,
    tableID: number,
    options: Parameters<typeof areTableOptionsSupported>[0],
  ): boolean {
    if (areTableOptionsSupported(options)) return false;
    const state = this.store.getState().room;
    const relevant = state.pendingRecovery?.tableID === tableID
      || state.pendingJoin?.tableID === tableID
      || state.pendingSpectateTableID === tableID
      || state.rematchTransition?.newTableID === tableID;
    if (!relevant) return false;
    this.gameBootstrap.invalidate();
    this.sendEncoded(encodeTableUnattendFrame(tableID));
    this.store.dispatch(roomActions.unsupportedRoomRejected({ epoch, tableID }));
    this.store.dispatch(lobbyActions.noticeReceived({
      epoch,
      notice: { kind: 'warning', message: UNSUPPORTED_TABLE_WARNING },
    }));
    return true;
  }

  private currentHistoryRoom(): string {
    const state = this.store.getState().room;
    if (state.room.kind !== 'none') return `table${state.room.tableID}`;
    if (state.pendingJoin !== null) return `table${state.pendingJoin.tableID}`;
    const createdTableID = state.pendingCreate?.joinedTableID
      ?? state.pendingCreate?.stagedGame?.tableID;
    const rematchTableID = state.rematchTransition?.newTableID;
    if (rematchTableID !== undefined && rematchTableID !== null) {
      return `table${rematchTableID}`;
    }
    return createdTableID === undefined || createdTableID === null
      ? 'lobby'
      : `table${createdTableID}`;
  }

  private resetConfirmedMissingSession(): void {
    this.maintainConnection = false;
    this.retryAttempt = 0;
    this.cancelRetry();
    const owned = this.current;
    this.current = null;
    this.gameBootstrap.invalidate();
    if (owned !== null) this.dispose(owned, true);
    this.store.dispatch(sessionActions.signedOut());
  }

  private recordInboundDiagnostic(
    epoch: number,
    diagnostic: Parameters<
      typeof sessionActions.inboundDiagnosticRecorded
    >[0]['diagnostic'],
  ): void {
    this.store.dispatch(sessionActions.inboundDiagnosticRecorded({
      epoch,
      diagnostic,
    }));
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
  return areTableOptionsSupported(table.options)
    && table.running
    && (table.sharedReplay || !table.joined);
}

export function isPregameSpectateEligible(table: LobbyTable): boolean {
  return areTableOptionsSupported(table.options)
    && !table.running
    && !table.sharedReplay
    && !table.joined;
}

export function isJoinEligible(table: LobbyTable): boolean {
  return !table.running
    && !table.sharedReplay
    && !table.joined
    && areTableOptionsSupported(table.options)
    && table.numPlayers < table.maxPlayers;
}

export function isReattendEligible(table: LobbyTable): boolean {
  return table.running
    && table.joined
    && !table.sharedReplay
    && areTableOptionsSupported(table.options);
}

export function isQuickRematchEligible(
  clientState: Extract<
    ReturnType<AppStore['getState']>['room']['room'],
    { kind: 'live_game' }
  >['clientState'],
  pendingRestartTableID: number | null,
): boolean {
  const shared = clientState.replay.shared;
  if (
    shared === null
    || !shared.amLeader
    || pendingRestartTableID !== null
    || !clientState.metadata.playerNames.includes(clientState.metadata.ourUsername)
    || clientState.spectators.length < 2
  ) return false;
  const activeNames = new Set(clientState.spectators.map((spectator) => spectator.name));
  return clientState.metadata.playerNames.every((name) => activeNames.has(name));
}

export function isRestartToPregameEligible(
  clientState: Parameters<typeof isQuickRematchEligible>[0],
  pendingRestartTableID: number | null,
): boolean {
  const shared = clientState.replay.shared;
  return shared !== null
    && shared.amLeader
    && pendingRestartTableID === null
    && clientState.metadata.playerNames.includes(clientState.metadata.ourUsername)
    && clientState.spectators.length >= 2;
}
