# 4P–6P dense portrait layout research

Date: 2026-09-22

Status: research only. No runtime behavior changes.

## Goal

Identify why ordinary 4P–6P portrait gameplay falls into the current Compact Overview / summary-card
fallback, and define a lower-risk implementation direction that preserves real card faces without
destabilizing the beta.1 2P/3P path.

The distributed beta.1 remains frozen around 2P/3P. This research is for post-beta work.

## Current layout cliff

The current dense allocator has two modes:

- `full-ledger`;
- `compact-overview`.

For three or more opponents, Full Ledger is accepted only when the computed card height is at least
`76` dp. Otherwise every opponent card switches to a fixed `24` dp compact summary.

That creates an abrupt representation cliff rather than a gradual density policy.

The 4P boundary is especially expensive because several things change at once:

1. 2P/3P use the low-chrome side-label row treatment.
2. 4P+ switches to per-row metadata chrome.
3. The per-row chrome grows from 6 dp to 22 dp before card headroom.
4. The Workbench reservation also stops using the 136 dp <=2-opponent value and instead uses the
   general viewport-class value (typically 156 or 176 dp on common heights).
5. If the remaining card height falls below 76 dp, all opponent hands are replaced by summaries.

So the first dense player count loses substantial vertical space to chrome/reservation before card
readability is even evaluated.

## Why this differs from the earlier passing 6P evidence

The preserved physical evidence from the earlier adaptive 6P pass used a different allocation
principle:

1. subtract fixed/system chrome;
2. reserve only a minimum actionable Workbench band;
3. reserve a stable local-hand band;
4. divide the remaining space across opponent rows;
5. cap by width and a reasonable card-size limit;
6. use Compact Overview only if real opponent faces truly fall below a validated readability floor.

That model passed the tested 6P and 6P + One Extra Card portrait states after earlier fixed-size
attempts failed.

The current implementation later made the Workbench a larger fixed shell rectangle and made
Full Ledger use the same card height for the own hand and all opponent hands. Those choices simplify
stability, but they are stricter than the earlier successful dense allocation and make 4P+ much more
likely to cross the summary fallback threshold.

The authoritative C17 contract requires stable Ledger geometry while Workbench tools change; it
does **not** require opponent cards to equal own-hand size or require a large Workbench reservation
for every player count.

## Proposed implementation direction

Do not start by lowering `MIN_FULL_LEDGER_CARD_HEIGHT` or by shrinking everything uniformly.

Introduce a dense-real-card allocation path for 4P–6P:

- keep the local/observed hand as the stable anchor and allow it to remain larger than opponent cards;
- allocate opponent card height from the remaining vertical space;
- keep real `VisibleHanabiCard` faces for ordinary opponent hands;
- reduce dense-row metadata/chrome before sacrificing card identity;
- use a smaller, player-count-aware **stable** Workbench band for dense classes, with tool overflow
  handled inside the Workbench rather than resizing the Ledger;
- preserve geometry for the current window/text-scale/player-count/hand-capacity class;
- keep width fitting authoritative, including One Extra Card and six-suit cases;
- retain Compact Overview only as an emergency fallback for genuinely unreadable window classes,
  not as the normal 4P–6P presentation.

This suggests a three-state mental model even if the code does not literally need three enum values:

1. roomy Full Ledger — equal/larger real cards;
2. dense Full Ledger — smaller real opponent cards + protected own hand;
3. emergency compact fallback — only below an empirically validated readability floor.

## High-leverage changes to evaluate

### 1. Dense Workbench reservation

Current 4P+ can reserve more Workbench height than 2P/3P despite having less room for hands.

Evaluate a smaller fixed Workbench band for dense portrait classes. It must remain stable while
switching tools, but note/clue/history content may scroll internally.

Do not choose the final number from arithmetic alone; validate on device with gesture navigation,
three-button navigation, keyboard-open note/clue states, and ordinary action controls.

### 2. Row chrome

The current 4P+ row treatment spends roughly 22 dp per row on padding/metadata/border before card
headroom, versus about 6 dp in the <=2-opponent side-label treatment.

For five opponent rows that difference is material.

Evaluate compact metadata placement such as:

- narrower single-line labels;
- side/overlay actor and clue-target indicators;
- reducing dedicated metadata height while keeping name/actor/connection state legible.

Do not remove semantic indicators merely to gain space.

### 3. Independent own/opponent card sizes

Dense games should not require all rows to use the same card height.

The own/observed hand is the primary action/inspection anchor and can retain a larger card size while
opponent hands use the largest real-card size that fits the remaining ledger.

This matches the earlier adaptive allocation principle and avoids wasting the entire layout because
one common size cannot satisfy every row.

### 4. Readability floor

The current 76 dp threshold is a product guard, not a proven universal dense-player-count boundary.

Establish an empirical opponent-card readability floor for 4P–6P on target phones using actual card
faces, suit/rank pips, clue borders, notes/knowledge overlays, empathy, Black/Rainbow/six-suit
identities, and touch inspection.

Do not simply lower the constant until tests pass.

## What should stay frozen

Do not change beta.1 2P/3P behavior while tester feedback is still arriving.

The 4P–6P implementation should be isolated behind player-count/dense-class calculations so a beta.1
bug can still be reproduced against the frozen baseline without unrelated layout churn.

Also preserve:

- deterministic seating order;
- local/observed anchor;
- no per-hand horizontal scrolling;
- no root live scroll in certified portrait states;
- Workbench tool changes do not reflow the Ledger;
- authoritative visibility and empathy semantics;
- action safety / no gesture-triggered accidental sends.

## Characterization tests before implementation

Add or strengthen deterministic tests for:

- 4P standard portrait;
- 5P standard portrait;
- 6P standard portrait;
- 4P/5P/6P One Extra Card where legal;
- narrow portrait + enlarged text;
- three-button-navigation usable-height class;
- own hand at least as large as opponent hands;
- every visible normal hand using real card faces in the target 4P–6P classes;
- hand widths fitting without horizontal scrolling;
- total Ledger + stable Workbench fitting the usable region;
- no representation change when a hand shrinks later in the game;
- replay/spectator/hypothetical using the same dense seating geometry.

The current test that explicitly expects `CompactHandCardSummary` for dense opponents should be
treated as characterization of the temporary fallback, not as a target acceptance invariant.

## Physical validation after implementation

A serious post-beta acceptance pass should include:

- full 4P, 5P, and 6P portrait games;
- at least one One Extra Card dense case;
- gesture and three-button Android navigation;
- light/dark and enlarged text;
- notes, clue planning, empathy, discard inspection and live rewind;
- spectator and replay/shared-replay states;
- six-suit / visually dense identities;
- keyboard-open Workbench state.

The implementation is not accepted merely because all rows mathematically fit; cards must remain
practically readable and ordinary gameplay controls must remain usable.
