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
const FULL_LEDGER_WINDOW_FIXED_BUDGET = 536;
const MIN_READABLE_OPPONENT_CARD_HEIGHT = 46;
const COMPACT_TALL_WINDOW_CARD_HEIGHT = 34;
const COMPACT_SMALL_WINDOW_CARD_HEIGHT = 24;

/**
 * C17-0 uses stable window classes, not a late-game reflow as hands shrink.
 *
 * The full-ledger budget intentionally includes the live app bar, Android system-navigation guard,
 * HUD/table/last-action anchors, own hand, Workbench, and inter-section spacing. The first physical
 * 390x844 Android validation showed that treating the whole window as gameplay height selected a
 * mathematically valid but visibly clipped full ledger. Full Ledger therefore needs a genuinely
 * tall window; ordinary phone portrait falls back to Compact Overview instead of shrinking or
 * clipping the bottom of the workspace.
 */
export function getC17DenseLayout({ viewportWidth, viewportHeight, opponentHandSizes, ownHandSize }: Input): C17DenseLayout {
  const width = Math.max(240, viewportWidth) - HORIZONTAL_PADDING;
  const height = Math.max(320, viewportHeight);
  const maxOpponentCards = Math.max(1, ...opponentHandSizes);
  const opponentFit = cardHeightForWidth(width, maxOpponentCards);
  const ownFit = cardHeightForWidth(width, Math.max(1, ownHandSize));
  const fullLedgerCardHeight = Math.min(
    66,
    opponentFit,
    Math.floor((height - FULL_LEDGER_WINDOW_FIXED_BUDGET) / 5) - 18,
  );

  if (fullLedgerCardHeight >= MIN_READABLE_OPPONENT_CARD_HEIGHT) {
    return {
      mode: 'full-ledger',
      opponentCardHeight: fullLedgerCardHeight,
      ownCardHeight: Math.max(62, Math.min(82, ownFit)),
      opponentRowHeight: fullLedgerCardHeight + 18,
      workbenchHeight: 112,
    };
  }

  const compactOpponentCardHeight = Math.min(
    opponentFit,
    height >= 720 ? COMPACT_TALL_WINDOW_CARD_HEIGHT : COMPACT_SMALL_WINDOW_CARD_HEIGHT,
  );
  return {
    mode: 'compact-overview',
    opponentCardHeight: compactOpponentCardHeight,
    ownCardHeight: Math.max(54, Math.min(66, ownFit)),
    opponentRowHeight: compactOpponentCardHeight + 5,
    workbenchHeight: 78,
  };
}

export function getRelativeOpponentIndices(playerCount: number, ourPlayerIndex: number): readonly number[] {
  return Array.from({ length: Math.max(0, playerCount - 1) }, (_, offset) => (ourPlayerIndex + offset + 1) % playerCount);
}

function cardHeightForWidth(width: number, cards: number): number {
  return Math.floor((width - Math.max(0, cards - 1) * CARD_GAP) / cards / HANABI_CARD_ASPECT_RATIO);
}
