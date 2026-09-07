# C17 UX Decisions

Date: 2026-09-08
Status: **ratified**

This file records the product decisions made after reviewing the Astra Pro C17 UX contract. The authoritative current contract is `docs/C17_UX_CONTRACT.md`.

## D01 — Table Ledger + Decision Workbench

**Decision:** ACCEPT.

The live game is a stable table/hand composition plus a reserved workbench. It is not a vertically scrolling document of large hand panels.

Why: serious Hanabi decisions depend on comparing multiple hands while retaining actor/resources/action context.

## D02 — Exact dense geometry

**Decision:** VALIDATE FIRST.

The Astra 360 x 640 dp feasibility allocation and ~52 dp opponent rows are useful hypotheses, not frozen usability truth.

First implementation step is a real production-path dense 6P prototype on Android. If miniature full-card rows are not comfortably readable, use Compact Overview + focused/pinned comparison for that window class rather than returning to a long feed.

## D03 — Empathy

**Decision:** MODIFY.

C17 includes both:

- persistent per-hand empathy;
- explicit global empathy toggle similar to the web whole-table knowledge view.

Hold is not required. Global empathy is removed from the STOP list.

Reason: the two views solve different expert tasks and reuse the same upstream knowledge semantics; global mode should be an additional explicit tool, not the only default view.

## D04 — Trash/useless card visual treatment

**Decision:** VALIDATE FIRST.

Do not freeze a ban on transparency. The requirement is immediate scannability without losing rank/suit readability or confusing trash with KT, critical, selection, or disabled state.

First candidate to prototype is the familiar semi-transparent/subdued card treatment. Keep it if it remains readable on-device.

## D05 — Rotation / background lifecycle

**Decision:** ACCEPT Astra product policy; supersede C16 blanket transient reset presentation behavior.

Preserve reasoning state where still valid: note draft/cursor, selected card identity, clue target/candidate, comparison pins, empathy target/mode, replay position/follow state.

Clear unsafe pointer/gesture/action-arming state and revalidate against authoritative state. Never retry gameplay commands.

## D06 — Propose Variant

**Decision:** UNRESOLVED CAPABILITY; VERIFY BEFORE IMPLEMENTATION.

Do not freeze a plain-chat fallback as the final UX. Inspect the actual web/upstream/server behavior during C17-6. Use a structured authoritative proposal capability if it exists. Only consider chat suggestion fallback if no structured capability exists.

## D07 — Live in-game history

**Decision:** MUST; linear rewind interaction ratified after physical UX review.

A29 Live in-game history remains an explicit release gate. Reviewing history must be clearly distinct from Live, disable gameplay sends, preserve inspection context, and return to current state in one action without stale action arming.

The C17 live rewind interaction is intentionally one-dimensional:

- Back moves one authoritative action backward;
- Forward moves one authoritative action forward;
- long-press Back jumps to the first action;
- long-press Forward jumps to the latest action available to rewind;
- a touch scrubber/timeline provides fast direct movement and snaps to authoritative actions, never raw internal segments;
- Exit / Live returns to the current authoritative live state.

Do not expose Before/After as a persistent rewind axis and do not reintroduce separate Older/Newer plus Before/After controls. The selected rewind point is the state after the selected authoritative action.

Last Action remains visible and actionable during rewind. Tapping it opens the same compact Recent actions surface, scoped to the current temporal point. Tapping a Recent action jumps directly to that action in rewind. In Live, Recent is scoped to the current live tail.

Incoming live actions may extend the right edge while the player is rewinding but must not force an exit or move the selected historical point. Visible NEW state communicates that Live advanced.

## D08 — Card action input

**Decision:** C17 MVP uses explicit two-step actions.

Tap own card -> explicit Play/Discard button.

Drag-to-play/discard is a plausible optional control mode after MVP acceptance. Do not make drag a C17 blocker and do not let it replace the safe button mode.

## D09 — Animations

**Decision:** functional animations belong in C17.

Use short non-blocking state-change emphasis for play/discard, clue touches, actor changes, resource deltas, and last action. Animation never owns meaning or delays the ability to inspect the new authoritative state.

Decorative cinematic animation remains later scope.

## D10 — App navigation during play

**Decision:** no permanent bottom app navigation inside live game or replay.

Use the space for the gameplay workbench/timeline. Table/Home/participants/settings/administrative actions remain clearly reachable through a bounded secondary surface.

## D11 — People/profile/friends scope

**Decision:** include minimal functional parity in C17 where existing server capability supports it.

Include online/user search, compact profile, and friend state/list/find-online-friends affordance. Do not expand C17 into feeds, achievements, rich profiles, recommendation systems, or messaging redesign.

## D12 — Live statistics

**Decision:** modify Astra information hierarchy.

- Show current clue count without permanently showing `/8` in ordinary eight-clue play.
- Show FRE (Future Required Efficiency) by default when meaningful.
- MRE and detailed statistical explanation are one action away.
- Keep pace visible when meaningful.
- Do not invent a mobile-only efficiency metric.

## D13 — C17 architecture versus C16 UI

**Decision:** C17 product composition supersedes C16 presentation decisions where they conflict.

Do not preserve the current long-scroll GameScreen, hold empathy, or blanket lifecycle reset simply because they already exist.

C16 technical/semantic guarantees remain protected: server authority, upstream rules, reconnect safety, identity-keyed card semantics, and no gameplay action replay across reconnect.

## D14 — Freeze/change-control rule

**Decision:** ACCEPT.

After v1.1 freeze, reopen a decision only because of a failed acceptance case, newly evidenced semantic/platform defect, or explicit versioned product decision. Do not restart subjective redesign after a slice has passed.
