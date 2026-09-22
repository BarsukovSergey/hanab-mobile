# Hanab Mobile Feature Matrix

> **Historical milestone tracker.** This matrix predates the distributed `1.0.0-beta.1` baseline and contains stale C16/C17 planning statuses. Do not use it as current release authority. For current beta scope use `README.md`, `docs/ANDROID_BETA_RELEASE.md`, `docs/C17_UX_CONTRACT.md`, and `docs/C17_BACKLOG.md`.

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
| Card notes | DONE | C14 | Player/spectator/replay notes and upstream-sized card/stack-base note state physically verified across the functional path; C16 visual redesign implemented, acceptance pending. |
| Game clocks / timed-game UI | DONE | C14 | Server clock state, local display ticking, pause freeze and review/reconnect timing physically verified; C16 visual redesign implemented, acceptance pending. |
| Pause / unpause / queued pause | DONE | C14 | Server-authoritative pause and post-send queue lifecycle physically verified. |
| Terminate game / vote to terminate | DONE | C14 | Authoritative self-vote echo, vote toggle, threshold termination, and confirmed direct termination physically verified. |
| Player connected / away state | DONE | C14 | In-game presence/away transitions physically verified; C16 visual redesign implemented, acceptance pending. |
| Full live action log UX | DONE | C12 / C14 | Live action updates and replay/postgame log behavior physically verified; C16 visual redesign implemented, acceptance pending. |
| Game history list / pagination | DONE | C15 | Automatic first page and `historyGet` pagination physically verified on Android. |
| Game history details | DONE | C15 | Game ID, variant, players, timestamps, score and end condition physically verified on Android. |
| Open old game as replay | DONE | C15 | Authoritative solo replay creation reuses the C12 replay engine; correct game ID, replay navigation and Lobby exit physically verified on Android. |
| Seed comparison / other scores | DEFERRED | Post-1.0 | Optional history enhancement; not required for C15 or Hanab Mobile 1.0 core replay flow. |
| App shell / scalable screen structure | DONE | C16 | Major authenticated surfaces extracted from `App.tsx`; explicit local Lobby/History navigation physically verified on Android. |
| Full visual redesign / design system | IMPLEMENTED / UNVERIFIED | C16 | Shared theme tokens and responsive login/lobby/pregame/history/chat/game/replay/postgame surfaces are implemented; project validation and physical phone/tablet acceptance remain. |
| Android Back / modal navigation semantics | DONE | C16 | Role-aware hardware Back physically verified: players stay protected, spectators use authoritative leave/unattend flows, historical replay Back returns to History, and explicit Lobby returns to Lobby. |
| Loading / empty / error-state polish | IMPLEMENTED / UNVERIFIED | C16 | Session, connection, history, table/chat empties, pending gameplay, replay and paused states use the shared C16 visual language; acceptance remains. |
| App icon / splash / branding polish | PARTIAL | C16 / C17 | In-app Hanab branding and adaptive theme/orientation integration are implemented; final icon/splash assets remain C17. |
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
- C15 — CLOSED / GO. History browsing, pagination, metadata, authoritative solo replay loading, replay navigation and Lobby exit physically verified on Android; unsupported-history Watch remains covered by automated compatibility tests because no matching historical game was available during physical acceptance.
- C16A — CLOSED / GO. App shell extraction and role-aware Android Back/navigation semantics physically verified on Android; dev selector and replay-state invariant-check noise cleaned up before visual redesign.

C16 remaining UI work is **IMPLEMENTED / UNVERIFIED**. Do not promote C16 to CLOSED / GO until project-level automated validation and physical Android phone/tablet acceptance are complete.

## 1.0 milestone order

1. C12 — in-game review, postgame, shared replay, quick rematch.
2. C13 — table parity and supported options/variants.
3. C14 — remaining important live-game controls.
4. C15 — history and old-game replay.
5. C16 — complete UI/UX redesign and screen/navigation polish.
6. C17 — release hardening and distribution readiness.
