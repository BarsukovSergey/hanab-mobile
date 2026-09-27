import type {
  NetworkSession,
  NetworkSocket,
  SessionCheckResult,
} from '../network/types';
import { GameBootstrapCoordinator } from '../game/bootstrap/GameBootstrapCoordinator';
import {
  canDiscardForVariant,
  hasClueTokenForVariant,
  isCurrentVariantColorClueValue,
  isCurrentVariantRankClueValue,
} from '../game/selectors/gameplay';
import {
  getCluePreview,
  isCluePreviewConfirmable,
} from '../game/selectors/cluePreview';
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
  encodeCardPresentationSettingFrame,
  encodeGameplayPresentationSettingFrame,
  encodeChatFrame,
  encodeChatReadFrame,
  encodeInactiveFrame,
  encodeHistoryGetFrame,
  encodeHistoryFriendsGetFrame,
  encodeHistoryGetSeedFrame,
  encodeJSONReplayCreateFrame,
  historyGetSeedCommandSchema,
  type GameplayPresentationSettingName,
  encodeGetNameFrame,
  encodeReplayCreateFrame,
  encodeClientFrame,
  encodeReplayActionFrame,
  encodeReplayHypoActionFrame,
  encodeReplayHypoBackFrame,
  encodeReplayHypoEndFrame,
  encodeReplayHypoStartFrame,
  encodeReplayHypoToggleRevealedFrame,
  hypoActionSchema,
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
  type ChatMessage,
  type CardPresentationSettingName,
  type MobileTableOptions,
  type ServerEvent,
} from '../protocol/lobbyProtocol';
import type { ActionIncludingHypothetical } from '../game/client/types/actions';
import { getHypotheticalActions } from '../game/client/hypotheticalActions';
import { canToggleHypotheticalDrawnCards } from '../game/client/hypotheticalEligibility';
import { chatActions } from '../store/chatSlice';
import { lobbyActions } from '../store/lobbySlice';
import { roomActions } from '../store/roomSlice';
import { sessionActions } from '../store/sessionSlice';
import { terminationActions } from '../store/terminationSlice';
import { historyActions } from '../store/historySlice';
import type { AppStore } from '../store/store';
import { findKnownBotUser, freeBotSlots, isBotAtTable, knownBots, normalizedBotName } from '../config/knownBots';
import { isEditableLiveNoteOrder } from './notePolicy';

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
    const state = this.store.getState();
    const history = state.history;
    if (
      state.session.phase !== 'ready'
      || history.connectionEpoch !== state.session.connectionEpoch
      || !history.initialPageReceived
      || !history.hasMore
      || history.pendingRequest !== null
    ) return false;
    const request = {
      connectionEpoch: state.session.connectionEpoch,
      offset: history.items.length,
      amount: 10 as const,
    };
    if (!this.sendEncoded(encodeHistoryGetFrame(request.offset, request.amount))) return false;
    this.store.dispatch(historyActions.pageRequested(request));
    return this.store.getState().history.pendingRequest?.offset === request.offset;
  }

  ensureFriendsHistory(): boolean {
    const state = this.store.getState();
    const history = state.history;
    if (
      state.session.phase !== 'ready'
      || history.connectionEpoch !== state.session.connectionEpoch
      || state.session.friends.length === 0
      || history.friendInitialPageReceived
      || history.friendPendingRequest !== null
    ) return false;
    if (!this.sendEncoded(encodeHistoryFriendsGetFrame(0))) return false;
    this.store.dispatch(historyActions.friendPageRequested({
      connectionEpoch: state.session.connectionEpoch, offset: 0, amount: 10,
    }));
    return this.store.getState().history.friendPendingRequest?.offset === 0;
  }

  ensureTaggedGames(): boolean {
    const state = this.store.getState();
    const username = state.session.authenticatedUser?.username;
    const history = state.history;
    if (state.session.phase !== 'ready' || username === undefined
      || history.connectionEpoch !== state.session.connectionEpoch
      || history.taggedLoaded || history.taggedPending) return false;
    const epoch = state.session.connectionEpoch;
    this.store.dispatch(historyActions.taggedRequested({ connectionEpoch: epoch }));
    void this.networkSession.fetchTaggedGames(username).then((items) => {
      if (this.store.getState().session.connectionEpoch !== epoch) return;
      this.store.dispatch(historyActions.taggedReceived({ connectionEpoch: epoch, history: items }));
    }).catch((error: unknown) => {
      if (this.store.getState().session.connectionEpoch !== epoch) return;
      this.store.dispatch(historyActions.tagFailed({ connectionEpoch: epoch, request: 'tagged', message: safeStatus(error, 'Unable to load tagged games.') }));
    });
    return true;
  }

  searchTag(tag: string): boolean {
    const state = this.store.getState();
    if (tag.trim() === '' || state.session.phase !== 'ready'
      || state.history.connectionEpoch !== state.session.connectionEpoch
      || state.history.tagSearchPending) return false;
    const epoch = state.session.connectionEpoch;
    this.store.dispatch(historyActions.tagSearchRequested({ connectionEpoch: epoch, tag }));
    const requestId = this.store.getState().history.tagSearchRequestId;
    if (requestId === null) return false;
    void this.networkSession.searchTag(tag).then((items) => {
      if (this.store.getState().session.connectionEpoch !== epoch) return;
      this.store.dispatch(historyActions.tagSearchReceived({ connectionEpoch: epoch, requestId, tag, history: items }));
    }).catch((error: unknown) => {
      if (this.store.getState().session.connectionEpoch !== epoch) return;
      this.store.dispatch(historyActions.tagFailed({ connectionEpoch: epoch, request: 'search', requestId, tag, message: safeStatus(error, 'Unable to search this tag.') }));
    });
    return true;
  }

  clearTagSearch(): void { this.store.dispatch(historyActions.tagSearchCleared()); }

  loadMoreFriendsHistory(): boolean {
    const state = this.store.getState();
    const history = state.history;
    if (
      state.session.phase !== 'ready'
      || history.connectionEpoch !== state.session.connectionEpoch
      || !history.friendInitialPageReceived
      || !history.friendHasMore
      || history.friendPendingRequest !== null
    ) return false;
    const offset = history.friendItems.length;
    if (!this.sendEncoded(encodeHistoryFriendsGetFrame(offset))) return false;
    this.store.dispatch(historyActions.friendPageRequested({
      connectionEpoch: state.session.connectionEpoch, offset, amount: 10,
    }));
    return this.store.getState().history.friendPendingRequest?.offset === offset;
  }

  loadOtherScores(databaseID: number, friends: boolean): boolean {
    const state = this.store.getState();
    const history = state.history;
    const source = (friends ? history.friendItems : history.items)
      .find((item) => item.id === databaseID);
    if (state.session.phase !== 'ready'
      || history.connectionEpoch !== state.session.connectionEpoch
      || !Number.isInteger(databaseID) || databaseID <= 0
      || source === undefined || source.numGamesOnThisSeed <= 1
      || !historyGetSeedCommandSchema.safeParse({ seed: source.seed, friends }).success
      || history.pendingOtherScores !== null) return false;
    if (!this.sendEncoded(encodeHistoryGetSeedFrame(source.seed, friends))) return false;
    this.store.dispatch(historyActions.otherScoresRequested({
      connectionEpoch: state.session.connectionEpoch,
      sourceDatabaseID: databaseID,
      seed: source.seed,
      friends,
    }));
    return this.store.getState().history.pendingOtherScores?.sourceDatabaseID === databaseID;
  }

  dismissOtherScores(): void {
    this.store.dispatch(historyActions.otherScoresDismissed());
  }

  watchHistoricalGame(databaseID: number, visibility: 'solo' | 'shared' = 'solo'): boolean {
    const state = this.store.getState();
    const item = [...state.history.items, ...state.history.friendItems, ...state.history.taggedItems,
      ...(state.history.tagSearchItems ?? []), ...(state.history.otherScores?.games ?? [])]
      .find((candidate) => candidate.id === databaseID);
    if (
      state.session.phase !== 'ready'
      || state.history.connectionEpoch !== state.session.connectionEpoch
      || !Number.isInteger(databaseID)
      || databaseID <= 0
      || item === undefined
      || !areTableOptionsSupported(item.options)
      || !this.canRequestReplay(state)
    ) return false;
    if (!this.sendEncoded(encodeReplayCreateFrame(databaseID, visibility))) return false;
    this.store.dispatch(historyActions.replayCreateRequested({
      connectionEpoch: state.session.connectionEpoch,
      source: 'id', visibility,
      databaseID,
    }));
    return this.store.getState().history.pendingReplayCreate?.databaseID === databaseID;
  }

  watchReplayByID(databaseID: number, visibility: 'solo' | 'shared'): boolean {
    const state = this.store.getState();
    if (!Number.isInteger(databaseID) || databaseID <= 0 || !this.canRequestReplay(state)) return false;
    if (!this.sendEncoded(encodeReplayCreateFrame(databaseID, visibility))) return false;
    this.store.dispatch(historyActions.replayCreateRequested({
      connectionEpoch: state.session.connectionEpoch, source: 'id', databaseID, visibility,
    }));
    return this.store.getState().history.pendingReplayCreate?.databaseID === databaseID;
  }

  watchJSONReplay(gameJSON: Record<string, unknown>, visibility: 'solo' | 'shared'): boolean {
    const state = this.store.getState();
    if (!this.canRequestReplay(state)) return false;
    if (!this.sendEncoded(encodeJSONReplayCreateFrame(gameJSON, visibility))) return false;
    this.store.dispatch(historyActions.replayCreateRequested({
      connectionEpoch: state.session.connectionEpoch, source: 'json', visibility,
    }));
    return this.store.getState().history.pendingReplayCreate?.source === 'json';
  }

  private canRequestReplay(state: ReturnType<LobbyRuntime['store']['getState']>): boolean {
    const room = state.room;
    return state.session.phase === 'ready'
      && state.history.connectionEpoch === state.session.connectionEpoch
      && room.room.kind === 'none'
      && room.pendingRecovery === null && room.pendingSpectateTableID === null
      && room.pendingJoin === null && room.pendingCreate === null
      && room.pendingLeaveTableID === null && room.pendingUnattendTableID === null
      && room.pendingStart === null && room.pendingUpdate === null
      && room.pendingLeaderName === null && room.pendingRestartTableID === null
      && room.rematchTransition === null && room.pendingGameplayAction === null
      && state.history.pendingReplayCreate === null;
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

  startHypothetical(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (room.kind !== 'live_game' || !room.clientState.replay.active
      || room.clientState.replay.hypothetical !== null) return false;
    const shared = room.clientState.replay.shared;
    if (shared !== null) {
      if (!shared.amLeader || !this.isReadyCurrentRoom(room.tableID)) return false;
      return this.sendEncoded(encodeReplayHypoStartFrame(room.tableID));
    }
    this.store.dispatch(roomActions.hypotheticalStarted({
      epoch: state.session.connectionEpoch, tableID: room.tableID, showDrawnCards: false, actions: [],
    }));
    return true;
  }

  setSharedReplayLeader(name: string): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const shared = room.kind === 'live_game' ? room.clientState.replay.shared : null;
    if (
      room.kind !== 'live_game'
      || shared === null
      || shared.leader === name
      || !room.clientState.spectators.some((spectator) => spectator.name === name)
      || !this.isReadyCurrentRoom(room.tableID)
    ) return false;
    return this.sendEncoded(encodeTableSetLeaderFrame(room.tableID, name));
  }

  endHypothetical(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (room.kind !== 'live_game' || room.clientState.replay.hypothetical === null) return false;
    const shared = room.clientState.replay.shared;
    if (shared !== null) {
      if (!shared.amLeader || !this.isReadyCurrentRoom(room.tableID)) return false;
      return this.sendEncoded(encodeReplayHypoEndFrame(room.tableID));
    }
    this.store.dispatch(roomActions.hypotheticalEnded({ epoch: state.session.connectionEpoch, tableID: room.tableID }));
    return true;
  }

  sendHypotheticalAction(action: ActionIncludingHypothetical): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (room.kind !== 'live_game' || room.clientState.replay.hypothetical === null) return false;
    let parsed: ActionIncludingHypothetical;
    try { parsed = hypoActionSchema.parse(action) as ActionIncludingHypothetical; } catch { return false; }
    const shared = room.clientState.replay.shared;
    if (shared === null) {
      this.store.dispatch(roomActions.hypotheticalActionReceived({
        epoch: state.session.connectionEpoch, tableID: room.tableID, action: parsed,
      }));
      return true;
    }
    return this.sendSharedHypotheticalOperation([parsed]);
  }

  hypotheticalMorph(order: number, suitIndex: number, rank: number): boolean {
    return this.sendHypotheticalAction({ type: 'morph', order, suitIndex, rank } as Extract<ActionIncludingHypothetical, { readonly type: 'morph' }>);
  }

  hypotheticalUnmorph(order: number): boolean {
    return this.sendHypotheticalAction({ type: 'unmorph', order } as Extract<ActionIncludingHypothetical, { readonly type: 'unmorph' }>);
  }

  hypotheticalPlay(order: number): boolean {
    return this.sendHypotheticalClientAction({ type: 'play', order });
  }

  hypotheticalDiscard(order: number): boolean {
    return this.sendHypotheticalClientAction({ type: 'discard', order });
  }

  hypotheticalColorClue(target: number, value: number): boolean {
    return this.sendHypotheticalClientAction({ type: 'colorClue', target, value });
  }

  hypotheticalRankClue(target: number, value: number): boolean {
    return this.sendHypotheticalClientAction({ type: 'rankClue', target, value });
  }

  private sendHypotheticalClientAction(action: Parameters<typeof getHypotheticalActions>[0]): boolean {
    const room = this.store.getState().room.room;
    if (room.kind !== 'live_game') return false;
    const hypothetical = room.clientState.replay.hypothetical;
    if (hypothetical === null) return false;
    const variantName = room.clientState.metadata.options.variantName;
    const clueTokens = hypothetical.ongoing.clueTokens;
    if (action.type === 'discard' && !canDiscardForVariant(clueTokens, variantName)) return false;
    if (
      (action.type === 'colorClue' || action.type === 'rankClue')
      && !hasClueTokenForVariant(clueTokens, variantName)
    ) return false;
    if (action.type === 'colorClue' || action.type === 'rankClue') {
      const preview = getCluePreview(
        hypothetical.ongoing,
        variantName,
        action.target,
        action.type === 'colorClue' ? 'color' : 'rank',
        action.value,
        {
          cardIdentities: room.clientState.cardIdentities,
          morphedIdentities: hypothetical.morphedIdentities,
          notes: room.clientState.notes.ourNotes,
          playing: room.clientState.playing,
        },
      );
      if (!isCluePreviewConfirmable(
        preview,
        room.clientState.metadata.options.emptyClues,
        variantName,
      )) return false;
    }
    const actions = getHypotheticalActions(
      action,
      hypothetical.ongoing,
      room.clientState.metadata,
      room.clientState.cardIdentities,
      hypothetical.morphedIdentities,
      room.clientState.notes.ourNotes,
      room.clientState.playing,
    );
    if (actions === null) return false;
    if (room.clientState.replay.shared !== null) {
      return this.sendSharedHypotheticalOperation(actions);
    }
    return actions.every((hypoAction) => this.sendHypotheticalAction(hypoAction));
  }

  backHypothetical(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (room.kind !== 'live_game' || room.clientState.replay.hypothetical === null
      || room.clientState.replay.hypothetical.states.length <= 1) return false;
    const shared = room.clientState.replay.shared;
    if (shared === null) {
      this.store.dispatch(roomActions.hypotheticalBackReceived({ epoch: state.session.connectionEpoch, tableID: room.tableID }));
      return true;
    }
    return state.room.pendingHypotheticalOperation === null
      && shared.amLeader && this.isReadyCurrentRoom(room.tableID)
      && this.sendEncoded(encodeReplayHypoBackFrame(room.tableID));
  }

  private sendSharedHypotheticalOperation(
    actions: readonly ActionIncludingHypothetical[],
  ): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      actions.length === 0
      || room.kind !== 'live_game'
      || room.clientState.replay.hypothetical === null
      || room.clientState.replay.shared?.amLeader !== true
      || state.room.pendingHypotheticalOperation !== null
      || !this.isReadyCurrentRoom(room.tableID)
    ) return false;

    let parsedActions: ActionIncludingHypothetical[];
    let frames: string[];
    try {
      parsedActions = actions.map((action) => (
        hypoActionSchema.parse(action) as ActionIncludingHypothetical
      ));
      frames = parsedActions.map((action) => (
        encodeReplayHypoActionFrame(room.tableID, JSON.stringify(action))
      ));
    } catch {
      return false;
    }

    const finalAction = parsedActions.at(-1);
    if (finalAction === undefined) return false;
    const pending = {
      connectionEpoch: state.session.connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      finalAction,
    };
    this.store.dispatch(roomActions.hypotheticalOperationRequested(pending));
    const accepted = this.store.getState().room.pendingHypotheticalOperation;
    if (
      accepted === null
      || accepted.connectionEpoch !== pending.connectionEpoch
      || accepted.tableID !== pending.tableID
      || accepted.gameLoadEpoch !== pending.gameLoadEpoch
    ) return false;

    let sentCount = 0;
    for (const frame of frames) {
      if (!this.sendEncoded(frame)) {
        if (sentCount === 0) {
          this.store.dispatch(roomActions.hypotheticalOperationPendingCleared(pending));
        }
        return false;
      }
      sentCount += 1;
    }
    return true;
  }

  toggleHypotheticalDrawnCards(): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    const hypothetical = room.kind === 'live_game' ? room.clientState.replay.hypothetical : null;
    if (room.kind !== 'live_game' || hypothetical === null || !canToggleHypotheticalDrawnCards(hypothetical)) return false;
    const shared = room.clientState.replay.shared;
    if (shared === null) {
      this.store.dispatch(roomActions.hypotheticalDrawnCardsChanged({
        epoch: state.session.connectionEpoch, tableID: room.tableID,
        showDrawnCards: !hypothetical.showDrawnCards,
      }));
      return true;
    }
    return shared.amLeader && this.isReadyCurrentRoom(room.tableID)
      && this.sendEncoded(encodeReplayHypoToggleRevealedFrame(room.tableID));
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
    if (!isEditableLiveNoteOrder(room.clientState.notes.ourNotes, order)) return false;

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
        this.store.dispatch(historyActions.pageReceived({
          connectionEpoch: epoch,
          history: event.data,
        }));
        this.gameBootstrap.receiveGameHistory(epoch, event.data);
        break;
      case 'gameHistoryFriends':
        this.store.dispatch(historyActions.friendPageReceived({
          connectionEpoch: epoch,
          history: event.data,
        }));
        break;
      case 'gameHistoryOtherScores':
        this.store.dispatch(historyActions.otherScoresReceived({
          connectionEpoch: epoch,
          result: event.data,
        }));
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
      case 'suggestion':
        this.store.dispatch(roomActions.replaySuggestionReceived({
          epoch,
          suggestion: event.data,
        }));
        break;
      case 'replayEfficiencyMod':
        this.store.dispatch(roomActions.sharedReplayEfficiencyModReceived({
          epoch,
          tableID: event.data.tableID,
          mod: event.data.mod,
        }));
        break;
      case 'hypothetical': {
        const room = this.store.getState().room.room;
        if (room.kind !== 'live_game' || room.clientState.replay.shared === null) break;
        try {
          const actions = event.data.actions.map((encoded) => (
            hypoActionSchema.parse(JSON.parse(encoded)) as ActionIncludingHypothetical
          ));
          this.store.dispatch(roomActions.hypotheticalStarted({
            epoch, tableID: room.tableID, showDrawnCards: event.data.showDrawnCards, actions,
          }));
        } catch {
          this.recordInboundDiagnostic(epoch, { command: 'hypothetical', classification: 'malformed' });
        }
        break;
      }
      case 'hypoStart':
        this.store.dispatch(roomActions.hypotheticalStarted({
          epoch, tableID: event.data.TableID, showDrawnCards: false, actions: [],
        }));
        break;
      case 'hypoEnd':
        this.store.dispatch(roomActions.hypotheticalEnded({ epoch, tableID: event.data.TableID }));
        break;
      case 'hypoAction':
        {
          const room = this.store.getState().room.room;
          if (room.kind !== 'live_game') break;
        this.store.dispatch(roomActions.hypotheticalActionReceived({
          epoch,
          tableID: room.tableID,
          action: event.data as ActionIncludingHypothetical,
        }));
        }
        break;
      case 'hypoBack':
        this.store.dispatch(roomActions.hypotheticalBackReceived({ epoch, tableID: event.data.TableID }));
        break;
      case 'hypoShowDrawnCards':
        this.store.dispatch(roomActions.hypotheticalDrawnCardsChanged({
          epoch, tableID: event.data.tableID, showDrawnCards: event.data.showDrawnCards,
        }));
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
        this.clearCurrentGameplayPending(epoch);
        this.clearCurrentHistoryPending(epoch, event.data.warning);
        this.store.dispatch(lobbyActions.noticeReceived({
          epoch,
          notice: { kind: 'warning', message: event.data.warning.slice(0, MAX_STATUS_LENGTH) },
        }));
        break;
      case 'error':
        if (this.store.getState().room.pendingCreate !== null) this.pendingBotCreate = null;
        this.store.dispatch(roomActions.commandPendingCleared({ epoch }));
        this.clearCurrentGameplayPending(epoch);
        this.clearCurrentHistoryPending(epoch, event.data.error);
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

  private clearCurrentHistoryPending(epoch: number, message: string): void {
    const history = this.store.getState().history;
    if (
      history.connectionEpoch === epoch
      && (history.pendingRequest !== null
        || history.friendPendingRequest !== null
        || history.pendingReplayCreate !== null
        || history.pendingOtherScores !== null)
    ) this.store.dispatch(historyActions.operationFailed({
      connectionEpoch: epoch,
      message: message.slice(0, MAX_STATUS_LENGTH),
    }));
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
    const variantName = room.clientState.metadata.options.variantName;
    if (
      action.type === 1
      && !canDiscardForVariant(room.clientState.ongoingGame.clueTokens, variantName)
    ) return false;
    if (action.type === 2 || action.type === 3) {
      if (
        action.target === ourPlayerIndex
        || action.target < 0
        || action.target >= room.clientState.metadata.options.numPlayers
      ) return false;
      if (
        !hasClueTokenForVariant(room.clientState.ongoingGame.clueTokens, variantName)
        ||
        (action.type === 2
          && !isCurrentVariantColorClueValue(variantName, action.value))
        || (action.type === 3
          && !isCurrentVariantRankClueValue(variantName, action.value))
      ) return false;
      const preview = getCluePreview(
        room.clientState.ongoingGame,
        variantName,
        action.target,
        action.type === 2 ? 'color' : 'rank',
        action.value,
      );
      if (!isCluePreviewConfirmable(
        preview,
        room.clientState.metadata.options.emptyClues,
        variantName,
      )) return false;
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
