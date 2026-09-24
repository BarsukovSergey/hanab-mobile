import { readFileSync } from 'node:fs';
import { describe, expect, test } from '@jest/globals';
import { freeBotSlots, isBotAtTable, isBotOnline, knownBots } from './knownBots';

describe('known bots', () => {
  test('contains exactly 19 unique account names with open-table support only', () => {
    expect(knownBots).toHaveLength(19);
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

  test('bot:add checks case-insensitive duplicates before writing', () => {
    const source = readFileSync('tools/add-bot.mjs', 'utf8');
    expect(source).toContain('keys.includes(username.toLowerCase())');
    expect(source.indexOf('keys.includes(username.toLowerCase())')).toBeLessThan(source.indexOf('writeFileSync(registryPath, updated)'));
  });
});
