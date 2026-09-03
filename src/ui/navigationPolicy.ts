export type LocalScreen = 'lobby' | 'history';
export type BackAction = 'go_to_lobby' | 'consume' | 'system';

type BackPresentationState = {
  localScreen: LocalScreen;
  authenticated: boolean;
  roomKind: 'none' | 'pregame' | 'awaiting_game_bootstrap' | 'live_game';
  rematchPending: boolean;
};

export function getBackAction(state: BackPresentationState): BackAction {
  if (state.roomKind === 'pregame'
    || state.roomKind === 'awaiting_game_bootstrap'
    || state.roomKind === 'live_game'
    || state.rematchPending) return 'consume';
  if (!state.authenticated) return 'system';
  if (state.localScreen === 'history') return 'go_to_lobby';
  return 'system';
}
