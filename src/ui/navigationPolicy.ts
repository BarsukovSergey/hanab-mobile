export type LocalScreen = 'lobby' | 'people' | 'history' | 'settings';
export type BackAction = 'go_to_lobby' | 'leave_pregame' | 'unattend' | 'consume' | 'system';

type BackPresentationState = {
  localScreen: LocalScreen;
  authenticated: boolean;
  roomKind: 'none' | 'pregame' | 'awaiting_game_bootstrap' | 'live_game';
  roomRole: 'player' | 'spectator' | null;
  rematchPending: boolean;
};

export function getBackAction(state: BackPresentationState): BackAction {
  if (state.roomKind === 'awaiting_game_bootstrap' || state.rematchPending) return 'consume';
  if (state.roomKind === 'pregame') {
    return state.roomRole === 'spectator' ? 'leave_pregame' : 'consume';
  }
  if (state.roomKind === 'live_game') {
    return state.roomRole === 'spectator' ? 'unattend' : 'consume';
  }
  if (!state.authenticated) return 'system';
  if (
    state.localScreen === 'people'
    || state.localScreen === 'history'
    || state.localScreen === 'settings'
  ) return 'go_to_lobby';
  return 'system';
}
