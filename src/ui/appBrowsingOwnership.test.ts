import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from '@jest/globals';

const app = readFileSync(resolve(__dirname, '../../App.tsx'), 'utf8').replace(/\r\n/g, '\n');
const homeReset = "setBrowsing(createBrowsingPresentation('home'));";

describe('App browsing ownership', () => {
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
    expect(app).toContain("} else if (roomState.room.kind === 'awaiting_game_bootstrap') {");
    expect(app).toContain('} else if (roomState.rematchTransition !== null) {');
    expect(app).toContain("if (roomState.room.kind === 'pregame') {");
    expect(app).toContain("const pregameReady = session.phase === 'ready' && hydrated;");
    expect(app).toContain('{pregameReady ? <PregameScreen backRef={pregameBackRef} presentationVisible={roomPresentationVisible} /> : pregameConnectionStatus}');
    expect(app).not.toContain('content = <PregameScreen />');
  });
});
