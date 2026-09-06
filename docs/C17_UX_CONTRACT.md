# C17 Product & Gameplay UX Contract

Version: **1.1 — frozen product baseline**  
Date: 2026-09-06  
Scope: Android-first Hanab Mobile C17 product/gameplay UX

This is the authoritative C17 product/UI contract for the mobile client. It supersedes presentation and gesture decisions in `docs/MOBILE_GAMEPLAY_REDESIGN.md` and C16 where they conflict. C16 networking, protocol, upstream-semantic, reconnect, and authoritative-state boundaries remain in force.

The contract is based on the Astra Pro v1.0 product/gameplay review plus explicit product ratification after review. Exact density numbers are validation hypotheses until they pass physical-device testing.

## 1. Product verdict

The game must behave as a continuously available decision workspace, not as a long document containing panels.

Primary composition:

- **Table Ledger**: stable seating, all hands, current actor, resources, stacks/discard summary, last action.
- **Decision Workbench**: card actions, clue planning, note read/edit, knowledge/empathy, discard inspection, recent history/chat.
- Ordinary live play has **no root gameplay scroll** and **no per-hand horizontal scrollers**.
- The current actor is highlighted but never reorders player rows.
- The local player's hand is a stable anchor adjacent to the workbench.
- Entering a tool must preserve the reasoning context needed to return to the same decision.

The product goal is expert playability and low context-switch cost, not decorative minimalism.

## 2. Frozen technical/semantic boundary

C17 does not rewrite Hanabi.

- Server/upstream state is authoritative.
- Do not implement a second Hanabi rules engine in UI code.
- Use pinned upstream reducers/selectors/rules for clue touch, card knowledge, notes semantics, variants, DDA, replay/hypothetical behavior, and related game semantics.
- Gameplay sends are never queued/retried across reconnect.
- A selected/previewed action is not committed state.
- Normal card faces remain based on the pinned upstream renderer/presentation source; mobile owns layout, overlays, and interaction.
- Notes/actions are keyed by authoritative card identity/order, never by a slot that can be occupied by a later draw.
- Latest clue, permanent knowledge, personal notes, candidate preview, and last action are separate concepts and must remain visually/semantically separate.

Upstream semantic baseline: `e78e82bce2ff5d54b9d2ec359530955fd354e9b7`.  
Card-presentation pin: `7a9c601b66f5966f7e33564855e25f82e68a94ed`.

## 3. Protected reasoning context

A successful interaction preserves what the player was thinking about.

Examples:

- Start comparing clue candidates -> inspect a note -> inspect discard -> return to the same clue target/candidate.
- Open a note for a card -> rotate -> keep the same draft/card identity.
- Inspect empathy -> rotate/background/foreground -> keep the perspective if still valid.
- Inspect an older live event -> return to Live in one action without arming an old gameplay action.

A workbench content swap is not a destructive context switch if the referent/return task is preserved.

## 4. Stable spatial invariants

1. Local player is the stable seating anchor.
2. Opponents follow deterministic server seating order relative to that anchor.
3. Current turn never changes row order.
4. Slot numbers are temporal display positions; card order/identity is the durable key.
5. Own hand does not move during ordinary selection, clue planning, note reading, or knowledge inspection.
6. Current actor/resources and last-action anchors retain stable positions.
7. Clue targeting does not resize or move the target hand.
8. Common tools change only the Workbench, not the overall table geometry.
9. Receiving an unrelated action does not steal focus or close an inspection surface.
10. A card leaving a hand ends live editing/action eligibility for that card; its draft never migrates to the replacement slot occupant.
11. Geometry is selected by window/text-scale class and is not continuously recomputed as hands shrink late-game.
12. Perspective changes must never reveal information not allowed by upstream visibility rules.

## 5. Phone density and responsive strategy

### Full Ledger

The target is to represent every hand simultaneously when the measured safe window and text scale allow it.

The Astra v1.0 feasibility model used a 360 x 640 dp usable portrait rectangle and roughly:

- 48 dp actor/resources
- 48 dp stacks/discard
- 48 dp last action
- five opponent rows at ~52 dp each
- 76 dp own-hand band
- 156 dp Workbench

These numbers are **not frozen usability truth**. They are a starting hypothesis only.

### VALIDATE FIRST: dense readability

Before building the rest of C17 around exact dimensions, validate a production-path dense 6P prototype on a physical Android device using real upstream card faces and worst-case supported hand sizes.

The question is not “does it mathematically fit?” but “can an experienced player rapidly read and compare all hands for a serious game?”

If Full Ledger is not legible at a window/text-scale class, use **Compact Overview**:

- all opponents remain spatially represented in stable order;
- compact tiles/summaries replace unreadably tiny card faces;
- the Workbench supplies a focused full-size hand/card view;
- up to two hands/cards can be pinned for comparison;
- comparing two hands must remain bounded and must not fall back to the old long feed.

Never solve density by clipping, unreadable shrink-to-fit, or per-hand sideways scrolling.

### Landscape / tablet

- Landscape uses two purposeful columns: decision/own-hand/workbench and table/opponents.
- Side system navigation/cutouts are part of the safe-area calculation.
- Tablet uses a stable table pane plus persistent Workbench side pane when it fits.
- Breakpoints are fit tests based on usable width/height, font scale, hand capacity, suit/control count, and IME state; do not use only a hard-coded tablet flag.

## 6. Information hierarchy in live play

Always visible when meaningful:

- human-readable turn and current actor, with a stronger `YOUR TURN` state;
- current score and achievable maximum;
- clue count (normally shown as the current number, e.g. `Clues 3`; do not waste permanent space on `/8` when capacity is the standard known value);
- strikes;
- deck count;
- pace;
- **FRE (Future Required Efficiency)** as a normal glanceable live metric when upstream supplies a meaningful value;
- stack state by suit;
- compact informative discard summary;
- last-action anchor;
- all hands/self anchor;
- active mode/target.

Detailed statistics are one deliberate action away in the Workbench. This includes MRE and metric explanations. Do not invent or collapse upstream efficiency concepts into a different mobile-only number.

Special resource states become explicit when relevant:

- zero clues;
- discard restriction at clue capacity;
- DDA or other upstream-derived warning;
- deck exhaustion/final round;
- timed-game clock when applicable.

Ordinary elapsed duration does not consume permanent live space.

## 7. Direct card actions

C17 MVP control mode:

1. Tap an own card to select it.
2. Show explicit `Play` and `Discard` actions in the Workbench.
3. A separate deliberate tap sends the chosen action after current eligibility is checked.

Selecting a card never sends an action.

An illegal action remains visible but unavailable with a useful reason instead of silently doing nothing.

### Later optional control mode

Drag-to-play / drag-to-discard may be evaluated **after the C17 MVP interaction passes acceptance** as an optional input preference. It must not replace the safe button mode or introduce ambiguous gesture conflicts. It is not a blocker for C17 MVP.

## 8. Functional animation policy

C17 should not be visually static. Short functional animations are part of temporal awareness, but they never own game truth or block input.

Examples:

- play/discard departure or destination emphasis;
- clue-touch preview/commit emphasis;
- current-actor transition;
- resource delta pulse;
- last-action update.

Guideline: roughly 120-180 ms for small state-change emphasis after the authoritative update is locally applied. The next inspection must not wait for the animation to finish. Reduced-motion mode gets immediate replacement plus the same persistent textual/state feedback.

Decorative particle systems, bespoke cinematic effects, skins, and animation work unrelated to acceptance remain later work.

## 9. Last action and temporal awareness

Current turn and last action are separate anchors.

Every meaningful action should expose enough authoritative information to reconstruct what happened:

- actor;
- action type;
- revealed card identity where allowed;
- pre-action slot/card mapping;
- clue target/touched cards;
- resource/table deltas;
- associated temporal position.

Example style: `T18 Cal discarded Red 3 from slot 4. Clues +1; deck -1.`

One tap from the concise last-action bar opens before/after reconstruction. This must identify the exact old slot/card even when multiple visible cards looked identical.

Keep recent events for at least one seating rotation. Do not append a giant full log beneath all hands.

## 10. Live in-game history — A29 MUST

Live rewind/history is a release-gated C17 capability, not merely replay prose.

**A29 — Live in-game history inspection**

The user can:

- enter history from an active game;
- select a prior authoritative turn/action;
- see an explicit state such as `Reviewing T12` distinct from `Live T18`;
- inspect relevant hands, knowledge, notes/discard/history for that prior position;
- never send Play/Discard/Clue while reviewing history;
- return to the current state with one `Live` action;
- see new-live-action count/urgency without being forcibly kicked out of inspection;
- return with no stale old card/clue action armed.

The authoritative live game is never mutated by inspection.

## 11. Notes and personal hypotheses

### Read first, edit explicitly

Tap a card to read its saved note and clue facts without opening the keyboard. Editing is a separate action.

Edit mode keeps an explicit draft. Save/Done submits; ordinary Back hides the IME first and preserves the draft. Do not autosave because focus changed.

### Semantic-preserving quick annotations

Quick controls should cover supported upstream concepts such as F, CM, PTD, KT, Needs Fix, `?`, `!`, identity/possibility, and turn insertion, with advanced controls for less-common tokens.

Do not blindly append ` | token` for every quick action. The upstream parser treats the final pipe segment as the active interpretation, so text-preserving pipe append can silently deactivate prior meaning.

Example intent: `r2` + F must become a semantic equivalent of `[r2] [f]`, not `r2 | f`.

Use the upstream parser/semantics to transform notes safely. Preserve unrelated prose/effects. Unknown syntax should fall back to explicit text editing, not guessed grammar.

### Identity lifecycle

- Notes/drafts follow card identity/order.
- Previous/Next and Save-and-next follow current live identities, not stale slots.
- If the card leaves, editing ends and an unsaved draft can be recovered/copied but cannot be saved onto the replacement card.
- Personal assumptions are visibly separate from authoritative clue facts.

Live note hypotheses are not the same feature as shared-replay Hypotheticals.

## 12. Empathy / knowledge

C17 supports both:

### Per-hand persistent empathy

A visible Knowledge action toggles clue-knowledge perspective for one selected player/hand. Geometry and seating stay unchanged. The Workbench can inspect one or two selected cards deeply. Hold is not required.

### Global empathy

C17 also includes an explicit **global empathy toggle** analogous to the web client's whole-table knowledge view.

- It is optional, explicit, and visibly labeled.
- It applies the same upstream empathy/knowledge presentation to all applicable hands without changing seat geometry.
- One action exits back to ordinary open identities.
- Rotation/background preserves the selected empathy mode if still valid.
- Notes remain a separate personal layer and are not merged into another player's knowledge.

Global empathy is therefore removed from the C17 STOP list.

## 13. Card-state visual language

Keep separate visual channels for:

- identity face;
- permanent clue knowledge;
- authoritative latest-clue marker;
- candidate clue preview;
- selected/action target;
- personal note summary;
- critical/DDA/semantic caution;
- semantic trash/uselessness versus personal KT;
- empathy perspective at the row/mode level.

Do not create badge soup. Important identity and suit information must remain readable in light/dark themes and must not rely only on color; Black/Rainbow require symbol/abbreviation/contrast support.

### Trash/useless-card treatment — VALIDATE FIRST

Do **not** freeze Astra v1.0's rejection of transparency.

The frozen requirement is outcome-based:

- an engine-proven trash/useless card must be immediately scannable at normal table-reading distance;
- its rank/suit identity must remain readable;
- it must not be confused with KT, critical, selected, or disabled state.

First visual candidate: the familiar semi-transparent/subdued treatment. Compare it on-device with other low-emphasis treatments only if readability suffers.

## 14. Clue planning

Clues are a comparison workspace, not a cancel/restart wizard.

- Enter by player header or Clue -> player.
- Available color/rank controls remain visible after choosing a candidate.
- Preview marks the affected cards in place and lists ascending displayed slots.
- Permanent knowledge is unchanged during preview.
- Changing clue candidate is one tap.
- Retargeting is one tap; preserve the current clue when valid and recalculate touches.
- Notes, discard, recent events, and knowledge can be inspected without losing the plan.
- Empty Clues behavior is metadata/upstream-driven.
- Explicit commit is required, e.g. `Give Red to Cal — slots 1, 3`.
- Candidate selection, rotation, becoming the current actor, or returning from an inspection never sends the clue.
- State change invalidates/revalidates the preview and removes stale arming.

Latest-clue lifecycle, retouch semantics, and actual giver/Quacker semantics remain authoritative.

## 15. Rotation / background / foreground

C17 intentionally replaces the old C16 blanket transient-reset UX policy.

Preserve recoverable reasoning context across rotation and app background/foreground when still valid:

- selected card identity;
- note draft/cursor;
- clue target/type/value;
- comparison pins;
- empathy target/mode;
- replay position/follow state.

Clear unsafe physical interaction state:

- pointer-down/gesture in progress;
- action arming;
- stale commit readiness.

On return, revalidate against current authoritative state. Never resend or queue a gameplay command.

## 16. Replay / finished game

Finished game, History, live history entry, and shared review converge on a temporal Replay Workspace.

Keep together:

- exact selected temporal position;
- compact authoritative result/reason;
- table/resources at that position;
- stable ordered hands;
- selected local event;
- Before/After;
- timeline;
- perspective/empathy;
- shared leader/follow/local state where applicable.

Do not show a giant generic `GAME OVER` hero that must be scrolled past.

Timeline is continuously draggable but snaps to available authoritative positions. Provide Start, Last turn, Final state, Previous/Next, and precise step/jump behavior.

Saved notes are not assumed to be turn-versioned. When historical note timing cannot be proven, label them as saved notes that may include later information rather than claiming “what player knew at T8”.

Shared replay:

- local inspection must not silently broadcast;
- manual timeline movement can detach from leader;
- Follow leader restores sync;
- leader transfer uses authoritative capability and pending/result state;
- active Hypothetical mode is clearly labeled and never presented as recorded history.

Quick rematch and Remake are required where existing authoritative eligibility supports them.

## 17. Pregame and product shell

Required C17 workflow:

`Home/Lobby -> inspect/create table -> choose role -> review setup -> start/spectate -> live/review -> return/remake`

Pregame must expose:

- actual role;
- meaningful seating order;
- owner;
- spectators;
- selected variant/options;
- Join as player / Switch to spectator when eligible;
- owner Start eligibility;
- table Settings immediately;
- bounded chat with Enter/Send behavior above the IME.

Create Table opens a creation flow; do not create a server table until the final explicit Create.

Lobby navigation and leaving/releasing attendance are different intents.

### Propose Variant — capability check required

Do **not** freeze the Astra plain-chat proposal fallback as the final C17 behavior.

Before implementing this part of C17-6, inspect the actual web/upstream/server proposal capability. If a structured authoritative proposal operation exists, use it. Only if no such capability exists may a bounded chat suggestion be considered as fallback. Do not invent a synthetic protocol/vote.

## 18. App navigation and People

No permanent bottom app-navigation bar inside live play or replay; that space belongs to the Workbench/timeline.

Table/Home/secondary controls must still be clearly reachable. Administration such as participants/spectators, settings, leave, pause/VTK where applicable must be discoverable without living only inside chat.

C17 includes a minimal functional People layer when supported by existing server capabilities:

- online/user search;
- compact profile;
- friend state/list and find-online-friends affordance.

Rich profiles, feeds, recommendations, achievements, and messaging redesign remain later scope.

## 19. Android / IME / touch contract

- One composition owner calculates system bars, cutouts, gesture/navigation insets, and IME occlusion; overlapping exclusions are treated as a union, not blindly added twice.
- Primary controls have non-overlapping ~48 x 48 dp hit regions.
- Normal important text targets ~14-16 sp; compact secondary text can be ~12 sp; tiny slot text is never the sole identifier.
- Android Back closes IME first, then inspection, then transient task, then navigates.
- Typing may reduce non-target table context on a small phone, but must preserve actor/action context, target card/hand, draft, safe Save/Back, and one-action restoration.
- Dark mode and suit identity must work without color-only meaning.
- Physical acceptance covers gesture and three-button navigation, both landscape directions, keyboard states, suggestions, normal/enlarged font, themes, and rotation during active tasks.

## 20. Acceptance additions/changes from v1.0

The Astra v1.0 acceptance matrix remains the base, with these ratified changes:

- **A14 Empathy**: must validate persistent per-hand empathy and explicit global empathy; neither requires hold.
- **A24 resources**: normal live clue display may show current clue count without permanently displaying `/8`; capacity/restriction is shown when strategically relevant. Legality remains upstream-owned.
- **A25 lifecycle**: reasoning state survives rotation/background/foreground while gesture/arming is cleared.
- **A29 Live in-game history**: defined in section 10 and is a MUST release case.
- **Dense 5P/6P geometry**: exact 52/76/156 dp allocations are not pass criteria by themselves; real-device readability and task success decide Full Ledger versus Compact Overview.
- **Live stats**: FRE is glanceable by default when meaningful; MRE/details remain one action away.
- **Animations**: functional action feedback exists but no essential meaning depends on animation.

## 21. Validation gates

Before broad C17 implementation, validate the dense workspace prototype on a physical Android device.

Before C17 release:

- deterministic fixtures cover seating anchors, hand capacity, last-clue lifecycle, note semantic composition, and invalidation;
- one serious full 5P and one serious full 6P session are completed on target phone composition;
- dense notes, three-candidate clue comparison, discard consultation, and look-away reconstruction are exercised;
- no root gameplay scrolling in certified Full Ledger states;
- no unintended gameplay commits;
- no note migration;
- no required-control occlusion by system UI/IME;
- no lost reasoning draft across documented transitions;
- replay gets a separate analysis/review session;
- timing targets are diagnostic engineering targets, not sacred release numbers when user task quality is otherwise clear.

A look-away probe may use the Astra target of >=90% correct actor/action/original-slot/key-delta within five seconds as a diagnostic. Small samples are not treated as statistical proof; every wrong slot/target answer is investigated.

## 22. Migration slices

### C17-0 Density prototype / layout validation

Production-path prototype using real card faces and dense 6P fixtures. Decide Full Ledger fit classes versus Compact Overview. No broad feature rewrite yet.

### C17-1 Workspace and direct actions

Stable table/hand composition, deterministic seating, safe areas, direct tap -> Play/Discard, spectator-safe action surface. Remove root live ScrollView / oversized independent hand panels / actor reorder / duplicate action regions.

### C17-2 Temporal awareness and table inspection

Current actor, useful resources/stats including FRE, discard/stacks, last action, before/after reconstruction, recent events, A29 live history.

### C17-3 Knowledge, empathy, and notes

Read-first notes, semantic-preserving quick annotations, keyboard-safe editing, per-hand and global empathy, identity-keyed draft lifecycle.

### C17-4 Clue decision workspace

Persistent palette, candidate comparison, retargeting, note/pile consultation, explicit authoritative commit.

### C17-5 Result, replay, and history

Temporal Replay Workspace, real result semantics, timeline, before/after, shared follow/leader/hypothetical viewing, rematch/remake.

### C17-6 Table lifecycle and shell

Create/join/spectate/roles/options/start/chat/navigation, capability-verified Propose Variant, Settings, minimal People/profile/friends surface.

### C17-7 Integration and freeze

Complete serious games and replay sessions without workaround navigation. Remove obsolete presentation paths and temporary migration switches after parity.

## 23. STOP LIST

Until C17 acceptance is complete, do not:

- rewrite Hanabi semantics, reconnect protocol, or upstream parity under UX work;
- silently advance upstream pins;
- redesign normal card artwork;
- enable unsupported variant families as accidental scope expansion;
- reintroduce root live/replay documents or per-hand horizontal carousels;
- reorder players by current actor;
- build giant expanded knowledge under every card;
- add drag/swipe as a required C17 MVP control path;
- make hold-only empathy;
- queue/pre-play/auto-commit gameplay actions;
- build a mobile strategy solver or second hypothetical engine;
- expand into rich social feeds/profile systems;
- spend the acceptance budget on decorative animation/skins/sound design;
- invent a new efficiency metric;
- leave old and new presentation architectures alive indefinitely;
- reopen a passed slice for subjective polish without a failed acceptance case or newly evidenced defect.

Explicit exceptions ratified in v1.1:

- global empathy **is** in C17;
- short functional animations **are** in C17;
- minimal People/profile/friends parity **is** in C17 where existing capabilities support it;
- drag input may be evaluated later as an optional mode after MVP acceptance.

## 24. Change control

After this freeze, a C17 product/UX change requires one of:

1. a failed acceptance case;
2. newly evidenced semantic/platform defect;
3. explicit versioned product decision.

Record the affected states and revised observable criterion. Aesthetic preference alone does not reopen completed slices.

## 25. Human gate

The final release question is simple:

> Would an experienced player genuinely want to play a full serious Hanabi game on this phone UI?

If not, fix the failed contract/validation point. Do not hide the failure behind mathematical fit, screenshot polish, or eventual reachability through scrolling.
