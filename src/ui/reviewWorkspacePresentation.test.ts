import { readFileSync } from 'node:fs';
import { describe, expect, test } from '@jest/globals';
import type { RoomState } from '../store/roomSlice';
import { getReviewWorkspacePresentation } from './reviewWorkspacePresentation';
import { getFocusedRoomBackDecision, getRoomReturnPresentation } from './roomReturnPresentation';

type LiveRoom = Extract<RoomState, { kind: 'live_game' }>;
const room = (options: { finished?: boolean; active?: boolean; databaseID?: number | null;
  sharedReplay?: boolean; shared?: { amLeader: boolean; useSharedSegments: boolean }; hypothetical?: object } = {}): LiveRoom => ({
  kind: 'live_game', sharedReplay: options.sharedReplay ?? false,
  clientState: {
    finished: options.finished ?? false,
    replay: { active: options.active ?? false, databaseID: options.databaseID ?? null,
      shared: options.shared ?? null, hypothetical: options.hypothetical ?? null },
    ongoingGame: { score: 23 },
  },
} as unknown as LiveRoom);
const read = (path: string) => readFileSync(path, 'utf8').replace(/\r\n/g, '\n');
const app = read('App.tsx');
const c17 = read('src/ui/game/C17GameScreen.tsx');

describe('authoritative Review presentation', () => {
  test.each([
    [{}, 'LIVE', false, 'Game menu', 'consume'],
    [{ active: true }, 'REWIND', false, 'Game menu', 'return-live'],
    [{ finished: true }, 'REPLAY', true, 'Review menu', 'browse-origin'],
    [{ active: true, databaseID: 2011703 }, 'REPLAY #2011703', true, 'Review menu', 'browse-origin'],
    [{ active: true, sharedReplay: true }, 'REPLAY', true, 'Review menu', 'browse-origin'],
    [{ active: true, hypothetical: {} }, 'REPLAY', true, 'Review menu', 'browse-origin'],
  ] satisfies Array<[Parameters<typeof room>[0], string, boolean, string, string]>)('derives identity, menu and bare Back for %j', (options, identity, review, menuTitle, back) => {
    const attended = room(options);
    expect(getReviewWorkspacePresentation(attended)).toMatchObject({ identity, review, menuTitle });
    expect(getFocusedRoomBackDecision(attended)).toBe(back);
  });

  test('IDs come only from authoritative replay data, including imported/unknown ID fallback', () => {
    for (const databaseID of [null, -1, 0]) {
      expect(getReviewWorkspacePresentation(room({ finished: true, databaseID })).identity).toBe('REPLAY');
    }
    const dedicated = room({ active: true, databaseID: 123 });
    expect(getRoomReturnPresentation(dedicated, false)).toEqual({ status: 'REPLAY #123', action: 'Return to review', behavior: 'focus-room' });
  });

  test('finished result, shared leader/follow/local view and hypothetical are explicit text', () => {
    expect(getReviewWorkspacePresentation(room({ finished: true })).status).toBe('Finished · 23');
    expect(getReviewWorkspacePresentation(room({ sharedReplay: true })).status).toBe('SHARED REVIEW');
    for (const [amLeader, useSharedSegments, marker] of [
      [true, true, 'Leader'], [false, true, 'Following leader'], [false, false, 'Local view · Detached from leader'],
    ] as const) {
      expect(getReviewWorkspacePresentation(room({ finished: true, hypothetical: {}, shared: { amLeader, useSharedSegments } })).status)
        .toBe(`HYPOTHETICAL · SHARED REVIEW · ${marker} · Finished · 23`);
    }
  });
});

test('focused Review reuses mounted C17 and room children, with local Browse and contextual Menu', () => {
  const header = app.slice(app.indexOf('styles.gameBar,'), app.indexOf('{liveConnectionProblem'));
  expect(header).toContain("title={workspacePresentation.review && width <= height ? 'Browse' : 'Home'}");
  expect(header).toContain('onPress={workspacePresentation.review && width <= height ? browseFromRoom : homeFromLive}');
  expect(header).toContain('workspacePresentation.identity');
  expect(header).toContain('workspacePresentation.status');
  expect(header).toContain("onPress={() => setRoomChild('chat')}");
  expect(header).toContain('accessibilityLabel={workspacePresentation.menuAccessibilityLabel}');
  expect(app).toContain('getRoomChildTitle(roomChild, workspacePresentation.menuTitle)');
  const browse = app.slice(app.indexOf('const browseFromRoom ='), app.indexOf('const homeFromLive ='));
  expect(browse).toContain("setPresentationFocus('browsing')");
  expect(browse).not.toMatch(/lobbyRuntime|dispatch|setRoomChild|setBrowsing/);
  expect(app).toContain('<GameScreen presentationVisible={roomPresentationVisible && roomChild === null} roomChildren={renderRoomChildren} heightConstrained={gameHeightConstrained} landscapeHeader={gameHeader} />');
  expect(app).toContain('{focusedRoomPresentation !== null && <View');
  expect(app).toContain("readActive={roomPresentationVisible && roomChild === 'chat'}");
});

test('nearest local surfaces own Back before bare Review, Return keeps the same room without sends', () => {
  const back = app.slice(app.indexOf("BackHandler.addEventListener('hardwareBackPress'"), app.indexOf('return () => subscription.remove();'));
  expect(back.indexOf('backRoomChild();')).toBeLessThan(back.indexOf('getFocusedRoomBackDecision'));
  expect(c17).toContain('onRequestClose={() => setRecentOpen(false)}');
  expect(c17).toContain('visible={presentationVisible && recentOpen}');
  const editor = read('src/ui/game/NoteEditor.tsx');
  expect(editor).toContain('onRequestClose={cancelAndClose}');
  expect(back).toContain("if (decision === 'return-live') exitOwnRewind();");
  expect(back).toContain("if (decision === 'browse-origin') setPresentationFocus('browsing');");
  expect(back).not.toMatch(/lobbyRuntime|unattend|endHypothetical|navigateReplaySegment/);
  const returning = app.slice(app.indexOf('const returnToRoom ='), app.indexOf('const backFromBrowsing ='));
  expect(returning).toContain("setPresentationFocus('room')");
  expect(returning).not.toMatch(/lobbyRuntime|dispatch|createReplay|endHypothetical/);
});

test('Review keeps adjacent/edge navigation, timeline, current turn and direct follower control', () => {
  const primary = c17.slice(c17.indexOf('const followLeaderControl ='), c17.indexOf('const WorkbenchViewport ='));
  expect(primary).toContain('title="Previous" onLongPress={onReviewStart} onPress={onReviewBack}');
  expect(primary).toContain('title="Next" onLongPress={onReviewEnd} onPress={onReviewForward}');
  expect(primary).toContain('!sharedReplay.amLeader && !sharedReplay.useSharedSegments');
  expect(primary).toContain('title="Follow leader" tone="primary" onPress={() => lobbyRuntime.followReplayLeader()}');
  expect(c17).toContain('{portraitV2 && replayPrimaryControls}');
  expect(c17).toContain('styles.actionButtons]}>{replayPrimaryControls}');
  expect(c17).toContain('<C17RewindScrubber actionSegments={actionSegments} onSelectSegment={onScrubAction} selectedSegment={selectedActionSegment} />');
  expect(c17).toContain('>T{selectedTurn} · {sharedReplay.amLeader');
  expect(c17).toContain("'Local view · Detached from leader'");
  expect(c17).toContain('onPress={onReturnLive}');
});

test('follower movement retains the local runtime path; only the shared leader broadcasts', () => {
  const runtime = read('src/runtime/ReplayInteractionRuntime.ts');
  const navigate = runtime.slice(runtime.indexOf('  navigateReplaySegment('), runtime.indexOf('  followReplayLeader('));
  const local = navigate.slice(navigate.indexOf('if (shared === null || !shared.amLeader)'), navigate.indexOf('if (!this.isReadyCurrentRoom'));
  expect(local).toContain('this.store.dispatch(roomActions.reviewSegmentSelected(');
  expect(local).not.toMatch(/sendEncoded|encodeReplayActionFrame/);
  expect(navigate).toContain('return this.sendEncoded(encodeReplayActionFrame(room.tableID, segment));');
  expect(c17).toContain('lobbyRuntime.navigateReplaySegment(temporal.afterSegment)');
  const presentation = read('src/ui/reviewWorkspacePresentation.ts');
  expect(presentation).not.toMatch(/lobbyRuntime|dispatch|sendEncoded|WebSocket|useState/);
});

test('Review leaves the existing landscape allocator and child placement in charge', () => {
  const allocator = c17.slice(c17.indexOf('const landscapeLayout ='), c17.indexOf('const layout: C17DenseLayout'));
  expect(allocator).toContain('getC17LandscapeLayout(');
  expect(allocator).not.toMatch(/roomChild|workspacePresentation|replay|hypothetical/);
  expect(c17).toContain('roomChildren?.(portraitV2 ? null : landscapeLayout.fits ? landscapeLayout.rightWidth : 0)');
  expect(app).toContain('const gameRootScrollable = !c17Workspace;');
});
