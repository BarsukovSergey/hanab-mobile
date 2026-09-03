import { getVariant } from '../upstream/gameData';

export type CardSuitVisual = {
  name: string;
  fill: string;
  marker: string;
};

export function getCardSuitVisuals(variantName: string): readonly CardSuitVisual[] {
  return getVariant(variantName).suits.map((suit) => ({
    name: suit.name,
    fill: suit.fill === 'multi' || suit.fill.length === 0
      ? suit.fillColors[0] ?? '#5d6570'
      : suit.fill,
    marker: pipMarker(suit.pip, suit.abbreviation || suit.name.slice(0, 1).toUpperCase()),
  }));
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
