# C17 Product & Gameplay UX Contract

**2026-10-23 bounded supersession:** [Post-RC2 UX polish](./2026-10-23-UX-POLISH.md) supersedes only the listed landscape, notes/gestures, Home/Exit Replay and finish-presentation clauses. Other decisions and all gameplay/network safety remain authoritative. This is a target contract, not physical acceptance.

Version: **1.2 — ratified product baseline**
Date: 2026-09-11
Scope: Android-first Hanab Mobile C17 product/gameplay UX

This is the authoritative C17 product/UI contract. It supersedes conflicting presentation and gesture decisions in earlier C17/C16/Astra documents. C16 networking, protocol, reconnect, authoritative-state, and upstream-semantic guarantees remain in force.

## 1. Product model

The game is a continuously available decision workspace, not a document of panels.

- **Table Ledger**: stable seating, all hands, current actor, resources, stacks/discard summary, last action.
- **Decision Workbench**: card actions, clue planning, note read/edit, empathy/knowledge, discard inspection, history/replay context.
- Ordinary certified phone portrait play has no root gameplay scroll and no per-hand horizontal scrollers.
- Current actor highlighting never reorders players.
- The local/observed hand is a stable anchor next to the Workbench.
- A Workbench tool change must not move or resize Ledger hands/cards.

The release goal is expert playability and low context-switch cost, not decorative minimalism.

## 2. Technical and semantic boundary

C17 does not rewrite Hanabi.

- Server/upstream state is authoritative.
- Do not implement a second Hanabi rules engine in UI code.
- Use pinned upstream reducers/selectors/rules for clue touch, card knowledge, note parsing, variants/options, DDA, replay/hypothetical behavior, results, and card identity.
- Gameplay sends are never queued, persisted, retried, or replayed across reconnect.
- A selected/previewed action is not committed state.
- Mobile does not optimistically mutate committed game state.
- Notes/actions are keyed by authoritative card `order`, never by the displayed slot.
- History/replay/hypothetical inspection must never mutate authoritative live gameplay.
- Latest clue, permanent knowledge, personal notes, candidate preview, and last action remain separate concepts.

## 3. Stable spatial invariants

1. Local/observed player is the stable seating anchor.
2. Other players follow deterministic server seating order relative to that anchor.
3. Current turn never changes row order.
4. Slot numbers are temporal positions; card `order` is the durable key.
5. Own/observed hand does not move during ordinary selection, clue planning, note reading/editing, empathy, or history inspection.
6. Actor/resources and last-action anchors retain stable positions.
7. Clue targeting does not resize or move a target hand.
8. Common tools change the Workbench, not Ledger geometry.
9. An unrelated incoming live action does not steal focus from a safe inspection surface.
10. A card leaving a hand never retargets a note draft or action to the replacement slot occupant.
11. Perspective changes never reveal information disallowed by upstream visibility rules.

## 4. Phone density and responsive strategy

### Beta.1 certified density

The first distributed Android beta is accepted around **2P/3P phone gameplay**. In those layouts:

- use real card faces for every visible hand;
- cards and gameplay state have priority over decorative chrome and spacing;
- preserve the stable local/observed anchor and Workbench relationship;
- do not introduce per-hand horizontal scrolling or unreadably tiny cards.

### 4P–6P post-beta work

4P–6P dense gameplay is outside the `1.0.0-beta.1` acceptance gate.

The current Compact Overview / summary-icon implementation is a temporary fallback in the codebase, **not an accepted final product direction**. When 4P–6P work resumes, keep real card faces and recover space by reducing secondary chrome, gaps, and card size within readability bounds. Do not replace normal hands with tiny summary icons merely to make the layout fit.

Historical 5P/6P density evidence remains useful engineering evidence, but it does not certify the current 4P–6P UX for beta.1.

### Landscape / tablet

Phone landscape is first-class under Mobile App Design v2 and the 2026-10-23 delta: left-only header/hand grid and a safe-top right control column, subject to measured fit. Large-screen polish remains separate.

## 5. Information hierarchy

Always visible when meaningful:

- human-readable turn/current actor with strong `YOUR TURN` state;
- score and achievable maximum;
- clue count;
- strikes;
- deck count;
- pace;
- FRE when upstream supplies a meaningful value;
- stack/firework state;
- compact discard summary;
- last-action anchor;
- all hands/self-or-observed anchor;
- active Workbench mode/target.

Landscape keeps the full existing FRE | MRE value in the Efficiency metric row; additional metric details remain one deliberate action away. Do not invent a mobile-only efficiency metric.

## 6. Direct card actions

C17 primary control mode:

1. Tap an own card to select it.
2. Show explicit `Play` and `Discard` actions in the Workbench.
3. A separate deliberate tap sends the chosen action after current authoritative eligibility is checked.

Selecting a card never sends an action. Illegal Play/Discard remain visible but disabled; explanatory reason text is not required. Drag-to-play/discard is optional backlog, not a C17 blocker.

## 7. Functional animation

Short, non-blocking motion is C17 scope for temporal awareness after authoritative updates are locally applied:

- play/discard departure/destination emphasis;
- clue-touch/commit emphasis;
- current-actor transition;
- resource delta pulse;
- last-action update.

Animation never owns game meaning and never blocks input. Reduced-motion keeps equivalent persistent state feedback. Richer/prettier/cinematic animation is backlog.

## 8. Last action and Recent

Current turn and last action are separate anchors. Last-action summaries should expose enough authoritative information to understand actor/action and relevant card/resource changes.

There is **no separate Before/After inspector** in C17.

- Tapping the Last Action enters/jumps Rewind at that authoritative action.
- Back/Forward in Rewind provide the adjacent temporal states.
- Recent remains a compact list for direct jumps to nearby authoritative actions.
- Keep at least one seating rotation of recent actions where data permits.

## 9. Live History / Rewind — MUST

Live history is release-gated C17 functionality.

- Enter history from an active game.
- Select a prior authoritative action.
- `REWIND Tn` is visually distinct from `LIVE Tm`.
- No Play/Discard/Clue send route is available while reviewing.
- Table/resources/hands all come from the same selected historical state.
- Notes, discard, empathy/knowledge, and recent history remain inspectable.
- Back moves one authoritative action backward.
- Forward moves one authoritative action forward.
- Long-press Back jumps to the first available action.
- Long-press Forward jumps to the latest available rewind action.
- The touch scrubber snaps to authoritative actions.
- `Live` returns to the current authoritative state in one action.
- New live actions while rewinding do **not** auto-jump or force an exit; show/update `N NEW`.
- Entering/scrubbing/leaving review disarms stale card/clue action arming.

The authoritative live game is never mutated by inspection.

## 10. Notes and personal hypotheses

### Read/edit gestures

- No double-tap mode. Own-card tap selects for separate Play/Discard; own-card hold opens note editing/inspection.
- Opponent-card tap opens Edit immediately where eligible, otherwise read-only inspection; opponent hold remains transient empathy.
- Landscape Edit replaces the right column and does not force the software keyboard open; portrait retains its keyboard behavior. Preserve stable draft/order and safe Save/Cancel under IME.

### Edit transaction

- Edit mode owns an explicit local draft.
- Entering Edit on a non-empty note prepares `saved note | `, matching web interpretation-entry behavior; this is not saved until Save.
- `Save` commits and exits.
- Keyboard submit/Done may act as Save.
- Android Back while editing cancels the unsaved draft and exits the editor; there is no intermediate hidden-keyboard editing state.
- `Clear` clears the draft only. Saving the empty draft deletes the note.
- There is no separate `Done editing` action.
- Rotation/background preserves the open Note Editor and unsaved draft. Exact cursor/selection restoration is not a C17 MUST.

### Quick note actions

Inside Edit, quick actions may update only the draft. C17 includes:

- F, CM, PTD, KT, Needs Fix, `?`, `!`;
- current-turn insertion using upstream semantics;
- Repeat previous note, replacing the current draft with the previous entered note.

Ordinary web note strings, including identity/possibility syntax and reserved `clued`/`unclued`/`blank` forms, must parse and save with upstream-compatible semantics. Dedicated identity picker, dedicated Clued/Unclued/Blank buttons, instant read-mode quick tags, and Previous/Next/Save-and-next are backlog.

### Identity lifecycle

- Draft/save follows card `order`.
- If a card leaves its hand while Edit is open, editing continues for that same `order` and may still be saved to that card.
- Never migrate the draft to the replacement card in the old slot.
- During live in-game History/Rewind, the current saved personal note remains editable for a historically visible card by `order`, including cards no longer in current live hands.
- No extra temporal-warning label is shown merely because the note is current while the table is rewound.
- Dedicated/finished replay notes remain read-only where upstream does not permit editing.

### Note validation

Mirror the web semantic impossibility warning for parsed identity possibilities. The warning is advisory: Save remains allowed. C17 has no invented revision/merge/conflict protocol.

## 11. Empathy / knowledge

C17 has two modes:

### Transient per-hand empathy

- Long-press/hold on another player row/hand, including cards, shows that hand in empathy until release.
- Own-card hold opens notes instead; global empathy remains available.
- A recognized long press consumes the gesture: release must not also fire the short-tap Clue/card action.
- Temporary empathy clears on release and on background/rotation/interruption.
- It works while live, while Rewinding, and while ClueComposer remains visible.
- In History/Rewind it applies to the selected historical state and is strictly read-only.

There is **no persistent per-player empathy mode**.

### Global empathy

- One explicit `All empathy` toggle applies the upstream empathy presentation to all applicable hands.
- The same control toggles it off; there is no separate `Normal` button.
- Global empathy persists across ordinary rotation/background.
- If global empathy is on, per-hand long hold is a no-op; there is no isolate-hand third mode.
- Entering Clue mode automatically turns global empathy off.
- Global empathy is available in History/Rewind.

Deep Knowledge, two-card compare, and pinning are backlog.

## 12. Card-state visual language

Keep distinct channels for identity, permanent clue knowledge, authoritative latest-clue marker, candidate clue preview, selected/action target, personal note, critical/DDA/semantic caution, trash/uselessness versus personal KT, and empathy.

### Trash/useless presentation — web parity

C17 must follow the pinned web logic rather than a blanket `engine trash -> opacity` rule.

- Explicit known-trash note with zero positive clues can force fade as web does.
- Otherwise engine-trash fade follows the same web exclusions for clued/played/discarded cards, Blank/CM note state, Throw It in a Hole, and speedrun mode.
- Known-trash-from-empathy remains the corresponding mini-trash indicator behavior rather than being conflated with the normal trashcan/fade.
- DDA/trash indicators retain the same semantic exclusions as web.

## 13. Clue planning

Clue planning is one visible composer, not a hidden parked draft.

### Entry

- Explicit accessible `Clue` beside an eligible opponent name opens/retargets ClueComposer only on our turn when live interaction is otherwise available. Card/row taps do not infer clue entry.
- Off-turn/read-only states do not expose active clue commitment.
- On our turn with zero clue tokens, the composer may open, but candidate controls/Give are disabled.
- Entering Clue turns global empathy off.
- Keep the visible per-player `Clue` affordance; its hit target must fit without reflowing hands.

### Candidate / retarget

- Color/rank palettes use two rows; worst supported variants determine a stable landscape Workbench reserve. Only the bounded palette may scroll/wrap; Close/Give always remain reachable.
- Selecting a candidate previews authoritative touched cards directly in the target hand.
- No textual slot list is required.
- Changing candidate is one tap.
- Retargeting to another player preserves the current candidate and recomputes touched cards/legality authoritatively.
- Candidate remains selected even if no longer legal; `Give clue` becomes disabled.
- Invalid/empty candidates do not require explanatory configuration text; disabled Give is sufficient.

### Lifetime

The clue plan exists exactly while ClueComposer remains the current visible Workbench tool.

- An overlay that does not replace the composer, such as discard inspection, may preserve it.
- Replacing the composer with Notes, History/Rewind, or another Workbench mode clears target/candidate/preview.
- Rotation/background alone does not clear it if the composer remains the current task.
- No hidden clue-plan restoration exists.

Only explicit `Give clue` sends. State changes are revalidated against authoritative state; C17 does not invent a stale-review modal or a mobile clue rules engine.

Off-turn planning, zero-token rehearsal, and multi-candidate pins/Compare are backlog.

## 14. Lifecycle safety

Across rotation/background/foreground:

- preserve recoverable note draft/editor state;
- preserve global empathy;
- preserve current replay position/follow state where valid;
- preserve a clue plan only when ClueComposer remains the current visible task;
- clear pointer-down/long-hold state and transient per-hand empathy;
- clear unsafe action arming/stale commit readiness;
- never queue, resend, or retry gameplay commands.

## 15. Replay, finished game, shared review, Hypothetical

Live, live Rewind, finished game, ordinary replay, shared review, and Hypothetical use the same C17 Table Ledger + Workbench spatial model on the target phone-portrait path. Do not fall back to a separate LegacyGameScreen merely because the game finished or replay became active.

Replay/finished requirements:

- one restrained `Game finished` score/reason popup only on an observed active-game -> authoritative-finished transition; no popup on historical/bootstrap/reconnect loads and no separate result page or redundant persistent result banners;
- same stable ordered hands/table/resources;
- one authoritative-action timeline with scrubber + Back/Forward + long-press edge jumps;
- empathy/knowledge at the selected temporal point;
- no separate Before/After axis;
- Quick rematch / Remake where authoritative eligibility permits.

Direct `Exit Replay` ends ordinary/finished/shared review without confirmation through safe authoritative attendance handling; it is distinct from ongoing own Rewind `Live`. `Home` always opens browsing Home without changing attendance. Failed departure must not falsely claim exit.

Shared review is C17 MUST:

- local manual timeline movement may detach a follower without silently broadcasting;
- `Follow leader` restores shared synchronization;
- leader control/transfer uses existing authoritative capability only;
- shared state is visibly identified.

Hypothetical is C17 MUST:

- active Hypothetical is clearly labeled and never presented as recorded history;
- use upstream/server hypothetical semantics; do not build a second mobile hypothetical rules engine.

## 16. Spectator

Live spectator is a first-class C17 workspace, not a Legacy fallback.

- Same Table Ledger/Workbench composition.
- No Play/Discard/Clue send route.
- Notes, empathy/knowledge, history/replay and shared-review tools follow authoritative spectator capabilities.
- The observed player index from authoritative metadata is the seating anchor.

## 17. Pregame and table lifecycle

Required workflow:

`Lobby -> create/inspect table -> choose/switch role -> review setup -> start/spectate -> C17 live/review -> result/replay -> remake/return`

Pregame must expose role, seating, owner, spectators, selected variant/options, owner Start eligibility, table settings, and bounded chat.

- Create Table sends only after final explicit Create.
- Join as player / Switch to spectator must be available in-room when authoritative eligibility permits.
- Owner changes use authoritative table update.
- Non-owner option changes use the same ordinary `tableUpdate`; the server/web capability turns them into a proposal and gives the owner the authoritative apply action. Do not invent a mobile voting protocol or fake plain-chat fallback.

## 18. More / secondary actions

Do not add a second permanent Table/overflow control. The existing **More** surface is the single overflow for secondary live/replay actions, such as table chat, participants/spectators, Leave/return-to-lobby attendance action, Pause/Unpause where supported, table/app settings, VTK/administration where an existing authoritative capability exists, and Sign out.

Do not crowd the gameplay surface with one-off admin buttons.

People/profile/friends/social functionality is backlog and does not block C17.

## 19. Android / IME / touch contract

- One composition owner handles system bars, cutouts, navigation insets, and IME occlusion.
- Important controls have safe, non-overlapping touch regions.
- Tiny slot text is never the sole card identifier.
- Keyboard-open composition preserves actor/action context, target card/hand, draft, Save/Back, and one-action restoration.
- Dark mode and suit identity must not rely only on color.
- Physical acceptance covers gesture and three-button navigation, keyboard states, normal/enlarged font scale, themes, and rotation/interruption behavior.

## 20. C17 release gates

Before C17 release:

- deterministic tests cover seating anchors, hand capacity, clue touch/retarget, note parsing/draft identity, trash presentation parity, and stale-action invalidation;
- one serious full 5P and one serious full 6P session are completed on target phone portrait;
- dense notes, multiple clue candidates, discard consultation, empathy, live history, shared review/Hypothetical, spectator, and replay analysis are exercised;
- no root gameplay scrolling in certified Full Ledger states;
- no unintended gameplay commits;
- no note migration;
- no required-control occlusion by system UI/IME;
- no lost note draft across documented lifecycle transitions;
- replay/finished game stay in the C17 workspace;
- the experienced player would willingly play a full serious game using the final composition.

## 21. STOP list

Until C17 acceptance is complete, do not:

- rewrite Hanabi semantics, reconnect behavior, or upstream protocol under UX work;
- silently advance upstream pins;
- redesign normal card artwork;
- enable unsupported variant families accidentally;
- reintroduce root live/replay documents or per-hand horizontal carousels on certified phone portrait;
- reorder players by current actor;
- build giant expanded knowledge under every card;
- make persistent per-player empathy;
- queue/pre-play/auto-commit gameplay actions;
- create a second hypothetical/strategy engine;
- spend the release gate on rich social features, decorative animation, skins, or sound design;
- invent a new efficiency metric;
- keep Legacy and C17 gameplay/replay presentations as permanent parallel architectures.

## 22. Change control

A further C17 product/UX change requires a failed acceptance case, newly evidenced semantic/platform defect, or explicit versioned product decision. Record the affected observable behavior rather than silently changing the contract.
