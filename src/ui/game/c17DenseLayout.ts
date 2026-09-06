import { HANABI_CARD_ASPECT_RATIO } from './gameplayLayout';

export type C17DenseLayout = {
  mode: 'full-ledger' | 'compact-overview';
  opponentCardHeight: number;
  ownCardHeight: number;
  opponentRowHeight: number;
  workbenchHeight: number;
};

type Input = {
  opponentCardLaneWidth: number;
  opponentRegionHeight: number;
  ownCardLaneWidth: number;
  opponentCount: number;
  cardsPerHand: number;
};

const OPPONENT_CARD_GAP = 3;
const OWN_CARD_GAP = 4;
const OPPONENT_ROW_GAP = 2;
const OPPONENT_ROW_CHROME = 5;
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
export function getC17DenseLayout({ opponentCardLaneWidth, opponentRegionHeight, ownCardLaneWidth, opponentCount, cardsPerHand }: Input): C17DenseLayout {
  const opponents = Math.max(1, opponentCount);
  const capacity = Math.max(1, cardsPerHand);
  const opponentWidthFit = cardHeightForWidth(opponentCardLaneWidth, capacity, OPPONENT_CARD_GAP);
  const ownCardHeight = Math.max(1, cardHeightForWidth(ownCardLaneWidth, capacity, OWN_CARD_GAP));
  const availableRowHeight = Math.floor(
    Math.max(0, opponentRegionHeight - Math.max(0, opponents - 1) * OPPONENT_ROW_GAP) / opponents,
  );
  const opponentHeightFit = availableRowHeight - OPPONENT_ROW_CHROME;
  const opponentCardHeight = Math.max(
    1,
    Math.min(opponentWidthFit, opponentHeightFit),
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

function cardHeightForWidth(width: number, cards: number, gap: number): number {
  return Math.floor((width - Math.max(0, cards - 1) * gap) / cards / HANABI_CARD_ASPECT_RATIO);
}
