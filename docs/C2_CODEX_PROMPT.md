# C2 Codex Task — Pinned Upstream Game Core + Hermes Proof

## TASK

Prove that the pinned hanabi-live game core can be reused safely inside this Expo / React Native app on Android without importing unrelated upstream client/server/UI code.

C2 is a **compatibility and containment spike**. It is not the lobby, protocol runtime, game screen, reconnect implementation, or production Redux integration.

## GOAL

Answer these questions with evidence:

1. What is the smallest reproducible source/dependency closure needed from the pinned upstream `packages/game` package?
2. Does that closure compile under this project's strict TypeScript configuration?
3. Does a realistic upstream-derived `GameAction[]` sequence run correctly through `getInitialGameState` / `gameReducer`?
4. Does the same code bundle through Metro and execute under Hermes on the physical Android development build?
5. Does `gameReducer(previous, action, ...)` leave the previous state unchanged?
6. Is the resulting `GameState` suitable for direct Redux ownership under default serializability expectations, or should it be owned by an opaque `GameRuntime` instead?
7. Can upstream types/imports be contained so future UI/network/lobby code does not depend directly on upstream `GameState` / `CardState`?

Do not continue into C3 after answering these questions.

## READ FIRST

Read in this order:

- `AGENTS.md`
- `docs/UPSTREAM.md`
- `docs/ARCHITECTURE.md`
- `docs/C1_RESULTS.md`
- this file

Do not silently use a newer upstream `main`.

## PINNED UPSTREAM

Repository:

```text
Hanabi-Live/hanabi-live
```

Exact commit:

```text
054e859b97ebacc514ca37470e6bdfae5a93d467
```

Relevant upstream package:

```text
packages/game
```

At the pinned commit, `packages/game/package.json` declares:

```text
complete-common 2.22.1
immer 11.1.4
tslib 2.8.1
zod 4.3.6
```

The upstream game package is CommonJS when published, but C2 must work from the pinned source/reproducible local closure rather than trusting the old npm release `@hanabi-live/game@0.0.8` to match production source.

## SOURCE-OF-TRUTH RULE

For upstream facts, inspect the exact pinned commit.

Allowed ways to obtain source for the experiment:

- clone/fetch the pinned upstream repository into a temporary directory outside this repo;
- use GitHub/raw files at the exact pinned SHA;
- copy only the required `packages/game` source/package material into this repository.

Do not add the full hanabi-live monorepo as a git submodule, subtree, workspace, or runtime dependency.

Do not copy upstream web client, server, database, Konva, jQuery, React UI, or unrelated packages.

## VENDORING / CONTAINMENT TARGET

Preferred target boundary:

```text
src/game/upstream/**
```

This directory may contain the pinned upstream game source needed by the experiment, preserving its internal relative layout where practical.

Add a small provenance file, for example:

```text
src/game/upstream/UPSTREAM.md
```

that records:

```text
repository
exact SHA
original upstream path
copy/update method
external dependencies required by this copied closure
```

Do not manually rewrite upstream game logic merely to make it look more mobile-native.

Small mechanical compatibility changes are allowed only when strictly required by Metro/TypeScript/Hermes and must be documented as patches against upstream behavior.

## IMPORT CONTAINMENT RULE

For C2, imports of vendored upstream game implementation/types are allowed only inside:

```text
src/game/upstream/**
src/game/selectors/**
src/game/c2/**          # test/spike harness only, if needed
```

Existing C1 networking code must not import upstream game types.

`App.tsx` may import one narrow C2 harness/view-model module for the physical Hermes proof, but must not import upstream `GameState`, `CardState`, reducer internals, or the vendored package directly.

Future lobby/network/UI code should see serializable app-owned result types rather than upstream internals.

Do not build the final production boundary in C2; prove that the boundary can be kept narrow.

## DEPENDENCIES

You may add only dependencies required by the pinned game core and by automated C2 tests.

Expected upstream runtime dependencies are:

```text
complete-common@2.22.1
immer@11.1.4
tslib@2.8.1
zod@4.3.6
```

Use the exact upstream-declared versions unless the current toolchain proves one impossible. If a version must differ, STOP and report the incompatibility before substituting another version.

For tests, add the minimum project-appropriate Jest/Expo test dependencies only if needed. Prefer the standard Expo-supported Jest setup. Do not add a second test framework just to avoid configuration work.

Do not add Redux Toolkit in C2 merely to test serializability. Implement an explicit serializability audit in the C2 harness instead. Redux Toolkit belongs to C3 unless evidence requires an earlier decision.

Do not add:

- React Navigation / Expo Router;
- Axios;
- React Query;
- cookie managers;
- WebView;
- SQLite;
- state-machine libraries;
- UI frameworks;
- alternative JS engines;
- unrelated upstream packages.

## UPSTREAM API / BEHAVIOR TO EXERCISE

The pinned game package exports, among other things:

```text
getDefaultMetadata
getInitialGameState
getInitialGameStateTest
gameReducer
GameAction
GameState
CardState
helper test actions such as draw / play / discard / colorClue / rankClue
```

Upstream's own `gameReducer` is built with Immer `produce`, and upstream contains a test explicitly asserting that one reducer step does not mutate the previous state. C2 must independently verify this behavior in our copied/runtime closure rather than assuming it.

## REALISTIC ACTION SEQUENCE

Do not invent arbitrary structurally-valid `GameAction` objects with no relationship to upstream semantics.

Use an upstream-derived No Variant sequence from the pinned package's own tests/helpers, or a sanitized real production history if one is already locally available and safe to use.

Preferred baseline if no sanitized production fixture exists:

- use `getDefaultMetadata(...)` for ordinary No Variant;
- use upstream `testActions` helpers;
- include initial draws;
- include at least one clue;
- include at least one successful play;
- include at least one normal discard;
- include turn/state advancement sufficient to exercise multiple reducer paths.

The sequence should be deterministic and checked into the repository as test data/code only if it contains no user data.

Do not use a giant full-game fixture if a small upstream-derived sequence proves the same properties.

## AUTOMATED PROOF A — REDUCER SEMANTICS

Add an automated test that:

1. creates deterministic metadata and initial state;
2. stores a deep structural snapshot/reference of the previous state before each reducer call;
3. calls `gameReducer(previous, action, playing, shadowing, finished, hypothetical, metadata, ...)` using semantically valid arguments;
4. proves the previous state was not mutated;
5. proves the returned state reflects the expected action result;
6. repeats across the realistic multi-action sequence.

At minimum prove both:

```text
previous state deep-equals its pre-call snapshot
returned state is not the same root object when the action changes state
```

Where practical, also record structural-sharing observations for unchanged branches, but do not require maximal sharing as an acceptance criterion.

Do not enable/disable Immer behavior globally merely to make the test pass.

## AUTOMATED PROOF B — SERIALIZABILITY AUDIT

Do not reduce this to `JSON.stringify(state)` alone.

Implement a small C2-only recursive audit that reports paths containing values unsuitable for normal Redux/default app-state ownership, including at least:

```text
function
symbol
bigint
undefined object properties
Date
Map
Set
RegExp
Promise / thenable
class instances / non-plain object prototypes
cyclic references
other non-plain runtime objects
```

Arrays and plain objects are allowed.

Primitive strings, booleans, null, and finite numbers are allowed.

Treat non-finite numbers (`NaN`, `Infinity`, `-Infinity`) as a separate finding because they survive some JS state checks but do not round-trip through JSON safely. Report them explicitly rather than silently declaring the entire state serializable or unserializable.

Run the audit on:

- initial `GameState`;
- every resulting state in the realistic action sequence;
- metadata if it would plausibly be stored alongside game state.

Also perform a JSON round-trip check where possible:

```text
JSON.stringify
→ JSON.parse
```

and report whether the structural data survives without loss relevant to game state.

The C2 decision must distinguish:

```text
A. safe plain app/Redux state
B. plain enough for Redux but has JSON-lossy values
C. contains non-plain runtime objects and should be opaque GameRuntime-owned
```

Do not globally disable Redux serializable checks as a solution.

## AUTOMATED PROOF C — TYPE CONTAINMENT

Add a small app-owned C2 result/view-model type, for example:

```ts
type GameCoreProbeResult = {
  ok: boolean;
  finalScore: number;
  clueTokens: number;
  turnNumber: number;
  actionCount: number;
  serializability: ...;
};
```

Exact shape may vary.

The physical UI must consume this app-owned result rather than upstream `GameState` directly.

Use TypeScript/project structure to keep direct imports of vendored upstream code confined to the allowed directories above.

If practical without adding lint infrastructure, add a simple repository test/script that scans source imports and fails if files outside the allowed C2 boundary import `src/game/upstream` directly. If this becomes disproportionately complex, document the containment check and keep it structural/manual for C2; do not add a large lint stack only for this rule.

## HERMES / PHYSICAL ANDROID PROOF

C2 is not complete based only on Node/Jest tests.

Extend the existing development-build app minimally so the user can run the C2 probe on the physical Android device already used for C1.

The C2 screen/harness should show only safe aggregate evidence such as:

```text
Game core import: PASS / FAIL
Reducer sequence: PASS / FAIL
Actions applied: <count>
Final score: <number>
Turn: <number>
Previous-state mutation: NONE / DETECTED
Non-plain serializability findings: <count>
JSON-lossy numeric findings: <count>
Hermes runtime: YES / NO
Probe: PASS / FAIL
```

Do not dump full game states or giant variant JSON to the UI/console.

The runtime proof must execute the imported game-core code and realistic action sequence on Hermes, not merely display a constant result computed by Jest/Node.

Physical Android evidence is required for final C2 GO.

## METRO / BUNDLE PROOF

The project must successfully bundle with the vendored/imported game core through Metro for Android.

Pay particular attention to:

- CommonJS/ES module interop;
- JSON imports, especially upstream variant data;
- `complete-common` compatibility;
- Immer runtime behavior;
- Zod package resolution;
- Metro's handling of the vendored source tree;
- Hermes runtime compatibility.

Do not patch Metro broadly or add custom resolver hacks unless a concrete failure proves they are necessary.

## FILE SCOPE

Expected C2 changes may include:

```text
src/game/upstream/**
src/game/c2/**
src/game/selectors/**          # only if a tiny boundary adapter helps prove containment
tests or __tests__/**
App.tsx                         # minimal C2 harness integration
package.json
package-lock.json
Jest config if required
tsconfig.json only if a narrow justified change is required
docs/C2_RESULTS.md after physical proof, not before
```

Do not modify C1 networking behavior except for harmless UI organization needed to expose the C2 probe.

Do not implement C3 protocol/lobby runtime.

## DO NOT

- Do not install `@hanabi-live/game@0.0.8` from npm as the source of truth.
- Do not vendor the full hanabi-live repository.
- Do not add a git submodule.
- Do not rewrite the game reducer.
- Do not implement a new No Variant reducer.
- Do not port upstream client UI.
- Do not add Redux Toolkit yet just to answer C2.
- Do not globally suppress Redux serializability concerns.
- Do not disable strict TypeScript.
- Do not switch away from Hermes.
- Do not add a second networking approach.
- Do not touch production hanab.live for load/fuzz testing.
- Do not start lobby, spectate, join, game bootstrap, or gameplay networking.

## STOP CONDITIONS

STOP and report sanitized evidence instead of redesigning if any of these occurs:

### STOP 1 — Closure explosion

If the pinned `packages/game` closure requires importing unrelated upstream client/server packages or a large part of the monorepo beyond the game package and its declared external dependencies.

Report the exact import chain causing it.

### STOP 2 — Runtime dependency incompatibility

If an exact declared runtime dependency version cannot install, bundle, or run under the current Expo/React Native/Hermes toolchain and fixing it would require changing dependency versions, forking the dependency, or adding a resolver/polyfill architecture.

Report the failing package/version and exact error before changing versions.

### STOP 3 — Metro/Hermes incompatibility

If the game-core closure passes Node tests but fails Metro bundle or Hermes runtime for a non-trivial reason requiring broad configuration hacks or source rewrites.

Report the smallest reproducer and error.

### STOP 4 — Mutation failure

If `gameReducer` mutates the previous state in the realistic sequence.

Do not wrap it in another deep clone as a workaround. Report the exact action and changed path/reference.

### STOP 5 — Non-plain state

Finding non-plain/non-serializable values is **not automatically a failure**. Record them accurately.

Only STOP if making the state suitable for direct Redux ownership would require invasive transformation of upstream internals. In that case recommend opaque `GameRuntime` ownership and finish the remaining compatibility proofs if they can proceed without such transformation.

### STOP 6 — Scope expansion

If completing C2 appears to require implementing C3/C4 features, stop and report why rather than expanding scope.

## ACCEPTANCE CRITERIA

C2 is GO only when all required proofs are complete:

1. exact pinned upstream provenance is recorded;
2. only the game-package closure and its required external dependencies are brought in;
3. strict TypeScript passes;
4. automated tests run a deterministic upstream-derived multi-action sequence successfully;
5. reducer previous-state immutability is proven across that sequence;
6. serializability audit produces an explicit, path-based result and Redux-ownership recommendation;
7. Android Metro bundle succeeds;
8. the same core sequence executes under Hermes on a physical Android development build;
9. direct upstream imports remain contained to the C2 game boundary;
10. no C3+ functionality is added.

If all compatibility checks pass but serializability indicates upstream state should stay outside Redux, C2 may still be **GO with GameRuntime containment**. That is an architectural result, not a failed spike.

## VALIDATION

Run at least the project-appropriate equivalents of:

```text
npm install
npm run typecheck
npm test                 # after adding test setup
npx expo-doctor
Android Metro/Hermes bundle or dev build
physical Android C2 probe
```

Also run:

```text
git diff --check
npm ls --depth=0
```

Do not claim physical/Hermes success from an emulator, Node, Jest, web, or static Metro export alone.

## REPORT

Report exactly:

### Upstream closure

```text
Pinned SHA:
Vendored/copied paths:
External runtime dependencies added:
Any upstream source patches:
```

### Reducer proof

```text
Sequence origin:
Actions exercised:
Assertions/outcomes:
Previous-state mutation detected: YES / NO
Structural sharing notes:
```

### Serializability

```text
Initial state non-plain findings:
Sequence-state non-plain findings:
Non-finite / JSON-lossy findings:
JSON round-trip result:
Metadata findings:
Recommendation: DIRECT_REDUX / DIRECT_REDUX_WITH_CAVEAT / GAME_RUNTIME
```

Include example paths for every category of finding; do not dump the entire state.

### Metro / Hermes

```text
Metro Android bundle: PASS / FAIL
Physical Android device:
Hermes confirmed: YES / NO
Core import on device: PASS / FAIL
Reducer sequence on device: PASS / FAIL
```

### Containment

```text
Files/directories allowed to import upstream:
Any violations found:
How checked:
```

### Files changed

List them.

### Dependencies added

List exact versions and why each is required.

### Commands/tests run

List each with PASS / FAIL.

### STOP evidence

If a STOP condition was reached, provide the exact smallest failure evidence and do not attempt architecture substitutions.

### Decision

Return exactly one:

```text
C2 GO — direct Redux ownership acceptable
C2 GO — use GameRuntime containment
C2 STOP — <short reason>
```
