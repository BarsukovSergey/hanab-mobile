import { getVariant } from '../upstream/gameData';

export type CardSuitVisual = {
  name: string;
  fill: string;
  foreground: string;
  marker: string;
};

export function getCardSuitVisuals(variantName: string): readonly CardSuitVisual[] {
  return getVariant(variantName).suits.map((suit) => {
    const fill = suit.fill === 'multi' || suit.fill.length === 0
      ? suit.fillColors[0] ?? '#5d6570'
      : suit.fill;
    return {
      name: suit.name,
      fill,
      foreground: foregroundForFill(fill),
      marker: pipMarker(suit.pip, suit.abbreviation || suit.name.slice(0, 1).toUpperCase()),
    };
  });
}

function foregroundForFill(fill: string): string {
  const normalized = fill.trim().toLowerCase();
  if (normalized === 'white' || normalized === '#fff' || normalized === '#ffffff') return '#0d0d0d';
  if (normalized === 'yellow' || normalized === '#ff0' || normalized === '#ffff00') return '#0d0d0d';
  const hex = normalized.match(/^#([0-9a-f]{6})$/);
  if (hex === null) return '#ffffff';
  const value = hex[1];
  if (value === undefined) return '#ffffff';
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.66 ? '#0d0d0d' : '#ffffff';
}

function pipMarker(pip: string, fallback: string): string {
  switch (pip) {
    case 'hanabiRed1': return '●';
    case 'hanabiYellow2': return '◆';
    case 'hanabiGreen3': return '▲';
    case 'hanabiBlue4': return '■';
    case 'hanabiWhite5':
    case 'hanabiAltWhite6': return '★';
    case 'emptySet': return '∅';
    case 'hashtag': return '#';
    case 'infinity': return '∞';
    case 'moon': return '☾';
    case 'rainbow': return '◉';
    case 'triangle': return '△';
    case 'unoReverse': return '↺';
    case 'katakanaHe': return 'ヘ';
    case 'katakanaNu': return 'ヌ';
    default: return fallback;
  }
}
