export type GameplayCluePreviewState = {
  type: 'color' | 'rank';
  value: number;
} | null;

export type GameplayInteractionState = {
  selectedCard: number | null;
  clueTarget: number | null;
  cluePreview: GameplayCluePreviewState;
  /** Effective per-hand empathy target used by the presentation layer. */
  empathyPlayer: number | null;
  /** Persistent per-hand empathy target restored after a temporary hold peek. */
  persistentEmpathyPlayer: number | null;
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
  | { type: 'clear-empathy' }
  | { type: 'cancel-transient' }
  | { type: 'disarm-gameplay' }
  | { type: 'reset-lifecycle-transients' }
  | {
    type: 'sync-hands';
    ownOrders: readonly number[];
    clueTargets: readonly number[];
    empathyPlayers?: readonly number[];
    visibleOrders: readonly number[];
  };

export const initialGameplayInteractionState: GameplayInteractionState = {
  selectedCard: null,
  clueTarget: null,
  cluePreview: null,
  empathyPlayer: null,
  persistentEmpathyPlayer: null,
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
      // This is the Workbench clue-planner exit. Closing never sends a clue and restores
      // the previously preserved card/note context underneath the planner.
      return {
        ...state,
        clueTarget: null,
        cluePreview: null,
      };
    case 'open-note':
      // Note inspection is a Workbench content swap, not a destructive clue-context switch.
      return {
        ...state,
        noteCard: action.order,
      };
    case 'toggle-empathy-player': {
      const nextPlayer = state.persistentEmpathyPlayer === action.playerIndex
        ? null
        : action.playerIndex;
      return {
        ...state,
        empathyPlayer: nextPlayer,
        persistentEmpathyPlayer: nextPlayer,
        globalEmpathy: false,
      };
    }
    case 'toggle-global-empathy': {
      const nextGlobal = !state.globalEmpathy;
      return {
        ...state,
        empathyPlayer: null,
        persistentEmpathyPlayer: null,
        globalEmpathy: nextGlobal,
      };
    }
    case 'hold-empathy':
      // A hold is only a temporary peek. Releasing restores the persistent per-hand mode.
      return {
        ...state,
        empathyPlayer: action.playerIndex ?? state.persistentEmpathyPlayer,
      };
    case 'clear-empathy':
      return {
        ...state,
        empathyPlayer: null,
        persistentEmpathyPlayer: null,
        globalEmpathy: false,
      };
    case 'cancel-transient':
      return {
        ...state,
        empathyPlayer: state.persistentEmpathyPlayer,
      };
    case 'disarm-gameplay':
      return {
        ...state,
        selectedCard: null,
        clueTarget: null,
        cluePreview: null,
        empathyPlayer: state.persistentEmpathyPlayer,
      };
    case 'reset-lifecycle-transients':
      return {
        ...state,
        empathyPlayer: state.persistentEmpathyPlayer,
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
      const empathyPlayers = action.empathyPlayers ?? action.clueTargets;
      const persistentEmpathyPlayer = state.persistentEmpathyPlayer !== null
        && empathyPlayers.includes(state.persistentEmpathyPlayer)
        ? state.persistentEmpathyPlayer
        : null;
      const heldEmpathyPlayer = state.empathyPlayer !== null
        && empathyPlayers.includes(state.empathyPlayer)
        ? state.empathyPlayer
        : null;
      const empathyPlayer = heldEmpathyPlayer ?? persistentEmpathyPlayer;
      const cluePreview = clueTarget !== null && clueTarget === state.clueTarget ? state.cluePreview : null;
      return {
        selectedCard,
        clueTarget,
        cluePreview,
        empathyPlayer,
        persistentEmpathyPlayer,
        globalEmpathy: state.globalEmpathy,
        noteCard,
      };
    }
    default:
      return state;
  }
}
