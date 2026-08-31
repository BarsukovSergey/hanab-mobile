# C4-A Results — Running-table Spectate

Status: **GO**

Test date: 2026-08-31

## Implementation summary

C4-A adds the smallest running-table spectate vertical slice on top of the C3 typed lobby runtime:

- the proof UI lists only running, non-replay, non-joined tables;
- selecting **Spectate** sends one typed command through the current READY runtime connection;
- the request is neither queued nor replayed across a connection boundary;
- the client waits for an authoritative, matching `tableStart` before entering a room;
- room state is reset for each new connection epoch, and stale callbacks cannot restore it;
- the resulting room is a spectator `awaiting_game_bootstrap` state whose bootstrap is explicitly `pending_c5`.

No game bootstrap, C4-B join/leave/pregame behavior, or replay-table behavior is included.

## Exact pinned `tableStart` semantics

Against the upstream commit pinned in `docs/UPSTREAM.md`, ordinary spectating of a running table sends exactly:

```text
tableSpectate {"tableID":123,"shadowingPlayerIndex":-1}
```

The authoritative server transition is:

```text
tableStart {"tableID":123,"replay":false}
```

The `tableStart` payload requires an integer, non-negative `tableID` and a boolean `replay`. For the C4-A running-table path, `replay` must be `false`, and `tableID` must match the outstanding spectate request. A malformed payload, a different table ID, or `replay: true` does not transition the room. Receipt of the valid matching event clears the pending request and enters the spectator room; it does not trigger `getGameInfo1` or any other C5 bootstrap command.

## Automated validation

Run on 2026-08-31:

- `npm run typecheck` — PASS.
- `npm test -- --runInBand` — PASS: 5 suites, 31 tests, 0 snapshots.
- `npm run lint` — not available; the repository has no `lint` script.
- `git diff --check` — PASS before commit.

The automated coverage includes exact command encoding, strict `tableStart` validation, eligibility gating, READY-only/no-queue sending, authoritative matching transition, rejection of malformed/mismatched/replay starts, and connection-epoch stale-event protection.

## Physical Android proof

Production proof on a physical Android device established:

- connection phase: `READY`;
- welcome: `YES`;
- lobby hydrated: `YES`;
- a real production running table was selected;
- **Spectate** succeeded;
- authoritative `tableStart` was received;
- the spectator room was entered;
- bootstrap remained `PENDING C5`;
- no C5 bootstrap was triggered;
- no runtime failure was observed.

## Decision

**C4-A GO.** The typed running-table spectate path is proven end to end on physical Android against production hanab.live.

## C5 deferral

C5 remains explicitly deferred. C4-A stops after the authoritative spectator-room transition. It does not send `getGameInfo1`, process `init` or history, resolve live-action overlap/deduplication, create a game-load epoch, or start bootstrap watchdogs. C4-B is also not started by this result.
