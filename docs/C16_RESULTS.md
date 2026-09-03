# C16 Results — UI/UX redesign

Status: **IMPLEMENTED / UNVERIFIED**

C16A navigation safety was already closed separately. The remaining C16 implementation is split into three reviewable commits:

- C16B1 — non-game surfaces and app design system.
- C16B2 — responsive game/table redesign and Hanab-style card renderer.
- C16C — orientation/theme integration, state polish, and final consistency.

## Implemented

- Shared light/dark design tokens with `System`, `Light`, and `Dark` runtime selection.
- Responsive narrow/wide layouts for phone portrait, phone landscape, and tablet widths.
- Redesigned login, lobby, history, pregame, table options, and chat surfaces.
- Redesigned live game, review, postgame, replay, notes, clue controls, presence, clocks, and termination controls.
- Card proportions follow pinned hanab.live `CARD_W = 286` / `CARD_H = 406`; suit fills come from the vendored pinned variant data. Hidden-card knowledge, positive clue emphasis, ranks, and suit markers are rendered as a thin React Native adaptation instead of a second game model.
- Expo orientation changed from portrait-only to `default`; system UI style changed to `automatic` so phone landscape/tablet and OS appearance are not blocked by app configuration.
- Loading, connection, login error, empty history/table/chat, pending action, replay, and paused-game states use the same visual language.
- Destructive immediate termination keeps an explicit confirmation; normal Leave/Unattend/Sign out remain direct actions.

## Deliberate limits

- Theme preference currently resets to `System` after a process restart. No storage dependency was introduced solely for C16; persistent preference can be added later with an approved app-storage mechanism.
- The React Native card renderer follows pinned upstream semantics, proportions, variant fills, and pip meanings but does not embed upstream Konva/Canvas or blindly copy third-party/print-derived artwork.
- Final icon/splash asset replacement remains C17 release polish.

## Verification state

The implementation was diff-reviewed after each C16 chunk. Full project commands (`npm run typecheck`, `npm test`, `git diff --check`) could not be executed in the current tool environment because the repository cannot be cloned/materialized there and the repository has no CI workflow. Changed TSX files received syntax/transpile checks where local source was available.

Before C16 can be marked CLOSED / GO, run the project validation commands and physically verify Android phone portrait/landscape plus tablet layouts, all three theme modes, core gameplay actions, notes/clues, replay navigation, postgame/rematch, chat, and existing Back/Lobby semantics.
