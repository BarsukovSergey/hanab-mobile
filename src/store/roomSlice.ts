import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { castDraft, original } from 'immer';

import type {
  PregameGame,
  MobileTableOptions,
  Boot,
  Spectator,
  TableJoined,
  TableLeft,
  TableStart,
} from '../protocol/lobbyProtocol';
import { stateReducer } from '../game/client/reducers/stateReducer';
import type { State } from '../game/client/types/State';
import type {
  ClientGameplayAction,
  GameHistoryItem,
  WireGameAction,
  Pause,
  Clock,
} from '../protocol/gameProtocol';
import type { ActionIncludingHypothetical, NoteAction } from '../game/client/types/actions';
import { lobbyActions } from './lobbySlice';
import { sessionActions } from './sessionSlice';

export type RoomState =
  | { kind: 'none' }
  | {
      kind: 'pregame';
      tableID: number;
      role: 'player' | 'spectator';
      data: PregameGame;
    }
  | {
      kind: 'awaiting_game_bootstrap';
      tableID: number;
      role: 'player' | 'spectator';
      replay: boolean;
      expectedDatabaseID: number | null;
      tableStartReceived: true;
      bootstrap:
        | 'pending_c5'
        | {
            gameLoadEpoch: number;
            phase: 'waiting_init' | 'waiting_history' | 'failed';
            historyActionCount: 0;
          };
    }
  | {
      kind: 'live_game';
      tableID: number;
      role: 'player' | 'spectator';
      sharedReplay: boolean;
      gameLoadEpoch: number;
      bootstrapPhase: 'live';
      historyActionCount: number;
      liveActionCount: number;
      clientState: State;
      gameHistory: GameHistoryItem | null;
      connected: readonly boolean[] | null;
      clock: {
        times: readonly number[];
        activePlayerIndex: number;
        timeTaken: number;
        receivedAtMs: number;
      } | null;
    };

type PendingJoin = {
  tableID: number;
  role: 'player' | 'spectator';
  joinedConfirmed: boolean;
  stagedGame: PregameGame | null;
};

type PendingCreate = {
  name: string;
  creatorUserID: number;
  joinedTableID: number | null;
  stagedGame: PregameGame | null;
};

type PendingRoleSwitch = {
  tableID: number;
  targetRole: 'player' | 'spectator';
  leaveSent: boolean;
  spectateSent: boolean;
  rejected: boolean;
  leftConfirmed: boolean;
  joinedConfirmed: boolean;
  stagedGame: PregameGame | null;
};

type RematchTransition = {
  oldTableID: number;
  originalPlayerNames: string[];
  role: 'player' | 'spectator';
  newTableID: number | null;
  joinedConfirmed: boolean;
  stagedGame: PregameGame | null;
  hidePregame: boolean | null;
};

export type RoomSliceState = {
  connectionEpoch: number;
  pendingSpectateTableID: number | null;
  pendingRecovery: {
    tableID: number;
    role: 'player' | 'spectator';
  } | null;
  recoveryJoinedConfirmed: boolean;
  recoveryStagedGame: PregameGame | null;
  pendingJoin: PendingJoin | null;
  pendingCreate: PendingCreate | null;
  pendingRoleSwitch: PendingRoleSwitch | null;
  pendingLeaveTableID: number | null;
  pendingUnattendTableID: number | null;
  pendingStart: {
    tableID: number;
    intendedPlayers: string[];
  } | null;
  pendingUpdate: ({ tableID: number; name: string; maxPlayers: number }
    & MobileTableOptions) | null;
  pendingLeaderName: string | null;
  pendingRestartTableID: number | null;
  pendingRestartHidePregame: boolean | null;
  rematchTransition: RematchTransition | null;
  pendingGameplayAction: {
    connectionEpoch: number;
    tableID: number;
    gameLoadEpoch: number;
    action: ClientGameplayAction;
  } | null;
  pendingHypotheticalOperation: {
    connectionEpoch: number;
    tableID: number;
    gameLoadEpoch: number;
    finalAction: ActionIncludingHypothetical;
  } | null;
  room: RoomState;
};

const initialState: RoomSliceState = {
  connectionEpoch: 0,
  pendingSpectateTableID: null,
  pendingRecovery: null,
  recoveryJoinedConfirmed: false,
  recoveryStagedGame: null,
  pendingJoin: null,
  pendingCreate: null,
  pendingRoleSwitch: null,
  pendingLeaveTableID: null,
  pendingUnattendTableID: null,
  pendingStart: null,
  pendingUpdate: null,
  pendingLeaderName: null,
  pendingRestartTableID: null,
  pendingRestartHidePregame: null,
  rematchTransition: null,
  pendingGameplayAction: null,
  pendingHypotheticalOperation: null,
  room: { kind: 'none' },
};

function hypotheticalActionsEqual(
  first: ActionIncludingHypothetical,
  second: ActionIncludingHypothetical,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function clearC4BState(state: RoomSliceState): void {
  state.pendingJoin = null;
  state.pendingCreate = null;
  state.pendingRoleSwitch = null;
  state.pendingLeaveTableID = null;
  state.pendingStart = null;
  state.pendingUpdate = null;
  state.pendingLeaderName = null;
}

function completeRoleSwitchIfConfirmed(state: RoomSliceState): void {
  const pending = state.pendingRoleSwitch;
  if (
    pending === null || !pending.joinedConfirmed || pending.stagedGame === null
    || (pending.targetRole === 'spectator' && !pending.leftConfirmed)
    || (pending.targetRole === 'player') !== pending.stagedGame.players.some((player) => player.you)
    || state.room.kind !== 'pregame' || state.room.tableID !== pending.tableID
  ) return;
  state.room = {
    kind: 'pregame', tableID: pending.tableID, role: pending.targetRole, data: pending.stagedGame,
  };
  state.pendingRoleSwitch = null;
}

export const roomSlice = createSlice({
  name: 'room',
  initialState,
  reducers: {
    recoveryRequested(
      state,
      action: PayloadAction<{
        epoch: number;
        tableID: number;
        role: 'player' | 'spectator';
      }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (
        state.room.kind !== 'none'
        || state.pendingRecovery !== null
        || state.pendingSpectateTableID !== null
        || state.pendingJoin !== null
        || state.pendingCreate !== null
      ) return;
      state.rematchTransition = null;
      state.pendingRecovery = {
        tableID: action.payload.tableID,
        role: action.payload.role,
      };
      state.recoveryJoinedConfirmed = false;
      state.recoveryStagedGame = null;
    },
    spectateRequested(
      state,
      action: PayloadAction<{ epoch: number; tableID: number }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (
        state.room.kind !== 'none'
        || state.pendingRecovery !== null
        || state.pendingSpectateTableID !== null
        || state.pendingJoin !== null
        || state.pendingCreate !== null
      ) return;
      state.rematchTransition = null;
      state.pendingSpectateTableID = action.payload.tableID;
    },
    joinRequested(
      state,
      action: PayloadAction<{
        epoch: number;
        tableID: number;
        role?: 'player' | 'spectator';
      }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (
        state.room.kind !== 'none'
        || state.pendingRecovery !== null
        || state.pendingSpectateTableID !== null
        || state.pendingJoin !== null
        || state.pendingCreate !== null
      ) return;
      state.rematchTransition = null;
      state.pendingJoin = {
        tableID: action.payload.tableID,
        role: action.payload.role ?? 'player',
        joinedConfirmed: false,
        stagedGame: null,
      };
    },
    createRequested(
      state,
      action: PayloadAction<{
        epoch: number;
        name: string;
        creatorUserID: number;
      }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (
        state.room.kind !== 'none'
        || state.pendingRecovery !== null
        || state.pendingSpectateTableID !== null
        || state.pendingJoin !== null
        || state.pendingCreate !== null
      ) return;
      state.rematchTransition = null;
      state.pendingCreate = {
        name: action.payload.name,
        creatorUserID: action.payload.creatorUserID,
        joinedTableID: null,
        stagedGame: null,
      };
    },
    roleSwitchRequested(
      state,
      action: PayloadAction<{ epoch: number; tableID: number; targetRole: 'player' | 'spectator' }>,
    ) {
      if (
        state.connectionEpoch !== action.payload.epoch
        || state.room.kind !== 'pregame'
        || state.room.tableID !== action.payload.tableID
        || state.room.role === action.payload.targetRole
        || state.pendingRoleSwitch !== null
      ) return;
      state.pendingRoleSwitch = {
        tableID: action.payload.tableID,
        targetRole: action.payload.targetRole,
        leaveSent: false,
        spectateSent: false,
        rejected: false,
        leftConfirmed: action.payload.targetRole === 'player',
        joinedConfirmed: false,
        stagedGame: null,
      };
    },
    roleSwitchLeaveSent(state, action: PayloadAction<{ epoch: number; tableID: number }>) {
      if (
        state.connectionEpoch === action.payload.epoch
        && state.pendingRoleSwitch?.tableID === action.payload.tableID
        && state.pendingRoleSwitch.targetRole === 'spectator'
      ) state.pendingRoleSwitch.leaveSent = true;
    },
    roleSwitchSpectateSent(state, action: PayloadAction<{ epoch: number; tableID: number }>) {
      if (
        state.connectionEpoch === action.payload.epoch
        && state.pendingRoleSwitch?.tableID === action.payload.tableID
        && state.pendingRoleSwitch.targetRole === 'spectator'
      ) state.pendingRoleSwitch.spectateSent = true;
    },
    roleSwitchCancelled(state, action: PayloadAction<{ epoch: number; tableID: number }>) {
      if (
        state.connectionEpoch === action.payload.epoch
        && state.pendingRoleSwitch?.tableID === action.payload.tableID
        && !state.pendingRoleSwitch.leaveSent
      ) state.pendingRoleSwitch = null;
    },
    joinedReceived(
      state,
      action: PayloadAction<{ epoch: number; joined: TableJoined }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (state.room.kind === 'awaiting_game_bootstrap') return;
      const pendingRoleSwitch = state.pendingRoleSwitch;
      if (
        state.room.kind === 'pregame'
        && pendingRoleSwitch?.tableID === action.payload.joined.tableID
      ) {
        pendingRoleSwitch.joinedConfirmed = true;
        completeRoleSwitchIfConfirmed(state);
        return;
      }
      if (state.room.kind !== 'none') return;

      const rematch = state.rematchTransition;
      if (rematch !== null) {
        const tableID = action.payload.joined.tableID;
        if (
          rematch.newTableID === null
          || rematch.newTableID !== tableID
        ) return;
        rematch.joinedConfirmed = true;
        if (rematch.stagedGame !== null && rematch.hidePregame !== true) {
          state.room = {
            kind: 'pregame', tableID, role: rematch.role, data: rematch.stagedGame,
          };
          state.rematchTransition = null;
        }
        return;
      }

      if (state.pendingRecovery?.tableID === action.payload.joined.tableID) {
        state.recoveryJoinedConfirmed = true;
        if (state.recoveryStagedGame !== null) {
          state.room = {
            kind: 'pregame',
            tableID: state.pendingRecovery.tableID,
            role: state.pendingRecovery.role,
            data: state.recoveryStagedGame,
          };
          state.pendingRecovery = null;
          state.recoveryJoinedConfirmed = false;
          state.recoveryStagedGame = null;
        }
        return;
      }

      const pendingJoin = state.pendingJoin;
      if (pendingJoin?.tableID === action.payload.joined.tableID) {
        pendingJoin.joinedConfirmed = true;
        if (pendingJoin.stagedGame === null) return;
        state.room = {
          kind: 'pregame',
          tableID: pendingJoin.tableID,
          role: pendingJoin.role,
          data: pendingJoin.stagedGame,
        };
        state.pendingJoin = null;
        return;
      }

      const pendingCreate = state.pendingCreate;
      if (
        pendingCreate === null
        || (pendingCreate.joinedTableID !== null
          && pendingCreate.joinedTableID !== action.payload.joined.tableID)
      ) return;
      pendingCreate.joinedTableID = action.payload.joined.tableID;
      if (
        pendingCreate.stagedGame === null
        || pendingCreate.stagedGame.tableID !== action.payload.joined.tableID
      ) return;
      state.room = {
        kind: 'pregame',
        tableID: action.payload.joined.tableID,
        role: 'player',
        data: pendingCreate.stagedGame,
      };
      state.pendingCreate = null;
    },
    gameReceived(
      state,
      action: PayloadAction<{ epoch: number; game: PregameGame }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (state.room.kind === 'awaiting_game_bootstrap') return;
      const { game } = action.payload;

      const rematch = state.rematchTransition;
      const oldReplayStillVisible = state.room.kind === 'live_game'
        && rematch !== null
        && state.room.tableID === rematch.oldTableID;
      if ((state.room.kind === 'none' || oldReplayStillVisible) && rematch !== null) {
        const names = game.players.map((player) => player.name);
        if (
          game.tableID === rematch.oldTableID
          || (rematch.newTableID !== null && rematch.newTableID !== game.tableID)
          || names.some((name) => !rematch.originalPlayerNames.includes(name))
          || (rematch.role === 'player') !== game.players.some((player) => player.you)
        ) return;
        rematch.stagedGame = game;
        if (
          state.room.kind === 'none'
          && rematch.newTableID === game.tableID
          && rematch.joinedConfirmed
          && rematch.hidePregame !== true
        ) {
          state.room = {
            kind: 'pregame', tableID: game.tableID, role: rematch.role, data: game,
          };
          state.rematchTransition = null;
        }
        return;
      }

      if (state.room.kind === 'none' && state.pendingRecovery?.tableID === game.tableID) {
        if (!state.recoveryJoinedConfirmed) {
          state.recoveryStagedGame = game;
          return;
        }
        state.room = {
          kind: 'pregame',
          tableID: game.tableID,
          role: state.pendingRecovery.role,
          data: game,
        };
        state.pendingRecovery = null;
        state.recoveryJoinedConfirmed = false;
        state.recoveryStagedGame = null;
        return;
      }

      if (state.room.kind === 'pregame') {
        if (state.room.tableID === game.tableID) {
          const nextNames = game.players.map((player) => player.name);
          const pendingUpdate = state.pendingUpdate;
          const previousOwner = state.room.data.owner;
          state.room.data = game;
          const pendingRoleSwitch = state.pendingRoleSwitch;
          if (
            pendingRoleSwitch?.tableID === game.tableID
            && (pendingRoleSwitch.targetRole === 'player' || pendingRoleSwitch.leftConfirmed)
          ) {
            pendingRoleSwitch.stagedGame = game;
            completeRoleSwitchIfConfirmed(state);
            if (state.room.kind !== 'pregame') return;
          }
          if (
            pendingUpdate?.tableID === game.tableID
            && pendingUpdate.name === game.name
            && pendingUpdate.maxPlayers === game.maxPlayers
            && pendingUpdate.variantName === game.options.variantName
            && pendingUpdate.cardCycle === game.options.cardCycle
            && pendingUpdate.emptyClues === game.options.emptyClues
            && pendingUpdate.oneExtraCard === game.options.oneExtraCard
            && pendingUpdate.oneLessCard === game.options.oneLessCard
            && pendingUpdate.allOrNothing === game.options.allOrNothing
          ) state.pendingUpdate = null;
          if (
            state.pendingLeaderName === game.players[0]?.name
            && game.owner !== previousOwner
          ) state.pendingLeaderName = null;
          if (
            state.pendingStart?.tableID === game.tableID
            && (state.pendingStart.intendedPlayers.length !== nextNames.length
              || state.pendingStart.intendedPlayers.some(
                (name, index) => name !== nextNames[index],
              ))
          ) state.pendingStart = null;
        }
        return;
      }

      const pendingJoin = state.pendingJoin;
      if (pendingJoin?.tableID === game.tableID) {
        if (!pendingJoin.joinedConfirmed) {
          pendingJoin.stagedGame = game;
          return;
        }
        state.room = {
          kind: 'pregame',
          tableID: pendingJoin.tableID,
          role: pendingJoin.role,
          data: game,
        };
        state.pendingJoin = null;
        return;
      }

      const pendingCreate = state.pendingCreate;
      if (
        pendingCreate === null
        || game.name !== pendingCreate.name
        || game.owner !== pendingCreate.creatorUserID
        || !game.players.some((player) => player.you)
        || (pendingCreate.joinedTableID !== null
          && pendingCreate.joinedTableID !== game.tableID)
        || (pendingCreate.stagedGame !== null
          && pendingCreate.stagedGame.tableID !== game.tableID)
      ) return;
      if (pendingCreate.joinedTableID === game.tableID) {
        state.room = {
          kind: 'pregame',
          tableID: game.tableID,
          role: 'player',
          data: game,
        };
        state.pendingCreate = null;
      } else {
        pendingCreate.stagedGame = game;
      }
    },
    startRequested(
      state,
      action: PayloadAction<{
        epoch: number;
        tableID: number;
        ownerUserID: number;
        intendedPlayers: string[];
      }>,
    ) {
      const { epoch, tableID, ownerUserID, intendedPlayers } = action.payload;
      if (
        state.connectionEpoch !== epoch
        || state.room.kind !== 'pregame'
        || state.room.tableID !== tableID
        || state.room.data.owner !== ownerUserID
        || intendedPlayers.length < 2
        || state.pendingRoleSwitch !== null
        || state.pendingStart !== null
        || state.pendingLeaveTableID !== null
      ) return;
      const authoritativeNames = state.room.data.players.map((player) => player.name);
      if (
        authoritativeNames.length !== intendedPlayers.length
        || authoritativeNames.some((name, index) => name !== intendedPlayers[index])
      ) return;
      state.pendingStart = { tableID, intendedPlayers };
    },
    updateRequested(
      state,
      action: PayloadAction<{
        epoch: number;
        tableID: number;
        ownerUserID: number;
        name: string;
        maxPlayers: number;
        changes: MobileTableOptions;
      }>,
    ) {
      if (
        state.connectionEpoch !== action.payload.epoch
        || state.room.kind !== 'pregame'
        || state.room.role !== 'player'
        || state.room.tableID !== action.payload.tableID
        || state.room.data.owner !== action.payload.ownerUserID
        || state.pendingRoleSwitch !== null
        || state.pendingUpdate !== null
      ) return;
      state.pendingUpdate = {
        tableID: action.payload.tableID,
        name: action.payload.name,
        maxPlayers: action.payload.maxPlayers,
        ...action.payload.changes,
      };
    },
    leaderRequested(
      state,
      action: PayloadAction<{
        epoch: number;
        tableID: number;
        requesterUserID: number;
        name: string;
      }>,
    ) {
      if (
        state.connectionEpoch !== action.payload.epoch
        || state.room.kind !== 'pregame'
        || state.room.role !== 'player'
        || state.room.tableID !== action.payload.tableID
        || state.pendingRoleSwitch !== null
        || state.pendingLeaderName !== null
      ) return;
      const requesterIsOwner = state.room.data.owner === action.payload.requesterUserID;
      const target = state.room.data.players.find((player) => player.name === action.payload.name);
      if (
        state.room.data.players[0]?.name === action.payload.name
        || target === undefined
        || (!requesterIsOwner && !target.you)
      ) return;
      state.pendingLeaderName = action.payload.name;
    },
    restartRequested(
      state,
      action: PayloadAction<{ epoch: number; tableID: number; hidePregame?: boolean }>,
    ) {
      if (
        state.connectionEpoch !== action.payload.epoch
        || state.pendingRestartTableID !== null
        || state.rematchTransition !== null
        || state.room.kind !== 'live_game'
        || state.room.tableID !== action.payload.tableID
        || state.room.clientState.replay.shared === null
      ) return;
      state.pendingRestartTableID = action.payload.tableID;
      state.pendingRestartHidePregame = action.payload.hidePregame ?? true;
    },
    bootReceived(
      state,
      action: PayloadAction<{ epoch: number; boot: Boot }>,
    ) {
      if (
        state.connectionEpoch !== action.payload.epoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== action.payload.boot.TableID
        || state.room.clientState.replay.shared === null
      ) return;
      const clientState = state.room.clientState;
      if (state.rematchTransition === null) {
        state.rematchTransition = {
          oldTableID: state.room.tableID,
          originalPlayerNames: [...clientState.metadata.playerNames],
          role: clientState.metadata.playerNames.includes(clientState.metadata.ourUsername)
            ? 'player'
            : 'spectator',
          newTableID: null,
          joinedConfirmed: false,
          stagedGame: null,
          hidePregame: state.pendingRestartTableID === action.payload.boot.TableID
            ? state.pendingRestartHidePregame ?? true
            : null,
        };
      }
      state.pendingRestartTableID = null;
      state.pendingRestartHidePregame = null;
    },
    restartMigrationConfirmed(
      state,
      action: PayloadAction<{
        epoch: number;
        tableID: number;
        role: 'player' | 'spectator';
      }>,
    ) {
      const rematch = state.rematchTransition;
      const oldReplayStillVisible = state.room.kind === 'live_game'
        && rematch !== null
        && state.room.tableID === rematch.oldTableID;
      if (
        state.connectionEpoch !== action.payload.epoch
        || rematch === null
        || !(state.room.kind === 'none' || oldReplayStillVisible)
        || action.payload.tableID === 0
        || action.payload.tableID === rematch.oldTableID
        || action.payload.role !== rematch.role
        || (rematch.newTableID !== null && rematch.newTableID !== action.payload.tableID)
      ) return;
      if (
        rematch.stagedGame !== null
        && rematch.stagedGame.tableID !== action.payload.tableID
      ) rematch.stagedGame = null;
      rematch.newTableID = action.payload.tableID;
      state.pendingGameplayAction = null;
      state.pendingHypotheticalOperation = null;
      state.pendingUnattendTableID = null;
      if (oldReplayStillVisible) state.room = { kind: 'none' };
    },
    unsupportedRoomRejected(
      state,
      action: PayloadAction<{ epoch: number; tableID: number }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const { tableID } = action.payload;
      if (state.pendingRecovery?.tableID === tableID) state.pendingRecovery = null;
      if (state.pendingJoin?.tableID === tableID) state.pendingJoin = null;
      if (state.pendingSpectateTableID === tableID) state.pendingSpectateTableID = null;
      if (state.room.kind !== 'none' && state.room.tableID === tableID) {
        state.room = { kind: 'none' };
      }
      if (state.rematchTransition?.newTableID === tableID) state.rematchTransition = null;
      state.recoveryJoinedConfirmed = false;
      state.recoveryStagedGame = null;
      state.pendingGameplayAction = null;
      state.pendingHypotheticalOperation = null;
    },
    commandPendingCleared(state, action: PayloadAction<{ epoch: number }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      state.pendingSpectateTableID = null;
      state.pendingRecovery = null;
      state.recoveryJoinedConfirmed = false;
      state.recoveryStagedGame = null;
      state.pendingJoin = null;
      state.pendingCreate = null;
      const pendingRoleSwitch = state.pendingRoleSwitch;
      if (pendingRoleSwitch?.targetRole === 'spectator' && pendingRoleSwitch.leaveSent) {
        pendingRoleSwitch.rejected = true;
        if (pendingRoleSwitch.leftConfirmed) {
          state.pendingRoleSwitch = null;
          state.room = { kind: 'none' };
        }
      } else {
        state.pendingRoleSwitch = null;
      }
      state.pendingLeaveTableID = null;
      state.pendingStart = null;
      state.pendingUnattendTableID = null;
      state.pendingRestartTableID = null;
      state.pendingRestartHidePregame = null;
      state.rematchTransition = null;
      state.pendingUpdate = null;
      state.pendingLeaderName = null;
    },
    leaveRequested(
      state,
      action: PayloadAction<{ epoch: number; tableID: number }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (
        state.room.kind !== 'pregame'
        || state.room.tableID !== action.payload.tableID
        || state.pendingRoleSwitch !== null
        || state.pendingLeaveTableID !== null
        || state.pendingStart !== null
      ) return;
      state.pendingLeaveTableID = action.payload.tableID;
    },
    unattendRequested(
      state,
      action: PayloadAction<{ epoch: number; tableID: number }>,
    ) {
      if (
        state.connectionEpoch !== action.payload.epoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== action.payload.tableID
        || state.pendingUnattendTableID !== null
      ) return;
      state.pendingUnattendTableID = action.payload.tableID;
    },
    unattendConfirmed(state, action: PayloadAction<{ epoch: number }>) {
      if (
        state.connectionEpoch !== action.payload.epoch
        || !(
          (state.room.kind === 'live_game'
            && state.pendingUnattendTableID === state.room.tableID)
          || (state.room.kind === 'pregame'
            && state.room.role === 'spectator'
            && state.pendingLeaveTableID === state.room.tableID)
        )
      ) return;
      state.pendingUnattendTableID = null;
      state.pendingLeaveTableID = null;
      state.pendingGameplayAction = null;
      state.pendingHypotheticalOperation = null;
      state.room = { kind: 'none' };
    },
    leftReceived(
      state,
      action: PayloadAction<{ epoch: number; left: TableLeft }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (state.room.kind === 'awaiting_game_bootstrap') return;
      const tableID = action.payload.left.TableID;
      const pendingRoleSwitch = state.pendingRoleSwitch;
      if (
        state.room.kind === 'pregame'
        && state.room.tableID === tableID
        && pendingRoleSwitch?.tableID === tableID
        && pendingRoleSwitch.targetRole === 'spectator'
      ) {
        pendingRoleSwitch.leftConfirmed = true;
        if (pendingRoleSwitch.rejected || !pendingRoleSwitch.spectateSent) {
          state.pendingRoleSwitch = null;
          state.room = { kind: 'none' };
        }
        return;
      }
      if (
        state.room.kind !== 'pregame'
        || state.room.tableID !== tableID
        || state.pendingLeaveTableID !== tableID
      ) return;

      state.pendingLeaveTableID = null;
      state.pendingHypotheticalOperation = null;
      state.room = { kind: 'none' };
    },
    tableStartReceived(
      state,
      action: PayloadAction<{ epoch: number; tableStart: TableStart }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const { tableStart } = action.payload;

      let role: 'player' | 'spectator' | null = null;
      const rematch = state.rematchTransition;
      if (
        rematch !== null
        && state.room.kind === 'none'
        && !tableStart.replay
        && rematch.newTableID === tableStart.tableID
      ) {
        role = rematch.role;
      } else if (tableStart.replay && rematch !== null) {
        return;
      }
      if (
        role === null
        &&
        (state.room.kind === 'awaiting_game_bootstrap' || state.room.kind === 'live_game')
        && state.room.tableID === tableStart.tableID
        && (state.room.kind === 'awaiting_game_bootstrap'
          ? state.room.replay === tableStart.replay
          : state.room.sharedReplay === tableStart.replay)
      ) {
        role = state.room.role;
      } else if (
        role === null
        &&
        state.room.kind === 'none'
        && state.pendingRecovery?.tableID === tableStart.tableID
      ) {
        role = state.pendingRecovery.role;
      } else if (
        role === null
        &&
        state.room.kind === 'none'
        && state.pendingSpectateTableID === tableStart.tableID
      ) {
        role = 'spectator';
      } else if (
        role === null
        &&
        state.room.kind === 'none'
        && state.pendingJoin?.tableID === tableStart.tableID
        && !tableStart.replay
      ) {
        role = state.pendingJoin.role;
      } else if (
        role === null
        &&
        state.room.kind === 'pregame'
        && state.room.tableID === tableStart.tableID
        && !tableStart.replay
      ) {
        role = state.room.role;
      }
      if (role === null) return;

      state.pendingSpectateTableID = null;
      state.pendingRecovery = null;
      state.recoveryJoinedConfirmed = false;
      state.recoveryStagedGame = null;
      state.rematchTransition = null;
      clearC4BState(state);
      state.pendingGameplayAction = null;
      state.pendingHypotheticalOperation = null;
      state.room = {
        kind: 'awaiting_game_bootstrap',
        tableID: tableStart.tableID,
        role,
        replay: tableStart.replay,
        expectedDatabaseID: null,
        tableStartReceived: true,
        bootstrap: 'pending_c5',
      };
    },
    historicalReplayTableStartReceived(
      state,
      action: PayloadAction<{
        epoch: number;
        tableStart: TableStart;
        expectedDatabaseID: number;
      }>,
    ) {
      const { epoch, tableStart, expectedDatabaseID } = action.payload;
      if (
        state.connectionEpoch !== epoch
        || state.room.kind !== 'none'
        || !tableStart.replay
        || !Number.isInteger(expectedDatabaseID)
        || expectedDatabaseID <= 0
        || state.pendingRecovery !== null
        || state.pendingSpectateTableID !== null
        || state.pendingJoin !== null
        || state.pendingCreate !== null
        || state.rematchTransition !== null
      ) return;
      clearC4BState(state);
      state.pendingGameplayAction = null;
      state.pendingHypotheticalOperation = null;
      state.room = {
        kind: 'awaiting_game_bootstrap',
        tableID: tableStart.tableID,
        role: 'spectator',
        replay: true,
        expectedDatabaseID,
        tableStartReceived: true,
        bootstrap: 'pending_c5',
      };
    },
    bootstrapStarted(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
      }>,
    ) {
      if (state.connectionEpoch !== action.payload.connectionEpoch) return;
      if (
        state.room.kind !== 'awaiting_game_bootstrap'
        || state.room.tableID !== action.payload.tableID
        || state.room.bootstrap !== 'pending_c5'
      ) return;
      state.room.bootstrap = {
        gameLoadEpoch: action.payload.gameLoadEpoch,
        phase: 'waiting_init',
        historyActionCount: 0,
      };
    },
    bootstrapInitAccepted(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
      }>,
    ) {
      const { connectionEpoch, tableID, gameLoadEpoch } = action.payload;
      if (state.connectionEpoch !== connectionEpoch) return;
      if (
        state.room.kind !== 'awaiting_game_bootstrap'
        || state.room.tableID !== tableID
        || state.room.bootstrap === 'pending_c5'
        || state.room.bootstrap.gameLoadEpoch !== gameLoadEpoch
        || state.room.bootstrap.phase !== 'waiting_init'
      ) return;
      state.room.bootstrap.phase = 'waiting_history';
    },
    bootstrapFailed(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
      }>,
    ) {
      const { connectionEpoch, tableID, gameLoadEpoch } = action.payload;
      if (state.connectionEpoch !== connectionEpoch) return;
      if (
        state.room.kind !== 'awaiting_game_bootstrap'
        || state.room.tableID !== tableID
        || state.room.bootstrap === 'pending_c5'
        || state.room.bootstrap.gameLoadEpoch !== gameLoadEpoch
      ) return;
      state.room.bootstrap.phase = 'failed';
    },
    bootstrapCompleted(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
        clientState: State;
        historyActionCount: number;
      }>,
    ) {
      const {
        connectionEpoch, tableID, gameLoadEpoch, clientState, historyActionCount,
      } = action.payload;
      if (state.connectionEpoch !== connectionEpoch) return;
      if (
        state.room.kind !== 'awaiting_game_bootstrap'
        || state.room.tableID !== tableID
        || state.room.bootstrap === 'pending_c5'
        || state.room.bootstrap.gameLoadEpoch !== gameLoadEpoch
        || state.room.bootstrap.phase !== 'waiting_history'
      ) return;
      state.room = {
        kind: 'live_game',
        tableID,
        role: state.room.role,
        sharedReplay: clientState.replay.shared !== null,
        gameLoadEpoch,
        bootstrapPhase: 'live',
        historyActionCount,
        liveActionCount: 0,
        clientState: castDraft(clientState),
        gameHistory: null,
        connected: null,
        clock: null,
      };
    },
    liveActionAccepted(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
        expectedLiveActionCount: number;
        acceptedAction: WireGameAction;
        clientState: State;
      }>,
    ) {
      const {
        connectionEpoch, tableID, gameLoadEpoch, expectedLiveActionCount,
        acceptedAction, clientState,
      } = action.payload;
      if (state.connectionEpoch !== connectionEpoch) return;
      if (
        state.room.kind !== 'live_game'
        || state.room.tableID !== tableID
        || state.room.gameLoadEpoch !== gameLoadEpoch
        || state.room.liveActionCount !== expectedLiveActionCount
      ) return;
      state.room.clientState = castDraft(clientState);
      state.room.liveActionCount += 1;
      if (acceptedAction.type === 'turn') state.room.clock = null;
      if (
        acceptedAction.type === 'turn'
        && state.pendingGameplayAction?.connectionEpoch === connectionEpoch
        && state.pendingGameplayAction.tableID === tableID
        && state.pendingGameplayAction.gameLoadEpoch === gameLoadEpoch
      ) {
        state.pendingGameplayAction = null;
      }
    },
    reviewSegmentSelected(
      state,
      action: PayloadAction<{
        tableID: number;
        gameLoadEpoch: number;
        segment: number | null;
      }>,
    ) {
      if (
        state.room.kind !== 'live_game'
        || state.room.tableID !== action.payload.tableID
        || state.room.gameLoadEpoch !== action.payload.gameLoadEpoch
      ) return;
      const segment = action.payload.segment;
      const latestSegment = state.room.clientState.ongoingGame.turn.segment;
      const shared = state.room.clientState.replay.shared;
      if (
        segment !== null
        && (
          latestSegment === null
          || segment < 0
          || segment > latestSegment
          || state.room.clientState.replay.states[segment] === undefined
        )
      ) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      if (shared !== null) {
        if (segment === null || shared.amLeader) return;
        let next = current as State;
        if (shared.useSharedSegments) {
          next = stateReducer(next, {
            type: 'replayUseSharedSegments',
            useSharedSegments: false,
          });
        }
        state.room.clientState = castDraft(stateReducer(
          next,
          { type: 'replaySegment', segment },
        ));
        return;
      }
      if (segment === null) {
        if (current.replay.active) {
          state.room.clientState = castDraft(stateReducer(current, { type: 'replayExit' }));
        }
      } else {
        state.room.clientState = castDraft(stateReducer(
          current,
          current.replay.active
            ? { type: 'replaySegment', segment }
            : { type: 'replayEnter', segment },
        ));
      }
      if (segment !== null) state.pendingGameplayAction = null;
    },
    sharedReplaySegmentReceived(
      state,
      action: PayloadAction<{ epoch: number; tableID: number; segment: number }>,
    ) {
      const payload = action.payload;
      if (
        state.connectionEpoch !== payload.epoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID
        || state.room.clientState.replay.shared === null
        || payload.segment < 0
        || state.room.clientState.replay.states[payload.segment] === undefined
      ) return;
      const amLeader = state.room.clientState.replay.shared.amLeader;
      const current = original(state.room.clientState) ?? state.room.clientState;
      let next = stateReducer(current, {
        type: 'replaySharedSegment',
        segment: payload.segment,
      });
      if (amLeader && next.replay.segment !== payload.segment) {
        next = stateReducer(next, {
          type: 'replaySegment',
          segment: payload.segment,
        });
      }
      state.room.clientState = castDraft(next);
    },
    sharedReplayLeaderReceived(
      state,
      action: PayloadAction<{ epoch: number; tableID: number; name: string }>,
    ) {
      const payload = action.payload;
      if (
        state.connectionEpoch !== payload.epoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID
        || state.room.clientState.replay.shared === null
      ) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      state.room.clientState = castDraft(stateReducer(current, {
        type: 'replayLeader',
        name: payload.name,
      }));
    },
    spectatorsReceived(
      state,
      action: PayloadAction<{
        epoch: number;
        tableID: number;
        spectators: readonly Spectator[];
      }>,
    ) {
      const payload = action.payload;
      if (
        state.connectionEpoch !== payload.epoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID
      ) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      state.room.clientState = castDraft(stateReducer(current, {
        type: 'spectators',
        spectators: payload.spectators,
      }));
    },
    noteActionAccepted(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
        noteAction: NoteAction;
      }>,
    ) {
      const payload = action.payload;
      if (
        state.connectionEpoch !== payload.connectionEpoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID
        || state.room.gameLoadEpoch !== payload.gameLoadEpoch
      ) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      state.room.clientState = castDraft(stateReducer(current, payload.noteAction));
    },
    connectedReceived(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
        list: readonly boolean[];
      }>,
    ) {
      const payload = action.payload;
      if (
        state.connectionEpoch !== payload.connectionEpoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID
        || state.room.gameLoadEpoch !== payload.gameLoadEpoch
        || payload.list.length !== state.room.clientState.metadata.options.numPlayers
      ) return;
      state.room.connected = castDraft(payload.list);
    },
    clockReceived(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
        clock: Clock;
        receivedAtMs: number;
      }>,
    ) {
      const payload = action.payload;
      if (
        state.connectionEpoch !== payload.connectionEpoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID
        || state.room.gameLoadEpoch !== payload.gameLoadEpoch
        || state.room.clientState.pause.active
        || !state.room.clientState.metadata.options.timed
        || payload.clock.times.length !== state.room.clientState.metadata.options.numPlayers
        || payload.clock.activePlayerIndex < 0
        || payload.clock.activePlayerIndex
          >= state.room.clientState.metadata.options.numPlayers
      ) return;
      state.room.clock = castDraft({
        times: payload.clock.times,
        activePlayerIndex: payload.clock.activePlayerIndex,
        timeTaken: payload.clock.timeTaken,
        receivedAtMs: payload.receivedAtMs,
      });
    },
    pauseReceived(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
        pause: Pause;
        receivedAtMs: number;
      }>,
    ) {
      const payload = action.payload;
      if (
        state.connectionEpoch !== payload.connectionEpoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID
        || state.room.gameLoadEpoch !== payload.gameLoadEpoch
      ) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      const numPlayers = current.metadata.options.numPlayers;
      if (payload.pause.active
        ? payload.pause.playerIndex < 0 || payload.pause.playerIndex >= numPlayers
        : payload.pause.playerIndex !== -1) return;
      const playerIndex = (payload.pause.active
        ? payload.pause.playerIndex
        : current.pause.playerIndex) as State['pause']['playerIndex'];
      state.room.clientState = castDraft(stateReducer(current, {
        type: 'pause', active: payload.pause.active, playerIndex,
      }));
      if (payload.pause.active) {
        const clock = state.room.clock;
        if (clock !== null) {
          const elapsed = Math.max(0, payload.receivedAtMs - clock.receivedAtMs);
          const times = [...clock.times];
          const old = times[clock.activePlayerIndex];
          if (old !== undefined) times[clock.activePlayerIndex] = Math.max(0, old - elapsed);
          state.room.clock = castDraft({ ...clock, times, receivedAtMs: payload.receivedAtMs });
        }
      } else {
        state.room.clock = null;
      }
    },
    pauseQueueChanged(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
        queued: boolean;
      }>,
    ) {
      const payload = action.payload;
      if (
        state.connectionEpoch !== payload.connectionEpoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID
        || state.room.gameLoadEpoch !== payload.gameLoadEpoch
      ) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      state.room.clientState = castDraft(stateReducer(current, {
        type: 'pauseQueue', queued: payload.queued,
      }));
    },
    followReplayLeader(
      state,
      action: PayloadAction<{ tableID: number; gameLoadEpoch: number }>,
    ) {
      if (
        state.room.kind !== 'live_game'
        || state.room.tableID !== action.payload.tableID
        || state.room.gameLoadEpoch !== action.payload.gameLoadEpoch
      ) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      const shared = current.replay.shared;
      if (shared === null || shared.amLeader || shared.useSharedSegments) return;
      let next = stateReducer(current, {
        type: 'replayUseSharedSegments',
        useSharedSegments: true,
      });
      next = stateReducer(next, {
        type: 'replaySegment',
        segment: shared.segment,
      });
      state.room.clientState = castDraft(next);
    },
    hypotheticalStarted(
      state,
      action: PayloadAction<{ epoch: number; tableID: number; showDrawnCards: boolean; actions: readonly ActionIncludingHypothetical[] }>,
    ) {
      const payload = action.payload;
      if (state.connectionEpoch !== payload.epoch || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID || !state.room.clientState.replay.active
        || state.room.clientState.replay.hypothetical !== null) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      state.room.clientState = castDraft(stateReducer(current, {
        type: 'hypoStart', showDrawnCards: payload.showDrawnCards, actions: payload.actions,
      }));
      state.pendingHypotheticalOperation = null;
    },
    hypotheticalEnded(state, action: PayloadAction<{ epoch: number; tableID: number }>) {
      const payload = action.payload;
      if (state.connectionEpoch !== payload.epoch || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID || state.room.clientState.replay.hypothetical === null) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      state.room.clientState = castDraft(stateReducer(current, { type: 'hypoEnd' }));
      state.pendingHypotheticalOperation = null;
    },
    hypotheticalActionReceived(
      state,
      action: PayloadAction<{ epoch: number; tableID: number; action: ActionIncludingHypothetical }>,
    ) {
      const payload = action.payload;
      if (state.connectionEpoch !== payload.epoch || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID || state.room.clientState.replay.hypothetical === null) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      state.room.clientState = castDraft(stateReducer(current, { type: 'hypoAction', action: payload.action }));
      const pending = state.pendingHypotheticalOperation;
      if (
        pending !== null
        && pending.connectionEpoch === payload.epoch
        && pending.tableID === payload.tableID
        && pending.gameLoadEpoch === state.room.gameLoadEpoch
        && hypotheticalActionsEqual(pending.finalAction, payload.action)
      ) state.pendingHypotheticalOperation = null;
    },
    hypotheticalBackReceived(state, action: PayloadAction<{ epoch: number; tableID: number }>) {
      const payload = action.payload;
      if (state.connectionEpoch !== payload.epoch || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID || state.room.clientState.replay.hypothetical === null) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      state.room.clientState = castDraft(stateReducer(current, { type: 'hypoBack' }));
    },
    hypotheticalDrawnCardsChanged(
      state,
      action: PayloadAction<{ epoch: number; tableID: number; showDrawnCards: boolean }>,
    ) {
      const payload = action.payload;
      if (state.connectionEpoch !== payload.epoch || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID || state.room.clientState.replay.hypothetical === null) return;
      const current = original(state.room.clientState) ?? state.room.clientState;
      state.room.clientState = castDraft(stateReducer(current, {
        type: 'hypoShowDrawnCards', showDrawnCards: payload.showDrawnCards,
      }));
    },
    clientStateAccepted(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
        expectedActionCount: number;
        clientState: State;
      }>,
    ) {
      const payload = action.payload;
      if (
        state.connectionEpoch !== payload.connectionEpoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID
        || state.room.gameLoadEpoch !== payload.gameLoadEpoch
        || state.room.clientState.replay.actions.length !== payload.expectedActionCount
        || state.room.clientState.ongoingGame.turn.currentPlayerIndex !== null
      ) return;
      state.room.clientState = castDraft(payload.clientState);
      state.room.sharedReplay = payload.clientState.replay.shared !== null;
      state.pendingGameplayAction = null;
      state.pendingHypotheticalOperation = null;
    },
    gameHistoryAccepted(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
        history: GameHistoryItem;
      }>,
    ) {
      const payload = action.payload;
      if (
        state.connectionEpoch !== payload.connectionEpoch
        || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID
        || state.room.gameLoadEpoch !== payload.gameLoadEpoch
        || state.room.clientState.ongoingGame.turn.currentPlayerIndex !== null
      ) return;
      state.room.gameHistory = castDraft(payload.history);
    },
    gameplayActionRequested(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
        action: ClientGameplayAction;
      }>,
    ) {
      const { connectionEpoch, tableID, gameLoadEpoch } = action.payload;
      if (
        state.connectionEpoch !== connectionEpoch
        || state.pendingGameplayAction !== null
        || state.room.kind !== 'live_game'
        || state.room.role !== 'player'
        || state.room.tableID !== tableID
        || state.room.gameLoadEpoch !== gameLoadEpoch
        || state.room.clientState.replay.active
        || action.payload.action.tableID !== tableID
      ) return;
      state.pendingGameplayAction = castDraft(action.payload);
    },
    gameplayPendingCleared(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
      }>,
    ) {
      const pending = state.pendingGameplayAction;
      if (
        pending === null
        || pending.connectionEpoch !== action.payload.connectionEpoch
        || pending.tableID !== action.payload.tableID
        || pending.gameLoadEpoch !== action.payload.gameLoadEpoch
      ) return;
      state.pendingGameplayAction = null;
    },
    hypotheticalOperationRequested(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
        finalAction: ActionIncludingHypothetical;
      }>,
    ) {
      const payload = action.payload;
      if (
        state.connectionEpoch !== payload.connectionEpoch
        || state.pendingHypotheticalOperation !== null
        || state.room.kind !== 'live_game'
        || state.room.tableID !== payload.tableID
        || state.room.gameLoadEpoch !== payload.gameLoadEpoch
        || state.room.clientState.replay.shared === null
        || state.room.clientState.replay.hypothetical === null
      ) return;
      state.pendingHypotheticalOperation = castDraft(payload);
    },
    hypotheticalOperationPendingCleared(
      state,
      action: PayloadAction<{
        connectionEpoch: number;
        tableID: number;
        gameLoadEpoch: number;
      }>,
    ) {
      const pending = state.pendingHypotheticalOperation;
      if (
        pending === null
        || pending.connectionEpoch !== action.payload.connectionEpoch
        || pending.tableID !== action.payload.tableID
        || pending.gameLoadEpoch !== action.payload.gameLoadEpoch
      ) return;
      state.pendingHypotheticalOperation = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(lobbyActions.tableGone, (state, action) => {
      const rematch = state.rematchTransition;
      if (
        state.connectionEpoch !== action.payload.epoch
        || rematch === null
        || action.payload.tableID !== rematch.oldTableID
      ) return;
      if (
        state.room.kind === 'live_game'
        && state.room.tableID === rematch.oldTableID
      ) state.room = { kind: 'none' };
      state.pendingGameplayAction = null;
      state.pendingHypotheticalOperation = null;
      state.pendingUnattendTableID = null;
    });
    builder.addCase(sessionActions.connectionStarted, (state, action) => {
      state.connectionEpoch = action.payload.epoch;
      state.pendingSpectateTableID = null;
      state.pendingRecovery = null;
      state.recoveryJoinedConfirmed = false;
      state.recoveryStagedGame = null;
      state.pendingGameplayAction = null;
      state.pendingHypotheticalOperation = null;
      state.pendingUnattendTableID = null;
      state.pendingRestartTableID = null;
      state.pendingRestartHidePregame = null;
      state.rematchTransition = null;
      clearC4BState(state);
      state.room = { kind: 'none' };
    });
    builder.addCase(sessionActions.connectionFailed, (state, action) => {
      if (state.connectionEpoch === action.payload.epoch) {
        state.pendingCreate = null;
        state.pendingStart = null;
        state.pendingGameplayAction = null;
        state.pendingHypotheticalOperation = null;
        state.pendingUnattendTableID = null;
        state.pendingRestartTableID = null;
        state.pendingRestartHidePregame = null;
        state.pendingUpdate = null;
        state.pendingLeaderName = null;
        state.pendingRoleSwitch = null;
      }
    });
    builder.addCase(sessionActions.connectionClosed, (state, action) => {
      if (state.connectionEpoch === action.payload.epoch) {
        state.pendingCreate = null;
        state.pendingStart = null;
        state.pendingGameplayAction = null;
        state.pendingHypotheticalOperation = null;
        state.pendingUnattendTableID = null;
        state.pendingRestartTableID = null;
        state.pendingRestartHidePregame = null;
        state.pendingUpdate = null;
        state.pendingLeaderName = null;
        state.pendingRoleSwitch = null;
      }
    });
    builder.addCase(sessionActions.signedOut, () => initialState);
  },
});

export const roomActions = roomSlice.actions;
