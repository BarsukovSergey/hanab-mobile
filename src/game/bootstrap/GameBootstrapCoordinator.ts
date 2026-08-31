import type { Tuple } from 'complete-common';

import type { GameMetadata } from '../upstream/interfaces/GameMetadata';
import { options as optionsSchema, type Options } from '../upstream/interfaces/Options';
import { getVariant } from '../upstream/gameData';
import { gameReducer } from '../upstream/reducers/gameReducer';
import { getInitialGameState } from '../upstream/reducers/initialStates/initialGameState';
import { getCardsPerHand } from '../upstream/rules/hand';
import { getMinEfficiency } from '../upstream/rules/stats';
import { getEndGameLength } from '../upstream/rules/turn';
import { isHardVariant } from '../upstream/rules/variants/hGroup';
import type { NumPlayers } from '../upstream/types/NumPlayers';
import type { PlayerIndex } from '../upstream/types/PlayerIndex';
import type { GameAction } from '../upstream/types/gameActions';
import {
  encodeGetGameInfo1Frame,
  encodeGetGameInfo2Frame,
  type GameActionList,
  type GameInit,
  type IncrementalGameAction,
  type WireGameAction,
} from '../../protocol/gameProtocol';
import { roomActions } from '../../store/roomSlice';
import type { AppStore } from '../../store/store';
import type { IncrementalRejectionReason } from '../../store/sessionSlice';

type Role = 'player' | 'spectator';

type ActiveLoad = {
  connectionEpoch: number;
  gameLoadEpoch: number;
  tableID: number;
  role: Role;
  phase: 'waiting_init' | 'waiting_history' | 'failed';
  info1Attempted: boolean;
  info2Attempted: boolean;
  metadata: GameMetadata | null;
  timer: ReturnType<typeof setTimeout> | null;
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

function actionMatchesMetadata(action: WireGameAction, metadata: GameMetadata): boolean {
  const count = metadata.options.numPlayers;
  const validPlayer = (value: number): boolean => value >= 0 && value < count;
  switch (action.type) {
    case 'cardIdentity':
    case 'discard':
    case 'draw':
    case 'play':
      return validPlayer(action.playerIndex);
    case 'clue':
      return validPlayer(action.giver) && validPlayer(action.target);
    case 'gameOver':
      return (action.playerIndex === -1 || validPlayer(action.playerIndex))
        && (action.votes === null || action.votes.every(validPlayer));
    case 'playerTimes':
      return action.playerTimes.length === count;
    case 'turn':
      return action.currentPlayerIndex === -1 || validPlayer(action.currentPlayerIndex);
    case 'status':
    case 'strike':
      return true;
  }
}

export function reduceAuthoritativeAction(
  game: ReturnType<typeof getInitialGameState>,
  metadata: GameMetadata,
  role: Role,
  action: WireGameAction,
) {
  if (!actionMatchesMetadata(action, metadata)) {
    throw new Error(`Action ${action.type} does not match init metadata`);
  }
  // The pinned Go stream also contains "status" no-op records and clue records
  // whose legacy `turn` field is ignored. The pinned reducer intentionally no-ops
  // unknown status records, matching the official client runtime behavior.
  return gameReducer(
    game,
    action as GameAction,
    role === 'player',
    false,
    false,
    false,
    metadata,
  );
}

export function replayAuthoritativeHistory(
  metadata: GameMetadata,
  role: Role,
  actions: readonly WireGameAction[],
) {
  let game = getInitialGameState(metadata);
  for (const action of actions) {
    game = reduceAuthoritativeAction(game, metadata, role, action);
  }
  return game;
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
      phase: 'waiting_init',
      info1Attempted: false,
      info2Attempted: false,
      metadata: null,
      timer: null,
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
    if (
      init.replay
      || init.shadowing
      || (load.role === 'player' && init.spectating)
      || (load.role === 'spectator' && !init.spectating)
    ) return false;

    const username = this.store.getState().session.authenticatedUser?.username;
    if (username === undefined) return false;

    let metadata: GameMetadata;
    try {
      metadata = makeMetadata(init, username);
      getInitialGameState(metadata);
    } catch {
      return false;
    }

    load.info2Attempted = true;
    if (!this.sendFrame(encodeGetGameInfo2Frame(load.tableID))) {
      this.fail(load);
      return false;
    }

    load.metadata = metadata;
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
    if (load === null || load.phase !== 'waiting_history' || load.metadata === null) return false;

    let game;
    try {
      game = replayAuthoritativeHistory(load.metadata, load.role, history.list);
    } catch {
      return false;
    }
    if (this.active !== load || load.phase !== 'waiting_history') return false;

    this.store.dispatch(roomActions.bootstrapCompleted({
      connectionEpoch,
      tableID: load.tableID,
      gameLoadEpoch,
      metadata: load.metadata,
      game,
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

    let game;
    try {
      game = reduceAuthoritativeAction(room.game, room.metadata, room.role, event.action);
    } catch {
      return { accepted: false, rejectionReason: 'reducer-failure' };
    }

    this.store.dispatch(roomActions.liveActionAccepted({
      connectionEpoch,
      tableID: room.tableID,
      gameLoadEpoch: room.gameLoadEpoch,
      expectedLiveActionCount: room.liveActionCount,
      acceptedActionType: event.action.type,
      game,
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
