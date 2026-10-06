import { readFileSync } from 'node:fs';
import { describe, expect, test } from '@jest/globals';
import { getRoomChildBackDecision, getRoomChildTitle, isRoomProfileChild, type RoomChild, type RoomChildBackDecision } from './roomChildPresentation';

const profile: RoomChild = { kind: 'profile', username: 'Alice', origin: 'menu-participants' };

describe('room child Back policy', () => {
  test.each([
    [profile, { kind: 'profile-origin', origin: 'menu-participants' }],
    ['tag', { kind: 'open-child', child: 'menu-tools' }],
    ['replay-export', { kind: 'open-child', child: 'menu-tools' }],
    ['menu-participants', { kind: 'open-child', child: 'menu' }],
    ['menu-perspective', { kind: 'open-child', child: 'menu' }],
    ['menu-tools', { kind: 'open-child', child: 'menu' }],
    ['menu', { kind: 'close' }],
    ['chat', { kind: 'chat' }],
    ['settings', { kind: 'settings' }],
    [null, { kind: 'open-child', child: 'menu' }],
  ] satisfies Array<[RoomChild, RoomChildBackDecision]>)('classifies %j without executing effects', (child, expected) => {
    expect(getRoomChildBackDecision(child)).toEqual(expected);
  });
});

test('identifies only the room-owned Profile shape', () => {
  expect(isRoomProfileChild(profile)).toBe(true);
  for (const child of [null, 'chat', 'menu', 'menu-participants', 'menu-perspective', 'menu-tools', 'settings', 'tag', 'replay-export'] satisfies RoomChild[]) {
    expect(isRoomProfileChild(child)).toBe(false);
  }
});

describe('contextual panel titles', () => {
  test.each([
    ['menu-participants', 'Participants / spectators'],
    [profile, 'Alice'],
    ['menu-perspective', 'Perspective'],
    ['menu-tools', 'Tags / replay tools'],
    ['tag', 'Add tag'],
    ['replay-export', 'Export replay'],
  ] satisfies Array<[Parameters<typeof getRoomChildTitle>[0], string]>)('preserves the title for %j', (child, title) => {
    expect(getRoomChildTitle(child, 'Game menu')).toBe(title);
  });

  test.each(['Table menu', 'Game menu', 'Review menu'])('receives the existing dynamic %s', (menuTitle) => {
    expect(getRoomChildTitle('menu', menuTitle)).toBe(menuTitle);
  });
});

test('App consumes pure room policy and retains child rendering and imperative Back effects', () => {
  const app = readFileSync('App.tsx', 'utf8').replace(/\r\n/g, '\n');
  const policy = readFileSync('src/ui/roomChildPresentation.ts', 'utf8');
  const back = app.slice(app.indexOf('const closeRoomChild ='), app.indexOf("BackHandler.addEventListener"));
  expect(app).toContain("from './src/ui/roomChildPresentation'");
  expect(app).toContain('useState<RoomChild>(null)');
  expect(app).toContain('const renderRoomChildren =');
  expect(app).toContain('{isRoomProfileChild(roomChild) ?');
  expect(app).toContain('getRoomChildTitle(roomChild, workspacePresentation.menuTitle)');
  expect(back).toContain('const decision = getRoomChildBackDecision(roomChild);');
  expect(back).toMatch(/decision.kind === 'profile-origin'\) \{\s*Keyboard.dismiss\(\);\s*setRoomChild\(decision.origin\);/);
  expect(back).toMatch(/decision.kind === 'chat'\) \{\s*if \(keyboardOpen.current \|\| Keyboard.isVisible\(\)\) Keyboard.dismiss\(\);\s*else setRoomChild\(null\);/);
  expect(back).toContain("else if (decision.kind === 'settings') settingsBackRef.current?.();");
  expect(back).toContain("else if (decision.kind === 'open-child') setRoomChild(decision.child);");
  expect(back).toContain('else closeRoomChild();');
  expect(back).toContain('const closeRoomChild = () => { Keyboard.dismiss(); setRoomChild(null); };');
  expect(policy).not.toMatch(/import |Keyboard|Ref|setRoomChild|lobbyRuntime|chatRuntime|<View/);
});


test('room Conversation Back restores its exact Profile or mounted Pregame origin', () => {
  const profile = { kind: 'profile' as const, username: 'Bob', origin: 'menu-participants' as const };
  expect(getRoomChildBackDecision({ kind: 'conversation', username: 'Bob', origin: profile }))
    .toEqual({ kind: 'conversation-origin', origin: profile });
  expect(getRoomChildBackDecision(profile)).toEqual({ kind: 'profile-origin', origin: 'menu-participants' });
  expect(getRoomChildBackDecision({ kind: 'conversation', username: 'Bob', origin: null }))
    .toEqual({ kind: 'conversation-origin', origin: null });
});
