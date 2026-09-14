import { HANABI_CARD_ASPECT_RATIO } from './gameplayLayout';

export type C17DenseLayout = {
  mode: 'full-ledger' | 'compact-overview';
  opponentCardHeight: number;
  ownCardHeight: number;
  opponentRowHeight: number;
  ownRowHeight: number;
  handsHeight: number;
  workbenchHeight: number;
};

type Input = {
  opponentCardLaneWidth: number;
  handsRegionHeight: number;
  ownCardLaneWidth: number;
  opponentCount: number;
  cardsPerHand: number;
  workbenchHeight?: number;
};

const OPPONENT_CARD_GAP = 3;
const OWN_CARD_GAP = 3;
const OPPONENT_ROW_GAP = 2;
const HAND_ROW_GAP = 5;
const HAND_ROW_VERTICAL_PADDING = 2;
const HAND_ROW_METADATA_HEIGHT = 14;
const HAND_ROW_METADATA_GAP = 2;
const HAND_ROW_BORDER_WIDTH = 1;
const HAND_ROW_CHROME = HAND_ROW_VERTICAL_PADDING * 2
  + HAND_ROW_METADATA_HEIGHT
  + HAND_ROW_METADATA_GAP
  + HAND_ROW_BORDER_WIDTH * 2;
const DEFAULT_WORKBENCH_HEIGHT = 156;
const MIN_READABLE_OPPONENT_CARD_HEIGHT = 46;

/**
 * The Workbench is a reserved shell rectangle. Its height is selected from the window class,
 * never from whichever tool happens to be open inside it. Overflowing tool content scrolls inside
 * the Workbench instead of stealing height from the Table Ledger.
 */
export function getC17WorkbenchHeight(viewportHeight: number): number {
  if (viewportHeight >= 780) return 176;
  if (viewportHeight >= 640) return 156;
  return 140;
}

export function getC17CardLaneWidth(rowWidth: number): number {
  const horizontalPadding = 4;
  const borderWidth = 1;
  return Math.max(1, rowWidth - horizontalPadding * 2 - borderWidth * 2);
}

/**
 * C17 allocates cards from the measured card lanes and the stable hands rectangle captured for the
 * current window/text-scale class. Tool content is deliberately absent from this calculation.
 *
 * Full Ledger is therefore an outcome, not a breakpoint: if the resulting card face remains
 * readable it is used. Compact Overview is selected only when the available geometry would push
 * opponent cards below the readability floor.
 */
export function getC17DenseLayout({
  opponentCardLaneWidth,
  handsRegionHeight,
  ownCardLaneWidth,
  opponentCount,
  cardsPerHand,
  workbenchHeight = DEFAULT_WORKBENCH_HEIGHT,
}: Input): C17DenseLayout {
  const opponents = Math.max(1, opponentCount);
  const capacity = Math.max(1, cardsPerHand);
  const opponentWidthFit = cardHeightForWidth(opponentCardLaneWidth, capacity, OPPONENT_CARD_GAP);
  const ownWidthFit = cardHeightForWidth(ownCardLaneWidth, capacity, OWN_CARD_GAP);
  const widthFit = Math.max(1, Math.min(opponentWidthFit, ownWidthFit));
  const baseCardHeight = maxCardHeightThatFits(widthFit, handsRegionHeight, opponents);
  const opponentRowHeight = baseCardHeight + HAND_ROW_CHROME;
  const ownRowHeight = baseCardHeight + HAND_ROW_CHROME;
  const handsHeight = getHandsHeight(baseCardHeight, opponents);

  return {
    mode: baseCardHeight >= MIN_READABLE_OPPONENT_CARD_HEIGHT ? 'full-ledger' : 'compact-overview',
    opponentCardHeight: baseCardHeight,
    ownCardHeight: baseCardHeight,
    opponentRowHeight,
    ownRowHeight,
    handsHeight,
    workbenchHeight,
  };
}

export function getRelativeOpponentIndices(playerCount: number, ourPlayerIndex: number): readonly number[] {
  return Array.from({ length: Math.max(0, playerCount - 1) }, (_, offset) => (ourPlayerIndex + offset + 1) % playerCount);
}

function maxCardHeightThatFits(widthFit: number, handsRegionHeight: number, opponents: number): number {
  let low = 1;
  let high = Math.max(1, widthFit);
  let best = 1;

  while (low <= high) {
    const candidate = Math.floor((low + high) / 2);
    if (getHandsHeight(candidate, opponents) <= handsRegionHeight) {
      best = candidate;
      low = candidate + 1;
    } else {
      high = candidate - 1;
    }
  }

  return best;
}

function getHandsHeight(cardHeight: number, opponents: number): number {
  const opponentRowHeight = cardHeight + HAND_ROW_CHROME;
  const ownRowHeight = cardHeight + HAND_ROW_CHROME;
  return opponents * opponentRowHeight
    + ownRowHeight
    + Math.max(0, opponents - 1) * OPPONENT_ROW_GAP
    + HAND_ROW_GAP;
}

function cardHeightForWidth(width: number, cards: number, gap: number): number {
  const usableWidth = Math.max(1, width - Math.max(0, cards - 1) * gap);
  return Math.max(1, Math.floor(usableWidth / cards / HANABI_CARD_ASPECT_RATIO));
}
