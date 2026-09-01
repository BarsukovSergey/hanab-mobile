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
| In-game review / rewind | NOT IMPLEMENTED | C12 | Persist action timeline + intermediate replay states while live game continues. |
| Proper postgame result lifecycle | NOT IMPLEMENTED | C12 | `gameHistory`, end condition, full result metadata/log and finished-state handling. |
| Full card reveal after game | NOT IMPLEMENTED | C12 | Handle `cardIdentities` and rehydrate scrubbed actions. |
| Shared replay after game | NOT IMPLEMENTED | C12 | Handle `finishOngoingGame`, shared replay state and replay bootstrap. |
| Shared replay turn synchronization | NOT IMPLEMENTED | C12 | Leader segment via `replayAction`; follower can break away / follow leader. |
| Replay participants / leader state | NOT IMPLEMENTED | C12 | Spectators + `replayLeader`; leader transfer may be included when state is added. |
| Quick rematch | NOT IMPLEMENTED | C12 | `tableRestart {tableID, hidePregame:true}` with full boot/new-table lifecycle. |
| Shared replay reconnect / recovery | NOT IMPLEMENTED | C12 | Replay-aware `tableStart`, `init`, `gameActionList` bootstrap. |
| Password-protected table create/join | NOT IMPLEMENTED | C13 | Must preserve secret-handling rules; never log/store table passwords. |
| Variant compatibility matrix | NOT IMPLEMENTED | C13 | Expose only variants the vendored reducer/selectors/RN UI can correctly support. |
| Full supported variants / modifiers UI | NOT IMPLEMENTED | C13 | Expand create/edit only after compatibility audit. |
| Timed table settings in create/edit | NOT IMPLEMENTED | C13 / C14 | Configuration in C13; full clocks/gameplay behavior in C14. |
| Edit table settings / name / max players | NOT IMPLEMENTED | C13 | `tableUpdate` lifecycle. |
| Pregame leader transfer | NOT IMPLEMENTED | C13 | `tableSetLeader`. |
| Restart to pregame | NOT IMPLEMENTED | C13 | `tableRestart` with `hidePregame:false`. |
| Pregame spectator parity | PARTIAL | C13 | Basic live spectating exists; full pregame spectator behavior does not. |
| Card notes | NOT IMPLEMENTED | C14 | Player/spectator/replay notes and authoritative note messages. |
| Game clocks / timed-game UI | NOT IMPLEMENTED | C14 | Clock state and timer UX. |
| Pause / unpause / queued pause | NOT IMPLEMENTED | C14 | Server-authoritative pause lifecycle. |
| Terminate game / vote to terminate | NOT IMPLEMENTED | C14 | Proper permissions, vote state, and end-condition handling. |
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
