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

  test('shared Dialog shows session messages and sends in context while keeping friends unchanged', () => {
    expect(shared).toContain('open?: boolean');
    expect(shared).toContain('onOpenChange?: (open: boolean) => void');
    expect(shared).toContain('maxLength={300}');
    expect(shared).toContain('title="Dialog"');
    expect(shared).toContain('sessionPrivateMessages(messagesByRoom, authenticatedUsername, username)');
    expect(shared).toContain('chatRuntime.sendPrivateMessage(username, message, room)');
    expect(shared).toContain('chatRuntime.setFriend(username, !isFriend, room)');
    expect(shared).toContain('if (chatRuntime.sendPrivateMessage(username, message, room)) setMessage(\'\')');
    expect(shared).not.toContain('setIsFriend');
  });

  test('composer is a full-width sibling below compact actions in both screens', () => {
    const actionsIndex = shared.indexOf('<View style={styles.actions}>');
    const composerIndex = shared.indexOf('{composing && (');
    expect(actionsIndex).toBeGreaterThanOrEqual(0);
    expect(composerIndex).toBeGreaterThan(actionsIndex);
    expect(shared.slice(actionsIndex, composerIndex)).toContain('<ActionButton compact title="Dialog"');
    expect(shared.slice(composerIndex)).toContain('<View style={styles.composer}>');
    expect(shared.slice(composerIndex)).toContain('<ScrollView style={[styles.transcript');
    expect(shared).toContain("root: { alignSelf: 'stretch', gap: 8, width: '100%' }");
    expect(shared).toContain("composer: { alignSelf: 'stretch', gap: 8, width: '100%' }");
    expect(shared).toContain("transcript: { alignSelf: 'stretch', borderRadius: 8, borderWidth: 1, maxHeight: 240, padding: 8, width: '100%' }");
    expect(shared).toContain("messageField: { alignSelf: 'stretch', width: '100%' }");
    expect(shared).toContain('style={styles.messageField}');
    expect(profile).toContain('<UserContextActions');
    expect(people).toContain('styles.userRow');
    expect(pregame).toContain('styles.playerRow');
    expect(pregame).toContain('<UserContextActions');
    expect(pregame).not.toContain('flexDirection: \'row\', gap: 12, justifyContent: \'space-between\', paddingTop: 9');
  });
});
