import { Defs, G, LinearGradient, Path, Stop, Svg, Text as SvgText } from 'react-native-svg';

import { getVisibleCardVisual, type CardPaint } from '../../game/selectors/visibleCardVisuals';
import { UpstreamPipPaths } from './UpstreamPip';

const CARD_W = 286;
const CARD_H = 406;
const CARD_PADDING = 4;
const CARD_RADIUS = CARD_W * 0.08;
const UNKNOWN_CARD_RANK = 6;
const START_CARD_RANK = 7;
const CARD_BORDER_PATH = [
  `M ${CARD_PADDING} ${CARD_RADIUS + CARD_PADDING}`,
  `L ${CARD_PADDING} ${CARD_H - CARD_RADIUS - CARD_PADDING}`,
  `Q 0 ${CARD_H} ${CARD_RADIUS + CARD_PADDING} ${CARD_H - CARD_PADDING}`,
  `L ${CARD_W - CARD_RADIUS - CARD_PADDING} ${CARD_H - CARD_PADDING}`,
  `Q ${CARD_W} ${CARD_H} ${CARD_W - CARD_PADDING} ${CARD_H - CARD_RADIUS - CARD_PADDING}`,
  `L ${CARD_W - CARD_PADDING} ${CARD_RADIUS + CARD_PADDING}`,
  `Q ${CARD_W} 0 ${CARD_W - CARD_RADIUS - CARD_PADDING} ${CARD_PADDING}`,
  `L ${CARD_RADIUS + CARD_PADDING} ${CARD_PADDING}`,
  `Q 0 0 ${CARD_PADDING} ${CARD_RADIUS + CARD_PADDING}`,
  'Z',
].join(' ');

export function UpstreamCardFace({ rank, suitIndex, variantName }: { rank: number | null; suitIndex: number | null; variantName: string }) {
  if (suitIndex === null && rank === null) return <UnknownBareCard />;
  if (suitIndex === null) return <UnknownSuitCard rank={rank} />;

  const visualRank = rank ?? UNKNOWN_CARD_RANK;
  const visual = getVisibleCardVisual(variantName, suitIndex, visualRank);
  if (visual === null) return <UnknownBareCard />;

  const backgroundFill = paintReference(visual.background, 'card-background');
  const rankFill = paintReference(visual.rankPaint, 'card-rank');
  const renderedRank = rank ?? 0;
  const showRank = rank !== null && (rank >= 1 && rank <= 5 || rank === START_CARD_RANK);
  const stackBase = rank === 0;

  return (
    <Svg height="100%" viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%">
      <PaintDef id="card-background" paint={visual.background} />
      <PaintDef id="card-rank" paint={visual.rankPaint} />

      {!stackBase && <Path d={CARD_BORDER_PATH} fill="#ffffff" />}
      <DualColorTriangles fills={visual.clueColorFills} />
      <Path
        d={CARD_BORDER_PATH}
        fill={backgroundFill}
        fillOpacity={stackBase ? 1 : 0.3}
        stroke={backgroundFill}
        strokeOpacity={stackBase ? 1 : 0.7}
        strokeWidth={8}
      />

      {showRank && <RankText fill={rankFill} rank={renderedRank} />}
      {showRank && visual.deceptiveRank !== null && renderedRank !== START_CARD_RANK && (
        <G transform={`translate(${CARD_W / 4 + CARD_W / 50} ${CARD_H / 40}) scale(0.5)`}>
          <RankText fill={rankFill} rank={visual.deceptiveRank} />
        </G>
      )}
      {showRank && visual.showBottomRank && (
        <G transform={`translate(${CARD_W} ${CARD_H}) rotate(180)`}>
          <RankText fill={rankFill} rank={renderedRank} />
        </G>
      )}

      <RankPips
        duplicatePip={visual.duplicatePip}
        fillColors={visual.pipFillColors}
        pip={visual.pip}
        rank={visualRank}
        suitName={visual.suitName}
      />
    </Svg>
  );
}

function UnknownBareCard() {
  return <Svg height="100%" viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%">
    <Path d={CARD_BORDER_PATH} fill="#ffffff" />
    <Path d={CARD_BORDER_PATH} fill="#000000" fillOpacity={0.5} stroke="#000000" strokeOpacity={0.6} strokeWidth={8} />
  </Svg>;
}

function UnknownSuitCard({ rank }: { rank: number | null }) {
  if (rank === null) return <UnknownBareCard />;
  const showRank = rank >= 1 && rank <= 5 || rank === START_CARD_RANK;
  return <Svg height="100%" viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%">
    <Path d={CARD_BORDER_PATH} fill="#ffffff" />
    <Path d={CARD_BORDER_PATH} fill="#cccccc" fillOpacity={0.3} stroke="#cccccc" strokeOpacity={0.7} strokeWidth={8} />
    {showRank && <RankText fill="#cccccc" rank={rank} />}
    {showRank && <G transform={`translate(${CARD_W} ${CARD_H}) rotate(180)`}><RankText fill="#cccccc" rank={rank} /></G>}
  </Svg>;
}

function RankText({ fill, rank }: { fill: string; rank: number }) {
  return <SvgText
    fill={fill}
    fontFamily="Arial"
    fontSize={128}
    fontWeight="bold"
    stroke="#000000"
    strokeLinejoin="round"
    strokeWidth={2}
    x={19}
    y={110}
  >{rank === START_CARD_RANK ? 'S' : rank}</SvgText>;
}

function PaintDef({ id, paint }: { id: string; paint: CardPaint }) {
  if (paint.type === 'solid') return null;
  return <Defs><LinearGradient
    gradientUnits="userSpaceOnUse"
    id={id}
    x1={paint.x1}
    x2={paint.x2}
    y1={paint.y1}
    y2={paint.y2}
  >
    {paint.colors.map((color, index) => (
      <Stop
        key={`${id}-${color}-${index}`}
        offset={paint.colors.length <= 1 ? 0 : index / (paint.colors.length - 1)}
        stopColor={color}
      />
    ))}
  </LinearGradient></Defs>;
}

function paintReference(paint: CardPaint, id: string): string {
  return paint.type === 'solid' ? paint.color : `url(#${id})`;
}

function DualColorTriangles({ fills }: { fills: readonly string[] }) {
  if (fills.length < 2) return null;
  return <>
    <CornerSlices cx={CARD_W - 8} cy={8} direction={-1} fills={fills} startTheta={Math.PI} />
    <CornerSlices cx={8} cy={CARD_H - 8} direction={1} fills={fills} startTheta={1.5 * Math.PI} />
  </>;
}

function CornerSlices({ cx, cy, direction, fills, startTheta }: {
  cx: number;
  cy: number;
  direction: number;
  fills: readonly string[];
  startTheta: number;
}) {
  const triangleSize = 50;
  const sliceAngle = Math.PI / 2 / fills.length;
  return <>{fills.map((fill, index) => {
    const theta1 = startTheta + index * sliceAngle * direction;
    const theta2 = startTheta + (index + 1) * sliceAngle * direction;
    const r1 = triangleSize / (Math.abs(Math.cos(theta1)) + Math.abs(Math.sin(theta1)));
    const r2 = triangleSize / (Math.abs(Math.cos(theta2)) + Math.abs(Math.sin(theta2)));
    const x1 = cx + Math.cos(theta1) * r1;
    const y1 = cy + Math.sin(theta1) * r1;
    const x2 = cx + Math.cos(theta2) * r2;
    const y2 = cy + Math.sin(theta2) * r2;
    return <Path
      d={`M ${cx} ${cy} L ${x1} ${y1} L ${x2} ${y2} Z`}
      fill={fill}
      key={`${fill}-${index}`}
      stroke="#000000"
      strokeWidth={1}
    />;
  })}</>;
}

function RankPips({ duplicatePip, fillColors, pip, rank, suitName }: {
  duplicatePip: boolean;
  fillColors: readonly string[];
  pip: string;
  rank: number;
  suitName: string;
}) {
  if (rank === 0) {
    return <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="stack" pip={pip} scale={1} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2} />;
  }
  if (rank === 1) {
    return <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="center" pip={pip} scale={0.72} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2} />;
  }
  if (rank === 2) {
    return <>
      <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="top" pip={pip} scale={0.56} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2 - 90} />
      <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="bottom" pip={pip} rotation={180} scale={0.56} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2 + 90} />
    </>;
  }
  if (rank === UNKNOWN_CARD_RANK) {
    return <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="unknown-rank" opacity={0.1} pip={pip} scale={1.2} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2} />;
  }
  if (rank === START_CARD_RANK) {
    return <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="start" pip={pip} scale={1.2} strokeWidth={2} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2} />;
  }
  if (rank < 3 || rank > 5) return null;

  return <>
    <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="top" pip={pip} scale={0.4} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2 - 120} />
    <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="bottom" pip={pip} rotation={180} scale={0.4} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2 + 120} />
    {(rank === 4 || rank === 5) && <>
      <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="left" pip={pip} scale={0.4} suitName={suitName} x={CARD_W / 2 - 90} y={CARD_H / 2} />
      <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="right" pip={pip} rotation={180} scale={0.4} suitName={suitName} x={CARD_W / 2 + 90} y={CARD_H / 2} />
    </>}
    {(rank === 3 || rank === 5) && (
      <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="center" pip={pip} scale={0.48} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2} />
    )}
  </>;
}

function PlacedPip({ duplicatePip, fillColors, id, opacity = 1, pip, rotation = 0, scale, strokeWidth = 5, suitName, x, y }: {
  duplicatePip: boolean;
  fillColors: readonly string[];
  id: string;
  opacity?: number;
  pip: string;
  rotation?: number;
  scale: number;
  strokeWidth?: number;
  suitName: string;
  x: number;
  y: number;
}) {
  return (
    <G opacity={opacity} transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
      <UpstreamPipPaths
        duplicatePip={duplicatePip}
        fillColors={fillColors}
        idPrefix={`card-${id}-${pip}`}
        pip={pip}
        strokeWidth={strokeWidth}
        suitName={suitName}
      />
    </G>
  );
}
