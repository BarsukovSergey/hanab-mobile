# C2 Results — Pinned Upstream Game Core + Hermes Proof

Status: **GO**

Test date: 2026-08-31

## Decision

**C2 GO — direct Redux ownership acceptable for the MVP.**

This conclusion is based on the exercised representative paths: a deterministic, upstream-derived three-player No Variant sequence containing initial draws, a color clue, a successful play and replacement draw, and a normal discard and replacement draw. It is not proof of every possible variant, action, reducer branch, or future upstream change. New paths must retain normal Redux serializability and immutability checks.

`src/game/c2/**` is explicitly temporary, test-harness-only spike code. It is retained only as reproducible C2 evidence and must not be expanded into production Redux, game, protocol, lobby, reconnect, or UI architecture.

## Upstream closure

- Repository: `Hanabi-Live/hanabi-live`
- Pinned SHA: `054e859b97ebacc514ca37470e6bdfae5a93d467`
- Original upstream path: `packages/game/src`
- Vendored path: `src/game/upstream/**`
- Closure: 78 TypeScript/JSON files reachable from the C2 roots recorded in `src/game/upstream/UPSTREAM.md`, plus the copied upstream license and local provenance document.
- C2 roots: `metadata.ts`, `testActions.ts`, `reducers/gameReducer.ts`, `reducers/initialStates/initialGameState.ts`, `interfaces/GameState.ts`, and `types/gameActions.ts`.
- Closure exclusions: no upstream client, server, database, UI, or other hanabi-live workspace package was copied or imported.
- Upstream source patches: none. The vendored TypeScript and JSON files are byte-for-byte copies from the pinned commit.

External runtime dependencies required by the pinned game package:

- `complete-common@2.22.1`
- `immer@11.1.4`
- `tslib@2.8.1`
- `zod@4.3.6`

Test-only support added for the C2 automated proof:

- `jest-expo@57.0.5`
- `@types/node@26.4.0`

## Reducer mutation and structural-sharing proof

The automated and on-device probes apply 20 actions derived from pinned upstream test helpers. They create a three-player No Variant initial deal and exercise clue, play, discard, draw, and turn advancement paths.

For every reducer call, the probe:

- snapshots the previous state structurally;
- verifies the previous state remains structurally equal to its snapshot;
- verifies a state-changing action returns a different root object;
- verifies the action-specific result; and
- observes retained identity on unchanged branches.

Results:

- previous-state mutation detected: no;
- changed-action root identity failures: 0;
- action outcome failures: 0;
- structural sharing observed: yes;
- final score: 1;
- clue tokens: 8;
- turn: 3.

## Serializability and JSON round trips

The C2-only recursive audit checks initial state, every state produced by the sequence, and metadata. It reports paths for functions, symbols, bigints, undefined object properties, dates, maps, sets, regular expressions, promises/thenables, class instances, non-plain objects, cycles, and non-finite numbers.

Results:

- initial-state non-plain findings: 0;
- sequence-state non-plain findings: 0;
- metadata non-plain findings: 0;
- non-finite/JSON-lossy numeric findings: 0;
- initial-state JSON structural round trip: pass;
- every sequence-state JSON structural round trip: pass;
- metadata JSON structural round trip: pass;
- C2 probe recommendation: `DIRECT_REDUX`.

These results support direct Redux ownership for the MVP only for the representative paths exercised by C2. They do not justify disabling Redux serializability checks or assuming unexercised variants/actions have identical characteristics.

## Metro and physical Android runtime

- Metro Android development-build bundle with the vendored closure: pass.
- JavaScript engine on the physical device: Hermes (`YES`).
- Game-core import on the physical Android device: pass.
- Reducer sequence on the physical Android device: pass.
- Physical result: final score 1, clue tokens 8, turn 3.
- RedBox/runtime import errors: none observed.

Because the development build loaded and executed the imported vendored game core on Hermes, the on-device result also proves that Metro resolved and bundled the exercised closure and its dependencies successfully.

## Import containment

Direct imports of vendored upstream implementation/types are allowed only within:

- `src/game/upstream/**`;
- `src/game/selectors/**`;
- `src/game/c2/**` (temporary test/spike harness only).

`App.tsx` imports only the app-owned `GameCoreProbeResult` harness entry point and does not import upstream state, card types, reducer internals, or vendored modules directly. The repository containment test scans TypeScript source imports and found no violations outside the allowed boundary.

## Validation

- `npm run typecheck`: pass.
- `npm test`: pass — 2 suites, 4 tests, including reducer/serializability and import containment.
- `npx expo-doctor`: pass — 21/21 checks.
- `npm ls --depth=0`: pass.
- `git diff --check`: pass (Git reported line-ending conversion notices only, not diff errors).
- Physical Android Metro/Hermes probe: pass, as recorded above.

## Scope boundary

C2 ends with this result. It does not start C3 or establish production Redux architecture, protocol runtime, lobby behavior, reconnect behavior, or game UI. The temporary C2 harness must remain evidence code rather than becoming the production game boundary.
