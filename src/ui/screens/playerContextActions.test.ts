import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const read = (name: string) => readFileSync(resolve(__dirname, name), 'utf8').replace(/\r\n/g, '\n');
const people = read('PeopleScreen.tsx');
const pregame = read('PregameScreen.tsx');
const shared = read('../UserContextActions.tsx');

describe('player context actions', () => {
  test('People uses the shared actions while keeping Spectate in People', () => {
    expect(people).toContain('<UserContextActions username={row.user.name} isFriend={row.isFriend} />');
    expect(people).toContain('lobbyRuntime.spectate(tableAction.tableID)');
    expect(people).not.toContain('chatRuntime.sendPrivateMessage');
    expect(people).not.toContain('chatRuntime.setFriend');
  });

  test('Pregame exposes actions only for other players using authoritative friends and table context', () => {
    expect(pregame).toContain('{!player.you && (');
    expect(pregame).toContain('<UserContextActions');
    expect(pregame).toContain('session.friends.some((friend) => friend.toLowerCase() === player.name.toLowerCase())');
    expect(pregame).toContain('room={`table${room.tableID}`}');
  });

  test('shared component sends in context, limits messages, and updates friends without optimistic state', () => {
    expect(shared).toContain('maxLength={300}');
    expect(shared).toContain('chatRuntime.sendPrivateMessage(username, message, room)');
    expect(shared).toContain('chatRuntime.setFriend(username, !isFriend, room)');
    expect(shared).toContain('if (chatRuntime.sendPrivateMessage(username, message, room)) closeComposer()');
    expect(shared).not.toContain('setIsFriend');
  });
});
