import { Defs, LinearGradient, Rect, Stop, Svg, Text as SvgText } from 'react-native-svg';

import type { CardSuitVisual } from '../../game/selectors/cardVisuals';
import { UpstreamPip } from './UpstreamPip';

const CARD_W = 286;
const CARD_H = 406;
const BORDER_RADIUS = CARD_W * 0.08;

export function UpstreamCardFace({ rank, suit }: { rank: number; suit: CardSuitVisual }) {
  const backgroundFill = suit.fillColors.length > 1 ? 'url(#cardFill)' : (suit.fillColors[0] ?? suit.fill);
  const pipFillColors = suit.name === 'Black' ? ['#212121'] : suit.fillColors;
  const rankFill = suit.fillColors.length > 1 ? 'url(#rankFill)' : (suit.fillColors[0] ?? suit.fill);

  return (
    <Svg height="100%" viewBox={`0 0 ${CARD_W} ${CARD_H}`} width="100%">
      {suit.fillColors.length > 1 && (
        <Defs>
          <LinearGradient id="cardFill" x1="0" x2="1" y1="0" y2="1">
            {suit.fillColors.map((color, index) => (
              <Stop key={`card-${color}-${index}`} offset={index / (suit.fillColors.length - 1)} stopColor={color} />
            ))}
          </LinearGradient>
          <LinearGradient id="rankFill" x1="0" x2="0" y1="0" y2="1">
            {suit.fillColors.map((color, index) => (
              <Stop key={`rank-${color}-${index}`} offset={index / (suit.fillColors.length - 1)} stopColor={color} />
            ))}
          </LinearGradient>
        </Defs>
      )}

      <Rect fill="#ffffff" height={CARD_H - 8} rx={BORDER_RADIUS} ry={BORDER_RADIUS} width={CARD_W - 8} x={4} y={4} />
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

      <SvgText
        fill={rankFill}
        fontFamily="Arial"
        fontSize={128}
        fontWeight="bold"
        stroke="#000000"
        strokeLinejoin="round"
        strokeWidth={2}
        x={19}
        y={110}
      >
        {rank}
      </SvgText>
      <SvgText
        fill={rankFill}
        fontFamily="Arial"
        fontSize={128}
        fontWeight="bold"
        rotation={180}
        origin={`${CARD_W / 2}, ${CARD_H / 2}`}
        stroke="#000000"
        strokeLinejoin="round"
        strokeWidth={2}
        x={19}
        y={110}
      >
        {rank}
      </SvgText>

      <RankPips fillColors={pipFillColors} pip={suit.pip} rank={rank} />
    </Svg>
  );
}

function RankPips({ fillColors, pip, rank }: { fillColors: readonly string[]; pip: string; rank: number }) {
  if (rank === 1) {
    return <PlacedPip fillColors={fillColors} pip={pip} size={144} x={CARD_W / 2} y={CARD_H / 2} />;
  }
  if (rank === 2) {
    return <>
      <PlacedPip fillColors={fillColors} pip={pip} size={112} x={CARD_W / 2} y={CARD_H / 2 - 90} />
      <PlacedPip fillColors={fillColors} pip={pip} rotation={180} size={112} x={CARD_W / 2} y={CARD_H / 2 + 90} />
    </>;
  }
  if (rank < 3 || rank > 5) return null;

  return <>
    <PlacedPip fillColors={fillColors} pip={pip} size={80} x={CARD_W / 2} y={CARD_H / 2 - 120} />
    <PlacedPip fillColors={fillColors} pip={pip} rotation={180} size={80} x={CARD_W / 2} y={CARD_H / 2 + 120} />
    {(rank === 4 || rank === 5) && <>
      <PlacedPip fillColors={fillColors} pip={pip} size={80} x={CARD_W / 2 - 90} y={CARD_H / 2} />
      <PlacedPip fillColors={fillColors} pip={pip} rotation={180} size={80} x={CARD_W / 2 + 90} y={CARD_H / 2} />
    </>}
    {(rank === 3 || rank === 5) && (
      <PlacedPip fillColors={fillColors} pip={pip} size={96} x={CARD_W / 2} y={CARD_H / 2} />
    )}
  </>;
}

function PlacedPip({ fillColors, pip, rotation = 0, size, x, y }: {
  fillColors: readonly string[];
  pip: string;
  rotation?: number;
  size: number;
  x: number;
  y: number;
}) {
  const left = x - size / 2;
  const top = y - size / 2;
  return (
    <Svg height={size} rotation={rotation} viewBox="-100 -100 200 200" width={size} x={left} y={top}>
      <UpstreamPip fillColors={fillColors} pip={pip} size={200} />
    </Svg>
  );
}
