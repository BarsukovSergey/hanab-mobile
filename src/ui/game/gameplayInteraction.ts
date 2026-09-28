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
  /** Compatibility field for legacy presentation code; C17 semantics keep this permanently null. */
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
  | { type: 'complete-card-action'; order: number }
  | { type: 'interrupt-lifecycle' }
  | { type: 'reset-for-game-load' }
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
    case 'reset-for-game-load':
      return initialGameplayInteractionState;
    case 'select-card':
      return {
        ...state,
        selectedCard: action.order,
        noteCard: action.order ?? state.noteCard,
        clueTarget: null,
        cluePreview: null,
        empathyPlayer: null,
        persistentEmpathyPlayer: null,
      };
    case 'select-clue-target':
      return {
        ...state,
        clueTarget: action.playerIndex,
        // Web-style retargeting keeps the candidate. The authoritative preview selector
        // recomputes touched cards and legality for the new target.
        cluePreview: action.playerIndex === null ? null : state.cluePreview,
        empathyPlayer: null,
        persistentEmpathyPlayer: null,
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
        persistentEmpathyPlayer: null,
      };
    case 'open-note':
      // Notes replace ClueComposer in the Workbench, so there is no hidden parked clue plan.
      return {
        ...state,
        noteCard: action.order,
        clueTarget: null,
        cluePreview: null,
        empathyPlayer: null,
        persistentEmpathyPlayer: null,
      };
    case 'toggle-empathy-player':
      // Persistent per-player empathy was removed from C17. Keep the action as a compatibility
      // no-op until the legacy landscape presentation is retired.
      return { ...state, empathyPlayer: null, persistentEmpathyPlayer: null };
    case 'toggle-global-empathy':
      return {
        ...state,
        empathyPlayer: null,
        persistentEmpathyPlayer: null,
        globalEmpathy: !state.globalEmpathy,
      };
    case 'hold-empathy':
      // Per-hand empathy is hold-only. Global empathy has no isolate-hand third mode.
      return state.globalEmpathy
        ? { ...state, empathyPlayer: null, persistentEmpathyPlayer: null }
        : { ...state, empathyPlayer: action.playerIndex, persistentEmpathyPlayer: null };
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
        empathyPlayer: null,
        persistentEmpathyPlayer: null,
      };
    case 'interrupt-lifecycle':
      return {
        ...state,
        selectedCard: null,
        empathyPlayer: null,
        persistentEmpathyPlayer: null,
      };
    case 'disarm-gameplay':
      return {
        ...state,
        selectedCard: null,
        clueTarget: null,
        cluePreview: null,
        empathyPlayer: null,
        persistentEmpathyPlayer: null,
      };
    case 'complete-card-action':
      return {
        ...state,
        selectedCard: null,
        clueTarget: null,
        cluePreview: null,
        empathyPlayer: null,
        persistentEmpathyPlayer: null,
        noteCard: state.noteCard === action.order ? null : state.noteCard,
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
        persistentEmpathyPlayer: null,
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
