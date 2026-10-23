import { C17_SIDE_LABEL_LANE_WIDTH, C17_SIDE_LABEL_ROW_GAP } from './c17DenseLayout';

export function getSideClueSize(fontScale: number) {
  const scale = Math.max(1, fontScale);
  return { width: C17_SIDE_LABEL_LANE_WIDTH, height: Math.max(48, Math.ceil(28 * scale) + 6), lineHeight: Math.ceil(14 * scale) };
}

/** Reuse surplus only. Never change cards, divider, right column, or row height. */
export function sideClueFits(input: { portrait: boolean; playerCount: number; rowHeight: number; fontScale: number; leftWidth?: number; cardCellWidth?: number }) {
  const size = getSideClueSize(input.fontScale);
  if (!Number.isFinite(input.fontScale) || input.fontScale <= 0 || input.rowHeight - 6 < size.height) return false;
  return input.portrait || input.playerCount <= 3 && (input.leftWidth ?? 0) - (input.cardCellWidth ?? 0) >= size.width + C17_SIDE_LABEL_ROW_GAP;
}

export function sideClueNativeFits(availableHeight: number, box: { width: number; height: number }, text: { width: number; height: number }, fontScale: number) {
  const size = getSideClueSize(fontScale);
  return [box.width, box.height, text.width, text.height].every(Number.isFinite)
    && box.width >= 48 && box.width <= size.width && box.height >= size.height && box.height <= availableHeight
    && text.width > 0 && Math.ceil(text.width) <= box.width - 8
    && text.height > 0 && Math.ceil(text.height) <= size.lineHeight;
}
