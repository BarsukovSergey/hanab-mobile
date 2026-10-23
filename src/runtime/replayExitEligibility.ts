import type { RoomState } from '../store/roomSlice';
import type { RootState } from '../store/store';

export type ReplayExitOwner = { connectionEpoch: number; gameLoadEpoch: number };

/** Hypothetical within an ongoing own Rewind is still attendance in the live game. */
export function isReplayAttendanceRoom(room: RoomState): boolean {
  return room.kind === 'live_game' && (room.clientState.finished || room.sharedReplay
    || room.clientState.replay.shared !== null || room.clientState.replay.databaseID !== null);
}

export function canExitOwnedReplay(state: RootState, tableID: number, owner: ReplayExitOwner): boolean {
  const room = state.room.room;
  return state.session.phase === 'ready' && state.session.connectionEpoch === owner.connectionEpoch
    && state.room.connectionEpoch === owner.connectionEpoch && state.room.pendingRecovery === null
    && state.room.rematchTransition === null && state.room.pendingUnattendTableID === null
    && room.kind === 'live_game' && room.tableID === tableID && room.gameLoadEpoch === owner.gameLoadEpoch
    && isReplayAttendanceRoom(room);
}
