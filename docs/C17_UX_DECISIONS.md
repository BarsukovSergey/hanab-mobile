# C17 UX Decisions

Date: 2026-09-11
Status: **ratified**

This file records explicit product decisions made while reviewing C17 discrepancies. The authoritative current contract is `docs/C17_UX_CONTRACT.md` v1.2. Earlier entries in this file that conflict with the list below are superseded.

## D01 — Table Ledger + Decision Workbench

**ACCEPT.** Keep a stable table/hand ledger plus reserved Workbench. Workbench mode changes do not move/resize hands or cards.

## D02 — Dense phone layout / Compact Overview

**ACCEPT WITH FALLBACK.** Full Ledger is preferred when readable. Compact Overview remains a C17 safety fallback for constrained phone/window/text-scale classes. Comparison pins are backlog.

## D03 — Landscape / tablet

**BACKLOG FOR BESPOKE LAYOUT.** C17 must remain safe and usable after rotation and on larger windows, but a dedicated two-column landscape/tablet composition and large-screen polish do not block phone-portrait C17.

## D04 — Direct actions

**ACCEPT.** Tap own card, then explicit Play/Discard. Illegal actions stay visible but disabled; reason text is not required. Drag-to-play/discard is backlog.

## D05 — Notes: edit transaction

**MODIFY TO WEB-LIKE EDITING.**

- single tap reads; double tap edits;
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

**RATIFIED.** Short tap on another player opens Clue only on our turn. Off-turn short tap does nothing. On our turn with zero clue tokens the disabled composer may open, but candidate/Give controls remain disabled. Remove the separate per-player Clue button. Entering Clue turns global empathy off.

## D11 — Empathy

**MODIFY.** Remove persistent per-player empathy.

- long-press/hold anywhere on a player row/hand, including cards, is transient empathy until release;
- own hand supports the same temporary empathy;
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

**C17 MUST.** Live, Rewind, finished game, ordinary replay, shared review, and Hypothetical use the same C17 Table Ledger + Workbench model on target phone portrait. Do not route finished/replay back to LegacyGameScreen. Shared leader/follow/detach semantics and Hypothetical remain authoritative/upstream-owned.

## D15 — Spectator

**C17 MUST.** Live spectator uses the same C17 table/review workspace with authoritative observed-player seating anchor and no Play/Discard/Clue sends.

## D16 — Pregame role switching

**C17 MUST.** Join as player / Switch to spectator must be available from the pregame room when authoritative eligibility permits. Implement with existing upstream/server capabilities only; do not invent a role protocol.

## D17 — Propose Variant

**RESOLVED: EXISTING AUTHORITATIVE FLOW.** Use ordinary `tableUpdate`. The upstream server already turns non-owner changes into a proposal/chat action for the owner. Do not invent a mobile vote protocol or plain-chat substitute.

## D18 — Functional animation

**C17 MUST MINIMAL.** Short non-blocking feedback for play/discard, clue touches, actor/resource/last-action transitions. Richer/prettier/cinematic animation is backlog.

## D19 — More / secondary actions

**RATIFIED.** Reuse the existing `More` surface as the single overflow for secondary live/replay actions. Do not add another Table/ellipsis control. Put eligible chat, participants/spectators, attendance/Leave, Pause/Unpause, settings, VTK/admin, and sign-out actions there as supported by authoritative capabilities.

## D20 — People/profile/friends

**BACKLOG.** Social/People/profile/friends functionality does not block C17.

## D21 — Change control

After v1.2, reopen a product decision only for a failed acceptance case, newly evidenced semantic/platform defect, or an explicit versioned product decision. Implementation details that follow directly from a ratified web-parity rule do not need a new product question.
