import { describe, expect, test } from '@jest/globals';

import {
  findKnownBotUser,
  freeBotSlots,
  getVisibleBotSections,
  isBotAvailableForTable,
  pruneBotSelection,
} from '../config/knownBots';

describe('bot picker eligibility', () => {
  const users = [
    { name: 'JaBoT1', status: 0 },
    { name: 'jabot2', status: 3 },
    { name: 'jabot3', status: 0 },
    { name: 'jabot4', status: 0 },
  ];

  test('shows current lobby accounts, groups status zero, and omits seated or offline bots', () => {
    const sections = getVisibleBotSections(users, [{ name: 'JABOT3' }]);
    expect(sections.available.map(({ bot }) => bot.username)).toEqual(['jabot1', 'jabot4']);
    expect(sections.busy.map(({ bot }) => bot.username)).toEqual(['jabot2']);
    expect(findKnownBotUser('jabot1', users)?.name).toBe('JaBoT1');
  });

  test('Busy and password-incompatible accounts cannot be selected', () => {
    expect(isBotAvailableForTable(users[1], { username: 'jabot2', passwordJoin: true }, false)).toBe(false);
    expect(isBotAvailableForTable(users[0], { username: 'future', passwordJoin: false }, true)).toBe(false);
    expect(isBotAvailableForTable(users[0], { username: 'jabot1', passwordJoin: true }, true)).toBe(true);
  });

  test('prunes stale selections and trims to reduced free-seat capacity', () => {
    expect(pruneBotSelection(['jabot1', 'jabot2', 'jabot3', 'jabot4', 'will-bot1'],
      users, [{ name: 'jabot3' }], false, freeBotSlots(2, 1))).toEqual(['jabot1']);
    expect(pruneBotSelection(['jabot1'], [], [], false, 5)).toEqual([]);
    expect(pruneBotSelection(['jabot1'], users, [], true, 5)).toEqual(['jabot1']);
    expect(pruneBotSelection(['jabot1'], users, [], true, 5,
      [{ username: 'jabot1', passwordJoin: false }])).toEqual([]);
    expect(pruneBotSelection(['jabot1', 'jabot4'], users, [], false, 0)).toEqual([]);
  });
});
