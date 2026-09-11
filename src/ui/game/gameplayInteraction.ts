export type GameplayCluePreviewState = {
  type: 'color' | 'rank';
  value: number;
} | null;

export type GameplayInteractionState = {
  selectedCard: number | null;
  clueTarget: number | null;
  cluePreview: GameplayCluePreviewState;
  /** Temporary hold-only empathy target. Never persisted across lifecycle interruption. */
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
  | { type: 'toggle-global-empathy' }
  | { type: 'hold-empathy'; playerIndex: number | null }
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
        empathyPlayer: null,
      };
    case 'select-clue-target':
      return {
        ...state,
        clueTarget: action.playerIndex,
        // Web-style retargeting keeps the candidate. The authoritative preview selector
        // recomputes touched cards and legality for the new target.
        cluePreview: action.playerIndex === null ? null : state.cluePreview,
        empathyPlayer: null,
        // Entering clue mode always leaves global empathy.
        globalEmpathy: action.playerIndex === null ? state.globalEmpathy : false,
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
        clueTarget: null,
        cluePreview: null,
        empathyPlayer: null,
      };
    case 'open-note':
      // Notes replace ClueComposer in the Workbench, so there is no hidden parked clue plan.
      return {
        ...state,
        noteCard: action.order,
        clueTarget: null,
        cluePreview: null,
        empathyPlayer: null,
      };
    case 'toggle-global-empathy':
      return {
        ...state,
        empathyPlayer: null,
        globalEmpathy: !state.globalEmpathy,
      };
    case 'hold-empathy':
      // Per-hand empathy is hold-only. Global empathy has no isolate-hand third mode.
      return state.globalEmpathy
        ? { ...state, empathyPlayer: null }
        : { ...state, empathyPlayer: action.playerIndex };
    case 'cancel-transient':
    case 'reset-lifecycle-transients':
      return {
        ...state,
        empathyPlayer: null,
      };
    case 'disarm-gameplay':
      return {
        ...state,
        selectedCard: null,
        clueTarget: null,
        cluePreview: null,
        empathyPlayer: null,
      };
    case 'sync-hands': {
      const selectedCard = state.selectedCard !== null && action.ownOrders.includes(state.selectedCard)
        ? state.selectedCard
        : null;
      const clueTarget = state.clueTarget !== null && action.clueTargets.includes(state.clueTarget)
        ? state.clueTarget
        : null;
      const empathyPlayers = action.empathyPlayers ?? action.clueTargets;
      const empathyPlayer = state.empathyPlayer !== null && empathyPlayers.includes(state.empathyPlayer)
        ? state.empathyPlayer
        : null;
      return {
        selectedCard,
        clueTarget,
        cluePreview: clueTarget === null ? null : state.cluePreview,
        empathyPlayer,
        globalEmpathy: state.globalEmpathy,
        // A note editor is durable by card order. Hand sync must never retarget or close it merely
        // because the card left a hand; explicit UI close owns that lifecycle.
        noteCard: state.noteCard,
      };
    }
    default:
      return state;
  }
}
