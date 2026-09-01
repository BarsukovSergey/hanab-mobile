const NAMED_ENTITIES: Readonly<Record<string, string>> = {
  amp: '&', apos: "'", gt: '>', lt: '<', nbsp: ' ', quot: '"',
};

function decodeEntity(entity: string): string {
  if (entity.startsWith('#x') || entity.startsWith('#X')) {
    const value = Number.parseInt(entity.slice(2), 16);
    return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
      ? String.fromCodePoint(value)
      : `&${entity};`;
  }
  if (entity.startsWith('#')) {
    const value = Number.parseInt(entity.slice(1), 10);
    return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
      ? String.fromCodePoint(value)
      : `&${entity};`;
  }
  return NAMED_ENTITIES[entity] ?? `&${entity};`;
}

/** Convert trusted server markup to inert, readable React Native text. */
export function chatMarkupToPlainText(markup: string): string {
  const withoutMarkup = markup
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/(?:div|li|p)>/gi, '\n')
    .replace(/<[^>]*>/g, '');

  return withoutMarkup
    .replace(/&(#(?:x[0-9a-f]+|\d+)|[a-z]+);/gi, (_match, entity: string) => (
      decodeEntity(entity.toLowerCase())
    ))
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
