import { describe, expect, test } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { isC17WorkspaceEligible } from './c17Workspace';

const appSource = readFileSync(resolve(__dirname, '../../../App.tsx'), 'utf8');
const c17ScreenSource = readFileSync(resolve(__dirname, 'C17GameScreen.tsx'), 'utf8');

const livePlayerPortrait = {
  isLiveParticipant: true,
  portrait: true,
  finished: false,
  replayActive: false,
};

describe('C17 workspace route', () => {
  test('reduces only C17 bottom spacing and keeps the bottom safe area', () => {
    expect(appSource).toMatch(/gameContainer: \{[^}]*paddingBottom: 18/);
    expect(appSource).toMatch(/gameContainerC17: \{[^}]*paddingBottom: 0/);
    expect(appSource).toMatch(/gameWorkspace: \{[^}]*paddingBottom: 10/);
    expect(appSource).toMatch(/gameWorkspaceC17: \{[^}]*paddingBottom: 0/);
    expect(c17ScreenSource).toMatch(/workspace: \{ flex: 1, minHeight: 0 \}/);
    expect(appSource).toMatch(/<SafeAreaView edges=\{\['bottom'\]\}/);
  });

  test('keeps the C17 ledger while locally reviewing a live game', () => {
    expect(isC17WorkspaceEligible({
      ...livePlayerPortrait,
      playerCount: 6,
      replayActive: true,
    })).toBe(true);
  });

  test.each([2, 3, 4, 5, 6])('keeps a live %ip player in C17 in portrait and landscape', (playerCount) => {
    expect(isC17WorkspaceEligible({ ...livePlayerPortrait, playerCount, portrait: true })).toBe(true);
    expect(isC17WorkspaceEligible({ ...livePlayerPortrait, playerCount, portrait: false })).toBe(true);
  });

  test.each([2, 3, 4, 5, 6])('keeps a live %ip spectator in C17 in portrait and landscape', (playerCount) => {
    expect(isC17WorkspaceEligible({
      ...livePlayerPortrait, isPlayer: false, isLiveParticipant: true, playerCount, portrait: true,
    })).toBe(true);
    expect(isC17WorkspaceEligible({
      ...livePlayerPortrait, isPlayer: false, isLiveParticipant: true, playerCount, portrait: false,
    })).toBe(true);
  });

  test.each([2, 3, 4, 5, 6])('uses C17 for a finished non-shared %ip game', (playerCount) => {
    expect(isC17WorkspaceEligible({
      ...livePlayerPortrait,
      playerCount,
      finished: true,
      replayActive: true,
      portrait: false,
    })).toBe(true);
  });

  test.each([2, 3, 4, 5, 6])('uses C17 for a shared %ip replay', (playerCount) => {
    expect(isC17WorkspaceEligible({
      ...livePlayerPortrait, playerCount, finished: true, replayActive: true, sharedReplay: true, portrait: false,
    })).toBe(true);
  });

  test.each([
    { ...livePlayerPortrait, playerCount: 6, isLiveParticipant: false },
    { ...livePlayerPortrait, playerCount: 1 },
    { ...livePlayerPortrait, playerCount: 7 },
  ])('leaves ineligible presentations on their existing path', (input) => {
    expect(isC17WorkspaceEligible(input)).toBe(false);
  });
});


test('Live keeps a stable ScrollView root across rotation with eligible scrolling disabled in both orientations', () => {
  expect(appSource).toContain('const gameRootScrollable = !c17Workspace;');
  const liveRoot = appSource.match(/<SafeAreaView edges=\{\['bottom'\]\}[^>]*>\s*(<ScrollView[\s\S]*?<\/ScrollView>)\s*<\/SafeAreaView>/)?.[1] ?? '';
  expect(liveRoot).toContain('scrollEnabled={gameRootScrollable}');
  expect(liveRoot).toContain('<GameScreen presentationVisible={roomPresentationVisible && roomChild === null} roomChildren={renderRoomChildren} heightConstrained={gameHeightConstrained} />');
  expect(liveRoot).not.toMatch(/\bkey=/);
  expect(appSource).not.toContain('const GameRoot');
  expect(appSource).not.toContain('<GameRoot');
  expect(appSource).not.toMatch(/gameRootScrollable\s*\?\s*(?:ScrollView|View)/);
  expect(appSource).not.toContain('|| height < 700');
  expect(c17ScreenSource).not.toContain('CompactHandCardSummary');
  expect(c17ScreenSource).toContain('style={styles.landscapeBody}');
  expect(c17ScreenSource).toContain("ownHandPosition === 'top' ? { flexDirection: 'column-reverse'");
  expect(c17ScreenSource).toContain('const OpponentViewport = portraitV2 && layout.opponentsScrollable ? ScrollView : View;');
});


test('Bottom places own hand immediately above the pinned Workbench in roomy shells', () => {
  expect(c17ScreenSource).toContain("height: portraitV2 && ownHandPosition === 'bottom' ? handsRegionHeight : layout.handsHeight");
  expect(c17ScreenSource).toContain("ownHandPosition === 'bottom' ? { justifyContent: 'space-between'");
  expect(c17ScreenSource).toContain("portraitV2 && ownHandPosition === 'top' && <View style={{ flex: 1 }}");
  expect(c17ScreenSource).toMatch(/shellMeasured && portraitV2 && opponents.length === 1 && ownHandPosition === 'bottom'\s*&& \{ paddingTop: getC17TwoPlayerBottomTopInset\(handsRegionHeight, layout.handsHeight\) \}/);
  expect(c17ScreenSource).toMatch(/\{renderAnchoredHand\(\)\}\s*<\/View>\s*\{portraitV2 && ownHandPosition === 'top' && <View style=\{\{ flex: 1 \}\} \/>\}\s*\{workbench\}/);
  expect(c17ScreenSource).toContain('hands: { gap: 5, marginTop: 5, minHeight: 0 }');
});

test('spacing adjustment leaves Top, 3P–6P and landscape paths unchanged', () => {
  expect(c17ScreenSource).toContain("ownHandPosition === 'top' ? { flexDirection: 'column-reverse' as const } : {})");
  const portraitHands = c17ScreenSource.slice(c17ScreenSource.indexOf('styles.hands,'), c17ScreenSource.indexOf('<OpponentViewport nestedScrollEnabled'));
  expect(portraitHands.match(/paddingTop:/g)).toHaveLength(1);
  const landscapeBody = c17ScreenSource.slice(c17ScreenSource.indexOf('</> : <View onLayout={captureAmbientBody} style={styles.landscapeBody}>'));
  expect(landscapeBody).not.toContain('getC17TwoPlayerBottomTopInset(');
});

test('tool changes retain the fixed active and idle Workbench geometry', () => {
  expect(c17ScreenSource).toContain('getC17WorkbenchHeight(viewportHeight, opponents.length, true)');
  expect(c17ScreenSource).toContain('styles.idleWorkbench, { height: layout.workbenchHeight, flex: 0, flexShrink: 0 }');
  const workbench = c17ScreenSource.slice(c17ScreenSource.indexOf('const workbench ='), c17ScreenSource.indexOf('const workbench =') + 650);
  expect(workbench).toContain('height: layout.workbenchHeight, flexGrow: 0, flexShrink: 0');
});


test('threads external height occupancy through the existing game components', () => {
  const wrapper = readFileSync(resolve(__dirname, 'GameScreen.tsx'), 'utf8');
  expect(appSource).toContain("const workspaceStatusVisible = !portraitChatOpen && !(c17Workspace && width > height) && workspacePresentation.status !== '';");
  expect(appSource).toContain('const gameHeightConstrained = liveConnectionProblem || serverStatusMessage !== null || workspaceStatusVisible;');
  expect(appSource).toContain('{workspaceStatusVisible && <Text');
  expect(appSource).toContain('heightConstrained={gameHeightConstrained}');
  expect(wrapper).toContain('heightConstrained = false');
  expect(wrapper).toContain('<C17GameScreen presentationVisible={presentationVisible} roomChildren={roomChildren} heightConstrained={heightConstrained} />');
  expect(c17ScreenSource).toContain('heightConstrained = false');
  expect(c17ScreenSource).toContain('allowHeightShrink={heightConstrained || clientState.pause.active || noteWarning !== null}');
  expect(c17ScreenSource).toMatch(/const envelope = portraitV2 \? getC17AmbientEnvelope\([\s\S]*?sameShell,\s*allowHeightShrink,\s*\) : next/);
  const shell = c17ScreenSource.match(/const shellKey =[^;]+;/)?.[0] ?? '';
  expect(shell).not.toMatch(/allowHeightShrink|heightConstrained|noteWarning|pause/);
  expect(c17ScreenSource).not.toMatch(/<C17DenseWorkspace[^>]*\bkey=/);
  expect(c17ScreenSource).not.toMatch(/<View onLayout=[^>]*\bkey=/);
});

test('replaces impossible portrait gameplay with a noninteractive warning using actual measured space', () => {
  expect(c17ScreenSource).toContain('const portraitSizeTooSmall = shellMeasured && portraitV2');
  expect(c17ScreenSource).toContain('getC17HandsRegionHeight(layoutMetrics.measuredBodyHeight, workbenchHeight) === 0');
  expect(c17ScreenSource).toContain('measuredBodyHeight: next.height');
  const body = c17ScreenSource.slice(c17ScreenSource.indexOf('<View onLayout={portraitV2 ? captureAmbientBody'), c17ScreenSource.indexOf('</> : <View onLayout={captureAmbientBody}'));
  expect(body).toMatch(/portraitSizeTooSmall \? <Text accessibilityRole="alert"[^>]*>Not enough space for gameplay\. Use a larger window\.<\/Text> : <>/);
  expect(body).toMatch(/\{workbench\}\s*<\/>/);
  expect(body).not.toMatch(/setNote|interactionDispatch|lobbyRuntime|scrollEnabled|\bkey=/);
});
