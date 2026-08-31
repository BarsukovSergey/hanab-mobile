# Architecture

## Goal

Build an Android-first React Native client for hanab.live that connects to the existing production service and can play in the same tables as browser users. iOS should remain supportable from the same codebase.

## Stack

Planned MVP stack:

- Expo development build
- React Native
- TypeScript (strict)
- Redux Toolkit
- Zod
- Jest

Not planned until proven necessary:

- Expo Router / React Navigation
- Axios
- React Query
- SQLite
- WebView
- UI frameworks
- animation frameworks
- state-machine frameworks
- third-party cookie managers

## Risk-first implementation order

1. Physical Android `NetworkSession` proof — **GO, completed 2026-08-30**
2. Upstream game-core compatibility / containment
3. Deterministic protocol + lobby runtime
4. Table-entry vertical slices — **C4-A spectate GO and C4-B join/pregame/leave GO, completed 2026-08-31**
5. Game bootstrap — **C5 GO, completed 2026-08-31**
6. Read-only live spectator — **C6 next**
7. Play / Discard / Clues
8. Finished-game proof
9. Reconnect / reattend / background lifecycle
10. Create / Start table
11. Chat / polish / Android build cleanup

See `docs/C1_RESULTS.md` for the physical-device evidence behind the C1 decision,
`docs/C4A_RESULTS.md` for the physical Android running-table spectate proof, and
`docs/C4B_RESULTS.md` for the physical Android join/pregame/leave proof. See
`docs/C5_RESULTS.md` for the physical Android player and spectator game-bootstrap proof.

## C1 Android evidence

C1 proved on a physical Samsung Galaxy A55 (`SM-A556E`) that the minimal built-in React Native networking path works against production hanab.live:

```text
POST /login
→ /test-cookie VALID
→ built-in WebSocket OPEN
→ valid welcome
→ tableList
```

The session also survived a true Android force-stop/cold launch and authenticated a fresh WebSocket without another login.

Therefore the preferred Android path is the built-in React Native `fetch` + built-in `WebSocket` with the platform-owned HttpOnly session. Do not add a cookie-management library or custom native cookie bridge unless future evidence proves the built-in path insufficient.

C1 also observed that the existing socket closed while the app was backgrounded on the test device. A fresh socket after foreground authenticated successfully without re-login. Treat this as evidence that lifecycle/reconnect handling is required later; do not assume a socket survives backgrounding.

## Network ownership

HTTP login, session probing, and WebSocket creation share one logical platform boundary:

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

Important semantics:

- `submitLogin()` success only means the HTTP request succeeded.
- `/test-cookie == 200` proves the HTTP session exists.
- A valid `welcome` proves the realtime session is usable.
- `/test-cookie == 204` alone means the session is missing.
- DNS/TLS/timeouts/5xx do not imply logout.
- `NetworkSession` must not expose raw cookies/session tokens if the native networking stack can own them.
- One application authentication lifetime uses one logical `NetworkSession`.

## Connection readiness

Three distinct concepts:

```text
NetworkSocket object exists
        ↓
WebSocket OPEN
        ↓
valid hanab.live welcome
        ↓
READY
```

Backoff/readiness is reset only after valid `welcome`, not merely WebSocket open.

## Connection concurrency

Runtime connection work uses a monotonically increasing `connectionEpoch`.

Every callback/effect belongs to the epoch that created it. If it is stale:

- it cannot mutate current state;
- stale sockets are closed;
- stale timers are cancelled;
- stale subscriptions are removed;
- stale async results are ignored.

Reconnect/open must be single-flight. A foreground handler, reconnect timer, and manual retry may not create concurrent active connection attempts.

When replacing a connection:

```text
invalidate old epoch
→ old callbacks are stale
→ dispose old resources
→ begin next attempt
```

Outgoing application commands are sent only on the current READY connection.

## Gameplay command safety

Outgoing gameplay commands are never persisted, queued, retried, or replayed across a connection boundary.

If the network dies after an action was sent but before its result is observed, reconnect and rebuild from authoritative server history instead of retrying the action.

## Protocol boundary

Dependency direction:

```text
Platform NetworkSession
        ↓
raw HTTP / WebSocket frames
        ↓
Protocol (encode / decode / validate)
        ↓
HanabClient (typed commands / events)
        ↓
Runtime controller
        ↓
Session / Lobby / Room
        ↓
Game-core boundary
        ↓
Selectors / ViewModels
        ↓
UI
```

UI never talks directly to a raw WebSocket.

## Runtime controller

Do not add a state-machine dependency. Prefer deterministic logic conceptually shaped as:

```text
current state + event
→ transition
→ next state + effects
```

Effects can include:

```text
CHECK_SESSION
OPEN_SOCKET
SEND(...)
START_TIMER
CANCEL_TIMER
```

This keeps socket callbacks, timers, AppState handling, and Redux dispatch from turning into an imperative god object and enables fixture-driven tests.

## Room state

Prefer a discriminated union so impossible combinations are structurally excluded:

```ts
type RoomState =
  | { kind: "none" }
  | { kind: "pregame"; tableID: number; role: "player" | "spectator"; data: PregameState }
  | {
      kind: "loadingGame";
      tableID: number;
      role: "player" | "spectator";
      loadEpoch: number;
      stage: "waitingInit" | "waitingHistory";
    }
  | { kind: "playing"; tableID: number; role: "player" | "spectator"; game: ActiveGame }
  | { kind: "finished"; tableID: number; game: FinishedGame }
  | { kind: "recovering"; previousTableID: number | null };
```

Screens are derived from application state rather than a navigation history. A navigation library is not required for MVP.

## Upstream game core

The preferred path is to reuse the pinned upstream game logic, not implement a new Hanabi reducer.

C2 must prove:

1. minimal reproducible dependency closure from pinned upstream;
2. strict TS compilation;
3. Jest/action-sequence behavior;
4. Metro bundling;
5. Android/Hermes runtime import;
6. serializability characteristics;
7. mutation/immutability semantics.

If upstream state is unsuitable for direct Redux ownership, keep it in a `GameRuntime` and expose serializable application/view state. Do not globally disable Redux serializability checks as a shortcut.

Only tightly scoped game-boundary code may import vendored upstream types. UI/network/lobby code must not.

## Game bootstrap

Expected sequence:

```text
server → tableStart
client → getGameInfo1
server → init
client → getGameInfo2
server → gameActionList
server → gameAction ...
```

Before implementing bootstrap, establish exact overlap/deduplication semantics between `gameActionList` and any live `gameAction` received during loading. Do not assume concatenating history and deferred actions is safe.

Game bootstrap uses its own `gameLoadEpoch` once C5 begins. Guards include at least connection epoch, game-load epoch, and table ID.

Loading states have watchdogs; do not allow indefinite `waitingInit` / `waitingHistory`.

## Mobile lifecycle

Reconnect is authoritative resynchronization, not continuation of trusted stale client state.

Physical Android C1 evidence showed that the old WebSocket may close while the app is backgrounded, while the underlying authenticated HTTP session remains reusable. A fresh socket after foreground authenticated successfully without re-login.

Therefore later lifecycle handling must treat background/foreground as a possible connection-boundary transition. The exact reconnect policy remains deferred to the reconnect milestone, but it must use the documented epoch/single-flight/disposal rules and must never replay gameplay commands.

## Diagnostics and fixtures

Diagnostics must be safe to share for debugging.

Never log secrets. Prefer command name, payload byte count, and an optional sanitized preview instead of indiscriminately logging raw payloads.

Raw protocol captures are useful only if they remain raw enough to test the decoder. Workflow:

```text
capture locally
→ sanitize
→ manually inspect
→ only then commit under fixtures/
```

## First playable proof

Before reconnect hardening, prove one complete No Variant game Android ↔ browser:

```text
login
→ lobby
→ spectate/join
→ receive game
→ play/discard/clue
→ finish game
```

Reconnect remains mandatory for the mobile MVP, but does not need to block the first successful start-to-finish proof.
