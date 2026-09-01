# C11 Results — Chat, Logout, and Release Polish

Status: **IMPLEMENTED**

## Implementation

- Added the exact pinned inbound `chat` and `chatList` schemas and exact outbound
  `chat {msg, room}` framing.
- Added lobby and table chat for lobby, pregame, live, and finished-game views.
- Chat is trimmed, nonblank, limited to 300 characters, READY/current-room only, and never queued
  or replayed across connection epochs.
- Server markup is converted to inert readable text; the app does not render chat through HTML or
  a WebView.
- Added credentialed `GET /logout`, stopped runtime ownership first, verified `/test-cookie == 204`,
  and explicitly reset session, lobby, room, gameplay intent, and chat state.
- Added Sign out to authenticated UI and return-to-login behavior.
- Kept `expo-dev-client` and added `npm run android:release` using
  `expo run:android --variant release`.
- No generated `android/` or `ios/` directory is committed.

## Automated validation

- `npm run typecheck` — PASS.
- `npm test` — PASS: 12 suites, 106 tests, 0 snapshots.
- `git diff --check` — PASS.

Coverage includes exact frames, room routing, history replacement, safe plain-text conversion,
READY/length gating, epoch reset/no replay, credentialed logout, session verification, and complete
explicit signed-out state reset.
