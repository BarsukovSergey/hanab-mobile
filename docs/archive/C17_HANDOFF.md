# C17 Continuation Handoff

> **ARCHIVED SNAPSHOT — 2026-09-06.** The branch/PR/repository-state instructions below are obsolete: PR #3 is historical and C17 has landed on `main`. Keep this file only as implementation-history context. Do not follow its merge, branch, Compact Overview, or "next slice" instructions as current guidance.

Date: 2026-09-06
Purpose: compact project continuation context for a fresh chat / agent session.

This file is **not** product authority. Use it to recover current implementation state quickly, then consult the authoritative documents below.

## Repository state

- Repository: `BarsukovSergey/hanab-mobile`
- Branch: `feat/mobile-gameplay-redesign`
- PR: #3 `feat: redesign mobile gameplay layout and interactions`
- PR must remain **open, draft, and unmerged** unless the user explicitly requests merge.
- Base `main` SHA at this phase: `58488ca29be90f62739de13b1ed61c7aa2bd3ea8`
- Pinned upstream semantic baseline: `e78e82bce2ff5d54b9d2ec359530955fd354e9b7`
- Pinned card-presentation source: `7a9c601b66f5966f7e33564855e25f82e68a94ed`

## Read in this order

1. `docs/C17_UX_CONTRACT.md` — authoritative C17 product/UI contract.
2. `docs/C17_UX_DECISIONS.md` — ratified decisions and rationale.
3. `docs/C17_VALIDATION.md` — current physical acceptance gates and recorded results.
4. `docs/C17_EVIDENCE.md` — physical defect/evidence history that must not be lost between chats.
5. `docs/ARCHITECTURE.md` — technical/server/upstream/networking invariants.
6. `docs/MOBILE_GAMEPLAY_REDESIGN.md` — historical only; subordinate where it conflicts with C17.

## Frozen technical boundary

- Server/upstream state is authoritative.
- Do not implement a second Hanabi rules engine.
- Before declaring semantic data unavailable, inspect pinned upstream for existing state/rules/helpers and wrap/reuse them.
- Gameplay actions are never queued/retried/replayed across reconnect.
- Normal card faces remain upstream-derived; mobile owns layout/overlays/interactions.
- Card notes/actions follow authoritative card identity/order, not displayed slot.
- Latest clue, permanent knowledge, personal notes, preview, selection, last action, trash/critical/KT are distinct semantics/presentation channels.

## Product composition

C17 is built around **Table Ledger + reserved Decision Workbench**.

- no ordinary root gameplay document scroll in certified C17 layouts;
- no per-hand horizontal scrollers;
- deterministic seating relative to local player;
- actor highlight never reorders rows;
- local hand stays anchored next to Workbench;
- Full Ledger only where physical readability passes;
- Compact Overview on constrained windows, with stable all-player representation plus focused/pinned full-size inspection in Workbench;
- never preserve Full Ledger merely by unreadable shrink-to-fit or clipping.

## Ratified decisions that must survive chat reset

- persistent per-hand empathy **and** explicit global empathy; hold is not required;
- trash transparency/subdued appearance is allowed and is first visual candidate; result/readability is frozen, not technique;
- rotation/background preserve valid reasoning context but clear gesture/action arming and never resend gameplay;
- Propose Variant exact transport remains unresolved until upstream/web/server capability is inspected;
- A29 live in-game rewind/history is MUST;
- tap own card -> separate explicit Play/Discard is MVP; drag is optional later;
- short functional authoritative-state animations belong in C17; decorative motion later;
- no permanent bottom app nav in live/replay;
- minimal People/profile/friends parity is in C17 where existing server capability supports it;
- live clue display need not permanently show `/8`;
- pace and FRE are glanceable when meaningful; MRE/deeper stats are secondary;
- FRE semantics must match pinned upstream/web behavior, not a mobile-only metric.

## C17-0 current implementation state

Initial C17-0 production-path six-player portrait prototype was introduced at commit:

`a3766d54e01a3cfc9366072f005260a19837d0cd`

FRE follow-up was added and fixed through:

`2519c2f5cdf9ddff9014a5117b721761be738b68`

Adaptive dense allocation that passed the physical 6P portrait gate is at:

`b07bfff7569fa0cae1178ce4950cb2d3857aae1f`

Implemented C17-0 characteristics:

- six-player live portrait uses a non-scrolling C17 host;
- stable local-relative seating;
- current actor / `YOUR TURN` without row reorder;
- adaptive Full Ledger vs Compact Overview fit mode;
- all opponent hands represented;
- local-hand anchor plus minimum Workbench band;
- fireworks/discard summary and persistent last-action region;
- score, achievable max, clues, strikes, deck, pace, FRE;
- existing C16 route remains for other compositions until later slices migrate them.

C17-0 is deliberately a density/layout prototype, not full C17 gameplay parity.

## C17-0 physical result — PASSED for tested ordinary Android portrait class

Three successive physical checks established the final rule:

1. Initial Full Ledger failed because the local hand and Workbench were clipped by Android three-button navigation.
2. Fixed-size Compact Overview fit, but over-shrank opponent hands and left a large useless empty region.
3. Adaptive allocation passed in both ordinary 6P and 6P + One Extra Card (four-card hands).

The passing adaptive result showed:

- all five opponent hands simultaneously visible and readable;
- four-card One Extra Card hands still readable;
- local hand fully visible above Android navigation;
- HUD, fireworks/discard, Last Action, local hand, and minimum Workbench all fit without root scrolling;
- no required region clipped by system navigation;
- no large unexplained empty region;
- the tested ordinary portrait class can remain Full Ledger after adaptive fitting.

Therefore **do not reopen C17-0 density for this tested window/text-scale class unless a later acceptance case or new device/text-scale evidence fails**. Compact Overview remains the fallback for genuinely constrained classes where adaptive fitting drops below the readability floor.

## Known current presentation defects visible in C17-0 evidence

Do not ask the user to rediscover these:

- opening human-facing turn still shows `TURN 0`; target human turn is 1 where appropriate;
- empty discard copy still uses `None`; target wording is `Empty`;
- C17-0 Workbench is still a placeholder and the new 6P portrait route does not yet expose full Play/Discard/Clue/Note parity;
- current dense C17 route has not yet migrated all C16 note/semantic/latest-clue overlays;
- Last Action wording is still mechanically derived and needs the C17-2 human-readable temporal treatment.

## Next implementation slices

1. **C17-1 Workspace/direct actions** — stable production workspace for supported player counts, safe-area ownership, tap card -> explicit Play/Discard, spectator-safe action surface.
2. **C17-2 Temporal awareness/table inspection** — actor/resources, useful stats, last action, exact before/after, recent events, A29 live history.
3. **C17-3 Knowledge/empathy/notes** — read-first note flow, semantic-preserving quick annotations, keyboard-safe drafts, per-hand/global empathy.
4. **C17-4 Clue workspace** — persistent palette, candidate comparison, retargeting, preserved consultation context, explicit Give.
5. **C17-5 Result/replay/history** — temporal replay workspace, real result semantics, shared follow/leader/hypothetical, remake/rematch.
6. **C17-6 Table lifecycle/shell** — create/join/spectate/options/start/chat/navigation, capability-verified Propose Variant, minimal People.
7. **C17-7 Integration/freeze** — serious 5P/6P and replay acceptance, then delete obsolete presentation paths.

## Important earlier physical evidence

See `docs/C17_EVIDENCE.md` for the full preserved list. High-impact items include:

- pregame missing spectators/role switching/Propose Variant/Lobby and a Settings state bug;
- keyboard occlusion in notes/chat;
- dark-theme invisibility issues;
- landscape clipping/system-nav issues;
- clue UI required cancel/restart to compare candidates;
- notes workflow was technically correct by card identity but operationally poor;
- hold empathy was bad;
- exact old card/slot after play/discard was impossible to reconstruct;
- live history/rewind was missing;
- replay/finished composition was unsuitable for serious analysis;
- old 6P long-feed scrolling was rejected as the C17 solution.

## Process rule for future coding-agent prompts

Do not write prompts that say a semantic value may be used only if a ready mobile selector already exists.

Preferred rule:

> Before declaring semantic data unavailable, inspect the pinned upstream implementation for an existing rule/helper/state field. Reuse or wrap upstream semantics; do not reimplement them in mobile UI. Report unavailable only if neither current mobile state nor pinned upstream exposes the required authoritative inputs/logic.

Bound the **scope of changes**, not the depth of checking the authoritative source.

## Validation discipline

- Use targeted tests while developing.
- Full suite once after a complete bounded implementation when practical.
- CI gate: install, typecheck, tests, `git diff --check`.
- Do not send the user back through known-bad tests already evidenced.
- Physical validation is requested only when the result cannot be established from code/fixtures/CI.
- PR #3 remains draft/unmerged until explicitly requested otherwise.
