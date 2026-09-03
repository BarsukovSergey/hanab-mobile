import { recordPipVector, type PipDrawingContext, type PipVector } from './pipVectorRecorder';
import { drawEmptySet } from './upstreamPips/emptySet';
import { drawHanabiAltWhite6 } from './upstreamPips/hanabiAltWhite6';
import { drawHashtag } from './upstreamPips/hashtag';
import { drawInfinity } from './upstreamPips/infinity';
import { drawKatakanaHe } from './upstreamPips/katakanaHe';
import { drawKatakanaNu } from './upstreamPips/katakanaNu';
import { drawMoon } from './upstreamPips/moon';
import { drawRainbow } from './upstreamPips/rainbow';
import { drawTriangle } from './upstreamPips/triangle';

type DrawPip = (ctx: PipDrawingContext, colors?: readonly string[]) => void;

const VANILLA_PIPS = new Set<string>([
  'hanabiRed1',
  'hanabiYellow2',
  'hanabiGreen3',
  'hanabiBlue4',
  'hanabiWhite5',
]);

const CUSTOM_PIPS: Readonly<Record<string, DrawPip>> = {
  emptySet: drawEmptySet,
  hanabiAltWhite6: drawHanabiAltWhite6,
  hashtag: drawHashtag,
  infinity: drawInfinity,
  katakanaHe: drawKatakanaHe,
  katakanaNu: drawKatakanaNu,
  moon: drawMoon,
  rainbow: drawRainbow,
  triangle: drawTriangle,
};

export function isUpstreamPipRenderable(pip: string): boolean {
  return VANILLA_PIPS.has(pip) || CUSTOM_PIPS[pip] !== undefined;
}

export function isVanillaUpstreamPip(pip: string): boolean {
  return VANILLA_PIPS.has(pip);
}

export function getRecordedPipVector(pip: string, fillColors: readonly string[], suitName: string): PipVector | null {
  const draw = CUSTOM_PIPS[pip];
  if (draw === undefined) return null;
  const fill = suitName === 'Black' ? '#212121' : fillColors[0] ?? '#5d6570';
  return recordPipVector(draw, {
    colors: fillColors.length > 1 ? fillColors : undefined,
    fill,
  });
}
