import type { RoomState } from '../store/roomSlice';

export type PresentationFocus = 'room' | 'browsing';
export type PresentationRoomKind = RoomState['kind'];

export type PresentationFocusMemory = {
  previousConnectionEpoch: number;
  previousRoomKind: PresentationRoomKind;
  preserveNextRoomEntry: boolean;
};

export type PresentationFocusObservation = {
  connectionEpoch: number;
  roomKind: PresentationRoomKind;
  roomMigrationPending: boolean;
  stableNoOwnedRoom: boolean;
};

export function reconcilePresentationFocus(
  focus: PresentationFocus,
  memory: PresentationFocusMemory,
  observation: PresentationFocusObservation,
): { focus: PresentationFocus; memory: PresentationFocusMemory; enteredRoom: boolean } {
  const enteredRoom = memory.previousRoomKind === 'none' && observation.roomKind !== 'none';
  let preserveNextRoomEntry = memory.preserveNextRoomEntry;

  if (memory.previousRoomKind !== 'none' && observation.roomKind === 'none'
    && (memory.previousConnectionEpoch !== observation.connectionEpoch || observation.roomMigrationPending)) {
    preserveNextRoomEntry = true;
  }

  if (enteredRoom) {
    if (!preserveNextRoomEntry) focus = 'room';
    preserveNextRoomEntry = false;
  }

  if (observation.stableNoOwnedRoom) {
    focus = 'browsing';
    preserveNextRoomEntry = false;
  }

  return {
    focus,
    memory: {
      previousConnectionEpoch: observation.connectionEpoch,
      previousRoomKind: observation.roomKind,
      preserveNextRoomEntry,
    },
    enteredRoom,
  };
}
