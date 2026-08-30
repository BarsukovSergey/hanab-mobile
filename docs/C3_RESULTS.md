# C3 Results — Typed Protocol + Deterministic Lobby Runtime

Status: **GO**

Test date: 2026-08-31

## Decision

**C3 GO — typed protocol and deterministic lobby runtime proven on physical Android.**

C3 establishes the typed lobby protocol boundary, deterministic connection ownership, and normalized lobby state required before later table and game milestones. It does not start C4.

## Automated validation

The completed automated proof covers:

- first-ASCII-space frame decoding, including JSON payloads containing spaces;
- Zod validation for `welcome`, lobby snapshots, incremental user/table events, and server warning/error events;
- safe handling of unknown commands and malformed known commands;
- readiness only after a valid `welcome`, not merely WebSocket OPEN;
- monotonically increasing connection epochs and rejection of stale messages, closes, and delayed socket results;
- single-flight connection attempts and welcome timeout disposal;
- outgoing send gating before readiness, with no queue, retry, or replay;
- normalized user/table upsert and removal behavior;
- epoch reset of lobby entities and snapshot flags; and
- lobby hydration only after `welcome`, `userList`, and `tableList` belong to the current connection epoch.

Final validation results:

- `npm run typecheck`: pass.
- `npm test`: pass — 5 suites, 23 tests, 0 snapshots.
- `npx expo-doctor`: pass — 21/21 checks.
- `npm ls --depth=0`: pass.
- `git diff --check`: pass (line-ending conversion notices only, no diff errors).

The C3 implementation uses `@reduxjs/toolkit@2.12.0` and `react-redux@9.3.0` for normalized application state and React bindings. No networking replacement, cookie manager, reconnect library, or state-machine dependency was added.

## Physical Android evidence

The C3 development-build proof passed on the real Android device:

```text
connectionEpoch: 1
connection phase: ready
welcome: YES
userList: YES
tableList: YES
lobby hydrated: YES
users count: 41
tables count: 5
protocol issue count: 0
session probe: VALID / HTTP 200
no RedBox/runtime protocol failure
```

The existing C2 physical game-core proof also continued to pass under Hermes in the C3 build.

This device evidence proves that the production session, built-in React Native WebSocket, typed protocol decoder, runtime controller, Redux store, and lobby selectors execute together successfully on physical Android.

## Scope boundary

C3 does not implement automatic reconnect, AppState/background lifecycle policy, or automatic table reattendance. The `welcome` resume hints are retained as typed state only; they do not trigger reattendance.

Automatic reconnect, AppState handling, and reattend remain deferred to **C9**. They must follow the documented epoch, single-flight, disposal, authoritative resynchronization, and no-command-replay rules when C9 begins.

C4 has not been started.
