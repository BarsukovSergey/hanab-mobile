import { HANABI_CARD_ASPECT_RATIO } from './gameplayLayout';

export type C17DenseLayout = {
  mode: 'full-ledger' | 'compact-overview';
  opponentCardHeight: number;
  ownCardHeight: number;
  cardTopHeadroom: number;
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
const SIDE_LABEL_ROW_CHROME = HAND_ROW_VERTICAL_PADDING * 2 + HAND_ROW_BORDER_WIDTH * 2;
export const C17_SIDE_LABEL_LANE_WIDTH = 62;
export const C17_SIDE_LABEL_ROW_GAP = 4;
const DEFAULT_WORKBENCH_HEIGHT = 156;
const HANDS_TOP_MARGIN = 5;
const WORKBENCH_TOP_MARGIN = 5;
const MIN_FULL_LEDGER_CARD_HEIGHT = 76;
const COMPACT_OPPONENT_SUMMARY_HEIGHT = 24;
const COMPACT_OPPONENT_ROW_HEIGHT = 32;

/**
 * The Workbench is a reserved shell rectangle. Its height is selected from the window class,
 * never from whichever tool happens to be open inside it. Overflowing tool content scrolls inside
 * the Workbench instead of stealing height from the Table Ledger.
 */
export function getC17WorkbenchHeight(viewportHeight: number, opponentCount?: number): number {
  if (opponentCount !== undefined && opponentCount <= 2) return 136;
  if (viewportHeight >= 780) return 176;
  if (viewportHeight >= 640) return 156;
  return 140;
}

export function getC17CardLaneWidth(rowWidth: number, sideLabelLaneWidth = 0): number {
  const horizontalPadding = 4;
  const borderWidth = 1;
  return Math.max(1, rowWidth - horizontalPadding * 2 - borderWidth * 2 - sideLabelLaneWidth);
}

/**
 * The body is owned by the workspace/chrome. Reserve the existing Workbench minimum and
 * inter-region spacing before allocating the hands within that ambient body.
 */
export function getC17HandsRegionHeight(ambientBodyHeight: number, workbenchHeight: number): number {
  return Math.max(0, ambientBodyHeight - workbenchHeight - HANDS_TOP_MARGIN - WORKBENCH_TOP_MARGIN);
}

export function hasC17AmbientRegionChanged(
  current: { height: number; width: number },
  next: { height: number; width: number },
): boolean {
  return Math.abs(current.height - next.height) >= 0.5 || Math.abs(current.width - next.width) >= 0.5;
}

/**
 * A shell can finish measuring after a transiently constrained layout. Keep the largest
 * accepted envelope for that shell so temporary chrome changes cannot shrink the Ledger.
 */
export function getC17AmbientEnvelope(
  current: { height: number; width: number },
  next: { height: number; width: number },
  sameShell: boolean,
): { height: number; width: number } {
  if (!sameShell) return next;
  return {
    height: Math.max(current.height, next.height),
    width: Math.max(current.width, next.width),
  };
}

/**
 * C17 allocates cards from the measured card lanes and the stable hands rectangle captured for the
 * current window/text-scale class. Tool content is deliberately absent from this calculation.
 *
 * Full Ledger is therefore an outcome, not a breakpoint: up to two opponents retain fitted real
 * card faces, while Compact Overview is selected only when three or more opponents would push
 * cards below the readability floor.
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
  const usesSideLabels = opponents <= 2;
  const opponentWidthFit = cardHeightForWidth(opponentCardLaneWidth, capacity, OPPONENT_CARD_GAP);
  const ownWidthFit = cardHeightForWidth(ownCardLaneWidth, capacity, OWN_CARD_GAP);
  const widthFit = Math.max(1, Math.min(opponentWidthFit, ownWidthFit));
  const baseCardHeight = maxCardHeightThatFits(widthFit, handsRegionHeight, opponents);
  if (opponents <= 2 || baseCardHeight >= MIN_FULL_LEDGER_CARD_HEIGHT) {
    const cardTopHeadroom = getCardTopHeadroom(baseCardHeight);
    const rowChrome = usesSideLabels ? SIDE_LABEL_ROW_CHROME : HAND_ROW_CHROME;
    const opponentRowHeight = baseCardHeight + cardTopHeadroom + rowChrome;
    const ownRowHeight = baseCardHeight + cardTopHeadroom + rowChrome;
    const handsHeight = getHandsHeight(baseCardHeight, opponents, rowChrome);

    return {
      mode: 'full-ledger',
      opponentCardHeight: baseCardHeight,
      ownCardHeight: baseCardHeight,
      cardTopHeadroom,
      opponentRowHeight,
      ownRowHeight,
      handsHeight,
      workbenchHeight,
    };
  }

  const ownCardHeight = maxCompactOwnCardHeightThatFits(ownWidthFit, handsRegionHeight, opponents);
  const cardTopHeadroom = getCardTopHeadroom(ownCardHeight);
  const ownRowHeight = ownCardHeight + cardTopHeadroom + HAND_ROW_CHROME;
  const handsHeight = getCompactHandsHeight(ownCardHeight, opponents);

  return {
    mode: 'compact-overview',
    opponentCardHeight: COMPACT_OPPONENT_SUMMARY_HEIGHT,
    ownCardHeight,
    cardTopHeadroom,
    opponentRowHeight: COMPACT_OPPONENT_ROW_HEIGHT,
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
    if (getHandsHeight(candidate, opponents, opponents <= 2 ? SIDE_LABEL_ROW_CHROME : HAND_ROW_CHROME) <= handsRegionHeight) {
      best = candidate;
      low = candidate + 1;
    } else {
      high = candidate - 1;
    }
  }

  return best;
}

function getHandsHeight(cardHeight: number, opponents: number, rowChrome: number): number {
  const cardTopHeadroom = getCardTopHeadroom(cardHeight);
  const opponentRowHeight = cardHeight + cardTopHeadroom + rowChrome;
  const ownRowHeight = cardHeight + cardTopHeadroom + rowChrome;
  return opponents * opponentRowHeight
    + ownRowHeight
    + Math.max(0, opponents - 1) * OPPONENT_ROW_GAP
    + HAND_ROW_GAP;
}

function maxCompactOwnCardHeightThatFits(widthFit: number, handsRegionHeight: number, opponents: number): number {
  let low = 1;
  let high = Math.max(1, widthFit);
  let best = 1;

  while (low <= high) {
    const candidate = Math.floor((low + high) / 2);
    if (getCompactHandsHeight(candidate, opponents) <= handsRegionHeight) {
      best = candidate;
      low = candidate + 1;
    } else {
      high = candidate - 1;
    }
  }

  return best;
}

function getCompactHandsHeight(ownCardHeight: number, opponents: number): number {
  const ownRowHeight = ownCardHeight + getCardTopHeadroom(ownCardHeight) + HAND_ROW_CHROME;
  return opponents * COMPACT_OPPONENT_ROW_HEIGHT
    + ownRowHeight
    + Math.max(0, opponents - 1) * OPPONENT_ROW_GAP
    + HAND_ROW_GAP;
}

function getCardTopHeadroom(cardHeight: number): number {
  return Math.max(3, Math.min(6, Math.round(cardHeight * 0.06)));
}

function cardHeightForWidth(width: number, cards: number, gap: number): number {
  const usableWidth = Math.max(1, width - Math.max(0, cards - 1) * gap);
  return Math.max(1, Math.floor(usableWidth / cards / HANABI_CARD_ASPECT_RATIO));
}
