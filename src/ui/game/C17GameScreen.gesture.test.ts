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
  expect(screen).toContain('styles.opponentCards, usesSideLabelRows && styles.sideLabelCards, !portraitV2 && styles.landscapeCards, { marginTop: layout.cardTopHeadroom }');
  expect(screen).toContain('styles.ownCards, usesSideLabelRows && styles.sideLabelCards, !portraitV2 && styles.landscapeCards, { marginTop: layout.cardTopHeadroom }');
  expect(screen).toContain('if (canEnterClue && !isActionHand) takeWorkbenchTask(() => onSelectClueTarget(index));');
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

test('C17 landscape shares real hand renderers and equal allocator card heights', () => {
  const screen = readC17Screen();
  expect(screen).not.toContain('CompactHandCardSummary');
  expect(screen).not.toContain("layout.mode === 'compact-overview'");
  expect(screen).toContain('opponentCardHeight: landscapeLayout.cardHeight');
  expect(screen).toContain('ownCardHeight: landscapeLayout.cardHeight');
  expect(screen).toContain('opponents.map(renderOpponentHand)');
  expect(screen).toContain('index === seatingAnchorIndex ? renderAnchoredHand() : renderOpponentHand(index)');
  expect(screen).toContain('clueMarker: getCommittedClueMarkerForMetadata(committedClue, order, card.numPositiveClues, metadata)');
  expect(screen).toContain('previewMarker: target && (cluePreview?.touchedOrders.includes(order) ?? false)');
  expect(screen).toContain('onDoublePress: readOnlyReplay || hypothetical !== null ? undefined : () => takeWorkbenchTask(() => onEditNote(order))');
});

test('C17 ordinary note inspector keeps note controls without card-number labels or knowledge details', () => {
  const screen = readC17Screen();
  const ordinaryWorkbench = screen.slice(screen.indexOf('</> : selectedTarget !== null ? <ClueComposer'));

  expect(screen).toContain('title="Edit note"');
  expect(ordinaryWorkbench).not.toContain('CardKnowledgeDetails knowledge={inspectedKnowledge}');
  expect(screen).not.toContain('>{getCardLabel(');
});

test('C17 Note Editor title uses player context without card positions or orders', () => {
  const screen = readC17Screen();
  const cardLabel = screen.slice(screen.indexOf('function getCardLabel('), screen.indexOf('const styles = StyleSheet.create('));

  expect(screen).toContain("title={noteCard === null ? 'Card note' : getCardLabel(game, metadata.playerNames, noteCard, reverseHands)}");
  expect(cardLabel).toContain('} · Card note`');
  expect(cardLabel).toContain("return 'Card note';");
  expect(cardLabel).not.toContain('· card ${position + 1}');
  expect(cardLabel).not.toMatch(/\$\{(?:position|order)\b|card #/);
});

test('C17 ordinary note actions never duplicate selected and inspected card editors', () => {
  const screen = readC17Screen();
  const ordinaryWorkbench = screen.slice(screen.indexOf('const cardActions ='));

  expect(ordinaryWorkbench).toContain('{(noteCard === null || noteCard === selectedActionCard) && <ActionButton compact title="Edit note" onPress={() => takeWorkbenchTask(() => onEditNote(selectedActionCard))} />}');
  expect(ordinaryWorkbench).toContain('{noteCard !== selectedActionCard && <View style={styles.rowBetween}>');
  expect(ordinaryWorkbench).toContain('<ActionButton compact title="Edit note" onPress={() => takeWorkbenchTask(() => onEditNote(noteCard))} />');
  expect(ordinaryWorkbench).toContain('<ActionButton compact disabled={!canPlayCard} title="Play" tone="primary" onPress={onPlay} />');
  expect(ordinaryWorkbench).toContain('<ActionButton compact disabled={!canDiscardCard} title="Discard" onPress={onDiscard} />');
});

test('C17 real hands retain authoritative source and per-card clue pulses', () => {
  const screen = readC17Screen();
  expect(screen).toContain('pulseKey={sourcePulse(index) ?? (!portraitV2 && current === index ? actorPulse : null)}');
  expect(screen).toContain('pulseKey={cluePulse(index, position)}');
  expect(screen).toContain('liveTransition.touchedSlots.includes(position + 1)');
  expect(screen).not.toContain('CompactHandCardSummary');
});

test('C17 clears a stale opponent long-press latch across lifecycle interruption', () => {
  const screen = readC17Screen();

  expect((screen.match(/longPressedOpponent\.current = null;/g) ?? []).length).toBeGreaterThanOrEqual(4);
  expect(screen).toContain("interactionDispatch({ type: 'interrupt-lifecycle' });");
});

test('C17 keeps spectator interaction observational while retaining the workspace tools', () => {
  const screen = readC17Screen();

  expect(screen).toContain("const isPlayingPlayer = liveRoom?.role === 'player' && clientState?.playing === true");
  expect(screen).toContain('&& !isFinishedReplay && !isSharedReplay;');
  expect(screen).toContain('const seatingAnchorIndex = clientState?.metadata.ourPlayerIndex ?? null;');
  expect(screen).toContain('const empathyPlayers = useMemo(() => clientState?.metadata.playerNames');
  expect(screen).toContain('empathyPlayers,');
  expect(screen).toContain('isSpectator ? metadata.playerNames[seatingAnchorIndex] ?? `Player ${seatingAnchorIndex + 1}` : usesSideLabelRows ? \'YOU\' : \'YOUR HAND\'');
  expect(screen).toContain('current === seatingAnchorIndex ? theme.colors.accent');
  expect(screen).toContain('if (!clueEnabled || selectedTarget === null || interaction.cluePreview === null) return;');
  expect(screen).toContain('if ((isPlayingPlayer && !replay.active) || canHypotheticalControl) {');
  expect(screen).toContain('const selectedTarget = currentGameLoad && presentationVisible && (isPlayingPlayer || canHypotheticalControl) ? interaction.clueTarget : null;');
  expect(screen).toContain('canPlayGameplay && selectedActionCard !== null && <View style={styles.actionButtons}>');
});

test('C17 uses ordinary side labels without confusing the current actor with a clue target', () => {
  const screen = readC17Screen();
  const lastAction = screen.slice(screen.indexOf('const lastActionPanel ='), screen.indexOf('</View></AuthoritativePulse>', screen.indexOf('<View style={[styles.rowBetween, styles.lastActionHeader]>')));

  expect(screen).toContain('const usesSideLabels = opponents.length <= 2;');
  expect(screen).toContain('const usesDenseSideLabels = opponents.length >= 3;');
  expect(screen).toContain('const usesSideLabelRows = portraitV2 &&');
  expect(screen).toContain("{playerName}{!usesSideLabelRows && currentActor ? ' · TURN' : ''}");
  expect(screen).toContain('currentActorDot');
  expect(screen).toContain('currentActor && (usesSideLabelRows');
  expect(screen).toContain('borderColor: theme.colors.accent');
  expect(screen).toContain('target && { borderColor: theme.colors.accent }');
  expect(lastAction).toContain("title={globalEmpathy ? 'Empathy ✓' : 'Empathy'}");
  expect(lastAction).toContain('title="Rewind"');
});

test('C17 landscape pins ordinary card actions above locally scrolling notes', () => {
  const screen = readC17Screen();
  const workbench = screen.slice(screen.indexOf('const workbench ='), screen.indexOf('return <View style={styles.workspace}>'));
  expect(workbench.indexOf('{cardActions}')).toBeLessThan(workbench.indexOf('<WorkbenchViewport'));
  expect(screen).toContain('const cardActions = (');
  expect(screen).toContain('disabled={!canPlayCard} title="Play"');
  expect(screen).toContain('disabled={!canDiscardCard} title="Discard"');
});

test('C17 landscape uses a dedicated grid and fixed right semantic stack', () => {
  const screen = readC17Screen();
  expect(screen).toContain('style={styles.landscapeBody}');
  expect(screen).toContain('landscapeLayout.rows.map');
  expect(screen).toContain('width: landscapeLayout.fits ? landscapeLayout.leftWidth');
  expect(screen).toContain('width: landscapeLayout.rightWidth');
  expect(screen).toContain('landscapeMetricStrip: { height: 34');
  expect(screen).toContain('landscapeLastAction: { height: 68');
  expect(screen).toContain("presentation={portraitV2 ? 'portrait-v2' : 'landscape-v2'}");
  const lastAction = screen.slice(screen.indexOf('const lastActionPanel ='), screen.indexOf('const cardActions ='));
  expect(lastAction).not.toContain('denseLastActionRow');
  expect(lastAction).toContain('numberOfLines={portraitV2 ? undefined : 2}');
  expect(lastAction).toContain('RECENT ›');
  expect(lastAction).toContain('title="Rewind"');
  expect(lastAction).toContain("title={globalEmpathy ? 'Empathy ✓' : 'Empathy'}");
});

test('C17 Workbench geometry is derived before any tool and keeps primary Rewind accessible', () => {
  const screen = readC17Screen();
  expect(screen).toContain('workbenchHeight: landscapeLayout.workbenchHeight');
  expect(screen).toContain('{ height: layout.workbenchHeight, flexGrow: 0, flexShrink: 0 }');
  expect(screen).toContain('styles.idleWorkbench, { height: layout.workbenchHeight, flex: 0, flexShrink: 0 }');
  expect(screen).toContain('title="Previous" onLongPress={onReviewStart} onPress={onReviewBack}');
  expect(screen).toContain('title="Next" onLongPress={onReviewEnd} onPress={onReviewForward}');
  expect(screen).toContain('title={portraitV2 ? `Exit · Live T${liveTurn}` : "Live"}');
  expect(screen).toContain('title="Start Hypothetical"');
  expect(screen).toContain('getC17WorkbenchHeight(viewportHeight, opponents.length, true)');
  const allocator = screen.slice(screen.indexOf('const landscapeLayout ='), screen.indexOf('const layout: C17DenseLayout ='));
  expect(allocator).toContain('cardsPerHand,');
  expect(allocator).toContain('ownHandPosition,');
  expect(allocator).not.toMatch(/selectedTarget|selectedCard|noteCard|reviewActive|hypothetical|hands\[/);
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

test('dense ClueComposer keeps a two-row palette beside explicit Close and Give actions', () => {
  const composer = readClueComposer();
  const denseComposer = composer.slice(composer.indexOf('{dense ? <View style={styles.denseLayout}>'), composer.indexOf(': <>', composer.indexOf('{dense ? <View style={styles.denseLayout}>')));

  expect(composer).toContain('dense?: boolean;');
  expect(denseComposer).not.toContain('targetName}</Text>');
  expect(denseComposer).toContain('styles.densePalette');
  expect(denseComposer).toContain('styles.denseActionRail');
  expect(denseComposer).toContain('>Close</Text>');
  expect(denseComposer).toContain('>Give</Text>');
  expect(denseComposer).toContain('disabled={!confirmAllowed || !validPreview}');
  expect(denseComposer).toContain('hitSlop={{ top: 5, bottom: 5, left: 2, right: 2 }}');
  expect(denseComposer).toContain('styles.denseColorChoice');
  expect(denseComposer).toContain('styles.denseRankChoice');
  expect(composer).toContain("denseRankChoice: { alignItems: 'center', borderRadius: 6, borderWidth: 2, height: 26, justifyContent: 'center', minWidth: 26");
  expect(composer).toContain("denseRankChoiceText: { fontSize: 16, fontWeight: '900', lineHeight: 18 }");
  expect(composer).not.toContain('denseRankChoiceText: { fontSize: 14');
  expect(composer).toContain("previewState?.type === 'color' && previewState.value === choice.value");
  expect(composer).toContain("previewState?.type === 'rank' && previewState.value === choice.value");
  expect(composer).toContain('height: 26');
  expect(composer).toContain('minHeight: 26');
  expect(composer).toContain('>{targetName}</Text>');
  expect(composer).toContain('title="Give clue"');
});

test('C17 idle Workbench is blank and preserves its fixed rectangle', () => {
  const screen = readC17Screen();
  expect(screen).not.toContain("Tap another player's hand to give a clue");
  expect(screen).toContain('styles.idleWorkbench, { height: layout.workbenchHeight, flex: 0, flexShrink: 0 }');
  expect(screen).toContain('canEnterClue={enabled || hypotheticalEnabled}');
  expect(screen).toContain('if (canEnterClue && !isActionHand) takeWorkbenchTask(() => onSelectClueTarget(index));');
  expect(screen).toContain('const showWorkbench = workbenchFeedback !== null');
});

test('landscape Clue keeps dense choices and Give outside a secondary scroll', () => {
  const screen = readC17Screen();
  expect(screen).toContain('dense={!portraitV2 || usesDenseSideLabels}');
  expect(screen).toContain('const WorkbenchViewport = !portraitV2 && selectedTarget !== null');
  expect(screen).toContain('? View : ScrollView');
  expect(screen).not.toContain('denseClueAvailableHeight');
  expect(screen).not.toContain('compactCappedWorkbench');
  expect(screen).toContain('This landscape size cannot fit the Live workspace. Rotate the device or use a larger window.');
});

test('C17 renders authoritative clocks for an eligible timed or opted-in untimed live game', () => {
  const screen = readC17Screen();
  const eligibility = screen.slice(screen.indexOf('const liveClock ='), screen.indexOf('const latest ='));
  const clockComponent = screen.slice(screen.indexOf('function C17LiveClockText'), screen.indexOf('\n\nfunction HudStat'));

  expect(screen).toContain('getDisplayedClockString,');
  expect(screen).toContain('type LiveClock,');
  expect(eligibility).toContain('(timed || showTimerInUntimed)');
  expect(eligibility).toContain('!clientState.finished');
  expect(eligibility).toContain('!replay.active');
  expect(eligibility).toContain('!hypotheticalActive');
  expect(eligibility).toContain('!liveRoom.sharedReplay');
  expect(eligibility).toContain('ongoingGame.turn.currentPlayerIndex !== null');
  expect(eligibility).toContain('liveRoom.clock !== null');
  expect(screen).toContain('clockPaused={clientState.pause.active}');
  expect(screen).toMatch(/<C17LiveClockText\s+clock=\{liveClock\}\s+paused=\{clockPaused\}\s+timed=\{metadata.options.timed === true\}\s+playerIndex=\{index\}/);
  expect(screen).toMatch(/<C17LiveClockText\s+clock=\{liveClock\}\s+paused=\{clockPaused\}\s+timed=\{metadata.options.timed === true\}\s+playerIndex=\{seatingAnchorIndex\}/);
  expect(clockComponent).toContain('getDisplayedClockString(clock, playerIndex, paused, now, timed)');
  expect(clockComponent).toContain('if (paused) return undefined;');
  expect(clockComponent).toContain('setInterval(() => setNow(Date.now()), 1000)');
  expect(screen).not.toContain("from './LegacyGameScreen'");
});


test('portrait idle reserve is blank and confirmation uses calm face plus textual Close', () => {
  const screen = readC17Screen();
  expect(screen).toContain('{ height: layout.workbenchHeight, flexGrow: 0, flexShrink: 0 }');
  expect(screen).toContain('{ height: layout.workbenchHeight, flex: 0, flexShrink: 0 }');
  expect(screen).not.toContain("Tap another player's hand to give a clue");
  expect(screen).not.toContain('Actor card ');
  expect(screen).not.toContain('card #');
  const feedback = screen.slice(screen.indexOf('{workbenchFeedback !== null ?'), screen.indexOf(': hypothetical !== null ? <>', screen.indexOf('{workbenchFeedback !== null ?')));
  expect(feedback).toContain("'Played' : workbenchFeedback.outcome === 'discarded' ? 'Discarded' : 'Misplayed'");
  expect(feedback).toContain('<VisibleHanabiCard');
  expect(feedback).toContain('title="Close"');
  expect(feedback).not.toMatch(/danger|error|red|order\}/);
});
