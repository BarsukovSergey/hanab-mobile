export const SHRUG_TEXT = '¯\\_(ツ)_/¯';

export function transformChatInput(input: string, lastPM: string | null): string {
  if (input === '/shrug') return SHRUG_TEXT;
  if (input === '/r ' && lastPM !== null) return `/pm ${lastPM} `;
  return input;
}
