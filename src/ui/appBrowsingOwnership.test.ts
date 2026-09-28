import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8').replace(/\r\n/g, '\n');
const homeReset = "setBrowsing(createBrowsingPresentation('home'));";

describe('App browsing ownership', () => {
  test('Browse and Return only alter focus except own Rewind exits through local review selection', () => {
    const browse = app.slice(app.indexOf('const browseFromRoom ='), app.indexOf('const exitOwnRewind ='));
    const returning = app.slice(app.indexOf('const returnToRoom ='), app.indexOf('useLayoutEffect(', app.indexOf('const returnToRoom =')));
    expect(browse).toContain("setPresentationFocus('browsing')");
    expect(browse).not.toContain('lobbyRuntime');
    expect(returning).toContain('if (returnPresentation === null) return;');
    expect(returning).toContain("if (returnPresentation.behavior === 'return-live') exitOwnRewind();");
    expect(returning).toContain("setPresentationFocus('room')");
    expect(returning).not.toMatch(/lobbyRuntime|\.join\(|\.leave\(|\.reattend\(|\.play\(|\.discard\(|\.clue\(/i);
    const rewind = app.slice(app.indexOf('const exitOwnRewind ='), app.indexOf('const returnToRoom ='));
    expect(rewind).toContain('roomActions.reviewSegmentSelected');
    expect(rewind).toContain('gameLoadEpoch: roomState.room.gameLoadEpoch');
    expect(rewind).toContain('segment: null');
    expect(rewind).not.toContain('lobbyRuntime');
  });

  test('browsing task survives room bootstrap and rematch; navigation remains with occupied room', () => {
    const content = app.slice(app.indexOf('let content: ReactNode;'), app.indexOf('const showBrowsingNavigation ='));
    expect(content).toContain("presentationFocus === 'room' && focusedRoomPresentation === null && roomState.room.kind === 'awaiting_game_bootstrap'");
    expect(content).toContain("presentationFocus === 'room' && focusedRoomPresentation === null && roomState.rematchTransition !== null");
    const nav = app.slice(app.indexOf('const showBrowsingNavigation ='), app.indexOf('const railNavigation ='));
    expect(nav).toContain("presentationFocus === 'browsing'");
    expect(nav).not.toContain("roomState.room.kind === 'none'");
    expect(nav).not.toContain('rematchTransition');
  });

  test('browsing Back precedes room ownership and Home root reaches system', () => {
    const back = app.slice(app.indexOf("BackHandler.addEventListener('hardwareBackPress'"), app.indexOf('return () => subscription.remove();'));
    expect(back.indexOf("if (presentationFocus === 'browsing')")).toBeLessThan(back.indexOf("if (roomState.room.kind === 'pregame')"));
    expect(back).toContain("if (getBrowsingBackAction(browsing, authenticated) === 'back')");
    expect(back).toContain('return false;');
    expect(back).toContain("if (decision === 'return-live') exitOwnRewind();");
    expect(back).toContain("if (decision === 'browse-origin') setPresentationFocus('browsing');");
    expect(back).not.toMatch(/unattendLiveGame|lobbyRuntime\.leave/);
  });
  test('only successful explicit auth transitions reset browsing to Home, never room entry', () => {
    const login = app.slice(app.indexOf('const submitCredentials'), app.indexOf('const submitManualLogin'));
    const signOut = app.slice(app.indexOf('const signOut'), app.indexOf('if (signOutPending)'));

    expect(login).toContain(homeReset);
    expect(signOut).toContain(homeReset);
    expect(app.split(homeReset)).toHaveLength(3);
  });

  test('room foreground remains authoritative and Pregame is hosted outside browsing content', () => {
    expect(app).not.toContain('returnAfterUnattend');
    expect(app).toContain("if (probe === 'valid' && roomState.room.kind === 'live_game')");
    expect(app).toContain("presentationFocus === 'room' && focusedRoomPresentation === null && roomState.room.kind === 'awaiting_game_bootstrap'");
    expect(app).toContain("presentationFocus === 'room' && focusedRoomPresentation === null && roomState.rematchTransition !== null");
    expect(app).toContain("if (roomState.room.kind === 'pregame') {");
    expect(app).toContain("const pregameReady = session.phase === 'ready' && hydrated;");
    expect(app).toContain('{pregameReady ? <PregameScreen backRef={pregameBackRef} onBrowse={browseFromRoom} presentationVisible={roomPresentationVisible} /> : pregameConnectionStatus}');
    expect(app).not.toContain('content = <PregameScreen />');
  });
});
