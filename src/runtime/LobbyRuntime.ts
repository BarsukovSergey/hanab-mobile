import type {
  NetworkSession,
  SessionCheckResult,
} from '../network/types';
import { GameBootstrapCoordinator } from '../game/bootstrap/GameBootstrapCoordinator';
import {
  areTableOptionsSupported,
} from '../game/client/supportedVariants';
import {
  decodeServerFrame,
  encodeCardPresentationSettingFrame,
  encodeGameplayPresentationSettingFrame,
  encodeChatFrame,
  encodeChatReadFrame,
  encodeInactiveFrame,
  type GameplayPresentationSettingName,
  encodeClientFrame,
  encodeTableRestartFrame,
  encodeTableReattendFrame,
  encodeTableSpectateFrame,
  encodeTableUnattendFrame,
  type CardPresentationSettingName,
  type MobileTableOptions,
  type ServerEvent,
} from '../protocol/lobbyProtocol';
import type { ActionIncludingHypothetical } from '../game/client/types/actions';
import { chatActions } from '../store/chatSlice';
import { lobbyActions } from '../store/lobbySlice';
import { roomActions } from '../store/roomSlice';
import { sessionActions } from '../store/sessionSlice';
import { terminationActions } from '../store/terminationSlice';
import { historyActions } from '../store/historySlice';
import type { AppStore } from '../store/store';
import {
  ConnectionRuntime,
  DEFAULT_WELCOME_TIMEOUT_MS,
  DEFAULT_RETRY_DELAYS_MS,
  type RuntimeTimers,
} from './ConnectionRuntime';
import { GameplayRuntime } from './GameplayRuntime';
import { RoomAttendanceRuntime } from './RoomAttendanceRuntime';
import { HistoryRuntime } from './HistoryRuntime';
import { ReplayInteractionRuntime } from './ReplayInteractionRuntime';
import { TableManagementRuntime } from './TableManagementRuntime';
import {
  isQuickRematchEligible,
  isRestartToPregameEligible,
} from './lobbyEligibility';

export type { RuntimeTimers } from './ConnectionRuntime';

const MAX_STATUS_LENGTH = 240;
const USER_STATUS_LOBBY = 0;
const USER_STATUS_PLAYER_MIN = 1;
const USER_STATUS_PLAYER_MAX = 2;
const USER_STATUS_SPECTATOR = 3;
const UNSUPPORTED_TABLE_WARNING = 'This table uses options that Hanab Mobile does not support.';

export type SignOutResult =
  | { kind: 'signedOut' }
  | { kind: 'superseded' }
  | { kind: 'failed'; message: string; sessionValid: boolean };

export type SessionProbeResult = SessionCheckResult | { kind: 'superseded' };

function safeStatus(value: unknown, fallback: string): string {
  const message = value instanceof Error ? value.message : fallback;
  return message.slice(0, MAX_STATUS_LENGTH);
}

export class LobbyRuntime {
  private sessionOperationGeneration = 0;
  private readonly connectionRuntime: ConnectionRuntime;
  private readonly gameBootstrap: GameBootstrapCoordinator;
  private readonly gameplayRuntime: GameplayRuntime;
  private readonly roomAttendanceRuntime: RoomAttendanceRuntime;
  private readonly tableManagementRuntime: TableManagementRuntime;
  private readonly historyRuntime: HistoryRuntime;
  private readonly replayInteractionRuntime: ReplayInteractionRuntime;

  constructor(
    private readonly networkSession: NetworkSession,
    private readonly store: AppStore,
    timers: RuntimeTimers = {
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: (timer) => clearTimeout(timer),
    },
    welcomeTimeoutMs = DEFAULT_WELCOME_TIMEOUT_MS,
    retryDelaysMs: readonly number[] = DEFAULT_RETRY_DELAYS_MS,
    private readonly nowMs: () => number = Date.now,
  ) {
    this.tableManagementRuntime = new TableManagementRuntime(
      store,
      (frame) => this.sendEncoded(frame),
      (message) => this.send('chatPM', message),
      (tableID) => this.isReadyCurrentRoom(tableID, 'pregame'),
    );
    this.roomAttendanceRuntime = new RoomAttendanceRuntime(
      store,
      (frame) => this.sendEncoded(frame),
      (tableID) => this.isReadyCurrentRoom(tableID),
    );
    this.gameplayRuntime = new GameplayRuntime(
      store,
      (frame) => this.sendEncoded(frame),
      (tableID) => this.isReadyCurrentRoom(tableID),
    );
    this.historyRuntime = new HistoryRuntime(
      store,
      {
        fetchTaggedGames: (username) => networkSession.fetchTaggedGames(username),
        searchTag: (tag) => networkSession.searchTag(tag),
      },
      (frame) => this.sendEncoded(frame),
    );
    this.replayInteractionRuntime = new ReplayInteractionRuntime(
      store,
      (frame) => this.sendEncoded(frame),
      (tableID) => this.isReadyCurrentRoom(tableID),
      (epoch) => this.recordInboundDiagnostic(epoch, { command: 'hypothetical', classification: 'malformed' }),
    );
    this.gameBootstrap = new GameBootstrapCoordinator(
      store,
      (frame) => this.sendEncoded(frame),
      timers,
    );
    this.connectionRuntime = new ConnectionRuntime(
      networkSession,
      {
        getPhase: () => store.getState().session.phase,
        onStarted: (epoch) => {
          this.sessionOperationGeneration += 1;
          this.tableManagementRuntime.clearTransientState();
          this.gameBootstrap.invalidateConnection(epoch);
          store.dispatch(sessionActions.connectionStarted({ epoch }));
        },
        onOpened: (epoch) => store.dispatch(sessionActions.socketOpened({ epoch })),
        onInvalidated: () => {
          this.tableManagementRuntime.clearTransientState();
          this.gameBootstrap.invalidate();
        },
        onClosed: (epoch, error) => store.dispatch(sessionActions.connectionClosed({ epoch, error })),
        onFailed: (epoch, error) => store.dispatch(sessionActions.connectionFailed({ epoch, error })),
        onFrame: (epoch, rawFrame) => this.onMessage(epoch, rawFrame),
        onAppActiveChanged: (active) => { this.sendEncoded(encodeInactiveFrame(!active)); },
      },
      store.getState().session.connectionEpoch,
      timers,
      welcomeTimeoutMs,
      retryDelaysMs,
    );
  }

  connect(): Promise<void> {
    this.sessionOperationGeneration += 1;
    return this.connectionRuntime.connect();
  }

  retryGameBootstrap(): boolean {
    const room = this.store.getState().room.room;
    if (room.kind !== 'awaiting_game_bootstrap'
      || room.bootstrap === 'pending_c5'
      || room.bootstrap.phase !== 'failed') return false;

    // A READY socket can own a terminal failed load. Replace its ownership,
    // invalidating bootstrap/timers before disposal, then use only fresh welcome
    // resume hints. Never retain or resend the command that opened this room.
    this.disconnect();
    void this.connect();
    return true;
  }

  disconnect(): void {
    this.sessionOperationGeneration += 1;
    this.connectionRuntime.disconnect();
  }

  checkSession(ownsDelivery: () => boolean = () => true): Promise<SessionProbeResult> {
    if (!ownsDelivery()) return Promise.resolve({ kind: 'superseded' });
    return this.probeSession(this.beginSessionOperation(ownsDelivery));
  }

  private beginSessionOperation(ownsDelivery: () => boolean): () => boolean {
    const generation = ++this.sessionOperationGeneration;
    return () => generation === this.sessionOperationGeneration && ownsDelivery();
  }

  private async probeSession(isCurrent: () => boolean): Promise<SessionProbeResult> {
    if (!isCurrent()) return { kind: 'superseded' };
    const result = await this.networkSession.checkSession();
    if (!isCurrent()) return { kind: 'superseded' };
    if (result.kind === 'missing') this.resetConfirmedMissingSession();
    return isCurrent() ? result : { kind: 'superseded' };
  }

  async signOut(ownsDelivery: () => boolean = () => true): Promise<SignOutResult> {
    if (!ownsDelivery()) return { kind: 'superseded' };
    // Stop retry/socket ownership before the cookie-changing HTTP request.
    const isCurrent = this.beginSessionOperation(ownsDelivery);
    this.connectionRuntime.disconnect();
    if (!isCurrent()) return { kind: 'superseded' };
    let logoutError: string | null = null;
    try {
      await this.networkSession.logout();
    } catch (error) {
      logoutError = safeStatus(error, 'Logout request failed');
    }

    if (!isCurrent()) return { kind: 'superseded' };
    const check = await this.probeSession(isCurrent);
    if (!isCurrent() || check.kind === 'superseded') return { kind: 'superseded' };
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
    this.connectionRuntime.setAppActive(active);
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

  markChatRead(room: string): boolean {
    const match = /^table([1-9]\d*)$/.exec(room);
    if (match === null) return false;
    const tableID = Number(match[1]);
    if (!Number.isInteger(tableID)) return false;
    const state = this.store.getState();
    const currentRoom = state.room.room;
    if (state.session.phase !== 'ready'
      || (currentRoom.kind !== 'pregame' && currentRoom.kind !== 'live_game')
      || currentRoom.tableID !== tableID) return false;
    try {
      return this.sendEncoded(encodeChatReadFrame(tableID));
    } catch {
      return false;
    }
  }

  setCardPresentationSetting(
    name: CardPresentationSettingName,
    enabled: boolean,
  ): boolean {
    const state = this.store.getState();
    if (state.session.phase !== 'ready') return false;
    if (state.session.cardPresentationSettings[name] === enabled) return true;

    if (!this.sendEncoded(encodeCardPresentationSettingFrame(name, enabled))) return false;
    this.store.dispatch(sessionActions.cardPresentationSettingUpdated({ name, enabled }));
    return true;
  }

  setGameplayPresentationSetting(
    name: GameplayPresentationSettingName,
    enabled: boolean,
  ): boolean {
    const state = this.store.getState();
    if (state.session.phase !== 'ready') return false;
    if (state.session[name] === enabled) return true;

    if (!this.sendEncoded(encodeGameplayPresentationSettingFrame(name, enabled))) return false;
    this.store.dispatch(sessionActions.gameplayPresentationSettingUpdated({ name, enabled }));
    return true;
  }

  loadMoreHistory(): boolean {
    return this.historyRuntime.loadMoreHistory();
  }

  ensureFriendsHistory(): boolean {
    return this.historyRuntime.ensureFriendsHistory();
  }

  ensureTaggedGames(): boolean {
    return this.historyRuntime.ensureTaggedGames();
  }

  searchTag(tag: string): boolean {
    return this.historyRuntime.searchTag(tag);
  }

  clearTagSearch(): void {
    this.historyRuntime.clearTagSearch();
  }

  loadMoreFriendsHistory(): boolean {
    return this.historyRuntime.loadMoreFriendsHistory();
  }

  loadOtherScores(databaseID: number, friends: boolean): boolean {
    return this.historyRuntime.loadOtherScores(databaseID, friends);
  }

  dismissOtherScores(): void {
    this.historyRuntime.dismissOtherScores();
  }

  watchHistoricalGame(databaseID: number, visibility: 'solo' | 'shared' = 'solo'): boolean {
    return this.historyRuntime.watchHistoricalGame(databaseID, visibility);
  }

  watchReplayByID(databaseID: number, visibility: 'solo' | 'shared'): boolean {
    return this.historyRuntime.watchReplayByID(databaseID, visibility);
  }

  watchJSONReplay(gameJSON: Record<string, unknown>, visibility: 'solo' | 'shared'): boolean {
    return this.historyRuntime.watchJSONReplay(gameJSON, visibility);
  }

  spectate(tableID: number): boolean {
    return this.roomAttendanceRuntime.spectate(tableID);
  }

  join(tableID: number, password?: string): boolean {
    return this.roomAttendanceRuntime.join(tableID, password);
  }

  reattend(tableID: number): boolean {
    return this.roomAttendanceRuntime.reattend(tableID);
  }

  openLiveGameByID(tableID: number): boolean {
    return this.roomAttendanceRuntime.openLiveGameByID(tableID);
  }

  openPregameByID(tableID: number, password?: string): boolean {
    return this.roomAttendanceRuntime.openPregameByID(tableID, password);
  }

  createTable(
    name: string,
    maxPlayers: number,
    options: MobileTableOptions | string,
    password = '',
    bots: readonly string[] = [],
  ): boolean {
    return this.tableManagementRuntime.createTable(name, maxPlayers, options, password, bots);
  }

  saveCreateTablePreferences(maxPlayers: number, options: MobileTableOptions): boolean {
    return this.tableManagementRuntime.saveCreateTablePreferences(maxPlayers, options);
  }

  inviteBots(tableID: number, names: readonly string[], password = ''): number {
    return this.tableManagementRuntime.inviteBots(tableID, names, password);
  }

  startGame(): boolean {
    return this.tableManagementRuntime.startGame();
  }

  updateTable(name: string, maxPlayers: number, changes: MobileTableOptions): boolean {
    return this.tableManagementRuntime.updateTable(name, maxPlayers, changes);
  }

  setTableLeader(name: string): boolean {
    return this.tableManagementRuntime.setTableLeader(name);
  }

  leave(tableID: number): boolean {
    return this.roomAttendanceRuntime.leave(tableID);
  }

  switchToSpectator(): boolean {
    return this.roomAttendanceRuntime.switchToSpectator();
  }

  joinAsPlayer(password?: string): boolean {
    return this.roomAttendanceRuntime.joinAsPlayer(password);
  }

  unattendLiveGame(tableID: number): boolean {
    return this.roomAttendanceRuntime.unattendLiveGame(tableID);
  }

  setSpectatorPerspective(shadowingPlayerIndex: number): boolean {
    return this.roomAttendanceRuntime.setSpectatorPerspective(shadowingPlayerIndex);
  }

  navigateReplaySegment(segment: number): boolean {
    return this.replayInteractionRuntime.navigateReplaySegment(segment);
  }

  followReplayLeader(): boolean {
    return this.replayInteractionRuntime.followReplayLeader();
  }

  startHypothetical(): boolean {
    return this.replayInteractionRuntime.startHypothetical();
  }

  setSharedReplayLeader(name: string): boolean {
    return this.replayInteractionRuntime.setSharedReplayLeader(name);
  }

  endHypothetical(): boolean {
    return this.replayInteractionRuntime.endHypothetical();
  }

  sendHypotheticalAction(action: ActionIncludingHypothetical): boolean {
    return this.replayInteractionRuntime.sendHypotheticalAction(action);
  }

  hypotheticalMorph(order: number, suitIndex: number, rank: number): boolean {
    return this.replayInteractionRuntime.hypotheticalMorph(order, suitIndex, rank);
  }

  hypotheticalUnmorph(order: number): boolean {
    return this.replayInteractionRuntime.hypotheticalUnmorph(order);
  }

  hypotheticalPlay(order: number): boolean {
    return this.replayInteractionRuntime.hypotheticalPlay(order);
  }

  hypotheticalDiscard(order: number): boolean {
    return this.replayInteractionRuntime.hypotheticalDiscard(order);
  }

  hypotheticalColorClue(target: number, value: number): boolean {
    return this.replayInteractionRuntime.hypotheticalColorClue(target, value);
  }

  hypotheticalRankClue(target: number, value: number): boolean {
    return this.replayInteractionRuntime.hypotheticalRankClue(target, value);
  }

  backHypothetical(): boolean {
    return this.replayInteractionRuntime.backHypothetical();
  }

  toggleHypotheticalDrawnCards(): boolean {
    return this.replayInteractionRuntime.toggleHypotheticalDrawnCards();
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
    return this.gameplayRuntime.play(cardOrder);
  }

  discard(cardOrder: number): boolean {
    return this.gameplayRuntime.discard(cardOrder);
  }

  colorClue(targetPlayerIndex: number, colorIndex: number): boolean {
    return this.gameplayRuntime.colorClue(targetPlayerIndex, colorIndex);
  }

  rankClue(targetPlayerIndex: number, rank: number): boolean {
    return this.gameplayRuntime.rankClue(targetPlayerIndex, rank);
  }

  pauseGame(): boolean {
    return this.gameplayRuntime.pauseGame();
  }

  editNote(cardOrder: number, text: string): boolean {
    return this.gameplayRuntime.editNote(cardOrder, text);
  }

  private onMessage(epoch: number, rawFrame: string): void {
    const decoded = decodeServerFrame(rawFrame);

    if (decoded.kind === 'unknown') {
      this.recordInboundDiagnostic(epoch, {
        command: decoded.command,
        classification: 'unknown',
      });
      return;
    }
    if (decoded.kind === 'malformed') {
      const command = decoded.command ?? 'frame';
      if (command === 'gameAction') {
        this.store.dispatch(sessionActions.gameActionFrameSeen({ epoch }));
      }
      this.recordInboundDiagnostic(epoch, {
        command,
        classification: 'malformed',
      });
      this.store.dispatch(sessionActions.protocolIssue({
        epoch,
        issue: `${command}: ${decoded.issue}`,
      }));
      return;
    }

    if (decoded.event.command === 'gameAction') {
      const failedRoom = this.store.getState().room.room;
      const result = this.gameBootstrap.receiveIncrementalDetailed(
        epoch,
        decoded.event.data,
      );
      const current = this.store.getState();
      const currentRoom = current.room.room;
      if (
        result.rejectionReason === 'reducer-failure'
        && failedRoom.kind === 'live_game'
        && !failedRoom.sharedReplay
        && !failedRoom.clientState.finished
        && currentRoom.kind === 'live_game'
        && currentRoom.tableID === failedRoom.tableID
        && currentRoom.gameLoadEpoch === failedRoom.gameLoadEpoch
        && current.session.connectionEpoch === epoch
        && current.room.connectionEpoch === epoch
        && current.session.phase === 'ready'
      ) {
        // Invalidate before diagnostic dispatch: synchronous store subscribers
        // must not send against a Live state that missed authoritative data.
        this.connectionRuntime.invalidateCurrent(epoch, 'Unable to process server event (gameAction)');
      }
      this.recordInboundDiagnostic(epoch, {
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
        epoch,
        diagnostic: {
          tableID: decoded.event.data.tableID,
          actionType: decoded.event.data.action.type,
          accepted: result.accepted,
          rejectionReason: result.rejectionReason,
        },
      }));
      return;
    }

    if (decoded.event.command === 'warning' || decoded.event.command === 'error') {
      const state = this.store.getState();
      const room = state.room.room;
      const pending = state.room.pendingGameplayAction;
      if (
        this.connectionRuntime.isReady(epoch)
        && state.session.connectionEpoch === epoch
        && state.room.connectionEpoch === epoch
        && room.kind === 'live_game'
        && !room.clientState.finished
        && pending?.connectionEpoch === epoch
        && pending.tableID === room.tableID
        && pending.gameLoadEpoch === room.gameLoadEpoch
      ) {
        // Generic responses have no request correlation. Rebuild uncertain gameplay
        // from server history before any diagnostic subscriber can send again.
        this.connectionRuntime.invalidateCurrent(epoch, 'Unable to confirm gameplay action');
      }
    }

    this.recordInboundDiagnostic(epoch, {
      command: decoded.event.command,
      classification: 'known',
    });

    this.applyEvent(epoch, decoded.event);
  }

  private applyEvent(epoch: number, event: ServerEvent): void {
    switch (event.command) {
      case 'welcome':
        if (!this.connectionRuntime.confirmWelcome(epoch)) return;
        this.store.dispatch(sessionActions.welcomeReceived({ epoch, welcome: event.data }));
        this.resumeAuthoritativeRoom(epoch, event.data);
        break;
      case 'shutdown':
        this.store.dispatch(sessionActions.shutdownReceived({ epoch, ...event.data }));
        break;
      case 'maintenance':
        this.store.dispatch(sessionActions.maintenanceReceived({ epoch, ...event.data }));
        break;
      case 'name':
        this.store.dispatch(sessionActions.randomTableNameReceived({ epoch, name: event.data.name }));
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
              this.store.dispatch(chatActions.draftRoomMigrated({
                oldTableID: before.tableID,
                newTableID: event.data.tableID,
              }));
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
      case 'tableProgress':
        this.store.dispatch(lobbyActions.tableProgressReceived({
          epoch, tableID: event.data.tableID, progress: event.data.progress,
        }));
        break;
      case 'tableGone':
        this.store.dispatch(lobbyActions.tableGone({ epoch, tableID: event.data.tableID }));
        break;
      case 'game':
        if (this.rejectUnsupportedRoom(epoch, event.data.tableID, event.data.options)) break;
        this.store.dispatch(roomActions.gameReceived({ epoch, game: event.data }));
        this.tableManagementRuntime.finishPendingBotCreate(epoch);
        break;
      case 'joined':
        this.store.dispatch(roomActions.joinedReceived({ epoch, joined: event.data }));
        this.tableManagementRuntime.finishPendingBotCreate(epoch);
        break;
      case 'left':
        this.store.dispatch(roomActions.leftReceived({ epoch, left: event.data }));
        break;
      case 'tableStart':
        {
          const pendingReplay = this.store.getState().history.pendingReplayCreate;
          if (
            event.data.replay
            && pendingReplay?.connectionEpoch === epoch
            && this.store.getState().room.room.kind === 'none'
          ) {
            this.store.dispatch(roomActions.historicalReplayTableStartReceived({
              epoch,
              tableStart: event.data,
              source: pendingReplay.source,
              visibility: pendingReplay.visibility,
              ...(pendingReplay.source === 'id' ? { databaseID: pendingReplay.databaseID } : {}),
            }));
            const room = this.store.getState().room.room;
            if (
              room.kind === 'awaiting_game_bootstrap'
              && room.tableID === event.data.tableID
              && room.expectedReplaySource === pendingReplay.source
              && room.expectedReplayVisibility === pendingReplay.visibility
              && room.expectedDatabaseID === (pendingReplay.source === 'id' ? pendingReplay.databaseID : null)
            ) this.store.dispatch(historyActions.replayCreateAccepted(pendingReplay));
          } else {
            this.store.dispatch(roomActions.tableStartReceived({
              epoch,
              tableStart: event.data,
            }));
          }
        }
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
        this.historyRuntime.receiveEvent(epoch, event);
        this.gameBootstrap.receiveGameHistory(epoch, event.data);
        break;
      case 'gameHistoryFriends':
        this.historyRuntime.receiveEvent(epoch, event);
        break;
      case 'gameHistoryOtherScores':
        this.historyRuntime.receiveEvent(epoch, event);
        break;
      case 'cardIdentities':
        this.gameBootstrap.receiveCardIdentities(epoch, event.data);
        break;
      case 'finishOngoingGame':
        this.gameBootstrap.receiveFinishOngoingGame(epoch, event.data);
        break;
      case 'replaySegment':
      case 'replayLeader':
      case 'replayEfficiencyMod':
        if (!this.gameBootstrap.stageSharedReplayControl(epoch, event)) {
          this.replayInteractionRuntime.receiveEvent(epoch, event);
        }
        break;
      case 'suggestion':
      case 'hypothetical':
      case 'hypoStart':
      case 'hypoEnd':
      case 'hypoAction':
      case 'hypoBack':
      case 'hypoShowDrawnCards':
        this.replayInteractionRuntime.receiveEvent(epoch, event);
        break;
      case 'spectators':
        this.store.dispatch(roomActions.spectatorsReceived({
          epoch,
          tableID: event.data.tableID,
          spectators: event.data.spectators,
        }));
        break;
      case 'pregameSpectators':
        this.store.dispatch(roomActions.pregameSpectatorsReceived({
          epoch,
          tableID: event.data.tableID,
          spectators: event.data.spectators,
        }));
        break;
      case 'noteListPlayer':
      case 'noteList':
      case 'note':
        this.gameplayRuntime.receiveEvent(epoch, event);
        break;
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
        if (this.tableManagementRuntime.isBotJoinEcho(event.data)) break;
        this.store.dispatch(chatActions.messageReceived({
          epoch,
          defaultRoom: this.currentChatRoom(),
          authenticatedUsername: this.store.getState().session.authenticatedUser?.username,
          message: event.data,
        }));
        break;
      case 'chatDelete':
        this.store.dispatch(chatActions.lobbyMessageDeleted({
          epoch,
          chatID: event.data.chatID,
        }));
        break;
      case 'chatList':
        {
          const historyRoom = this.currentHistoryRoom();
          this.store.dispatch(chatActions.historyReceived({
            epoch,
            defaultRoom: historyRoom,
            messages: event.data.list.filter((message) => !this.tableManagementRuntime.isBotJoinEcho(message)),
            ...(/^table[1-9]\d*$/.test(historyRoom)
              ? { authoritativeTableUnread: { room: historyRoom, unread: event.data.unread } }
              : {}),
          }));
          break;
        }
      case 'friends':
        this.store.dispatch(sessionActions.friendsReceived({
          epoch,
          friends: event.data.friends,
        }));
        break;
      case 'warning':
        this.tableManagementRuntime.clearRejectedCreate();
        this.store.dispatch(roomActions.commandPendingCleared({ epoch }));
        this.gameplayRuntime.clearCurrentPending(epoch);
        this.historyRuntime.clearCurrentPending(epoch, event.data.warning);
        this.store.dispatch(lobbyActions.noticeReceived({
          epoch,
          notice: { kind: 'warning', message: event.data.warning.slice(0, MAX_STATUS_LENGTH) },
        }));
        break;
      case 'error':
        this.tableManagementRuntime.clearRejectedCreate();
        this.store.dispatch(roomActions.commandPendingCleared({ epoch }));
        this.gameplayRuntime.clearCurrentPending(epoch);
        this.historyRuntime.clearCurrentPending(epoch, event.data.error);
        this.store.dispatch(lobbyActions.noticeReceived({
          epoch,
          notice: { kind: 'error', message: event.data.error.slice(0, MAX_STATUS_LENGTH) },
        }));
        break;
    }
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

  private isReadyCurrentRoom(tableID: number, kind: 'pregame' | 'live_game' = 'live_game'): boolean {
    const state = this.store.getState();
    return this.connectionRuntime.isReady(state.session.connectionEpoch)
      && state.room.connectionEpoch === state.session.connectionEpoch
      && state.room.room.kind === kind
      && state.room.room.tableID === tableID;
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
    this.connectionRuntime.reset();
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
    return this.connectionRuntime.send(frame);
  }
}
