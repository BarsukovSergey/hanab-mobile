# Upstream parity audit

Date: 2026-09-27

Status: **planning snapshot reconciled with mobile `main` through PR #129; beta.2 remains the current tester line**

## Scope and source of truth

This audit compares Hanab Mobile against the public Hanabi-Live upstream repositories and the current
mobile repository state.

Upstream repositories reviewed:

- `Hanabi-Live/hanabi-live`
  - current `main`: `aed0d81d02b32136d6136c8ddd386d529ab04415`
  - mobile baseline game/protocol pin: `e78e82bce2ff5d54b9d2ec359530955fd354e9b7`
  - mobile card-presentation pin: `7a9c601b66f5966f7e33564855e25f82e68a94ed`
  - mobile Hypothetical replay-core pin: `8be709c48145ad56a1891307663ed3bec2cd4175`
- `Hanabi-Live/hanabi-live-bot`
  - current `main`: `e8e8f36d4fb63cc7d5fa931212d25708fad5638e`

Mobile repository reviewed at:

- `BarsukovSergey/hanab-mobile`
- current `main`: `cdc9bafd6f40b2b7ec49261bda3ad20381be6af5` (PR #129 merge)
- distributed beta.2 runtime remains frozen at `45d99d15960d04934ea0ce07fcb90db73eb206df` (PR #84 runtime candidate)
- distributed beta.1 runtime remains frozen at `d297ad71153095f18fba3101f760e306ed69e214`

The audit uses:

- upstream `docs/features.md` and `docs/chat-commands.md`;
- upstream WebSocket command handlers and settings schema;
- current upstream client behavior where the mobile project deliberately vendors/adapts it;
- the reference bot repository;
- mobile protocol schemas, reducers, runtimes, UI, tests, current authority docs, and backlog.

The public web client is not treated as a pixel-for-pixel mobile specification. A web-only interaction
can be `N/A` while its underlying capability is still important on mobile.

## Legend

### Status

- **Full** — the mobile product exposes the relevant capability with compatible authoritative
  semantics in the intended supported scope.
- **Partial** — meaningful support exists, but an important part of the upstream behavior or mobile
  workflow is missing.
- **Wire-only** — protocol/state support exists but there is no useful first-class mobile UI.
- **Missing** — no meaningful mobile support.
- **Unsupported** — mobile deliberately rejects the table/mechanic rather than attempting partial
  gameplay.
- **N/A** — web-specific behavior that should not be copied literally to mobile.
- **Drift** — mobile copied/adapted upstream behavior but current upstream has since changed in a way
  that matters.

### Effort

- **XS** — small, isolated UI/reducer fix; usually hours rather than a feature slice.
- **S** — one small thematic PR.
- **M** — multiple components/protocol/UI states, but no new rules engine.
- **L** — substantial product/runtime work or broad validation.
- **XL** — difficult mechanics/layout work with many interactions and significant regression risk.

### Importance

- **Critical** — correctness/safety/interoperability issue.
- **High** — important for normal mobile play or a major upstream capability.
- **Medium** — meaningful parity/product value but not required for ordinary beta play.
- **Low** — niche, cosmetic, web-specific, or power-user convenience.

## Executive summary

Hanab Mobile is **not** a thin or incomplete Hanabi client. The difficult authoritative core is
already present:

- authenticated session/cookie lifecycle;
- authoritative table create/join/leave/reconnect;
- 2P/3P live Play/Discard/Clue;
- timed games and pause;
- card knowledge, negative/positive clue deductions, pips, critical/trash/DDA semantics;
- card notes with upstream parsing semantics;
- empathy;
- live rewind;
- finished/solo replay;
- shared-replay follow/detach/leader behavior;
- Hypothetical play/discard/clue/back/reveal plus controller-only card morph/unmorph behavior;
- spectator read-only gameplay;
- history pagination and solo replay opening;
- most browser-local slash-command transport;
- a very large portion of the upstream variant catalog.

The biggest remaining parity gaps are now concentrated in five areas:

1. **Replay/review power features**: replay arrows/annotations, efficiency-mod origin controls, optional shadow-link handling, and other advanced review/navigation tools. JSON import, `/copy` export/share, replay-link opening/import, and bounded running-game/pregame link opening are already implemented.
2. **Tags and richer history/profile workflows**: Add/display tag UI exists; richer tag search/delete management, arbitrary-player history, and richer profile/best-score surfaces remain.
3. **Product/social surfaces**: optional linked-account UX and richer profile/settings workflows; account-management entry points and multi-bot invite UI are already implemented.
4. **Chat/presentation long tail**: authoritative table-chat unread/read state and session PM dialogs now exist; typing, sounds, reverse-hand preference, and other non-core presentation settings remain.
5. **Explicitly unsupported rule families/options**: 184 variants plus speedrun, deck-play and detrimental-character tables.

Since the original audit snapshot, major parity slices have landed: adaptive real-card 4P–6P layout (#37–#41), bundled card presentation modes and settings (#50–#51), People/context actions (#52/#59), random table-name parity (#63), Pregame stats (#65), Pregame spectators (#67), friend-aware Lobby discovery (#69), Friends history (#71), same-seed Other Scores (#73), first-class game tags (#76), shared replay creation from History (#77), shared-replay suggestion receive/UI (#78), live table-chat unread state (#79), direct `/r` submission handling (#80), session PM Dialogs (#82/#83), account-management UX (#88), native Pregame Kick/Find/Missing tools (#90), the multi-bot Create/Pregame picker including transient protected-table joins (#91), server maintenance/shutdown status notices (#104), live lobby table-progress plus server-backed table-chat read-state synchronization (#105), H-group gameplay status cues (#107), variant-aware clue/discard resource-state cues (#108), server-backed gameplay presentation settings (#110), stronger friend visibility in People/Lobby (#111), authoritative mute-state chat guarding (#112), and first-class Hypothetical card morph/unmorph controls (#114). Spectator perspective switching is also first-class in the live Game menu.

The protocol surface is already broad. The command/event matrices below remain useful capability inventories, but the original aggregate counts are no longer treated as live totals after these later parity slices.

The deeper audit found three concrete semantic/interoperability defects that should not be confused
with general feature backlog. All three have since been resolved:

- **pregame spectator cleanup drift** after upstream #3129 — resolved in #26;
- **dynamic shared-replay efficiency modifier synchronization** — resolved receive-side in #29;
- **Pace/FRE presentation context differed from upstream** — resolved in #30.

## Highest-value findings

Recently completed high-value parity work:
- spectator perspective / player shadow selector;
- colorblind + styled-number card presentation;
- People/Pregame/live-game contextual Friend/Unfriend and session PM Dialog actions;
- compact Pregame player stats and spectator list;
- random table-name parity and friend-aware Lobby discovery;
- Friends history and same-seed Other Scores;
- game tag display/Add flow;
- shared replay creation from History and turn-suggestion receive/UI;
- live table-chat unread state and direct `/r` submission handling.
- H-group Low Score, locked-hand and Double Discard presentation cues (#107).
- variant-aware clue availability and discard-state presentation cues (#108).
- server-backed H-group features and Real-life mode presentation settings (#110).
- friends-first People ordering plus visible friend emphasis in People and Lobby tables (#111).
- authoritative mute-state retention and source-faithful local chat/PM guard (#112).
- controller-only Hypothetical card morph/unmorph UI with persistent Edit cards mode (#114).
- authoritative arbitrary JSON replay import plus generalized replay-create source/visibility bootstrap validation (#116), including the shared-History replay bootstrap regression fix.
- source-faithful finished-review `/copy` export/share with anonymized selected-segment GameJSON, Hypothetical continuation/morph support, upstream-compatible compression, clipboard/share actions, and local chat-command handling (#118).
- unified History replay input for raw JSON plus canonical ID/compressed hanab.live replay links, including clipboard paste and a separate arbitrary-ID replay request path that preserves known-History guards (#120).
- bounded Lobby opening for canonical running-game `/game/<tableID>` links, reusing authoritative Lobby eligibility plus existing reattend/spectate paths and a shared clipboard boundary (#122).
- bounded `/pre-game/<tableID>` opening with authoritative Lobby membership/eligibility, player-only join semantics, and transient password handling through the existing `join` path (#124).
- authoritative History seed/turn metadata plus exact Copy seed through the shared clipboard boundary, with stale async copy feedback guarded locally (#126).
- native specific-seed Create over upstream `!seed [suffix]` semantics (#128), plus canonical History `Play this seed` prefill with player/variant matching and one-shot local handoff (#129).

The highest-value remaining items are:

| Item | Status | Effort | Importance | Why |
| --- | --- | --- | --- | --- |
| Richer tag management/search/delete | Partial | S–M | Medium | Add/display UI is implemented; structured search/delete/list management remains. |
| Rich player profile / arbitrary-player history | Partial | M–L | Medium | People/context actions exist; richer profile/history presentation does not. |
| Chat typing/presentation polish | Partial | S–M | Low | Authoritative table unread/read state is implemented; typing, sounds and other presentation polish remain. |

---

# 1. Session, account and lobby shell

| Upstream capability | Mobile status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Login using existing hanab.live account | **Full** | — | Critical | Uses platform-owned cookies, verifies `/test-cookie`, then requires realtime `welcome`. |
| Session persistence across relaunch | **Full by platform session** | — | High | No app password persistence is needed. |
| Logout | **Full** | — | High | Network/session teardown is explicit and conservative. |
| Account creation | **Full** | — | Medium | Upstream has no separate register endpoint: an unknown username submitted to `/login` creates an account. Mobile now explains this behavior and preserves the unique-password warning. |
| Change password | **Full** | — | Medium | Settings uses the authenticated username plus transient current/new password fields and sends upstream-compatible `newPassword` through `/login`; password values are not stored in Redux/application state. |
| Password reset | **Full entry point** | — | Medium | Login and Settings open the authoritative upstream `/password-reset` page; mobile does not invent a separate recovery protocol. |
| First-time tutorial (`firstTimeUser`) | **Missing** | M | Low–Medium | Field is sent in `welcome` but intentionally dropped by mobile schema. |
| Account mute state (`muted`) | **Full mobile guard** | — | Low | PR #112 retains authoritative `welcome.muted` and blocks non-empty chat/slash/direct-PM sends locally with the pinned-web warning while the server remains authoritative. |
| Server shutdown / maintenance metadata | **Full mobile status UI** | — | Medium | PR #104 retains authoritative welcome/live status and surfaces bounded maintenance/shutdown notices. |
| Random default table name | **Full** | — | Low | PR #63 uses authoritative `randomTableName` and `getName` for Create-table name generation/refresh. |
| Inactive/active session status | **Full transport** | — | Medium | Mobile sends `inactive` on app lifecycle and consumes user inactivity state. |
| Online user model | **Full data + People UI** | — | Medium–High | `userList/user/userLeft` state backs the People/context-action surface. |
| User list rendering | **Full basic** | — | Medium–High | People exposes the online registry with contextual actions. |
| Friend-aware lobby sorting | **Full** | — | Medium | PR #69 adds friend-aware Lobby discovery/order and friend context. |
| Friend visual highlighting | **Full mobile presentation** | — | Medium | PR #111 puts the current user first, emphasizes friends in People, and accents friend-bearing Lobby tables/player names while preserving player/spectator friend semantics. |
| Current lobby restructure | **Full** | — | High | PR #32 implements Your running game → Pregame → Create → Running → Shared replays, without duplicating the own reattendable game. |
| Hide Create while own game is reattendable | **Full** | — | High | PR #32 hides Create while the user has a reattendable own running game. |
| Distinct Shared replay lobby section | **Full** | — | Medium–High | PR #32 renders shared replays separately from ordinary Running tables. |
| Lobby chat | **Full basic** | — | Medium | Send/receive/history works. |
| Discord-replicated lobby chat | **Full basic** | — | Low | Replicated messages render normally; pinned web likewise does not add a distinct Discord-origin marker. Rich Discord emoji rendering remains optional presentation polish rather than a provenance-parity requirement. |

### Authentication protocol difference

Mobile deliberately submits `version=bot` to `POST /login`, using the server's documented bot
exception to bypass the browser client's exact bundle-version check. This is an architectural
compatibility choice, not a missing feature. It should remain explicit because mobile app versioning
cannot reasonably track the website's browser-bundle integer one-for-one.

## Recommendation

The highest leverage shell feature is not a large new protocol layer. It is a **People + contextual
actions surface** backed by state already present in Redux. It can unlock profile/player-info,
PM, friend/unfriend, spectator perspective and bot discovery without changing the server.

---

# 2. Pregame and table lifecycle

| Capability | Mobile status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Create table | **Full basic** | — | High | Name/password/max players/supported options. |
| Password-protected table create/join | **Full** | — | High | Password kept transient; good mobile security boundary. |
| Join as player | **Full** | — | High | Authoritative confirmation required. |
| Pregame spectate | **Full basic** | — | Medium | Works, but perspective shadowing is missing. |
| Switch player → spectator | **Full** | — | Medium | Role-switch handshake implemented. |
| Switch spectator → player | **Full** | — | Medium | Password re-entry supported when needed. |
| Leave/unattend/reattend | **Full normal path** | — | High | Includes reconnect/resume handling. |
| Start game | **Full** | — | High | Uses intended-player confirmation. |
| Set/take leader | **Full** | — | Medium | Native UI + slash aliases. |
| Table option updates | **Full for exposed options** | — | High | Owner applies; non-owner proposals remain server authoritative. |
| Table option proposals | **Full** | — | Medium | Mobile parses server proposal chat and gives owner Apply button. |
| Pregame spectators list | **Full basic** | — | Medium | Authoritative `pregameSpectators` snapshots are retained and displayed. |
| Pregame player stats | **Full compact** | — | Medium | Authoritative total/variant games, average, strikeout rate, and player-count best score are preserved and shown. |
| Pregame player profile shortcut | **Missing** | S–M | Medium | Depends on People/profile work. |
| Kick player native action | **Implemented + chat fallback** | — | Medium | Owner-only Pregame action sends the authoritative `/kick [username]` command. |
| Auto-start next join / N players | **Chat fallback only** | — | Low–Medium | `/s`, `/s2`…`/s6`; native controls are intentionally not planned. |
| Timed auto-start `/startin` | **Chat fallback only** | — | Low | Keep slash-command fallback; native countdown controls are intentionally not planned. |
| Split / splitauto | **Chat fallback only** | S–M | Low | Useful mainly for large community pregames. |
| Find variant / missing scores helpers | **Implemented + chat fallback** | — | Medium | Pregame Team tools send authoritative `/findvariant` and `/missing` commands. |
| Multi-bot invite during Create | **Implemented** | — | Medium–High | Reconciled `game` + `joined` triggers one PM batch; protected tables use transient `/join <password>` only for capability-verified bots. |
| Multi-bot invite in Pregame | **Implemented** | — | Medium | Online registry bots are grouped Available/Busy, selection is capped by free seats, and protected-table passwords are requested transiently. |

## Resolved upstream drift: spectator table deletion

Upstream commit `86257b4dec36b1d36b3a61beaaf3e1a5aa053bbe` (#3129) changed the server so that
when the last player leaves an unstarted table it actively removes remaining pregame spectators and
sends them a `left` event.

PR #26 reconciled mobile with that behavior: unsolicited authoritative pregame `left` cleanup is
handled instead of leaving a spectator stranded on a deleted table.

**Classification:** Resolved drift / correctness fix
**Effort:** —
**Importance:** High

---

# 3. Core gameplay and card semantics

| Feature from upstream | Mobile status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Play card | **Full in accepted beta scope** | — | Critical | Explicit select + Play confirmation. |
| Discard card | **Full in accepted beta scope** | — | Critical | Explicit select + Discard confirmation. |
| Give color clue | **Full** | — | Critical | Uses authoritative variant clue choices. |
| Give rank clue | **Full** | — | Critical | Includes special-character clue semantics. |
| Empty clue legality | **Full** | — | High | Preview and confirmability match option. |
| Clue touched-card indication | **Full core / mobile-adapted** | — | High | Preview and committed marker semantics are implemented. |
| Retouch distinction | **Full** | — | Medium | Marker distinguishes retouched clue. |
| Positive clue orange border | **Full** | — | High | Upstream-compatible card knowledge. |
| Negative clue deduction | **Full** | — | High | Headless upstream reducer applies negative information. |
| Empathy hold | **Full** | — | High | Long press with lifecycle-safe clearing. |
| Global empathy | **Full mobile extension** | — | Medium | Persistent global toggle; not a web limitation. |
| Suit/rank pips and elimination | **Full** | — | High | Uses upstream deduction state. |
| Critical indicator | **Full** | — | High | Upstream marker assets/semantics. |
| Trash / known-trash / empathy-trash distinction | **Full** | — | High | Separate fade/marker semantics. |
| DDA card marker | **Full card-level** | — | Medium | Uses upstream DDA state and H-group conditions. |
| Needs Fix / ? / ! markers | **Full** | — | Medium | Upstream note semantics preserved. |
| Discard viewer | **Full mobile adaptation** | — | High | Uses authoritative identities and suit piles. |
| Fireworks/play stacks | **Full** | — | High | Variant-aware suit count. |
| Current player / YOUR TURN | **Full** | — | High | Stable seating; no hand reordering. |
| Score / Max / Clues / Strikes / Deck | **Full semantics** | S for hierarchy polish | High | Core values are implemented; PR #108 adds pinned-upstream clue availability coloring while broader HUD hierarchy remains polish. |
| Pace | **Full presentation semantics** | — | Medium | Final-round/All-or-Nothing suppression, signed display and PaceRisk treatment match upstream. |
| Future Required Efficiency | **Full presentation semantics** | — | Medium | FRE uses upstream review/shared modifier policy and exposes calculation details on tap. |
| Minimum Required Efficiency | **Full presentation semantics** | — | Medium | Immutable `metadata.minEfficiency` is shown alongside FRE in the compact Eff HUD. |
| Low-score-phase warning | **Full presentation semantics** | — | Low–Medium | PR #107 applies the variant-derived H-group Low Score treatment and suppresses it during Hypothetical. |
| Locked-hand / Double Discard current-player warning | **Full presentation semantics** | — | Medium | PR #107 reuses vendored locked-hand state and authoritative Double Discard state with pinned-upstream priority and gating. |
| Clue/discard resource-state cues | **Full presentation semantics** | — | Medium | PR #108 adds variant-aware no/one/max clue coloring plus blocked/Double Discard discard borders, suppressed in real-life mode and Hypothetical. |
| Full clue log | **Partial** | M | Medium | Mobile has Last Action + Recent timeline, not the full web clue-log behavior. |
| Hover clue/card cross-highlighting | **N/A as hover**, mobile equivalent missing | M | Low–Medium | Could become tap/press contextual highlighting. |
| Card-specific replay jump shortcuts | **Missing mobile equivalents** | M | Medium | Web can jump to draw/first-clue/play/discard/strike via different clicks. |
| Card animation richness | **Partial** | L | Low | Mobile intentionally keeps minimal state-change motion. |
| Gameplay sounds | **Missing** | M | Low–Medium | All upstream action/result/H-group sounds absent. |

## Stats presentation nuance

The mobile client has the authoritative upstream stats state, but its current compact HUD is a
simplified presentation rather than full web parity.

Current upstream web:

- suppresses Pace once the final round has effectively started;
- suppresses Pace for All or Nothing;
- colors Pace by `paceRisk`;
- shows both Future Required Efficiency and immutable Minimum Required Efficiency;
- omits note/manual efficiency adjustments during an in-game rewind;
- in finished shared review, uses the shared efficiency modifier only while following shared turns.

Mobile now routes Pace/Eff through one presentation selector matching those upstream context rules.
The compact HUD keeps Pace visible as `-` when suppressed, presents `Eff` as `FRE | MRE`, applies
note/manual/shared efficiency adjustments only in the authoritative contexts where upstream does,
and exposes the calculation context in a read-only details surface. This resolves #30. PRs #107 and
#108 additionally restore pinned-upstream H-group and clue/discard resource-state cues without
changing gameplay legality. The broader visual-HUD hierarchy remains a separate polish backlog item.

## 4P–6P

The rules/state path supports 2–6 players, and the current C17 portrait allocator now uses adaptive
real-card rows for ordinary 4P–6P. The own hand is protected, opponent card faces may compress to the
accepted 46 dp floor, dense side-label rows/chrome reclaim vertical space, and `Compact Overview`
remains an emergency fallback only when geometry cannot meet the real-card floor.

Physical Android validation on 2026-09-23 covers 5P, ordinary true 6P, and 6P + One Extra Card with
the authoritative four-card hand capacity. The dense clue composer also fits without scrolling and
the lower workspace respects the Android navigation safe area. This does not retroactively expand
the frozen beta.1 gate or claim full device-matrix/serious-play validation.

**Status:** Full for the current portrait layout path
**Effort:** — (resolved in #37–#41)
**Importance:** High

The dedicated diagnosis and historical failure modes remain in `docs/4P_6P_LAYOUT_RESEARCH.md`; current
physical evidence is recorded in `docs/C17_EVIDENCE.md` and `docs/C17_VALIDATION.md`.

---

# 4. Variants and table options

## Variant catalog

Current vendored `variants.json` contains **2426** variants.

Mobile accepts **2242** and deliberately rejects **184** because their mechanics are not covered by
the mobile client boundary.

The excluded families are disjoint in the current catalog:

| Unsupported mechanic | Variants |
| --- | ---: |
| Throw It in a Hole | 44 |
| Up or Down | 33 |
| Sudoku | 33 |
| Cow & Pig | 4 |
| Duck | 4 |
| Alternating Clues | 66 |
| **Total unsupported** | **184** |

The code also defensively rejects inverted/reversed-suit mechanics, but the current vendored catalog
has zero variants hitting those predicates.

Current upstream `main` and the mobile vendored variant file have the same variant-name set; there
is no current variant-list drift.

### Option matrix

| Option | Mobile status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Ordinary variants | **Full for 2242 accepted variants** | — | High | Uses vendored upstream data/rules. |
| Timed games | **Full** | — | High | Create/update, clocks, pause/queued pause. |
| Speedrun | **Unsupported** | XL | Low | Different controls and behavior; explicitly rejected. |
| Card Cycling | **Full** | — | Medium | Exposed at create/update and handled by upstream reducer. |
| Bottom-Deck Blind-Play (`deckPlays`) | **Unsupported** | L | Low–Medium | Requires deck action UI/eligibility and validation. |
| Empty Clues | **Full** | — | Medium | Explicitly validated. |
| One Extra Card | **Full core + current dense validation** | — | Medium | Current 6P portrait path is physically validated with the authoritative four-card hand capacity on the tested Android class. |
| One Less Card | **Full** | — | Medium | Supported in create/update. |
| All or Nothing | **Full core** | — | Medium | End conditions represented. |
| Detrimental Characters | **Unsupported** | XL | Low–Medium | Broad rule/UI restrictions; explicitly rejected. |
| Password protection | **Full** | — | High | Transient secret handling. |

### Unsupported variant-family effort

| Mechanic family | Effort | Importance | Why |
| --- | ---: | ---: | --- |
| Throw It in a Hole | L | Low–Medium | Special discard/hole state and presentation. |
| Up or Down | XL | Low | Nonstandard rank progression and note/knowledge implications. |
| Sudoku | XL | Low | Distinct stack/rule semantics. |
| Cow & Pig | XL | Low | Specialized mechanic with tiny catalog footprint. |
| Duck | XL | Low | Specialized mechanic with tiny catalog footprint. |
| Alternating Clues | L–XL | Low–Medium | Changes clue availability/type semantics across turns. |

Recommendation: do **not** chase “2426/2426” as a vanity metric before the common product gaps are
closed. The current 2242 variants already represent the overwhelming majority of upstream content.

---

# 5. Notes, knowledge and card-presentation parity

| Capability | Status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Notes keyed by card order | **Full** | — | Critical | Prevents slot migration. |
| Ordinary text notes | **Full** | — | High | Editable live and historical by current policy. |
| Identity notes | **Full parser semantics** | — | High | Upstream identity grammar retained. |
| Partial identity notes | **Full parser semantics** | — | High | Suit/rank possibilities supported. |
| Finesse border | **Full** | — | Medium | Quick token + rendering. |
| Chop Move border | **Full** | — | Medium | Quick token + rendering. |
| Play/Discard permission style | **Full semantics** | — | Medium | Via upstream note parser/presentation. |
| KT/trash/stale/bad | **Full semantics** | — | Medium | Marker/fade distinctions preserved. |
| Fix / ? / ! | **Full** | — | Medium | Quick controls present. |
| Blank / Clued / Unclued semantics | **Full parser, partial UI** | S | Medium | Text works; dedicated one-tap buttons are backlog. |
| Bracketed context / stacked effects | **Full** | — | Medium | Parser/composition supports it. |
| Turn insertion | **Full mobile equivalent** | — | Low–Medium | Quick button. |
| Repeat previous note | **Full mobile equivalent** | — | Low–Medium | Session-local previous note. |
| Identity picker | **Missing** | M | Medium | Backlog. |
| Previous / Next / Save-and-next | **Missing** | M | Medium | Backlog. |
| Instant read-mode quick tags | **Missing** | S–M | Medium | Backlog. |
| Hold-and-drag note peeking | **Missing** | M | Low–Medium | Backlog. |
| Deep Knowledge workspace | **Missing** | L | Low–Medium | Backlog. |
| Compare cards/hands | **Missing** | L | Low–Medium | Backlog. |

# 6. Per-user settings

The server sends the complete upstream settings object in `welcome`. Mobile deliberately retains a
bounded subset needed by supported product flows instead of mirroring every web preference.

The mobile Settings screen now exposes server-backed card appearance plus H-group/Real-life gameplay
presentation controls alongside its local theme/accent/developer and account controls. Other upstream
settings remain intentionally unelevated until they have a useful mobile workflow.

| Upstream setting | Mobile status | Effort | Importance | Recommendation |
| --- | --- | ---: | ---: | --- |
| `desktopNotification` | Missing / web-specific | M for native push | Low | Do not copy desktop notifications; evaluate native push separately. |
| `soundMove` | Missing | M | Low–Medium | Only after adding sounds. |
| `soundTimer` | Missing | M | Low | Same. |
| `volume` | Missing | S once sound exists | Low | Same. |
| `keldonMode` | Missing | L | Low | Mobile layout should not chase desktop table geometry unless requested. |
| `colorblindMode` | **Full** | — | **High** | Server-backed switch with generated pinned-upstream card presentation. |
| `realLifeMode` | **Full** | — | Low | PR #110 exposes the server-backed switch; #107/#108 presentation cues honor it. |
| `reverseHands` | Missing | S–M | Medium | Useful player preference; current display direction is fixed. |
| `styleNumbers` | **Full** | — | **High** | Server-backed switch with generated pinned-upstream styled-number assets. |
| `showTimerInUntimed` | Missing | S | Low | Optional. |
| `speedrunPreplay` | Missing + speedrun unsupported | L | Low | Defer. |
| `speedrunMode` | Missing + speedrun unsupported | L | Low | Defer. |
| `hyphenatedConventions` | **Full for mobile presentation** | — | Medium | PR #110 exposes the server-backed H-group features switch and C17 consumes the authoritative welcome/session setting for presentation. |
| `createTableVariant` | Missing persistence | S | Low–Medium | Mobile hardcodes defaults. |
| `createTableTimed` | Missing persistence | S | Low | Same. |
| `createTableTimeBaseMinutes` | Missing persistence | S | Low | Same. |
| `createTableTimePerTurnSeconds` | Missing persistence | S | Low | Same. |
| `createTableSpeedrun` | N/A while unsupported | — | Low | — |
| `createTableCardCycle` | Missing persistence | S | Low | Capability itself is supported. |
| `createTableDeckPlays` | N/A while unsupported | — | Low | — |
| `createTableEmptyClues` | Missing persistence | S | Low | Capability itself is supported. |
| `createTableOneExtraCard` | Missing persistence | S | Low | — |
| `createTableOneLessCard` | Missing persistence | S | Low | — |
| `createTableAllOrNothing` | Missing persistence | S | Low | — |
| `createTableDetrimentalCharacters` | N/A while unsupported | — | Low | — |
| `createTableMaxPlayers` | Missing persistence | S | Low | Mobile defaults to 5. |

Any additional server-backed setting should continue to use the authoritative `setting` command and
must not create mobile-only server preference storage.

---

# 7. H-Group-specific presentation

| H-Group feature from upstream docs | Mobile status | Effort | Importance |
| --- | --- | ---: | ---: |
| H indicator in online user list | **Full basic** | — | Low | People exposes an `H-group` pill from authoritative lobby-user state. |
| DDA card indication | **Full card-level semantics** | — | Medium |
| Empathy-based DDA card semantics | **Full card-level semantics** | — | Medium |
| Global double-discard situation warning | **Full presentation semantics** | — | Medium | PRs #107/#108 expose current-player Double Discard warning and discard-surface emphasis without changing legality. |
| Locked-hand notification | **Full presentation semantics** | — | Medium | PR #107 reuses vendored locked-hand state with pinned-upstream priority/gating. |
| Low Score Phase score treatment | **Full presentation semantics** | — | Low–Medium | PR #107 applies the variant-derived H-group treatment with Hypothetical suppression. |
| Discard-clued / DDA / order-chop-move sounds | **Missing** | M | Low |
| Hyphenated-convention-dependent card behavior | **Full effective state + toggle** | — | Medium | PR #110 adds the authoritative server-backed H-group features toggle used by the existing presentation semantics. |

---

# 8. Spectator parity

| Capability | Status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Spectate running game | **Full** | — | High | Read-only C17 workspace. |
| Spectate pregame | **Full basic** | — | Medium | See lifecycle drift above. |
| See all hands | **Full** | — | High | Uses authoritative spectator visibility. |
| Spectator count/list in live menu | **Full basic** | — | Medium | Names shown. |
| Spectator list in pregame | **Full basic** | — | Medium | Authoritative pregame spectator snapshots are retained and shown. |
| Shadow a player's perspective | **Full** | — | **High** | Live Game menu exposes All hands and every player seat through authoritative `tableSpectate` shadowing. |
| Show who each spectator is shadowing | **Data-only** | S | Medium | Spectator records retain shadowing fields. |
| Reconnect to previous shadow seat | **Full transport** | — | Medium | `disconShadowingSeat` retained in resume hints. |

Spectator shadowing is now exposed as a first-class live Game-menu action while keeping the server's `shadowingPlayerIndex` model authoritative.

---

# 9. Replay, shared replay and Hypothetical

## Replay

| Capability | Status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Live rewind | **Full core** | — | High | Current live state continues authoritatively. |
| Back/Forward action | **Full** | — | High | Mobile buttons. |
| Jump Start/End | **Full** | — | Medium | Mobile buttons/long-press behavior. |
| Scrubber | **Full but performance issue** | M | Medium | Issue #4; static diagnosis points at temporal recomputation/full-screen rerender. |
| Full clue log navigation | Partial | M | Medium | Recent actions only. |
| Jump from card to draw turn | Missing | M | Low–Medium | Web shortcut has no mobile equivalent. |
| Jump to first positive clue | Missing | M | Medium | Useful review affordance. |
| Jump from stack/discard to action | Missing | M | Low–Medium | Could be a contextual inspector action. |
| Finished game replay | **Full core** | — | High | Same C17 workspace. |
| Solo replay by database ID from own history | **Full** | — | High | `replayCreate source=id visibility=solo`. |
| Create shared replay from history | **Full** | — | Medium | PR #116 verifies requested shared visibility against authoritative `init.sharedReplay` and reaches the shared replay workspace. |
| Watch arbitrary JSON replay | **Full** | — | Medium | PR #116 adds History import for `source=json` with solo/shared visibility; mobile only parses a top-level JSON object and leaves GameJSON semantics to the server. |
| Export/copy current replay (`/copy`) | **Missing** | M | Medium | Explicit backlog. |
| Replay seed display | **Partial** | S | Medium | Legacy screen shows it; C17 primary portrait workflow does not clearly expose it. |
| Player times/result metadata | Partial | S–M | Low–Medium | Legacy has richer result detail than current C17 summary. |

## Shared replay

| Capability | Status | Effort | Importance |
| --- | --- | ---: | ---: |
| Join existing shared replay | **Full** | — | High |
| Leader segment broadcast | **Full** | — | High |
| Follower follow shared turns | **Full** | — | High |
| Follower detach/local review | **Full** | — | High |
| Transfer leader | **Full** | — | Medium |
| Suggest a turn | **Partial: send works, receive event missing** | S–M | Medium | `tableSuggest` can be sent, but mobile ignores authoritative `suggestion` broadcasts. |
| Shared arrows/annotations | **Missing** | M–L | Medium |
| Local arrows | **Missing** | M | Low–Medium |
| Shared replay sounds | Missing | M | Low |
| Efficiency-modifier synchronization | **Adopted (#29 receive-side)** | S | Medium | Initial `sharedReplayEffMod` and authoritative follower-side `replayEfficiencyMod` updates use the existing `setEffMod` semantic. User-facing modifier controls remain future work. |
| Explicit shared replay creation | **Full from History** | — | Medium |

## Hypothetical

| Capability | Status | Effort | Importance |
| --- | --- | ---: | ---: |
| Start/End Hypothetical | **Full** | — | High |
| Play for arbitrary actor | **Full** | — | High |
| Discard for arbitrary actor | **Full** | — | High |
| Give clues | **Full** | — | High |
| Back/undo branch action | **Full** | — | High |
| Reveal/hide drawn cards | **Full** | — | Medium |
| Follow leader while branch active | **Full** | — | High |
| Morph card to arbitrary identity | **Full mobile workflow** | — | Medium |
| Unmorph | **Full mobile workflow** | — | Medium |

PR #114 exposes the existing authoritative `morph` / `unmorph` semantics through an explicit
controller-only `Edit cards` mode. Solo Hypothetical applies changes locally; shared replay leaders
use the existing pending-operation / authoritative-echo path, followers cannot edit, turning Edit
cards off preserves morphs, and `Original` unmorphs an individual card.

---

# 10. History, profiles, seeds and tags

| Capability | Status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Own game history | **Full basic** | — | High | Pagination and replay opening. |
| History displays players/score/variant/end condition/date | **Full basic** | — | High | — |
| History displays seed | **Full** | — | Medium | PR #126 renders the authoritative seed and turn count on every History card source and supports exact Copy seed. |
| History displays tags | Missing UI | XS–S | Medium | Data already present. |
| History shows count played on same seed | **Full** | — | Medium | History cards expose `Other scores · N` from authoritative `numGamesOnThisSeed - 1`. |
| Other Scores / same-seed comparison | **Full** | — | Medium | Uses authoritative `historyGetSeed` / `gameHistoryOtherScores` and preserves server score ordering. |
| Friends history | **Full** | — | Medium | Separate authoritative collection and pagination via `gameHistoryFriends` / `historyFriendsGet`. |
| Other player's history | Missing native UI | M–L | Medium | Web/API supports it; mobile history state is self-only. |
| Player profile / best scores | **Missing native UI** | L | Medium | `chatPlayerInfo` only returns a short server message + web link. |
| Player-info command | **Full command transport** | — | Low–Medium | Native profile presentation missing. |
| Variant/global stats pages | Missing native UI / web endpoint available | L | Low | Do not prioritize before personal/profile flows. |
| Game tags add/delete | **Command support** | S for UI | Medium | No first-class workflow. |
| Tag search | **Command support** | M for results UI | Medium | Current server response is chat text with game IDs. |
| Tagged-games page | Missing native UI | M–L | Low–Medium | Web has dedicated pages. |
| Force seed via `!seed` table name | **Full native helper** | — | Medium | PR #128 exposes specific-seed Create without new protocol semantics; PR #129 adds safe History `Play this seed` prefill for canonical reproducible seeds. |
| Partial replay via `!replay` table name | **Server path available but undiscoverable** | S–M | Low–Medium | Better represented as replay tooling rather than teaching magic names. |

History now displays the already-received **seed, tags, turns, and same-seed count**. Native specific-seed Create and canonical History `Play this seed` prefill are implemented; broader seed browsing remains optional/web-oriented.

---

# 11. Chat, social and commands

## Chat presentation

| Capability | Status | Effort | Importance |
| --- | --- | ---: | ---: |
| Lobby chat | **Full basic** | — | Medium |
| Pregame/table chat | **Full basic** | — | High |
| PM send/receive | **Full basic** | — | Medium |
| PM conversation surface | **Partial** | S | Low–Medium | Session PM Dialogs are first-class; a dedicated threaded inbox/conversation surface is not. |
| Reply-to-last-PM `/r` | **Full** | — | Low | Direct `/r` submission handling landed in #80 while preserving the existing reply target semantics. |
| Unread count | **Full for table chat** | — | Medium | PR #105 applies authoritative `chatList.unread` to the current table room while preserving local live-message increments. |
| Mark chat read | **Full for table chat** | — | Low–Medium | PR #105 sends best-effort table-only `chatRead` through `LobbyRuntime` while visible. |
| Typing indicator | Missing | S–M | Low | No `chatTyping` sends/events. |
| Emoji shortcodes | Missing | S–M | Low | Direct Unicode works; upstream `:name:` conversion is browser-client logic. |
| Twitch/BTTV/FFZ emotes | Missing | M | Low | Mobile strips server/browser markup to safe plain text. |
| Linkification/clickable links | Partial/plain text | S | Low–Medium | Safe text is shown but browser-style rich links are not preserved. |
| Zen mode | Missing | M | Low | Web right-click interaction is desktop-specific. |
| Chat typed-history/tab-completion | N/A / missing mobile alternative | M | Low | Keyboard-specific power feature. |

## Friends and linked accounts

| Capability | Status | Effort | Importance |
| --- | --- | ---: | ---: |
| `/friend`, `/unfriend`, `/friends` | **Full command path** | — | Medium |
| Friends list state | **Full data** | — | Medium |
| Friends UI | **Strong partial** | S–M | Medium | PR #111 orders current user → friends → others and visibly emphasizes friends in People/Lobby; there is still no dedicated friends-only list or rich profile/social hub. |
| Friend-aware sorting | **Full** | — | Medium |
| `/link`, `/unlink`, `/linked` | **Full command path** | — | Low–Medium |
| Linked-account native UI | Missing | M | Low | Seed-avoidance purpose should be explained before exposing casually. |

## Slash-command parity

The browser has two command layers:

1. browser-local commands that map directly to typed WebSocket commands;
2. server chat commands, which are ordinary chat text beginning with `/`.

Mobile intentionally forwards unknown slash commands as ordinary chat, so a large set of server
commands already works without explicit mobile protocol code.

### Browser-local commands

| Command family | Mobile status |
| --- | --- |
| `/copy` | **Missing** |
| friend/unfriend/friends | Full |
| link/unlink/linked | Full |
| PM aliases | Full |
| set leader aliases | Full |
| set variant aliases | Full for supported variants |
| suggest | Full command path |
| tag/tagdelete/tagsearch/tagsdeleteall | Full command path |
| terminate/vote | Full + native controls |
| playerinfo/stats | Full command path |
| version | Full |
| reply `/r` | Partial edge case as described above |

### Server chat commands that already work through fallback

These do not need protocol implementations merely to function:

- `/help` and simple help/info responses;
- `/random`;
- `/replay`;
- `/token`;
- `/uptime`, `/timeleft`;
- auto-start aliases `/s`, `/s2` … `/s6`, `/si`;
- `/startin`;
- `/kick`;
- `/split`, `/splitauto`, `/sa`;
- `/impostor`;
- `/missing` / shared missing scores;
- `/findvariant` and random variant;
- server pause/unpause command path;
- `/tags` / `/taglist`;
- other ordinary server-only chat commands.

A native button is valuable only when mobile already has structured context that makes it clearer
than typing the command.

---

# 12. Direct WebSocket command audit

Current upstream server command map versus mobile:

| Client → server command | Mobile status | Notes |
| --- | --- | --- |
| `tableCreate` | Full | Typed encoder. |
| `tableJoin` | Full | Typed encoder. |
| `tableLeave` | Full | Typed encoder. |
| `tableUnattend` | Full | Typed encoder. |
| `tableReattend` | Full | Typed encoder. |
| `tableSetVariant` | Full command path | Generic send from ChatRuntime; supported variants only. |
| `tableSetLeader` | Full | Native + command. |
| `tableStart` | Full | Typed encoder. |
| `tableTerminate` | Full | Termination runtime. |
| `tableVoteForTermination` | Full | Termination runtime. |
| `tableSpectate` | Full | Typed encoder supports shadow index and live spectator perspective switching exposes authoritative player-shadow selection. |
| `tableRestart` | Full | Quick rematch/remake. |
| `tableUpdate` | Full exposed option subset | Preserves complete authoritative options on edit. |
| `tableSuggest` | Full | Shared-review suggestion send/receive and leader Accept/Dismiss UI are implemented. |
| `setting` | **Partial** | Card-presentation settings are supported; unrelated upstream settings remain out of scope. |
| `chat` | Full | — |
| `chatPM` | Full | — |
| `chatRead` | **Full for table chat** | PR #105 sends validated table-only read acknowledgements through the runtime boundary. |
| `chatTyping` | **Missing** | Typing gap. |
| `chatFriend` | Full | — |
| `chatUnfriend` | Full | — |
| `chatLink` | Full | — |
| `chatUnlink` | Full | — |
| `chatLinked` | Full | — |
| `chatPlayerInfo` | Full command path | Native profile absent. |
| `getName` | **Full** | Random create-table name refresh uses the authoritative server value. |
| `inactive` | Full | App lifecycle. |
| `historyGet` | Full | Own history. |
| `historyGetSeed` | **Full** | Same-seed Other Scores comparison. |
| `historyFriendsGet` | **Full** | Independent Friends history pagination. |
| `replayCreate` | **Full supported workflow** | Database-ID and arbitrary JSON replay creation both support solo/shared visibility; PR #116 validates the authoritative source/visibility result during bootstrap. |
| `tagSearch` | Full raw command path | Results only as server chat. |
| `getGameInfo1` | Full | Bootstrap. |
| `getGameInfo2` | Full | Bootstrap. |
| `loaded` | Full | Player bootstrap. |
| `tag` | Full command path | — |
| `tagDelete` | Full command path | — |
| `tagsDeleteAll` | Full command path | — |
| `action` | Full supported gameplay | Play/Discard/Clue. |
| `note` | Full | — |
| `pause` | Full | Timed game pause/queue. |
| `replayAction` | Full core | Segment/leader/hypo actions including mobile morph/unmorph controls. |

This table is the clearest evidence that many missing product features are **UI/state-selection
work**, not new networking work.

---

# 12A. Server → client event audit

Unknown WebSocket commands are intentionally future-compatible in mobile: `decodeServerFrame`
classifies them as `unknown`, `LobbyRuntime` records an inbound diagnostic, and then returns
without raising a protocol issue or mutating authoritative state. That means the gaps below are
generally **safe omissions**, not connection failures. The exception is where the ignored event is
itself authoritative state that mobile already presents.

Current upstream events missing from the mobile server-event schema include:

| Upstream event | Mobile effect today | Classification | Effort | Importance |
| --- | --- | --- | ---: | ---: |
| `name` | ignored | Missing convenience | XS–S | Low |
| `tableProgress` | ignored; lobby table progress remains at snapshot value | Missing presentation data | S | Low |
| `pregameSpectators` | handled | **Full basic** | — | Medium |
| `chatTyping` | ignored | Missing chat polish | S–M | Low |
| `shutdown` | ignored | Missing server-status UX | S | Medium |
| `maintenance` | ignored | Missing server-status UX | S | Medium |
| `soundLobby` | ignored | Missing sound parity | M with sound system | Low |
| `gameHistoryFriends` | handled | **Full** | — | Medium |
| `gameHistoryOtherScores` | handled | **Full** | — | Medium |
| `suggestion` | ignored | Partial shared-review interoperability | S–M | Medium |
| `replayIndicator` | ignored | Missing shared arrows/annotations | M–L | Medium |
| `replaySound` | ignored | Missing shared-replay sound parity | M | Low |

### Important event-level findings

#### Dynamic shared-replay efficiency modifier

Mobile consumes the initial `sharedReplayEffMod` from `init` and reduces it through `setEffMod`.
It also consumes `replayEfficiencyMod` for the matching active shared replay when the local client
is a follower, using that same semantic. The leader ignores its own authoritative echo because it
already applied the originating change locally. User-facing controls for originating modifier
changes remain separate future work.

#### Shared-replay suggestions

Mobile can **send** `tableSuggest` through the browser-command-compatible path, but it does not
parse the corresponding `suggestion { userName, segment }` event. As a result:

- a suggestion typed from mobile can still reach web clients;
- a suggestion from a web/mobile peer is invisible to a mobile leader/follower;
- adding only a native "Suggest current turn" button without receive-side presentation would still
  be incomplete.

Treat turn suggestion as a send + receive UI slice.

#### Pregame spectator updates

The server uses `pregameSpectators` rather than the in-game `spectators` event before game start.
Mobile currently has neither that event nor a Pregame spectator list. Any future spectator
perspective/People work should add this event instead of trying to infer pregame spectators from
player state.

#### Shutdown and maintenance

The server remains safe even when mobile ignores these events:

- maintenance mode rejects new table creation authoritatively;
- shutdown/restart eventually manifests through normal server warnings/socket lifecycle.

But web can proactively disable/explain creation before the rejected command. A small mobile status
notice would improve clarity and avoid unnecessary failed create attempts.

#### Table progress

Upstream sends incremental `tableProgress` as games/shared replays advance. Mobile stores the
initial `progress` from each table snapshot but does not update it and currently does not render
that field. This is therefore a low-priority data parity gap, not a gameplay-state bug.

### Lobby table payload fields intentionally dropped by mobile

Current upstream lobby table rows also contain fields mobile does not retain:

- `ownerID`;
- `spectators`;
- top-level `timed`, `timeBase`, and `timePerTurn` duplicates of option data.

The timing fields are redundant with the retained options object. `ownerID` and `spectators`
could become useful for richer lobby/People presentation, but are not required for current join/
spectate correctness.

---

# 13. Research, JSON and bots

| Capability | Status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Reference bot protocol compatibility | **Server-native** | — | Medium | Bots are ordinary users; no special bot API exists. |
| Add bot by PM `/join` | Implemented | — | Medium–High | Uses existing `chatPM` transport. |
| Several bots at once | Implemented | — | Medium–High | Create and Pregame use the same authoritative picker/eligibility model. |
| Protected-table bot invite | Implemented | — | Medium | All current 19 registry accounts are verified for `/join <password>`; passwords remain transient and capability-gated for future entries. |
| Known bot registry | Implemented | S | Medium | 19 exact supplied usernames; no server discovery or prefix detection. |
| Arbitrary replay JSON import | Missing | M | Medium | Research/bot workflow. |
| Replay JSON export | Missing | M | Medium | Needed for `/copy` parity. |
| JSON URL compression/share format | Missing | M | Low–Medium | Current upstream now preserves seed metadata. |
| Public JSON endpoints | N/A as core app feature | — | Low | Useful external integration; mobile can link externally if needed. |

The official `Hanabi-Live/hanabi-live-bot` remains a reference implementation, not a registry or
production bot-discovery service. Its README documents PM `/join` as the invitation mechanism.

---

# 14. Other upstream web features

| Upstream feature | Mobile classification | Effort | Importance |
| --- | --- | ---: | ---: |
| Keyboard shortcuts | **N/A** | — | Low | Replace with native actions/gestures where useful. |
| Keldon desktop table layout | Missing, not required | L | Low | Mobile needs its own responsive layout. |
| Real-life mode | Missing | M | Low | Niche presentation option. |
| Reverse hand direction | Missing | S–M | Medium | Genuine player preference. |
| Pre-playing / premoves | Missing | L | Low–Medium | High safety complexity; explicit mobile actions are safer baseline. |
| Website statistics pages | External only | S for links; L for native | Low | Native parity is not required for gameplay. |
| Project history/docs | N/A | — | Low | Documentation, not app capability. |

---

# 14A. Exhaustive upstream manual-section coverage

This checklist exists specifically to prevent "we never classified that section of the upstream
manual" omissions. It follows the current `docs/features.md` structure.

| Upstream manual section | Mobile classification | Detail / cross-reference |
| --- | --- | --- |
| Basic How-To | **Full mobile adaptation for accepted scope** | Create/join/start and core Play/Discard/Clue are present. Desktop drag interactions are intentionally replaced by safer explicit mobile selection/confirmation. |
| Major Features | **Section header** | Its concrete subsections are classified below. |
| Clue Indication | **Full core, mobile-adapted** | Touched-card marker, brand-new vs retouch distinction, orange clue border, accumulated knowledge and empathy are present. Full desktop hover/clue-log interaction is not. |
| Pips | **Full** | Suit/rank possibilities and elimination come from the vendored upstream game state. |
| Critical Indicator | **Full** | Critical-card marker is rendered. |
| Clue Log | **Partial** | Last Action + Recent can jump into rewind, but mobile does not expose the complete always-available clue log or card↔clue hover highlighting. |
| Termination | **Full** | Server idle termination remains authoritative; player termination/voting has native UI/runtime support. |
| Spectators | **Partial** | Spectating/all-hands/list support exists; player-perspective shadowing and pregame spectator list are missing. |
| In-Game Replay | **Full core / partial shortcuts** | Live rewind and direct temporal navigation work. Web shortcuts for draw/first-clue/play/discard/strike/arbitrary-turn jumps are not all exposed. |
| Game History and Profiles | **Partial** | Own history exists; profiles, arbitrary-player/group history and richer stats are missing. |
| Replays | **Partial** | Database-ID solo replay works. Shared creation, arbitrary JSON replay and copy/export are missing. |
| Shared Replays | **Partial but strong core** | Leader/follow/detach/segment/Hypothetical core works; dynamic efficiency-mod synchronization is implemented, while annotations, suggestion receive-side and sound remain incomplete. |
| Hypotheticals | **Full mobile workflow** | Start/end/play/discard/clue/back/reveal plus controller-only arbitrary card morph/unmorph are exposed with authoritative shared-replay semantics. |
| In-Game Statistics | **Full core stats / HUD polish pending** | Score/max/clues/strikes/deck and Pace/Eff context semantics are present; broader HUD hierarchy remains polish. |
| 6-Player Games | **Partial presentation** | Upstream hand-size/rules state works; current dense mobile layout is not accepted 4P–6P UX. |
| Custom Game Options | **Full for exposed supported subset** | Pregame create/edit and authoritative option preservation exist; unsupported rule families are rejected deliberately. |
| Variants | **2242/2426 supported** | 184 current variants are deliberately excluded by mechanic family; see variant matrix. |
| Timed Games | **Full** | Creation/update, clocks, timeout end conditions and pause/queued pause are supported. |
| Speedruns | **Unsupported** | Requires different controls/semantics and is intentionally rejected. |
| Card Cycling | **Full** | Option is exposed and the vendored reducer handles cycling. |
| Bottom Deck Blind Plays | **Unsupported** | `deckPlays` tables are rejected; no deck-action UI. |
| Empty Clues | **Full** | Option, clue preview, legality and send path are implemented. |
| One Extra Card | **Full core** | Rule supported; increases dense-layout pressure in 4P–6P. |
| One Less Card | **Full** | Rule supported. |
| All or Nothing | **Full core** | Rule/end conditions and Pace suppression presentation semantics are implemented. |
| Detrimental Character Assignments | **Unsupported** | Tables are rejected rather than partially simulated. |
| Password-Protected Games | **Full** | Create/join with transient password; no credential persistence. |
| Other Options | **Partial** | Individual settings are classified in the settings matrix. |
| Keldon Mode | **Missing / low-value desktop layout parity** | Mobile uses its own responsive layout. |
| Color-Blind Mode | **Missing** | High-value accessibility candidate. |
| Real-Life Mode | **Missing** | Niche presentation option. |
| Reverse Hand Direction | **Missing** | Genuine per-user preference; medium value. |
| Pre-Playing | **Missing** | Deliberately low priority because speculative/premove actions raise mobile action-safety complexity. |
| H-Group Conventions | **Partial** | Effective H-group state and card-level DDA/empathy semantics exist; the global DDA situation warning, locked-hand/low-score presentation, sounds and settings toggle are incomplete. |
| Notes — Basic Description | **Full core** | Authoritative notes, card-order identity, replay persistence and spectator combined-note data are supported. |
| Notes — Card Identity Notes | **Full parser/presentation semantics** | Exact-identity notes and falsification behavior come from upstream semantics. |
| Notes — Card Partial Identity Notes | **Full parser semantics** | Possibility and exclusion syntax is supported. |
| Notes — Special Note Borders | **Full** | Finesse and Chop Move. |
| Notes — Other Special Notes | **Full semantics / some one-tap UI missing** | trash/KT/fix/?/!/blank/clued/unclued are understood; dedicated Clued/Unclued/Blank controls remain backlog. |
| Adding Context to Special Notes | **Full** | Bracketed semantic tokens and stacked effects are preserved. |
| Notes — Note Shortcuts | **Full mobile equivalents** | F/CM/PTD/KT, Turn insertion and Repeat are explicit buttons rather than desktop modifier-clicks. |
| Sounds | **Missing** | No gameplay/replay sound system yet. |
| Pace & Efficiency | **Full presentation semantics** | Vendored formulas/state plus final-round/AON/review/shared modifier presentation now match upstream; broader HUD redesign is separate. |
| Pace | **Full presentation semantics** | Final-round/AON suppression, signed value display and risk treatment match upstream. |
| Efficiency | **Full presentation semantics** | FRE/MRE and review/shared modifier policy match upstream; editing the manual modifier is not exposed in this presentation slice. |
| Keyboard Shortcuts | **N/A literally** | Native controls/gestures should cover valuable actions rather than reproducing desktop key chords. |
| Similar Deals and Competitive Play | **Strong partial** | Server seed selection remains authoritative; native specific-seed Create, History seed/turn display + Copy seed, same-seed Other Scores, and History `Play this seed` prefill are implemented. Broader seed browsing remains web-oriented. |
| Chat | **Full basic / partial rich features** | Text/PM/history/commands work; read/unread/typing/emotes/link richness/zen are incomplete. |
| Friends | **Strong partial** | Commands/state, People contextual actions, friend-aware Lobby ordering, and Friends history are implemented; richer profiles/social flows remain. |
| Linked Accounts | **Command-complete / UI missing** | Link/unlink/linked commands work; native explanation/workflow absent. |
| Tags | **Command-complete / workflow missing** | Add/delete/search/list command paths exist; history/tag browser UI absent. |
| Website Endpoints | **Audited individually** | See endpoint matrix. |
| Research & Bots | **Strong partial** | Native multi-bot Create/Pregame picker is implemented for open and protected tables; arbitrary JSON replay remains missing. |
| JSON Endpoints | **Audited individually** | See endpoint matrix. |
| Password Reset | **Full entry point** | Login and Settings open the authoritative upstream reset page. |
| Project History | **N/A** | Documentation/community information, not a mobile runtime feature. |

This coverage table is intentionally redundant with the deeper sections: its purpose is completeness,
not compactness.

## Public Hanabi-Live repositories

A repository-level organization search currently returns exactly two public repositories:

1. `Hanabi-Live/hanabi-live` — the website/server/client/game monorepo;
2. `Hanabi-Live/hanabi-live-bot` — the Python reference bot.

There is no separate official Hanabi-Live mobile SDK, bot registry or protocol repository to audit.

### Reference bot caveat

The official Python reference bot is useful as a protocol example but should not be treated as a
current bot-capability standard:

- its latest commit is a source-layout refactor from 2023, while most functional implementation work
  dates to 2020;
- its documented invitation is PM `/join`;
- its `tableJoin` implementation does not include a password;
- it does not define authoritative production bot usernames.

The more actively maintained community scala-bot supports `/join <password>`. Therefore the planned
mobile bot registry must store verified per-bot capabilities rather than infer one universal command
set from the word "bot".

---

# 15. Current upstream delta after the mobile baseline pin

Current upstream `main` is **35 commits ahead** of mobile's baseline pin
`e78e82bce2ff5d54b9d2ec359530955fd354e9b7`.

They should not be imported wholesale. Most are server fixes already effective because mobile talks to
the live server, or browser-only fixes irrelevant to React Native.

## Commit-by-commit relevance

| Upstream commit | Summary | Mobile relevance |
| --- | --- | --- |
| `67be9b5` | Profile-button template dedupe | None; web template refactor. |
| `1d496f9` | Use html/template for served pages | None; server web rendering. |
| `c12ad5c` | Escape user input in server chat | Server-side benefit already live. |
| `fd129db` | Dev error message | None. |
| `1b33ee7` | Prettier | None. |
| `246d037` | Pips script link | Tooling/docs only. |
| `8bdc56d` | Direct Variant access through Game | Upstream refactor; inspect only when repinning game core. |
| `c89874c` | Validate names/seed in replays | Server-side; future JSON import should use current validation. |
| `7a9c601` | Extract card-presentation selectors | **Already the scoped mobile card pin.** |
| `f92dbef` | Disable `note.unclued` when finished | **Adopted as a scoped card-presentation follow-up.** |
| `3a149d7` | Formatting | None. |
| `3f6079e` | Chat emote markup fix | Browser rendering; mobile uses inert plain text. |
| `020923d` | Reject malformed server input/panics | Server-side benefit. |
| `e98a4d9` | New leader always seated left | Server authoritative behavior; mobile receives updated pregame. |
| `cc926f6` | Fix Konva card animations | Browser/Konva only. |
| `10929ed` | Escape server name/tooltips | Web/server safety; no mobile port. |
| `208aa3f` | Validate startingPlayer | Server-side. |
| `acd7780` | Validate spectator index | Server-side; supports future shadow UI safely. |
| `66cd601` | Missing returns after warnings | Server-side correctness. |
| `7514163` | NixOS-compatible scripts | None. |
| `62eb985` | Ignore chat suggestions inside links | Browser chat parsing. |
| `f13c856` | More escaping | Server/web safety. |
| `86257b4` | Clean dangling pregame spectators | **Server changed lifecycle; mobile currently ignores unsolicited `left`.** |
| `ae46bcf` | Discord escaping/mention filling | Server/web presentation. |
| `0224b61` | Stop treating names as HTML in pregame | Browser safety. |
| `c5cd0de` | Stop double escaping lobby | Browser/server chat presentation. |
| `8be709c` | Unicode-safe message truncation | **Already scoped Hypothetical/mobile adaptation pin.** |
| `b00e042` | Friend map race fix | Server-side; no client port. |
| `fadf048` | JSON replay without deck | Future JSON-import parity. |
| `32857ce` | JSON deck must match seed | Future JSON-import parity. |
| `345b4b3` | Preserve seed in JSON replay/compressed URL | Future `/copy`/JSON work. |
| `49e3f68` | JSON player names optional when seed supplies count | Future JSON-import work. |
| `d53b091` | Docs cleanup | None. |
| `7dc62da` | Hypothetical resize bug | Browser observer/layout bug; mobile has different UI. |
| `c1d970b` | Formatting | None. |

## Pin recommendation

Do not move the broad baseline pin merely because `main` is ahead.

Recommended scoped actions:

1. add mobile lifecycle coverage for the **server-side #3129 pregame-spectator behavior**;
2. when implementing JSON replay/import/`copy`, deliberately source the complete current JSON
   semantics from the 2026-09-15..18 upstream changes rather than the older baseline.

---

# 16. Recommended priority by value versus effort

## A. Correctness/drift status

The three concrete semantic/interoperability defects identified by this audit are now resolved:

- pregame spectator cleanup drift — #26;
- shared-replay efficiency modifier synchronization — #29;
- Pace/FRE/MRE presentation context — #30.

No unresolved high-priority current-server drift item remains from this audit. Keep replay scrubber
jank (#4) as non-blocking defect backlog unless real usage reprioritizes it.

## B. High-value, relatively low-risk next work

1. Continue small authoritative-state/parity fixes only when independently useful.
2. Revisit read-only tag discovery only after upstream #3136 merges and production availability is verified.
3. Keep native Pregame auto-start helpers (`/s`, `/s2`…`/s6`, `/startin`) out of scope; slash-command fallback remains the supported path.

## C. Medium product slices

1. Richer user/profile and arbitrary-player history surfaces.
2. Optional shadow-link handling if there is concrete demand; spectator perspective switching is already first-class in the Game menu.
3. Account-management / linked-account UX.
4. Chat typing/presentation polish beyond the implemented table unread/read state.
5. Remaining shared-replay arrows/annotations/sounds/leader controls.

## D. Defer until demanded

1. Speedrun support.
2. Bottom-deck blind plays.
3. Detrimental Characters.
4. Unsupported exotic variant families.
5. Premoves.
6. Keldon mode.
7. Full web emote ecosystem.
8. Rich sound parity.
9. Native copies of every statistics website page.

These are substantially worse value-per-risk than the product-shell, accessibility, spectator and
history work above.

---

# 17. Practical completeness assessment

A useful way to describe current parity is:

### Strong / production-capable

- authentication/session lifecycle;
- ordinary supported table lifecycle;
- 2P/3P core gameplay;
- adaptive 4P–6P real-card portrait presentation on the currently tested Android class (broader serious-play/device validation remains separate);
- current lobby section organization and own-game/Create placement;
- clues/knowledge/pips/card presentation;
- notes semantics;
- empathy;
- timed play;
- live rewind;
- finished/solo/shared replay core, including arbitrary JSON replay import, `/copy` export/share, and canonical replay-link opening from History;
- Hypothetical core including card morph/unmorph originating UI;
- spectator read-only gameplay with player-perspective shadow switching;
- supported option/variant rules;
- generated upstream card presentation with colorblind/styled-number server settings plus server-backed H-group/Real-life presentation toggles;
- pinned-upstream H-group and clue/discard resource-state presentation cues for supported gameplay;
- own History, Friends history, and same-seed Other Scores;
- People/Pregame/live-game contextual friend/session-PM actions, friends-first visual emphasis, and compact Pregame stats;
- shared replay creation and turn-suggestion receive/UI;
- game tag display/Add flow;
- live table-chat unread state, server-backed read acknowledgements, direct `/r` handling, and authoritative mute-state guarding;
- core chat and most command transport.

### Functionally present but product-incomplete

- spectators;
- notes workflow;
- replay navigation;
- shared replay power tools;
- history;
- friends/social;
- tags;
- slash-command discoverability;

### Intentionally unsupported

- speedrun;
- bottom-deck blind play;
- detrimental characters;
- 184 specialized variants.

### Missing largely because mobile has not built the product surface yet

- broader account/settings beyond the implemented login clarification, password change/reset entry points, card appearance settings, and H-group/Real-life presentation settings;
- rich profiles and arbitrary-player history beyond existing People/context actions;
- richer tag search/delete/management beyond the current Add/display flow;
- optional shadow-link handling beyond the implemented running-game and pregame URL openers;
- replay arrows/annotations/sounds and other advanced review tools;
- sounds and reverse-hand preference;
- server-backed typing and other chat-presentation polish.

That distinction matters: most remaining high-value work does **not** require a second Hanabi engine
or a protocol rewrite.

## Final recommendation

During the beta.2 tester window, keep runtime work in isolated slices so tester-confirmed defects can still be hotfixed without unrelated churn.

For the current feature cycle, the most defensible order is:

1. fix any tester-confirmed beta.2 runtime defects;
2. keep read-only tag discovery gated on upstream #3136 and keep native auto-start helpers out of scope;
3. tackle JSON/`copy` and advanced replay power features deliberately;
4. expand profiles/social/settings only where mobile context adds value;
5. only then consider expensive exotic rules/options.

This preserves the project's strongest architectural property: the server/upstream rules stay
authoritative while mobile work remains mostly presentation, interaction and carefully scoped
upstream adaptation.

---

# 18. Exhaustive documented chat-command inventory

This appendix maps every command documented in current upstream `docs/chat-commands.md`.
"Works through fallback" means mobile does not need a dedicated protocol implementation: unknown
slash commands are sent as ordinary authoritative chat text and the server handles them.

| Documented command | Mobile status | Implementation path | Native UI / remaining gap | Effort if improved | Importance |
| --- | --- | --- | --- | ---: | ---: |
| `/help` | **Full through fallback** | server chat command | Server help text works; no dedicated Help surface. | S | Low |
| `/bga` | **Full through fallback** | server simple response | Link arrives as safe text rather than rich browser markup. | XS–S | Low |
| `/discord` | **Full through fallback** | server simple response | Same link-presentation limitation. | XS–S | Low |
| `/doc` | **Full through fallback** | server simple response | Same. | XS–S | Low |
| `/efficiency` | **Full through fallback** | server simple response | Same. | XS–S | Low |
| `/manual` | **Full through fallback** | server simple response | Same. | XS–S | Low |
| `/new` | **Full through fallback** | server simple response | Same. | XS–S | Low |
| `/path` | **Full through fallback** | server simple response | Same. | XS–S | Low |
| `/variants` | **Full through fallback** | server simple response | Same. | XS–S | Low |
| `/github` | **Full through fallback** | server simple response | Same. | XS–S | Low |
| `/playerinfo [username]` | **Full command path** | direct `chatPlayerInfo` | Native player/profile UI missing. | M | Medium |
| `/playerinfo [username1] [username2]` | **Full command path** | direct `chatPlayerInfo` | Same command path; multi-player comparison still renders as server text rather than native profile comparison. | M | Medium |
| `/playerinfo` | **Full command path** | direct `chatPlayerInfo` | Same. | M | Medium |
| `/random [min] [max]` | **Full through fallback** | server chat command | No need for native UI. | — | Low |
| `/replay [game ID] [turn]` | **Full through fallback** | server chat command | Produces share text/link; mobile does not offer structured replay-link action. | S | Low–Medium |
| `/rules` | **Full through fallback** | server simple response | Link is plain/sanitized text. | XS–S | Low |
| `/shrug` | **Full through fallback** | server chat command | No gap worth native UI. | — | Low |
| `/timeleft` | **Full through fallback** | server chat command | Proactive shutdown UI is separately missing. | S | Low |
| `/uptime` | **Full through fallback** | server chat command | No native UI needed. | — | Low |
| `/pm [username] [msg]` | **Full command path + contextual UI** | direct `chatPM` | People/Pregame expose a contextual Message action; richer conversation UX remains optional. | — | Medium |
| `/r [msg]` | **Full command path** | direct reply handler using authoritative last PM sender | Typed and directly submitted `/r <message>` both reuse the existing PM validation/send path. | — | Low |
| `/friend [username]` | **Full command path + contextual UI** | direct `chatFriend` | People/Pregame expose Friend action backed by authoritative snapshots. | — | Medium |
| `/friends` | **Full command path + People surface** | local list from authoritative friends state | People and friend-aware Lobby/History surfaces use the same authoritative state. | — | Medium |
| `/unfriend [username]` | **Full command path + contextual UI** | direct `chatUnfriend` | People/Pregame expose Unfriend action without optimistic mutation. | — | Medium |
| `/link [username]` | **Full command path** | direct `chatLink` | Native explanation/workflow missing. | M | Low–Medium |
| `/linked` | **Full command path** | direct `chatLinked` | Native linked-account surface missing. | M | Low |
| `/unlink [username]` | **Full command path** | direct `chatUnlink` | Native action missing. | S | Low |
| `/tagsearch [tag]` | **Full raw command path** | direct `tagSearch` | Results are server chat text; no structured results/history UI. | M | Medium |
| `/version` | **Full mobile-local** | local mobile package version | Correctly reports mobile version rather than browser bundle version. | — | Low |
| `/impostor` | **Full through fallback** | pregame server command | Novelty/power-user command; native UI unnecessary. | — | Low |
| `/kick [username]` | **Full + native UI** | pregame server command | Native owner action is implemented on eligible Pregame player rows. | — | Medium |
| `/s` | **Full through fallback** | server auto-start | Native control intentionally not planned; keep slash-command fallback. | — | Low–Medium |
| `/s2` | **Full through fallback** | server auto-start | Same fallback-only policy. | — | Low |
| `/s3` | **Full through fallback** | server auto-start | Same fallback-only policy. | — | Low |
| `/s4` | **Full through fallback** | server auto-start | Same fallback-only policy. | — | Low |
| `/s5` | **Full through fallback** | server auto-start | Same fallback-only policy. | — | Low |
| `/s6` | **Full through fallback** | server auto-start | Same fallback-only policy. | — | Low |
| `/setvariant [variant]` | **Full for supported variants** | direct `tableSetVariant` | Deliberately refuses the 184 unsupported mechanic variants. | — | Medium |
| `/startin [minutes]` | **Full through fallback** | server pregame command | Native control intentionally not planned; keep slash-command fallback. | — | Low |
| `/split [username1] [username2] ...` | **Full through fallback** | server pregame command | Native UI only useful for large community tables. | M | Low |
| `/splitauto`, `/sa` | **Full through fallback** | server pregame command | Same. | M | Low |
| `/findvariant` | **Full + native UI** | server command | Native Pregame Team action is implemented with slash-command fallback. | — | Medium |
| `/missing` | **Full + native UI** | server command | Native Pregame Team action is implemented with slash-command fallback. | — | Medium |
| `/setleader` | **Full + native UI** | direct `tableSetLeader` | Already first-class in Pregame/shared review. | — | Medium |
| `/pause` | **Full through fallback + native timed-game UI** | server command / typed pause runtime | Native UI already covers ordinary pause/queue behavior. | — | Medium |
| `/unpause` | **Full through fallback + native timed-game UI** | server command / typed pause runtime | Already covered. | — | Medium |
| `/terminate` | **Full + native UI** | termination runtime | Already covered. | — | Medium |
| `/tag [tag]` | **Full command path + native Add action** | direct `tag` | Game menu exposes first-class Add tag; richer search/delete management remains. | S | Medium |
| `/copy` | **Missing** | browser-local upstream command | Mobile fallback sends text to server, which cannot perform the browser-local copy/export behavior. Needs replay JSON/share implementation. | M | Medium |
| `/suggest [turn]` | **Full shared-review flow** | direct `tableSuggest` send + authoritative `suggestion` receive/UI | Mobile can send and receive turn suggestions; leader-side Accept/Dismiss uses existing replay navigation. | — | Medium |
| `/tagdelete [tag]` | **Full command path** | direct `tagDelete` | Structured tags UI missing. | S–M | Medium |
| `/tags` | **Full through fallback** | server replay command | Returns text; first-class tag display exists in History surfaces, while richer structured management remains. | S | Medium |
| `/tagsdeleteall` | **Full command path** | direct `tagsDeleteAll` | Structured confirmation/UI missing. | S | Medium |

### Command aliases implemented beyond the documentation

Mobile also recognizes several upstream/browser aliases so command compatibility is broader than the
manual table alone:

- PM: `/w`, `/whisper`, `/msg`, `/tell`, `/t`;
- friends list: `/f`, `/friendlist`, `/friendslist`;
- leader: `/setlead`, `/setowner`, `/changeleader`, `/changelead`,
  `/changeowner`;
- variant: `/sv`, `/changevariant`, `/cv`;
- player info: `/p`, `/games`, `/stats`;
- tag delete: `/untag`;
- linked accounts: `/links`;
- termination vote: `/vote`.

The command audit therefore does **not** justify a project to port every slash command into native
buttons. Most already work. Native controls should be limited to actions where structured context
makes the mobile experience materially safer or easier.

---

# 19. Exhaustive public web/JSON endpoint inventory

These endpoints are upstream product capabilities, but an HTTP page/API is not automatically a
mobile feature requirement. The table separates the underlying user need from literal page parity.

## Human-facing website endpoints

| Upstream endpoint | Purpose | Mobile status / equivalent | Effort for native equivalent | Importance |
| --- | --- | --- | ---: | ---: |
| `/scores/[username]` | Player profile + best scores | **Missing native profile**; `/playerinfo` only gives a compact text response/link. | L | Medium |
| `/history/[username]` | One player's games | **Own history Full basic; arbitrary user missing** | M–L | Medium |
| `/history/[username1]/.../[username6]` | Shared history for selected players | **Missing** | L | Low–Medium |
| `/missing-scores/[username]` | Non-max scores for one player | Command-level `/missing` exists for current group; no native arbitrary-user page. | M–L | Low–Medium |
| `/shared-missing-scores/2/[username...]` | Shared missing scores for 2–6 users | Current-table `/missing` fallback covers the common live need; page parity missing. | L | Low |
| `/tags/[username]` | Player's tagged games | **Missing native tags/history surface** | M–L | Low–Medium |
| `/seed/[seed]` | Games on the same deal | **Native contextual equivalent implemented** via authenticated Other Scores; full public seed page remains web-only. | — | Medium |
| `/stats` | Site-wide statistics | External/web-only today | L | Low |
| `/variant/[id]` | Variant statistics | External/web-only today | L | Low |
| `/tag/[tag]` | Games matching a tag | Raw `/tagsearch` exists; structured native results missing. | M | Medium |

For mobile, the best use of these capabilities is usually a native contextual subset (profile,
history, seed comparison, tags), with an external-browser link for the long-tail statistics pages.

## JSON/API endpoints

| Upstream endpoint | Purpose | Mobile status / relevance | Effort | Importance |
| --- | --- | --- | ---: | ---: |
| `/export/[game ID]` | Full game JSON export | **Not used**; relevant to future `/copy`/research export. | M | Medium |
| `/api/v1/variants` | Variant IDs/list | Not used; mobile vendors pinned variant data deliberately. | — | Low |
| `/api/v1/variants-full` | Full variant metadata | Not used; pinned vendored closure is architecturally preferred for gameplay. | — | Low |
| `/api/v1/variants/[variant ID]` | Paginated games for variant | Not used; analytics/research only. | M–L | Low |
| `/api/v1/history/[username...]` | Paginated player/shared history | Not used; native history currently uses authenticated WS commands. | M | Low–Medium |
| `/api/v1/history-full/[username...]` | Complete player/shared history | Not used; potentially expensive and not needed for core mobile UX. | M–L | Low |
| `/api/v1/seed/[seed]` | Paginated games on seed | Not used; `historyGetSeed` is the better authenticated in-app path. | — | Low |
| `/api/v1/seed-full/[seed]` | All games on seed | Not used; research/export use only. | M | Low |

### Endpoint architecture rule

Do not replace the current server-authoritative WebSocket/game-core architecture with ad-hoc REST
fetches merely because a public JSON endpoint exists. Use the existing authenticated WS command when
it already represents the in-app product flow; reserve public JSON endpoints for external/research
work or when upstream has no equivalent realtime command.

---

# 20. Strict-schema compatibility review

Mobile intentionally mixes strict validation for stable payloads with permissive schemas for
evolving upstream payloads.

### Current production Go server

No current strict-schema break was found in the payloads mobile already claims to support:

- `tableStart`;
- `joined`;
- `left`;
- `replaySegment`;
- `replayLeader`;
- in-game `spectators`;
- `userInactive`;
- Hypothetical bootstrap/toggle events;
- game-history rows.

Large/evolving payloads such as `welcome`, lobby `table`, `init`, options and gameplay actions are
already non-strict/passthrough where appropriate, so new unrelated upstream fields are dropped rather
than turning into connection failures.

### Deliberately dropped current fields

Safe field dropping is responsible for several parity gaps documented elsewhere:

- welcome fields still not surfaced broadly, notably `firstTimeUser`; `muted`, card presentation settings, `realLifeMode`, `hyphenatedConventions`, random table names, and maintenance/shutdown metadata are retained where the mobile product uses them;
- lobby `ownerID` and redundant timing fields remain omitted where unused; spectator data is now retained;
- other evolving fields not needed by supported mobile flows continue to be dropped at permissive boundaries.

These are product/data omissions, not protocol decode failures.

### Future server-migration watch item

Current Go spectator payloads always send
`shadowingPlayerUsername: ""` when no player is shadowed, matching mobile's strict
`z.string()` requirement.

The newer TypeScript data model defines `shadowingPlayerUsername` as optional and the TS table
serializer passes that value through. If production eventually switches to a server path that omits
the field, the mobile strict spectator schema would reject the whole `spectators` event.

This is **not a current production defect**. Before a server implementation migration, make the
mobile spectator schema accept the upstream optional representation and normalize missing/empty
username at the boundary.

---
