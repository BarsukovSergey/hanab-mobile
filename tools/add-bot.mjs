import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const registryPath = fileURLToPath(new URL('../src/config/knownBots.ts', import.meta.url));
const args = process.argv.slice(2);
const check = args.length === 1 && args[0] === '--check';
const username = check ? null : args[0];
const passwordJoin = args[1] === '--password-join';
const valid = args.length === 1 || (args.length === 2 && passwordJoin);
if (!valid || (!check && (!username || !/^[A-Za-z0-9_-]+$/.test(username)))) {
  console.error('Usage: npm run bot:add -- <username> [--password-join]');
  process.exit(1);
}

const source = readFileSync(registryPath, 'utf8');
const entryPattern = /^  \{ username: '([^']+)', passwordJoin: (true|false) \},\r?$/gm;
const entries = [...source.matchAll(entryPattern)].map((match) => ({ username: match[1], passwordJoin: match[2] === 'true' }));
const keys = entries.map((entry) => entry.username.toLowerCase());
if (new Set(keys).size !== keys.length) {
  console.error('Registry contains case-insensitive duplicate usernames');
  process.exit(1);
}
if (!check) {
  if (keys.includes(username.toLowerCase())) {
    console.error(`Bot already exists: ${username}`);
    process.exit(1);
  }
  entries.push({ username, passwordJoin });
}
entries.sort((a, b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase(), 'en'));
const newline = source.includes('\r\n') ? '\r\n' : '\n';
const lines = entries.map((entry) => `  { username: '${entry.username}', passwordJoin: ${entry.passwordJoin} },`).join(newline);
const registryBlockPattern = /(export const knownBots: readonly KnownBot\[\] = \[\r?\n)[\s\S]*?(\r?\n\];)/;
const updated = source.replace(registryBlockPattern, (_match, start, end) => `${start}${lines}${end}`);
if (updated === source && !check) throw new Error('Registry update failed');
if (check) {
  if (updated !== source) {
    console.error('Registry entries are not sorted or normalized');
    process.exit(1);
  }
} else writeFileSync(registryPath, updated);
