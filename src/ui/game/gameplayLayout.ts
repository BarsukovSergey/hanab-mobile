export const HANABI_CARD_ASPECT_RATIO = 286 / 406;

type GameplayLayoutInput = {
  viewportWidth: number;
  viewportHeight: number;
  handSizes: readonly number[];
  ourPlayerIndex: number | null;
};

export type GameplayLayout = {
  orientation: 'portrait' | 'landscape';
  contentWidth: number;
  ownLaneWidth: number;
  opponentLaneWidth: number;
  cardGap: number;
  ownCardHeight: number;
  opponentCardHeight: number;
  opponentColumns: 1 | 2;
  opponentRowGap: number;
  estimatedHandsHeight: number;
  needsSharedVerticalScroll: boolean;
};

const PHONE_HORIZONTAL_CHROME = 32;
const TABLET_MAX_CONTENT_WIDTH = 1120;
const OWN_MAX_HEIGHT = 112;
const OPPONENT_MAX_HEIGHT = 76;
const OWN_MIN_HEIGHT = 68;
const OPPONENT_MIN_HEIGHT = 46;
const LANDSCAPE_GUTTER = 10;

export function getGameplayLayout({
  viewportWidth,
  viewportHeight,
  handSizes,
  ourPlayerIndex,
}: GameplayLayoutInput): GameplayLayout {
  const width = Math.max(240, viewportWidth);
  const height = Math.max(320, viewportHeight);
  const orientation = width > height ? 'landscape' : 'portrait';
  const landscapePhone = orientation === 'landscape' && height < 700;
  const cardGap = width < 360 ? 4 : landscapePhone ? 4 : width < 700 ? 6 : 7;
  const opponentRowGap = landscapePhone ? 5 : width < 360 ? 5 : 7;
  const contentWidth = Math.min(TABLET_MAX_CONTENT_WIDTH, Math.max(220, width - PHONE_HORIZONTAL_CHROME));
  const ownLaneWidth = orientation === 'landscape'
    ? Math.max(260, (contentWidth - LANDSCAPE_GUTTER) * 0.54)
    : contentWidth;
  const opponentLaneWidth = orientation === 'landscape'
    ? Math.max(260, contentWidth - LANDSCAPE_GUTTER - ownLaneWidth)
    : contentWidth;

  const ownHandSize = ourPlayerIndex === null ? 0 : handSizes[ourPlayerIndex] ?? 0;
  const opponentHandSizes = handSizes.filter((_, index) => index !== ourPlayerIndex);
  const maxOpponentHandSize = Math.max(1, ...opponentHandSizes);
  const opponentColumns: 1 | 2 = orientation === 'landscape' && width >= 760 && opponentHandSizes.length >= 3 ? 2 : 1;
  const opponentColumnWidth = opponentColumns === 2
    ? (opponentLaneWidth - LANDSCAPE_GUTTER) / 2
    : opponentLaneWidth;

  // Landscape still has enough vertical room for readable cards; avoid turning hands into thumbnails.
  const ownMaxHeight = landscapePhone ? 88 : OWN_MAX_HEIGHT;
  const opponentMaxHeight = landscapePhone ? 60 : OPPONENT_MAX_HEIGHT;
  const ownMinHeight = landscapePhone ? 58 : OWN_MIN_HEIGHT;
  const opponentMinHeight = landscapePhone ? 42 : OPPONENT_MIN_HEIGHT;

  const ownCardHeight = ownHandSize === 0
    ? 0
    : fitCardHeight(ownLaneWidth, ownHandSize, cardGap, ownMinHeight, ownMaxHeight);
  const opponentCardHeight = fitCardHeight(
    opponentColumnWidth,
    maxOpponentHandSize,
    cardGap,
    opponentMinHeight,
    Math.min(opponentMaxHeight, ownCardHeight > 0 ? ownCardHeight * 0.7 : opponentMaxHeight),
  );

  const opponentRows = Math.ceil(opponentHandSizes.length / opponentColumns);
  const ownSectionHeight = ownCardHeight === 0 ? 0 : ownCardHeight + (landscapePhone ? 24 : 32);
  const opponentSectionHeight = opponentRows === 0
    ? 0
    : opponentRows * (opponentCardHeight + (landscapePhone ? 22 : 30)) + Math.max(0, opponentRows - 1) * opponentRowGap;
  const estimatedHandsHeight = Math.round(
    orientation === 'landscape'
      ? Math.max(ownSectionHeight, opponentSectionHeight)
      : ownSectionHeight + opponentSectionHeight,
  );
  const handsBudget = height * (orientation === 'portrait' ? 0.58 : 0.7);

  return {
    orientation,
    contentWidth: round1(contentWidth),
    ownLaneWidth: round1(ownLaneWidth),
    opponentLaneWidth: round1(opponentLaneWidth),
    cardGap,
    ownCardHeight: round1(ownCardHeight),
    opponentCardHeight: round1(opponentCardHeight),
    opponentColumns,
    opponentRowGap,
    estimatedHandsHeight,
    needsSharedVerticalScroll: estimatedHandsHeight > handsBudget,
  };
}

export function getHandRowWidth(cardHeight: number, cardCount: number, gap: number): number {
  if (cardCount <= 0 || cardHeight <= 0) return 0;
  return cardCount * cardHeight * HANABI_CARD_ASPECT_RATIO + Math.max(0, cardCount - 1) * gap;
}

function fitCardHeight(
  availableWidth: number,
  cardCount: number,
  gap: number,
  minHeight: number,
  maxHeight: number,
): number {
  if (cardCount <= 0) return 0;
  const gapWidth = Math.max(0, cardCount - 1) * gap;
  const widthPerCard = Math.max(1, (availableWidth - gapWidth) / cardCount);
  const heightFromWidth = widthPerCard / HANABI_CARD_ASPECT_RATIO;
  return Math.max(Math.min(minHeight, heightFromWidth), Math.min(maxHeight, heightFromWidth));
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
