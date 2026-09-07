# Hanab Mobile Backlog

Status: **parking lot / non-authoritative**
Date: 2026-09-08

This file is for useful work that should **not interrupt the current implementation slice**.

It is not product authority and does not replace:

- `docs/C17_UX_CONTRACT.md` — authoritative C17 requirements;
- `docs/C17_UX_DECISIONS.md` — ratified product decisions;
- `docs/C17_VALIDATION.md` — acceptance gates;
- `docs/C17_EVIDENCE.md` — physical evidence / defect history;
- `docs/ARCHITECTURE.md` — technical boundaries.

Committed C17-3 through C17-7 work stays in those documents and the active handoff. Do **not** duplicate the roadmap here just to make the backlog look full.

## Rules

1. Before acting on a newly observed issue, classify it as:
   - current slice;
   - later committed C17 slice;
   - upstream/parity defect;
   - generic platform defect;
   - backlog.
2. A backlog item is **not a blocker** unless it is explicitly promoted into the active slice or an acceptance gate.
3. If an item becomes committed product work, move it into the relevant C17 authority/validation document and mark it scheduled or remove it here.
4. Rejected ideas belong in `C17_UX_DECISIONS.md` / preserved handoff history, not here.
5. Semantic questions still require pinned-upstream verification before implementation; backlog status is not permission to invent behavior.

## Perf / polish

### B001 — Rewind scrubber fast-drag performance

- **State:** deferred
- **Observed:** physical Android testing, 2026-09-08
- **Problem:** the rewind thumb can move faster than the historical table presentation catches up during aggressive dragging.
- **Current implementation:** replay navigation is coalesced to at most one update per animation frame and always flushes the final selected position.
- **Why deferred:** authoritative Back / Forward / Recent / Exit navigation works; this is not a C17-2 correctness blocker.
- **Revisit:** C17-5 Replay Workspace or dedicated performance pass.
- **Likely direction:** make historical table rendering cheaper (memoized/stable geometry, less whole-screen React work) rather than reducing visual update frequency further. Compare against the web canvas/Konva path before choosing a mobile renderer optimization.
- **Blocker:** no.

### B002 — 2P portrait dead vertical space

- **State:** deferred
- **Observed:** physical Android screenshot, 2026-09-08
- **Problem:** in 2-player portrait, the opponent region does not consume much vertical space, leaving a large empty band between `YOUR HAND` and the Decision Workbench.
- **Why deferred:** no clipping or gameplay correctness failure; dense 5P/6P geometry remains frozen from prior physical validation.
- **Revisit:** responsive cleanup / C17-7 acceptance matrix.
- **Constraint:** do not reopen passed 5P/6P geometry to fix this. Prefer a player-count/window-class allocation improvement that preserves stable hand/workbench anchors.
- **Blocker:** no.

## Optional / post-MVP

### B003 — Optional drag-to-play / drag-to-discard input mode

- **State:** optional later
- **Source:** `C17_UX_CONTRACT.md`, Direct card actions / Later optional control mode.
- **Idea:** evaluate drag as an optional input preference after the safe tap-card -> explicit Play/Discard MVP interaction has passed acceptance.
- **Constraint:** must not replace safe button mode or introduce ambiguous gesture conflicts.
- **Revisit:** after C17 MVP interaction acceptance, not during current slices.
- **Blocker:** no.

## Investigate later

No standalone investigation items currently parked here.

Capability checks that are already required by a committed C17 slice (for example Propose Variant transport in C17-6) remain in the authoritative C17 plan rather than being duplicated into backlog.

## Promotion template

When adding an item, keep it compact:

```text
### BNNN — Short title
- State: deferred | investigate | optional later
- Source/evidence: where it came from
- Problem/idea: one concrete paragraph
- Revisit: slice or milestone
- Blocker: yes/no
```
