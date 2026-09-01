import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { castDraft, original } from 'immer';

import type {
  PregameGame,
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
} from '../protocol/gameProtocol';
import { sessionActions } from './sessionSlice';

export type RoomState =
  | { kind: 'none' }
  | {
      kind: 'pregame';
      tableID: number;
      role: 'player';
      data: PregameGame;
    }
  | {
      kind: 'awaiting_game_bootstrap';
      tableID: number;
      role: 'player' | 'spectator';
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
      gameLoadEpoch: number;
      bootstrapPhase: 'live';
      historyActionCount: number;
      liveActionCount: number;
      clientState: State;
      gameHistory: GameHistoryItem | null;
    };

type PendingJoin = {
  tableID: number;
  joinedConfirmed: boolean;
  stagedGame: PregameGame | null;
};

type PendingCreate = {
  name: string;
  creatorUserID: number;
  joinedTableID: number | null;
  stagedGame: PregameGame | null;
};

export type RoomSliceState = {
  connectionEpoch: number;
  pendingSpectateTableID: number | null;
  pendingRecovery: {
    tableID: number;
    role: 'player' | 'spectator';
  } | null;
  pendingJoin: PendingJoin | null;
  pendingCreate: PendingCreate | null;
  pendingLeaveTableID: number | null;
  pendingUnattendTableID: number | null;
  pendingStart: {
    tableID: number;
    intendedPlayers: string[];
  } | null;
  pendingGameplayAction: {
    connectionEpoch: number;
    tableID: number;
    gameLoadEpoch: number;
    action: ClientGameplayAction;
  } | null;
  room: RoomState;
};

const initialState: RoomSliceState = {
  connectionEpoch: 0,
  pendingSpectateTableID: null,
  pendingRecovery: null,
  pendingJoin: null,
  pendingCreate: null,
  pendingLeaveTableID: null,
  pendingUnattendTableID: null,
  pendingStart: null,
  pendingGameplayAction: null,
  room: { kind: 'none' },
};

function clearC4BState(state: RoomSliceState): void {
  state.pendingJoin = null;
  state.pendingCreate = null;
  state.pendingLeaveTableID = null;
  state.pendingStart = null;
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
      state.pendingRecovery = {
        tableID: action.payload.tableID,
        role: action.payload.role,
      };
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
      state.pendingSpectateTableID = action.payload.tableID;
    },
    joinRequested(
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
      state.pendingJoin = {
        tableID: action.payload.tableID,
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
      state.pendingCreate = {
        name: action.payload.name,
        creatorUserID: action.payload.creatorUserID,
        joinedTableID: null,
        stagedGame: null,
      };
    },
    joinedReceived(
      state,
      action: PayloadAction<{ epoch: number; joined: TableJoined }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (state.room.kind === 'awaiting_game_bootstrap') return;
      if (state.room.kind !== 'none') return;
      const pendingJoin = state.pendingJoin;
      if (pendingJoin?.tableID === action.payload.joined.tableID) {
        pendingJoin.joinedConfirmed = true;
        if (pendingJoin.stagedGame === null) return;
        state.room = {
          kind: 'pregame',
          tableID: pendingJoin.tableID,
          role: 'player',
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

      if (state.room.kind === 'pregame') {
        if (state.room.tableID === game.tableID) {
          const nextNames = game.players.map((player) => player.name);
          state.room.data = game;
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
          role: 'player',
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
    commandPendingCleared(state, action: PayloadAction<{ epoch: number }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      state.pendingCreate = null;
      state.pendingStart = null;
      state.pendingUnattendTableID = null;
    },
    leaveRequested(
      state,
      action: PayloadAction<{ epoch: number; tableID: number }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (
        state.room.kind !== 'pregame'
        || state.room.tableID !== action.payload.tableID
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
        || state.room.kind !== 'live_game'
        || state.pendingUnattendTableID !== state.room.tableID
      ) return;
      state.pendingUnattendTableID = null;
      state.pendingGameplayAction = null;
      state.room = { kind: 'none' };
    },
    leftReceived(
      state,
      action: PayloadAction<{ epoch: number; left: TableLeft }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (state.room.kind === 'awaiting_game_bootstrap') return;
      const tableID = action.payload.left.TableID;
      if (
        state.room.kind !== 'pregame'
        || state.room.tableID !== tableID
        || state.pendingLeaveTableID !== tableID
      ) return;

      state.pendingLeaveTableID = null;
      state.room = { kind: 'none' };
    },
    tableStartReceived(
      state,
      action: PayloadAction<{ epoch: number; tableStart: TableStart }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const { tableStart } = action.payload;
      if (tableStart.replay) return;

      let role: 'player' | 'spectator' | null = null;
      if (
        (state.room.kind === 'awaiting_game_bootstrap' || state.room.kind === 'live_game')
        && state.room.tableID === tableStart.tableID
      ) {
        role = state.room.role;
      } else if (
        state.room.kind === 'none'
        && state.pendingRecovery?.tableID === tableStart.tableID
      ) {
        role = state.pendingRecovery.role;
      } else if (
        state.room.kind === 'none'
        && state.pendingSpectateTableID === tableStart.tableID
      ) {
        role = 'spectator';
      } else if (
        state.room.kind === 'none'
        && state.pendingJoin?.tableID === tableStart.tableID
      ) {
        role = 'player';
      } else if (
        state.room.kind === 'pregame'
        && state.room.tableID === tableStart.tableID
      ) {
        role = 'player';
      }
      if (role === null) return;

      state.pendingSpectateTableID = null;
      state.pendingRecovery = null;
      clearC4BState(state);
      state.pendingGameplayAction = null;
      state.room = {
        kind: 'awaiting_game_bootstrap',
        tableID: tableStart.tableID,
        role,
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
        gameLoadEpoch,
        bootstrapPhase: 'live',
        historyActionCount,
        liveActionCount: 0,
        clientState: castDraft(clientState),
        gameHistory: null,
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
      state.pendingGameplayAction = null;
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
  },
  extraReducers: (builder) => {
    builder.addCase(sessionActions.connectionStarted, (state, action) => {
      state.connectionEpoch = action.payload.epoch;
      state.pendingSpectateTableID = null;
      state.pendingRecovery = null;
      state.pendingGameplayAction = null;
      state.pendingUnattendTableID = null;
      clearC4BState(state);
      state.room = { kind: 'none' };
    });
    builder.addCase(sessionActions.connectionFailed, (state, action) => {
      if (state.connectionEpoch === action.payload.epoch) {
        state.pendingCreate = null;
        state.pendingStart = null;
        state.pendingGameplayAction = null;
        state.pendingUnattendTableID = null;
      }
    });
    builder.addCase(sessionActions.connectionClosed, (state, action) => {
      if (state.connectionEpoch === action.payload.epoch) {
        state.pendingCreate = null;
        state.pendingStart = null;
        state.pendingGameplayAction = null;
        state.pendingUnattendTableID = null;
      }
    });
    builder.addCase(sessionActions.signedOut, () => initialState);
  },
});

export const roomActions = roomSlice.actions;
