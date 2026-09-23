import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

function readC17Screen() {
  return fs.readFileSync(path.join(process.cwd(), 'src/ui/game/C17GameScreen.tsx'), 'utf8').replace(/\r\n/g, '\n');
}

function readClueComposer() {
  return fs.readFileSync(path.join(process.cwd(), 'src/ui/game/ClueComposer.tsx'), 'utf8');
}

test('C17 wires hold-only empathy and authoritative clue preview markers', () => {
  const screen = readC17Screen();

  expect(screen).toContain('delayLongPress={350}');
  expect(screen).toContain('onLongPress={() => onHoldEmpathy(seatingAnchorIndex)}');
  expect(screen).toContain('onLongPress: globalEmpathy ? undefined : () => onHoldEmpathy(index)');
  expect(screen).toContain('previewMarker: target && (cluePreview?.touchedOrders.includes(order) ?? false)');
  expect(screen).toContain('getPreviewClueMarker(cluePreviewState, card.numPositiveClues, clueChoices)');
  expect(screen).toContain('styles.opponentCards, usesSideLabelRows && styles.sideLabelCards, { marginTop: 2 + layout.cardTopHeadroom }');
  expect(screen).toContain('styles.ownCards, usesSideLabelRows && styles.sideLabelCards, { marginTop: 2 + layout.cardTopHeadroom }');
  expect(screen).toContain('if (canEnterClue && !isActionHand) onSelectClueTarget(index);');
  const opponentStart = screen.indexOf('accessibilityLabel={`Player ${playerName}`}');
  const opponentRow = screen.slice(opponentStart, opponentStart + 1000);
  expect(opponentRow).not.toContain('disabled={globalEmpathy}');
  expect(opponentRow).toContain('onLongPress={globalEmpathy ? undefined : () => {');
  expect(opponentRow).toContain('onPressIn={() => { longPressedOpponent.current = null; }}');
  expect((screen.match(/title=\{globalEmpathy \? 'All empathy/g) ?? []).length).toBe(0);
  expect(screen).toContain("title={globalEmpathy ? 'Empathy ✓' : 'Empathy'}");
  expect(screen).not.toContain("title={target ? 'Clue ✓' : 'Clue'}");
  expect(screen).not.toContain("title={persistentEmpathy ? 'Emp ✓' : 'Emp'}");
  expect(screen).not.toContain('title="Normal"');
});

test('C17 uses summaries only for compact opponents while retaining full own cards', () => {
  const screen = readC17Screen();

  expect(screen).toContain("import { CompactHandCardSummary, GameCard, VisibleHanabiCard } from './GameCard';");
  expect(screen).toContain('? <CompactHandCardSummary key={order} {...cardProps} />');
  expect(screen).toContain('<VisibleHanabiCard {...cardProps} cardTopHeadroom={layout.cardTopHeadroom} size="hand" />');
  expect(screen).not.toContain("size={compact ? 'mini' : 'hand'}");
  expect(screen).toContain('height={layout.ownCardHeight}');
  expect(screen).toContain('clueMarker: getCommittedClueMarkerForMetadata(committedClue, order, card.numPositiveClues, metadata)');
  expect(screen).toContain('previewMarker: target && (cluePreview?.touchedOrders.includes(order) ?? false)');
  expect(screen).toContain('onDoublePress: readOnlyReplay || hypothetical !== null ? undefined : () => onEditNote(order)');
  expect(screen).toContain('onLongPress: globalEmpathy ? undefined : () => onHoldEmpathy(index)');
});

test('C17 ordinary note inspector keeps note controls without card-number labels or knowledge details', () => {
  const screen = readC17Screen();
  const ordinaryWorkbench = screen.slice(screen.indexOf('</> : selectedTarget !== null ? <ClueComposer'));

  expect(screen).toContain('title="Edit note"');
  expect(ordinaryWorkbench).not.toContain('CardKnowledgeDetails knowledge={inspectedKnowledge}');
  expect(screen).not.toContain('>{getCardLabel(');
});

test('C17 ordinary note actions never duplicate selected and inspected card editors', () => {
  const screen = readC17Screen();
  const ordinaryWorkbench = screen.slice(screen.indexOf('{canPlayGameplay && selectedActionCard !== null && <View style={styles.actionButtons}>'));

  expect(ordinaryWorkbench).toContain('{(noteCard === null || noteCard === selectedActionCard) && <ActionButton compact title="Edit note" onPress={() => onEditNote(selectedActionCard)} />}');
  expect(ordinaryWorkbench).toContain('{noteCard !== selectedActionCard && <View style={styles.rowBetween}>');
  expect(ordinaryWorkbench).toContain('<ActionButton compact title="Edit note" onPress={() => onEditNote(noteCard)} />');
  expect(ordinaryWorkbench).toContain('<ActionButton compact disabled={!canPlayCard} title="Play" tone="primary" onPress={onPlay} />');
  expect(ordinaryWorkbench).toContain('<ActionButton compact disabled={!canDiscardCard} title="Discard" onPress={onDiscard} />');
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
  expect(screen).toContain('const seatingAnchorIndex = clientState?.metadata.ourPlayerIndex ?? null;');
  expect(screen).toContain('const empathyPlayers = useMemo(() => clientState?.metadata.playerNames');
  expect(screen).toContain('empathyPlayers,');
  expect(screen).toContain("isSpectator ? 'OBSERVED' : usesSideLabelRows ? 'YOU' : 'YOUR HAND'");
  expect(screen).toContain("canPlayGameplay && current === seatingAnchorIndex ? 'YOUR TURN' : currentName");
  expect(screen).toContain('if (!clueEnabled || selectedTarget === null || interaction.cluePreview === null) return;');
  expect(screen).toContain('if ((isPlayingPlayer && !replay.active) || canHypotheticalControl) {');
  expect(screen).toContain('const selectedTarget = isPlayingPlayer || canHypotheticalControl ? interaction.clueTarget : null;');
  expect(screen).toContain('{canPlayGameplay && selectedActionCard !== null && <View style={styles.actionButtons}>');
});

test('C17 uses ordinary side labels without confusing the current actor with a clue target', () => {
  const screen = readC17Screen();
  const lastAction = screen.slice(screen.indexOf('<View style={[styles.rowBetween, styles.lastActionHeader]}>'), screen.indexOf('</View></AuthoritativePulse>', screen.indexOf('<View style={[styles.rowBetween, styles.lastActionHeader]>')));

  expect(screen).toContain('const usesSideLabels = opponents.length <= 2;');
  expect(screen).toContain('const usesDenseSideLabels = opponents.length >= 3;');
  expect(screen).toContain('const usesCompactWorkbench = usesSideLabels;');
  expect(screen).toContain("{playerName}{!usesSideLabelRows && currentActor ? ' · TURN' : ''}");
  expect(screen).toContain('currentActorDot');
  expect(screen).toContain('currentActor && (usesSideLabelRows');
  expect(screen).toContain('borderColor: theme.colors.accent');
  expect(screen).toContain('target && { borderColor: theme.colors.accent }');
  expect(lastAction).toContain("title={globalEmpathy ? 'Empathy ✓' : 'Empathy'}");
  expect(lastAction).toContain('title="Rewind"');
});

test('C17 reserves the ordinary Workbench slot while keeping a selected-card tray content-sized', () => {
  const screen = readC17Screen();

  expect(screen).toContain('const compactOrdinaryWorkbench = usesCompactWorkbench');
  expect(screen).toContain('compactCappedWorkbench ? { height: layout.workbenchHeight }');
  expect(screen).toContain('compactWorkbenchReserve');
  expect(screen).toContain('compactWorkbenchTray');
  expect(screen).toContain("compactWorkbenchTray: { alignSelf: 'stretch'");
  expect(screen).toContain("flex: 0, flexGrow: 0");
});

test('C17 caps every side-label stateful Workbench mode at the stable physical slot', () => {
  const screen = readC17Screen();

  expect(screen).toContain('const compactCappedWorkbench = usesCompactWorkbench && (compactOrdinaryWorkbench');
  expect(screen).toContain('|| hypothetical !== null || reviewActive || finishedReplay || sharedReplay !== null);');
  expect(screen).toContain('compactCappedWorkbench ? { height: layout.workbenchHeight }');
  expect(screen).toContain('styles.workbenchScroll');
  expect(screen).toContain('<C17RewindScrubber actionSegments={actionSegments} onSelectSegment={onScrubAction} selectedSegment={selectedActionSegment} />');
  expect(screen).toContain('title="← Back"');
  expect(screen).toContain('title="Forward →"');
  expect(screen).toContain('title={`Exit · Live T${liveTurn}`}');
  expect(screen).toContain('title="Start Hypothetical"');
  expect(screen).toContain('getC17WorkbenchHeight(viewportHeight, opponents.length)');
});

test('C17 gives Play and Discard separate eligibility at maximum clue tokens', () => {
  const screen = readC17Screen();

  expect(screen).toContain('canDiscardForVariant,');
  expect(screen).toContain('const discardEnabled = cardEnabled\n    && canDiscardForVariant(game.clueTokens, metadata.options.variantName);');
  expect(screen).toContain('canPlayCard={cardEnabled}');
  expect(screen).toContain('canDiscardCard={discardEnabled}');
  expect(screen).toContain('canPlayCard: boolean;');
  expect(screen).toContain('canDiscardCard: boolean;');
  expect((screen.match(/disabled=\{!canPlayCard\} title="Play"/g) ?? []).length).toBe(2);
  expect((screen.match(/disabled=\{!canDiscardCard\} title="Discard"/g) ?? []).length).toBe(2);
  expect(screen).toContain('if (discardEnabled && selectedCard !== null) {');
  expect(screen).not.toContain('canCommitCard');
});

test('C17 permits shared replay Hypothetical start for the replay leader', () => {
  const screen = readC17Screen();
  const canStartHypothetical = screen.slice(
    screen.indexOf('const canStartHypothetical'),
    screen.indexOf('\n\n  return <>', screen.indexOf('const canStartHypothetical')),
  );

  expect(canStartHypothetical).toContain('replay.shared === null || replay.shared.amLeader');
  expect(canStartHypothetical).not.toContain('replay.shared.useSharedSegments');
  expect(canStartHypothetical).not.toContain('game.turn.currentPlayerIndex !== null');
});

test('ClueComposer leaves touched and invalid clues to card highlighting and disabled Give', () => {
  const composer = readClueComposer();

  expect(composer).not.toContain('Touches no cards');
  expect(composer).not.toContain('card${preview.touchedOrders.length');
  expect(composer).not.toContain('Unavailable');
  expect(composer).toContain('isCluePreviewConfirmable(preview, allowEmptyClues, variantName)');
});

test('C17 renders authoritative live clocks only for an eligible timed live game', () => {
  const screen = readC17Screen();
  const eligibility = screen.slice(screen.indexOf('const liveClock ='), screen.indexOf('const latest ='));
  const clockComponent = screen.slice(screen.indexOf('function C17LiveClockText'), screen.indexOf('\n\nfunction HudStat'));

  expect(screen).toContain('getDisplayedClockString,');
  expect(screen).toContain('type LiveClock,');
  expect(eligibility).toContain('metadata.options.timed === true');
  expect(eligibility).toContain('!clientState.finished');
  expect(eligibility).toContain('!replay.active');
  expect(eligibility).toContain('!hypotheticalActive');
  expect(eligibility).toContain('!liveRoom.sharedReplay');
  expect(eligibility).toContain('ongoingGame.turn.currentPlayerIndex !== null');
  expect(eligibility).toContain('liveRoom.clock !== null');
  expect(screen).toContain('clockPaused={clientState.pause.active}');
  expect(screen).toContain('<C17LiveClockText\n                  clock={liveClock}\n                  paused={clockPaused}\n                  playerIndex={index}');
  expect(screen).toContain('<C17LiveClockText\n            clock={liveClock}\n            paused={clockPaused}\n            playerIndex={seatingAnchorIndex}');
  expect(clockComponent).toContain('getDisplayedClockString(clock, playerIndex, paused, now)');
  expect(clockComponent).toContain('if (paused) return undefined;');
  expect(clockComponent).toContain('setInterval(() => setNow(Date.now()), 1000)');
  expect(screen).not.toContain("from './LegacyGameScreen'");
});
