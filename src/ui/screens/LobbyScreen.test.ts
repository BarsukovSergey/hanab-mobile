import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

import { formatLobbyRoster, getLobbyFriendContext } from '../lobbyTablePresentation';

const screen = readFileSync(resolve(__dirname, 'LobbyScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');
const app = readFileSync(resolve(__dirname, '../../../App.tsx'), 'utf8').replace(/\r\n/g, '\n');

describe('lobby table details and create selector', () => {
  test('exposes compact People and Game history actions together in the hero', () => {
    expect(screen).toContain('<ActionButton compact title="People" onPress={onOpenPeople} />');
    expect(screen).toContain('<ActionButton compact title="Game history" onPress={onOpenHistory} />');
  });

  test('formats authoritative players in server order and omits an empty roster', () => {
    expect(formatLobbyRoster(['Ada', 'Bob', 'Cy'])).toBe('Ada · Bob · Cy');
    expect(formatLobbyRoster([])).toBeNull();
    expect(screen).toContain('table.players.map((name, index) =>');
  });

  test('renders roster in both manual Pregame and shared TableSection card paths', () => {
    const pregamePath = screen.slice(screen.indexOf('{pregameTables.map'), screen.indexOf('{showCreateTable'));
    const sectionPath = screen.slice(screen.indexOf('function TableSection'), screen.indexOf('const styles'));

    expect(pregamePath).toContain('<LobbyRoster table={table} friends={friends} />');
    expect(sectionPath).toContain('<LobbyRoster table={table} friends={friends} />');
    expect(screen).toContain('friendNames.has(name.toLowerCase())');
  });

  test('exposes exactly max player options 2 through 6 with selected button state', () => {
    expect(screen).toContain('const MAX_PLAYER_OPTIONS = [2, 3, 4, 5, 6] as const;');
    expect(screen).toContain('accessibilityRole="button"');
    expect(screen).toContain('accessibilityState={{ selected }}');
    expect(screen).toContain('setMaxPlayers(value)');
    expect(screen).not.toContain('stepperRow');
    expect(screen).not.toContain('stepperValue');
  });

  test('passes the selected name, maxPlayers, options, password, and bots unchanged to createTable', () => {
    expect(screen).toContain('lobbyRuntime.createTable(submittedName, maxPlayers, createOptions, tablePassword, selectedBots)');
    expect(screen).toContain("const submittedName = useSpecificSeed ? specificSeedTableName ?? '' : tableName;");
    expect(screen).toContain('const effectiveName = tableName.trim() || randomTableName?.trim() || \'\';');
    expect(screen).not.toContain('maxPlayers}v');
  });

  test('adopts a one-shot History prefill locally and leaves creation to the user', () => {
    expect(app).toContain('useState<SpecificSeedCreatePrefill | null>(null)');
    expect(app).toContain('setSpecificSeedCreatePrefill(prefill);');
    expect(app).toContain('setLocalScreen(\'lobby\');');
    expect(screen).toContain('setUseSpecificSeed(true);');
    expect(screen).toContain('setSeedSuffix(specificSeedCreatePrefill.seedSuffix);');
    expect(screen).toContain('setMaxPlayers(specificSeedCreatePrefill.maxPlayers);');
    expect(screen).toContain('setCreateOptions(specificSeedCreatePrefill.createOptions);');
    expect(screen).toContain('onSpecificSeedCreatePrefillConsumed();');
    expect(screen).toContain('setReproductionPlayerCount(specificSeedCreatePrefill.numPlayers);');
    expect(screen).toContain('To reproduce this deal, start with exactly {reproductionPlayerCount} players and keep this variant.');
    expect(screen).toContain('lobbyRuntime.createTable(submittedName, maxPlayers, createOptions, tablePassword, selectedBots)');
    expect(screen).not.toContain('lobbyRuntime.createTable(submittedName, maxPlayers, createOptions, tablePassword, selectedBots);');
    expect(app).not.toContain('dispatch(specificSeedCreatePrefill');
  });

  test('manual reproduction edits clear only the History hint and a later prefill restores it', () => {
    expect(screen).toContain('setSeedSuffix(value);\n                      setReproductionPlayerCount(null);');
    expect(screen).toContain('setMaxPlayers(value);\n                          setReproductionPlayerCount(null);');
    expect(screen).toContain('setCreateOptions(options);\n                setReproductionPlayerCount(null);');
    expect(screen).toContain('if (enabled) setReproductionPlayerCount(null);');
    expect(screen).toContain('setReproductionPlayerCount(specificSeedCreatePrefill.numPlayers);');
    expect(screen).toContain('value={seedSuffix}');
    expect(screen).toContain('options={createOptions} onChange={(options) => {');
    expect(screen).toContain('maxPlayers === value');
  });

  test('keeps ordinary and seed drafts local and exposes only the active name field', () => {
    expect(screen).toContain("const [useSpecificSeed, setUseSpecificSeed] = useState(false);");
    expect(screen).toContain("const [seedSuffix, setSeedSuffix] = useState('');");
    expect(screen).toContain('title={useSpecificSeed ? \'Use specific seed: On\' : \'Use specific seed\'}');
    const seedFieldStart = screen.lastIndexOf('<Field', screen.indexOf('placeholder="Seed suffix"'));
    const seedFieldEnd = screen.indexOf('/>', screen.indexOf('placeholder="Seed suffix"')) + 2;
    const seedField = screen.slice(seedFieldStart, seedFieldEnd);
    expect(seedField).toContain('autoCapitalize="none"');
    expect(seedField).toContain('autoCorrect={false}');
    expect(seedField).toContain('spellCheck={false}');
    expect(seedField).not.toContain('maxLength');
    expect(screen).toContain('specificSeedTableName !== null');
    expect(screen).toContain('disabled={attendancePending || !createNameIsValid}');
    expect(screen).toContain('placeholder={randomTableName ?? \'Table name\'} value={tableName}');
    expect(screen).toContain('actual player count and variant when the game starts.');
    expect(screen).toContain('disabled={attendancePending || !createNameIsValid}');
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
    expect(screen).toContain('effectiveName.length >= 1 && effectiveName.length <= 45');
    expect(screen).toContain("setTablePassword('');");
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
