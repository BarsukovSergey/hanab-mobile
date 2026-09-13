import type { HypotheticalState } from './types/HypotheticalState';

export function canToggleHypotheticalDrawnCards(hypothetical: HypotheticalState): boolean {
  if (hypothetical.drawnCardsInHypothetical.length === 0) return false;
  return !hypothetical.actions.some((action) => (action.type === 'play' || action.type === 'discard')
    ? hypothetical.drawnCardsInHypothetical.includes(action.order)
    : action.type === 'clue' && action.list.some((order) => hypothetical.drawnCardsInHypothetical.includes(order)));
}
