const CARD_ASPECT_RATIO = 286 / 406;
const HORIZONTAL_CONTENT_RATIO = 0.84;

export type KnowledgeOverlayMetrics = {
  pipBox: number;
  pipSize: number;
  rankBox: number;
  rankFontSize: number;
};

export function getKnowledgeOverlayMetrics(
  height: number | undefined,
  visibleSuitCount: number,
  visibleRankCount: number,
): KnowledgeOverlayMetrics {
  const cardHeight = height ?? 112;
  const cardWidth = cardHeight * CARD_ASPECT_RATIO;
  const availableWidth = cardWidth * HORIZONTAL_CONTENT_RATIO;
  const scale = Math.max(0.45, Math.min(1, cardHeight / 112));

  const suitSlots = Math.max(1, visibleSuitCount);
  const suitGapWidth = Math.max(0, suitSlots - 1);
  const maxSuitBox = Math.max(7, Math.floor((availableWidth - suitGapWidth) / suitSlots));
  const desiredPipSize = Math.max(7, Math.round(16 * scale));
  const pipBox = Math.max(7, Math.min(maxSuitBox, desiredPipSize + 1));
  const pipSize = Math.max(6, Math.min(desiredPipSize, pipBox - 1));

  const rankSlots = Math.max(1, visibleRankCount);
  const maxRankBox = Math.max(7, Math.floor(availableWidth / rankSlots));
  const desiredRankBox = Math.max(8, Math.round(12 * scale));
  const rankBox = Math.max(7, Math.min(maxRankBox, desiredRankBox));
  const rankFontSize = Math.max(6, Math.min(Math.round(10 * scale), rankBox - 2));

  return { pipBox, pipSize, rankBox, rankFontSize };
}
