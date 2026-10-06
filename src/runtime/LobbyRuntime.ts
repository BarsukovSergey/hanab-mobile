import type {
  NetworkSession,
  NetworkSocket,
  SessionCheckResult,
} from '../network/types';
import { GameBootstrapCoordinator } from '../game/bootstrap/GameBootstrapCoordinator';
import {
  areTableOptionsSupported,
  isVariantNameSupported,
} from '../game/client/supportedVariants';
import {
  decodeServerFrame,
  encodeCardPresentationSettingFrame,
  encodeGameplayPresentationSettingFrame,
  encodeChatFrame,
  encodeChatReadFrame,
  encodeInactiveFrame,
  type GameplayPresentationSettingName,
  encodeGetNameFrame,
  encodeClientFrame,
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
  type ChatMessage,
  type CardPresentationSettingName,
  type MobileTableOptions,
  type CreateTableSetting,
  encodeCreateTableSettingFrame,
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
import { GameplayRuntime } from './GameplayRuntime';
import { HistoryRuntime } from './HistoryRuntime';
import { ReplayInteractionRuntime } from './ReplayInteractionRuntime';
import { findKnownBotUser, freeBotSlots, isBotAtTable, knownBots, normalizedBotName } from '../config/knownBots';
import {
  isJoinEligible,
  isPregameSpectateEligible,
  isQuickRematchEligible,
  isRestartToPregameEligible,
  isReattendEligible,
  isSpectateEligible,
} from './lobbyEligibility';

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
  private pendingBotCreate: {
    epoch: number;
    name: string;
    creatorUserID: number;
    bots: string[];
    password: string;
  } | null = null;
  private current: OwnedConnection | null = null;
  private connectionEpoch: number;
  private connectPromise: Promise<void> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryAttempt = 0;
  private appActive = true;
  private maintainConnection = false;
  private readonly gameBootstrap: GameBootstrapCoordinator;
  private readonly gameplayRuntime: GameplayRuntime;
  private readonly historyRuntime: HistoryRuntime;
  private readonly replayInteractionRuntime: ReplayInteractionRuntime;

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

    this.pendingBotCreate = null;
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
    this.pendingBotCreate = null;
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
      || state.history.pendingReplayCreate !== null
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
      || state.history.pendingReplayCreate !== null
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
      || state.history.pendingReplayCreate !== null
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

  openLiveGameByID(tableID: number): boolean {
    const state = this.store.getState();
    const table = state.lobby.tables.entities[tableID];
    const room = state.room;
    if (state.session.phase !== 'ready' || table === undefined || !table.running
      || room.room.kind !== 'none'
      || room.pendingRecovery !== null || room.pendingSpectateTableID !== null
      || room.pendingJoin !== null || room.pendingCreate !== null
      || room.pendingLeaveTableID !== null || room.pendingUnattendTableID !== null
      || room.pendingStart !== null || room.pendingUpdate !== null
      || room.pendingLeaderName !== null || room.pendingRestartTableID !== null
      || room.pendingRestartHidePregame !== null || room.rematchTransition !== null
      || room.pendingRoleSwitch !== null || room.pendingGameplayAction !== null
      || room.pendingHypotheticalOperation !== null || room.pendingReplaySuggestion !== null
      || state.history.pendingReplayCreate !== null) return false;

    if (isReattendEligible(table)) return this.reattend(tableID);
    if (isSpectateEligible(table)) return this.spectate(tableID);
    return false;
  }

  openPregameByID(tableID: number, password?: string): boolean {
    const state = this.store.getState();
    const table = state.lobby.tables.entities[tableID];
    const room = state.room;
    if (state.session.phase !== 'ready' || table === undefined || table.running || table.sharedReplay
      || !isJoinEligible(table)
      || room.room.kind !== 'none'
      || room.pendingRecovery !== null || room.pendingSpectateTableID !== null
      || room.pendingJoin !== null || room.pendingCreate !== null
      || room.pendingLeaveTableID !== null || room.pendingUnattendTableID !== null
      || room.pendingStart !== null || room.pendingUpdate !== null
      || room.pendingLeaderName !== null || room.pendingRestartTableID !== null
      || room.pendingRestartHidePregame !== null || room.rematchTransition !== null
      || room.pendingRoleSwitch !== null || room.pendingGameplayAction !== null
      || room.pendingHypotheticalOperation !== null || room.pendingReplaySuggestion !== null
      || state.history.pendingReplayCreate !== null
      || (table.passwordProtected && (password === undefined || password.length === 0))) return false;
    return this.join(tableID, password);
  }

  createTable(
    name: string,
    maxPlayers: number,
    options: MobileTableOptions | string,
    password = '',
    bots: readonly string[] = [],
  ): boolean {
    const state = this.store.getState();
    const creatorUserID = state.session.authenticatedUser?.userID;
    const trimmedName = name.trim();
    const effectiveName = trimmedName || state.session.randomTableName?.trim() || '';
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
      || effectiveName.length < 1
      || effectiveName.length > 45
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
      || state.history.pendingReplayCreate !== null
      || bots.length > maxPlayers - 1
      || new Set(bots.map(normalizedBotName)).size !== bots.length
      || bots.some((name) => !knownBots.some((bot) => normalizedBotName(bot.username) === normalizedBotName(name)
        && (password.length === 0 || bot.passwordJoin)))
    ) return false;

    let frame: string;
    try {
      frame = encodeTableCreateFrame(effectiveName, maxPlayers, exposed, password);
    } catch {
      return false;
    }
    if (!this.sendEncoded(frame)) return false;

    this.saveCreateTablePreferences(maxPlayers, exposed);

    this.store.dispatch(roomActions.createRequested({
      epoch: state.session.connectionEpoch,
      name: effectiveName,
      creatorUserID,
    }));
    this.pendingBotCreate = bots.length === 0 ? null : {
      epoch: state.session.connectionEpoch, name: effectiveName, creatorUserID,
      bots: [...bots], password,
    };
    this.sendEncoded(encodeGetNameFrame());
    return true;
  }

  saveCreateTablePreferences(maxPlayers: number, options: MobileTableOptions): boolean {
    const initial = this.store.getState();
    if (initial.session.phase !== 'ready') return false;
    const desired: CreateTableSetting[] = [
      { name: 'createTableVariant', value: options.variantName },
      { name: 'createTableTimed', value: options.timed },
      ...(options.timed ? [
        { name: 'createTableTimeBaseMinutes' as const, value: options.timeBase / 60 },
        { name: 'createTableTimePerTurnSeconds' as const, value: options.timePerTurn },
      ] : []),
      { name: 'createTableCardCycle', value: options.cardCycle },
      { name: 'createTableEmptyClues', value: options.emptyClues },
      { name: 'createTableOneExtraCard', value: options.oneExtraCard },
      { name: 'createTableOneLessCard', value: options.oneLessCard },
      { name: 'createTableAllOrNothing', value: options.allOrNothing },
      { name: 'createTableMaxPlayers', value: maxPlayers },
    ];
    for (const setting of desired) {
      const state = this.store.getState();
      if (state.session.phase !== 'ready') return false;
      const keyMap = {
        createTableVariant: 'variant', createTableTimed: 'timed',
        createTableTimeBaseMinutes: 'timeBaseMinutes', createTableTimePerTurnSeconds: 'timePerTurnSeconds',
        createTableCardCycle: 'cardCycle', createTableEmptyClues: 'emptyClues',
        createTableOneExtraCard: 'oneExtraCard', createTableOneLessCard: 'oneLessCard',
        createTableAllOrNothing: 'allOrNothing', createTableMaxPlayers: 'maxPlayers',
      } as const;
      const current = state.session.createTablePreferences[keyMap[setting.name]];
      if (current === setting.value) continue;
      let frame: string;
      try {
        frame = encodeCreateTableSettingFrame(setting);
      } catch {
        return false;
      }
      if (!this.sendEncoded(frame)) return false;
      this.store.dispatch(sessionActions.createTablePreferenceUpdated(setting));
    }
    return true;
  }

  inviteBots(tableID: number, names: readonly string[], password = ''): number {
    let sent = 0;
    for (const name of names) {
      const state = this.store.getState();
      const room = state.room.room;
      if (room.kind !== 'pregame' || room.tableID !== tableID || state.session.phase !== 'ready') break;
      const free = freeBotSlots(room.data.maxPlayers, room.data.players.length);
      if (sent >= free) break;
      const bot = knownBots.find((entry) => normalizedBotName(entry.username) === normalizedBotName(name));
      if (bot === undefined || isBotAtTable(name, room.data.players)
        || (room.data.passwordProtected && (!bot.passwordJoin || password.length === 0))
        || !state.lobby.userListReceived) continue;
      const user = findKnownBotUser(name, Object.values(state.lobby.users.entities).filter(
        (entry): entry is NonNullable<typeof entry> => entry !== undefined,
      ));
      if (user?.status !== 0) continue;
      const msg = room.data.passwordProtected ? `/join ${password}` : '/join';
      if (this.send('chatPM', { msg, recipient: user.name, room: `table${tableID}` })) sent += 1;
    }
    return sent;
  }

  private finishPendingBotCreate(epoch: number): void {
    const pending = this.pendingBotCreate;
    if (pending === null || pending.epoch !== epoch) return;
    const state = this.store.getState();
    const room = state.room.room;
    if (room.kind === 'pregame' && room.role === 'player'
      && room.data.name === pending.name && room.data.owner === pending.creatorUserID
      && room.data.players.some((player) => player.you)) {
      this.pendingBotCreate = null;
      this.inviteBots(room.tableID, pending.bots, pending.password);
    } else if (state.room.pendingCreate === null) {
      this.pendingBotCreate = null;
    }
  }

  private isBotJoinEcho(message: ChatMessage): boolean {
    const username = this.store.getState().session.authenticatedUser?.username;
    return username !== undefined
      && normalizedBotName(message.who) === normalizedBotName(username)
      && /^\/join(?:\s|$)/.test(message.msg)
      && knownBots.some((bot) => normalizedBotName(bot.username) === normalizedBotName(message.recipient));
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
      || state.room.pendingRoleSwitch !== null
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
      || state.room.pendingRoleSwitch !== null
    ) return false;
    const isOwner = room.data.owner === ownerUserID;
    if (isOwner && state.room.pendingUpdate !== null) return false;
    let frame: string;
    try {
      frame = encodeTableUpdateFrame(
        room.tableID, name, maxPlayers, room.data.options, changes,
      );
    } catch {
      return false;
    }
    if (!this.sendEncoded(frame)) return false;
    if (!isOwner) return true;
    this.store.dispatch(roomActions.updateRequested({
      epoch: state.session.connectionEpoch, tableID: room.tableID, ownerUserID,
      name: name.trim(), maxPlayers, changes,
    }));
    return this.store.getState().room.pendingUpdate?.tableID === room.tableID;
  }

  setTableLeader(name: string): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const requesterUserID = state.session.authenticatedUser?.userID;
    const target = room.kind === 'pregame'
      ? room.data.players.find((player) => player.name === name)
      : undefined;
    if (
      requesterUserID === undefined
      || room.kind !== 'pregame'
      || room.role !== 'player'
      || state.room.pendingRoleSwitch !== null
      || target === undefined
      || room.data.players[0]?.name === name
      || (room.data.owner !== requesterUserID && !target.you)
      || state.room.pendingLeaderName !== null
      || !this.isReadyCurrentRoom(room.tableID, 'pregame')
    ) return false;
    if (!this.sendEncoded(encodeTableSetLeaderFrame(room.tableID, name))) return false;
    this.store.dispatch(roomActions.leaderRequested({
      epoch: state.session.connectionEpoch, tableID: room.tableID, requesterUserID, name,
    }));
    return this.store.getState().room.pendingLeaderName === name;
  }

  leave(tableID: number): boolean {
    const state = this.store.getState();
    if (
      state.room.room.kind !== 'pregame'
      || state.room.room.tableID !== tableID
      || state.room.pendingRoleSwitch !== null
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

  switchToSpectator(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'pregame'
      || room.role !== 'player'
      || room.data.players.length < 2
      || state.room.pendingRoleSwitch !== null
      || state.room.pendingLeaveTableID !== null
      || state.room.pendingStart !== null
    ) return false;
    this.store.dispatch(roomActions.roleSwitchRequested({
      epoch: state.session.connectionEpoch, tableID: room.tableID, targetRole: 'spectator',
    }));
    if (!this.sendEncoded(encodeTableLeaveFrame(room.tableID))) {
      this.store.dispatch(roomActions.roleSwitchCancelled({
        epoch: state.session.connectionEpoch, tableID: room.tableID,
      }));
      return false;
    }
    this.store.dispatch(roomActions.roleSwitchLeaveSent({
      epoch: state.session.connectionEpoch, tableID: room.tableID,
    }));
    if (!this.sendEncoded(encodeTableSpectateFrame(room.tableID))) return false;
    this.store.dispatch(roomActions.roleSwitchSpectateSent({
      epoch: state.session.connectionEpoch, tableID: room.tableID,
    }));
    return this.store.getState().room.pendingRoleSwitch?.tableID === room.tableID;
  }

  joinAsPlayer(password?: string): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'pregame'
      || room.role !== 'spectator'
      || room.data.players.length >= room.data.maxPlayers
      || state.room.pendingRoleSwitch !== null
      || state.room.pendingLeaveTableID !== null
      || state.room.pendingStart !== null
      || (room.data.passwordProtected && (password === undefined || password.length === 0))
    ) return false;
    this.store.dispatch(roomActions.roleSwitchRequested({
      epoch: state.session.connectionEpoch, tableID: room.tableID, targetRole: 'player',
    }));
    if (!this.sendEncoded(encodeTableJoinFrame(
      room.tableID, room.data.passwordProtected ? password : undefined,
    ))) {
      this.store.dispatch(roomActions.roleSwitchCancelled({
        epoch: state.session.connectionEpoch, tableID: room.tableID,
      }));
      return false;
    }
    return this.store.getState().room.pendingRoleSwitch?.tableID === room.tableID;
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

  setSpectatorPerspective(shadowingPlayerIndex: number): boolean {
    const room = this.store.getState().room.room;
    if (
      room.kind !== 'live_game'
      || room.role !== 'spectator'
      || room.sharedReplay
      || room.clientState.replay.shared !== null
      || room.clientState.finished
      || room.clientState.replay.databaseID !== null
      || room.clientState.ongoingGame.turn.currentPlayerIndex === null
      || !Number.isInteger(shadowingPlayerIndex)
      || shadowingPlayerIndex < -1
      || shadowingPlayerIndex >= room.clientState.metadata.options.numPlayers
      || shadowingPlayerIndex === (room.clientState.shadowing
        ? room.clientState.metadata.ourPlayerIndex : -1)
      || !this.isReadyCurrentRoom(room.tableID)
    ) return false;
    return this.sendEncoded(encodeTableSpectateFrame(room.tableID, shadowingPlayerIndex));
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
        this.finishPendingBotCreate(epoch);
        break;
      case 'joined':
        this.store.dispatch(roomActions.joinedReceived({ epoch, joined: event.data }));
        this.finishPendingBotCreate(epoch);
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
      case 'suggestion':
      case 'replayEfficiencyMod':
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
        if (this.isBotJoinEcho(event.data)) break;
        this.store.dispatch(chatActions.messageReceived({
          epoch,
          defaultRoom: this.currentChatRoom(),
          authenticatedUsername: this.store.getState().session.authenticatedUser?.username,
          message: event.data,
        }));
        break;
      case 'chatList':
        {
          const historyRoom = this.currentHistoryRoom();
          this.store.dispatch(chatActions.historyReceived({
            epoch,
            defaultRoom: historyRoom,
            messages: event.data.list.filter((message) => !this.isBotJoinEcho(message)),
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
        if (this.store.getState().room.pendingCreate !== null) this.pendingBotCreate = null;
        this.store.dispatch(roomActions.commandPendingCleared({ epoch }));
        this.gameplayRuntime.clearCurrentPending(epoch);
        this.historyRuntime.clearCurrentPending(epoch, event.data.warning);
        this.store.dispatch(lobbyActions.noticeReceived({
          epoch,
          notice: { kind: 'warning', message: event.data.warning.slice(0, MAX_STATUS_LENGTH) },
        }));
        break;
      case 'error':
        if (this.store.getState().room.pendingCreate !== null) this.pendingBotCreate = null;
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

  private onClose(owned: OwnedConnection, event: WebSocketCloseEvent): void {
    if (!this.isCurrent(owned)) return;
    this.current = null;
    this.pendingBotCreate = null;
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
    this.pendingBotCreate = null;
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

  private isReadyCurrentRoom(tableID: number, kind: 'pregame' | 'live_game' = 'live_game'): boolean {
    const state = this.store.getState();
    const owned = this.current;
    return owned !== null
      && owned.epoch === this.connectionEpoch
      && owned.epoch === state.session.connectionEpoch
      && owned.socket !== null
      && owned.socket.readyState === SOCKET_OPEN
      && state.session.phase === 'ready'
      && state.room.connectionEpoch === owned.epoch
      && state.room.room.kind === kind
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
    this.pendingBotCreate = null;
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

    try {
      owned.socket.send(frame);
      return true;
    } catch {
      return false;
    }
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
