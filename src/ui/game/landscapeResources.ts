import { HANABI_TABLE_CARD_ASPECT_RATIO } from './tableLayout';

/** Same resource/discard composition for every player count and Workbench tool. */
export function getLandscapeResourceEnvelope(fontScale: number, suitCount: number) {
  const scale = Math.max(1, fontScale);
  const rowHeight = Math.ceil(44 * scale);
  const discardHeight = Math.max(44, Math.ceil(16 * scale + 6));
  const resourceRail = Math.ceil(58 * scale);
  const deckWidth = Math.ceil(34 * scale);
  const fireworkWidth = 30 * HANABI_TABLE_CARD_ASPECT_RATIO;
  const minimumWidth = Math.ceil(suitCount * fireworkWidth + Math.max(0, suitCount - 1) * 2
    + resourceRail + deckWidth + 16);
  return { rowHeight, discardHeight, height: rowHeight + 4 + discardHeight,
    resourceRail, deckWidth, discardCardHeight: 36, minimumWidth };
}

export const getLandscapeLastActionHeight = (fontScale: number) => Math.ceil(28 * Math.max(1, fontScale));
