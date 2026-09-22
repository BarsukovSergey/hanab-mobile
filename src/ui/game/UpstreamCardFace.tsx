import { memo } from 'react';
import { Path, Svg, SvgAst, parse, type JsxAST } from 'react-native-svg';

import { getUpstreamCardKey, getUpstreamCardSvg, UPSTREAM_CARD_HEIGHT, UPSTREAM_CARD_WIDTH } from '../../game/selectors/upstreamCardAssets';
import { getCardSuitVisuals } from '../../game/selectors/cardVisuals';

type UpstreamCardFaceProps = {
  rank: number | null;
  suitIndex: number | null;
  variantName: string;
};

// The generated manifest deduplicates card SVGs across variants. Keying by the immutable XML asset
// keeps this cache bounded by unique artwork rather than variant/card combinations.
const parsedCardCache = new Map<string, JsxAST | null>();
const CARD_AST_OVERRIDE = { height: '100%', width: '100%' } as const;

export const UpstreamCardFace = memo(function UpstreamCardFace({ rank, suitIndex, variantName }: UpstreamCardFaceProps) {
  const suits = getCardSuitVisuals(variantName);
  const suitName = suitIndex === null ? null : suits[suitIndex]?.name ?? null;
  const cardKey = getUpstreamCardKey(suitName, rank);
  const svg = getUpstreamCardSvg(variantName, cardKey);
  if (svg === null) return <MissingUpstreamCard />;

  if (parsedCardCache.has(svg)) {
    const cached = parsedCardCache.get(svg) ?? null;
    return cached === null ? <MissingUpstreamCard /> : <SvgAst ast={cached} override={CARD_AST_OVERRIDE} />;
  }

  try {
    const ast = parse(svg);
    parsedCardCache.set(svg, ast);
    return ast === null ? <MissingUpstreamCard /> : <SvgAst ast={ast} override={CARD_AST_OVERRIDE} />;
  } catch {
    // Generated assets are validated in CI, but fail closed to the existing placeholder if a
    // malformed asset ever reaches a device rather than crashing the gameplay tree.
    parsedCardCache.set(svg, null);
    return <MissingUpstreamCard />;
  }
});

function MissingUpstreamCard() {
  const padding = 4;
  const radius = UPSTREAM_CARD_WIDTH * 0.12;
  const path = [
    `M ${padding} ${radius + padding}`,
    `L ${padding} ${UPSTREAM_CARD_HEIGHT - radius - padding}`,
    `Q 0 ${UPSTREAM_CARD_HEIGHT} ${radius + padding} ${UPSTREAM_CARD_HEIGHT - padding}`,
    `L ${UPSTREAM_CARD_WIDTH - radius - padding} ${UPSTREAM_CARD_HEIGHT - padding}`,
    `Q ${UPSTREAM_CARD_WIDTH} ${UPSTREAM_CARD_HEIGHT} ${UPSTREAM_CARD_WIDTH - padding} ${UPSTREAM_CARD_HEIGHT - radius - padding}`,
    `L ${UPSTREAM_CARD_WIDTH - padding} ${radius + padding}`,
    `Q ${UPSTREAM_CARD_WIDTH} 0 ${UPSTREAM_CARD_WIDTH - radius - padding} ${padding}`,
    `L ${radius + padding} ${padding}`,
    `Q 0 0 ${padding} ${radius + padding}`,
    'Z',
  ].join(' ');

  return <Svg height="100%" viewBox={`0 0 ${UPSTREAM_CARD_WIDTH} ${UPSTREAM_CARD_HEIGHT}`} width="100%">
    <Path d={path} fill="#808080" stroke="#0d0d0d" strokeWidth={8} />
  </Svg>;
}
