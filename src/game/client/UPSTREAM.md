# Pinned upstream headless client core

- Repository: `https://github.com/Hanabi-Live/hanabi-live.git`
- Exact commit: `e78e82bce2ff5d54b9d2ec359530955fd354e9b7`
- Original paths: `packages/client/src/game/{types,reducers}`
- C12-A roots: `State.ts`, `ReplayState.ts`, `SharedReplayState.ts`, `actions.ts`,
  `initialState.ts`, `stateReducer.ts`, `stateReducerHelpers.ts`, and `replayReducer.ts`.

The reducer flow and C12-A branches are copied from the pinned client. Imports are adapted to the
existing vendored game package. Browser-only UI, DOM/Konva, networking, notes, premoves, pauses,
spectator presentation, and hypothetical replay branches are omitted from the mobile headless
boundary. C12-B additionally retains the pinned `replaySharedSegment`,
`replayUseSharedSegments`, `replayLeader`, and `spectators` reducer behavior. Mobile networking and
controls dispatch those vendored actions while keeping the server-owned shared segment separate
from the locally viewed replay segment. Browser-only replay arrows, sounds, and hypotheticals remain
omitted.