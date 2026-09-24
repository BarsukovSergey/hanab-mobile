import { readFileSync } from 'node:fs';
import { describe, expect, test } from '@jest/globals';
import {
  freeBotSlots,
  isBotAtTable,
  isBotOnline,
  isBotPickerDisabled,
  isBotAvailableForTable,
  knownBots,
} from './knownBots';

describe('known bots', () => {
  test('contains exactly 19 unique account names with open-table support only', () => {
    expect(knownBots).toHaveLength(19);
    expect(knownBots.map((bot) => bot.username)).toEqual([
      'jabot1', 'jabot2', 'jabot3', 'jabot4',
      'michiel-bot-1', 'michiel-bot-2',
      'potato_bot_1', 'potato_bot_2', 'potato_bot_3', 'potato_bot_4',
      'ser1_bot', 'ser2_bot', 'ser3_bot', 'ser4_bot',
      'will-bot1', 'will-bot2', 'will-bot4', 'will-bot67', 'will-bot69',
    ]);
    expect(new Set(knownBots.map((bot) => bot.username.toLowerCase())).size).toBe(19);
    expect(knownBots.every((bot) => !bot.passwordJoin)).toBe(true);
  });

  test('uses current names, roster, and free seats for picker eligibility', () => {
    expect(isBotOnline('JABOT1', [{ name: 'jabot1' }])).toBe(true);
    expect(isBotOnline('jabot2', [{ name: 'jabot1' }])).toBe(false);
    expect(isBotAtTable('Jabot1', [{ name: 'jabot1' }])).toBe(true);
    expect(freeBotSlots(5, 2)).toBe(3);
    expect(freeBotSlots(5, 5)).toBe(0);
  });

  test('keeps selected bots enabled for removal after becoming ineligible', () => {
    expect(isBotPickerDisabled(false, false, false)).toBe(true);
    expect(isBotPickerDisabled(true, false, false)).toBe(false);
    expect(isBotPickerDisabled(false, true, true)).toBe(true);
  });

  test('protected tables make every bot unavailable regardless of metadata', () => {
    expect(isBotAvailableForTable(true, false, true)).toBe(false);
    expect(isBotAvailableForTable(true, false, false)).toBe(true);
  });

  test('bot:add checks case-insensitive duplicates before writing', () => {
    const source = readFileSync('tools/add-bot.mjs', 'utf8');
    expect(source).toContain('keys.includes(username.toLowerCase())');
    expect(source).not.toContain('--password-join');
    expect(source).toContain('passwordJoin: false');
    expect(source.indexOf('keys.includes(username.toLowerCase())')).toBeLessThan(source.indexOf('writeFileSync(registryPath, updated)'));
  });
});
