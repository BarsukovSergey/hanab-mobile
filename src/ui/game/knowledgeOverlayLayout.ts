const CARD_W = 286;
const CARD_H = 406;
const CARD_ASPECT_RATIO = CARD_W / CARD_H;
const SUIT_PIP_SCALE = 0.4;
const SUIT_PIP_OFFSET_RATIO = 0.7;
const SUIT_PIP_DIAMETER_RATIO = 0.28;

export type WebSuitPipLayout = {
  left: number;
  top: number;
  size: number;
};

export type WebRankPipLayout = {
  left: number;
  top: number;
  boxSize: number;
  fontSize: number;
};

/**
 * Ports the normalized placement from HanabiCardInit.makeCachedPips.
 * Web puts suit pips around the card center using a 0.4 scale and a 0.7*CARD_W polar offset.
 */
export function getWebSuitPipLayout(
  height: number | undefined,
  suitIndex: number,
  suitCount: number,
): WebSuitPipLayout {
  const cardHeight = height ?? 112;
  const cardWidth = cardHeight * CARD_ASPECT_RATIO;
  const count = Math.max(1, suitCount);
  const angle = (-suitIndex / count + 0.25) * Math.PI * 2;
  const transformedOffset = cardWidth * SUIT_PIP_SCALE * SUIT_PIP_OFFSET_RATIO;
  const centerX = cardWidth * 0.5 - transformedOffset * Math.cos(angle);
  const centerY = cardHeight * 0.5 - transformedOffset * Math.sin(angle);
  const size = cardWidth * SUIT_PIP_DIAMETER_RATIO;

  return {
    left: centerX - size / 2,
    top: centerY - size / 2,
    size,
  };
}

/** Ports HanabiCardInit rank-pip x/y/font geometry into the current card bounds. */
export function getWebRankPipLayout(
  height: number | undefined,
  rank: number,
  rankCount: number,
): WebRankPipLayout {
  const cardHeight = height ?? 112;
  const cardWidth = cardHeight * CARD_ASPECT_RATIO;
  const xRatio = rankCount === 5
    ? rank * 0.19 - 0.14
    : (rank === 0 ? 0 : rank) * 0.15 + 0.05;

  return {
    left: cardWidth * xRatio,
    top: cardHeight * 0.81,
    boxSize: cardHeight * 0.1,
    fontSize: cardHeight * (63 / CARD_H),
  };
}
