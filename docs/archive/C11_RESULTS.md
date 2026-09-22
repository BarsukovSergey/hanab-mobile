# C11 Results — Chat, Logout, and Release Polish

Status: **GO / CLOSED**

Final implementation SHA before docs: `d4f88553004728e8583baa5c5b20a062f5842cdc`

## Implementation

- Added the pinned inbound `chat` and `chatList` handling and exact outbound `chat {msg, room}` framing, including compatibility with the production Go wire where fields such as `recipient` / server `who` may be empty strings.
- Added lobby and table chat for lobby, pregame, live, and finished-game views.
- Chat is trimmed, nonblank, limited to 300 characters, READY/current-room only, and never queued or replayed across connection epochs.
- Server markup is converted to inert readable text; the app does not render chat through HTML or a WebView.
- Added credentialed `GET /logout`, stopped runtime ownership first, verified the session state, and explicitly reset session, lobby, room, gameplay intent, and chat state after confirmed logout.
- Added Sign out to authenticated UI and return-to-login behavior.
- Added authoritative `tableUnattend {tableID}` handling and a Lobby action for both players and spectators in an ongoing game. The client waits for the authoritative own-user Lobby update before leaving `live_game`.
- Kept `expo-dev-client` for development and added `npm run android:release` using `expo run:android --variant release`.
- No generated `android/` or `ios/` directory is committed.

## Automated validation

Final C11 implementation validation:

- `npm run typecheck` — PASS.
- `npm test` — PASS: 113 tests.
- `git diff --check` — PASS.
- Working tree clean and `main == origin/main` before physical release proof.

Coverage includes exact chat and table-unattend frames, room routing, history replacement, safe plain-text conversion, READY/length gating, epoch reset/no replay, credentialed logout, confirmed signed-out state reset, authoritative live-game exit, double-send prevention, and connection-boundary clearing.

## Physical proof

PASS on a physical Android device:

- Phone -> server -> browser chat delivery works.
- The phone displays its own new chat message after the authoritative server echo.
- Browser -> phone chat delivery works.
- Spectating an ongoing game exposes a Lobby action; `tableUnattend` returns the phone to the lobby while the game continues.
- Sign out returns to Login.
- Relaunch after logout remains signed out; there is no unintended automatic re-authentication.
- Logging in again returns to the lobby normally.
- Android release build installs and launches without Metro and without Expo Dev Launcher.
- The release build remains usable with the development computer disconnected; only the normal network dependency on hanab.live remains.

C11 is therefore **GO and closed**.
