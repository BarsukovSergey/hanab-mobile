import { expand } from './hypoCompress';

export type ReplayVisibility = 'solo' | 'shared';
export type ReplayInputResult =
  | { kind: 'id'; databaseID: number; visibility: ReplayVisibility }
  | { kind: 'json'; gameJSON: Record<string, unknown>; visibility: ReplayVisibility }
  | { kind: 'invalid'; reason: string };

function asObject(text: string): Record<string, unknown> | undefined {
  try {
    const value: unknown = JSON.parse(text);
    return value !== null && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown> : undefined;
  } catch { return undefined; }
}

export function parseReplayInput(input: string, rawJSONVisibility: ReplayVisibility): ReplayInputResult {
  const value = input.trim();
  if (value === '') return { kind: 'invalid', reason: 'Enter replay JSON or a hanab.live replay link.' };
  if (!/^[a-z][a-z\d+.-]*:\/\//i.test(value)) {
    const gameJSON = asObject(value);
    return gameJSON === undefined
      ? { kind: 'invalid', reason: 'Enter valid replay JSON (a JSON object) or a hanab.live replay link.' }
      : { kind: 'json', gameJSON, visibility: rawJSONVisibility };
  }
  let url: URL;
  try { url = new URL(value); } catch { return { kind: 'invalid', reason: 'Enter a valid hanab.live replay URL.' }; }
  if (url.protocol !== 'https:' || url.hostname !== 'hanab.live' || url.port !== '') {
    return { kind: 'invalid', reason: 'Replay links must use https://hanab.live.' };
  }
  const idMatch = /^\/(replay|shared-replay)\/([^/]+)\/?$/.exec(url.pathname);
  if (idMatch) {
    const segment = idMatch[2] ?? '';
    if (!/^\d+$/.test(segment) || !Number.isSafeInteger(Number(segment)) || Number(segment) <= 0) {
      return { kind: 'invalid', reason: 'Replay database ID must be a positive integer.' };
    }
    return { kind: 'id', databaseID: Number(segment), visibility: idMatch[1] === 'replay' ? 'solo' : 'shared' };
  }
  const jsonMatch = /^\/(replay-json|shared-replay-json)\/([^/]+)\/?$/.exec(url.pathname);
  if (jsonMatch) {
    let compressed: string;
    try { compressed = decodeURIComponent(jsonMatch[2] ?? ''); } catch {
      return { kind: 'invalid', reason: 'Compressed replay data is invalid.' };
    }
    const expanded = expand(compressed);
    const gameJSON = expanded === undefined ? undefined : asObject(expanded);
    if (gameJSON === undefined) return { kind: 'invalid', reason: 'Compressed replay data is invalid.' };
    return { kind: 'json', gameJSON, visibility: jsonMatch[1] === 'replay-json' ? 'solo' : 'shared' };
  }
  return { kind: 'invalid', reason: 'Unsupported hanab.live URL. Use a replay or replay-json link.' };
}
