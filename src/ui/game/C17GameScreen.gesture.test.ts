import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

function readC17Screen() {
  return fs.readFileSync(path.join(process.cwd(), 'src/ui/game/C17GameScreen.tsx'), 'utf8');
}

function readClueComposer() {
  return fs.readFileSync(path.join(process.cwd(), 'src/ui/game/ClueComposer.tsx'), 'utf8');
}

test('C17 wires hold-only empathy and authoritative clue preview markers', () => {
  const screen = readC17Screen();

  expect(screen).toContain('delayLongPress={350}');
  expect(screen).toContain('onLongPress={() => onHoldEmpathy(ourIndex)}');
  expect(screen).toContain('onLongPress: globalEmpathy ? undefined : () => onHoldEmpathy(index)');
  expect(screen).toContain('previewMarker: target && (cluePreview?.touchedOrders.includes(order) ?? false)');
  expect(screen).toContain('getPreviewClueMarker(cluePreviewState, card.numPositiveClues, clueChoices)');
  expect(screen).toContain('styles.opponentCards, { marginTop: 2 + layout.cardTopHeadroom }');
  expect(screen).toContain('styles.ownCards, { marginTop: 2 + layout.cardTopHeadroom }');
  expect(screen).toContain('if (canEnterClue) onSelectClueTarget(index);');
  const opponentStart = screen.indexOf('accessibilityLabel={`Player ${playerName}`}');
  const opponentRow = screen.slice(opponentStart, opponentStart + 1000);
  expect(opponentRow).not.toContain('disabled={globalEmpathy}');
  expect(opponentRow).toContain('onLongPress={globalEmpathy ? undefined : () => {');
  expect(opponentRow).toContain('onPressIn={() => { longPressedOpponent.current = null; }}');
  expect((screen.match(/title=\{globalEmpathy \? 'All empathy/g) ?? []).length).toBe(4);
  expect(screen).not.toContain("title={target ? 'Clue ✓' : 'Clue'}");
  expect(screen).not.toContain("title={persistentEmpathy ? 'Emp ✓' : 'Emp'}");
  expect(screen).not.toContain('title="Normal"');
});

test('C17 uses summaries only for compact opponents while retaining full own cards', () => {
  const screen = readC17Screen();

  expect(screen).toContain("import { CardKnowledgeDetails, CompactHandCardSummary, GameCard, VisibleHanabiCard } from './GameCard';");
  expect(screen).toContain('? <CompactHandCardSummary key={order} {...cardProps} />');
  expect(screen).toContain('<VisibleHanabiCard {...cardProps} cardTopHeadroom={layout.cardTopHeadroom} size="hand" />');
  expect(screen).not.toContain("size={compact ? 'mini' : 'hand'}");
  expect(screen).toContain('height={layout.ownCardHeight}');
  expect(screen).toContain('clueMarker: getCommittedClueMarkerForMetadata(committedClue, order, card.numPositiveClues, metadata)');
  expect(screen).toContain('previewMarker: target && (cluePreview?.touchedOrders.includes(order) ?? false)');
  expect(screen).toContain('onDoublePress: readOnlyReplay || hypothetical !== null ? undefined : () => onEditNote(order)');
  expect(screen).toContain('onLongPress: globalEmpathy ? undefined : () => onHoldEmpathy(index)');
});

test('C17 pulses only the compact clue target row while keeping full-card clue pulses', () => {
  const screen = readC17Screen();

  expect(screen).toContain("const clueTargetPulse = (index: number) => (");
  expect(screen).toContain("liveTransition.actionType === 'clue'");
  expect(screen).toContain('liveTransition.targetIndex === index ? livePulseSegment : null');
  expect(screen).toContain('pulseKey={compact ? (clueTargetPulse(index) ?? sourcePulse(index)) : sourcePulse(index)}');
  expect(screen).toContain('pulseKey={cluePulse(index, position)}');
  expect(screen).toContain('? <CompactHandCardSummary key={order} {...cardProps} />');
  expect(screen).not.toContain('? <AuthoritativePulse enabled={livePulseEnabled} key={order} pulseKey={cluePulse(index, position)}><CompactHandCardSummary');
});

test('C17 clears a stale opponent long-press latch across lifecycle interruption', () => {
  const screen = readC17Screen();

  expect((screen.match(/longPressedOpponent\.current = null;/g) ?? []).length).toBeGreaterThanOrEqual(4);
  expect(screen).toContain("interactionDispatch({ type: 'reset-lifecycle-transients' });");
});

test('C17 keeps spectator interaction observational while retaining the workspace tools', () => {
  const screen = readC17Screen();

  expect(screen).toContain("const isPlayingPlayer = liveRoom?.role === 'player' && clientState?.playing === true");
  expect(screen).toContain('&& !isFinishedReplay && !isSharedReplay;');
  expect(screen).toContain('const ourIndex = clientState?.metadata.ourPlayerIndex ?? null;');
  expect(screen).toContain('const empathyPlayers = useMemo(() => clientState?.metadata.playerNames');
  expect(screen).toContain('empathyPlayers,');
  expect(screen).toContain("isSpectator ? 'OBSERVED HAND' : 'YOUR HAND'");
  expect(screen).toContain("canPlayGameplay && current === ourIndex ? 'YOUR TURN' : currentName");
  expect(screen).toContain('if (!clueEnabled || selectedTarget === null || interaction.cluePreview === null) return;');
  expect(screen).toContain('if ((isPlayingPlayer && !replay.active) || canHypotheticalControl) {');
  expect(screen).toContain('const selectedTarget = isPlayingPlayer || canHypotheticalControl ? interaction.clueTarget : null;');
  expect(screen).toContain('{canPlayGameplay && selectedOwnCard !== null && <View style={styles.rowBetween}>');
});

test('ClueComposer leaves touched and invalid clues to card highlighting and disabled Give', () => {
  const composer = readClueComposer();

  expect(composer).not.toContain('Touches no cards');
  expect(composer).not.toContain('card${preview.touchedOrders.length');
  expect(composer).not.toContain('Unavailable');
});
