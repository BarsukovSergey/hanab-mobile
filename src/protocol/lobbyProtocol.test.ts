import { describe, expect, test } from '@jest/globals';

import {
  decodeServerFrame,
  encodeCardPresentationSettingFrame,
  encodeChatFrame,
  encodeInactiveFrame,
  encodeHistoryGetFrame,
  encodeGetNameFrame,
  encodeReplayCreateFrame,
  encodeReplayActionFrame,
  encodeReplayHypoActionFrame,
  encodeReplayHypoBackFrame,
  encodeReplayHypoEndFrame,
  encodeReplayHypoStartFrame,
  encodeReplayHypoToggleRevealedFrame,
  encodeTableRestartFrame,
  encodeTableSetLeaderFrame,
  encodeTableUpdateFrame,
  encodeTableCreateFrame,
  encodeTableReattendFrame,
  encodeTableJoinFrame,
  encodeTableLeaveFrame,
  encodeTableSpectateFrame,
  encodeTableStartFrame,
  encodeTableUnattendFrame,
} from './lobbyProtocol';

const user = {
  userID: 7,
  name: 'Ada Lovelace',
  status: 0,
  hyphenated: false,
  inactive: false,
};

describe('lobby protocol decoder', () => {
  test('retains the welcome random name and decodes the next server name', () => {
    expect(decodeServerFrame('welcome {"userID":1,"username":"Ada","totalGames":0,"playingAtTables":[],"randomTableName":"Lucky Stars"}')).toMatchObject({
      kind: 'event', event: { command: 'welcome', data: { randomTableName: 'Lucky Stars' } },
    });
    expect(decodeServerFrame('name {"name":"Next Name"}')).toEqual({
      kind: 'event', event: { command: 'name', data: { name: 'Next Name' } },
    });
    expect(encodeGetNameFrame()).toBe('getName');
  });
  test('parses presentation settings, tolerates other settings, and defaults absent settings', () => {
    expect(decodeServerFrame(
      'welcome {"userID":1,"username":"Ada","totalGames":12,"playingAtTables":[],"settings":{"colorblindMode":true,"styleNumbers":false,"sounds":true}}',
    )).toMatchObject({
      kind: 'event',
      event: {
        command: 'welcome',
        data: { settings: { colorblindMode: true, styleNumbers: false, sounds: true } },
      },
    });
    expect(decodeServerFrame(
      'welcome {"userID":1,"username":"Ada","totalGames":12,"playingAtTables":[]}',
    )).toMatchObject({
      kind: 'event',
      event: {
        command: 'welcome',
        data: { settings: { colorblindMode: false, styleNumbers: false } },
      },
    });
  });

  test('encodes exact supported presentation setting frames', () => {
    expect(encodeCardPresentationSettingFrame('colorblindMode', true)).toBe(
      'setting {"name":"colorblindMode","setting":"true"}',
    );
    expect(encodeCardPresentationSettingFrame('styleNumbers', false)).toBe(
      'setting {"name":"styleNumbers","setting":"false"}',
    );
  });

  test('retains required totalGames and encodes exact C15 commands', () => {
    expect(decodeServerFrame(
      'welcome {"userID":1,"username":"Ada","totalGames":12,"playingAtTables":[]}',
    )).toMatchObject({
      kind: 'event', event: { command: 'welcome', data: { totalGames: 12 } },
    });
    expect(decodeServerFrame(
      'welcome {"userID":1,"username":"Ada","playingAtTables":[]}',
    )).toMatchObject({ kind: 'malformed', command: 'welcome' });
    expect(encodeHistoryGetFrame(10)).toBe('historyGet {"offset":10,"amount":10}');
    expect(encodeReplayCreateFrame(77)).toBe(
      'replayCreate {"source":"id","databaseID":77,"visibility":"solo"}',
    );
  });
  test('validates exact pinned chat and chatList payloads', () => {
    const chat = {
      msg: 'hello &amp; goodbye',
      who: 'Ada',
      discord: false,
      server: false,
      datetime: '2026-09-01T10:00:00Z',
      room: 'lobby',
      recipient: '',
    };
    expect(decodeServerFrame(`chat ${JSON.stringify(chat)}`)).toEqual({
      kind: 'event', event: { command: 'chat', data: chat },
    });
    expect(decodeServerFrame(`chatList ${JSON.stringify({ list: [chat], unread: 2 })}`))
      .toEqual({
        kind: 'event',
        event: { command: 'chatList', data: { list: [chat], unread: 2 } },
      });
    expect(decodeServerFrame(`chat ${JSON.stringify({ ...chat, extra: true })}`)).toMatchObject({
      kind: 'malformed', command: 'chat', issue: 'invalid-payload',
    });
    expect(decodeServerFrame(`chatList ${JSON.stringify({ list: [chat], unread: 0, extra: 1 })}`))
      .toMatchObject({ kind: 'malformed', command: 'chatList', issue: 'invalid-payload' });

    const serverChat = {
      ...chat,
      msg: '<strong>[Server Notice]</strong> Ready &amp; waiting',
      who: '',
      server: true,
    };
    expect(decodeServerFrame(`chat ${JSON.stringify(serverChat)}`)).toEqual({
      kind: 'event', event: { command: 'chat', data: serverChat },
    });
    expect(decodeServerFrame(`chat ${JSON.stringify({ ...chat, recipient: undefined })}`))
      .toMatchObject({ kind: 'malformed', command: 'chat', issue: 'invalid-payload' });
    expect(decodeServerFrame(`chat ${JSON.stringify({ ...chat, who: undefined })}`))
      .toMatchObject({ kind: 'malformed', command: 'chat', issue: 'invalid-payload' });

    const privateMessage = { ...chat, room: '', recipient: 'Bob' };
    expect(decodeServerFrame(`chat ${JSON.stringify(privateMessage)}`)).toEqual({
      kind: 'event', event: { command: 'chat', data: privateMessage },
    });
    expect(decodeServerFrame(`chat ${JSON.stringify({ ...privateMessage, recipient: '' })}`))
      .toMatchObject({ kind: 'malformed', command: 'chat', issue: 'invalid-payload' });
  });

  test('strictly decodes notes and presence and encodes inactivity', () => {
    expect(decodeServerFrame('noteListPlayer {"tableID":123,"notes":["r1",""]}'))
      .toMatchObject({ kind: 'event', event: { command: 'noteListPlayer' } });
    expect(decodeServerFrame(
      'noteList {"tableID":123,"notes":[{"name":"Ada","notes":["r1"],"isSpectator":false}]}',
    )).toMatchObject({ kind: 'event', event: { command: 'noteList' } });
    expect(decodeServerFrame(
      'note {"tableID":123,"order":0,"notes":[{"name":"Ada","text":"r1","isSpectator":true}]}',
    )).toMatchObject({ kind: 'event', event: { command: 'note' } });
    expect(decodeServerFrame('connected {"tableID":123,"list":[true,false]}'))
      .toMatchObject({ kind: 'event', event: { command: 'connected' } });
    expect(decodeServerFrame('userInactive {"userID":7,"inactive":true}'))
      .toMatchObject({ kind: 'event', event: { command: 'userInactive' } });
    expect(decodeServerFrame('connected {"tableID":123,"list":[true],"extra":1}'))
      .toMatchObject({ kind: 'malformed', command: 'connected' });
    expect(decodeServerFrame('userInactive {"userID":7,"inactive":true,"extra":1}'))
      .toMatchObject({ kind: 'malformed', command: 'userInactive' });
    expect(encodeInactiveFrame(true)).toBe('inactive {"inactive":true}');
    expect(encodeInactiveFrame(false)).toBe('inactive {"inactive":false}');
  });

  test('encodes trimmed bounded chat for exact rooms', () => {
    expect(encodeChatFrame('  hello  ', 'lobby')).toBe(
      'chat {"msg":"hello","room":"lobby"}',
    );
    expect(encodeChatFrame('table', 'table123')).toBe(
      'chat {"msg":"table","room":"table123"}',
    );
    expect(() => encodeChatFrame(' ', 'lobby')).toThrow();
    expect(() => encodeChatFrame('x'.repeat(301), 'lobby')).toThrow();
    expect(() => encodeChatFrame('hello', 'table')).toThrow();
  });

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

  test('retains complete lobby table options', () => {
    const options = {
      variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
      speedrun: false, cardCycle: false, deckPlays: false, emptyClues: false,
      oneExtraCard: false, oneLessCard: false, allOrNothing: false,
      detrimentalCharacters: false, future: true,
    };
    const table = {
      id: 12, name: 'Table', numPlayers: 2, maxPlayers: 5, running: false,
      variant: 'No Variant', options, passwordProtected: false, joined: false,
      progress: 0, players: ['Ada', 'Bob'], sharedReplay: false,
    };
    expect(decodeServerFrame(`table ${JSON.stringify(table)}`)).toMatchObject({
      kind: 'event', event: { command: 'table', data: { options } },
    });
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
    expect(encodeTableUnattendFrame(123)).toBe('tableUnattend {"tableID":123}');
  });

  test('encodes exact basic table create and start commands', () => {
    expect(encodeTableCreateFrame('  Mobile table  ', 6, 'Rainbow (6 Suits)')).toBe(
      'tableCreate {"name":"Mobile table","options":{'
      + '"variantName":"Rainbow (6 Suits)","timed":false,"timeBase":0,"timePerTurn":0,'
      + '"speedrun":false,"cardCycle":false,"deckPlays":false,"emptyClues":false,'
      + '"oneExtraCard":false,"oneLessCard":false,"allOrNothing":false,'
      + '"detrimentalCharacters":false},"password":"","maxPlayers":6}',
    );
    expect(encodeTableStartFrame(123, ['Ada', 'Bob'])).toBe(
      'tableStart {"tableID":123,"intendedPlayers":["Ada","Bob"]}',
    );
  });

  test('encodes timed create exactly and enforces every numeric bound', () => {
    const options = {
      variantName: 'No Variant', timed: true, timeBase: 120, timePerTurn: 20,
      cardCycle: false, emptyClues: false, oneExtraCard: false,
      oneLessCard: false, allOrNothing: false,
    };
    expect(encodeTableCreateFrame('Timed', 2, options)).toBe(
      'tableCreate {"name":"Timed","options":{"variantName":"No Variant",'
      + '"timed":true,"timeBase":120,"timePerTurn":20,"speedrun":false,'
      + '"cardCycle":false,"deckPlays":false,"emptyClues":false,'
      + '"oneExtraCard":false,"oneLessCard":false,"allOrNothing":false,'
      + '"detrimentalCharacters":false},"password":"","maxPlayers":2}',
    );
    for (const [field, value] of [
      ['timeBase', 1], ['timeBase', 604_800],
      ['timePerTurn', 1], ['timePerTurn', 86_400],
    ] as const) {
      expect(() => encodeTableCreateFrame('Timed', 2, { ...options, [field]: value }))
        .not.toThrow();
    }
    for (const [field, value] of [
      ['timeBase', 0], ['timeBase', 604_801], ['timeBase', 1.5],
      ['timePerTurn', 0], ['timePerTurn', 86_401], ['timePerTurn', 1.5],
    ] as const) {
      expect(() => encodeTableCreateFrame('Timed', 2, { ...options, [field]: value }))
        .toThrow();
    }
    expect(() => encodeTableCreateFrame('Untimed', 2, {
      ...options, timed: false, timeBase: 1, timePerTurn: 0,
    })).toThrow();
    expect(encodeTableCreateFrame('Untimed', 2, {
      ...options, timed: false, timeBase: 0, timePerTurn: 0,
    })).toContain('"timed":false,"timeBase":0,"timePerTurn":0');
  });

  test('encodes protected create/join and never requires password persistence', () => {
    expect(encodeTableJoinFrame(123, 'open sesame')).toBe(
      'tableJoin {"tableID":123,"password":"open sesame"}',
    );
    expect(encodeTableCreateFrame('Secret', 5, {
      variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
      cardCycle: false, emptyClues: false,
      oneExtraCard: false, oneLessCard: false, allOrNothing: false,
    }, 'swordfish')).toContain('"password":"swordfish"');
  });

  test('updates exposed options while preserving the complete authoritative option object', () => {
    expect(encodeTableUpdateFrame(123, ' Changed ', 4, {
      variantName: 'No Variant', timed: true, timeBase: 90, timePerTurn: 15,
      speedrun: true, cardCycle: false, deckPlays: true, emptyClues: false,
      oneExtraCard: false, oneLessCard: false, allOrNothing: false,
      detrimentalCharacters: true, futureOption: 'keep',
    }, {
      variantName: '6 Suits', timed: true, timeBase: 90, timePerTurn: 15,
      cardCycle: true, emptyClues: true,
      oneExtraCard: true, oneLessCard: false, allOrNothing: true,
    })).toBe(
      'tableUpdate {"tableID":123,"name":"Changed","options":{'
      + '"variantName":"6 Suits","timed":true,"timeBase":90,"timePerTurn":15,'
      + '"speedrun":true,"cardCycle":true,"deckPlays":true,"emptyClues":true,'
      + '"oneExtraCard":true,"oneLessCard":false,"allOrNothing":true,'
      + '"detrimentalCharacters":true,"futureOption":"keep"},"maxPlayers":4}',
    );
    expect(() => encodeTableUpdateFrame(123, 'Table', 5, {
      variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
      speedrun: false, cardCycle: false, deckPlays: false, emptyClues: false,
      oneExtraCard: false, oneLessCard: false, allOrNothing: false,
      detrimentalCharacters: false,
    }, {
      variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
      cardCycle: false, emptyClues: false,
      oneExtraCard: true, oneLessCard: true, allOrNothing: false,
    })).toThrow();
  });

  test('encodes leader transfer and both restart modes', () => {
    expect(encodeTableSetLeaderFrame(123, 'Bob')).toBe(
      'tableSetLeader {"tableID":123,"name":"Bob"}',
    );
    expect(encodeTableRestartFrame(123, false)).toBe(
      'tableRestart {"tableID":123,"hidePregame":false}',
    );
  });

  test('rejects invalid create and start command input', () => {
    expect(() => encodeTableCreateFrame(' ', 5, 'No Variant')).toThrow();
    expect(() => encodeTableCreateFrame('x'.repeat(46), 5, 'No Variant')).toThrow();
    expect(() => encodeTableCreateFrame('Table', 1, 'No Variant')).toThrow();
    expect(() => encodeTableCreateFrame('Table', 5, 'Clue Starved')).toThrow();
    expect(() => encodeTableStartFrame(123, ['Ada'])).toThrow();
  });

  test('validates joined and left and preserves authoritative pregame player stats', () => {
    expect(decodeServerFrame('joined {"tableID":123}')).toEqual({
      kind: 'event',
      event: { command: 'joined', data: { tableID: 123 } },
    });
    expect(decodeServerFrame('left {"TableID":123}')).toEqual({
      kind: 'event',
      event: { command: 'left', data: { TableID: 123 } },
    });
    const gameFrame = (
      'game {"tableID":123,"name":"Table","owner":7,'
      + '"players":[{"index":0,"name":"Ada","you":true,"present":true,'
      + '"stats":{"numGames":42,"variant":{"numGames":12,"averageScore":23.46,'
      + '"numStrikeouts":2,"bestScores":[{"numPlayers":2,"score":25,"modifier":1},'
      + '{"numPlayers":3,"score":24,"modifier":4294967295}]}}}],'
      + '"options":{"variantName":"No Variant","timed":false,"timeBase":0,'
      + '"timePerTurn":0,"speedrun":false,"cardCycle":false,"deckPlays":false,'
      + '"emptyClues":false,"oneExtraCard":false,"oneLessCard":false,'
      + '"allOrNothing":false,"detrimentalCharacters":false,"future":true},'
      + '"passwordProtected":false,"maxPlayers":5}'
    );
    expect(decodeServerFrame(gameFrame)).toEqual({
      kind: 'event',
      event: {
        command: 'game',
        data: {
          tableID: 123,
          name: 'Table',
          owner: 7,
          players: [{
            index: 0, name: 'Ada', you: true, present: true,
            stats: {
              numGames: 42,
              variant: {
                numGames: 12, averageScore: 23.46, numStrikeouts: 2,
                bestScores: [
                  { numPlayers: 2, score: 25, modifier: 1 },
                  { numPlayers: 3, score: 24, modifier: 4_294_967_295 },
                ],
              },
            },
          }],
          options: {
            variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0,
            speedrun: false, cardCycle: false, deckPlays: false, emptyClues: false,
            oneExtraCard: false, oneLessCard: false, allOrNothing: false,
            detrimentalCharacters: false, future: true,
          },
          passwordProtected: false,
          maxPlayers: 5,
        },
      },
    });

    expect(decodeServerFrame(gameFrame.replace('"modifier":4294967295', '"modifier":-1'))).toEqual({
      kind: 'malformed', command: 'game', issue: 'invalid-payload',
    });
    expect(decodeServerFrame(gameFrame.replace('"modifier":4294967295', '"modifier":4294967296'))).toEqual({
      kind: 'malformed', command: 'game', issue: 'invalid-payload',
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

  test('validates exact shared replay events including empty shadow username', () => {
    expect(decodeServerFrame('replaySegment {"tableID":123,"segment":7}')).toEqual({
      kind: 'event',
      event: { command: 'replaySegment', data: { tableID: 123, segment: 7 } },
    });
    expect(decodeServerFrame('replayLeader {"tableID":123,"name":"Ada"}')).toEqual({
      kind: 'event',
      event: { command: 'replayLeader', data: { tableID: 123, name: 'Ada' } },
    });
    expect(decodeServerFrame(
      'spectators {"tableID":123,"spectators":[{"name":"Ada",'
      + '"shadowingPlayerIndex":-1,"shadowingPlayerUsername":""}]}',
    )).toEqual({
      kind: 'event',
      event: {
        command: 'spectators',
        data: {
          tableID: 123,
          spectators: [{
            name: 'Ada', shadowingPlayerIndex: -1, shadowingPlayerUsername: '',
          }],
        },
      },
    });
    expect(decodeServerFrame('boot {"TableID":123}')).toEqual({
      kind: 'event', event: { command: 'boot', data: { TableID: 123 } },
    });
    expect(decodeServerFrame('boot {"tableID":123}')).toMatchObject({
      kind: 'malformed', command: 'boot', issue: 'invalid-payload',
    });
  });

  test('encodes exact replay navigation and quick-rematch commands', () => {
    expect(encodeReplayActionFrame(123, 7)).toBe(
      'replayAction {"tableID":123,"type":0,"segment":7}',
    );
    expect(encodeTableRestartFrame(123)).toBe(
      'tableRestart {"tableID":123,"hidePregame":true}',
    );
  });

  test('encodes and decodes the pinned hypothetical replay protocol exactly', () => {
    expect(encodeReplayHypoStartFrame(123)).toBe('replayAction {"tableID":123,"type":3}');
    expect(encodeReplayHypoEndFrame(123)).toBe('replayAction {"tableID":123,"type":4}');
    expect(encodeReplayHypoActionFrame(123, '{"type":"turn","num":1,"currentPlayerIndex":1}')).toBe(
      'replayAction {"tableID":123,"type":5,"actionJSON":"{\\"type\\":\\"turn\\",\\"num\\":1,\\"currentPlayerIndex\\":1}"}',
    );
    expect(encodeReplayHypoBackFrame(123)).toBe('replayAction {"tableID":123,"type":6}');
    expect(encodeReplayHypoToggleRevealedFrame(123)).toBe('replayAction {"tableID":123,"type":7}');
    expect(decodeServerFrame('hypoStart {"TableID":123}')).toMatchObject({ kind: 'event' });
    expect(decodeServerFrame('hypoStart {"tableID":123}')).toMatchObject({ kind: 'malformed' });
    expect(decodeServerFrame('hypoEnd {"TableID":123}')).toMatchObject({ kind: 'event' });
    expect(decodeServerFrame('hypoAction "{\\"type\\":\\"turn\\",\\"num\\":1,\\"currentPlayerIndex\\":1}"')).toMatchObject({
      kind: 'event', event: { command: 'hypoAction', data: { type: 'turn', num: 1 } },
    });
    expect(decodeServerFrame('hypoAction "{\\"type\\":\\"strike\\",\\"num\\":4,\\"turn\\":4,\\"order\\":0}"')).toMatchObject({
      kind: 'event', event: { command: 'hypoAction', data: { num: 4 } },
    });
    expect(decodeServerFrame(`hypoAction ${JSON.stringify('{')}`)).toMatchObject({
      kind: 'malformed', issue: 'malformed-json',
    });
    expect(decodeServerFrame(`hypoAction ${JSON.stringify('{"type":"turn","num":1,"currentPlayerIndex":1,"extra":true}')}`)).toMatchObject({
      kind: 'malformed', issue: 'invalid-payload',
    });
  });
});
