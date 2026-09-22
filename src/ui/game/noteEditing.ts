export function beginNoteEdit(text: string): string {
  const saved = text.trim();
  return saved.length === 0 ? '' : `${saved} | `;
}

export function normalizeSubmittedNote(text: string): string {
  return text.trim().replace(/\s*\|\s*$/, '').trim();
}

export function prependTurnToNote(text: string, turn: number): string {
  const trimmed = text.trim();
  const withoutExistingTurn = trimmed.replace(/^#\d+\s*/, '');
  return `#${turn}${withoutExistingTurn.length === 0 ? '' : ` ${withoutExistingTurn}`}`;
}
