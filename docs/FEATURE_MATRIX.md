# Hanab Mobile Feature Matrix

This file is the persistent gap tracker between the mobile client and the functionality required for a useful Hanab Mobile 1.0.

A milestone is not closed while one of its rows is accidentally unaccounted for: each capability must be implemented or explicitly deferred.

| Capability | Mobile status | Target milestone | Notes |
| --- | --- | --- | --- |
| Login / HTTP session probe / WS welcome | DONE | — | Server-authoritative authenticated session lifecycle. |
| Connection recovery / foreground resume | DONE | — | Stale-epoch guards and no replay of gameplay commands across connection boundaries. |
| Lobby user/table lists | DONE | — | Typed authoritative lobby state. |
| Join pregame / leave pregame | DONE | — | `tableJoin` / `tableLeave`. |
| Basic table creation | DONE | C13 expansion | Create flow supports the exposed 1.0 table options and supported variants. |
| Start game | DONE | — | Owner-only, server-authoritative transition. |
| Spectate ongoing game | DONE | — | Authoritative bootstrap supported. |
| Player / spectator live-game -> Lobby | DONE | — | `tableUnattend`, authoritative own-user Lobby confirmation. |
| Play / discard / color clue / rank clue | DONE | — | No optimistic authoritative gameplay state. |
| Live game bootstrap / reattend | DONE | — | `getGameInfo1 -> init -> getGameInfo2 -> gameActionList`, player `loaded` handshake. |
| Lobby + table chat | DONE | — | Server echo/history authoritative; production Go wire compatibility. |
| Logout | DONE | — | Explicit server logout and signed-out Redux reset. |
| Autonomous Android release build | DONE | C17 hardening | Release build works without Metro / laptop; distribution hardening remains. |
| In-game review / rewind | DONE | C12 | Persisted action timeline and intermediate replay states while live game continues; physically verified. |
| Proper postgame result lifecycle | DONE | C12 | Finished-state handling and result lifecycle physically verified. |
| Full card reveal after game | DONE | C12 | `cardIdentities` handling and replay knowledge physically verified across historical segments. |
| Shared replay after game | DONE | C12 | Shared replay state and replay bootstrap physically verified. |
| Shared replay turn synchronization | DONE | C12 | Leader synchronization, follower breakaway, and Follow Leader physically verified. |
| Replay participants / leader state | DONE | C12 | Replay participant and leader state physically verified. |
| Quick rematch | DONE | C12 | Quick Rematch and new-game lifecycle physically verified. |
| Shared replay reconnect / recovery | DONE | C12 | Lobby return-to-game and kill/relaunch recovery physically verified. |
| Password-protected table create/join | DONE | C13 | Passwords are transient outbound input only; physically verified. |
| Variant compatibility matrix | DONE | C13 | Vendored `VARIANT_NAMES` and table options are filtered through one capability predicate; physically verified. |
| Full supported variants / modifiers UI | DONE | C13 | Supported variants and the exposed C13 modifiers are available in create/edit; physically verified. |
| Timed table settings in create/edit | DONE | C14 | Bounded timed configuration and defaults physically verified. |
| Edit table settings / name / max players | DONE | C13 | Authoritative `tableUpdate` lifecycle preserves unexposed options; physically verified. |
| Pregame leader transfer | DONE | C13 | Authoritative `tableSetLeader` lifecycle; physically verified. |
| Restart to pregame | DONE | C13 | Server-confirmed migration with `hidePregame:false`; physically verified. |
| Pregame spectator parity | DONE | C13 | Pregame spectate, recovery, authoritative attendance, and unattend physically verified. |
| Card notes | DONE | C14 | Player/spectator/replay notes and upstream-sized card/stack-base note state physically verified; visual polish remains C16. |
| Game clocks / timed-game UI | DONE | C14 | Server clock state, local display ticking, pause freeze and review/reconnect timing physically verified. |
| Pause / unpause / queued pause | DONE | C14 | Server-authoritative pause and post-send queue lifecycle physically verified. |
| Terminate game / vote to terminate | DONE | C14 | Authoritative self-vote echo, vote toggle, threshold termination, and confirmed direct termination physically verified. |
| Player connected / away state | DONE | C14 | In-game presence/away transitions physically verified; visual polish remains C16. |
| Full live action log UX | DONE | C12 / C14 | Live action updates and replay/postgame log behavior physically verified; visual polish remains C16. |
| Game history list / pagination | NOT IMPLEMENTED | C15 | `historyGet` + local history screen. |
| Game history details | NOT IMPLEMENTED | C15 | Score/options/players/end condition/timestamps/seed metadata. |
| Open old game as replay | NOT IMPLEMENTED | C15 | Reuse C12 replay engine; create/load replay from game ID. |
| Seed comparison / other scores | NOT IMPLEMENTED | C15 optional | Useful but not required for the first history/replay slice. |
| App shell / scalable screen structure | PARTIAL | C16 | Avoid continuing to grow `App.tsx` as the long-term router. |
| Full visual redesign / design system | NOT IMPLEMENTED | C16 | Typography, color, spacing, components, game/table/chat/replay/history screens. |
| Android Back / modal navigation semantics | NOT IMPLEMENTED | C16 | Must never accidentally emit gameplay/leave commands. |
| Loading / empty / error-state polish | PARTIAL | C16 | Functional states exist; consistent UX polish remains. |
| App icon / splash / branding polish | NOT IMPLEMENTED | C16 / C17 | Final assets before distribution. |
| Permanent package/version strategy | NOT IMPLEMENTED | C17 | Package ID, versionCode/versionName and update compatibility. |
| Release signing / distributable APK or AAB | NOT IMPLEMENTED | C17 | Current local release proof is not store/distribution readiness. |
| Clean-install / update regression suite | NOT IMPLEMENTED | C17 | Include logout/session/recovery/replay/rematch regression. |
| About / licenses / release checklist | NOT IMPLEMENTED | C17 | Required release housekeeping. |
| Private messages | DEFERRED | Post-1.0 | Upstream `chatPM`; useful but not a 1.0 blocker. |
| Friends / social features | DEFERRED | Post-1.0 | Friend lifecycle and related notifications. |
| Typing indicators / chat read state | DEFERRED | Post-1.0 | Chat itself is already functional. |
| Discord linking | DEFERRED | Post-1.0 | Not required for core play. |
| Advanced replay: hypotheticals | DEFERRED | Post-1.0 | Replay core comes first. |
| Advanced replay: arrows / sounds / efficiency mod | DEFERRED | Post-1.0 | Power-user shared-replay functionality. |
| Tags | DEFERRED | Post-1.0 | Non-core metadata workflow. |
| Secure remembered account password | DEFERRED | Post-1.0 | If implemented, use Android Keystore / iOS Keychain only with explicit opt-in. |
| Push notifications | DEFERRED | Post-1.0 | Not required for core gameplay. |

## Closed milestones

- C12 — CLOSED / GO. In-game review, postgame, shared replay, quick rematch and recovery physically verified.
- C13 — CLOSED / GO. Table/variant parity and pregame lifecycle physically verified.
- C14 — CLOSED / GO. Notes, presence, live log, timed clocks, pause/queue, vote/termination and reconnect/review timing physically verified.

## 1.0 milestone order

1. C12 — in-game review, postgame, shared replay, quick rematch.
2. C13 — table parity and supported options/variants.
3. C14 — remaining important live-game controls.
4. C15 — history and old-game replay.
5. C16 — complete UI/UX redesign and screen/navigation polish.
6. C17 — release hardening and distribution readiness.
