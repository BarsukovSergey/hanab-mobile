# Pinned upstream game-core closure

- Repository: `https://github.com/Hanabi-Live/hanabi-live.git`
- Exact commit: `054e859b97ebacc514ca37470e6bdfae5a93d467`
- Original path: `packages/game/src`
- License: repository-root `LICENSE`, copied here as `LICENSE`
- Copy method: checked out the exact commit in a temporary clone, then followed every relative TypeScript/JSON import reachable from the C2 roots listed below and preserved each reachable file's path and contents.

## C2 roots

- `metadata.ts`
- `testActions.ts`
- `reducers/gameReducer.ts`
- `reducers/initialStates/initialGameState.ts`
- `interfaces/GameState.ts`
- `types/gameActions.ts`

The transitive closure contains 78 upstream source/JSON files. It does not import another hanabi-live workspace package or any upstream client, server, database, or UI source.

## External runtime dependencies

- `complete-common@2.22.1`
- `immer@11.1.4`
- `tslib@2.8.1`
- `zod@4.3.6`

## Source patches

None. The copied upstream `.ts` and `.json` files are byte-for-byte copies from the pinned commit. C2 imports leaf modules rather than the upstream barrel so Metro only traverses this closure.
