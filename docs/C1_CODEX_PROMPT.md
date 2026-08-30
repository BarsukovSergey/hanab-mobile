# C1 Codex Task — Physical Android NetworkSession Proof

## TASK

Build the smallest possible Expo/React Native development-build app that proves whether a real Android device can:

1. create/verify a hanab.live HTTP session;
2. preserve that session across a cold process restart;
3. use the same session when opening `wss://hanab.live/ws`;
4. receive a valid `welcome` and `tableList` from the production server.

This is a **risk spike**, not the production networking subsystem.

## GOAL

Answer exactly this question:

> Can the chosen minimal Expo/React Native runtime create a hanab.live session through HTTP, persist it across a cold process restart, and authenticate a WebSocket to hanab.live on a physical Android device without adding a cookie-management library?

## READ FIRST

- `AGENTS.md`
- `docs/ARCHITECTURE.md`
- `docs/PROTOCOL.md`
- `docs/UPSTREAM.md`

Do not research alternative architectures unless this task explicitly tells you to.

## ALLOWED DEPENDENCIES

Use only what is necessary to bootstrap a current Expo development-build TypeScript app.

Do not add:

- Redux Toolkit;
- Zod;
- Axios;
- React Query;
- React Navigation / Expo Router unless required by the current Expo template itself;
- cookie-manager libraries;
- WebView;
- SQLite;
- networking replacement libraries;
- state-machine libraries;
- unrelated UI libraries.

Use built-in React Native `fetch` and built-in React Native `WebSocket` for the experiment.

If the current Expo template introduces dependencies automatically, keep the standard template but do not add unrelated packages manually.

## EXPECTED FILE SCOPE

Create only the minimal project/bootstrap files and a small experimental implementation, for example:

```text
App.tsx
src/network/NetworkSession.ts
src/network/types.ts
src/diagnostics/...
src/config/hanab.ts
```

Exact names can vary slightly if the Expo bootstrap requires it, but do not create the future full application architecture yet.

Do not create game, lobby, Redux, router, or upstream vendor layers in this task.

## NETWORK CONTRACT

The experiment should be conceptually compatible with:

```ts
interface NetworkSession {
  checkSession(): Promise<SessionCheckResult>;
  submitLogin(username: string, password: string): Promise<void>;
  openSocket(): Promise<NetworkSocket>;
}

type SessionCheckResult =
  | { kind: "valid" }
  | { kind: "missing" }
  | { kind: "indeterminate"; error: NetworkOrHttpError };
```

Do **not** implement `reset()` / logout in C1.

Do not expose any cookie/session-token getter.

One logical `NetworkSession` owns the authentication lifetime used for session probing, login, and WebSocket creation.

## HANAB.LIVE FACTS

Base URL:

```text
https://hanab.live
```

Session probe:

```text
GET https://hanab.live/test-cookie
```

Interpretation:

```text
200 → valid
204 → missing
anything else → indeterminate
transport failure → indeterminate
```

Only confirmed `204` means session missing.

Login:

```text
POST https://hanab.live/login
Content-Type: application/x-www-form-urlencoded
```

Fields:

```text
username
password
version=bot
```

`POST /login` success does **not** mean authenticated session is proven.

After login success, call `/test-cookie` again. Only `200` proves the HTTP session.

WebSocket:

```text
wss://hanab.live/ws
```

WebSocket OPEN does **not** mean hanab.live connection is ready.

A valid `welcome` frame proves the realtime session.

Wire format is:

```text
COMMAND JSON
```

For C1, implement only enough parsing to identify command names and count/observe `welcome`, `userList`, and `tableList` safely.

Do not build the full protocol layer yet.

## UI / DIAGNOSTICS

Keep the UI deliberately ugly and small.

It should provide:

### Session section

```text
Session probe: UNKNOWN / VALID / MISSING / INDETERMINATE
Login: NOT_ATTEMPTED / SUCCESS / FAILED
```

### WebSocket section

```text
Socket: IDLE / CONNECTING / OPEN / CLOSED / ERROR
Welcome: YES / NO
Users: <count or unknown>
Tables: <count or unknown>
Last command: <command name>
```

### Login form

Only when needed:

```text
username
password
Login button
```

The password field must never be copied into diagnostics/log output.

## SECRET HANDLING

Never log or display:

- account password;
- `hanabi.sid`;
- Cookie header;
- table passwords;
- session/token values.

Do not add APIs that read/expose the cookie value to JavaScript.

When showing the last incoming message, show only:

```text
command name
payload byte count
```

Do not dump an unsanitized `welcome` payload to the screen or console.

## SCENARIO A — FRESH LOGIN

On a fresh install / missing session:

```text
launch
→ GET /test-cookie
→ expect MISSING if server returns 204
→ user enters credentials locally
→ POST /login
→ GET /test-cookie
→ require VALID (200)
→ open WebSocket
→ observe OPEN
→ receive valid welcome
→ observe tableList
```

The user will type real credentials locally on the device. Do not hard-code credentials and do not ask for them in code/comments.

## SCENARIO B — COLD PROCESS RESTART

After Scenario A succeeds:

```text
fully destroy app process
DO NOT clear app data
launch again
→ GET /test-cookie
→ expect VALID (200)
→ open WebSocket
→ receive valid welcome
```

A React refresh/reload does not count. Report exactly how the cold process restart was performed.

## SCENARIO C — BACKGROUND / FOREGROUND OBSERVATION

After a working connection:

```text
background app
wait a short documented interval
foreground app
```

For C1, **observe only**.

Record:

```text
background timestamp
foreground timestamp
WebSocket callbacks observed
WebSocket readyState before/after if available
whether the old socket still receives data
whether a newly opened socket (if manually triggered for the test) can authenticate
```

Do not implement a production reconnect loop, background policy, or automatic recovery algorithm in C1.

## RAW FIXTURE CAPTURE

After the first successful connection, provide a way to capture a small local raw inbound transcript sufficient to include:

```text
welcome
userList
tableList
```

The raw capture must **not** be committed automatically.

Workflow:

```text
capture locally
→ sanitize
→ manually inspect
→ only later commit as fixture
```

Do not commit real usernames, friends/settings data, cookies, passwords, or other user-sensitive content as part of C1.

If implementing a sanitizer in C1 would substantially enlarge the task, just keep the capture local and report its local path / capture mechanism. Do not commit it.

## DO NOT

- Do not implement Redux.
- Do not implement game core.
- Do not implement full typed protocol schemas.
- Do not implement lobby UI.
- Do not implement navigation architecture.
- Do not implement automatic reconnect/backoff.
- Do not implement `NetworkSession.reset()`.
- Do not install a cookie manager.
- Do not install an alternative WebSocket library.
- Do not use WebView.
- Do not stress/fuzz/load-test hanab.live.
- Do not retry random approaches after an unexplained networking failure.
- Do not modify unrelated docs/architecture to fit an implementation shortcut.

## STOP CONDITION

If all of the following are true:

```text
POST /login succeeds
GET /test-cookie returns 200
but authenticated WebSocket cannot receive a valid welcome
```

then STOP.

Do not install alternative cookie/networking libraries.
Do not write native Kotlin code yet.
Do not redesign `NetworkSession`.

Collect evidence and report it.

Also stop on the first unexplained build/runtime failure that would require changing the intended approach rather than a straightforward implementation fix.

## ACCEPTANCE CRITERIA

C1 is successful only if a physical Android device proves:

1. missing session can be detected via `/test-cookie == 204`;
2. login can be submitted without exposing credentials;
3. `/test-cookie == 200` after login;
4. built-in React Native WebSocket reaches OPEN;
5. the socket receives a valid hanab.live `welcome`;
6. `tableList` is observed;
7. after a true cold process restart without clearing app data, `/test-cookie` is still 200 and a new WebSocket receives `welcome`;
8. background/foreground behavior is observed and documented without turning C1 into reconnect implementation;
9. no secret/session cookie is logged or committed.

## VALIDATION

Run the project-appropriate TypeScript checks available from the chosen Expo bootstrap.

Build/run a development build on the physical Android device.

Do not claim success based only on emulator, browser, Expo web, or Node tests.

## REPORT

Report exactly:

### Runtime matrix

```text
Expo SDK:
React Native version:
Android OS version:
Device model:
Development client/build type:
Node version:
Package manager:
Lockfile:
```

### Scenario A

```text
/test-cookie before login:
POST /login result:
/test-cookie after login:
WebSocket OPEN:
welcome received:
tableList received:
```

### Scenario B

```text
cold-process method:
/test-cookie after cold restart:
welcome after cold restart:
```

### Scenario C

```text
background duration:
observed WS callbacks/state:
notes:
```

### Files changed

List them.

### Dependencies added

List them and explain why each was necessary.

### Commands/tests run

List them with pass/fail.

### Evidence on failure

If STOP CONDITION was hit, provide concise sanitized evidence and do not attempt alternative networking implementations.
