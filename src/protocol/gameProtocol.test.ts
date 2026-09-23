import { describe, expect, test } from '@jest/globals';

import { decodeServerFrame } from './lobbyProtocol';
import {
  encodeGetGameInfo1Frame,
  encodeGetGameInfo2Frame,
  encodeLoadedFrame,
  encodePlayFrame,
  encodeDiscardFrame,
  encodeColorClueFrame,
  encodeRankClueFrame,
  gameInitSchema,
  cardIdentitiesSchema,
  finishOngoingGameSchema,
  gameHistorySchema,
  encodeNoteFrame,
  encodePauseFrame,
} from './gameProtocol';
import { makeInit } from './gameProtocol.fixtures';

describe('pinned game bootstrap protocol', () => {
  test('strictly decodes shared replay efficiency modifier updates', () => {
    expect(decodeServerFrame('replayEfficiencyMod {"tableID":123,"mod":2}')).toEqual({
      kind: 'event',
      event: { command: 'replayEfficiencyMod', data: { tableID: 123, mod: 2 } },
    });
    expect(decodeServerFrame('replayEfficiencyMod {"tableID":-1,"mod":2}'))
      .toMatchObject({ kind: 'malformed', command: 'replayEfficiencyMod' });
    expect(decodeServerFrame('replayEfficiencyMod {"tableID":123,"mod":2.5}'))
      .toMatchObject({ kind: 'malformed', command: 'replayEfficiencyMod' });
    expect(decodeServerFrame('replayEfficiencyMod {"tableID":123,"mod":2,"extra":true}'))
      .toMatchObject({ kind: 'malformed', command: 'replayEfficiencyMod' });
  });

  test('encodes the exact info and player-presence handshake frames', () => {
    expect(encodeGetGameInfo1Frame(123)).toBe('getGameInfo1 {"tableID":123}');
    expect(encodeGetGameInfo2Frame(123)).toBe('getGameInfo2 {"tableID":123}');
    expect(encodeLoadedFrame(123)).toBe('loaded {"tableID":123}');
  });

  test('strictly decodes clock and pause and encodes exact pause settings', () => {
    expect(decodeServerFrame(
      'clock {"tableID":123,"times":[120000,90000],"activePlayerIndex":1,"timeTaken":456}',
    )).toMatchObject({ kind: 'event', event: { command: 'clock' } });
    expect(decodeServerFrame(
      'pause {"tableID":123,"active":true,"playerIndex":1}',
    )).toMatchObject({ kind: 'event', event: { command: 'pause' } });
    expect(decodeServerFrame(
      'clock {"tableID":123,"times":[1.5],"activePlayerIndex":0,"timeTaken":0}',
    )).toMatchObject({ kind: 'malformed', command: 'clock' });
    expect(decodeServerFrame(
      'pause {"tableID":123,"active":false,"playerIndex":-1,"extra":true}',
    )).toMatchObject({ kind: 'malformed', command: 'pause' });
    for (const setting of ['pause', 'unpause', 'pause-queue', 'pause-unqueue'] as const) {
      expect(encodePauseFrame(123, setting)).toBe(
        `pause {"tableID":123,"setting":"${setting}"}`,
      );
    }
  });

  test('validates paused seats and accepts the unpaused server sentinel', () => {
    expect(gameInitSchema.safeParse(makeInit({ paused: true, pausePlayerIndex: 1 })).success)
      .toBe(true);
    expect(gameInitSchema.safeParse(makeInit({ paused: true, pausePlayerIndex: -1 })).success)
      .toBe(false);
    expect(gameInitSchema.safeParse(makeInit({ paused: true, pausePlayerIndex: 2 })).success)
      .toBe(false);
    expect(gameInitSchema.safeParse(makeInit({ paused: false, pausePlayerIndex: -1 })).success)
      .toBe(true);
  });

  test('encodes exact typed Play, Discard, Color Clue, and Rank Clue action frames', () => {
    expect(encodePlayFrame(123, 17)).toBe(
      'action {"tableID":123,"type":0,"target":17}',
    );
    expect(encodeDiscardFrame(123, 17)).toBe(
      'action {"tableID":123,"type":1,"target":17}',
    );
    expect(encodeColorClueFrame(123, 1, 0)).toBe(
      'action {"tableID":123,"type":2,"target":1,"value":0}',
    );
    expect(encodeRankClueFrame(123, 1, 3)).toBe(
      'action {"tableID":123,"type":3,"target":1,"value":3}',
    );
  });

  test('encodes an exact bounded note frame', () => {
    expect(encodeNoteFrame(123, 17, 'r1')).toBe(
      'note {"tableID":123,"order":17,"note":"r1"}',
    );
    expect(() => encodeNoteFrame(123, 17, 'x'.repeat(301))).toThrow();
  });

  test('validates the complete init shape and its metadata cardinality', () => {
    expect(gameInitSchema.parse(makeInit()).tableID).toBe(123);
    expect(gameInitSchema.safeParse(makeInit({ playerNames: ['Ada'] })).success).toBe(false);
    expect(gameInitSchema.safeParse(makeInit({ ourPlayerIndex: 2 })).success).toBe(false);
  });

  test('accepts scrubbed identities unchanged and rejects malformed history', () => {
    const hidden = { type: 'draw', playerIndex: 0, order: 0, suitIndex: -1, rank: -1 };
    expect(decodeServerFrame(`gameActionList ${JSON.stringify({ tableID: 123, list: [hidden] })}`))
      .toEqual({
        kind: 'event',
        event: { command: 'gameActionList', data: { tableID: 123, list: [hidden] } },
      });
    expect(decodeServerFrame('gameActionList {"tableID":123,"list":[{"type":"draw"}]}'))
      .toMatchObject({ kind: 'malformed', command: 'gameActionList' });
    expect(decodeServerFrame('init {"tableID":123}'))
      .toMatchObject({ kind: 'malformed', command: 'init' });
  });

  test('validates exact pinned Go postgame payloads with string timestamps', () => {
    const historyItem = {
      id: 456,
      options: makeInit().options,
      seed: 'p2v0s1',
      score: 24,
      numTurns: 17,
      endCondition: 1,
      datetimeStarted: '2026-09-01T10:00:00Z',
      datetimeFinished: '2026-09-01T10:12:00Z',
      numGamesOnThisSeed: 3,
      playerNames: ['Ada', 'Bob'],
      incrementNumGames: true,
      tags: '',
    };
    expect(gameHistorySchema.parse([historyItem])).toEqual([historyItem]);
    expect(gameHistorySchema.safeParse({ list: [historyItem] }).success).toBe(false);
    expect(gameHistorySchema.safeParse([{
      ...historyItem,
      datetimeFinished: new Date('2026-09-01T10:12:00Z'),
    }]).success).toBe(false);

    expect(cardIdentitiesSchema.parse({
      tableID: 123,
      cardIdentities: [{ suitIndex: 0, rank: 1 }],
    })).toEqual({ tableID: 123, cardIdentities: [{ suitIndex: 0, rank: 1 }] });
    expect(finishOngoingGameSchema.parse({
      tableID: 123,
      databaseID: 456,
      sharedReplayLeader: 'Ada',
    })).toEqual({ tableID: 123, databaseID: 456, sharedReplayLeader: 'Ada' });
  });
});
