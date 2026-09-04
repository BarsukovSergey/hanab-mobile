export type GameplayInteractionState = {
  selectedCard: number | null;
  clueTarget: number | null;
  empathyPlayer: number | null;
  noteCard: number | null;
};

export type GameplayInteractionAction =
  | { type: 'select-card'; order: number | null }
  | { type: 'select-clue-target'; playerIndex: number | null }
  | { type: 'open-note'; order: number | null }
  | { type: 'hold-empathy'; playerIndex: number | null }
  | { type: 'sync-hands'; ownOrders: readonly number[]; clueTargets: readonly number[]; visibleOrders: readonly number[] };

export const initialGameplayInteractionState: GameplayInteractionState = {
  selectedCard: null,
  clueTarget: null,
  empathyPlayer: null,
  noteCard: null,
};

export function gameplayInteractionReducer(
  state: GameplayInteractionState,
  action: GameplayInteractionAction,
): GameplayInteractionState {
  switch (action.type) {
    case 'select-card':
      return {
        ...state,
        selectedCard: action.order,
        noteCard: action.order ?? state.noteCard,
      };
    case 'select-clue-target':
      return {
        ...state,
        clueTarget: action.playerIndex,
      };
    case 'open-note':
      return {
        ...state,
        noteCard: action.order,
      };
    case 'hold-empathy':
      return {
        ...state,
        empathyPlayer: action.playerIndex,
      };
    case 'sync-hands': {
      const selectedCard = state.selectedCard !== null && action.ownOrders.includes(state.selectedCard)
        ? state.selectedCard
        : action.ownOrders[action.ownOrders.length - 1] ?? null;
      const clueTarget = state.clueTarget !== null && action.clueTargets.includes(state.clueTarget)
        ? state.clueTarget
        : action.clueTargets[0] ?? null;
      let noteCard = state.noteCard;
      if (noteCard === null || !action.visibleOrders.includes(noteCard)) {
        noteCard = selectedCard !== null && action.visibleOrders.includes(selectedCard)
          ? selectedCard
          : action.visibleOrders[0] ?? null;
      }
      const empathyPlayer = state.empathyPlayer !== null && action.clueTargets.includes(state.empathyPlayer)
        ? state.empathyPlayer
        : null;
      return { selectedCard, clueTarget, empathyPlayer, noteCard };
    }
    default:
      return state;
  }
}
