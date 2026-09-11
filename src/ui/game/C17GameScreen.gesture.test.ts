import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

function readC17Screen() {
  return fs.readFileSync(path.join(process.cwd(), 'src/ui/game/C17GameScreen.tsx'), 'utf8');
}

function readClueComposer() {
  return fs.readFileSync(path.join(process.cwd(), 'src/ui/game/ClueComposer.tsx'), 'utf8');
}

test('C17 wires hold-only empathy and authoritative clue-card highlighting', () => {
  const screen = readC17Screen();

  expect(screen).toContain('delayLongPress={350}');
  expect(screen).toContain('onLongPress={() => onHoldEmpathy(ourIndex)}');
  expect(screen).toContain('onLongPress={globalEmpathy ? undefined : () => onHoldEmpathy(index)}');
  expect(screen).toContain('highlighted={target && (cluePreview?.touchedOrders.includes(order) ?? false)}');
  expect(screen).toContain('if (canEnterClue) onSelectClueTarget(index);');
  const opponentRow = screen.slice(screen.indexOf('accessibilityLabel={`Player ${playerName}`}'), screen.indexOf('<View style={styles.opponentMeta}>'));
  expect(opponentRow).not.toContain('disabled={globalEmpathy}');
  expect(opponentRow).toContain('onLongPress={globalEmpathy ? undefined : () => {');
  expect((screen.match(/title=\{globalEmpathy \? 'All empathy/g) ?? []).length).toBe(2);
  expect(screen).not.toContain("title={target ? 'Clue ✓' : 'Clue'}");
  expect(screen).not.toContain("title={persistentEmpathy ? 'Emp ✓' : 'Emp'}");
  expect(screen).not.toContain('title="Normal"');
});

test('C17 keeps spectator interaction observational while retaining the workspace tools', () => {
  const screen = readC17Screen();

  expect(screen).toContain("const isPlayingPlayer = liveRoom?.role === 'player' && clientState?.playing === true;");
  expect(screen).toContain('const ourIndex = clientState?.metadata.ourPlayerIndex ?? null;');
  expect(screen).toContain('const empathyPlayers = useMemo(() => clientState?.metadata.playerNames');
  expect(screen).toContain('empathyPlayers,');
  expect(screen).toContain("isSpectator ? 'OBSERVED HAND' : 'YOUR HAND'");
  expect(screen).toContain("canPlayGameplay && current === ourIndex ? 'YOUR TURN' : currentName");
  expect(screen).toContain('if (!clueEnabled || selectedTarget === null || interaction.cluePreview === null) return;');
  expect(screen).toContain('if (isPlayingPlayer && !replay.active) {');
  expect(screen).toContain('const selectedTarget = isPlayingPlayer ? interaction.clueTarget : null;');
  expect(screen).toContain('{canPlayGameplay && selectedOwnCard !== null && <View style={styles.rowBetween}>');
});

test('ClueComposer leaves touched and invalid clues to card highlighting and disabled Give', () => {
  const composer = readClueComposer();

  expect(composer).not.toContain('Touches no cards');
  expect(composer).not.toContain('card${preview.touchedOrders.length');
  expect(composer).not.toContain('Unavailable');
});
