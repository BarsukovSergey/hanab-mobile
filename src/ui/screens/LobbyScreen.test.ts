import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

import { formatLobbyRoster } from '../lobbyTablePresentation';

const screen = readFileSync(resolve(__dirname, 'LobbyScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('lobby table details and create selector', () => {
  test('exposes compact People and Game history actions together in the hero', () => {
    expect(screen).toContain('<ActionButton compact title="People" onPress={onOpenPeople} />');
    expect(screen).toContain('<ActionButton compact title="Game history" onPress={onOpenHistory} />');
  });

  test('formats authoritative players in server order and omits an empty roster', () => {
    expect(formatLobbyRoster(['Ada', 'Bob', 'Cy'])).toBe('Ada · Bob · Cy');
    expect(formatLobbyRoster([])).toBeNull();
    expect(screen.match(/formatLobbyRoster\(table\.players\)/g)).toHaveLength(4);
  });

  test('renders roster in both manual Pregame and shared TableSection card paths', () => {
    const pregamePath = screen.slice(screen.indexOf('{pregameTables.map'), screen.indexOf('{showCreateTable'));
    const sectionPath = screen.slice(screen.indexOf('function TableSection'), screen.indexOf('const styles'));

    expect(pregamePath).toContain('formatLobbyRoster(table.players)');
    expect(sectionPath).toContain('formatLobbyRoster(table.players)');
    expect(screen).toContain('<Text numberOfLines={2} style={[styles.tableRoster');
  });

  test('exposes exactly max player options 2 through 6 with selected button state', () => {
    expect(screen).toContain('const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6] as const;');
    expect(screen).toContain('accessibilityRole="button"');
    expect(screen).toContain('accessibilityState={{ selected }}');
    expect(screen).toContain('setMaxPlayers(value)');
    expect(screen).not.toContain('stepperRow');
    expect(screen).not.toContain('stepperValue');
  });

  test('passes the selected maxPlayers unchanged to createTable', () => {
    expect(screen).toContain('lobbyRuntime.createTable(tableName, maxPlayers, createOptions, tablePassword, selectedBots)');
  });

  test('uses authoritative friends for compact table context and running progress', () => {
    expect(screen).toContain('state.session.friends');
    expect(screen).toContain('getLobbySections(tables, friends)');
    expect(screen).toContain('getLobbyFriendContext(table, friends)');
    expect(screen).toContain('<TableFriendContext table={table} friends={friends} />');
    expect(screen).toContain("if (!context.hasFriends) return null;");
    expect(screen).toContain('table.running ? ` · ${table.progress}%`');
    expect(screen).toContain('title="Return to game"');
    expect(screen).toContain('title="Join"');
    expect(screen).toContain('title="Spectate pregame"');
    expect(screen).toContain('title="Spectate"');
    expect(screen).toContain('title="Open review"');
    expect(screen).toContain('title="Create table"');
  });

  test('uses the server name as the blank field placeholder and permits blank create', () => {
    expect(screen).toContain('state.session.randomTableName');
    expect(screen).toContain("placeholder={randomTableName ?? 'Table name'}");
    expect(screen).toContain("const effectiveName = tableName.trim() || randomTableName?.trim() || '';");
    expect(screen).toContain('effectiveName.length < 1 || effectiveName.length > 45');
    expect(screen).toContain("setTablePassword('');");
  });
});
