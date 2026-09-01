import { describe, expect, test } from '@jest/globals';

import {
  decodeServerFrame,
  encodeTableCreateFrame,
  encodeTableReattendFrame,
  encodeTableJoinFrame,
  encodeTableLeaveFrame,
  encodeTableSpectateFrame,
  encodeTableStartFrame,
} from './lobbyProtocol';

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

  test('encodes the exact ordinary spectate command', () => {
    expect(encodeTableSpectateFrame(123)).toBe(
      'tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}',
    );
  });

  test('encodes exact spectator recovery and player reattend commands', () => {
    expect(encodeTableSpectateFrame(123, 1)).toBe(
      'tableSpectate {"tableID":123,"shadowingPlayerIndex":1}',
    );
    expect(encodeTableReattendFrame(123)).toBe('tableReattend {"tableID":123}');
  });

  test('encodes the exact join and leave commands', () => {
    expect(encodeTableJoinFrame(123)).toBe('tableJoin {"tableID":123}');
    expect(encodeTableLeaveFrame(123)).toBe('tableLeave {"tableID":123}');
  });

  test('encodes exact basic table create and start commands', () => {
    expect(encodeTableCreateFrame('  Mobile table  ', 6, 'Rainbow (6 Suits)')).toBe(
      'tableCreate {"name":"Mobile table","password":"","maxPlayers":6,'
      + '"variant":"Rainbow (6 Suits)","timed":false,"timeBase":0,"timePerTurn":0,'
      + '"speedrun":false,"cardCycle":false,"deckPlays":false,"emptyClues":false,'
      + '"oneExtraCard":false,"oneLessCard":false,"allOrNothing":false,'
      + '"detrimentalCharacters":false}',
    );
    expect(encodeTableStartFrame(123, ['Ada', 'Bob'])).toBe(
      'tableStart {"tableID":123,"intendedPlayers":["Ada","Bob"]}',
    );
  });

  test('rejects invalid create and start command input', () => {
    expect(() => encodeTableCreateFrame(' ', 5, 'No Variant')).toThrow();
    expect(() => encodeTableCreateFrame('x'.repeat(46), 5, 'No Variant')).toThrow();
    expect(() => encodeTableCreateFrame('Table', 1, 'No Variant')).toThrow();
    expect(() => encodeTableCreateFrame('Table', 5, 'Clue Starved')).toThrow();
    expect(() => encodeTableStartFrame(123, ['Ada'])).toThrow();
  });

  test('validates exact joined, left, and minimal pregame payloads', () => {
    expect(decodeServerFrame('joined {"tableID":123}')).toEqual({
      kind: 'event',
      event: { command: 'joined', data: { tableID: 123 } },
    });
    expect(decodeServerFrame('left {"TableID":123}')).toEqual({
      kind: 'event',
      event: { command: 'left', data: { TableID: 123 } },
    });
    expect(decodeServerFrame(
      'game {"tableID":123,"name":"Table","owner":7,'
      + '"players":[{"index":0,"name":"Ada","you":true,"present":true,"stats":{}}],'
      + '"options":{"variantName":"No Variant","future":true},'
      + '"passwordProtected":false,"maxPlayers":5}',
    )).toEqual({
      kind: 'event',
      event: {
        command: 'game',
        data: {
          tableID: 123,
          name: 'Table',
          owner: 7,
          players: [{ index: 0, name: 'Ada', you: true, present: true }],
          options: { variantName: 'No Variant' },
          passwordProtected: false,
          maxPlayers: 5,
        },
      },
    });

    for (const frame of [
      'joined {"tableID":"123"}',
      'left {"tableID":123}',
      'game {"tableID":123}',
    ]) {
      expect(decodeServerFrame(frame)).toMatchObject({
        kind: 'malformed',
        issue: 'invalid-payload',
      });
    }
  });

  test('validates the pinned tableStart payload', () => {
    expect(decodeServerFrame('tableStart {"tableID":123,"replay":false}')).toEqual({
      kind: 'event',
      event: {
        command: 'tableStart',
        data: { tableID: 123, replay: false },
      },
    });
    expect(decodeServerFrame('tableStart {"tableID":123}')).toEqual({
      kind: 'malformed',
      command: 'tableStart',
      issue: 'invalid-payload',
    });
  });
});
