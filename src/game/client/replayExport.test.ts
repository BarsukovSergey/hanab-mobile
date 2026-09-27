import { expect, test } from '@jest/globals';
import { ClueType } from '../upstream/enums/ClueType';
import type { State } from './types/State';
import { createReplayExport } from './replayExport';
import { expand, shrink } from './hypoCompress';

const base = {
  players: ['Alice', 'Bob'], deck: [{ suitIndex: 0, rank: 1 }, { suitIndex: 0, rank: 2 }],
  actions: [{ type: 0, target: 0 }, { type: 1, target: 1, value: 2 }],
  options: { variant: 'No Variant' }, notes: [], characters: [], id: 0, seed: 'abc-def',
};

test('hypoCompress matches compatibility vectors and keeps seed hyphens', () => {
  const compressed = shrink(JSON.stringify(base));
  expect(compressed).toBeDefined();
  expect(compressed?.endsWith(',abc-def')).toBe(true);
  expect(compressed).toBe('212ab,01aahb,0,abc-def');
  expect(JSON.parse(expand(compressed ?? '') ?? 'null')).toEqual(base);
  const wrapped = { ...base, deck: Array.from({ length: 60 }, (_, i) => ({ suitIndex: i % 5, rank: i % 5 + 1 })) };
  expect(shrink(JSON.stringify(wrapped))).toContain('-');
  expect(JSON.parse(expand(shrink(JSON.stringify(wrapped)) ?? '') ?? 'null')).toEqual(wrapped);
});

function state(overrides: Record<string, unknown> = {}): State {
  return {
    finished: true,
    metadata: { playerNames: ['Real Name', 'Other Player'], options: { variantName: 'No Variant' }, seed: 'seed-1' },
    cardIdentities: [{ suitIndex: 0, rank: 1 }, { suitIndex: 1, rank: 2 }],
    replay: { segment: 5, actions: [
      { type: 'play', order: 0 }, { type: 'discard', order: 1, failed: false },
      { type: 'discard', order: 0, failed: true },
      { type: 'clue', clue: { type: ClueType.Color, value: 2 }, target: 1 },
      { type: 'clue', clue: { type: ClueType.Rank, value: 3 }, target: 0 },
      { type: 'play', order: 1 },
    ], hypothetical: null },
    ...overrides,
  } as unknown as State;
}

test('exports anonymized minimal JSON, full deck, conversions, truncation and canonical URL', () => {
  const result = createReplayExport(state(), 'https://hanab.live');
  expect(result.ok).toBe(true);
  if (!result.ok) return;
  const data = JSON.parse(result.json);
  expect(data.players).toEqual(['Alice', 'Bob']);
  expect(data.options).toEqual({ variant: 'No Variant' });
  expect(data.deck).toEqual([{ suitIndex: 0, rank: 1 }, { suitIndex: 1, rank: 2 }]);
  expect(data.actions).toEqual([
    { type: 0, target: 0 }, { type: 1, target: 1 }, { type: 0, target: 0 },
    { type: 2, target: 1, value: 2 }, { type: 3, target: 0, value: 3 },
  ]);
  expect(data.seed).toBe('seed-1');
  expect(result.url).toMatch(/^https:\/\/hanab\.live\/shared-replay-json\//);
});

test('applies morph identities, removes seed for morph and JSON source', () => {
  const hypothetical = { morphedIdentities: [{ suitIndex: 2, rank: 4 }, { suitIndex: null, rank: null }], actions: [] };
  const morph = createReplayExport(state({ replay: { segment: 1, actions: [{ type: 'play', order: 0 }], hypothetical } }), 'https://hanab.live');
  expect(morph.ok && JSON.parse(morph.json).deck[0]).toEqual({ suitIndex: 2, rank: 4 });
  expect(morph.ok && JSON.parse(morph.json).seed).toBe('');
  const jsonSeed = createReplayExport(state({ metadata: { playerNames: ['A', 'B'], options: { variantName: 'No Variant' }, seed: 'JSON' }, replay: { segment: 1, actions: [{ type: 'play', order: 0 }], hypothetical: null } }), 'https://hanab.live');
  expect(jsonSeed.ok && JSON.parse(jsonSeed.json).seed).toBe('');
});

test('appends retained typed hypothetical actions and rejects unavailable identities or empty actions', () => {
  // The reducer's hypoBack removes actions after the retained state length. The exporter consumes
  // that retained typed action array directly instead of reconstructing actions from log text.
  const retained = { morphedIdentities: [], actions: [
    { type: 'play', order: 0 }, { type: 'clue', clue: { type: ClueType.Rank, value: 2 }, target: 1 },
  ], stateActionLengths: [0, 2] };
  const result = createReplayExport(state({ replay: { segment: 1, actions: [{ type: 'play', order: 0 }], hypothetical: retained } }), 'https://hanab.live');
  expect(result.ok && JSON.parse(result.json).actions).toEqual([
    { type: 0, target: 0 }, { type: 0, target: 0 }, { type: 3, target: 1, value: 2 },
  ]);
  expect(createReplayExport(state({ cardIdentities: [{ suitIndex: null, rank: null }] }), 'https://hanab.live')).toMatchObject({ ok: false });
  expect(createReplayExport(state({ replay: { segment: 0, actions: [], hypothetical: null } }), 'https://hanab.live')).toMatchObject({ ok: false });
});
