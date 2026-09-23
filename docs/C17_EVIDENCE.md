# C17 Physical UX Evidence

Date: 2026-09-23
Status: **evidence / defect history, not product authority**

Product/UI authority remains `docs/C17_UX_CONTRACT.md`. Ratified decisions live in `docs/C17_UX_DECISIONS.md`; validation gates and pass/fail status live in `docs/C17_VALIDATION.md`.

This file exists so the physical observations that motivated C17 do not live only in a chat transcript. It records observed behavior and defects. A listed defect is evidence, not permission to reintroduce an old C16 presentation pattern.

## 1. C17-0 dense portrait evidence

### First Full Ledger attempt on ordinary Android portrait — FAIL

Physical screenshots of the first C17-0 production-path 6-player portrait prototype showed:

- HUD, fireworks/discard summary, last action, and opponent card identities were individually readable;
- all five opponent rows could be represented;
- the composition did **not** fit vertically once the local-hand band and reserved Workbench were included;
- the local hand was clipped/covered at the bottom by Android three-button navigation;
- the reserved Workbench was pushed below the usable viewport;
- the failure remained in the 6P + One Extra Card case (four-card hands), so it was not merely a width problem;
- therefore the original mathematical full-ledger fit calculation was a false positive for this window class.

### First fixed Compact Overview attempt — FAIL AS ALLOCATION POLICY

The immediate fallback hard-capped ordinary portrait opponent cards around 34 dp and reserved a fixed Workbench band. The next physical screenshot showed:

- all required regions now fit above Android navigation;
- opponent hands became much smaller than necessary;
- a large amount of useful vertical space remained empty below the Workbench;
- therefore a binary breakpoint with fixed compact card heights wastes space and is not the correct final policy.

### Current density rule implemented after both failures

C17 should allocate dense portrait space adaptively rather than choose between two arbitrary fixed card sizes:

1. subtract fixed app/table/system chrome;
2. reserve only a minimum actionable Workbench band;
3. reserve the stable local-hand band;
4. divide the remaining height across all opponent rows;
5. cap by width and reasonable maximum card size;
6. classify the result as Full Ledger when the resulting opponent card faces remain above the readability floor;
7. use true Compact Overview only when the computed card faces would fall below that floor.

The Workbench is a protected interaction region, not a permanently oversized empty rectangle. In idle state it may be only the minimum action band; note/clue/inspection tools can use a larger surface when active while preserving return context.

Geometry remains stable for the current window/text-scale/player-count/hand-capacity class and must not reflow merely because hands shrink later in the game.

### Current adaptive implementation — PASS on the tested Android portrait class

The repair landed incrementally across PRs #37–#41 rather than as another fixed breakpoint:

- #37 introduced the adaptive allocator with a protected own hand, a 46 dp opponent-card readability floor, shared card headroom, and authoritative `cardsPerHand` capacity;
- #38 integrated side-label rows and reduced dense Workbench/chrome cost into the production C17 workspace;
- #39 reclaimed enough production vertical space for real-card 6P on the physical device class by compacting dense Last Action/table chrome without lowering the 46 dp floor;
- #40 made the dense ClueComposer fit inside the existing 56 dp Workbench reserve, with a two-row palette and explicit Close/Give actions visible without scrolling;
- #41 removed redundant C17-only bottom padding while keeping the bottom `SafeAreaView` as the Android navigation protection.

Physical validation on 2026-09-23 now covers:

- 5P portrait with real opponent card faces;
- ordinary true 6P portrait with five real opponent hands and a real own hand, without `Compact Overview`;
- 6P + One Extra Card with the authoritative four-card hand capacity and real cards for every hand;
- dense clue planning with the full palette and Close/Give visible without scrolling;
- the C17 lower edge ending at the Android navigation safe-area boundary without the former redundant internal gap.

This closes the current 4P–6P **card-face layout repair** for the tested portrait class. It does not claim full serious-play coverage on every device, font scale, landscape/tablet composition, or spectator perspective. `Compact Overview` remains an emergency fallback for geometry that cannot satisfy the real-card floor.

### Other defects visible in the same prototype evidence

These were visible in the C17-0 prototype and are retained as historical evidence; do not assume they remain current without reproduction:

- opening turn still displays `TURN 0` even though human-facing turn numbering should start at 1;
- empty discard presentation still says `None`; target terminology is `Empty`;
- the C17-0 Workbench is still only a reserved prototype surface, so the new 6P portrait route does not yet provide full Play/Discard/Clue/Note parity.

## 2. Earlier physical smoke — lobby and product shell

Observed problems:

- Lobby grouping was directionally correct: pregames first, spectates next, reviews/replays lower.
- Create Table should open a creation flow rather than creating an active table immediately.
- Profiles, friends, useful online/user discovery, and useful home entry points were missing.
- Shared replays/history entry points were missing or insufficient.

## 3. Earlier physical smoke — pregame

Observed problems:

- spectators were not displayed;
- `Connected` was unclear/low-value status copy;
- player <-> spectator switching / Join equivalent was missing;
- Propose Variant was missing; exact authoritative transport remains to be verified before implementation;
- explicit Lobby navigation was missing/unclear;
- Settings could appear to do nothing inside pregame and then open after leaving, indicating a navigation/state bug;
- `(you)` was too weak as self-identification;
- chat Enter should send once;
- keyboard could cover chat/content;
- dark-theme text could become effectively invisible on black.

Do not invent a Ready protocol to solve pregame clarity.

## 4. Earlier physical smoke — live gameplay

Observed problems:

- current actor / `YOUR TURN` was not clear enough;
- `Low score phase` copy was unclear;
- VTK/terminate was buried in chat even though the action itself worked;
- human-facing turn displayed `0` on the opening turn;
- max/achievable score, pace, FRE/efficiency context, and useful timing/stat presentation were incomplete;
- spectator list was missing;
- `Your hand online` was low-value/confusing copy;
- discard at clue capacity could appear to no-op; later evidence showed the authoritative rejection message `You cannot discard while the team has 8 clues.` — preserve exact state semantics and make the reason visible;
- player seating/order could be wrong or unstable;
- current actor/hand needed a stable highlight without row reordering;
- zero-clue, DDA, clue-capacity, and endgame warnings were insufficient;
- play/discard feedback did not communicate enough about what just happened;
- bottom copy consumed space without helping decisions;
- duration/player-time presentation was poor.

## 5. Earlier physical smoke — clue workflow

Observed problems:

- color controls rendered poorly; red/purple could overflow;
- color clue controls should expose actual suit/color identity plus readable text/symbol support;
- preview existed, but switching candidate required Cancel then a new selection;
- result wording such as `blue cards 4, 2` was poor; target is ascending displayed slots, e.g. `slots 2, 4`;
- clue tools disappeared too aggressively instead of supporting candidate comparison;
- arrow treatment was visually weak;
- zero-clue/DDA/capacity context needed to remain visible;
- authoritative clue semantics themselves appeared sound; the main problem was interaction/presentation;
- serious play needs comparison of multiple candidate clues/targets without destroying surrounding hand context.

## 6. Earlier physical smoke — notes

Observed problems:

- keyboard could cover nearly the entire useful game context;
- `?`, `!`, and KT were not presented clearly enough;
- quick note tokens must preserve existing active semantics rather than replacing/deactivating previous meaning;
- tapping a card should first allow reading a note without immediately editing/opening IME;
- critical/KT/trash/knowledge indicators lacked a coherent hierarchy;
- advanced quick-note controls are needed for common upstream-supported concepts;
- server/shared clue knowledge and personal notes/hypotheses must remain visibly distinct;
- note identity lifecycle by card order worked; the workflow around it was the main failure;
- note must never migrate to a newly drawn card occupying the same displayed slot.

Important upstream parser evidence: blindly appending ` | token` can preserve text while making only the final pipe segment semantically active. C17 quick annotations must compose upstream semantics, not merely concatenate strings.

## 7. Earlier physical smoke — card state / knowledge

Observed needs:

- engine-proven trash/dead/useless cards need an immediately scannable low-emphasis treatment;
- semi-transparent/subdued treatment is the first physical candidate, not a forbidden technique;
- rank/suit identity must remain readable;
- trash must not be confused with personal KT, critical, selected, disabled, or empathy state;
- Black/Rainbow and other suit identities need symbols/abbreviations/contrast, not color alone;
- permanent knowledge, latest clue, notes, critical/DDA, personal hypotheses, selection, and candidate preview need distinct channels rather than badge soup.

## 8. Earlier physical smoke — empathy

Observed problems:

- hold-only empathy was inconvenient;
- small finger movement could disable it;
- the finger covered the information being inspected;
- expanded empathy could become a giant knowledge page and destroy table context;
- replay empathy was even harder to use.

Ratified C17 direction from this evidence:

- persistent per-hand empathy;
- explicit global empathy toggle;
- no hold requirement;
- stable hand geometry/order;
- notes remain a separate layer.

## 9. Earlier physical smoke — temporal awareness / action history

Observed problems:

- live rewind/history was missing;
- action feedback/logging was insufficient;
- after one of several identical-looking cards was played/discarded, the old displayed slot could not be reconstructed from the UI;
- a line like `Barsukov -> testforapp: 1 · cards 2` was not enough to understand the event;
- serious play needs actor, action, exact old slot/card identity, touched cards, resource delta, and before/after reconstruction.

This is why C17 requires persistent Last Action plus A29 live history rather than a giant chronological log under the table.

## 10. Earlier physical smoke — finished / replay

Observed problems:

- shared-replay leader transfer controls were missing;
- one hand could nearly fill the phone screen and destroy whole-table context;
- score/pace/efficiency statistics were insufficient;
- full logs dominated instead of the selected temporal neighborhood;
- web-style last-turn/end navigation was absent;
- generic `GAME OVER` did not communicate the actual authoritative result/reason;
- empathy interaction was poor;
- restart/remake flow was missing;
- shared replay/history discovery was missing;
- fast temporal scrub/navigation was missing;
- overall replay composition was not suitable for serious analysis.

## 11. Earlier physical smoke — Android/platform

Observed problems:

- Android system navigation could cover gameplay controls/content;
- keyboard could cover note/chat content and controls;
- dark theme could render important content effectively invisible;
- landscape was structurally broken/clipped, including the right/system-navigation edge and local hand;
- Android Back behavior was generally acceptable in the tested path;
- repeated action/double-tap behavior appeared normal in the tested path.

Remaining platform smoke intentionally did not block the start of C17 UX work: real reconnect, kill/reopen, background/foreground, Empty Clues live, final-round/end conditions, long-content extremes, and cold launch. They remain later validation items where applicable.

## 12. Density evidence before C17

Earlier 6P C16 composition required vertical scrolling and made cross-hand comparison depend on scrolling plus memory. This is specifically rejected as the target C17 solution.

The C17 rule is therefore:

- Full Ledger when the safe window/text scale truly supports readable simultaneous hands;
- otherwise Compact Overview with stable representation plus focused/pinned full-size inspection;
- never per-hand horizontal scroll;
- never return to the old long feed merely because 5P/6P is dense.

## 13. Implementation/process lesson from C17-0 FRE

A coding agent initially reported FRE as unavailable because no ready mobile selector existed. That conclusion was too shallow: pinned upstream already exposed the required efficiency state/rules and the web client showed the exact live display semantics.

Rule for future implementation work:

> Before declaring semantic data unavailable, inspect the pinned upstream implementation for an existing rule/helper/state field. Reuse or wrap upstream semantics; do not reimplement them in mobile UI. Report a semantic capability as unavailable only when neither current mobile state nor pinned upstream exposes the required authoritative inputs/logic.

Scope limits should constrain **what is changed**, not prevent checking the authoritative source of truth.
