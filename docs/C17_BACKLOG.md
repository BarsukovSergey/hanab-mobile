# C17 Post-beta Backlog

Date: 2026-09-22

These items were explicitly removed from the C17 release gate during product review. They must not silently re-enter C17 acceptance work unless separately reprioritized.

## Notes / knowledge

- Dedicated visual identity / possibility picker.
- Note Previous / Next / Save-and-next navigation.
- Instant read-mode quick tags and possible Undo workflow.
- Dedicated one-tap `Clued`, `Unclued`, and `Blank` controls.
- Deep Knowledge workspace beyond ordinary on-card knowledge/empathy.
- Two-card / two-hand compare flows.
- All comparison pins.

## Clue planning

- Multi-candidate Compare / clue pins.
- Read-only off-turn clue planning.
- Zero-token rehearsal with hypothetical touched-card preview and disabled Give.

## Gestures / empathy

- Hold-and-drag across cards to peek notes.
- Optional preference for global empathy Toggle versus Hold behavior.
- Drag-to-play / drag-to-discard as an optional input mode. Safe explicit Play/Discard buttons remain the baseline.

## Layout / presentation

- **4P–6P gameplay redesign / repair:** make ordinary 4P, 5P, and 6P gameplay usable again rather than treating the current Compact Overview / summary-icon fallback as accepted UX. Replace that fallback with a real-card-face layout. Cards take priority over chrome; reduce secondary controls, gaps, and card size within readability bounds before considering alternate representations. Revalidate 4P, 5P, and 6P physically after the redesign.
- Dedicated two-column landscape composition.
- Dedicated tablet / large-screen persistent side-pane composition and polish.
- Richer / prettier / cinematic gameplay animations beyond the minimal functional C17 transitions.

## Product shell / social

- **Lobby table sections and create-table placement:** split lobby discovery into visually distinct sections ordered as Pregame tables -> create-your-own-table surface -> Running tables -> Shared replays. Pregame and shared replay entries must no longer be presented as one combined section. When the user returns to the lobby while already in an active game, hide the create-table surface because starting a second table is not the relevant action. Consider web-like color treatment or another clear visual distinction between table/replay types, but choose the exact styling during implementation.
- **Native controls for useful slash-command actions:** research which existing web/slash-command capabilities deserve first-class mobile buttons or menus instead of requiring command typing. The existing leader-control UI (equivalent to `/setleader`) is the precedent. Preserve slash-command support as the underlying parity/fallback path; only surface commands whose semantics and permissions can be represented clearly and safely in native UI.
- **Simple bot invite UI:** add an `Add bot` affordance that opens a maintained list of known bots, lets the user choose one, and then performs the existing server-side invitation flow by privately messaging that bot with `/join <password>`. Before implementation, verify the authoritative bot roster/discovery mechanism, PM target identity, table-password source, and failure states; do not create a separate bot-join protocol in mobile.
- People surface.
- Rich/compact profiles beyond what is strictly required by existing gameplay/table identity.
- Friends list / online-friends affordances.
- Social feeds, recommendations, achievements, messaging redesign.

## Non-backlog C17 capabilities

For avoidance of doubt, the following are **not** backlog and remain C17 MUST:

- Live Rewind/history.
- Finished game and ordinary replay in the C17 workspace.
- Shared review including follow/detach/leader semantics.
- Hypothetical using upstream/server semantics.
- Live spectator C17 workspace.
- Pregame player/spectator role switching where authoritative capability permits.
- Minimal functional state-change animation.
