import type { Tuple } from 'complete-common';

import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import type { GameState } from '../upstream/interfaces/GameState';
import { options as optionsSchema, type Options } from '../upstream/interfaces/Options';
import { getVariant } from '../upstream/gameData';
import { getCardsPerHand } from '../upstream/rules/hand';
import { getMinEfficiency } from '../upstream/rules/stats';
import { getEndGameLength } from '../upstream/rules/turn';
import { isHardVariant } from '../upstream/rules/variants/hGroup';
import type { NumPlayers } from '../upstream/types/NumPlayers';
import type { PlayerIndex } from '../upstream/types/PlayerIndex';
import {
  encodeGetGameInfo1Frame,
  encodeGetGameInfo2Frame,
  encodeLoadedFrame,
  type CardIdentities,
  type FinishOngoingGame,
  type GameActionList,
  type GameHistory,
  type GameInit,
  type IncrementalGameAction,
  type Pause,
  type Clock,
  type WireGameAction,
} from '../../protocol/gameProtocol';
import {
  initializeHeadlessState,
  toCardIdentitiesAction,
  toFinishOngoingGameAction,
  toGameActionListAction,
  toUpstreamGameAction,
} from '../client/boundary';
import { initialState } from '../client/reducers/initialStates/initialState';
import { stateReducer } from '../client/reducers/stateReducer';
import type { State } from '../client/types/State';
import { roomActions } from '../../store/roomSlice';
import { lobbyActions } from '../../store/lobbySlice';
import type { AppStore } from '../../store/store';
import type { IncrementalRejectionReason } from '../../store/sessionSlice';
import { areTableOptionsSupported } from '../client/supportedVariants';
import { encodeTableUnattendFrame } from '../../protocol/lobbyProtocol';

type Role = 'player' | 'spectator';

type ActiveLoad = {
  connectionEpoch: number;
  gameLoadEpoch: number;
  tableID: number;
  role: Role;
  sharedReplay: boolean;
  phase: 'waiting_init' | 'waiting_history' | 'failed';
  info1Attempted: boolean;
  info2Attempted: boolean;
  metadata: GameMetadata | null;
  clientState: State | null;
  timer: ReturnType<typeof setTimeout> | null;
  stagedPause: Pause | null;
};

type SendFrame = (frame: string) => boolean;

export type IncrementalReceiveResult =
  | { accepted: true; rejectionReason: null }
  | { accepted: false; rejectionReason: IncrementalRejectionReason };

export type BootstrapTimers = {
  setTimeout(callback: () => void, delayMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer: ReturnType<typeof setTimeout>): void;
};

const DEFAULT_BOOTSTRAP_TIMEOUT_MS = 15_000;
const UNSUPPORTED_TABLE_WARNING = 'This table uses options that Hanab Mobile does not support.';

function makeMetadata(init: GameInit, username: string): GameMetadata {
  const { variantID: _variantID, ...wireOptions } = init.options;
  const options: Options = optionsSchema.parse(wireOptions);
  const numPlayers = options.numPlayers;
  const playerNames = init.playerNames as Tuple<string, NumPlayers>;
  const characterAssignments = (init.characterAssignments.length === 0
    ? Array.from({ length: numPlayers }, () => null)
    : init.characterAssignments.map((assignment) => assignment === -1 ? null : assignment)
  ) as Tuple<number | null, NumPlayers>;
  const characterMetadata = init.characterMetadata as Tuple<number, NumPlayers>;
  const variant = getVariant(options.variantName);
  const endGameLength = getEndGameLength(options, characterAssignments);
  const cardsPerHand = getCardsPerHand(options);
  const minEfficiency = getMinEfficiency(numPlayers, endGameLength, variant, cardsPerHand);

  return {
    ourUsername: username,
    options,
    playerNames,
    ourPlayerIndex: init.ourPlayerIndex as PlayerIndex,
    characterAssignments,
    characterMetadata,
    minEfficiency,
    hardVariant: isHardVariant(variant, minEfficiency),
    hasCustomSeed: init.hasCustomSeed,
    seed: init.seed,
  };
}

export function replayAuthoritativeHistory(
  metadata: GameMetadata,
  role: Role,
  actions: readonly WireGameAction[],
): GameState {
  let clientState = initialState(metadata);
  clientState = stateReducer(clientState, {
    type: 'init',
    datetimeStarted: '',
    datetimeFinished: '',
    spectating: role === 'spectator',
    shadowing: false,
    replay: false,
    sharedReplay: false,
    databaseID: -1,
    sharedReplaySegment: 0,
    sharedReplayLeader: '',
    paused: false,
    pausePlayerIndex: 0,
    sharedReplayEffMod: 0,
  });
  clientState = stateReducer(
    clientState,
    toGameActionListAction(actions, metadata),
  );
  return clientState.ongoingGame;
}

export class GameBootstrapCoordinator {
  private nextGameLoadEpoch = 0;
  private active: ActiveLoad | null = null;

  constructor(
    private readonly store: AppStore,
    private readonly sendFrame: SendFrame,
    private readonly timers: BootstrapTimers = {
      setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
      clearTimeout: (timer) => clearTimeout(timer),
    },
    private readonly timeoutMs = DEFAULT_BOOTSTRAP_TIMEOUT_MS,
  ) {}

  invalidateConnection(connectionEpoch: number): void {
    if (this.active !== null && this.active.connectionEpoch !== connectionEpoch) {
      this.clearTimer(this.active);
      this.active = null;
    }
  }

  invalidate(): void {
    if (this.active !== null) this.clearTimer(this.active);
    this.active = null;
  }

  startFromAuthoritativeRoom(connectionEpoch: number): number | null {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      state.session.connectionEpoch !== connectionEpoch
      || state.session.phase !== 'ready'
      || room.kind !== 'awaiting_game_bootstrap'
      || room.bootstrap !== 'pending_c5'
    ) return null;

    const gameLoadEpoch = this.nextGameLoadEpoch + 1;
    this.nextGameLoadEpoch = gameLoadEpoch;
    if (this.active !== null) this.clearTimer(this.active);
    const load: ActiveLoad = {
      connectionEpoch,
      gameLoadEpoch,
      tableID: room.tableID,
      role: room.role,
      sharedReplay: room.sharedReplay,
      phase: 'waiting_init',
      info1Attempted: false,
      info2Attempted: false,
      metadata: null,
      clientState: null,
      timer: null,
      stagedPause: null,
    };
    this.active = load;
    this.store.dispatch(roomActions.bootstrapStarted({
      connectionEpoch,
      tableID: load.tableID,
      gameLoadEpoch,
    }));

    load.info1Attempted = true;
    if (!this.sendFrame(encodeGetGameInfo1Frame(load.tableID))) {
      this.fail(load);
      return null;
    }
    this.startTimer(load, 'waiting_init');
    return gameLoadEpoch;
  }

  get currentGameLoadEpoch(): number | null {
    return this.active?.gameLoadEpoch ?? null;
  }

  receiveInit(connectionEpoch: number, gameLoadEpoch: number, init: GameInit): boolean {
    const load = this.match(connectionEpoch, gameLoadEpoch, init.tableID);
    if (load === null || load.phase !== 'waiting_init' || load.info2Attempted) return false;
    if (!areTableOptionsSupported(init.options)) {
      this.sendFrame(encodeTableUnattendFrame(load.tableID));
      this.clearTimer(load);
      this.active = null;
      this.store.dispatch(roomActions.unsupportedRoomRejected({
        epoch: connectionEpoch,
        tableID: load.tableID,
      }));
      this.store.dispatch(lobbyActions.noticeReceived({
        epoch: connectionEpoch,
        notice: { kind: 'warning', message: UNSUPPORTED_TABLE_WARNING },
      }));
      return false;
    }
    if (
      init.shadowing
      || init.replay !== load.sharedReplay
      || init.sharedReplay !== load.sharedReplay
      || (!load.sharedReplay && load.role === 'player' && init.spectating)
      || (!load.sharedReplay && load.role === 'spectator' && !init.spectating)
    ) return false;

    const username = this.store.getState().session.authenticatedUser?.username;
    if (username === undefined) return false;

    let metadata: GameMetadata;
    let clientState: State;
    try {
      metadata = makeMetadata(init, username);
      clientState = initializeHeadlessState(metadata, init);
    } catch {
      return false;
    }

    load.info2Attempted = true;
    if (!this.sendFrame(encodeGetGameInfo2Frame(load.tableID))) {
      this.fail(load);
      return false;
    }

    load.metadata = metadata;
    load.clientState = clientState;
    load.phase = 'waiting_history';
    this.clearTimer(load);
    this.startTimer(load, 'waiting_history');
    this.store.dispatch(roomActions.bootstrapInitAccepted({
      connectionEpoch,
      tableID: load.tableID,
      gameLoadEpoch,
    }));
    return true;
  }

  receiveHistory(
    connectionEpoch: number,
    gameLoadEpoch: number,
    history: GameActionList,
  ): boolean {
    const load = this.match(connectionEpoch, gameLoadEpoch, history.tableID);
    if (
      load === null
      || load.phase !== 'waiting_history'
      || load.metadata === null
      || load.clientState === null
    ) return false;

    let clientState: State;
    try {
      clientState = stateReducer(
        load.clientState,
        toGameActionListAction(history.list, load.metadata),
      );
      if (load.stagedPause !== null) {
        clientState = stateReducer(clientState, {
          type: 'pause',
          active: load.stagedPause.active,
          playerIndex: (load.stagedPause.active
            ? load.stagedPause.playerIndex
            : clientState.pause.playerIndex) as PlayerIndex,
        });
      }
    } catch {
      return false;
    }
    if (this.active !== load || load.phase !== 'waiting_history') return false;

    // The pinned server marks players present only when it receives `loaded`.
    // Send it after the authoritative history has reduced successfully, matching
    // the official client's post-initialization handshake, and before exposing LIVE.
    if (
      !load.sharedReplay
      && load.role === 'player'
      && !this.sendFrame(encodeLoadedFrame(load.tableID))
    ) {
      this.fail(load);
      return false;
    }
    if (this.active !== load || load.phase !== 'waiting_history') return false;

    this.store.dispatch(roomActions.bootstrapCompleted({
      connectionEpoch,
      tableID: load.tableID,
      gameLoadEpoch,
      clientState,
      historyActionCount: history.list.length,
    }));
    this.clearTimer(load);
    this.active = null;
    return true;
  }

  receiveIncremental(
    connectionEpoch: number,
    event: IncrementalGameAction,
  ): boolean {
    return this.receiveIncrementalDetailed(connectionEpoch, event).accepted;
  }

  receivePause(connectionEpoch: number, event: Pause, receivedAtMs: number): boolean {
    const load = this.active;
    if (load !== null) {
      if (
        load.connectionEpoch !== connectionEpoch
        || load.tableID !== event.tableID
        || load.phase !== 'waiting_history'
        || load.metadata === null
        || load.clientState === null
        || !this.pauseMatches(event, load.metadata.options.numPlayers)
      ) return false;
      load.stagedPause = event;
      return true;
    }
    const state = this.store.getState();
    const room = state.room.room;
    if (
      state.session.connectionEpoch !== connectionEpoch
      || state.session.phase !== 'ready'
      || state.room.connectionEpoch !== connectionEpoch
      || room.kind !== 'live_game'
      || room.tableID !== event.tableID
      || room.clientState.finished
      || room.clientState.replay.active
      || room.clientState.ongoingGame.turn.currentPlayerIndex === null
      || !this.pauseMatches(event, room.clientState.metadata.options.numPlayers)
    ) return false;
    this.store.dispatch(roomActions.pauseReceived({
      connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      pause: event,
      receivedAtMs,
    }));
    const updated = this.store.getState().room.room;
    return updated.kind === 'live_game'
      && updated.tableID === room.tableID
      && updated.gameLoadEpoch === room.gameLoadEpoch
      && updated.clientState.pause.active === event.active;
  }

  receiveClock(connectionEpoch: number, event: Clock, receivedAtMs: number): boolean {
    if (this.active !== null) return false;
    const state = this.store.getState();
    const room = state.room.room;
    if (
      state.session.connectionEpoch !== connectionEpoch
      || state.session.phase !== 'ready'
      || state.room.connectionEpoch !== connectionEpoch
      || room.kind !== 'live_game'
      || room.tableID !== event.tableID
      || room.sharedReplay
      || room.clientState.finished
      || room.clientState.replay.active
      || room.clientState.ongoingGame.turn.currentPlayerIndex === null
      || !room.clientState.metadata.options.timed
      || room.clientState.pause.active
      || event.times.length !== room.clientState.metadata.options.numPlayers
      || event.activePlayerIndex < 0
      || event.activePlayerIndex >= room.clientState.metadata.options.numPlayers
    ) return false;
    this.store.dispatch(roomActions.clockReceived({
      connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      clock: event,
      receivedAtMs,
    }));
    const updated = this.store.getState().room.room;
    return updated.kind === 'live_game'
      && updated.tableID === room.tableID
      && updated.gameLoadEpoch === room.gameLoadEpoch
      && updated.clock?.receivedAtMs === receivedAtMs;
  }

  private pauseMatches(event: Pause, numPlayers: number): boolean {
    return event.active
      ? event.playerIndex >= 0 && event.playerIndex < numPlayers
      : event.playerIndex === -1;
  }

  receiveIncrementalDetailed(
    connectionEpoch: number,
    event: IncrementalGameAction,
  ): IncrementalReceiveResult {
    // Preserve the pinned C5 bootstrap behavior: loading traffic is discarded,
    // never buffered or merged into the authoritative gameActionList.
    if (this.active !== null) {
      return { accepted: false, rejectionReason: 'active-bootstrap' };
    }

    const state = this.store.getState();
    const room = state.room.room;
    if (
      state.session.connectionEpoch !== connectionEpoch
      || state.session.phase !== 'ready'
      || state.room.connectionEpoch !== connectionEpoch
    ) {
      return { accepted: false, rejectionReason: 'stale-connection-session' };
    }
    if (room.kind !== 'live_game' || room.tableID !== event.tableID) {
      return { accepted: false, rejectionReason: 'wrong-room-table' };
    }

    let clientState: State;
    try {
      clientState = stateReducer(
        room.clientState,
        toUpstreamGameAction(event.action, room.clientState.metadata),
      );
    } catch {
      return { accepted: false, rejectionReason: 'reducer-failure' };
    }

    this.store.dispatch(roomActions.liveActionAccepted({
      connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      expectedLiveActionCount: room.liveActionCount,
      acceptedAction: event.action,
      clientState,
    }));
    const updated = this.store.getState().room.room;
    const accepted = updated.kind === 'live_game'
      && updated.tableID === room.tableID
      && updated.gameLoadEpoch === room.gameLoadEpoch
      && updated.liveActionCount === room.liveActionCount + 1;
    return accepted
      ? { accepted: true, rejectionReason: null }
      : { accepted: false, rejectionReason: 'reducer-store-acceptance-failure' };
  }

  receiveGameHistory(connectionEpoch: number, history: GameHistory): boolean {
    const room = this.currentFinishedRoom(connectionEpoch);
    if (room === null) return false;
    const metadata = room.clientState.metadata;
    const expectedNames = [...metadata.playerNames]
      .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }));
    const matches = history.filter((item) => (
      item.seed === metadata.seed
      && item.datetimeStarted === room.clientState.datetimeStarted
      && item.options.variantName === metadata.options.variantName
      && item.options.numPlayers === metadata.options.numPlayers
      && item.playerNames.length === expectedNames.length
      && [...item.playerNames]
        .sort((left, right) => left.localeCompare(right, undefined, { sensitivity: 'base' }))
        .every((name, index) => name === expectedNames[index])
      && (room.clientState.replay.databaseID === null
        || item.id === room.clientState.replay.databaseID)
    ));
    if (matches.length !== 1) return false;
    const match = matches[0];
    if (match === undefined) return false;
    this.store.dispatch(roomActions.gameHistoryAccepted({
      connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      history: match,
    }));
    const updated = this.store.getState().room.room;
    return updated.kind === 'live_game'
      && updated.gameHistory?.id === match.id;
  }

  receiveCardIdentities(connectionEpoch: number, event: CardIdentities): boolean {
    const room = this.currentFinishedRoom(connectionEpoch);
    if (room === null || room.tableID !== event.tableID) return false;
    let clientState: State;
    try {
      clientState = stateReducer(room.clientState, toCardIdentitiesAction(event));
    } catch {
      return false;
    }
    this.store.dispatch(roomActions.clientStateAccepted({
      connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      expectedActionCount: room.clientState.replay.actions.length,
      clientState,
    }));
    const updated = this.store.getState().room.room;
    return updated.kind === 'live_game'
      && updated.tableID === room.tableID
      && updated.gameLoadEpoch === room.gameLoadEpoch
      && updated.clientState.cardIdentities === clientState.cardIdentities;
  }

  receiveFinishOngoingGame(connectionEpoch: number, event: FinishOngoingGame): boolean {
    const room = this.currentFinishedRoom(connectionEpoch);
    if (room === null || room.tableID !== event.tableID) return false;
    let clientState: State;
    try {
      const datetimeFinished = room.gameHistory?.datetimeFinished
        ?? room.clientState.datetimeFinished
        ?? '';
      clientState = stateReducer(
        room.clientState,
        toFinishOngoingGameAction(event, datetimeFinished),
      );
    } catch {
      return false;
    }
    this.store.dispatch(roomActions.clientStateAccepted({
      connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      expectedActionCount: room.clientState.replay.actions.length,
      clientState,
    }));
    const updated = this.store.getState().room.room;
    return updated.kind === 'live_game'
      && updated.tableID === room.tableID
      && updated.gameLoadEpoch === room.gameLoadEpoch
      && updated.clientState.finished
      && updated.clientState.replay.databaseID === event.databaseID;
  }

  private currentFinishedRoom(connectionEpoch: number) {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      this.active !== null
      || state.session.connectionEpoch !== connectionEpoch
      || state.session.phase !== 'ready'
      || state.room.connectionEpoch !== connectionEpoch
      || room.kind !== 'live_game'
      || room.clientState.ongoingGame.turn.currentPlayerIndex !== null
    ) return null;
    return room;
  }

  private match(
    connectionEpoch: number,
    gameLoadEpoch: number,
    tableID: number,
  ): ActiveLoad | null {
    const load = this.active;
    if (
      load === null
      || load.connectionEpoch !== connectionEpoch
      || load.gameLoadEpoch !== gameLoadEpoch
      || load.tableID !== tableID
    ) return null;
    return load;
  }

  private fail(load: ActiveLoad): void {
    if (this.active !== load) return;
    this.clearTimer(load);
    load.phase = 'failed';
    this.store.dispatch(roomActions.bootstrapFailed({
      connectionEpoch: load.connectionEpoch,
      tableID: load.tableID,
      gameLoadEpoch: load.gameLoadEpoch,
    }));
  }

  private startTimer(
    load: ActiveLoad,
    phase: 'waiting_init' | 'waiting_history',
  ): void {
    load.timer = this.timers.setTimeout(() => {
      if (this.active !== load || load.phase !== phase) return;
      this.fail(load);
    }, this.timeoutMs);
  }

  private clearTimer(load: ActiveLoad): void {
    if (load.timer === null) return;
    this.timers.clearTimeout(load.timer);
    load.timer = null;
  }
}
