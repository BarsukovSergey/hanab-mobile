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

export type SessionState = {
  connectionEpoch: number;
  phase: ConnectionPhase;
  authenticatedUser: AuthenticatedUser | null;
  resumeHints: ResumeHints | null;
  error: string | null;
  protocolIssueCount: number;
  lastProtocolIssue: string | null;
};

const initialState: SessionState = {
  connectionEpoch: 0,
  phase: 'idle',
  authenticatedUser: null,
  resumeHints: null,
  error: null,
  protocolIssueCount: 0,
  lastProtocolIssue: null,
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
  },
});

export const sessionActions = sessionSlice.actions;
