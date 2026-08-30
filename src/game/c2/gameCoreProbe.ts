import { getDefaultMetadata } from '../upstream/metadata';
import { gameReducer } from '../upstream/reducers/gameReducer';
import { getInitialGameState } from '../upstream/reducers/initialStates/initialGameState';
import { colorClue, discard, draw, play } from '../upstream/testActions';
import type { GameAction } from '../upstream/types/gameActions';
import {
  auditSerializability,
  jsonRoundTrips,
  structuralDataEquals,
  type SerializabilityFinding,
} from './serializability';

export type ReduxOwnershipRecommendation =
  | 'DIRECT_REDUX'
  | 'DIRECT_REDUX_WITH_CAVEAT'
  | 'GAME_RUNTIME';

export type GameCoreProbeResult = {
  ok: boolean;
  deviceProbePassed: boolean;
  gameCoreImport: boolean;
  reducerSequence: boolean;
  actionCount: number;
  finalScore: number;
  clueTokens: number;
  turnNumber: number;
  previousStateMutationDetected: boolean;
  changedActionRootIdentityFailures: number;
  actionOutcomeFailures: number;
  structuralSharingObserved: boolean;
  initialStateNonPlainFindings: SerializabilityFinding[];
  sequenceStateNonPlainFindings: SerializabilityFinding[];
  jsonLossyNumericFindings: SerializabilityFinding[];
  metadataNonPlainFindings: SerializabilityFinding[];
  initialStateJsonRoundTrip: boolean;
  sequenceStatesJsonRoundTrip: boolean;
  metadataJsonRoundTrip: boolean;
  recommendation: ReduxOwnershipRecommendation;
  hermes: boolean;
};

type MutableObject = Record<string, unknown>;

function cloneStructuralValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneStructuralValue);
  if (value !== null && typeof value === 'object') {
    const result: MutableObject = {};
    for (const key of Object.keys(value)) {
      result[key] = cloneStructuralValue((value as MutableObject)[key]);
    }
    return result;
  }
  return value;
}

/**
 * Derived from the pinned package's testActions helpers and reducer integration
 * tests. It models a three-player No Variant initial deal followed by a clue,
 * successful play/replacement draw, and normal discard/replacement draw.
 */
export function getC2NoVariantActions(): readonly GameAction[] {
  return [
    draw(0, 0, 0, 1),
    draw(1, 1, 1, 1),
    draw(2, 2, 2, 1),
    draw(0, 3, 3, 2),
    draw(1, 4, 4, 2),
    draw(2, 5, 0, 2),
    draw(0, 6, 1, 3),
    draw(1, 7, 2, 3),
    draw(2, 8, 3, 3),
    draw(0, 9, 4, 4),
    draw(1, 10, 0, 4),
    draw(2, 11, 1, 4),
    draw(0, 12, 2, 5),
    draw(1, 13, 3, 5),
    draw(2, 14, 4, 5),
    colorClue(2, 0, [7], 1),
    play(1, 1, 1, 1),
    draw(1, 15, 0, 3),
    discard(2, 8, 3, 3, false),
    draw(2, 16, 1, 2),
  ];
}

function recommendationFor(
  nonPlainCount: number,
  jsonLossyCount: number,
): ReduxOwnershipRecommendation {
  if (nonPlainCount > 0) return 'GAME_RUNTIME';
  if (jsonLossyCount > 0) return 'DIRECT_REDUX_WITH_CAVEAT';
  return 'DIRECT_REDUX';
}

function actionHasExpectedEffect(
  previous: ReturnType<typeof getInitialGameState>,
  next: ReturnType<typeof getInitialGameState>,
  action: GameAction,
): boolean {
  switch (action.type) {
    case 'draw':
      return next.cardsRemainingInTheDeck === previous.cardsRemainingInTheDeck - 1
        && next.hands[action.playerIndex]?.includes(action.order) === true;
    case 'clue':
      return next.clueTokens < previous.clueTokens
        && next.clues.length === previous.clues.length + 1;
    case 'play':
      return next.score === previous.score + 1
        && next.hands[action.playerIndex]?.includes(action.order) === false
        && (action.suitIndex === -1
          || next.playStacks[action.suitIndex]?.includes(action.order) === true);
    case 'discard':
      return next.hands[action.playerIndex]?.includes(action.order) === false
        && (action.suitIndex === -1
          || next.discardStacks[action.suitIndex]?.includes(action.order) === true);
    default:
      return true;
  }
}

export function runGameCoreProbe(): GameCoreProbeResult {
  const metadata = getDefaultMetadata(3);
  const actions = getC2NoVariantActions();
  let state = getInitialGameState(metadata);
  const initialAudit = auditSerializability(state);
  const initialStateJsonRoundTrip = jsonRoundTrips(state);
  const sequenceStateNonPlainFindings: SerializabilityFinding[] = [];
  const jsonLossyNumericFindings = [...initialAudit.jsonLossyNumbers];
  let sequenceStatesJsonRoundTrip = true;
  let previousStateMutationDetected = false;
  let changedActionRootIdentityFailures = 0;
  let actionOutcomeFailures = 0;
  let structuralSharingObserved = false;

  for (const action of actions) {
    const previous = state;
    const previousSnapshot = cloneStructuralValue(previous);
    state = gameReducer(previous, action, true, false, false, false, metadata);

    if (!structuralDataEquals(previous, previousSnapshot)) {
      previousStateMutationDetected = true;
    }
    if (state === previous) changedActionRootIdentityFailures++;
    if (!actionHasExpectedEffect(previous, state, action)) actionOutcomeFailures++;
    if (state.strikes === previous.strikes || state.hole === previous.hole) {
      structuralSharingObserved = true;
    }

    const audit = auditSerializability(state);
    sequenceStateNonPlainFindings.push(...audit.nonPlain);
    jsonLossyNumericFindings.push(...audit.jsonLossyNumbers);
    sequenceStatesJsonRoundTrip = sequenceStatesJsonRoundTrip && jsonRoundTrips(state);
  }

  const metadataAudit = auditSerializability(metadata);
  const metadataJsonRoundTrip = jsonRoundTrips(metadata);
  const expectedOutcome = state.score === 1
    && state.clues.length === 1
    && state.discardStacks[3]?.length === 1
    && state.hands.every((hand) => hand.length === 5)
    && state.turn.turnNum >= 3;
  const reducerSequence = expectedOutcome
    && !previousStateMutationDetected
    && changedActionRootIdentityFailures === 0
    && actionOutcomeFailures === 0;
  const allNonPlainCount = initialAudit.nonPlain.length
    + sequenceStateNonPlainFindings.length
    + metadataAudit.nonPlain.length;
  const recommendation = recommendationFor(
    allNonPlainCount,
    jsonLossyNumericFindings.length,
  );
  const ok = reducerSequence
    && initialStateJsonRoundTrip
    && sequenceStatesJsonRoundTrip
    && metadataJsonRoundTrip;
  const hermes = (globalThis as typeof globalThis & { HermesInternal?: unknown })
    .HermesInternal !== undefined;

  return {
    ok,
    deviceProbePassed: ok && hermes,
    gameCoreImport: true,
    reducerSequence,
    actionCount: actions.length,
    finalScore: state.score,
    clueTokens: state.clueTokens,
    turnNumber: state.turn.turnNum,
    previousStateMutationDetected,
    changedActionRootIdentityFailures,
    actionOutcomeFailures,
    structuralSharingObserved,
    initialStateNonPlainFindings: initialAudit.nonPlain,
    sequenceStateNonPlainFindings,
    jsonLossyNumericFindings,
    metadataNonPlainFindings: metadataAudit.nonPlain,
    initialStateJsonRoundTrip,
    sequenceStatesJsonRoundTrip,
    metadataJsonRoundTrip,
    recommendation,
    hermes,
  };
}
