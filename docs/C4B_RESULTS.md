# C4-B Results — Join, Pregame, and Leave

Status: **GO**

Test date: 2026-08-31

## Decision

**C4-B GO. C5 game bootstrap is next.**

The controlled physical Android proof completed the READY lobby → join → authoritative
pregame → leave → lobby path without an observed app, RedBox, or runtime error.

## Implementation summary

C4-B adds the smallest unprotected, non-running table join vertical slice on top of the C4-A
runtime:

- the proof UI offers only eligible non-running, non-replay, non-joined, unprotected tables
  that are not full;
- join and leave commands are sent once through the current READY runtime connection and are
  never queued, persisted, retried, or replayed across a connection boundary;
- attendance requires both the matching authoritative `joined` event and authoritative `game`
  pregame snapshot, while tolerating either arrival order;
- a matching authoritative `left` event returns the client to the lobby;
- connection epochs reset pending join/leave and room state, so stale callbacks cannot mutate
  the current state; and
- a matching non-replay `tableStart` takes precedence and transitions a player to the existing
  `awaiting_game_bootstrap` boundary, with bootstrap still `pending_c5`.

## Pinned protocol findings

Against the upstream commit pinned in `docs/UPSTREAM.md`, joining an eligible table sends:

```text
tableJoin {"tableID":123}
```

The normal authoritative server order for the joining session is:

```text
game {"tableID":123,...}
joined {"tableID":123}
```

The client nevertheless accepts either `game` / `joined` arrival order and enters pregame only
after both matching events. The `game` event is the authoritative pregame snapshot.

Leaving sends:

```text
tableLeave {"tableID":123}
```

The pinned server response uses the exported Go field name exactly:

```text
left {"TableID":123}
```

Only a matching authoritative `left` completes the leave transition. These findings and the
consumed C4-B pregame fields are recorded in `docs/PROTOCOL.md`.

## Automated validation

Results obtained for the completed C4-B tree on 2026-08-31:

- `npm run typecheck` — PASS.
- `npm test` — PASS: 5 suites, 44 tests, 0 snapshots.
- `git diff --check` — PASS.
- `npm run lint` — not available; the repository has no `lint` script.

Coverage includes exact join/leave frame encoding, strict `game` / `joined` / `left` decoding,
join eligibility and READY-only sending, both authoritative join event orders, pregame snapshot
updates, matching authoritative leave, `tableStart` precedence, and connection-epoch stale-event
protection.

## Physical Android proof

The controlled production proof on a physical Android device established:

- connection phase was READY and the lobby was hydrated;
- an eligible non-running, unprotected table was selected;
- Join sent successfully;
- the authoritative Pregame view appeared correctly;
- Leave returned the client to Lobby; and
- no app, RedBox, or runtime error was observed.

## Scope boundary

C4-B does not implement protected-table passwords, table creation/start controls, replay-table
behavior, game bootstrap, gameplay, reconnect/reattend, or lifecycle recovery. It does not send
`getGameInfo1`, process `init`, process game history or live actions, resolve bootstrap overlap or
deduplication, create a game-load epoch, or add bootstrap watchdogs.

C5 is the next milestone and retains responsibility for the authoritative game-bootstrap work.
