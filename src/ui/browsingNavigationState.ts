export type BrowsingDestination = 'home' | 'history' | 'people' | 'more';

export type BrowsingSurface =
  | { kind: 'root'; destination: BrowsingDestination }
  | { kind: 'settings'; origin: BrowsingDestination }
  | { kind: 'tools' | 'about'; origin: 'more' };

export type BrowsingPresentationState = {
  destination: BrowsingDestination;
  stack: BrowsingSurface[];
};

export function createBrowsingPresentation(destination: BrowsingDestination = 'home'): BrowsingPresentationState {
  return { destination, stack: [{ kind: 'root', destination }] };
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

export function backBrowsing(state: BrowsingPresentationState): BrowsingPresentationState {
  if (state.stack.length <= 1) {
    return state.destination === 'home' ? state : createBrowsingPresentation('home');
  }
  const stack = state.stack.slice(0, -1);
  const root = stack[0];
  return { destination: root?.kind === 'root' ? root.destination : state.destination, stack };
}

export function isBrowsingSettings(state: BrowsingPresentationState): boolean {
  return state.stack[state.stack.length - 1]?.kind === 'settings';
}
