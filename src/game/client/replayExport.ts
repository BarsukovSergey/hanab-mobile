import { DEFAULT_PLAYER_NAMES } from '../upstream/constants';
import { getVariant } from '../upstream/gameData';
import type { State } from './types/State';
import type { GameAction } from '../upstream/types/gameActions';
import { ClueType } from '../upstream/enums/ClueType';
import { shrink } from './hypoCompress';

export interface ReplayJSON {
  players: readonly string[];
  deck: readonly { suitIndex: number; rank: number }[];
  actions: readonly { type: number; target: number; value?: number }[];
  options: { variant: string };
  notes: readonly string[];
  characters: readonly string[];
  id: number;
  seed: string;
}

export type ReplayExportResult = { ok: true; json: string; url: string } | { ok: false; error: string };

export function createReplayExport(state: State, baseUrl: string): ReplayExportResult {
  if (!state.finished) return { ok: false, error: 'Replay export is available only for a finished game.' };
  const originalDeck = state.cardIdentities;
  if (originalDeck.length === 0 || originalDeck.some((card) => card.suitIndex === null || card.rank === null)) {
    return { ok: false, error: 'Full card identities are not ready.' };
  }
  const deck = originalDeck.map((card, order) => {
    const morph = state.replay.hypothetical?.morphedIdentities[order];
    return morph?.suitIndex !== undefined && morph.suitIndex !== null && morph.rank !== undefined && morph.rank !== null
      ? { suitIndex: morph.suitIndex, rank: morph.rank }
      : { suitIndex: card.suitIndex as number, rank: card.rank as number };
  });
  const actions = convertActions(state.replay.actions, state.replay.segment);
  if (state.replay.hypothetical !== null) actions.push(...convertHypothetical(state.replay.hypothetical.actions));
  if (actions.length === 0) return { ok: false, error: 'There are no actions to export.' };
  const variant = state.metadata.options.variantName;
  try { getVariant(variant); } catch { return { ok: false, error: 'The game variant cannot be exported.' }; }
  const unchanged = deck.every((card, i) => card.suitIndex === originalDeck[i]?.suitIndex && card.rank === originalDeck[i]?.rank);
  const game: ReplayJSON = {
    players: DEFAULT_PLAYER_NAMES.slice(0, state.metadata.playerNames.length), deck, actions,
    options: { variant }, notes: [], characters: [], id: 0,
    seed: state.metadata.seed !== 'JSON' && unchanged ? state.metadata.seed : '',
  };
  const json = JSON.stringify(game);
  const compressed = shrink(json);
  if (compressed === undefined || compressed === '') return { ok: false, error: 'Failed to compress replay data.' };
  return { ok: true, json, url: `${baseUrl}/shared-replay-json/${compressed}` };
}

function convertActions(source: readonly GameAction[], segment: number): ReplayJSON['actions'][number][] {
  const output: ReplayJSON['actions'][number][] = [];
  let current = 0;
  for (const action of source) {
    if (current >= segment) break;
    if (action.type === 'play') { output.push({ type: 0, target: action.order }); current++; }
    else if (action.type === 'discard') { output.push({ type: action.failed ? 0 : 1, target: action.order }); current++; }
    else if (action.type === 'clue') {
      if (action.clue.type === ClueType.Color) output.push({ type: 2, target: action.target, value: action.clue.value });
      else output.push({ type: 3, target: action.target, value: action.clue.value });
      current++;
    }
  }
  return output;
}

function convertHypothetical(source: readonly import('./types/actions').ActionIncludingHypothetical[]): ReplayJSON['actions'][number][] {
  const output: ReplayJSON['actions'][number][] = [];
  for (const action of source) {
    if (action.type === 'play') output.push({ type: 0, target: action.order });
    else if (action.type === 'discard') output.push({ type: action.failed ? 0 : 1, target: action.order });
    else if (action.type === 'clue') output.push({ type: action.clue.type === ClueType.Color ? 2 : 3, target: action.target, value: action.clue.value });
  }
  return output;
}
