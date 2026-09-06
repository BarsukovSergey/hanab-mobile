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
};

const OPPONENT_CARD_GAP = 3;
const OWN_CARD_GAP = 4;
const OPPONENT_ROW_GAP = 2;
const HAND_ROW_GAP = 5;
// Matches c17OpponentRow's 1 dp top and bottom border.
const OPPONENT_ROW_CHROME = 2;
// Matches c17OwnHand's 5 dp vertical padding and 1 dp top/bottom border.
const OWN_ROW_CHROME = 12;
const MIN_WORKBENCH_HEIGHT = 56;
const MIN_READABLE_OPPONENT_CARD_HEIGHT = 46;

/**
 * C17 allocates cards from measured card lanes and the flexible opponent region.
 * The live workspace owns shell geometry; this helper only applies card aspect ratio,
 * actual row spacing, authoritative hand capacity, and the readability threshold.
 *
 * Full Ledger is therefore an outcome, not a breakpoint: if the resulting card face remains
 * readable it is used. Compact Overview is selected only when the available geometry would
 * push opponent cards below the readability floor.
 */
export function getC17DenseLayout({ opponentCardLaneWidth, handsRegionHeight, ownCardLaneWidth, opponentCount, cardsPerHand }: Input): C17DenseLayout {
  const opponents = Math.max(1, opponentCount);
  const capacity = Math.max(1, cardsPerHand);
  const opponentWidthFit = cardHeightForWidth(opponentCardLaneWidth, capacity, OPPONENT_CARD_GAP);
  const ownWidthFit = cardHeightForWidth(ownCardLaneWidth, capacity, OWN_CARD_GAP);
  const fixedHandsHeight = opponents * OPPONENT_ROW_CHROME
    + OWN_ROW_CHROME
    + Math.max(0, opponents - 1) * OPPONENT_ROW_GAP
    + HAND_ROW_GAP;
  const heightFit = Math.floor(
    Math.max(0, handsRegionHeight - fixedHandsHeight) / (opponents + 1),
  );
  const baseCardHeight = Math.max(
    1,
    Math.min(opponentWidthFit, ownWidthFit, heightFit),
  );
  const opponentRowHeight = baseCardHeight + OPPONENT_ROW_CHROME;
  const ownRowHeight = baseCardHeight + OWN_ROW_CHROME;
  const handsHeight = opponents * opponentRowHeight
    + ownRowHeight
    + Math.max(0, opponents - 1) * OPPONENT_ROW_GAP
    + HAND_ROW_GAP;

  return {
    mode: baseCardHeight >= MIN_READABLE_OPPONENT_CARD_HEIGHT ? 'full-ledger' : 'compact-overview',
    opponentCardHeight: baseCardHeight,
    ownCardHeight: baseCardHeight,
    opponentRowHeight,
    ownRowHeight,
    handsHeight,
    workbenchHeight: MIN_WORKBENCH_HEIGHT,
  };
}

export function getRelativeOpponentIndices(playerCount: number, ourPlayerIndex: number): readonly number[] {
  return Array.from({ length: Math.max(0, playerCount - 1) }, (_, offset) => (ourPlayerIndex + offset + 1) % playerCount);
}

function cardHeightForWidth(width: number, cards: number, gap: number): number {
  return Math.floor((width - Math.max(0, cards - 1) * gap) / cards / HANABI_CARD_ASPECT_RATIO);
}
