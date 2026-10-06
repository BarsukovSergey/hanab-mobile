import { describe, expect, test } from '@jest/globals';
import { parseHistoryReplayInput } from './historyReplayInput';

describe('History Open Replay input', () => {
  test.each(['solo', 'shared'] as const)('opens a database ID with the explicit %s choice', (visibility) => {
    expect(parseHistoryReplayInput(' 123 ', visibility, false)).toEqual({ kind: 'id', databaseID: 123, visibility });
  });
  test.each(['0', '9007199254740992', '-1', '1.5'])('rejects invalid database ID %s', (input) => {
    expect(parseHistoryReplayInput(input, 'solo', false).kind).toBe('invalid');
  });
  test('preserves link visibility and existing compressed replay support', () => {
    expect(parseHistoryReplayInput('https://hanab.live/shared-replay/123', 'solo', false))
      .toEqual({ kind: 'id', databaseID: 123, visibility: 'shared' });
    expect(parseHistoryReplayInput('https://hanab.live/replay/123', 'shared', false))
      .toEqual({ kind: 'id', databaseID: 123, visibility: 'solo' });
    expect(parseHistoryReplayInput('https://hanab.live/replay-json/211,00,0', 'shared', false))
      .toMatchObject({ kind: 'json', visibility: 'solo', gameJSON: { seed: '' } });
  });
  test.each(['solo', 'shared'] as const)('requires Advanced for raw JSON with the %s choice', (visibility) => {
    expect(parseHistoryReplayInput('{"actions":[]}', visibility, false)).toMatchObject({ kind: 'invalid' });
    expect(parseHistoryReplayInput('{"actions":[]}', visibility, true))
      .toEqual({ kind: 'json', gameJSON: { actions: [] }, visibility });
    expect(parseHistoryReplayInput('[]', visibility, true).kind).toBe('invalid');
    expect(parseHistoryReplayInput('4', visibility, true).kind).toBe('invalid');
  });
  test('retains parser errors for invalid links', () => {
    expect(parseHistoryReplayInput('https://example.com/replay/1', 'solo', false))
      .toEqual({ kind: 'invalid', reason: 'Replay links must use https://hanab.live.' });
  });
});
