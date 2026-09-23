import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const screen = readFileSync(resolve(__dirname, 'HistoryScreen.tsx'), 'utf8');

describe('History screen source contract', () => {
  test('offers Friends history only for authoritative friends and uses its independent pages', () => {
    expect(screen).toContain('session.friends.length > 0');
    expect(screen).toContain('title="My history"');
    expect(screen).toContain('title="Friends history"');
    expect(screen).toContain('lobbyRuntime.ensureFriendsHistory()');
    expect(screen).toContain('history.friendItems');
    expect(screen).toContain('history.friendPendingRequest');
    expect(screen).toContain('history.friendHasMore');
    expect(screen).toContain('lobbyRuntime.loadMoreFriendsHistory() : lobbyRuntime.loadMoreHistory()');
    expect(screen).toContain('None of your friends have played any games yet.');
    expect(screen).toContain('onPress={() => onWatchReplay(item.id)}');
  });

  test('resets selection to My history on an empty friends list without auto-selecting on re-add', () => {
    expect(screen).toMatch(/useEffect\(\(\) => \{[\s\S]*?session\.friends\.length === 0[\s\S]*?selection\.friends[\s\S]*?setSelection\(\{ epoch: session\.connectionEpoch, friends: false \}\);[\s\S]*?\}, \[selection, session\.connectionEpoch, session\.friends\.length\]\);/);
    expect(screen).toContain('const showingFriends = selection.epoch === session.connectionEpoch');
    expect(screen).toContain('&& selection.friends && session.friends.length > 0;');
    const resetEffect = screen.slice(screen.indexOf('useEffect('), screen.indexOf('const showingFriends'));
    expect(resetEffect).not.toContain('ensureFriendsHistory');
    expect(screen).toContain('setSelection({ epoch: session.connectionEpoch, friends: true });');
    expect(screen).toContain('lobbyRuntime.ensureFriendsHistory();');
  });
});
