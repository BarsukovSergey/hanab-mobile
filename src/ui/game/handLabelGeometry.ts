/** Stable label/Clue/clock allocation, independent of the selected tool. */
export function getHandLabelGeometry(fontScale: number) {
  const scale = Math.max(1, fontScale);
  const actionHeight = Math.ceil(20 * scale + 12);
  return {
    actionHeight,
    sideWidth: Math.ceil(62 * scale),
    sideHeight: actionHeight + Math.ceil(28 * scale) + 4,
    landscapeHeight: actionHeight,
  };
}
