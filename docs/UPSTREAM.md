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

Card presentation semantics are adapted from the merged U1 upstream selector extraction:

- Repository: `Hanabi-Live/hanabi-live`
- Commit: `7ca5992783d8dec1e57c6c19077dc690e13aaf25`
- Source: `packages/game/src/cardPresentation.ts`
- Mobile adaptation: `src/game/client/cardPresentation.ts`

The mobile adaptation preserves the upstream selector behavior while rewriting imports to use the vendored game core. This scoped selector pin does not advance the baseline game/protocol pin above.

The semantic contract and mobile parity notes for this selector live in `docs/CARD_PRESENTATION_PARITY.md`.

## Friends history protocol pin

Friends history is adapted from `Hanabi-Live/hanabi-live` commit
`c1d970bd610395087958fe7d1bb96f52244f7b04`, specifically
`server/src/websocket_connect.go`, `server/src/command_history_friends_get.go`,
`packages/client/src/lobby/lobbyCommands.ts`, `packages/client/src/lobby/history.ts`,
and `packages/client/src/lobby/types/GameHistory.ts`. This scoped protocol fact does
not advance the baseline game/protocol pin above.

## Hypothetical replay / protocol pin

Replay/shared-replay orchestration and replay-action protocol behavior are adapted from:

- Repository: `Hanabi-Live/hanabi-live`
- Commit: `8be709c48145ad56a1891307663ed3bec2cd4175`
- Sources: `replayReducer.ts`, `hypothetical.ts`, `ReplayActionType.ts`, and `server/src/command_replay_action.go`

The platform-independent hypothetical state-transition core has since advanced to the separate U3a pin below. Mobile replay ownership, shared-replay coordination, protocol validation, and runtime safety remain outside that extracted core.

## Hypothetical state-transition pin

Platform-independent hypothetical state transitions are adapted from the merged U3a extraction:

- Repository: `Hanabi-Live/hanabi-live`
- Commit: `0103ce7d2a72cb1922e46324ef2e484720bea737`
- PR: #3158
- Source: `packages/game/src/hypotheticalState.ts`
- Mobile adaptation: `src/game/client/hypotheticalState.ts`

The mobile adaptation preserves the upstream initialization, action application, Back, draw-visibility, starting-player clue, reducer flags, and segment-snapshot semantics while retaining mobile-only branch-history fields (`actions` and `stateActionLengths`) used by reveal-toggle legality and replay export. Mobile also keeps its existing hypothetical strike contract that permits strike numbers above three; live-game strike validation is unchanged.

This scoped state-transition pin does not advance the baseline game/protocol pin or the hypothetical planning pin. Bottom-Deck Blind Play follow-ups such as #3159 remain excluded because mobile does not support `deckPlays`.

## Hypothetical action planning pin

Hypothetical deterministic planning is adapted from the merged U2 extraction:

- Repository: `Hanabi-Live/hanabi-live`
- Commit: `0c8c1cd039044c00d4d4c00ba773b8143ef25fd2`
- PR: #3156
- Source: `packages/game/src/hypotheticalPlanning.ts`
- Mobile adaptation: `src/game/client/hypotheticalPlanning.ts`

This is a scoped pure-planning adoption. It does not advance the baseline game/protocol pin,
nor the hypothetical replay state/reducer/protocol pin at
`8be709c48145ad56a1891307663ed3bec2cd4175`. Mobile validation, eligibility,
card visibility policy, and runtime transport/READY/ownership safety remain outside the planner.
Later bottom-deck planning changes such as #3157 are not part of this adoption;
mobile still does not support Bottom-Deck Blind Plays or `deckPlays`.

## Pinning rule

When behavior needs to move forward:

1. identify which upstream boundary owns that behavior;
2. update the relevant scoped pin/source deliberately;
3. verify whether the change requires advancing the baseline vendored closure or only adapting a scoped source;
4. update the corresponding documentation/tests in the same work;
5. never silently switch implementation assumptions to current upstream `main`.

If scoped pins become too numerous or their dependency assumptions stop being compatible, consolidate them by deliberately advancing the baseline and revalidating the vendored closure instead of accumulating accidental mixed-version behavior.
