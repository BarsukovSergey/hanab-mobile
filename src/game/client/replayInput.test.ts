import { describe, expect, test } from '@jest/globals';
import { parseReplayInput } from './replayInput';

describe('parseReplayInput', () => {
  test.each(['solo', 'shared'] as const)('parses raw object JSON as %s', (visibility) => {
    expect(parseReplayInput(' {"x":1} ', visibility)).toEqual({ kind: 'json', gameJSON: { x: 1 }, visibility });
  });
  test.each(['[]', 'null', '4', '"x"'])('rejects JSON %s', (input) => {
    expect(parseReplayInput(input, 'solo').kind).toBe('invalid');
  });
  test.each([
    ['https://hanab.live/replay/123', 123, 'solo'],
    ['https://hanab.live/shared-replay/123', 123, 'shared'],
  ])('parses ID routes', (url, databaseID, visibility) => {
    expect(parseReplayInput(url, 'solo')).toEqual({ kind: 'id', databaseID, visibility });
  });
  test.each(['0', '-1', 'nope', '1.5'])('rejects replay ID %s', (id) => {
    expect(parseReplayInput(`https://hanab.live/replay/${id}`, 'solo').kind).toBe('invalid');
  });
  test('rejects foreign hosts and noncanonical routes', () => {
    expect(parseReplayInput('https://evil.example/replay/1', 'solo').kind).toBe('invalid');
    expect(parseReplayInput('https://hanab.live.evil/replay/1', 'solo').kind).toBe('invalid');
    expect(parseReplayInput('https://hanab.live/game/1', 'solo').kind).toBe('invalid');
  });
  test('expands compressed JSON with route visibility and legacy absent seed', () => {
    const compressed = '211,00,0';
    const solo = parseReplayInput(`https://hanab.live/replay-json/${compressed}`, 'shared');
    const shared = parseReplayInput(`https://hanab.live/shared-replay-json/${compressed}`, 'solo');
    expect(solo.kind).toBe('json');
    expect(solo).toMatchObject({ visibility: 'solo', gameJSON: { seed: '' } });
    expect(shared).toMatchObject({ visibility: 'shared', gameJSON: { seed: '' } });
  });
  test('rejects invalid compressed data and does not invert JSON visibility', () => {
    expect(parseReplayInput('https://hanab.live/replay-json/not-a-replay', 'shared')).toMatchObject({ kind: 'invalid' });
    expect(parseReplayInput('https://hanab.live/replay-json/211,00,0', 'shared')).toMatchObject({ kind: 'json', visibility: 'solo' });
  });
});
