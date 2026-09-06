import { HANABI_CARD_ASPECT_RATIO } from './gameplayLayout';

export type C17DenseLayout = {
  mode: 'full-ledger' | 'compact-overview';
  opponentCardHeight: number;
  ownCardHeight: number;
  opponentRowHeight: number;
  workbenchHeight: number;
};

type Input = {
  viewportWidth: number;
  viewportHeight: number;
  opponentHandSizes: readonly number[];
  ownHandSize: number;
};

const HORIZONTAL_PADDING = 24;
const CARD_GAP = 4;
const OPPONENT_ROW_CHROME = 5;
const OWN_HAND_CHROME = 10;
const FIXED_WINDOW_CHROME_BUDGET = 380;
const MIN_WORKBENCH_HEIGHT = 56;
const MIN_READABLE_OPPONENT_CARD_HEIGHT = 46;
const MAX_OPPONENT_CARD_HEIGHT = 76;
const MIN_OWN_CARD_HEIGHT = 54;
const MAX_OWN_CARD_HEIGHT = 72;

/**
 * C17-0 allocates the dense portrait from the outside in:
 * fixed app/table/system chrome, a minimum actionable Workbench band, the local hand,
 * then every remaining vertical pixel is offered to the opponent rows equally.
 *
 * This replaces the earlier hard split between a fixed 34 dp Compact Overview and an
 * oversized Full Ledger. Physical validation showed that split could both clip the large
 * layout and waste substantial space in the compact layout on the same phone.
 *
 * Full Ledger is therefore an outcome, not a breakpoint: if the resulting card face remains
 * readable it is used. Compact Overview is selected only when the available geometry would
 * push opponent cards below the readability floor.
 */
export function getC17DenseLayout({ viewportWidth, viewportHeight, opponentHandSizes, ownHandSize }: Input): C17DenseLayout {
  const width = Math.max(240, viewportWidth) - HORIZONTAL_PADDING;
  const height = Math.max(320, viewportHeight);
  const opponentCount = Math.max(1, opponentHandSizes.length);
  const maxOpponentCards = Math.max(1, ...opponentHandSizes);
  const opponentWidthFit = cardHeightForWidth(width, maxOpponentCards);
  const ownWidthFit = cardHeightForWidth(width, Math.max(1, ownHandSize));
  const ownCardHeight = Math.max(MIN_OWN_CARD_HEIGHT, Math.min(MAX_OWN_CARD_HEIGHT, ownWidthFit));

  const fixedHeight = FIXED_WINDOW_CHROME_BUDGET
    + ownCardHeight
    + OWN_HAND_CHROME
    + MIN_WORKBENCH_HEIGHT;
  const opponentHeightFit = Math.floor(Math.max(0, height - fixedHeight) / opponentCount) - OPPONENT_ROW_CHROME;
  const opponentCardHeight = Math.max(
    1,
    Math.min(MAX_OPPONENT_CARD_HEIGHT, opponentWidthFit, opponentHeightFit),
  );

  return {
    mode: opponentCardHeight >= MIN_READABLE_OPPONENT_CARD_HEIGHT ? 'full-ledger' : 'compact-overview',
    opponentCardHeight,
    ownCardHeight,
    opponentRowHeight: opponentCardHeight + OPPONENT_ROW_CHROME,
    workbenchHeight: MIN_WORKBENCH_HEIGHT,
  };
}

export function getRelativeOpponentIndices(playerCount: number, ourPlayerIndex: number): readonly number[] {
  return Array.from({ length: Math.max(0, playerCount - 1) }, (_, offset) => (ourPlayerIndex + offset + 1) % playerCount);
}

function cardHeightForWidth(width: number, cards: number): number {
  return Math.floor((width - Math.max(0, cards - 1) * CARD_GAP) / cards / HANABI_CARD_ASPECT_RATIO);
}
