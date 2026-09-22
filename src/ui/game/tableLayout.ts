export const HANABI_TABLE_CARD_ASPECT_RATIO = 286 / 406;

export type CompactTableFireworksLayout = {
  readonly gap: number;
  readonly stackHeight: number;
  readonly stackWidth: number;
  readonly usedWidth: number;
};

export function getCompactTableFireworkCellWidth(stackWidth: number): number {
  return stackWidth;
}

export function getCompactTableFireworksLayout(
  fireworksWidth: number,
  suitCount: number,
  landscapePhone: boolean,
): CompactTableFireworksLayout {
  const width = Math.max(1, fireworksWidth);
  const count = Math.max(1, suitCount);
  const gap = landscapePhone ? 3 : 4;
  const gaps = Math.max(0, count - 1) * gap;
  const cardWidth = Math.max(26, (width - gaps) / count);
  const maxStackHeight = landscapePhone ? 54 : 68;
  const minStackHeight = landscapePhone ? 36 : 40;
  const stackHeight = Math.max(
    minStackHeight,
    Math.min(maxStackHeight, cardWidth / HANABI_TABLE_CARD_ASPECT_RATIO),
  );
  const stackWidth = stackHeight * HANABI_TABLE_CARD_ASPECT_RATIO;

  return {
    gap,
    stackHeight,
    stackWidth,
    usedWidth: count * stackWidth + gaps,
  };
}
