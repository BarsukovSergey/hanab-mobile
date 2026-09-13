export function isEditableLiveNoteOrder(
  notes: readonly unknown[],
  order: number,
): boolean {
  return Number.isInteger(order)
    && order >= 0
    && notes[order] !== undefined;
}
