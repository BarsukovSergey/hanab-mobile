import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, test } from '@jest/globals';
import { knownBots } from './knownBots';

describe('known bots', () => {
  test('contains the exact 19 accounts with password join capability', () => {
    expect(knownBots).toHaveLength(19);
    expect(knownBots.map((bot) => bot.username)).toEqual([
      'jabot1', 'jabot2', 'jabot3', 'jabot4',
      'michiel-bot-1', 'michiel-bot-2',
      'potato_bot_1', 'potato_bot_2', 'potato_bot_3', 'potato_bot_4',
      'ser1_bot', 'ser2_bot', 'ser3_bot', 'ser4_bot',
      'will-bot1', 'will-bot2', 'will-bot4', 'will-bot67', 'will-bot69',
    ]);
    expect(new Set(knownBots.map((bot) => bot.username.toLowerCase())).size).toBe(19);
    expect(knownBots.every((bot) => bot.passwordJoin)).toBe(true);
  });

  test('bot:add defaults password join off, accepts the flag, and rejects duplicate casing', () => {
    const source = readFileSync('tools/add-bot.mjs', 'utf8');
    const registry = readFileSync('src/config/knownBots.ts', 'utf8');
    const executable = source.replace(/^import .*;\r?\n/gm, '')
      .replace(/^const registryPath = .*;$/m, "const registryPath = 'fixture';");
    const add = (args: string[], registrySource = registry) => {
      let written = '';
      runInNewContext(executable, {
        process: { argv: ['node', 'add-bot.mjs', ...args], exit: () => { throw new Error('rejected'); } },
        console: { error: () => undefined },
        readFileSync: () => registrySource,
        writeFileSync: (_path: string, value: string) => { written = value; },
      });
      return written;
    };
    expect(add(['fresh_bot'])).toContain("username: 'fresh_bot', passwordJoin: false");
    expect(add(['fresh_bot', '--password-join'])).toContain("username: 'fresh_bot', passwordJoin: true");
    expect(() => add(['JABOT1'])).toThrow('rejected');
  });

  test('preserves CRLF when updating a CRLF registry', () => {
    const source = readFileSync('tools/add-bot.mjs', 'utf8');
    const registry = readFileSync('src/config/knownBots.ts', 'utf8');
    const crlfRegistry = registry.replace(/\r?\n/g, '\r\n');
    const executable = source.replace(/^import .*;\r?\n/gm, '')
      .replace(/^const registryPath = .*;$/m, "const registryPath = 'fixture';");
    let updated = '';
    runInNewContext(executable, {
      process: { argv: ['node', 'add-bot.mjs', 'fresh_bot'], exit: () => { throw new Error('rejected'); } },
      console: { error: () => undefined },
      readFileSync: () => crlfRegistry,
      writeFileSync: (_path: string, value: string) => { updated = value; },
    });

    expect(updated).toContain("\r\n  { username: 'fresh_bot', passwordJoin: false },\r\n");
    expect(updated).not.toMatch(/(?<!\r)\n/);
  });
});
