export function getDisplayedHandOrders<T>(hand: readonly T[] | undefined, reverseHands: boolean): readonly T[] {
  return hand === undefined ? [] : reverseHands ? [...hand] : [...hand].reverse();
}
