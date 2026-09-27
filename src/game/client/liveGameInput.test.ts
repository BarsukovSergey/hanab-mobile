import { describe, expect, test } from '@jest/globals';

import { parseLiveGameInput } from './liveGameInput';

describe('parseLiveGameInput', () => {
  test.each([
    'https://hanab.live/game/123',
    'https://hanab.live/game/123/',
    'https://hanab.live/game/123?foo=bar#section',
  ])('accepts %s', (value) => {
    expect(parseLiveGameInput(value)).toEqual({ kind: 'liveGame', tableID: 123 });
  });

  test.each([
    'https://hanab.live/game/0', 'https://hanab.live/game/-1',
    'https://hanab.live/game/nope', 'https://hanab.live/game/1.5',
    'https://hanab.live/game/9007199254740992', 'http://hanab.live/game/123',
    'https://evil.example/game/123', 'https://hanab.live.evil/game/123',
    'https://hanab.live:443/game/123', 'https://hanab.live/pre-game/123',
    'https://hanab.live/game/123/shadow/0', 'https://hanab.live/game/123/extra',
  ])('rejects %s', (value) => {
    expect(parseLiveGameInput(value).kind).toBe('invalid');
  });
});
