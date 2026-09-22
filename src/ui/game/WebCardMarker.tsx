import { Circle, Line, Path, Rect, Svg } from 'react-native-svg';

type WebCardMarkerKind =
  | 'critical'
  | 'trash'
  | 'trash-mini'
  | 'dda'
  | 'fix'
  | 'question'
  | 'exclamation'
  | 'note';

/**
 * Mobile redraws of Hanabi Live's card-state marker assets.
 *
 * The semantic mapping and placement come from the pinned web implementation:
 * packages/client/src/game/ui/HanabiCardInit.ts @ 7a9c601b66f5966f7e33564855e25f82e68a94ed.
 * We redraw them as SVG so the mobile app does not invent text badges such as KT/T/DDA.
 */
export function WebCardMarker({ kind }: { kind: WebCardMarkerKind }) {
  switch (kind) {
    case 'critical':
      return <CriticalIcon />;
    case 'trash':
      return <TrashCanIcon />;
    case 'trash-mini':
      return <WastebasketIcon />;
    case 'dda':
      return <DoubleDiscardIcon />;
    case 'fix':
      return <WrenchIcon />;
    case 'question':
      return <QuestionIcon />;
    case 'exclamation':
      return <ExclamationIcon />;
    case 'note':
      return <NoteIcon />;
  }
}

function CriticalIcon() {
  return <Svg height="100%" viewBox="0 0 100 100" width="100%">
    <Circle cx={50} cy={50} fill="#c60000" r={42} stroke="#0d0d0d" strokeWidth={6} />
    <Rect fill="#ffffff" height={45} rx={6} width={12} x={44} y={21} />
    <Circle cx={50} cy={78} fill="#ffffff" r={7} />
  </Svg>;
}

function TrashCanIcon() {
  return <Svg height="100%" viewBox="0 0 100 100" width="100%">
    <Rect fill="#f4f4ee" height={11} rx={4} stroke="#0d0d0d" strokeWidth={5} width={62} x={19} y={18} />
    <Rect fill="#f4f4ee" height={11} rx={4} stroke="#0d0d0d" strokeWidth={5} width={28} x={36} y={8} />
    <Path d="M27 31 L73 31 L68 87 Q67 93 61 93 L39 93 Q33 93 32 87 Z" fill="#f4f4ee" stroke="#0d0d0d" strokeLinejoin="round" strokeWidth={5} />
    <Line stroke="#0d0d0d" strokeLinecap="round" strokeWidth={5} x1={43} x2={43} y1={42} y2={81} />
    <Line stroke="#0d0d0d" strokeLinecap="round" strokeWidth={5} x1={57} x2={57} y1={42} y2={81} />
  </Svg>;
}

function WastebasketIcon() {
  return <Svg height="100%" viewBox="0 0 100 100" width="100%">
    <Path d="M20 29 H80 L71 88 H29 Z" fill="#f4f4ee" stroke="#0d0d0d" strokeLinejoin="round" strokeWidth={7} />
    <Line stroke="#0d0d0d" strokeLinecap="round" strokeWidth={7} x1={17} x2={83} y1={22} y2={22} />
    <Line stroke="#0d0d0d" strokeLinecap="round" strokeWidth={6} x1={42} x2={39} y1={38} y2={77} />
    <Line stroke="#0d0d0d" strokeLinecap="round" strokeWidth={6} x1={58} x2={61} y1={38} y2={77} />
  </Svg>;
}

function DoubleDiscardIcon() {
  return <Svg height="100%" viewBox="0 0 100 100" width="100%">
    <Circle cx={50} cy={50} fill="#ffdf00" r={44} stroke="#0d0d0d" strokeWidth={7} />
    <Path d="M27 33 V62 L18 53 M27 62 L36 53" fill="none" stroke="#0d0d0d" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
    <Path d="M53 33 V62 L44 53 M53 62 L62 53" fill="none" stroke="#0d0d0d" strokeLinecap="round" strokeLinejoin="round" strokeWidth={8} />
    <Path d="M73 31 V68" stroke="#0d0d0d" strokeLinecap="round" strokeWidth={8} />
    <Circle cx={73} cy={79} fill="#0d0d0d" r={5} />
  </Svg>;
}

function WrenchIcon() {
  return <Svg height="100%" viewBox="0 0 100 100" width="100%">
    <Path d="M64 8 Q78 10 86 22 L69 39 L60 37 L55 28 L72 11 Q68 9 64 8 Z" fill="#f4f4ee" stroke="#0d0d0d" strokeLinejoin="round" strokeWidth={5} />
    <Path d="M59 34 L88 71 Q94 79 88 87 Q80 95 72 89 L42 52 Z" fill="#f4f4ee" stroke="#0d0d0d" strokeLinejoin="round" strokeWidth={5} />
    <Circle cx={80} cy={80} fill="none" r={6} stroke="#0d0d0d" strokeWidth={4} />
  </Svg>;
}

function QuestionIcon() {
  return <Svg height="100%" viewBox="0 0 100 100" width="100%">
    <Circle cx={50} cy={50} fill="rgba(244,244,238,0.92)" r={44} stroke="#0d0d0d" strokeWidth={5} />
    <Path d="M34 37 Q35 21 51 20 Q69 20 69 37 Q69 48 58 54 Q50 58 50 68" fill="none" stroke="#0d0d0d" strokeLinecap="round" strokeWidth={9} />
    <Circle cx={50} cy={82} fill="#0d0d0d" r={6} />
  </Svg>;
}

function ExclamationIcon() {
  return <Svg height="100%" viewBox="0 0 100 100" width="100%">
    <Circle cx={50} cy={50} fill="rgba(244,244,238,0.92)" r={44} stroke="#0d0d0d" strokeWidth={5} />
    <Rect fill="#0d0d0d" height={48} rx={5} width={10} x={45} y={20} />
    <Circle cx={50} cy={82} fill="#0d0d0d" r={6} />
  </Svg>;
}

function NoteIcon() {
  return <Svg height="100%" viewBox="0 0 100 100" width="100%">
    <Path d="M18 12 H70 L86 28 V88 H18 Z" fill="#d8d5ef" stroke="#0d0d0d" strokeLinejoin="round" strokeWidth={6} />
    <Path d="M70 12 V29 H86" fill="none" stroke="#0d0d0d" strokeLinejoin="round" strokeWidth={6} />
    <Line stroke="#0d0d0d" strokeLinecap="round" strokeWidth={6} x1={31} x2={70} y1={47} y2={47} />
    <Line stroke="#0d0d0d" strokeLinecap="round" strokeWidth={6} x1={31} x2={62} y1={62} y2={62} />
  </Svg>;
}
