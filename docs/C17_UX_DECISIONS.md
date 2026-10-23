# C17 UX Decisions

**2026-10-23 bounded supersession:** [Post-RC2 UX polish](./2026-10-23-UX-POLISH.md) supersedes only the listed landscape, notes/gestures, Home/Exit Replay and finish-presentation clauses. Other decisions and all gameplay/network safety remain authoritative. This is a target contract, not physical acceptance.

Date: 2026-09-11
Status: **ratified**

This file records explicit product decisions made while reviewing C17 discrepancies. The authoritative gameplay contract is `docs/C17_UX_CONTRACT.md` v1.2. Earlier entries in this file that conflict with the list below are superseded.

**2026-09-28 authority note:** `docs/MOBILE_APP_DESIGN_V2.md` is newer and authoritative for app shell, top-level navigation, Browse/Return/Back policy, room-context menus, and responsive/short-wide composition. C17 remains authoritative for gameplay interaction semantics. D03 and D19 below are revised accordingly.

## D01 — Table Ledger + Decision Workbench

**ACCEPT.** Keep a stable table/hand ledger plus reserved Workbench. Workbench mode changes do not move/resize hands or cards.

## D02 — Dense phone layout / 4P–6P scope

**REVISED FOR BETA.1.** The first beta acceptance scope is 2P/3P. Those layouts keep real card faces and prioritize gameplay cards over secondary chrome.

4P–6P dense gameplay is deferred until after the first beta. The current Compact Overview / summary-icon implementation is not accepted as the final 4P–6P UX. When this work resumes, preserve real card faces and reclaim space through card sizing, gaps, and chrome before considering any alternative representation.

Comparison pins remain backlog.

## D03 — Landscape / tablet

**REVISED BY MOBILE APP DESIGN V2.** The old statement that bespoke landscape could remain backlog is superseded for the Phase 2 redesign. Phone landscape is now a first-class short-wide layout class. Preserve C17 gameplay semantics, but choose the Live landscape composition by measured fit/capacity rules from `MOBILE_APP_DESIGN_V2.md` rather than stretching portrait or treating phone landscape as generic `wide`/tablet.

## D04 — Direct actions

**ACCEPT.** Tap own card, then explicit Play/Discard. Illegal actions stay visible but disabled; reason text is not required. Drag-to-play/discard is backlog.

## D05 — Notes: edit transaction

**MODIFY TO WEB-LIKE EDITING.**

- no double tap: own tap selects, own hold opens notes; opponent tap edits immediately where eligible, otherwise inspects read-only;
- landscape editor replaces the right pane without forced keyboard; Save/Cancel and stable draft remain safe under system/IME insets;
- entering Edit on a non-empty note prepares `saved note | `;
- Save commits and exits;
- Android Back cancels the dirty draft and exits;
- Clear clears only the draft; Save empty deletes;
- no separate Done action;
- rotation/background preserves the draft/editor;
- draft follows `card.order` and can still be completed/saved if the card leaves the hand;
- live Rewind notes remain editable by `card.order`, including historically visible cards no longer in a live hand;
- no temporal-warning label and no revision/merge/conflict UI.

## D06 — Notes: quick actions

**C17 MUST:** F, CM, PTD, KT, Needs Fix, `?`, `!`, turn insertion, and Repeat previous note inside Edit. Repeat replaces the draft with the previous entered note. Ordinary upstream identity/possibility and reserved-note syntax must remain text-editable/parseable.

**BACKLOG:** dedicated identity picker, Previous/Next/Save-and-next, instant read-mode tags, and dedicated Clued/Unclued/Blank buttons.

## D07 — Note impossibility warning

**WEB PARITY.** If parsed identity possibilities are impossible for an own-hand card under upstream empathy semantics, warn but still allow Save.

## D08 — Clue retarget / preview

**WEB PARITY.** Retarget preserves the selected clue candidate and recomputes touched cards/legality authoritatively. Preview highlights touched cards in place. Textual slot lists are not required. An invalid/empty candidate remains selected with Give disabled; no explanatory configuration copy is required.

## D09 — Clue plan lifetime

**VISIBLE COMPOSER ONLY.** The clue plan exists exactly while ClueComposer is the current Workbench task. Non-replacing overlays such as discard inspection may preserve it. Switching to Notes/History/another Workbench mode clears it. Rotation/background preserves it only if the composer remains current. No hidden parked plan.

Off-turn planning, zero-token rehearsal, clue Compare, and clue pins are backlog.

## D10 — Clue entry

**REVISED 2026-10-23.** Explicit accessible `Clue` beside eligible opponent names opens/retargets the composer only on our turn with live eligibility. Card/row taps do not infer clue entry. Zero-token candidate/Give controls remain disabled. Entering Clue turns global empathy off; touched previews need legible high-contrast markers/highlighting. Worst-case variant palettes determine the stable Workbench envelope with always-reachable Close/Give.

## D11 — Empathy

**MODIFY.** Remove persistent per-player empathy.

- opponent-row/card hold is transient empathy until release;
- own-card hold is reserved for notes; preserve global empathy;
- recognized long press consumes the short-tap action;
- transient empathy clears on release/background/rotation/interruption;
- global `All empathy` is a separate persistent toggle;
- when global empathy is on, per-hand hold is a no-op;
- no separate `Normal` button;
- empathy remains available in Rewind and while ClueComposer is visible.

Deep Knowledge, compare/pins, and an optional global Toggle/Hold preference are backlog.

## D12 — Trash/useless cards

**WEB PARITY.** Do not use a blanket `engineTrash -> opacity` rule. Mirror the pinned web fade/no-fade conditions and its known-trash/empathy-trash/DDA indicator distinctions.

## D13 — Live history

**MUST.** One-dimensional Rewind model:

- Back/Forward step one authoritative action;
- long-press Back/Forward jump to start/end;
- scrubber snaps to authoritative actions;
- Live exits to current authoritative state;
- new live actions do not force exit; show `N NEW`;
- no separate Before/After axis.

## D14 — Replay / finished / shared review / Hypothetical

**C17 MUST.** Live, Rewind, finished game, ordinary replay, shared review, and Hypothetical use the same C17 Table Ledger + Workbench model on target phone portrait. Do not route finished/replay back to LegacyGameScreen. Shared leader/follow/detach semantics and Hypothetical remain authoritative/upstream-owned. The 2026-10-23 delta requires consistent attendance-preserving Home, direct confirmation-free Exit Replay (distinct from own Rewind Live), and a once-only observed-finish popup instead of redundant persistent result banners.

## D15 — Spectator

**C17 MUST.** Live spectator uses the same C17 table/review workspace with authoritative observed-player seating anchor and no Play/Discard/Clue sends.

## D16 — Pregame role switching

**C17 MUST.** Join as player / Switch to spectator must be available from the pregame room when authoritative eligibility permits. Implement with existing upstream/server capabilities only; do not invent a role protocol.

## D17 — Propose Variant

**RESOLVED: EXISTING AUTHORITATIVE FLOW.** Use ordinary `tableUpdate`. The upstream server already turns non-owner changes into a proposal/chat action for the owner. Do not invent a mobile vote protocol or plain-chat substitute.

## D18 — Functional animation

**C17 MUST MINIMAL.** Short non-blocking feedback for play/discard, clue touches, actor/resource/last-action transitions. Richer/prettier/cinematic animation is backlog.

## D19 — Room-context secondary actions

**REVISED BY MOBILE APP DESIGN V2.** Keep one bounded room-context overflow for secondary Pregame/Live/Review actions, but do not conflate it with the top-level browsing `More` destination. The room surface may be presented/named as `Table menu`, `Game menu`, or `Review menu` according to context. Preserve authoritative eligibility and explicit attendance/destructive actions; browsing navigation must not implicitly Leave/Unattend.

## D20 — People/profile/friends

**BACKLOG.** Social/People/profile/friends functionality does not block C17.

## D21 — Change control

After v1.2, reopen a product decision only for a failed acceptance case, newly evidenced semantic/platform defect, or an explicit versioned product decision. Implementation details that follow directly from a ratified web-parity rule do not need a new product question.
