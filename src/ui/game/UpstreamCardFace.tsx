import { Defs, G, LinearGradient, Path, Rect, Stop, Svg, Text as SvgText } from 'react-native-svg';

import { getVisibleCardVisual, type CardPaint } from '../../game/selectors/visibleCardVisuals';
import { UpstreamPipPaths } from './UpstreamPip';

const CARD_W = 286;
const CARD_H = 406;
const BORDER_RADIUS = CARD_W * 0.08;

export function UpstreamCardFace({ rank, suitIndex, variantName }: { rank: number; suitIndex: number; variantName: string }) {
  const visual = getVisibleCardVisual(variantName, suitIndex, rank);
  if (visual === null) return null;

  const backgroundFill = paintReference(visual.background, 'card-background');
  const rankFill = paintReference(visual.rankPaint, 'card-rank');

  return (
    <Svg height="100%" viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%">
      <PaintDef id="card-background" paint={visual.background} />
      <PaintDef id="card-rank" paint={visual.rankPaint} />

      <Rect fill="#ffffff" height={CARD_H - 8} rx={BORDER_RADIUS} ry={BORDER_RADIUS} width={CARD_W - 8} x={4} y={4} />
      <DualColorTriangles fills={visual.clueColorFills} />
      <Rect
        fill={backgroundFill}
        fillOpacity={0.3}
        height={CARD_H - 8}
        rx={BORDER_RADIUS}
        ry={BORDER_RADIUS}
        stroke={backgroundFill}
        strokeOpacity={0.7}
        strokeWidth={8}
        width={CARD_W - 8}
        x={4}
        y={4}
      />

      <SvgText fill={rankFill} fontFamily="Arial" fontSize={128} fontWeight="bold" stroke="#000000" strokeLinejoin="round" strokeWidth={2} x={19} y={110}>
        {rank}
      </SvgText>
      <G transform={`translate(${CARD_W} ${CARD_H}) rotate(180)`}>
        <SvgText fill={rankFill} fontFamily="Arial" fontSize={128} fontWeight="bold" stroke="#000000" strokeLinejoin="round" strokeWidth={2} x={19} y={110}>
          {rank}
        </SvgText>
      </G>

      <RankPips
        duplicatePip={visual.duplicatePip}
        fillColors={visual.pipFillColors}
        pip={visual.pip}
        rank={rank}
        suitName={visual.suitName}
      />
    </Svg>
  );
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
      <Stop key={`${id}-${color}-${index}`} offset={index / (paint.colors.length - 1)} stopColor={color} />
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
  if (rank === 1) {
    return <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="center" pip={pip} scale={0.72} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2} />;
  }
  if (rank === 2) {
    return <>
      <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="top" pip={pip} scale={0.56} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2 - 90} />
      <PlacedPip duplicatePip={duplicatePip} fillColors={fillColors} id="bottom" pip={pip} rotation={180} scale={0.56} suitName={suitName} x={CARD_W / 2} y={CARD_H / 2 + 90} />
    </>;
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

function PlacedPip({ duplicatePip, fillColors, id, pip, rotation = 0, scale, suitName, x, y }: {
  duplicatePip: boolean;
  fillColors: readonly string[];
  id: string;
  pip: string;
  rotation?: number;
  scale: number;
  suitName: string;
  x: number;
  y: number;
}) {
  return (
    <G transform={`translate(${x} ${y}) rotate(${rotation}) scale(${scale})`}>
      <UpstreamPipPaths
        duplicatePip={duplicatePip}
        fillColors={fillColors}
        idPrefix={`card-${id}-${pip}`}
        pip={pip}
        suitName={suitName}
      />
    </G>
  );
}
