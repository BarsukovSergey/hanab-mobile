# C16 Results — UI/UX redesign

Status: **CORRECTIVE PASS / UNVERIFIED**

C16A navigation safety was already closed separately. The remaining C16 work includes the original non-game/game redesign plus a corrective pass after physical Android testing exposed renderer, note, and orientation issues.

## Implemented

- Shared light/dark design tokens with `System`, `Light`, and `Dark` runtime selection.
- Responsive narrow/wide layouts for phone portrait, phone landscape, and tablet widths.
- Redesigned login, lobby, history, pregame, table options, and chat surfaces.
- Redesigned live game, review, postgame, replay, notes, clue controls, presence, clocks, and termination controls.
- Desktop left-to-right hand presentation is applied without mutating authoritative `CardOrder` arrays.
- Fireworks and discards render as cards rather than text labels.
- Card notes have visible indicators; narrow layouts use a note modal, wide layouts use the side panel, and finished replay cards/note entries open a read-only note viewer.
- Card proportions follow pinned hanab.live `CARD_W = 286` / `CARD_H = 406`. The RN face now follows the pinned web composition more closely: white card base, translucent suit fill, rank corner treatment, 1–5 pip placement, multi-fill bands, and orange clued-state border.
- Suit visual metadata comes from the vendored pinned variant data, including multi-fill and colorblind-fill metadata.
- Expo orientation is `default`, system UI style is `automatic`, and `npm run android` now runs an Android Expo prebuild first so app-config orientation changes are propagated to the generated native project.
- Live-game connection loss is surfaced without discarding the authoritative game view; gameplay actions remain gated by session readiness.
- In-app branding is `Hanab`; `Hanab Mobile` remains project/application metadata.
- Destructive immediate termination keeps an explicit confirmation; normal Leave/Unattend/Sign out remain direct actions.

## Known limits / not yet proven

- Theme preference currently resets to `System` after a process restart. No storage dependency was introduced solely for C16.
- Exact pixel/contour parity with the pinned web card renderer is **not claimed**. The web client creates suit pips procedurally with Canvas/Konva; the current RN renderer reproduces the card geometry and semantic layout but still uses glyph-equivalent pip markers instead of the exact upstream procedural paths. A future exact-pip implementation must port or generate those pinned paths deliberately rather than invent new artwork.
- Some upstream visual annotations (for example convention-specific chop/finesse/discard-permission treatments) are not claimed unless the mobile state boundary exposes and tests the corresponding semantic state.
- Android orientation must be physically re-tested after the new prebuild synchronization; the previous physical run stayed portrait-only.
- Final icon/splash asset replacement remains C17 release polish.

## Verification state

The user's pre-corrective run had green Jest tests but found TypeScript errors in newly added C16 files. Those source errors were corrected (`@jest/globals` imports and strict regex capture narrowing), but the full project commands cannot be executed in the current tool environment because the repository cannot be cloned/materialized there and the repository has no CI workflow.

The corrective range was independently reviewed against its pre-pass base and is limited to app presentation/configuration plus a presentation regression test; no protocol, runtime state machine, vendored reducer, or server-authoritative action path was replaced.

Before C16 can be marked CLOSED / GO, run `npm run typecheck`, `npm test`, and `git diff --check`, then physically re-check Android rotation, desktop-equivalent hand order, basic and multi-suit card appearance, fireworks/discards, live/replay notes, and existing gameplay/back semantics.
