# Upstream parity audit

Date: 2026-09-23

Status: **research / planning authority for parity discussions; not permission to change the frozen beta.1 runtime**

## Scope and source of truth

This audit compares Hanab Mobile against the public Hanabi-Live upstream repositories and the current
mobile repository state.

Upstream repositories reviewed:

- `Hanabi-Live/hanabi-live`
  - current `main`: `c1d970bd610395087958fe7d1bb96f52244f7b04`
  - mobile baseline game/protocol pin: `e78e82bce2ff5d54b9d2ec359530955fd354e9b7`
  - mobile card-presentation pin: `7a9c601b66f5966f7e33564855e25f82e68a94ed`
  - mobile Hypothetical replay-core pin: `8be709c48145ad56a1891307663ed3bec2cd4175`
- `Hanabi-Live/hanabi-live-bot`
  - current `main`: `e8e8f36d4fb63cc7d5fa931212d25708fad5638e`

Mobile repository reviewed at:

- `BarsukovSergey/hanab-mobile`
- `main`: `20b61e05e4a89945e8370eb04cd4bdf5d6773921`
- distributed beta.1 runtime remains frozen at
  `d297ad71153095f18fba3101f760e306ed69e214`

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
- Hypothetical play/discard/clue/back/reveal behavior;
- spectator read-only gameplay;
- history pagination and solo replay opening;
- most browser-local slash-command transport;
- a very large portion of the upstream variant catalog.

The biggest parity gaps are concentrated in five areas:

1. **Dense 4P–6P presentation**, not the underlying game state.
2. **Product shell / people / history power features**: profiles, friends discovery, seed comparison,
   tags UI, shared replay creation, user list, pregame player stats.
3. **Per-user upstream settings**: colorblind/style-number/reverse-hand/sounds/etc. are mostly ignored.
4. **Power-user replay/review features**: arrows, Hypothetical morph UI, arbitrary JSON replay,
   `/copy`, full clue-log navigation.
5. **Explicitly unsupported rule families/options**: 184 variants plus speedrun, deck-play and
   detrimental-character tables.

There are also two concrete current-upstream compatibility defects that should not be confused with
feature backlog:

- **finished-game `note.unclued` presentation drift** after upstream #3116;
- **pregame spectator cleanup drift** after upstream #3129.

## Highest-value findings

| Item | Status | Effort | Importance | Why |
| --- | --- | --- | --- | --- |
| Finished replay `unclued` border behavior | Drift | XS | Medium | Current upstream intentionally disables the `unclued` override after game end; mobile still has the older behavior. |
| Pregame spectator removed when table disappears | Drift | XS–S | High | Current server now sends an unsolicited `left` when the last player leaves; mobile ignores it unless a local leave/role-switch is pending. |
| 4P–6P dense real-card layout | Partial | L | High | Core state works, but ordinary 4P–6P falls into the temporary Compact Overview path. |
| Spectator shadowing / player perspective | Wire-only | S–M | High | The protocol already carries `shadowingPlayerIndex`; mobile always requests `-1` and exposes no perspective selector. |
| Colorblind + styled-number card presentation | Missing | S–M | High | Accessibility/presentation value; assets/tooling already understand upstream card variants. |
| Lobby sections/create placement | Partial | M | High | Research contract exists; current runtime UI still uses the older grouping. |
| Add several bots during Create/Pregame | Missing | M | Medium–High | Existing PM + `/join [password]` semantics are sufficient; no new protocol needed. |
| Online users / contextual player actions | Missing UI | M | Medium–High | User data is already stored; currently invisible. Unlocks PM/profile/friend/shadowing discovery. |
| Pregame player stats | Missing UI | S–M | Medium | Server already sends stats; mobile schema currently discards them. |
| Seed comparison / Other Scores | Missing | M | Medium | Server has dedicated `historyGetSeed`; history already carries seed and `numGamesOnThisSeed`. |
| Shared replay creation from history | Missing | S–M | Medium | Mobile replayCreate is currently hard-coded to `visibility: solo`. |
| Arbitrary JSON replay import | Missing | M | Medium | Useful for research/bots; current upstream recently expanded JSON seed semantics. |
| Hypothetical morph UI | Wire/state-only | M | Medium | Reducers and rendering understand morph/unmorph, but mobile cannot originate one. |
| `/copy` replay export | Missing | M | Medium | Explicitly deferred; current fallback sends it to server where it is not a server command. |
| Chat typing/read/unread | Partial | S–M | Low–Medium | Payload support exists for unread; typing/read commands/events are absent. |
| Upstream account/settings surface | Missing | M–L | Medium | Server sends settings but mobile welcome parser discards them. |

---

# 1. Session, account and lobby shell

| Upstream capability | Mobile status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Login using existing hanab.live account | **Full** | — | Critical | Uses platform-owned cookies, verifies `/test-cookie`, then requires realtime `welcome`. |
| Session persistence across relaunch | **Full by platform session** | — | High | No app password persistence is needed. |
| Logout | **Full** | — | High | Network/session teardown is explicit and conservative. |
| Account creation | **Full semantics, unclear UX** | XS | Medium | Upstream has no separate register endpoint: an unknown username submitted to `/login` creates an account. Mobile uses the same endpoint, so creation works, but its screen says only “Use your hanab.live account” and does not explain this behavior or the unique-password warning. |
| Change password | **Missing UI/protocol field** | S | Medium | Upstream login supports `newPassword`; mobile `submitLogin` does not expose/send it. |
| Password reset | **Missing UI** | XS–S | Medium | Upstream exposes `/password-reset`; mobile has no entry point. |
| First-time tutorial (`firstTimeUser`) | **Missing** | M | Low–Medium | Field is sent in `welcome` but intentionally dropped by mobile schema. |
| Account mute state (`muted`) | **Missing UI** | XS–S | Low | Server remains authoritative and can reject chat; mobile does not pre-explain mute state. |
| Server shutdown / maintenance metadata | **Missing UI** | S | Medium | `shuttingDown`, `datetimeShutdownInit`, `maintenanceMode` are dropped from `welcome`. |
| Random default table name | **Missing** | XS–S | Low | Upstream `randomTableName` and `getName` are ignored; mobile requires manual table name. |
| Inactive/active session status | **Full transport** | — | Medium | Mobile sends `inactive` on app lifecycle and consumes user inactivity state. |
| Online user model | **Full data, missing UI** | M | Medium–High | `userList/user/userLeft`, status, tableID, H-group flag and inactive state are stored. |
| User list rendering | **Missing** | M | Medium–High | No People/online-users surface exists yet. |
| Friend-aware lobby sorting | **Missing** | S–M | Medium | Friends are stored but table/user ordering does not prioritize them. |
| Friend visual highlighting | **Missing** | S | Medium | No user list; names are not styled as friends. |
| Current lobby restructure | **Partial** | M | High | Research contract exists for Pregame → Create → Running → Shared replay, but runtime UI is still old layout. |
| Hide Create while own game is reattendable | **Missing in current UI** | S | High | Contract exists; current LobbyScreen always renders Create. |
| Distinct Shared replay lobby section | **Missing in current UI** | S | Medium–High | Current `isSpectateEligible` grouping folds shared replays into Running. |
| Lobby chat | **Full basic** | — | Medium | Send/receive/history works. |
| Discord-replicated lobby chat | **Partial** | XS | Low | Messages arrive, but mobile metadata does not visually distinguish Discord origin. |

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
| Pregame spectators list | **Missing UI** | S | Medium | Lobby table data has spectators; PregameScreen shows players only. |
| Pregame player stats | **Missing data/UI** | S–M | Medium | Server `game` payload includes `stats`; mobile `pregamePlayerSchema` drops it. |
| Pregame player profile shortcut | **Missing** | S–M | Medium | Depends on People/profile work. |
| Kick player native action | **Chat fallback only** | S | Medium | Server `/kick` already works through chat. |
| Auto-start next join / N players | **Chat fallback only** | S | Low–Medium | `/s`, `/s2`…`/s6`. |
| Timed auto-start `/startin` | **Chat fallback only** | S | Low | Native countdown controls are optional. |
| Split / splitauto | **Chat fallback only** | S–M | Low | Useful mainly for large community pregames. |
| Find variant / missing scores helpers | **Chat fallback only** | S | Medium | Native pregame actions would be useful. |
| Multi-bot invite during Create | **Missing; researched** | M | Medium–High | Use explicit verified bot registry + PM `/join [password]`. |
| Multi-bot invite in Pregame | **Missing; researched** | M | Medium | Same picker, capped by current free seats. |

## Current upstream drift: spectator table deletion

Upstream commit `86257b4dec36b1d36b3a61beaaf3e1a5aa053bbe` (#3129) changed the server so that
when the last player leaves an unstarted table it actively removes remaining pregame spectators and
sends them a `left` event.

Mobile currently processes `left` for a pregame only when:

- a local leave is pending; or
- a player→spectator role switch is in progress.

An unsolicited server `left` for a spectator is therefore ignored. `tableGone` also does not
normally clear an arbitrary pregame room. The likely visible failure is a spectator remaining on a
deleted pregame screen.

**Classification:** Drift / correctness bug  
**Effort:** XS–S  
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
| Score / Max / Clues / Strikes / Deck | **Full semantics** | S for polish | High | Presentation hierarchy is still a polish backlog item. |
| Pace | **Partial presentation** | S | Medium | Underlying upstream value/risk exists, but mobile does not apply web final-round/All-or-Nothing suppression or PaceRisk color; tracked with stats parity in #30. |
| Future Required Efficiency | **Partial presentation** | S | Medium | Live formula exists, but mobile applies note/manual adjustments in review modes where web suppresses them; tracked in #30. |
| Minimum Required Efficiency | **Missing UI** | XS–S | Medium | `metadata.minEfficiency` already exists but is not shown. |
| Low-score-phase warning | **Missing explicit UI** | S | Low–Medium | Upstream H-group presentation has special score treatment. |
| Locked-hand warning | **Missing explicit UI** | S–M | Medium | Underlying upstream rule helper exists. |
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

Mobile currently renders `game.stats.pace` whenever non-null and computes one FRE value with a
helper that always includes the current note/manual adjustment. The mismatch is tracked as issue
#30. This is distinct from the broader visual-HUD hierarchy backlog: the formulas/state do not need a
new rules engine, but the presentation selector needs to encode the upstream context rules.

## 4P–6P

The rules/state path supports 2–6 players, but the current C17 dense allocator is not accepted
product UX for ordinary 4P–6P. The current `Compact Overview` summary-card fallback remains temporary.

**Status:** Partial  
**Effort:** L  
**Importance:** High

The dedicated diagnosis is in `docs/4P_6P_LAYOUT_RESEARCH.md`.

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
| One Extra Card | **Full core** | — | Medium | Dense layouts may amplify 4P–6P problems. |
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

## Current upstream card-presentation drift

Upstream commit `f92dbefaad90894612eff8369e376843ae6b3621` (#3116) changed the finished-game
border rule:

- while live, `note.unclued` can suppress the orange clue border;
- when the game is finished, `unclued` is deactivated for presentation so a genuinely clued card
  still shows its clue border.

Mobile `src/game/client/cardPresentation.ts` still uses the older condition:

`!note.unclued && (isCardClued(state) || note.clued)`

without the current-upstream `!finished` qualification.

**Classification:** Drift  
**Effort:** XS  
**Importance:** Medium (replay/presentation correctness)

This should be handled as a scoped card-presentation pin update/regression test, not by silently
reading arbitrary current upstream source.

---

# 6. Per-user settings

The server sends the complete upstream settings object in `welcome`. Mobile currently parses only
identity/resume/friends fields and drops the settings object.

The mobile Settings screen contains theme/accent/developer controls, not the hanab.live account
settings below.

| Upstream setting | Mobile status | Effort | Importance | Recommendation |
| --- | --- | ---: | ---: | --- |
| `desktopNotification` | Missing / web-specific | M for native push | Low | Do not copy desktop notifications; evaluate native push separately. |
| `soundMove` | Missing | M | Low–Medium | Only after adding sounds. |
| `soundTimer` | Missing | M | Low | Same. |
| `volume` | Missing | S once sound exists | Low | Same. |
| `keldonMode` | Missing | L | Low | Mobile layout should not chase desktop table geometry unless requested. |
| `colorblindMode` | **Missing** | S–M | **High** | Strong accessibility candidate. |
| `realLifeMode` | Missing | M | Low | Niche presentation preference. |
| `reverseHands` | Missing | S–M | Medium | Useful player preference; current display direction is fixed. |
| `styleNumbers` | **Missing** | S–M | **High** | Accessibility/readability candidate. |
| `showTimerInUntimed` | Missing | S | Low | Optional. |
| `speedrunPreplay` | Missing + speedrun unsupported | L | Low | Defer. |
| `speedrunMode` | Missing + speedrun unsupported | L | Low | Defer. |
| `hyphenatedConventions` | **Partial** | S | Medium | Mobile reads effective H-group status through lobby user state but cannot change it. |
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

A settings implementation should use the existing authoritative `setting` command and not create
mobile-only server preference storage.

---

# 7. H-Group-specific presentation

| H-Group feature from upstream docs | Mobile status | Effort | Importance |
| --- | --- | ---: | ---: |
| H indicator in online user list | Missing because People UI missing | S after People | Low |
| DDA card indication | **Full** | — | Medium |
| Empathy-based DDA question-mark semantics | **Mostly Full** | — | Medium |
| Locked-hand notification | Missing | S–M | Medium |
| Low Score Phase score treatment | Missing | S | Low–Medium |
| Discard-clued / DDA / order-chop-move sounds | Missing | M | Low |
| Hyphenated-convention-dependent card behavior | **Full effective state, no toggle** | S | Medium |

---

# 8. Spectator parity

| Capability | Status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Spectate running game | **Full** | — | High | Read-only C17 workspace. |
| Spectate pregame | **Full basic** | — | Medium | See lifecycle drift above. |
| See all hands | **Full** | — | High | Uses authoritative spectator visibility. |
| Spectator count/list in live menu | **Full basic** | — | Medium | Names shown. |
| Spectator list in pregame | Missing UI | S | Medium | Data exists in lobby table. |
| Shadow a player's perspective | **Wire-only** | S–M | **High** | Schema supports `shadowingPlayerIndex`; UI/runtime always spectates with `-1`. |
| Show who each spectator is shadowing | **Data-only** | S | Medium | Spectator records retain shadowing fields. |
| Reconnect to previous shadow seat | **Full transport** | — | Medium | `disconShadowingSeat` retained in resume hints. |

Spectator shadowing is one of the best parity wins: the protocol and server already support it, so it
is mainly a contextual UI/runtime action rather than new game logic.

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
| Create shared replay from history | **Missing** | S–M | Medium | Protocol helper is hard-coded to solo. |
| Watch arbitrary JSON replay | **Missing** | M | Medium | Upstream supports `source=json`. |
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
| Efficiency-modifier initial state | **Partial / current update event missing** | S | Medium | Initial `sharedReplayEffMod` works, but later `replayEfficiencyMod` broadcasts are ignored; tracked in #29. |
| Explicit shared replay creation | Missing | S–M | Medium |

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
| Morph card to arbitrary identity | **Wire/state/rendering only** | M | Medium |
| Unmorph | **Wire/state only** | M | Medium |

Mobile already parses/reduces/renders `morph` and `unmorph` actions received from upstream. The
missing piece is an originating identity-picker/action for the shared-replay leader.

---

# 10. History, profiles, seeds and tags

| Capability | Status | Effort | Importance | Notes |
| --- | --- | ---: | ---: | --- |
| Own game history | **Full basic** | — | High | Pagination and replay opening. |
| History displays players/score/variant/end condition/date | **Full basic** | — | High | — |
| History displays seed | Missing UI | XS | Medium | Data already present. |
| History displays tags | Missing UI | XS–S | Medium | Data already present. |
| History shows count played on same seed | Missing UI | XS | Medium | `numGamesOnThisSeed` already present. |
| Other Scores / same-seed comparison | **Missing** | M | Medium | Dedicated upstream `historyGetSeed` command. |
| Friends history | **Missing** | M | Medium | Dedicated `historyFriendsGet` command. |
| Other player's history | Missing native UI | M–L | Medium | Web/API supports it; mobile history state is self-only. |
| Player profile / best scores | **Missing native UI** | L | Medium | `chatPlayerInfo` only returns a short server message + web link. |
| Player-info command | **Full command transport** | — | Low–Medium | Native profile presentation missing. |
| Variant/global stats pages | Missing native UI / web endpoint available | L | Low | Do not prioritize before personal/profile flows. |
| Game tags add/delete | **Command support** | S for UI | Medium | No first-class workflow. |
| Tag search | **Command support** | M for results UI | Medium | Current server response is chat text with game IDs. |
| Tagged-games page | Missing native UI | M–L | Low–Medium | Web has dedicated pages. |
| Force seed via `!seed` table name | **Server path available** | S for discoverability | Medium | Mobile table-name field can pass server special syntax; no native helper. |
| Partial replay via `!replay` table name | **Server path available but undiscoverable** | S–M | Low–Medium | Better represented as replay tooling rather than teaching magic names. |

The easiest useful history improvements are displaying the already-received **seed, tags, and
same-seed count** before implementing new server commands.

---

# 11. Chat, social and commands

## Chat presentation

| Capability | Status | Effort | Importance |
| --- | --- | ---: | ---: |
| Lobby chat | **Full basic** | — | Medium |
| Pregame/table chat | **Full basic** | — | High |
| PM send/receive | **Full basic** | — | Medium |
| Dedicated PM conversation UI | Missing | M | Low–Medium |
| Reply-to-last-PM `/r` | **Partial** | XS | Low | Typing exactly `/r ` rewrites to `/pm <name> `; pasted/direct `/r hello` hits a handler that always fails. |
| Unread count | **Wire-only / ignored** | S | Medium | `chatList.unread` is parsed then discarded. |
| Mark chat read | Missing | S | Low–Medium | No `chatRead` sends. |
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
| Friends UI | Missing | M | Medium |
| Friend-aware sorting | Missing | S–M | Medium |
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
| `tableSpectate` | Partial | Typed encoder supports shadow index, UI always uses ordinary `-1`. |
| `tableRestart` | Full | Quick rematch/remake. |
| `tableUpdate` | Full exposed option subset | Preserves complete authoritative options on edit. |
| `tableSuggest` | Full command path | Native review action not yet exposed. |
| `setting` | **Missing** | Upstream user settings ignored. |
| `chat` | Full | — |
| `chatPM` | Full | — |
| `chatRead` | **Missing** | Unread/read polish gap. |
| `chatTyping` | **Missing** | Typing gap. |
| `chatFriend` | Full | — |
| `chatUnfriend` | Full | — |
| `chatLink` | Full | — |
| `chatUnlink` | Full | — |
| `chatLinked` | Full | — |
| `chatPlayerInfo` | Full command path | Native profile absent. |
| `getName` | **Missing** | Random create-table name absent. |
| `inactive` | Full | App lifecycle. |
| `historyGet` | Full | Own history. |
| `historyGetSeed` | **Missing** | Same-seed scores. |
| `historyFriendsGet` | **Missing** | Friends history. |
| `replayCreate` | **Partial** | Only database-ID + solo. No shared or JSON source. |
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
| `replayAction` | Full core | Segment/leader/hypo actions; morph UI not exposed. |

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
| `pregameSpectators` | ignored | Missing data/UI | S–M | Medium |
| `chatTyping` | ignored | Missing chat polish | S–M | Low |
| `shutdown` | ignored | Missing server-status UX | S | Medium |
| `maintenance` | ignored | Missing server-status UX | S | Medium |
| `soundLobby` | ignored | Missing sound parity | M with sound system | Low |
| `gameHistoryFriends` | ignored | Missing friends-history feature | M | Medium |
| `gameHistoryOtherScores` | ignored | Missing same-seed comparison | M | Medium |
| `suggestion` | ignored | Partial shared-review interoperability | S–M | Medium |
| `replayIndicator` | ignored | Missing shared arrows/annotations | M–L | Medium |
| `replaySound` | ignored | Missing shared-replay sound parity | M | Low |
| `replayEfficiencyMod` | **ignored despite displayed efficiency state** | **Interop drift / correctness** | S | **Medium** |

### Important event-level findings

#### Dynamic shared-replay efficiency modifier

Mobile correctly consumes the initial `sharedReplayEffMod` from `init` and reduces it through
`setEffMod`. Current upstream later broadcasts leader changes through `replayEfficiencyMod`.
Because mobile does not know this event, a mobile follower can keep displaying stale efficiency/FRE
after a web leader changes the modifier.

Tracked as GitHub issue #29. The receive-side fix should reuse the existing `setEffMod` semantic;
a mobile control for originating modifier changes is a separate product feature.

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
| Add bot by PM `/join` | Missing native UI | M | Medium–High | Already researched. |
| Several bots at once | Missing native UI | M | Medium–High | Multi-select design recorded. |
| Protected-table bot invite | Missing native UI | M | Medium | Reuse transient create password or re-request in existing table. |
| Verified bot registry | Missing | S | Medium | Upstream reference bots do not define authoritative production usernames. |
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

# 13A. Exhaustive upstream manual-section coverage

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
| Shared Replays | **Partial but strong core** | Leader/follow/detach/segment/Hypothetical core works; annotations, suggestion receive-side, sound and dynamic efficiency-mod parity are incomplete. |
| Hypotheticals | **Full core / morph missing** | Start/end/play/discard/clue/back/reveal work; arbitrary card morph/unmorph cannot be originated from mobile. |
| In-Game Statistics | **Partial presentation** | Score/max/clues/strikes/deck/Pace/FRE state exists; upstream Pace/FRE context semantics are tracked in #30. |
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
| All or Nothing | **Full core / stats presentation partial** | Rule/end conditions work; Pace hiding semantics need #30. |
| Detrimental Character Assignments | **Unsupported** | Tables are rejected rather than partially simulated. |
| Password-Protected Games | **Full** | Create/join with transient password; no credential persistence. |
| Other Options | **Partial** | Individual settings are classified in the settings matrix. |
| Keldon Mode | **Missing / low-value desktop layout parity** | Mobile uses its own responsive layout. |
| Color-Blind Mode | **Missing** | High-value accessibility candidate. |
| Real-Life Mode | **Missing** | Niche presentation option. |
| Reverse Hand Direction | **Missing** | Genuine per-user preference; medium value. |
| Pre-Playing | **Missing** | Deliberately low priority because speculative/premove actions raise mobile action-safety complexity. |
| H-Group Conventions | **Partial** | Effective H-group state, DDA/empathy semantics exist; locked-hand/low-score presentation and settings toggle are incomplete. |
| Notes — Basic Description | **Full core** | Authoritative notes, card-order identity, replay persistence and spectator combined-note data are supported. |
| Notes — Card Identity Notes | **Full parser/presentation semantics** | Exact-identity notes and falsification behavior come from upstream semantics. |
| Notes — Card Partial Identity Notes | **Full parser semantics** | Possibility and exclusion syntax is supported. |
| Notes — Special Note Borders | **Full** | Finesse and Chop Move. |
| Notes — Other Special Notes | **Full semantics / some one-tap UI missing** | trash/KT/fix/?/!/blank/clued/unclued are understood; dedicated Clued/Unclued/Blank controls remain backlog. |
| Notes — Adding Context | **Full** | Bracketed semantic tokens and stacked effects are preserved. |
| Notes — Note Shortcuts | **Full mobile equivalents** | F/CM/PTD/KT, Turn insertion and Repeat are explicit buttons rather than desktop modifier-clicks. |
| Sounds | **Missing** | No gameplay/replay sound system yet. |
| Pace & Efficiency | **Partial presentation** | Vendored formulas/state exist; context/display parity tracked in #30. |
| Pace | **Partial presentation** | Final-round/AON suppression and risk treatment differ from web. |
| Efficiency | **Partial presentation** | FRE exists; minimum required efficiency and review/shared modifier policy differ. |
| Keyboard Shortcuts | **N/A literally** | Native controls/gestures should cover valuable actions rather than reproducing desktop key chords. |
| Similar Deals and Competitive Play | **Partial** | Server seed selection works automatically; magic `!seed`/ `!replay` table names pass through; Other Scores and strong seed UI are missing. |
| Chat | **Full basic / partial rich features** | Text/PM/history/commands work; read/unread/typing/emotes/link richness/zen are incomplete. |
| Friends | **Partial** | Commands + state work; People/friends UI and friend-aware sorting are missing. |
| Linked Accounts | **Command-complete / UI missing** | Link/unlink/linked commands work; native explanation/workflow absent. |
| Tags | **Command-complete / workflow missing** | Add/delete/search/list command paths exist; history/tag browser UI absent. |
| Website Endpoints | **Audited individually** | See endpoint matrix. |
| Research & Bots | **Partial** | Same server protocol can host bots; native bot picker and arbitrary JSON replay are missing. |
| JSON Endpoints | **Audited individually** | See endpoint matrix. |
| Password Reset | **Missing entry point** | Web reset page exists. |
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

# 14A. Exhaustive documented slash-command matrix

This table covers every command currently documented in upstream `docs/chat-commands.md`.
"Fallback" means mobile does not intercept the command locally; it sends the original slash-prefixed
chat text and the authoritative server command parser handles it.

| Command | Mobile status | Native UI | Effort for better mobile UX | Importance | Notes |
| --- | --- | --- | ---: | ---: | --- |
| `/help` | **Full via server fallback** | No | XS | Low | Server returns command help/link. |
| `/bga` | **Full via server fallback** | No | XS | Low | Link-only helper. |
| `/discord` | **Full via server fallback** | No | XS | Low | Link-only helper. |
| `/doc` | **Full via server fallback** | No | XS | Low | H-Group reference link. |
| `/efficiency` | **Full via server fallback** | No | XS | Low | Link-only helper. |
| `/manual` | **Full via server fallback** | No | XS | Low | Link-only helper. |
| `/new` | **Full via server fallback** | No | XS | Low | Beginner guide link. |
| `/path` | **Full via server fallback** | No | XS | Low | Learning-path link. |
| `/variants` | **Full via server fallback** | No | XS | Low | Variant documentation link. |
| `/github` | **Full via server fallback** | No | XS | Low | Repository link. |
| `/playerinfo ...` | **Full command transport** | Missing native profile | M | Medium | Mobile intercepts and sends `chatPlayerInfo`. Server response is chat text + web profile link. |
| `/random [min] [max]` | **Full via server fallback** | No | — | Low | Native control unnecessary. |
| `/replay [game ID] [turn]` | **Full via server fallback** | No | S for share UI | Low–Medium | Generates shareable web replay link. |
| `/rules` | **Full via server fallback** | No | XS | Low | Community guidelines link. |
| `/shrug` | **Full via server fallback** | No | — | Low | Novelty command. |
| `/timeleft` | **Full via server fallback** | No | S if server-status UI exists | Low | Useful during scheduled shutdown. |
| `/uptime` | **Full via server fallback** | No | — | Low | Server-info command. |
| `/pm [username] [msg]` | **Full command transport** | Partial contextual UI | S–M | Medium | Mobile intercepts PM aliases and sends `chatPM`. |
| `/r [msg]` | **Partial** | Input rewrite only | XS | Low | Typing exactly `/r ` expands to `/pm <lastPM> `; direct/pasted `/r hello` reaches a handler that returns failure. |
| `/friend [username]` | **Full command transport** | Missing | S–M | Medium | Better as contextual user action. |
| `/friends` | **Full command transport** | Missing | M | Medium | Friends state exists. |
| `/unfriend [username]` | **Full command transport** | Missing | S–M | Medium | Better as contextual user action. |
| `/link [username]` | **Full command transport** | Missing | M | Low–Medium | Seed-avoidance/account-link semantics need explanation. |
| `/linked` | **Full command transport** | Missing | M | Low–Medium | — |
| `/unlink [username]` | **Full command transport** | Missing | M | Low–Medium | — |
| `/tagsearch [tag]` | **Full command transport** | Missing workflow | M | Medium | Results arrive as server chat text; no structured tagged-games browser. |
| `/version` | **Full mobile-local** | No | — | Low | Reports mobile package version. |
| `/impostor` | **Full via server fallback** | No | — | Low | Pregame novelty helper. |
| `/kick [username]` | **Full via server fallback** | Missing | S | Medium | Strong native pregame contextual candidate. |
| `/s` | **Full via server fallback** | Missing | S | Low–Medium | Auto-start on next join. |
| `/s2` | **Full via server fallback** | Missing | S | Low–Medium | Auto-start at 2. |
| `/s3` | **Full via server fallback** | Missing | S | Low–Medium | Auto-start at 3. |
| `/s4` | **Full via server fallback** | Missing | S | Low–Medium | Auto-start at 4. |
| `/s5` | **Full via server fallback** | Missing | S | Low–Medium | Auto-start at 5. |
| `/s6` | **Full via server fallback** | Missing | S | Low–Medium | Auto-start at 6. |
| `/setvariant [variant]` | **Full for supported variants** | Full options UI | — | Medium | Mobile intercepts aliases; rejects intentionally unsupported variant families. |
| `/startin [minutes]` | **Full via server fallback** | Missing | S | Low | — |
| `/split ...` | **Full via server fallback** | Missing | S–M | Low | Mainly large-community pregame convenience. |
| `/splitauto` / `/sa` | **Full via server fallback** | Missing | S–M | Low | — |
| `/findvariant` | **Full via server fallback** | Missing | S | Medium | Useful native pregame helper. |
| `/missing` | **Full via server fallback** | Missing | S | Medium | Useful native pregame/game helper. |
| `/setleader` | **Full** | **Full** | — | Medium | Native leader transfer/take-lead path exists. |
| `/pause` | **Full via server fallback + native timed UI** | **Full** | — | High | Native Pause/queue path is primary. |
| `/unpause` | **Full via server fallback + native timed UI** | **Full** | — | High | — |
| `/terminate` | **Full** | **Full** | — | High | Mobile intercepts into termination runtime. |
| `/tag [tag]` | **Full command transport** | Missing workflow | S–M | Medium | — |
| `/copy` | **Missing** | Missing | M | Medium | Browser-local command; forwarding to server cannot implement clipboard/replay serialization. |
| `/suggest [turn]` | **Partial** | Missing native button | S–M | Medium | Send works; mobile currently ignores the incoming `suggestion` event. |
| `/tagdelete [tag]` | **Full command transport** | Missing workflow | S–M | Medium | `/untag` alias also works mobile-side. |
| `/tags` | **Full via server fallback** | Missing workflow | S | Medium | Server returns current tags in chat. |
| `/tagsdeleteall` | **Full command transport** | Missing workflow | S | Medium | — |

The important distinction is that **native-control absence is not command absence**. Almost every
documented server chat command already functions today; native work is mostly discoverability and
contextual UX.

---

# 14B. Website and JSON endpoint parity

The upstream website exposes substantial HTTP functionality outside the WebSocket app. These
endpoints should not automatically be reimplemented natively, but they are part of upstream product
capability and therefore belong in the parity inventory.

## Website endpoints

| Upstream endpoint | Purpose | Mobile status | Effort | Importance |
| --- | --- | --- | ---: | ---: |
| `/scores/[username]` | Profile + best scores | **Missing native profile** | L | Medium |
| `/history/[username]` | Player history | **Own history native; arbitrary user missing** | M–L | Medium |
| `/history/[user1]/[user2]...` | Shared history for up to 6 players | **Missing** | M–L | Low–Medium |
| `/missing-scores/[username]` | Non-max scores | **Command fallback only via `/missing` for current context** | M for native page | Medium |
| `/shared-missing-scores/N/... ` | Team missing scores | **Command fallback only in table context** | M | Medium |
| `/tags/[username]` | Player tagged games | **Missing native page** | M–L | Low–Medium |
| `/seed/[seed]` | Games on same seed | **Missing native page; dedicated WS command available** | M | Medium |
| `/stats` | Whole-site statistics | **External only / no native copy** | L | Low |
| `/variant/[id]` | Variant statistics | **External only / no native copy** | L | Low |
| `/tag/[tag]` | Global games matching tag | **Command search only; no native page** | M–L | Low–Medium |

For mobile, native implementation is most justified for **profiles, seed comparison and tags**.
Whole-site/variant stats can remain external links until a concrete product need exists.

## JSON endpoints

| Upstream endpoint | Purpose | Mobile status | Effort | Importance |
| --- | --- | --- | ---: | ---: |
| `/export/[game ID]` | Export arbitrary game JSON | **Unused** | S–M to integrate | Medium for research/share |
| `/api/v1/variants` | Variant names/IDs | **Unused; vendored variant data is authoritative for current build** | — | Low |
| `/api/v1/variants-full` | Full variant metadata | **Unused** | — | Low |
| `/api/v1/variants/[id]` | Paginated variant games | **Unused** | M | Low |
| `/api/v1/history/[username...]` | Paginated player/group history | **Unused; own history uses WS `historyGet`** | M | Low–Medium |
| `/api/v1/history-full/[username...]` | Full player/group history | **Unused** | M | Low |
| `/api/v1/seed/[seed]` | Paginated same-seed games | **Unused; WS `historyGetSeed` is better for native flow** | M | Medium |
| `/api/v1/seed-full/[seed]` | Full same-seed games | **Unused** | M | Low–Medium |

The native client should prefer existing authenticated WebSocket commands when they already provide
the desired product flow. HTTP JSON endpoints are most useful for **external research tooling** and
possibly replay import/export, not as duplicate in-app data paths.

## Other account HTTP surfaces

| Surface | Mobile status | Effort | Importance |
| --- | --- | ---: | ---: |
| Sign in / create account through `POST /login` | **Full semantics** | XS UX clarification | High |
| Change password via `POST /login` + `newPassword` | **Missing** | S | Medium |
| `/password-reset` instructions | **Missing entry point** | XS–S | Medium |
| `/logout` | **Full** | — | High |
| `/test-cookie` | **Full internal session probe** | — | Critical |

---

# 14C. Strict-schema compatibility review

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

- `welcome.settings`, `muted`, `firstTimeUser`, random table name, maintenance/shutdown state;
- lobby `ownerID`, spectators and redundant timing fields;
- pregame player `stats`.

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
| `f92dbef` | Disable `note.unclued` when finished | **Relevant mobile drift; fix recommended.** |
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

1. advance/adapt the **card-presentation** source through #3116 for the finished `unclued` fix;
2. add mobile lifecycle coverage for the **server-side #3129 pregame-spectator behavior**;
3. when implementing JSON replay/import/`copy`, deliberately source the complete current JSON
   semantics from the 2026-09-15..18 upstream changes rather than the older baseline.

---

# 16. Recommended priority by value versus effort

## A. Correctness/drift fixes — do before broad parity work

1. **Handle unsolicited pregame spectator `left` / deleted table**
   - effort: XS–S
   - importance: High
   - reason: real current-server lifecycle mismatch.

2. **Update finished-game `note.unclued` presentation**
   - effort: XS
   - importance: Medium
   - reason: real scoped upstream semantic drift.

3. **Replay scrubber issue #4**
   - effort: M after physical profiling
   - importance: Medium
   - reason: existing known defect; likely temporal-index recomputation.

These should remain separate from tester feedback hotfixes unless a tester hits them in the supported
beta scope.

## B. High-value, relatively low-risk post-feedback work

1. Lobby restructure already specified in `LOBBY_SECTIONS_RESEARCH.md`.
2. Spectator shadowing/perspective selector.
3. Colorblind mode + styled-number presentation.
4. Pregame stats preservation/display.
5. Expose seed/tags/same-seed count already present in history payload.
6. Native contextual PM / player info / friend-unfriend.
7. Multi-bot create/pregame picker.
8. Shared-replay Suggest-current-turn button.
9. Direct `/r` edge-case cleanup.

## C. Medium product slices

1. 4P–6P dense real-card repair (**high importance but larger effort**).
2. Other Scores / seed comparison.
3. Friends history.
4. Game/replay tags workflow.
5. Shared replay creation from history.
6. Arbitrary JSON replay import.
7. `/copy` export/share.
8. Hypothetical morph picker.
9. Full user/profile surface.
10. Chat unread/read/typing.

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

These are substantially worse value-per-risk than the product-shell, accessibility, spectator,
history and 4P–6P work above.

---

# 17. Practical completeness assessment

A useful way to describe current parity is:

### Strong / production-capable

- authentication/session lifecycle;
- ordinary supported table lifecycle;
- 2P/3P core gameplay;
- clues/knowledge/pips/card presentation;
- notes semantics;
- empathy;
- timed play;
- live rewind;
- finished/solo/shared replay core;
- Hypothetical core;
- spectator read-only gameplay;
- supported option/variant rules;
- basic history;
- core chat and most command transport.

### Functionally present but product-incomplete

- 4P–6P;
- spectators;
- notes workflow;
- replay navigation;
- shared replay power tools;
- history;
- friends/social;
- tags;
- slash-command discoverability;
- H-group presentation;
- lobby organization.

### Intentionally unsupported

- speedrun;
- bottom-deck blind play;
- detrimental characters;
- 184 specialized variants.

### Missing largely because mobile has not built the product surface yet

- upstream account settings;
- People/profiles;
- pregame stats;
- Other Scores/friends history;
- shared replay creation;
- JSON import/export;
- sounds;
- colorblind/style-number/reverse-hand preferences;
- typing/read/unread chat polish;
- bot picker.

That distinction matters: most remaining high-value work does **not** require a second Hanabi engine
or a protocol rewrite.

## Final recommendation

Wait for the current beta.1 feedback window before merging large runtime changes.

When the next feature cycle begins, the most defensible order is:

1. fix any tester-confirmed beta defects;
2. land the two small current-upstream drift fixes;
3. 4P–6P dense real-card repair;
4. Lobby restructure;
5. bot multi-select + contextual player actions;
6. colorblind/style-number accessibility;
7. spectator shadowing;
8. history/seed/tags improvements;
9. replay power features and JSON/`copy`;
10. broader profiles/social/settings;
11. only then consider expensive exotic rules/options.

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
| `/playerinfo [username...]` | **Full command path** | direct `chatPlayerInfo` | Native player/profile UI missing. | M | Medium |
| `/playerinfo` | **Full command path** | direct `chatPlayerInfo` | Same. | M | Medium |
| `/random [min] [max]` | **Full through fallback** | server chat command | No need for native UI. | — | Low |
| `/replay [game ID] [turn]` | **Full through fallback** | server chat command | Produces share text/link; mobile does not offer structured replay-link action. | S | Low–Medium |
| `/rules` | **Full through fallback** | server simple response | Link is plain/sanitized text. | XS–S | Low |
| `/shrug` | **Full through fallback** | server chat command | No gap worth native UI. | — | Low |
| `/timeleft` | **Full through fallback** | server chat command | Proactive shutdown UI is separately missing. | S | Low |
| `/uptime` | **Full through fallback** | server chat command | No native UI needed. | — | Low |
| `/pm [username] [msg]` | **Full command path** | direct `chatPM` | Contextual PM action / recipient-bound composer is still missing. | S–M | Medium |
| `/r [msg]` | **Partial** | input rewrite to `/pm` | Normal typed `/r ` works; direct paste/submit `/r hello` hits the incomplete local handler and fails. | XS | Low |
| `/friend [username]` | **Full command path** | direct `chatFriend` | Contextual Friend button/list UI missing. | S–M | Medium |
| `/friends` | **Full command path** | local list from authoritative friends state | Dedicated Friends/People surface missing. | M | Medium |
| `/unfriend [username]` | **Full command path** | direct `chatUnfriend` | Contextual action missing. | S | Medium |
| `/link [username]` | **Full command path** | direct `chatLink` | Native explanation/workflow missing. | M | Low–Medium |
| `/linked` | **Full command path** | direct `chatLinked` | Native linked-account surface missing. | M | Low |
| `/unlink [username]` | **Full command path** | direct `chatUnlink` | Native action missing. | S | Low |
| `/tagsearch [tag]` | **Full raw command path** | direct `tagSearch` | Results are server chat text; no structured results/history UI. | M | Medium |
| `/version` | **Full mobile-local** | local mobile package version | Correctly reports mobile version rather than browser bundle version. | — | Low |
| `/impostor` | **Full through fallback** | pregame server command | Novelty/power-user command; native UI unnecessary. | — | Low |
| `/kick [username]` | **Full through fallback** | pregame server command | Good native owner action candidate on player row. | S | Medium |
| `/s` | **Full through fallback** | server auto-start | Native convenience optional. | S | Low–Medium |
| `/s2` | **Full through fallback** | server auto-start | Same. | S | Low |
| `/s3` | **Full through fallback** | server auto-start | Same. | S | Low |
| `/s4` | **Full through fallback** | server auto-start | Same. | S | Low |
| `/s5` | **Full through fallback** | server auto-start | Same. | S | Low |
| `/s6` | **Full through fallback** | server auto-start | Same. | S | Low |
| `/setvariant [variant]` | **Full for supported variants** | direct `tableSetVariant` | Deliberately refuses the 184 unsupported mechanic variants. | — | Medium |
| `/startin [minutes]` | **Full through fallback** | server pregame command | Optional native timer control. | S | Low |
| `/split [usernames...]` | **Full through fallback** | server pregame command | Native UI only useful for large community tables. | M | Low |
| `/splitauto`, `/sa` | **Full through fallback** | server pregame command | Same. | M | Low |
| `/findvariant` | **Full through fallback** | server command | Strong native Pregame convenience candidate. | S | Medium |
| `/missing` | **Full through fallback** | server command | Strong native Pregame convenience candidate. | S | Medium |
| `/setleader` | **Full + native UI** | direct `tableSetLeader` | Already first-class in Pregame/shared review. | — | Medium |
| `/pause` | **Full through fallback + native timed-game UI** | server command / typed pause runtime | Native UI already covers ordinary pause/queue behavior. | — | Medium |
| `/unpause` | **Full through fallback + native timed-game UI** | server command / typed pause runtime | Already covered. | — | Medium |
| `/terminate` | **Full + native UI** | termination runtime | Already covered. | — | Medium |
| `/tag [tag]` | **Full command path** | direct `tag` | First-class game/replay tags workflow missing. | S–M | Medium |
| `/copy` | **Missing** | browser-local upstream command | Mobile fallback sends text to server, which cannot perform the browser-local copy/export behavior. Needs replay JSON/share implementation. | M | Medium |
| `/suggest [turn]` | **Partial** | direct `tableSuggest` send | Receive-side `suggestion` event/UI is missing, so mobile review interoperability is incomplete. | S–M | Medium |
| `/tagdelete [tag]` | **Full command path** | direct `tagDelete` | Structured tags UI missing. | S–M | Medium |
| `/tags` | **Full through fallback** | server replay command | Returns text; structured tag list missing. | S–M | Medium |
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
| `/seed/[seed]` | Games on the same deal | **Missing native Other Scores**; dedicated WS command exists. | M | Medium |
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

