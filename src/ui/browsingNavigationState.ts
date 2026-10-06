export type BrowsingDestination = 'home' | 'history' | 'people' | 'more';

export type BrowsingSurface =
  | { kind: 'root'; destination: BrowsingDestination }
  | { kind: 'conversation'; username: string; origin: BrowsingDestination }
  | { kind: 'settings'; origin: BrowsingDestination }
  | { kind: 'profile'; origin: 'people' | 'more'; username: string }
  | { kind: 'tools' | 'about'; origin: 'more' };

export type BrowsingPresentationState = {
  destination: BrowsingDestination;
  stack: BrowsingSurface[];
  peopleMode: 'people' | 'messages';
};

export function createBrowsingPresentation(destination: BrowsingDestination = 'home'): BrowsingPresentationState {
  return { destination, peopleMode: 'people', stack: [{ kind: 'root', destination }] };
}

export function navigateBrowsing(
  _state: BrowsingPresentationState,
  destination: BrowsingDestination,
): BrowsingPresentationState {
  return createBrowsingPresentation(destination);
}

export function openBrowsingSettings(state: BrowsingPresentationState): BrowsingPresentationState {
  if (isBrowsingSettings(state)) return state;
  return {
    ...state,
    stack: [...state.stack, { kind: 'settings', origin: state.destination }],
  };
}

export function openMoreSurface(state: BrowsingPresentationState, kind: 'tools' | 'about'): BrowsingPresentationState {
  if (state.destination !== 'more') return state;
  if (state.stack[state.stack.length - 1]?.kind === kind) return state;
  return { ...state, stack: [{ kind: 'root', destination: 'more' }, { kind, origin: 'more' }] };
}

export function currentBrowsingSurface(state: BrowsingPresentationState): BrowsingSurface {
  return state.stack[state.stack.length - 1] ?? { kind: 'root', destination: state.destination };
}

export function openBrowsingProfile(state: BrowsingPresentationState, username: string): BrowsingPresentationState {
  if (state.destination !== 'people' && state.destination !== 'more') return state;
  return { ...state, stack: [
    { kind: 'root', destination: state.destination },
    { kind: 'profile', origin: state.destination, username },
  ] };
}

export function backBrowsing(state: BrowsingPresentationState): BrowsingPresentationState {
  if (state.stack.length <= 1) {
    return state.destination === 'home' ? state : createBrowsingPresentation('home');
  }
  const stack = state.stack.slice(0, -1);
  const root = stack[0];
  return { ...state, destination: root?.kind === 'root' ? root.destination : state.destination, stack };
}

export function isBrowsingSettings(state: BrowsingPresentationState): boolean {
  return state.stack[state.stack.length - 1]?.kind === 'settings';
}

export function selectPeopleMode(state: BrowsingPresentationState, peopleMode: 'people' | 'messages'): BrowsingPresentationState {
  return { ...state, peopleMode };
}

export function openBrowsingConversation(state: BrowsingPresentationState, username: string): BrowsingPresentationState {
  if (state.destination !== 'people' && state.destination !== 'more') return state;
  if (currentBrowsingSurface(state).kind === 'conversation') return state;
  return { ...state, stack: [...state.stack, { kind: 'conversation', username, origin: state.destination }] };
}
