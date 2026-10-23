import {
  encodeTableJoinFrame,
  encodeTableLeaveFrame,
  encodeTableReattendFrame,
  encodeTableSpectateFrame,
  encodeTableUnattendFrame,
} from '../protocol/lobbyProtocol';
import { roomActions } from '../store/roomSlice';
import type { AppStore } from '../store/store';
import {
  isJoinEligible,
  isPregameSpectateEligible,
  isReattendEligible,
  isSpectateEligible,
} from './lobbyEligibility';

import { canExitOwnedReplay, type ReplayExitOwner } from './replayExitEligibility';

// Owns attendance commands; connection, reconnect recovery, and bootstrap stay in LobbyRuntime.
export class RoomAttendanceRuntime {
  constructor(
    private readonly store: AppStore,
    // LobbyRuntime supplies its current READY-gated sender and room readiness guard.
    private readonly sendEncoded: (frame: string) => boolean,
    private readonly isReadyCurrentRoom: (tableID: number) => boolean,
  ) {}

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

  unattendLiveGame(tableID: number, expectedReview?: ReplayExitOwner): boolean {
    const state = this.store.getState();
    const room = state.room.room;
    if (
      room.kind !== 'live_game'
      || room.tableID !== tableID
      || state.room.pendingUnattendTableID !== null
      || (expectedReview !== undefined && (!canExitOwnedReplay(state, tableID, expectedReview) || !this.isReadyCurrentRoom(tableID)))
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
}
