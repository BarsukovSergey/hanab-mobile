import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import type { Welcome } from '../protocol/lobbyProtocol';

export type ConnectionPhase =
  | 'idle'
  | 'connecting'
  | 'openAwaitingWelcome'
  | 'ready'
  | 'failed'
  | 'closed';

export type AuthenticatedUser = {
  userID: number;
  username: string;
};

export type ResumeHints = Pick<
  Welcome,
  'playingAtTables' | 'disconSpectatingTable' | 'disconShadowingSeat'
>;

export type IncrementalRejectionReason =
  | 'active-bootstrap'
  | 'stale-connection-session'
  | 'wrong-room-table'
  | 'reducer-failure'
  | 'reducer-store-acceptance-failure';

export type InboundDiagnostic = {
  command: string;
  classification: 'known' | 'unknown' | 'malformed';
  gameAction?: {
    tableID: number;
    actionType: string;
    accepted: boolean;
    rejectionReason: IncrementalRejectionReason | null;
  };
};

export type GameActionDiagnostic = {
  tableID: number;
  actionType: string;
  accepted: boolean;
  rejectionReason: IncrementalRejectionReason | null;
};

export type SessionState = {
  connectionEpoch: number;
  phase: ConnectionPhase;
  authenticatedUser: AuthenticatedUser | null;
  resumeHints: ResumeHints | null;
  error: string | null;
  protocolIssueCount: number;
  lastProtocolIssue: string | null;
  inboundDiagnostics: InboundDiagnostic[];
  gameActionFramesSeen: number;
  gameActionDiagnostics: GameActionDiagnostic[];
};

const MAX_INBOUND_DIAGNOSTICS = 10;
const MAX_GAME_ACTION_DIAGNOSTICS = 10;
const MAX_DIAGNOSTIC_COMMAND_LENGTH = 64;
const MAX_DIAGNOSTIC_ACTION_TYPE_LENGTH = 32;

const initialState: SessionState = {
  connectionEpoch: 0,
  phase: 'idle',
  authenticatedUser: null,
  resumeHints: null,
  error: null,
  protocolIssueCount: 0,
  lastProtocolIssue: null,
  inboundDiagnostics: [],
  gameActionFramesSeen: 0,
  gameActionDiagnostics: [],
};

type EpochPayload = { epoch: number };

export const sessionSlice = createSlice({
  name: 'session',
  initialState,
  reducers: {
    connectionStarted(state, action: PayloadAction<EpochPayload>) {
      state.connectionEpoch = action.payload.epoch;
      state.phase = 'connecting';
      state.authenticatedUser = null;
      state.resumeHints = null;
      state.error = null;
      state.protocolIssueCount = 0;
      state.lastProtocolIssue = null;
      state.inboundDiagnostics = [];
      state.gameActionFramesSeen = 0;
      state.gameActionDiagnostics = [];
    },
    socketOpened(state, action: PayloadAction<EpochPayload>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      if (state.phase !== 'connecting') return;
      state.phase = 'openAwaitingWelcome';
    },
    welcomeReceived(state, action: PayloadAction<{ epoch: number; welcome: Welcome }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const { welcome } = action.payload;
      state.phase = 'ready';
      state.authenticatedUser = {
        userID: welcome.userID,
        username: welcome.username,
      };
      state.resumeHints = {
        playingAtTables: welcome.playingAtTables,
        disconSpectatingTable: welcome.disconSpectatingTable,
        disconShadowingSeat: welcome.disconShadowingSeat,
      };
      state.error = null;
    },
    connectionFailed(state, action: PayloadAction<{ epoch: number; error: string }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      state.phase = 'failed';
      state.error = action.payload.error;
    },
    connectionClosed(state, action: PayloadAction<{ epoch: number; error: string | null }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      state.phase = 'closed';
      state.error = action.payload.error;
    },
    protocolIssue(state, action: PayloadAction<{ epoch: number; issue: string }>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      state.protocolIssueCount += 1;
      state.lastProtocolIssue = action.payload.issue;
    },
    inboundDiagnosticRecorded(
      state,
      action: PayloadAction<{ epoch: number; diagnostic: InboundDiagnostic }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const { diagnostic } = action.payload;
      state.inboundDiagnostics.push({
        command: diagnostic.command.slice(0, MAX_DIAGNOSTIC_COMMAND_LENGTH),
        classification: diagnostic.classification,
        ...(diagnostic.gameAction === undefined ? {} : {
          gameAction: {
            ...diagnostic.gameAction,
            actionType: diagnostic.gameAction.actionType.slice(
              0,
              MAX_DIAGNOSTIC_ACTION_TYPE_LENGTH,
            ),
          },
        }),
      });
      if (state.inboundDiagnostics.length > MAX_INBOUND_DIAGNOSTICS) {
        state.inboundDiagnostics.splice(
          0,
          state.inboundDiagnostics.length - MAX_INBOUND_DIAGNOSTICS,
        );
      }
    },
    gameActionFrameSeen(state, action: PayloadAction<EpochPayload>) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      state.gameActionFramesSeen += 1;
    },
    gameActionDiagnosticRecorded(
      state,
      action: PayloadAction<{ epoch: number; diagnostic: GameActionDiagnostic }>,
    ) {
      if (state.connectionEpoch !== action.payload.epoch) return;
      const { diagnostic } = action.payload;
      state.gameActionFramesSeen += 1;
      state.gameActionDiagnostics.push({
        ...diagnostic,
        actionType: diagnostic.actionType.slice(0, MAX_DIAGNOSTIC_ACTION_TYPE_LENGTH),
      });
      if (state.gameActionDiagnostics.length > MAX_GAME_ACTION_DIAGNOSTICS) {
        state.gameActionDiagnostics.splice(
          0,
          state.gameActionDiagnostics.length - MAX_GAME_ACTION_DIAGNOSTICS,
        );
      }
    },
  },
});

export const sessionActions = sessionSlice.actions;
