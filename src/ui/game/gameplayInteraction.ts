export type GameplayCluePreviewState = {
  type: 'color' | 'rank';
  value: number;
} | null;

export type GameplayInteractionState = {
  selectedCard: number | null;
  clueTarget: number | null;
  cluePreview: GameplayCluePreviewState;
  empathyPlayer: number | null;
  globalEmpathy: boolean;
  noteCard: number | null;
};

export type GameplayInteractionAction =
  | { type: 'select-card'; order: number | null }
  | { type: 'select-clue-target'; playerIndex: number | null }
  | { type: 'preview-clue'; clueType: 'color' | 'rank'; value: number }
  | { type: 'clear-clue-preview' }
  | { type: 'open-note'; order: number | null }
  | { type: 'toggle-empathy-player'; playerIndex: number }
  | { type: 'toggle-global-empathy' }
  | { type: 'hold-empathy'; playerIndex: number | null }
  | { type: 'cancel-transient' }
  | { type: 'disarm-gameplay' }
  | { type: 'reset-lifecycle-transients' }
  | { type: 'sync-hands'; ownOrders: readonly number[]; clueTargets: readonly number[]; visibleOrders: readonly number[] };

export const initialGameplayInteractionState: GameplayInteractionState = {
  selectedCard: null,
  clueTarget: null,
  cluePreview: null,
  empathyPlayer: null,
  globalEmpathy: false,
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
        clueTarget: null,
        cluePreview: null,
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
        clueTarget: null,
        cluePreview: null,
      };
    case 'toggle-empathy-player':
      return {
        ...state,
        empathyPlayer: state.empathyPlayer === action.playerIndex ? null : action.playerIndex,
        globalEmpathy: false,
      };
    case 'toggle-global-empathy':
      return {
        ...state,
        empathyPlayer: null,
        globalEmpathy: !state.globalEmpathy,
      };
    case 'hold-empathy':
      return {
        ...state,
        empathyPlayer: action.playerIndex,
        globalEmpathy: false,
      };
    case 'cancel-transient':
      return state;
    case 'disarm-gameplay':
      return {
        ...state,
        selectedCard: null,
        clueTarget: null,
        cluePreview: null,
      };
    case 'reset-lifecycle-transients':
      return state;
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
      return {
        selectedCard,
        clueTarget,
        cluePreview,
        empathyPlayer,
        globalEmpathy: state.globalEmpathy,
        noteCard,
      };
    }
    default:
      return state;
  }
}
