import { describe, expect, test } from '@jest/globals';

import { decodeServerFrame } from './lobbyProtocol';

const user = {
  userID: 7,
  name: 'Ada Lovelace',
  status: 0,
  hyphenated: false,
  inactive: false,
};

describe('lobby protocol decoder', () => {
  test('decodes a normal JSON frame', () => {
    expect(decodeServerFrame(`user ${JSON.stringify(user)}`)).toEqual({
      kind: 'event',
      event: { command: 'user', data: user },
    });
  });

  test('preserves spaces inside the JSON payload', () => {
    const result = decodeServerFrame(`warning ${JSON.stringify({ warning: 'two words here' })}`);
    expect(result).toEqual({
      kind: 'event',
      event: { command: 'warning', data: { warning: 'two words here' } },
    });
  });

  test('decodes an array payload', () => {
    const result = decodeServerFrame(`userList ${JSON.stringify([user])}`);
    expect(result.kind).toBe('event');
    if (result.kind === 'event') expect(result.event.data).toEqual([user]);
  });

  test('accepts an unknown payloadless command as out-of-scope traffic', () => {
    expect(decodeServerFrame('ping')).toEqual({ kind: 'unknown', command: 'ping' });
  });

  test('reports malformed JSON for a known command', () => {
    expect(decodeServerFrame('userList [')).toEqual({
      kind: 'malformed',
      command: 'userList',
      issue: 'malformed-json',
    });
  });

  test('ignores an unknown command safely', () => {
    expect(decodeServerFrame('futureCommand {"value":1}')).toEqual({
      kind: 'unknown',
      command: 'futureCommand',
    });
  });

  test('rejects a malformed known command', () => {
    expect(decodeServerFrame('user {"userID":7}')).toEqual({
      kind: 'malformed',
      command: 'user',
      issue: 'invalid-payload',
    });
  });

  test('tolerates and strips additive unknown fields', () => {
    const result = decodeServerFrame(`user ${JSON.stringify({ ...user, future: { nested: true } })}`);
    expect(result).toEqual({ kind: 'event', event: { command: 'user', data: user } });
  });
});
