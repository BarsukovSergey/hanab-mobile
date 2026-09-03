import { getSuit, getVariant } from '../upstream/gameData';

export type CardPaint =
  | { type: 'solid'; color: string }
  | { type: 'gradient'; colors: readonly string[]; x1: number; y1: number; x2: number; y2: number };

export type VisibleCardVisual = {
  background: CardPaint;
  clueColorFills: readonly string[];
  deceptiveRank: number | null;
  duplicatePip: boolean;
  pip: string;
  pipFillColors: readonly string[];
  rankPaint: CardPaint;
  showBottomRank: boolean;
  suitName: string;
};

const CARD_W = 286;
const CARD_H = 406;

export function getVisibleCardVisual(variantName: string, suitIndex: number, rank: number): VisibleCardVisual | null {
  const variant = getVariant(variantName);
  const suit = variant.suits[suitIndex];
  if (suit === undefined) return null;

  const pip = variant.pips[suitIndex] ?? suit.pip;
  const rawFillColors = suit.fill === 'multi' && suit.fillColors.length > 0
    ? suit.fillColors
    : [suit.fill.length === 0 ? '#5d6570' : suit.fill];
  const deceptiveRank = variant.specialRankDeceptive
    && rank === variant.specialRank
    && !suit.noClueRanks
    ? variant.clueRanks[suitIndex % variant.clueRanks.length] ?? null
    : null;

  return {
    background: suit.prism
      ? prismPaint(variantName, suitIndex, rank)
      : backgroundPaint(suit.name, suit.fill, rawFillColors),
    clueColorFills: suit.clueColors.map((color) => color.fill),
    deceptiveRank,
    duplicatePip: variant.pips.slice(0, suitIndex).some((previousPip) => previousPip === pip),
    pip,
    pipFillColors: suit.name === 'Black' ? ['#212121'] : rawFillColors,
    rankPaint: rankPaint(variantName, suitIndex, rank),
    showBottomRank: !variant.upOrDown && !suit.reversed,
    suitName: suit.name,
  };
}

function backgroundPaint(suitName: string, fill: string, fillColors: readonly string[]): CardPaint {
  if (fill !== 'multi') return { type: 'solid', color: fill };
  if (suitName === 'Omni' || suitName === 'Dark Omni') {
    return { type: 'gradient', colors: fillColors, x1: 0, y1: -30, x2: 0, y2: CARD_H + 30 };
  }
  return { type: 'gradient', colors: fillColors, x1: 0, y1: 0, x2: CARD_W, y2: CARD_H };
}

function rankPaint(variantName: string, suitIndex: number, rank: number): CardPaint {
  const variant = getVariant(variantName);
  const suit = variant.suits[suitIndex];
  if (suit === undefined) return { type: 'solid', color: '#5d6570' };

  if (variant.synesthesia) {
    if (suit.noClueRanks) return { type: 'solid', color: suit.fill };
    const color = variant.clueColors[(rank - 1) % variant.clueColors.length];
    if (color !== undefined) return { type: 'solid', color: color.fill };
  }

  if (rank === variant.specialRank) {
    const allClueColors = suit.allClueColors || (variant.specialRankAllClueColors && !suit.noClueColors);
    const noClueColors = suit.noClueColors || (variant.specialRankNoClueColors && !suit.allClueColors);
    const allClueRanks = suit.allClueRanks || (variant.specialRankAllClueRanks && !suit.noClueRanks);
    const noClueRanks = suit.noClueRanks || (variant.specialRankNoClueRanks && !suit.allClueRanks);
    const dark = suit.oneOfEach;

    if (allClueColors) {
      const specialSuit = allClueRanks
        ? getSuit(dark ? 'Dark Omni' : 'Omni')
        : noClueRanks
          ? getSuit(dark ? 'Cocoa Rainbow' : 'Muddy Rainbow')
          : getSuit(dark ? 'Dark Rainbow' : 'Rainbow');
      return { type: 'gradient', colors: specialSuit.fillColors, x1: 0, y1: 14, x2: 0, y2: 110 };
    }
    if (noClueColors) {
      if (allClueRanks) return { type: 'solid', color: getSuit(dark ? 'Gray Pink' : 'Light Pink').fill };
      if (noClueRanks) return { type: 'solid', color: getSuit(dark ? 'Dark Null' : 'Null').fill };
      return { type: 'solid', color: getSuit(dark ? 'Gray' : 'White').fill };
    }
    if (allClueRanks) return { type: 'solid', color: getSuit(dark ? 'Dark Pink' : 'Pink').fill };
    if (noClueRanks) return { type: 'solid', color: getSuit(dark ? 'Dark Brown' : 'Brown').fill };
  }

  if (suit.prism) return prismPaint(variantName, suitIndex, rank);
  if (suit.fill !== 'multi') return { type: 'solid', color: suit.fill };
  return { type: 'gradient', colors: suit.fillColors, x1: 0, y1: 14, x2: 0, y2: 110 };
}

function prismPaint(variantName: string, suitIndex: number, rank: number): CardPaint {
  const variant = getVariant(variantName);
  const suit = variant.suits[suitIndex];
  if (suit === undefined || rank === 0) return { type: 'solid', color: suit?.fill ?? '#5d6570' };
  const color = variant.clueColors[(rank - 1) % variant.clueColors.length];
  if (color === undefined) return { type: 'solid', color: suit.fill };
  return { type: 'solid', color: mixHex(color.fill, suit.oneOfEach ? '#000000' : '#ffffff', 0.5) ?? suit.fill };
}

function mixHex(a: string, b: string, amountA: number): string | null {
  const rgbA = parseHex(a);
  const rgbB = parseHex(b);
  if (rgbA === null || rgbB === null) return null;
  const mix = (x: number, y: number) => x * amountA + y * (1 - amountA);
  return `rgb(${mix(rgbA[0], rgbB[0])},${mix(rgbA[1], rgbB[1])},${mix(rgbA[2], rgbB[2])})`;
}

function parseHex(value: string): readonly [number, number, number] | null {
  const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(value);
  if (match === null || match[1] === undefined || match[2] === undefined || match[3] === undefined) return null;
  return [Number.parseInt(match[1], 16), Number.parseInt(match[2], 16), Number.parseInt(match[3], 16)];
}
