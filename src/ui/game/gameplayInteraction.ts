export type GameplayCluePreviewState = {
  type: 'color' | 'rank';
  value: number;
} | null;

export type GameplayInteractionState = {
  selectedCard: number | null;
  clueTarget: number | null;
  cluePreview: GameplayCluePreviewState;
  empathyPlayer: number | null;
  noteCard: number | null;
};

export type GameplayInteractionAction =
  | { type: 'select-card'; order: number | null }
  | { type: 'select-clue-target'; playerIndex: number | null }
  | { type: 'preview-clue'; clueType: 'color' | 'rank'; value: number }
  | { type: 'clear-clue-preview' }
  | { type: 'open-note'; order: number | null }
  | { type: 'hold-empathy'; playerIndex: number | null }
  | { type: 'sync-hands'; ownOrders: readonly number[]; clueTargets: readonly number[]; visibleOrders: readonly number[] };

export const initialGameplayInteractionState: GameplayInteractionState = {
  selectedCard: null,
  clueTarget: null,
  cluePreview: null,
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
        cluePreview: action.playerIndex === state.clueTarget ? state.cluePreview : null,
      };
    case 'preview-clue':
      return state.clueTarget === null
        ? state
        : {
          ...state,
          cluePreview: { type: action.clueType, value: action.value },
        };
    case 'clear-clue-preview':
      return {
        ...state,
        cluePreview: null,
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
        : null;
      const clueTarget = state.clueTarget !== null && action.clueTargets.includes(state.clueTarget)
        ? state.clueTarget
        : null;
      const noteCard = state.noteCard !== null && action.visibleOrders.includes(state.noteCard)
        ? state.noteCard
        : null;
      const empathyPlayer = state.empathyPlayer !== null && action.clueTargets.includes(state.empathyPlayer)
        ? state.empathyPlayer
        : null;
      const cluePreview = clueTarget !== null && clueTarget === state.clueTarget ? state.cluePreview : null;
      return { selectedCard, clueTarget, cluePreview, empathyPlayer, noteCard };
    }
    default:
      return state;
  }
}
