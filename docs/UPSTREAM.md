# Upstream pins

Hanab Mobile intentionally uses **scoped upstream pins** rather than pretending every vendored/adapted piece comes from one Hanabi-Live commit.

This exists for reproducibility. Production hanab.live may move ahead of these commits, so compatibility work must refer to the documented source for the behavior being changed rather than silently reading a newer upstream `main`.

## Baseline game / protocol / renderer pin

The baseline vendored game/reducer/protocol behavior and generated card-renderer integration are documented against:

- Repository: `Hanabi-Live/hanabi-live`
- Commit: `e78e82bce2ff5d54b9d2ec359530955fd354e9b7`
- Commit date: 2026-09-03

The previous baseline pin was `054e859b97ebacc514ca37470e6bdfae5a93d467`.

The deliberate baseline change to `e78e82b...` adopted the merged card-renderer backend refactor from Hanabi-Live PR #3110 while keeping the vendored game/reducer/protocol closure on that baseline.

Runtime diagnostics should eventually expose the relevant pinned SHA alongside protocol/compatibility failures.

## Card presentation selector pin

Card presentation semantics are adapted from the later upstream selector extraction:

- Repository: `Hanabi-Live/hanabi-live`
- Commit: `7a9c601b66f5966f7e33564855e25f82e68a94ed`
- Commit message: `refactor: extract card presentation selectors (#3115)`
- Source: `packages/client/src/game/ui/cardPresentation.ts`
- Mobile adaptation: `src/game/client/cardPresentation.ts`

The mobile adaptation is intended to preserve the upstream selector behavior while rewriting imports to use the vendored game core.

`7a9c601...` is nine commits ahead of the baseline pin and that range includes unrelated client/server changes in addition to the card-presentation extraction. Therefore adopting the selector does **not** by itself mean the entire mobile game/protocol baseline has moved to `7a9c601...`.

The finished-game `note.unclued` presentation behavior deliberately includes the scoped follow-up from `f92dbefaad90894612eff8369e376843ae6b3621` (PR #3116, `Deactivate note.unclued when game is finished`). This is a selector-only semantic follow-up; it does not advance the baseline game/protocol pin or the whole vendored upstream baseline.

The semantic contract and mobile parity notes for this selector live in `docs/CARD_PRESENTATION_PARITY.md`.

## Friends history protocol pin

Friends history is adapted from `Hanabi-Live/hanabi-live` commit
`c1d970bd610395087958fe7d1bb96f52244f7b04`, specifically
`server/src/websocket_connect.go`, `server/src/command_history_friends_get.go`,
`packages/client/src/lobby/lobbyCommands.ts`, `packages/client/src/lobby/history.ts`,
and `packages/client/src/lobby/types/GameHistory.ts`. This scoped protocol fact does
not advance the baseline game/protocol pin above.

## Hypothetical replay core pin

Hypothetical replay state, reducer semantics, and replay-action protocol are adapted from:

- Repository: `Hanabi-Live/hanabi-live`
- Commit: `8be709c48145ad56a1891307663ed3bec2cd4175`
- Sources: `HypotheticalState.ts`, `replayReducer.ts`, `hypothetical.ts`, `ReplayActionType.ts`, and `server/src/command_replay_action.go`

The mobile boundary retains only platform-independent state/reducer/protocol/runtime behavior; browser UI remains out of scope.

## Pinning rule

When behavior needs to move forward:

1. identify which upstream boundary owns that behavior;
2. update the relevant scoped pin/source deliberately;
3. verify whether the change requires advancing the baseline vendored closure or only adapting a scoped source;
4. update the corresponding documentation/tests in the same work;
5. never silently switch implementation assumptions to current upstream `main`.

If scoped pins become too numerous or their dependency assumptions stop being compatible, consolidate them by deliberately advancing the baseline and revalidating the vendored closure instead of accumulating accidental mixed-version behavior.
