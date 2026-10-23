# Architecture

## Goal

Build an Android-first React Native client for hanab.live that connects to the existing production service and can play in the same tables as browser users. iOS should remain supportable from the same codebase.

**Current authority note (2026-09-28):** `docs/MOBILE_APP_DESIGN_V2.md` owns app-level IA, navigation, Back/Browse/Return, room-context menus, and responsive/short-wide composition. The C17 documents below remain authoritative for gameplay interaction semantics. Where older C17 shell/menu/landscape text conflicts with Mobile App Design v2, v2 wins; the technical safety boundaries in this file remain unchanged.

## C17 product/UI authority

For C17 gameplay and product presentation, the authoritative specification is `docs/C17_UX_CONTRACT.md`.

- `docs/C17_UX_DECISIONS.md` records the ratified product decisions and later beta-scope revisions behind the current v1.2 baseline.
- `docs/C17_VALIDATION.md` records unresolved on-device validation gates and physical results.
- `docs/archive/MOBILE_GAMEPLAY_REDESIGN.md` is historical/preliminary and is subordinate to the C17 contract where presentation or gesture decisions conflict.
- C16 presentation decisions are also subordinate to the C17 contract where they conflict.

This does **not** supersede the technical boundaries below: server authority, pinned upstream game semantics, reconnect/epoch safety, no gameplay-command replay across reconnect, and the dependency boundaries remain architectural requirements.

## Current runtime map

Current implementation is composed in two levels. [`application.ts`](../src/runtime/application.ts) creates one platform `HanabNetworkSession`, the `LobbyRuntime` facade, a gameplay command suppression proxy, `TerminationRuntime` and `ChatRuntime`, wiring them to the imported shared Redux store. [`LobbyRuntime`](../src/runtime/LobbyRuntime.ts) constructs its connection, bootstrap, gameplay, attendance, table-management, history and replay collaborators. There is no separate `HanabClient` class; the older diagram below is a historical design sketch.

| Owner | Current responsibility and state |
| --- | --- |
| [`NetworkSession`](../src/network/NetworkSession.ts) | Platform HTTP/socket creation and authentication session; native networking keeps cookies private. |
| [`ConnectionRuntime`](../src/runtime/ConnectionRuntime.ts) | Current socket/listeners, monotonic connection epoch, single-flight attempt ownership, welcome timeout, retries and app-active state. It owns transport resources, not authoritative game state. |
| [`sessionSlice`](../src/store/sessionSlice.ts) | Authentication identity, connection phase/current epoch, settings and sanitized diagnostics. |
| [`roomSlice`](../src/store/roomSlice.ts) | Server-derived attendance and headless game `clientState`; local pending command, recovery and migration bookkeeping. Actual room kinds: `none`, `pregame`, `awaiting_game_bootstrap`, `live_game`. Finished/replay state is inside `live_game.clientState`. |
| [`GameBootstrapCoordinator`](../src/game/bootstrap/GameBootstrapCoordinator.ts) | Temporary load/epoch, table/replay expectations, phase/watchdog, staged pause and latest matching replay leader, segment and efficiency modifier. It commits reduced authoritative history into Redux. It does not own a second long-lived live-game store. |
| Domain runtimes | Gameplay/notes/pause, attendance, table management, history/replay creation and replay/hypothetical eligibility/encoding/event handling through injected capabilities and Redux. They do not own sockets. |
| Other Redux slices | Lobby/users/tables, chat, history, session messages, termination workflow and preferences. Request flags and drafts are local; received server records remain server-derived snapshots. |
| [`App.tsx`](../App.tsx) / [`C17GameScreen`](../src/ui/game/C17GameScreen.tsx) | Local shell/task focus, Back routing, interaction selection, editor drafts and layout/review presentation. Browsing focus is separate from attendance; selecting an action is separate from Redux's pending gameplay send guard. |

[`store.ts`](../src/store/store.ts) stores the upstream-derived game tree in `room.room.clientState`; only that large subtree is excluded from repeated serializability scans. Surrounding Redux state and every action remain checked. Pending gameplay means an uncertain send, not server acceptance or an instruction to retry. Card-bound state follows stable authoritative `card.order`.

The headless tree mixes ownership deliberately: `clientState.ongoingGame` and accepted game history derive from the server, while `clientState.replay` also holds local Rewind cursors, following preferences and solo Hypothetical projections. Shared-review controls and branches mirror server events. App/C17 selections, editor drafts and presentation are local interaction state, not another live-game authority; inspection never commits server game state.

Inbound processing is synchronous:

```text
NetworkSocket callback -> ConnectionRuntime socket/epoch guard
-> LobbyRuntime.onMessage -> protocol decode/validation
-> cross-domain orchestration or domain/bootstrap collaborator
-> Redux/headless game reducers -> selectors/view models -> UI
```

History, replay/hypothetical and note groups are delegated to their domain runtimes. Welcome/recovery, attendance/bootstrap transitions, migration and warning/error ordering remain visible in the facade. Redux subscribers can run during each dispatch. Current Live reducer failures invalidate transport ownership before diagnostics can expose another send opportunity ([#234](https://github.com/BarsukovSergey/hanab-mobile/pull/234)); this does not classify every unknown or malformed frame as a lost authoritative action.

Outbound gameplay follows `UI -> application suppression proxy -> LobbyRuntime -> GameplayRuntime eligibility/pending guard + protocol encoder -> LobbyRuntime.sendEncoded -> ConnectionRuntime.send -> current READY socket`. Other WebSocket domain commands use the same READY sender capability, with matching room/table/epoch checks where required. The presentation suppression proxy complements domain and transport checks. UI never talks to a raw WebSocket; protocol/domain code stays platform-independent.

`socket.send` success proves local submission only. There is no outgoing gameplay queue. Play/Discard/Clue are never persisted, retried or replayed across a connection boundary; reconnect rebuilds from fresh welcome/attendance hints and authoritative history. Delayed native Terminate confirmations capture their original connection epoch, table and load and recheck eligibility before sending ([#235](https://github.com/BarsukovSergey/hanab-mobile/pull/235), [`terminationRuntime.ts`](../src/runtime/terminationRuntime.ts)).

Generic warning/error messages contain no request correlation. If one arrives while matching unfinished current-room gameplay is pending, ownership is invalidated before diagnostic/notice/pending dispatch; authoritative recovery resolves acceptance or rejection without retransmitting the action ([#236](https://github.com/BarsukovSergey/hanab-mobile/pull/236)). This also applies while Rewind displays an earlier state. An accepted authoritative turn settles pending first, so a later unrelated warning keeps READY. Without pending gameplay, existing room/history cleanup and notice handling remain; this fix does not invent correlation for those requests.

## HTTP delivery ownership

Session-probe delivery now has separate ownership from socket epochs ([#238](https://github.com/BarsukovSergey/hanab-mobile/pull/238), commit `95d729851c5e25a4e426183636b1e6e3afaa56d1`, resolving [#226](https://github.com/BarsukovSergey/hanab-mobile/issues/226)). `LobbyRuntime.sessionOperationGeneration` and an optional delivery predicate reject obsolete probe/sign-out completions before destructive session reset. `superseded` is a runtime-only result, distinct from valid/missing/indeterminate HTTP evidence. App auth operations use a local ref guard after probe/login/recent-credential/credential-save/logout awaits; cleanup invalidates delivery before disconnect. If a still-owned App probe loses runtime ownership to a connection boundary, it obtains fresh HTTP evidence; the covered single-boundary sequence makes one fresh probe without opening an extra socket or looping. The `NetworkSession` API and HTTP 200/204/error semantics are unchanged. These guards do not cancel native HTTP requests or cookie mutations already in flight.

Deferred behavioral tests in [`App.runtime.integration.test.tsx`](../src/ui/App.runtime.integration.test.tsx) and runtime coverage protect real App/runtime ownership, late missing/valid results, new auth work, reconnect and unmount/remount. The [`account chooser source contract`](../src/platform/accountChooserContract.test.js) follows the additional ownership argument while retaining its credential-state restriction.

## Bootstrap provenance and ordering

The connection epoch plus owned socket identity rejects callbacks/resources from old connections. A local game-load epoch rejects stale local coordinator calls/timers. Neither identifies an originating same-table request when a wire frame carries no local load token. `init` and `gameActionList` carry tableID; the facade passes its current local load epoch on receipt. Some hypothetical frames omit table context; other replay frames carry tableID or uppercase TableID. Preserve those distinctions.

Ordering evidence uses the baseline pin `e78e82bce2ff5d54b9d2ec359530955fd354e9b7` and replay orchestration pin `8be709c48145ad56a1891307663ed3bec2cd4175`, as scoped in [UPSTREAM.md](./UPSTREAM.md). At the baseline, `server/src/go.mod` pins Melody v1.0.2: its per-socket reader invokes the message handler inline; `server/src/websocket_message.go` invokes commands inline. Table commands lock the table; `server/src/session.go` writes to one session output queue. Successfully enqueued/delivered messages retain order; a full output buffer can drop frames, so this is not an exactly-once delivery guarantee. Other users/admin/timers still operate independently under their applicable locks.

Repeated spectator perspective commands can produce same-table starts. If both updates precede the first info1 handler, its init already reflects the latest perspective even when the newer local load accepts it. An older history received while the newer load waits for init is discarded. This demonstrates local attribution limits, not proven corruption. `getGameInfo2` emits history before its unscoped hypothetical snapshot; the tested sequence restores hypothetical branch state through that snapshot after incremental hypothetical events were ignored during rebuilding. This does not establish restoration of every replay event, leader/segment state, or the absence of other bootstrap races. Departure removes active spectating under table lock, and previously queued frames precede later bootstrap output on the same connection.

[Raw-frame coverage in #237](https://github.com/BarsukovSergey/hanab-mobile/pull/237) exercises these orders through [`LobbyRuntime.test.ts`](../src/runtime/LobbyRuntime.test.ts), labels overlap requiring raw sends while normal UI methods are blocked, and verifies follower replay snapshot restoration without live action sends. [#223](https://github.com/BarsukovSergey/hanab-mobile/issues/223) records the investigation. A receive-time local epoch is not a wire correlation mechanism; prefer avoiding ambiguous overlap or replacing the connection when recovery requires fresh provenance.

[Issue #239](https://github.com/BarsukovSergey/hanab-mobile/issues/239) demonstrated a distinct shared-replay synchronization defect between init and history. [PR #240](https://github.com/BarsukovSergey/hanab-mobile/pull/240) fixes that lost control state; the hypothetical snapshot test in #237 alone did not cover these fields.

The coordinator stages only the latest post-init `replayLeader`, `replaySegment` and `replayEfficiencyMod` while the still-current shared-replay load waits for history. It requires matching READY connection, table and local load ownership. After history reduction, the coordinator applies the existing headless reducers for leader, an available segment and efficiency modifier before `bootstrapCompleted`, so the first published state includes these authoritative changes. A requested segment absent from rebuilt history is not applied. Post-history events retain ordinary `ReplayInteractionRuntime` routing. This is bounded field staging, not a generic frame queue; live `gameAction` loading traffic remains discarded and no outgoing command is buffered or replayed. See [`GameBootstrapCoordinator.test.ts`](../src/game/bootstrap/GameBootstrapCoordinator.test.ts) and the raw runtime tests. The #223 wire-provenance limitation remains separate; this fix does not create missing request IDs or prove every replay bootstrap race impossible.

## Coverage and architecture closeout

[`ConnectionRuntime.test.ts`](../src/runtime/ConnectionRuntime.test.ts), [`GameplayRuntime.test.ts`](../src/runtime/GameplayRuntime.test.ts), [`terminationRuntime.test.ts`](../src/runtime/terminationRuntime.test.ts) and bootstrap/domain suites cover policies and ownership. Raw socket fixtures in [`LobbyRuntime.test.ts`](../src/runtime/LobbyRuntime.test.ts) cover decode/routing, state and sends across boundaries. Existing UI source-contract tests intentionally protect structural/product contracts; inspect them before moving JSX. Behavioral/helper tests are preferred for new policies where practical.

For [#187](https://github.com/BarsukovSergey/hanab-mobile/issues/187), closeout requires the agreed concrete safety work ([#217](https://github.com/BarsukovSergey/hanab-mobile/issues/217), [#218](https://github.com/BarsukovSergey/hanab-mobile/issues/218)), explicit ownership, useful integration coverage and the physical baseline under [#143](https://github.com/BarsukovSergey/hanab-mobile/issues/143). Investigations #220-#222 led to the bounded safety fixes in PRs #234-#236; they do not require further decomposition. #223 records tested ordering and an open wire-provenance limitation, not proof that every bootstrap replay race is ruled out. Stop without a new framework, event bus, facade rename or decomposition solely for line count unless evidence justifies a bounded change. Software tests do not close native-device gates.

## Historical MVP stack proposal

The initial MVP plan used the following stack list; it is retained as historical planning context:

- Expo development build
- React Native
- TypeScript (strict)
- Redux Toolkit
- Zod
- Jest

The initial plan deferred these additions; current changes still require explicit task authorization for dependencies:

- Expo Router / React Navigation
- Axios
- React Query
- SQLite
- WebView
- UI frameworks
- animation frameworks
- state-machine frameworks
- third-party cookie managers

## Historical risk-first implementation order

1. Physical Android `NetworkSession` proof — **GO, completed 2026-08-30**
2. Upstream game-core compatibility / containment
3. Deterministic protocol + lobby runtime
4. Table-entry vertical slices — **C4-A spectate GO and C4-B join/pregame/leave GO, completed 2026-08-31**
5. Game bootstrap — **C5 GO, completed 2026-08-31**
6. Read-only live spectator — **C6 GO, completed 2026-08-31**
7. Play / Discard / Clues — **C7 GO, completed 2026-08-31**
8. Finished-game proof
9. Reconnect / reattend / background lifecycle
10. Create / Start table
11. Chat / polish / Android build cleanup

See `docs/archive/C1_RESULTS.md` for the physical-device evidence behind the C1 decision,
`docs/archive/C4A_RESULTS.md` for the physical Android running-table spectate proof, and
`docs/archive/C4B_RESULTS.md` for the physical Android join/pregame/leave proof. See
`docs/archive/C5_RESULTS.md` for the physical Android player and spectator game-bootstrap proof, and
`docs/archive/C6_RESULTS.md` for the physical Android read-only live spectator proof. See
`docs/archive/C7_RESULTS.md` for the physical Android active gameplay-actions proof.

## Historical C1 Android evidence

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

C1 also observed that the existing socket closed while the app was backgrounded on the test device. A fresh socket after foreground authenticated successfully without re-login. This is historical device evidence; current lifecycle behavior and outstanding physical validation are described below. Do not assume a socket survives backgrounding.

## Network ownership

HTTP login, session probing, and WebSocket creation share one logical platform boundary. The core auth/transport methods are shown below; [`network/types.ts`](../src/network/types.ts) defines the full interface, including history HTTP requests:

```ts
interface NetworkSession {
  checkSession(): Promise<SessionCheckResult>;
  submitLogin(username: string, password: string): Promise<void>;
  logout(): Promise<void>;
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

## Historical protocol-layer sketch

This initial sketch is retained for history. The current concrete inbound/outbound paths are documented above; `HanabClient` was a conceptual layer, not an implemented class:

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

## Historical runtime effect model

The early design described deterministic transitions as follows. This remains a useful testing principle, not a claim that the current runtime is implemented as one effects interpreter. Do not add a state-machine dependency:

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

## Historical room-state sketch

This early illustrative union is not the current `roomSlice.RoomState`; see the current ownership map above. The discriminated-union principle remains applicable:

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

Historical C2 proof goals were:

1. minimal reproducible dependency closure from pinned upstream;
2. strict TS compilation;
3. Jest/action-sequence behavior;
4. Metro bundling;
5. Android/Hermes runtime import;
6. serializability characteristics;
7. mutation/immutability semantics.

The early alternative was a separate `GameRuntime` if upstream state proved unsuitable for Redux. Current code stores headless state in `roomSlice`, as documented above. Do not globally disable Redux serializability checks as a shortcut.

Only tightly scoped game-boundary code may import vendored upstream types. UI/network/lobby code must not.

## Game bootstrap

Current handshake:

```text
server → tableStart
client → getGameInfo1
server → init
client → getGameInfo2
server → gameActionList
client → loaded                  # players become present after history is applied
server → gameAction ...
```

The coordinator discards live `gameAction` traffic during an active bootstrap; it does not buffer or concatenate deferred traffic with authoritative history. Only live players send `loaded`, after successful history reduction; spectators and replay viewers do not.

Game bootstrap uses a local `gameLoadEpoch`, connection ownership and matching table ID. Their wire-provenance limits are documented above. A deliberate retry after terminal bootstrap failure replaces the connection and uses fresh welcome hints, rather than repeating the original room-opening command.

Loading phases `waiting_init` / `waiting_history` have watchdogs and expose a terminal failed state.

## Mobile lifecycle

Reconnect is authoritative resynchronization, not continuation of trusted stale client state.

Physical Android C1 evidence showed that the old WebSocket may close while the app was backgrounded, while the underlying authenticated HTTP session remains reusable. A fresh socket after foreground authenticated successfully without re-login.

Current `ConnectionRuntime` preserves a healthy owned READY connection on normal foreground. Background cancels retry scheduling; signaled close/error invalidates ownership, and foreground resumes connection maintenance when needed. A native socket can potentially remain OPEN after its network path dies; fake sockets cannot establish Android close/error delivery. [#227](https://github.com/BarsukovSergey/hanab-mobile/issues/227) requires physical background/network-loss testing tied to the exact APK, device/OS and delays. This is an unverified device edge, not permission to reconnect on every foreground. Recovery must preserve epoch/single-flight/disposal rules and never replay gameplay commands.

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

## Historical first playable proof

The initial milestone asked for one complete No Variant game Android ↔ browser before reconnect hardening:

```text
login
→ lobby
→ spectate/join
→ receive game
→ play/discard/clue
→ finish game
```

This historical milestone does not replace current candidate-specific reconnect and physical closeout requirements.
