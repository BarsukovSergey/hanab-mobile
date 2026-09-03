export function getDisplayedHandOrders<T>(hand: readonly T[] | undefined): readonly T[] {
  return hand === undefined ? [] : [...hand].reverse();
}
