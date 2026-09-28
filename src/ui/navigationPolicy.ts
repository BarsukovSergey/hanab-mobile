import type { BrowsingPresentationState } from './browsingNavigationState';

export type BrowsingBackAction = 'back' | 'system';
export type RoomAttendanceBackAction = 'leave_pregame' | 'unattend' | 'consume';

export function getBrowsingBackAction(state: BrowsingPresentationState, authenticated = true): BrowsingBackAction {
  if (!authenticated) return 'system';
  return state.stack.length > 1 || state.destination !== 'home' ? 'back' : 'system';
}

export function getRoomAttendanceBackAction(room: {
  kind: 'pregame' | 'awaiting_game_bootstrap' | 'live_game';
  role: 'player' | 'spectator';
}): RoomAttendanceBackAction {
  if (room.kind === 'pregame' && room.role === 'spectator') return 'leave_pregame';
  if (room.kind === 'live_game' && room.role === 'spectator') return 'unattend';
  return 'consume';
}
