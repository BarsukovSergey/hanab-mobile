import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@jest/globals';

const screen = readFileSync(resolve(__dirname, 'PeopleScreen.tsx'), 'utf8');
const profile = readFileSync(resolve(__dirname, 'ProfileScreen.tsx'), 'utf8');

test('occupied room leaves browsing available and blocks only conflicting Profile table entry', () => {
  expect(screen).toContain('onPress={() => onProfile(row.user.name)}');
  expect(screen).not.toContain('disabled={roomOccupied}');
  expect(profile).toMatch(/title=\{tableAction\.label\} disabled=\{roomOccupied\}[\s\S]*?if \(roomOccupied\) return;[\s\S]*?lobbyRuntime\.spectate\(tableAction\.tableID\)/);
  expect(profile).toContain('<UserContextActions');
  expect(profile).not.toContain('sendPrivateMessage');
});

test('local known-user search and compact rows use a single column with wide-row landscape', () => {
  expect(screen).toContain("const [search, setSearch] = useState('')");
  expect(screen).toContain('getPeopleSections(rows, search)');
  expect(screen).toContain('const wideRows = availableWidth > availableHeight');
  expect(screen).toContain('wideRows && styles.wideRow');
  expect(screen).toContain('wideRows && styles.wideToolbar');
  expect(screen).not.toMatch(/numColumns|columnWrapperStyle|Messages|sessionPrivateMessages/);
});
