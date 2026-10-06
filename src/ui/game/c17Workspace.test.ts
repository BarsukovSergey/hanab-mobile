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
  expect(liveRoot).toContain('<GameScreen presentationVisible={roomPresentationVisible && roomChild === null} roomChildren={renderRoomChildren} />');
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
});
