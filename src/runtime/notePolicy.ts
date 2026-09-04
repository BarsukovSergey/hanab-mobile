export function isEditableLiveNoteOrder(
  hands: readonly (readonly number[])[],
  order: number,
): boolean {
  return Number.isInteger(order)
    && order >= 0
    && hands.some((hand) => hand.includes(order));
}
