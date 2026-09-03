import { Svg, Path, SvgXml } from 'react-native-svg';

import { getUpstreamCardKey, getUpstreamCardSvg, UPSTREAM_CARD_HEIGHT, UPSTREAM_CARD_WIDTH } from '../../game/selectors/upstreamCardAssets';
import { getCardSuitVisuals } from '../../game/selectors/cardVisuals';

export function UpstreamCardFace({ rank, suitIndex, variantName }: {
  rank: number | null;
  suitIndex: number | null;
  variantName: string;
}) {
  const suits = getCardSuitVisuals(variantName);
  const suitName = suitIndex === null ? null : suits[suitIndex]?.name ?? null;
  const cardKey = getUpstreamCardKey(suitName, rank);
  const svg = getUpstreamCardSvg(variantName, cardKey);

  if (svg === null) return <MissingUpstreamCard />;
  return <SvgXml height="100%" width="100%" xml={svg} />;
}

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
