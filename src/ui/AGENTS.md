# UI instructions

Scope: `src/ui/**`. Root instructions apply; `src/ui/game/AGENTS.md` adds the more specific gameplay UI rules under that subtree.

Use `docs/MOBILE_APP_DESIGN_V2.md` as the main UI authority for navigation, ownership, and responsive composition. Consult the other root-listed authorities only as needed.

## Navigation / ownership

- App-level browsing and room presentation ownership stays App-owned or in the existing pure presentation/navigation helpers.
- Cross-screen browsing surfaces use the established browsing presentation state, not unrelated screen-local booleans.
- Keep screen-local transient search/filter/editor visibility local when it does not define app navigation.
- Authoritative room attendance is separate from presentation focus.
- Browsing navigation must never implicitly leave, unattend, or stop watching a room.
- Room-owned children such as Chat/Menu/Profile/Settings remain room-owned; do not silently turn them into global browsing destinations.
- Reusable surfaces preserve their origin and Back ownership.
- Do not introduce React Navigation or another navigation dependency without an explicit architectural decision.

## Responsive UI

- Phone portrait and short-wide landscape are first-class layouts.
- Do not infer phone landscape from generic large width alone; use the established window classification.
- Ordinary browsing UI work must not introduce a new C17/game landscape topology.
- Large-screen enhancements must not make two-pane layouts mandatory on short-wide phones.

## State / commands

- Presentation helpers may classify or derive UI state, but must not create a parallel authoritative state model.
- UI commands continue through existing runtimes/actions; no raw WebSocket access.
- Do not invent command queue, retry, or replay behavior.

## Structural tests

UI has source-contract tests. Before moving/extracting source-level UI structure, search nearby tests for the touched filename and `readFileSync`, following the root source-contract rules.

Use `npm run test:affected` during these changes; it does not replace canonical final validation.
