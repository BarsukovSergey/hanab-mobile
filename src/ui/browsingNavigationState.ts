export type BrowsingDestination = 'home' | 'history' | 'people' | 'more';

export type BrowsingSurface =
  | { kind: 'root'; destination: BrowsingDestination }
  | { kind: 'settings'; origin: BrowsingDestination };

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
  return {
    ...state,
    stack: [...state.stack, { kind: 'settings', origin: state.destination }],
  };
}

export function backBrowsing(state: BrowsingPresentationState): BrowsingPresentationState {
  if (state.stack.length <= 1) return state;
  const stack = state.stack.slice(0, -1);
  const root = stack[0];
  return { destination: root?.kind === 'root' ? root.destination : state.destination, stack };
}

export function isBrowsingSettings(state: BrowsingPresentationState): boolean {
  return state.stack[state.stack.length - 1]?.kind === 'settings';
}
