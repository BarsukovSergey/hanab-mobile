# Pinned upstream headless client core

- Repository: `https://github.com/Hanabi-Live/hanabi-live.git`
- Exact commit: `054e859b97ebacc514ca37470e6bdfae5a93d467`
- Original paths: `packages/client/src/game/{types,reducers}`
- C12-A roots: `State.ts`, `ReplayState.ts`, `SharedReplayState.ts`, `actions.ts`,
  `initialState.ts`, `stateReducer.ts`, `stateReducerHelpers.ts`, and `replayReducer.ts`.

The reducer flow and C12-A branches are copied from the pinned client. Imports are adapted to the
existing vendored game package. Browser-only UI, DOM/Konva, networking, notes, premoves, pauses,
spectator presentation, and hypothetical replay branches are omitted from the mobile headless
boundary. Shared replay data created by `finishOngoingGame` is retained, but C12-B networking and
controls are not included.
