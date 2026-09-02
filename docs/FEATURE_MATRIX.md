# Hanab Mobile Feature Matrix

This file is the persistent gap tracker between the mobile client and the functionality required for a useful Hanab Mobile 1.0.

A milestone is not closed while one of its rows is accidentally unaccounted for: each capability must be implemented or explicitly deferred.

| Capability | Mobile status | Target milestone | Notes |
| --- | --- | --- | --- |
| Login / HTTP session probe / WS welcome | DONE | — | Server-authoritative authenticated session lifecycle. |
| Connection recovery / foreground resume | DONE | — | Stale-epoch guards and no replay of gameplay commands across connection boundaries. |
| Lobby user/table lists | DONE | — | Typed authoritative lobby state. |
| Join pregame / leave pregame | DONE | — | `tableJoin` / `tableLeave`. |
| Basic table creation | DONE | C13 expansion | Current create flow is intentionally restricted; full settings parity is not done. |
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
| Password-protected table create/join | IMPLEMENTED / UNVERIFIED | C13 | Passwords are transient outbound input only; physical verification remains. |
| Variant compatibility matrix | IMPLEMENTED / UNVERIFIED | C13 | Vendored `VARIANT_NAMES` and table options are filtered through one capability predicate; physical verification remains. |
| Full supported variants / modifiers UI | IMPLEMENTED / UNVERIFIED | C13 | Supported variants and the five C13 modifiers are available in create/edit; physical verification remains. |
| Timed table settings in create/edit | IMPLEMENTED / UNVERIFIED | C14 | C14-B1 includes bounded timed configuration; physical verification remains. |
| Edit table settings / name / max players | IMPLEMENTED / UNVERIFIED | C13 | Authoritative `tableUpdate` lifecycle preserves unexposed options; physical verification remains. |
| Pregame leader transfer | IMPLEMENTED / UNVERIFIED | C13 | Authoritative `tableSetLeader` lifecycle; physical verification remains. |
| Restart to pregame | IMPLEMENTED / UNVERIFIED | C13 | Server-confirmed migration with `hidePregame:false`; physical verification remains. |
| Pregame spectator parity | IMPLEMENTED / UNVERIFIED | C13 | Pregame spectate, recovery, authoritative attendance, and unattend are implemented; physical verification remains. |
| Card notes | IMPLEMENTED / UNVERIFIED | C14 | C14-A player/spectator/replay notes plus upstream-sized card and stack-base note state; physical verification remains. |
| Game clocks / timed-game UI | IMPLEMENTED / UNVERIFIED | C14 | C14-B1 server clock state and local display ticking; physical verification remains. |
| Pause / unpause / queued pause | IMPLEMENTED / UNVERIFIED | C14 | C14-B1 server-authoritative pause and post-send queue lifecycle; physical verification remains. |
| Terminate game / vote to terminate | IMPLEMENTED / UNVERIFIED | C14 | C14-B2 authoritative self-vote echo, vote toggle, and confirmed direct termination; physical verification remains. |
| Player connected / away state | PARTIAL | C14 | Recovery exists; complete in-game presence presentation remains. |
| Full live action log UX | PARTIAL | C12 / C14 | Current UI only exposes a minimal finished log; timeline/full log comes with replay core. |
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

## 1.0 milestone order

1. C12 — in-game review, postgame, shared replay, quick rematch.
2. C13 — table parity and supported options/variants.
3. C14 — remaining important live-game controls.
4. C15 — history and old-game replay.
5. C16 — complete UI/UX redesign and screen/navigation polish.
6. C17 — release hardening and distribution readiness.
