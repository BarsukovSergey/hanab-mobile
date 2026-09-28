# Gameplay UI instructions

Scope: `src/ui/game/**`.

Read before substantial gameplay UI work:

- `docs/MOBILE_APP_DESIGN_V2.md` for the current shell/responsive contract;
- `docs/C17_UX_CONTRACT.md` for gameplay interaction semantics;
- `docs/C17_UX_DECISIONS.md` for ratified C17 details that are not superseded by v2.

## Invariants

- Keep server/upstream game state authoritative.
- Preserve stable `card.order` identity for notes, selection, replay, and card-bound presentation.
- Live, Rewind, finished replay, shared review, and Hypothetical must not accidentally share send eligibility.
- Selection/preview is never a gameplay send. Play/Discard/Clue require the existing explicit commit path.
- Workbench/tool changes must not unexpectedly retarget or resize Ledger hands/cards.
- Do not solve density by adding per-hand horizontal scrolling or unreadably tiny cards.
- Phone landscape is a first-class short-wide class under v2; do not derive it from a generic width-only `wide` assumption.
- Do not reintroduce Legacy merely to avoid implementing supported C17 live/review layouts.

## Structural tests

Several tests inspect gameplay source text directly. Before moving controls or extracting JSX, search for the touched filename and `readFileSync` in neighboring tests.

If a structural test fails after an intentional extraction, preserve the product contract and update the test to the new stable seam rather than restoring obsolete structure.

## Validation

Run `npm run validate` and `git diff --check`. For layout-policy changes, add or update focused geometry/interaction tests before relying on physical validation.
