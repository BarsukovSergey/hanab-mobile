import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const read = (name: string) => readFileSync(resolve(__dirname, name), 'utf8').replace(/\r\n/g, '\n');
const people = read('PeopleScreen.tsx');
const profile = read('ProfileScreen.tsx');
const pregame = read('PregameScreen.tsx');
const shared = read('../UserContextActions.tsx');
const app = read('../../../App.tsx');

describe('player context actions', () => {
  test('People opens the shared Profile, which owns existing actions and Spectate', () => {
    expect(people).toContain('onPress={() => onProfile(row.user.name)}');
    expect(profile).toContain('<UserContextActions');
    expect(profile).toContain('lobbyRuntime.spectate(tableAction.tableID)');
    expect(profile).not.toContain('chatRuntime.sendPrivateMessage');
    expect(profile).not.toContain('chatRuntime.setFriend');
  });

  test('Pregame exposes actions only for other players using authoritative friends and table context', () => {
    expect(pregame).toContain('{!player.you && <UserContextActions');
    expect(pregame).toContain('<UserContextActions');
    expect(pregame).toContain('session.friends.some((friend) => friend.toLowerCase() === player.name.toLowerCase())');
    expect(pregame).toContain('room={`table${room.tableID}`}');
  });

  test('Game participants open Profile in the room menu chain', () => {
    expect(app).toContain("import { ProfileScreen } from './src/ui/screens/ProfileScreen'");
    expect(app).toContain('liveClientState.metadata.playerNames.map((name, index) => renderLiveUser(name, `player-${index}-${name}`))');
    expect(app).toContain('liveClientState.spectators.map((spectator, index) => renderLiveUser(spectator.name, `spectator-${index}-${spectator.name}`))');
    expect(app).toContain("kind: 'profile', username: name, origin: 'menu-participants'");
    expect(app).toContain('room={`table${liveTableID}`}');
  });

  test('Message delegates to navigation and Friend remains in the existing runtime', () => {
    expect(shared).toContain('onMessage: () => void');
    expect(shared).toContain('title="Message" onPress={onMessage}');
    expect(shared).toContain('chatRuntime.setFriend(username, !isFriend, room)');
    expect(shared).not.toMatch(/Dialog|sendPrivateMessage|messagesByRoom|ScrollView|draft|useState/);
    expect(profile).toContain('onMessage={onMessage}');
    expect(pregame).toContain('onMessage={() => onMessage(player.name)}');
  });
});
