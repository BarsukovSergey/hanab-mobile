import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

import { formatLobbyRoster, getLobbyFriendContext } from '../lobbyTablePresentation';

const screen = readFileSync(resolve(__dirname, 'LobbyScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('Home catalog', () => {
  test('shows Create and Open game link with an explanation when creation is unavailable', () => {
    expect(screen).toContain('title="Create" disabled={!showCreateTable} onPress={onCreate}');
    expect(screen).toContain('title="Open game link"');
    expect(screen).toContain('Create is unavailable while you have a running game to rejoin.');
    expect(screen).not.toContain('title="People"');
    expect(screen).not.toContain('title="Game history"');
    expect(screen).not.toContain('lobbyRuntime.createTable(');
  });

  test('stacks the hero copy above actions on narrow screens', () => {
    expect(screen).toContain('<Panel style={[styles.hero, !wide && styles.heroNarrow]}>');
    expect(screen).toContain('<View style={[styles.heroCopy, !wide && styles.heroCopyNarrow]}>');
    expect(screen).toContain('<View style={[styles.heroActions, !wide && styles.heroActionsNarrow]}>');
    expect(screen).toContain("heroNarrow: { alignItems: 'stretch', flexDirection: 'column', gap: 12 }");
    expect(screen).toContain("heroCopyNarrow: { flex: 0 }");
    expect(screen).toContain("heroActionsNarrow: { alignSelf: 'stretch', justifyContent: 'flex-start' }");
  });

  test('formats authoritative players in server order and omits an empty roster', () => {
    expect(formatLobbyRoster(['Ada', 'Bob', 'Cy'])).toBe('Ada · Bob · Cy');
    expect(formatLobbyRoster([])).toBeNull();
    expect(screen).toContain('table.players.map((name, index) =>');
  });

  test('renders roster in both manual Pregame and shared TableSection card paths', () => {
    const pregamePath = screen.slice(screen.indexOf('{pregameTables.map'), screen.indexOf('</Panel>', screen.indexOf('{pregameTables.map')));
    const sectionPath = screen.slice(screen.indexOf('function TableSection'), screen.indexOf('const styles'));

    expect(pregamePath).toContain('<LobbyRoster table={table} friends={friends} />');
    expect(sectionPath).toContain('<LobbyRoster table={table} friends={friends} />');
    expect(screen).toContain('friendNames.has(name.toLowerCase())');
  });

  test('uses authoritative friends for compact table context and running progress', () => {
    expect(screen).toContain('state.session.friends');
    expect(screen).toContain('getLobbySections(tables, friends)');
    expect(screen).toContain('getLobbyFriendContext(table, friends)');
    expect(screen).toContain('<TableFriendContext table={table} friends={friends} />');
    expect(screen).toContain('friendContext.hasFriends && styles.friendTableCard');
    expect(screen).toContain("'Friends here' : 'Friend here'");
    expect(screen).toContain('new Set([...friendContext.playing, ...friendContext.watching]');
    const replayWithPlayer = {
      id: 1, name: 'Replay', numPlayers: 1, maxPlayers: 5, running: true, variant: 'No Variant',
      options: { variantName: 'No Variant', timed: false, timeBase: 0, timePerTurn: 0, speedrun: false,
        cardCycle: false, deckPlays: false, emptyClues: false, oneExtraCard: false, oneLessCard: false,
        allOrNothing: false, detrimentalCharacters: false },
      passwordProtected: false, joined: false, progress: 31, players: ['Friend'],
      spectators: [], sharedReplay: true,
    };
    expect(getLobbyFriendContext(replayWithPlayer, ['friend']).hasFriends).toBe(false);
    expect(getLobbyFriendContext({
      ...replayWithPlayer,
      spectators: [{ name: 'FRIEND', shadowingPlayerIndex: -1, shadowingPlayerUsername: '' }],
    }, ['friend']).hasFriends).toBe(true);
    expect(screen).toContain("if (!context.hasFriends) return null;");
    expect(screen).toContain('table.running ? ` · ${table.progress}%`');
    expect(screen).toContain('title="Rejoin game"');
    expect(screen).toContain('title="Join"');
    expect(screen).toContain('title="Spectate pregame"');
    expect(screen).toContain('title="Spectate"');
    expect(screen).toContain('title="Open review"');
  });

  test('offers game and pregame links, secure pregame password, and local feedback', () => {
    expect(screen).toContain('title="Open game link"');
    expect(screen).toContain('title="Paste from clipboard"');
    expect(screen).toContain('title="Open game"');
    expect(screen).toContain('title="Cancel"');
    expect(screen).toContain('parseLiveGameInput(liveGameLink)');
    expect(screen).toContain('lobbyRuntime.openLiveGameByID(parsed.tableID)');
    expect(screen).toContain('lobbyRuntime.openPregameByID(parsed.tableID, liveGameLinkPassword || undefined)');
    expect(screen).toContain('secureTextEntry');
    expect(screen).toContain('Enter the table password.');
    expect(screen).toContain('That pregame table is not currently available to join.');
    expect(screen).toContain("setLiveGameLinkPassword('')");
    expect(screen).toContain('That running table is not currently available to open.');
    expect(screen).toContain('Clipboard is empty.');
    expect(screen).toContain('Could not read the clipboard.');
    expect(screen).toContain('clipboard.readClipboard()');
  });
});
