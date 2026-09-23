import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const read = (name: string) => readFileSync(resolve(__dirname, name), 'utf8').replace(/\r\n/g, '\n');
const people = read('PeopleScreen.tsx');
const pregame = read('PregameScreen.tsx');
const shared = read('../UserContextActions.tsx');

describe('player context actions', () => {
  test('People uses the shared actions while keeping Spectate in People', () => {
    expect(people).toContain('const [composerUserID, setComposerUserID] = useState<number | null>(null)');
    expect(people).toContain('open={composerUserID === row.user.userID}');
    expect(people).toContain('onOpenChange={(open) => setComposerUserID(open ? row.user.userID : null)}');
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
    expect(shared).toContain('root: { gap: 8 }');
    expect(people).toContain('<UserContextActions');
    expect(people).toContain('styles.userRow');
    expect(pregame).toContain('styles.playerRow');
    expect(pregame).toContain('<UserContextActions');
    expect(pregame).not.toContain('flexDirection: \'row\', gap: 12, justifyContent: \'space-between\', paddingTop: 9');
  });
});
