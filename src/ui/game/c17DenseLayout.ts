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
  opponentsScrollable?: boolean;
  opponentViewportHeight?: number;
};

type Input = {
  opponentCardLaneWidth: number;
  handsRegionHeight: number;
  ownCardLaneWidth: number;
  opponentCount: number;
  cardsPerHand: number;
  workbenchHeight?: number;
  portraitV2?: boolean;
  sideLabelMinHeight?: number;
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
const MIN_DENSE_OWN_CARD_HEIGHT = 54;
const MAX_DENSE_OWN_CARD_HEIGHT = 72;
const MIN_DENSE_OPPONENT_CARD_HEIGHT = 46;
const COMPACT_OPPONENT_SUMMARY_HEIGHT = 24;
const COMPACT_OPPONENT_ROW_HEIGHT = 32;

/**
 * The Workbench is a reserved shell rectangle. Its height is selected from the window class,
 * never from whichever tool happens to be open inside it. Overflowing tool content scrolls inside
 * the Workbench instead of stealing height from the Table Ledger.
 */
export function getC17WorkbenchHeight(viewportHeight: number, opponentCount?: number, portraitV2 = false): number {
  if (!portraitV2 && opponentCount !== undefined && opponentCount <= 2) return 136;
  if (opponentCount !== undefined && opponentCount >= 3) return 56;
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

/** Keep the 2P Bottom hand anchored while capping the inter-hand gap at 28dp. */
export function getC17TwoPlayerBottomTopInset(handsRegionHeight: number, handsHeight: number): number {
  const extra = Math.max(0, handsRegionHeight - handsHeight);
  return Math.max(0, extra - (28 - HAND_ROW_GAP));
}

export function hasC17AmbientRegionChanged(
  current: { height: number; width: number },
  next: { height: number; width: number },
): boolean {
  return Math.abs(current.height - next.height) >= 0.5 || Math.abs(current.width - next.width) >= 0.5;
}

/**
 * A shell can finish measuring after a transiently constrained layout. Keep the largest
 * accepted envelope for that shell unless visible notices explicitly constrain its height.
 */
export function getC17AmbientEnvelope(
  current: { height: number; width: number },
  next: { height: number; width: number },
  sameShell: boolean,
  allowHeightShrink = false,
): { height: number; width: number } {
  if (!sameShell) return next;
  return {
    height: allowHeightShrink && Number.isFinite(next.height) && next.height > 0
      ? next.height : Math.max(current.height, next.height),
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
  portraitV2 = false,
  sideLabelMinHeight = 0,
}: Input): C17DenseLayout {
  const opponents = Math.max(1, opponentCount);
  const capacity = Math.max(1, cardsPerHand);
  const usesSideLabels = opponents <= 2;
  const opponentWidthFit = cardHeightForWidth(opponentCardLaneWidth, capacity, OPPONENT_CARD_GAP);
  const ownWidthFit = cardHeightForWidth(ownCardLaneWidth, capacity, OWN_CARD_GAP);
  if (portraitV2) {
    const widthFit = Math.min(opponentWidthFit, ownWidthFit);
    let cardHeight = Math.min(widthFit, opponents >= 3 ? 72 : widthFit);
    const rowHeight = (height: number) => Math.max(sideLabelMinHeight + SIDE_LABEL_ROW_CHROME, height + getCardTopHeadroom(height) + SIDE_LABEL_ROW_CHROME);
    const totalHeight = (height: number, rows: number) => rows * rowHeight(height) + Math.max(0, rows - 2) * OPPONENT_ROW_GAP + HAND_ROW_GAP;
    while (cardHeight > 1 && totalHeight(cardHeight, opponents + 1) > handsRegionHeight) cardHeight -= 1;
    const opponentsScrollable = opponents === 5 && cardHeight < MIN_DENSE_OPPONENT_CARD_HEIGHT;
    if (opponentsScrollable) {
      cardHeight = Math.min(widthFit, MIN_DENSE_OPPONENT_CARD_HEIGHT);
      const visibleOpponents = totalHeight(cardHeight, 5) <= handsRegionHeight ? 4 : 3;
      while (cardHeight > 1 && totalHeight(cardHeight, visibleOpponents + 1) > handsRegionHeight) cardHeight -= 1;
    }
    const cardTopHeadroom = getCardTopHeadroom(cardHeight);
    const ownRowHeight = rowHeight(cardHeight);
    const handsHeight = Math.min(handsRegionHeight, totalHeight(cardHeight, opponents + 1));
    return { mode: 'full-ledger', opponentCardHeight: cardHeight, ownCardHeight: cardHeight,
      cardTopHeadroom, opponentRowHeight: ownRowHeight, ownRowHeight, handsHeight, workbenchHeight,
      opponentsScrollable, opponentViewportHeight: Math.max(0, handsHeight - ownRowHeight - HAND_ROW_GAP) };
  }
  if (opponents >= 3) {
    const protectedOwnHeight = Math.min(MAX_DENSE_OWN_CARD_HEIGHT, ownWidthFit);
    let ownCardHeight = protectedOwnHeight;
    let opponentCardHeight = maxDenseOpponentCardHeight(opponentWidthFit, ownCardHeight, handsRegionHeight, opponents);
    while (opponentCardHeight < MIN_DENSE_OPPONENT_CARD_HEIGHT
      && ownCardHeight > Math.min(MIN_DENSE_OWN_CARD_HEIGHT, protectedOwnHeight)) {
      ownCardHeight -= 1;
      opponentCardHeight = maxDenseOpponentCardHeight(opponentWidthFit, ownCardHeight, handsRegionHeight, opponents);
    }
    if (opponentCardHeight >= MIN_DENSE_OPPONENT_CARD_HEIGHT) {
      const cardTopHeadroom = getCardTopHeadroom(ownCardHeight);
      const opponentRowHeight = opponentCardHeight + cardTopHeadroom + SIDE_LABEL_ROW_CHROME;
      const ownRowHeight = ownCardHeight + cardTopHeadroom + SIDE_LABEL_ROW_CHROME;
      const handsHeight = getDenseHandsHeight(ownCardHeight, opponentCardHeight, cardTopHeadroom, opponents);
      return {
        mode: 'full-ledger',
        opponentCardHeight,
        ownCardHeight,
        cardTopHeadroom,
        opponentRowHeight,
        ownRowHeight,
        handsHeight,
        workbenchHeight,
      };
    }
  }
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

  const compactOwnRowChrome = opponents >= 3 ? SIDE_LABEL_ROW_CHROME : HAND_ROW_CHROME;
  const ownCardHeight = maxCompactOwnCardHeightThatFits(ownWidthFit, handsRegionHeight, opponents, compactOwnRowChrome);
  const cardTopHeadroom = getCardTopHeadroom(ownCardHeight);
  const ownRowHeight = ownCardHeight + cardTopHeadroom + compactOwnRowChrome;
  const handsHeight = getCompactHandsHeight(ownCardHeight, opponents, compactOwnRowChrome);

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

function maxDenseOpponentCardHeight(
  widthFit: number,
  ownCardHeight: number,
  handsRegionHeight: number,
  opponents: number,
): number {
  const cardTopHeadroom = getCardTopHeadroom(ownCardHeight);
  let low = 1;
  let high = Math.min(widthFit, ownCardHeight);
  let best = 0;
  while (low <= high) {
    const candidate = Math.floor((low + high) / 2);
    if (getDenseHandsHeight(ownCardHeight, candidate, cardTopHeadroom, opponents) <= handsRegionHeight) {
      best = candidate;
      low = candidate + 1;
    } else {
      high = candidate - 1;
    }
  }
  return best;
}

function getDenseHandsHeight(
  ownCardHeight: number,
  opponentCardHeight: number,
  cardTopHeadroom: number,
  opponents: number,
): number {
  const ownRowHeight = ownCardHeight + cardTopHeadroom + SIDE_LABEL_ROW_CHROME;
  const opponentRowHeight = opponentCardHeight + cardTopHeadroom + SIDE_LABEL_ROW_CHROME;
  return ownRowHeight + opponents * opponentRowHeight
    + Math.max(0, opponents - 1) * OPPONENT_ROW_GAP
    + HAND_ROW_GAP;
}

export function getRelativeOpponentIndices(playerCount: number, ourPlayerIndex: number): readonly number[] {
  return Array.from({ length: Math.max(0, playerCount - 1) }, (_, offset) => (ourPlayerIndex + offset + 1) % playerCount);
}

export function getC17HandRows(
  playerCount: number,
  seatingAnchorIndex: number,
  actionHandIndex: number | null,
): {
  opponentIndices: readonly number[];
  anchoredPlayerIndex: number;
  actionHandIndex: number | null;
  clueTargetIndices: readonly number[];
} {
  return {
    opponentIndices: getRelativeOpponentIndices(playerCount, seatingAnchorIndex),
    anchoredPlayerIndex: seatingAnchorIndex,
    actionHandIndex,
    clueTargetIndices: actionHandIndex === null
      ? []
      : Array.from({ length: playerCount }, (_, index) => index).filter((index) => index !== actionHandIndex),
  };
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

function maxCompactOwnCardHeightThatFits(
  widthFit: number,
  handsRegionHeight: number,
  opponents: number,
  ownRowChrome: number,
): number {
  let low = 1;
  let high = Math.max(1, widthFit);
  let best = 1;

  while (low <= high) {
    const candidate = Math.floor((low + high) / 2);
    if (getCompactHandsHeight(candidate, opponents, ownRowChrome) <= handsRegionHeight) {
      best = candidate;
      low = candidate + 1;
    } else {
      high = candidate - 1;
    }
  }

  return best;
}

function getCompactHandsHeight(ownCardHeight: number, opponents: number, ownRowChrome: number): number {
  const ownRowHeight = ownCardHeight + getCardTopHeadroom(ownCardHeight) + ownRowChrome;
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

/** Deterministic rail fit; preserve the fireworks lane before moving resources. */
export function getPortraitResourceRailFit(width: number, suitCount: number, fontScale: number): boolean {
  const resourceRail = Math.max(64, Math.ceil(64 * Math.min(fontScale, 1.5)));
  return width >= 30 * suitCount + 42 + resourceRail + 28;
}
