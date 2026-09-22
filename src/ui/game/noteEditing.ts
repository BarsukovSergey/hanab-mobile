const NOTE_SEPARATOR = ' | ';

export function beginNoteEdit(text: string): string {
  const trimmedRight = text.replace(/\s+$/, '');
  if (trimmedRight.length === 0 || trimmedRight.endsWith('|')) return trimmedRight;
  return `${trimmedRight}${NOTE_SEPARATOR}`;
}

export function normalizeSubmittedNote(text: string): string {
  return text
    .replace(/\s*\|\s*$/, '')
    .trim();
}

export function appendNoteToken(text: string, token: string): string {
  const normalizedToken = token.trim();
  if (normalizedToken.length === 0) return text;
  const base = text.replace(/\s+$/, '');
  if (base.length === 0) return normalizedToken;
  if (base.endsWith('|')) return `${base} ${normalizedToken}`;
  return `${base}${NOTE_SEPARATOR}${normalizedToken}`;
}
