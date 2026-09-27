import { DEFAULT_PLAYER_NAMES, MAX_PLAYERS, MIN_PLAYERS } from '../upstream/constants';
import { getVariant, getVariantByID } from '../upstream/gameData';
import type { ReplayJSON } from './replayExport';

const BASE62 = 'abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
type Range = { min: number; max: number };

export function shrink(json: string): string | undefined {
  let data: ReplayJSON;
  try { data = JSON.parse(json) as ReplayJSON; } catch { return undefined; }
  const compressed = compress(data);
  if (compressed === undefined) return undefined;
  const expanded = expand(compressed);
  if (expanded === undefined || !equal(data, JSON.parse(expanded) as ReplayJSON)) return undefined;
  return compressed;
}

export function expand(src: string): string | undefined {
  const parts = src.split(',');
  const seed = parts[3] ?? '';
  if (parts.length < 3 || parts.length > 4 || !/^[\dA-Za-z-]*$/.test(seed)) return undefined;
  const normalized = parts.slice(0, 3).join(',').replaceAll('-', '');
  const [playerDeck, actionText, variantText] = normalized.split(',');
  if (playerDeck === undefined || actionText === undefined || variantText === undefined) return undefined;
  const count = Number(playerDeck[0]);
  if (!Number.isInteger(count) || count < MIN_PLAYERS || count > MAX_PLAYERS) return undefined;
  const deck = decodeDeck(playerDeck.slice(1));
  const actions = decodeActions(actionText);
  const id = Number(variantText);
  if (deck === undefined || actions === undefined || !Number.isInteger(id)) return undefined;
  let variant: string;
  try { variant = getVariantByID(id).name; } catch { return undefined; }
  return JSON.stringify({ players: DEFAULT_PLAYER_NAMES.slice(0, count), deck, actions, options: { variant }, characters: [], id: 0, notes: [], seed });
}

function compress(data: ReplayJSON): string | undefined {
  if (data.players.length < MIN_PLAYERS || data.players.length > MAX_PLAYERS || !/^[\dA-Za-z-]*$/.test(data.seed)) return undefined;
  const deckRange = range(data.deck.map((c) => c.rank));
  if (!valid(deckRange)) return undefined;
  let deck = `${deckRange.min}${deckRange.max}`;
  for (const card of data.deck) {
    const index = card.suitIndex * (deckRange.max - deckRange.min + 1) + card.rank - deckRange.min;
    if (index < 0 || index >= BASE62.length) return undefined;
    deck += BASE62[index];
  }
  const actionRange = range(data.actions.map((a) => a.type));
  let actions = '00';
  if (valid(actionRange)) {
    const width = actionRange.max - actionRange.min + 1;
    actions = `${actionRange.min}${actionRange.max}`;
    for (const action of data.actions) {
      const index = ((action.value ?? -1) + 1) * width + action.type - actionRange.min;
      if (index < 0 || index >= BASE62.length || action.target < 0 || action.target >= BASE62.length) return undefined;
      actions += (BASE62[index] ?? '') + (BASE62[action.target] ?? '');
    }
  }
  let variantID: number;
  try { variantID = getVariant(data.options.variant).id; } catch { return undefined; }
  const body = `${data.players.length}${deck},${actions},${variantID}`;
  return `${(body.match(/.{1,20}/g) ?? []).join('-')},${data.seed}`;
}

function decodeDeck(src: string): ReplayJSON['deck'] | undefined {
  const min = Number(src[0]); const max = Number(src[1]);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min || max > 9) return undefined;
  const width = max - min + 1; const result: { suitIndex: number; rank: number }[] = [];
  for (const ch of src.slice(2)) {
    const index = BASE62.indexOf(ch); if (index < 0) return undefined;
    result.push({ suitIndex: Math.floor(index / width), rank: index % width + min });
  }
  return result;
}
function decodeActions(src: string): ReplayJSON['actions'] | undefined {
  const min = Number(src[0]); const max = Number(src[1]);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min || (src.length - 2) % 2 !== 0) return undefined;
  const width = max - min + 1; const result: { type: number; target: number; value?: number }[] = [];
  for (let i = 2; i < src.length; i += 2) {
    const index = BASE62.indexOf(src[i] ?? ''); const target = BASE62.indexOf(src[i + 1] ?? '');
    if (index < 0 || target < 0) return undefined;
    const type = index % width + min; const val = Math.floor(index / width);
    result.push(val === 0 ? { type, target } : { type, target, value: val - 1 });
  }
  return result;
}
function range(values: readonly number[]): Range { return values.length ? { min: Math.min(...values), max: Math.max(...values) } : { min: -1, max: -1 }; }
function valid(r: Range): boolean { return r.min >= 0 && r.min <= r.max; }
function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || a === null || typeof b !== 'object' || b === null) return false;
  const ak = Object.keys(a); const bk = Object.keys(b);
  return ak.length === bk.length && ak.every((key) => Object.hasOwn(b, key) && equal((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}
