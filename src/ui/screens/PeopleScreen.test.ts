import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const screen = readFileSync(resolve(__dirname, 'PeopleScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');

test('occupied room blocks only table spectate, with a handler guard', () => {
  expect(screen).toContain('roomOccupied: boolean');
  expect(screen).toContain('rows.some((row) => row.tableAction !== null)');
  expect(screen).toContain('Return to the current room before spectating another table.');
  expect(screen).toMatch(/title=\{tableAction\.label\}[\s\S]*?disabled=\{roomOccupied\}[\s\S]*?if \(roomOccupied\) return;[\s\S]*?lobbyRuntime\.spectate\(tableAction\.tableID\)/);
  expect(screen).toContain('<UserContextActions');
  expect(screen).not.toContain('<UserContextActions\n                  disabled=');
});
