# Runtime instructions

Scope: `src/runtime/**`.

Primary authority: `docs/ARCHITECTURE.md`. For Phase 2 navigation/room ownership changes also read `docs/MOBILE_APP_DESIGN_V2.md`.

## Invariants

- The server is authoritative for session, lobby, room, and gameplay state.
- Reconnect is authoritative resynchronization, not continuation of trusted stale client state.
- Connection/open work remains single-flight and epoch-guarded.
- Stale callbacks, timers, subscriptions, and async results cannot mutate the current runtime.
- Outgoing gameplay commands are READY-only and are never queued, persisted, retried, or replayed across a connection boundary.
- Do not invent protocol facts in runtime code; protocol parsing/encoding belongs under `src/protocol`.
- Browsing presentation focus must not silently change authoritative attendance.
- Do not enable room-preserving Browse until safe task suspension and visibility-owned side effects required by Mobile App Design v2 are implemented.

## Change discipline

`LobbyRuntime.ts` and its tests are large. Do not use a bounded feature task as a reason for a broad runtime rewrite. Prefer extracting one explicit policy/helper when the task needs a new seam.

## Validation

Run `npm run validate` and `git diff --check`. Add focused runtime tests for transition/epoch/send-gate changes.
