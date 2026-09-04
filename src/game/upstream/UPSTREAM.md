# Pinned upstream game-core closure

- Repository: `https://github.com/Hanabi-Live/hanabi-live.git`
- Exact commit: `e78e82bce2ff5d54b9d2ec359530955fd354e9b7`
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

The closure contains the original 78 C2 source/JSON files plus the pinned pure
`interfaces/CardIdentity.ts` dependency required by the C12-A client State. It does not import
upstream client, server, database, or UI source.

## External runtime dependencies

- `complete-common@2.22.1`
- `immer@11.1.4`
- `tslib@2.8.1`
- `zod@4.3.6`

## Source patches

None. The copied upstream `.ts` and `.json` files are byte-for-byte copies from the pinned commit. C2 imports leaf modules rather than the upstream barrel so Metro only traverses this closure.