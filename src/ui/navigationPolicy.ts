import type { BrowsingPresentationState } from './browsingNavigationState';

export type BrowsingBackAction = 'back' | 'system';
export type RoomAttendanceBackAction = 'consume';

export function isPregameLandscape(width: number, height: number): boolean {
  return width > height;
}

export function getBrowsingBackAction(state: BrowsingPresentationState, authenticated = true): BrowsingBackAction {
  if (!authenticated) return 'system';
  return state.stack.length > 1 || state.destination !== 'home' ? 'back' : 'system';
}

export function getRoomAttendanceBackAction(_room: {
  kind: 'pregame' | 'awaiting_game_bootstrap' | 'live_game';
  role: 'player' | 'spectator';
}): RoomAttendanceBackAction {
  return 'consume';
}
