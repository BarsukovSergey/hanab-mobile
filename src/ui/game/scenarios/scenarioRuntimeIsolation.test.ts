import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), ...relativePath.split('/')), 'utf8');
}

test('every production gameplay-screen runtime call is covered by the scenario-gallery command gate', () => {
  const gameplayScreens = [
    read('src/ui/game/GameScreen.tsx'),
    read('src/ui/game/C17GameScreen.tsx'),
    read('src/ui/game/LegacyGameScreen.tsx'),
  ].join('\n');
  const application = read('src/runtime/application.ts');

  const runtimeCalls = [...gameplayScreens.matchAll(/\blobbyRuntime\.([A-Za-z0-9_]+)\s*\(/g)]
    .flatMap((match) => match[1] === undefined ? [] : [match[1]]);
  const gateMatch = application.match(/createRuntimeCommandGate\(rawLobbyRuntime,\s*\[([\s\S]*?)\]\s*\)/);
  expect(gateMatch).not.toBeNull();
  const blockedMethods = [...(gateMatch?.[1] ?? '').matchAll(/['"]([A-Za-z0-9_]+)['"]/g)]
    .flatMap((match) => match[1] === undefined ? [] : [match[1]]);

  expect([...new Set(runtimeCalls)].sort()).toEqual([...new Set(blockedMethods)].sort());
  expect(application).toContain('suppressGameplayRuntimeCommands');
});

test('Hypothetical Edit cards is a persistent controller-only interaction mode', () => {
  const screen = read('src/ui/game/C17GameScreen.tsx');
  const selection = screen.slice(
    screen.indexOf('onSelectCard={(order) => {'),
    screen.indexOf('onSelectClueTarget=', screen.indexOf('onSelectCard={(order) => {')),
  );
  const lifecycle = screen.slice(
    screen.indexOf('if (!canHypotheticalControl) {'),
    screen.indexOf('\n  }, [canHypotheticalControl, hypotheticalOperationPending]);', screen.indexOf('if (!canHypotheticalControl) {')),
  );

  expect(screen).toContain('title={editHypotheticalCards ? \'Done editing\' : \'Edit cards\'}');
  expect(screen).toContain('if (!editHypotheticalCards) interactionDispatch({ type: \'disarm-gameplay\' });');
  expect(screen).toContain('setEditHypotheticalCards((active) => !active);');
  expect(selection).toMatch(/if \(!presentationVisible\) return;\s*if \(editHypotheticalCards\) \{\s*if \(canHypotheticalControl && !hypotheticalOperationPending\) setMorphOrder\(order\);\s*return;/);
  expect(selection).toContain("interactionDispatch({ type: 'select-card', order });");
  expect(selection).toContain('inspectNote(order);');
  expect(screen).toContain('const selectedCard = currentGameLoad && presentationVisible && !editHypotheticalCards && (isPlayingPlayer || canHypotheticalControl) ? interaction.selectedCard : null;');
  expect(screen).toContain('const selectedTarget = currentGameLoad && presentationVisible && (isPlayingPlayer || canHypotheticalControl) ? interaction.clueTarget : null;');
  expect(screen).toContain('const activeSelectedTarget = editHypotheticalCards ? null : selectedTarget;');
  expect(screen).toContain('canHypotheticalControl && !editHypotheticalCards && hypotheticalActor !== null');
  expect(screen).toContain('<ActionButton compact disabled={!canPlayCard} title="Play" tone="primary" onPress={onPlay} />');
  expect(screen).toContain('<ActionButton compact disabled={!canDiscardCard} title="Discard" onPress={onDiscard} />');
  expect(screen).toContain('onPress: () => editHypotheticalCards ? onSelectCard(order) : onInspectNote(order)');
  expect(screen).toContain('onPress={() => editHypotheticalCards ? onSelectCard(order) : onInspectNote(order)}');
  expect(screen).toContain('hypotheticalController ? <View style={styles.actionButtons}>');
  expect(lifecycle).toContain('if (!canHypotheticalControl) {\n      setEditHypotheticalCards(false);');
  expect(lifecycle).toMatch(/\} else if \(hypotheticalOperationPending\) \{\s*setMorphOrder\(null\);/);
  expect(lifecycle.slice(lifecycle.indexOf('else if'))).not.toContain('setEditHypotheticalCards(false)');
});
