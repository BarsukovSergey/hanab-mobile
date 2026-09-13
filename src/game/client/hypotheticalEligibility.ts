import type { HypotheticalState } from './types/HypotheticalState';

export function canToggleHypotheticalDrawnCards(hypothetical: HypotheticalState): boolean {
  const drawnOrders = new Set(hypothetical.actions.flatMap((action) => (
    action.type === 'draw' ? [action.order] : []
  )));
  if (drawnOrders.size === 0) return false;
  return !hypothetical.actions.some((action) => (action.type === 'play' || action.type === 'discard')
    ? drawnOrders.has(action.order)
    : action.type === 'clue' && action.list.some((order) => drawnOrders.has(order)));
}
