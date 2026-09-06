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
const CHROME_BUDGET = 106;
const FIXED_LEDGER_HEIGHT = 270;
const MIN_READABLE_OPPONENT_CARD_HEIGHT = 46;

/** C17-0 uses stable window classes, not a late-game reflow as hands shrink. */
export function getC17DenseLayout({ viewportWidth, viewportHeight, opponentHandSizes, ownHandSize }: Input): C17DenseLayout {
  const width = Math.max(240, viewportWidth) - HORIZONTAL_PADDING;
  const maxOpponentCards = Math.max(1, ...opponentHandSizes);
  const opponentFit = cardHeightForWidth(width, maxOpponentCards);
  const ownFit = cardHeightForWidth(width, Math.max(1, ownHandSize));
  const usableHeight = Math.max(320, viewportHeight) - CHROME_BUDGET;
  const fullLedgerCardHeight = Math.min(66, opponentFit, Math.floor((usableHeight - FIXED_LEDGER_HEIGHT) / 5) - 18);

  if (fullLedgerCardHeight >= MIN_READABLE_OPPONENT_CARD_HEIGHT) {
    return { mode: 'full-ledger', opponentCardHeight: fullLedgerCardHeight, ownCardHeight: Math.max(62, Math.min(82, ownFit)), opponentRowHeight: fullLedgerCardHeight + 18, workbenchHeight: 112 };
  }
  return { mode: 'compact-overview', opponentCardHeight: 24, ownCardHeight: Math.max(54, Math.min(66, ownFit)), opponentRowHeight: 29, workbenchHeight: 78 };
}

export function getRelativeOpponentIndices(playerCount: number, ourPlayerIndex: number): readonly number[] {
  return Array.from({ length: Math.max(0, playerCount - 1) }, (_, offset) => (ourPlayerIndex + offset + 1) % playerCount);
}

function cardHeightForWidth(width: number, cards: number): number {
  return Math.floor((width - Math.max(0, cards - 1) * CARD_GAP) / cards / HANABI_CARD_ASPECT_RATIO);
}
