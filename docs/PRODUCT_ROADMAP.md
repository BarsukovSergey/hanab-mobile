# Hanab Mobile product roadmap

Date: 2026-09-27

Status: **current sequencing authority for post-beta product work**

This document describes **what we intend to do next and in what order**. It is intentionally broader
than the C17 backlog and narrower than the upstream parity audit.

Use the documents together:

- `PRODUCT_ROADMAP.md` — sequencing, product stages, priorities, and milestone boundaries;
- `C17_BACKLOG.md` — inventory of deferred product ideas and known follow-up work;
- `UPSTREAM_PARITY_AUDIT.md` — detailed comparison with Hanabi-Live and remaining parity gaps;
- GitHub issues — concrete defects or scoped pieces of work selected for execution.

The roadmap is not a promise that every listed feature ships. Tester evidence, upstream changes,
risk, and product value can reorder later phases.

## Where the project is now

Hanab Mobile already has the difficult gameplay foundation:

- authenticated hanab.live session lifecycle without app-owned credential storage;
- authoritative table create/join/leave/reconnect behavior;
- serious 2P/3P live gameplay and adaptive 4P–6P real-card presentation;
- explicit safe Play/Discard/Clue actions;
- pinned-upstream H-group and clue/discard resource-state presentation cues without changing action legality;
- server-backed H-group features, Real-life mode, reverse-hand direction, and untimed-timer gameplay-presentation settings;
- notes, knowledge/empathy, Last Action / Recent and live Rewind;
- finished replay, shared review, turn suggestions and Hypothetical including card morph/unmorph;
- spectator mode with perspective switching;
- History, Friends history, Other Scores, authoritative seed/turn metadata with Copy seed, and game tags;
- People/Friend actions with friends-first visual emphasis, table chat, session PM Dialogs, direct `/r`, and authoritative mute-state guarding;
- account creation clarification plus Change password / Forgot password entry points;
- standalone Android beta APK/release flow.

The current tester binary is **1.0.0-beta.2**, frozen at
`45d99d15960d04934ea0ce07fcb90db73eb206df`.

Post-beta work must not redefine that binary. Tester reports should continue to reference its frozen
version/hash while new development proceeds on `main`.

## Priority rules

When work competes for attention, use this order:

1. **Safety and correctness** — accidental actions, stale authoritative state, reconnect/lifecycle
   failures, crashes, corrupt replay/game identity, unsupported-rule false positives.
2. **Tester-confirmed blocking defects** in the distributed beta.
3. **Mobile product quality** — navigation, information architecture, app shell, readability,
   accessibility, touch ergonomics and device behavior.
4. **High-value Hanabi-Live parity** where mobile context benefits from a native workflow.
5. **Serious-player review and analysis tools**.
6. **Nice-to-have presentation and convenience polish**.
7. **Exotic rules/web parity** only when explicitly reprioritized.

Do not let a large count of small parity gaps outrank one major mobile-product problem.

## Permanent product/architecture guardrails

These constraints apply across every roadmap phase:

- hanab.live/server state stays authoritative;
- do not create a second independent Hanabi rules engine in UI code;
- never replay/retry gameplay actions automatically across reconnect;
- card-bound UI state remains keyed by stable card identity/order, not transient slot position;
- unsupported variants/rules fail closed rather than pretending to work;
- do not store account passwords or authentication tokens in Redux/application state;
- preserve the platform-owned authenticated session boundary;
- do not replace existing authoritative WebSocket flows with ad-hoc REST merely for convenience;
- web Hanabi-Live is a semantic reference, **not** a pixel-for-pixel mobile design specification;
- slash commands remain a valid fallback even when useful native controls are added.

---

# Phase 0 — beta.2 feedback and stabilization

This lane is active while testers are using beta.2.

## Do immediately when confirmed

Prioritize reports involving:

- accidental Play/Discard/Clue sends;
- stale state after reconnect/background/foreground;
- incorrect card identity or replay/history state;
- crashes/freezes;
- required controls hidden by system UI;
- inability to distinguish Live from Rewind;
- serious 4P–6P layout failures;
- authentication/session regressions.

Hotfixes should remain small and isolated from unrelated feature work.

## Known deferred defects / UX signals

- GitHub issue #4 — replay scrubber jank during rapid scrubbing.
  Optimize only after profiling; preserve current coalescing/final-position semantics.
- GitHub issue #58 — compact mobile shell and Pregame information density.
  Treat this as **input to the larger Mobile App Design phase**, not as the complete design task.

Physical upgrade/clean-install validation can still be recorded for beta.2, but the already distributed
APK identity must not change under the same version.

---

# Phase 1 — small independent product slices

These are useful pieces that can proceed while tester feedback is still arriving because they do not
require redesigning core gameplay.

## Multi-bot Create/Pregame picker

Implemented in PR #91, including protected-table invites.

Use the existing research in `COMMANDS_AND_BOTS_RESEARCH.md`:

- source-controlled registry of verified exact bot usernames;
- explicit per-bot capabilities instead of guessing from naming;
- multi-select in Create table and Pregame;
- reuse authoritative PM `/join` semantics;
- use create-form/table password only transiently;
- never persist table/account passwords;
- re-check authoritative free slots before sending each invite;
- one failing bot invite must not synthesize or suppress other outcomes.

No bot-only server protocol should be invented.

## Selected native Pregame conveniences

The first small contextual controls are implemented where mobile UI clearly beats command typing:

- Kick player for an eligible owner;
- Find needed variant;
- Missing max scores.

Native auto-start helpers (`/s`, `/s2`…`/s6`, `/startin`) are not planned in the current roadmap. Keep those commands as slash-command fallback rather than creating mobile controls.

## Specific-seed creation discoverability

Implemented in PRs #128–#129. Create table now exposes `Use specific seed` as a thin UI over upstream `!seed [suffix]`, and canonical History entries can prefill the same Create flow through `Play this seed` without new server/protocol semantics. The server still owns the final seed construction from actual players and variant.

## Read-only tag discovery

Implemented in mobile PR #92. Upstream Hanabi-Live PR #3136 is merged, so the read-only
`/api/v1/tags/:username` and `/api/v1/tag/:tag` capability is available on the production line.
History exposes Tagged games and exact tag search while reusing the existing replay/share flow.
Tag removal and delete-all remain deferred; this slice has no tag mutation UI.

---

# Phase 2 — major Mobile App Design pass

This is a **required major product stage before treating Hanab as a mature store-facing mobile app**.

The current client is functionally strong but much of its shell still feels like a website adapted to
a phone: local screens, Back chains, panels, and context menus accumulated around features rather
than one deliberate app-level navigation model.

This phase is not “add a bottom bar.” A bottom bar is one possible solution. The task is to
re-design the **information architecture, navigation contract and visual shell of the whole app as a
mobile-first product** while preserving the already-correct gameplay/runtime semantics.

## 2.1 Information architecture

First define the top-level destinations and ownership of each surface.

Candidate destinations to evaluate include:

- Lobby / Home;
- History / Review;
- People / Social;
- Messages / Chats;
- You / Profile;
- Settings;
- an active Game / Return to game destination or persistent affordance.

Questions that must be answered deliberately:

- Which surfaces are true top-level destinations?
- Does Profile replace/absorb parts of People, History and account settings?
- How is an active attended game represented while browsing another top-level surface?
- When should Game become the primary destination?
- Which flows are full screens, sheets, dialogs or contextual menus?
- What does Android Back do from every top-level and modal state?
- What remains reachable during Pregame versus live Game versus replay?
- How do chat/PM surfaces fit the navigation model?

A persistent bottom navigation pattern such as
`Lobby · History · People/Profile · Settings` is a candidate, not a pre-decided requirement.
The design should be tested against active-game routing and small-phone space before adoption.

## 2.2 App shell

Create a consistent shell instead of screen-specific navigation chrome:

- top-level navigation;
- active-game affordance;
- header/title conventions;
- sheets/dialogs/context actions;
- global status/error/offline patterns;
- consistent loading and empty states;
- safe-area/system-navigation behavior;
- predictable Back behavior.

The shell must not obscure active gameplay or consume unnecessary vertical space.

## 2.3 Lobby and Pregame redesign

Revisit these as product screens, not collections of existing panels:

- clear Home/Lobby hierarchy;
- own active/rejoinable game prominence;
- table discovery and Create placement;
- compact but readable Pregame roster;
- owner/leader controls;
- spectators/stats;
- bot invite and useful contextual actions;
- password-protected table UX;
- reduce duplicated headings/chrome and wasted vertical space.

Issue #58 belongs here.

## 2.4 Live Game shell and HUD

Preserve C17 gameplay semantics while redesigning app chrome around them.

Revisit:

- Lobby/exit navigation prominence during active play;
- Score / Max / Clues / Strikes / Deck / Pace / Eff hierarchy;
- placement of Chat, Game menu and contextual actions;
- Live / Rewind state prominence;
- unread indicators;
- 2P portrait vertical allocation;
- dense 4P–6P presentation;
- safe explicit action affordances.

Do not change authoritative Pace/Eff semantics, the #107/#108 H-group/resource-state thresholds, or the #110 server-backed presentation-setting gates just to make the HUD prettier.

## 2.5 History, People, Profile and Settings

Bring non-game surfaces into one coherent product system:

- History / Friends history / Other Scores;
- People, friends and PM entry points;
- a coherent Messages/Chats surface instead of session-only contextual PM dialogs;
- richer player/profile surface;
- account/security, card appearance and gameplay-presentation settings;
- tag workflows;
- replay entry/sharing actions.

The goal is to remove the feeling that each feature added its own mini-navigation system.

Chat/messaging design belongs in this phase rather than as a pre-beta cache patch. Decide whether
Messages is top-level or owned by People/Profile; define a conversation list and full conversation
screen; define PM unread/read, reconnect/offline, local persistence and logout/privacy behavior; and
decide whether durable history should remain device-local or eventually consume an upstream PM
history capability. Lobby/table chat and private conversations should share presentation primitives
without pretending they have the same authoritative history semantics.

## 2.6 Visual design system pass

After the navigation/IA decisions are stable, perform a coherent visual pass:

- typography hierarchy;
- spacing scale;
- icon strategy;
- surface/panel/card usage;
- button/action hierarchy;
- inputs/forms;
- destructive/primary/secondary actions;
- states for selected/disabled/pending/error/success;
- modal/sheet geometry;
- dark/light consistency;
- animation and haptics where they improve comprehension.

Do not begin this phase with cosmetic mockups while the navigation model is still undecided.

## 2.7 Responsive and accessibility contract

Design the shell intentionally for:

- compact portrait phones;
- 2P and 4P–6P dense game states;
- landscape phones;
- tablets / larger screens;
- gesture and three-button Android navigation;
- system font scaling;
- touch-target minimums;
- keyboard behavior;
- colorblind/readability requirements.

Landscape and tablet do not need identical UI to portrait; they should share semantics and navigation.

## 2.8 Expected design deliverables

Before broad implementation, produce:

1. app-level destination/flow map;
2. navigation + Android Back contract;
3. low-fidelity wireframes for Lobby, Pregame, live Game, History, People/Profile and Settings;
4. decision on active-game affordance and any bottom navigation;
5. component/design-system inventory: keep / revise / replace;
6. responsive rules for phone portrait, phone landscape and larger screens;
7. implementation slices that can land incrementally without rewriting gameplay state;
8. device validation plan.

## Definition of done for the Mobile App Design phase

The phase is successful when:

- a user can understand the app's main destinations without learning implementation history;
- navigation feels like one mobile application rather than linked website-like screens;
- an active game is always safe and discoverable;
- Android Back behavior is predictable;
- Pregame and live Game have intentionally different information hierarchy;
- History/social/settings use the same design language;
- gameplay correctness and server authority remain unchanged;
- 2P through dense supported 4P–6P remain usable;
- the new shell has physical-device evidence before becoming the next broad tester baseline.

---

# Phase 3 — profiles, social and history depth

After the shell is coherent, deepen the user-facing product surfaces:

- rich player profile / best-score presentation;
- arbitrary-player history;
- profile → history / friend / PM navigation;
- broader friends/social workflows;
- linked hanab.live account management if worth first-class UI;
- richer tag/history exploration.

Potential push notifications belong here only after verifying authoritative server/background-delivery
capability and permission UX. Do not invent local notifications that imply state the server cannot
reliably deliver.

Additional server-backed typing/presence features should likewise wait for real capability rather
than local fiction; table-chat unread/read synchronization is already implemented.

---

# Phase 4 — advanced replay and review tools

The core review system is already strong. This phase adds power-user analysis tools.

Candidates:

- replay arrows / annotations;
- replay sounds where useful;
- user-facing shared replay efficiency-modifier origin controls;
- optional shadow-link opening/import if concrete demand justifies wiring URL seats into the existing spectator-perspective flow;
- replay scrubber performance work if issue #4 remains material.

Hypothetical card morph/unmorph controls landed in PR #114, arbitrary JSON replay import landed in PR #116, `/copy` export/share landed in PR #118, canonical replay-link opening/import landed in PR #120, bounded running-game link opening landed in PR #122, and player-join pregame link opening landed in PR #124; none is a remaining Phase 4 candidate.

Treat import/export and annotations as a designed workflow, not a collection of raw command ports.

---

# Phase 5 — serious-player productivity tools

These features deepen the C17 workspace rather than expand broad product navigation.

## Notes / knowledge

- Previous / Next / Save-and-next note navigation;
- fast read-mode tags / possible Undo flow;
- dedicated Clued / Unclued / Blank actions if they improve speed;
- deeper Knowledge workspace;
- two-card / two-hand comparison;
- comparison pins.

## Clue planning

- multiple clue candidates / Compare;
- clue pins;
- off-turn read-only planning;
- zero-token rehearsal with hypothetical touched-card preview.

## Gestures / interaction

- hold-and-drag note peeking;
- optional empathy Hold/Toggle preference;
- optional drag-to-play / drag-to-discard only as a supplemental mode.

Explicit safe Play/Discard controls remain the baseline even if gestures are added.

---

# Phase 6 — release/store readiness

A real public/store release needs its own engineering/product stage beyond the current internal APK
workflow.

Required work includes:

- Play Store signing policy;
- AAB build/publishing pipeline;
- versionCode/versionName/release policy;
- separation of internal tester builds from store artifacts;
- release checklist and rollback policy;
- final icon/splash/branding review;
- About / licenses / attribution obligations;
- privacy/permissions review;
- store listing/screenshots/copy when the product shell is stable;
- physical upgrade and clean-install testing for release candidates.

Do not mix signing/store infrastructure changes into gameplay hotfixes.

The major Mobile App Design pass should happen **before** positioning the app as a mature store-facing
product.

---

# Parallel maintenance lane

Maintenance continues independently when it can be isolated safely:

- keep GitHub Actions current;
- monitor Expo SDK 57 compatible patches;
- monitor the `xcode -> uuid` advisory chain;
- do not use `npm audit fix --force`;
- take compatible dependency fixes only with prebuild/release-build validation;
- clean Jest/jsdom deprecations with the compatible toolchain rather than forced transitives;
- watch upstream protocol/schema drift;
- before a server implementation migration, normalize optional spectator fields at the protocol
  boundary as already documented in the parity audit.

Dependency updates intended for a distributed APK require the normal beta regression process.

---

# Deliberately not near-term

Do not allow “parity completeness” to drag the project into low-value work prematurely.

Currently low-priority / explicitly unsupported areas include:

- 184 specialized variant families requiring unsupported mechanics;
- speedrun;
- bottom-deck blind play;
- detrimental characters;
- premoves;
- full web emote/sound ecosystem;
- native copies of every statistics website page;
- a native button for every slash command;
- cosmetic animation work that displaces correctness/navigation work.

These can be revisited only with a concrete user need or deliberate product decision.

---

# Near-term execution order

Beta.3 feature scope is frozen after the completed small slices: read-only tag discovery (#92),
specific-seed Create (#128–#129), reverse hands (#131), server-backed Create preferences (#132), and
show-timer-in-untimed (#133). Upstream #3136 and #3139 are merged; the #3139 JSON replay URL
visibility semantics were sanity-checked against mobile and require no mobile code change.

Before distributing beta.3:

1. keep only correctness/safety regressions eligible for runtime changes;
2. reconcile release/version metadata and freeze one candidate SHA;
3. build the beta.3 artifact;
4. validate upgrade over beta.2 plus a clean install on a physical device;
5. run the focused gameplay/replay/spectator/chat/background smoke;
6. distribute the immutable candidate to testers.

After beta.3:

7. execute the Mobile App Design implementation as a coherent milestone, including the Chat /
   Messaging redesign;
8. run a new physical-device/product UX validation pass;
9. deepen profiles/social/history;
10. add advanced replay/review tools;
11. add serious-player notes/clue-planning productivity features;
12. complete store/AAB/release readiness when the product itself is ready.

This ordering is intentionally product-first. The remaining work should make Hanab feel increasingly
like a deliberate mobile application, not merely maximize the number of Hanabi-Live features copied
onto a phone.
