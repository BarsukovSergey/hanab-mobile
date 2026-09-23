# C17 Validation Plan

Status: **active for 1.0.0-beta.1**
Date: 2026-09-22

This document tracks what C17 must prove on real devices after the v1.2 product review. The authoritative product contract is `docs/C17_UX_CONTRACT.md`; explicit deferred items are in `docs/C17_BACKLOG.md`.

## 1. Dense phone workspace

The current beta acceptance gate covers **2P/3P phone gameplay**.

Validate:

- all visible hands use readable real card faces;
- rank/suit, Black/Rainbow/six-suit identity, note/knowledge/trash/critical state, and selection remain distinguishable;
- own/observed hand, HUD/table, Last Action, and Workbench stay above system UI;
- no root live scroll and no per-hand horizontal scrolling;
- card readability wins over decorative chrome and empty spacing.

4P–6P dense gameplay remains **outside the frozen beta.1 gate**, but the current adaptive real-card path has now been physically validated on the tested Android portrait class. Current evidence covers 5P, ordinary true 6P, and 6P + One Extra Card with real card faces, plus the dense clue composer fitting without scroll and the C17 bottom edge respecting the Android navigation safe area. `Compact Overview` remains only an emergency fallback when the 46 dp opponent-card floor cannot be met. Do not retroactively expand the beta.1 gate; treat this as post-beta validation evidence.

## 2. Direct actions

Validate:

- tap own card selects by durable card `order`;
- Play/Discard require a second explicit tap;
- unavailable actions remain visible but disabled;
- no reason text is required for a disabled action;
- a recognized long press or double tap cannot accidentally send Play/Discard;
- rotation/background cannot turn a stale press into a send;
- reconnect/uncertain transport never queues or retries a gameplay command.

## 3. Notes

Validate the complete edit transaction:

- single tap reads without IME;
- double tap opens Edit + IME;
- a non-empty saved note enters as `saved note | `;
- editing existing text does not leave a spurious trailing pipe;
- F / CM / PTD / KT / Needs Fix / `?` / `!` quick controls modify only the draft;
- Turn insertion uses current authoritative turn text semantics;
- Repeat replaces the draft with the previous entered note;
- Save commits and exits;
- Clear clears the draft only; Save empty deletes;
- Android Back cancels the unsaved draft and exits;
- rotation/background preserves open editor + draft; exact cursor restoration is not required;
- if the card leaves its hand while dirty, the editor remains bound to the same card `order` and Save still targets that order;
- a replacement card in the old slot is never selected implicitly;
- live Rewind can edit the current personal note for a historically visible card by `order`, including cards no longer in current live hands;
- finished/dedicated replay remains read-only where upstream disallows editing;
- parsed impossible own-hand identity hypotheses show an advisory warning but Save remains possible;
- no merge/revision/conflict UI is invented.

Backlog note controls (identity picker, Previous/Next/Save-and-next, read-mode instant tags, dedicated Clued/Unclued/Blank buttons) are not release criteria.

## 4. Clue composer

Validate:

- off-turn short tap on another player does not enter clue mode;
- on our turn, short tap enters clue mode;
- on our turn with zero clue tokens, composer can open but candidate/Give controls are disabled;
- there is no duplicate per-player Clue button;
- entering Clue turns global empathy off;
- palette stays visible after choosing a candidate;
- touched target cards are highlighted in place;
- textual touched-slot list is not required;
- changing target preserves the current candidate and recomputes touched cards/legality against authoritative state;
- candidate stays selected when invalid; Give is disabled without invented reason/config text;
- only explicit Give sends;
- opening a non-replacing overlay such as discard inspection can preserve the plan;
- replacing ClueComposer with Notes/History/another Workbench task clears target/candidate/preview;
- rotation/background preserves the plan only if ClueComposer remains current;
- no hidden clue-plan restoration exists.

## 5. Empathy / knowledge

Validate:

- long-press anywhere on an opponent row/hand, including a card, shows transient empathy until release;
- long-press own hand provides the same temporary perspective;
- a recognized long press consumes the short tap and never opens Clue/selection on release;
- global `All empathy` is the only persistent empathy mode;
- no persistent per-player empathy or separate `Normal` button exists;
- while global empathy is on, per-hand hold is a no-op;
- temporary empathy clears on release/background/rotation/interruption;
- global empathy persists through ordinary background/rotation;
- empathy works on the selected historical state in Rewind and remains read-only there;
- temporary empathy can be used while ClueComposer remains visible without clearing the clue plan;
- row/card geometry does not move when perspective changes.

## 6. Trash / card-state presentation

Validate against the pinned web behavior, not merely a visual preference:

- explicit known-trash + zero positive clues can force fade;
- normal engine-trash fade excludes clued/played/discarded cards and the same Blank/CM/Throw-It-in-a-Hole/speedrun cases as web;
- known-trash-from-empathy uses the appropriate mini-trash indicator behavior;
- DDA/trash indicator exclusions match web;
- faded cards remain legible and do not look disabled;
- Black/Rainbow and light/dark themes remain unambiguous.

## 7. Functional animation

C17 includes only short non-blocking informational transitions. Validate play/discard emphasis, clue-touch emphasis, actor transition, resource delta, last-action update, and reduced-motion behavior.

Pass if authoritative state is already correct while motion runs, inspection/input is not blocked, essential meaning survives reduced motion, and repeated actions do not queue a visual backlog. Richer animation is not a C17 gate.

## 8. Live Rewind / temporal awareness

Validate unprompted:

- enter Rewind from live game;
- Last Action / Recent can jump to a selected authoritative action;
- Back/Forward step one action;
- long-press Back jumps to start;
- long-press Forward jumps to end;
- scrubber snaps to authoritative actions;
- no separate Before/After control or second temporal axis appears;
- table/resources/hands are all from the selected historical state;
- no gameplay send route is available while rewound;
- notes/discard/empathy/knowledge remain inspectable;
- new live actions update `N NEW` without forcing an exit or moving the selected history position;
- Live returns to current authoritative state in one action;
- no old action remains armed after return.

## 9. Finished / replay / shared review / Hypothetical

Run a dedicated review session and verify that the target phone-portrait path stays in the C17 workspace rather than falling back to LegacyGameScreen.

Validate:

- compact authoritative result/reason;
- same Ledger geometry and table semantics as live/review;
- timeline + Back/Forward + long-press edge jumps;
- finished/replay actions are read-only except explicitly supported replay/table controls;
- Quick rematch / Remake appear only under authoritative eligibility;
- shared follower can detach by local timeline inspection without silently broadcasting;
- Follow leader restores synchronization;
- leader behavior/transfer uses authoritative capability;
- active Hypothetical is clearly labeled and never looks like recorded history;
- Hypothetical uses upstream/server semantics only.

## 10. Spectator

Validate live spectator on C17:

- same Ledger/Workbench spatial model;
- observed player from authoritative metadata is the seating anchor;
- no Play/Discard/Clue send route exists;
- notes/empathy/history/replay/shared-review surfaces respect authoritative spectator capability;
- spectator state remains readable in the 2P/3P beta target; the dense allocator now has current 4P–6P player-path physical evidence, but that does not substitute for dedicated 4P–6P spectator/perspective validation.

## 11. Pregame / shell / More

Validate:

`Lobby -> create/inspect -> join/spectate -> switch role -> options -> start -> C17 live/review -> result/replay -> remake/return`

Required checks:

- Create sends only on final explicit Create;
- role, owner, players, spectators and options are clear;
- Join as player / Switch to spectator works in-room when authoritative capability permits;
- owner Start eligibility is clear;
- no fake Ready or invented role/proposal protocol;
- non-owner option proposal uses the existing authoritative `tableUpdate` behavior;
- pregame chat remains keyboard-safe;
- the existing `More` is the single secondary-action overflow;
- no duplicate Table/ellipsis control exists;
- eligible chat, participants/spectators, attendance/Leave, Pause/Unpause, settings, VTK/admin and Sign out are discoverable through More as authoritative capability permits.

People/profile/friends/social features are backlog and are not C17 release criteria.

## 12. Android/window matrix

For beta.1 cover:

- gesture navigation and three-button navigation;
- ordinary target portrait phones;
- rotation into both landscape directions without broken/occluded gameplay;
- light/dark theme;
- normal/enlarged font scale;
- keyboard open/closed + suggestion row;
- 2P/3P extra-hand cases;
- six-suit state;
- spectator;
- zero clues;
- clue-capacity restrictions;
- DDA where authoritative fixtures support it;
- final round/end transition;
- finished/replay/shared review/Hypothetical;
- live Rewind.

A bespoke landscape/tablet layout is backlog; functional safe adaptation is still required. Current 4P–6P portrait evidence is recorded separately below and remains outside the frozen beta.1 matrix.

## 13. Serious-play beta.1 gate

Before treating beta.1 as stable enough for broader internal testing:

- complete ordinary 2P and 3P sessions;
- include real notes and clue planning;
- consult discard during a decision;
- use empathy in real reasoning;
- exercise live Rewind;
- spectate a live game;
- run a separate replay/shared-review/Hypothetical analysis session;
- verify finished-game rematch/remake lifecycle where eligible;
- background/foreground once and verify no stale action is sent.

Required outcomes: no accidental commits, no note migration, no keyboard/system-navigation overlap, no lost note draft, no stale live state after Rewind, and no lifecycle path that unexpectedly falls back to the wrong gameplay surface.

The 4P–6P card-face repair itself is now physically validated on the tested Android portrait class. Broader 4P–6P serious-play/device-matrix acceptance remains a later validation activity and is not part of the frozen beta.1 gate.

## 14. Existing evidence

| Date | Build/commit | Scenario | Result |
|---|---|---|---|
| 2026-09-06 | pre-adaptive C17-0 | Dense 6P Full Ledger | FAIL — local hand/Workbench clipped by three-button nav. |
| 2026-09-06 | fixed compact C17-0 | Dense 6P compact | FAIL — fit but unnecessary over-shrink/wasted space. |
| 2026-09-06 | `b07bfff7569fa0cae1178ce4950cb2d3857aae1f` | Adaptive 6P | PASS for tested class. |
| 2026-09-06 | `b07bfff7569fa0cae1178ce4950cb2d3857aae1f` | Adaptive 6P + One Extra Card | PASS for tested class. |
| 2026-09-07 | `eaf4a9f2887b937f90c58fcc65255db539e22692` | Temporal foundation | PASS technical. |
| 2026-09-08 | pre-linear C17-2 | Rewind discoverability | FAIL. |
| 2026-09-08 | `dfbf9212b3ca8d37df4997cb2649d8d368844ec9` | Linear rewind implementation | PASS technical; physical acceptance pending. |
| 2026-09-23 | `3d4845aa6e6427f9bca6b9330343f0b6e393517d` | Current adaptive 5P / ordinary true 6P portrait | PASS — real opponent card faces, no Compact Overview on the tested class, lower hand region clear of Android navigation. |
| 2026-09-23 | `3a81135a0a5ae2d6b7f20f0c0e5202b7f64897ec` | Dense 6P clue composer | PASS — two-row palette plus Close/Give visible without scrolling while preserving the 56 dp dense Workbench reserve. |
| 2026-09-23 | `92425ba087e9e625ce428d3551b5bd00142a86b7` | C17 bottom safe area + 6P One Extra Card | PASS — redundant internal bottom gap removed; four real cards per hand fit above Android navigation on the tested class. |

Earlier evidence remains useful history but must not be treated as proof of superseded behaviors. The 2026-09-23 rows are the current physical evidence for the merged adaptive real-card path; they still do not make 4P–6P part of the frozen beta.1 gate or certify every device/window class.
