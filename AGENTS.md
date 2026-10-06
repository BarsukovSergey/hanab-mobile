# Hanab Mobile

Unofficial Android-first React Native client for hanab.live. iOS must remain supportable by the architecture.

## Start here

Do **not** read all of `docs/` by default. It contains current authority, evidence, release records, and historical snapshots.

1. Read `docs/README.md` first.
2. Read only the authority documents that apply to the task.
3. Search for nearby tests and nested `AGENTS.md` before editing a high-risk area.

Authority precedence for current work:

- `docs/MOBILE_APP_DESIGN_V2.md` — app shell, information architecture, navigation, Back/Browse/Return, responsive classes, and the Phase 2 implementation sequence.
- `docs/C17_UX_CONTRACT.md` — gameplay interaction semantics and the Table Ledger / Decision Workbench contract.
- `docs/ARCHITECTURE.md` — server authority, networking, reconnect/epoch safety, dependency boundaries, and runtime ownership.
- `docs/UPSTREAM.md` plus local `UPSTREAM.md` files — pinned/scoped upstream semantics.
- `docs/PRODUCT_ROADMAP.md` — sequencing and milestone priority.

For shell/navigation/landscape decisions introduced by Mobile App Design v2, v2 supersedes older C17 shell, More/menu, and landscape statements. Do not silently revive a superseded decision.

## Working rules

- The hanab.live server is authoritative.
- UI never talks directly to a raw WebSocket.
- Protocol/domain code must stay platform-independent.
- Platform-specific networking belongs behind the `NetworkSession` boundary.
- Do not invent hanab.live protocol behavior. If a required fact is undocumented, stop and report it.
- Do not add dependencies unless the current task explicitly allows them.
- Do not redesign unrelated code or widen a bounded task into cleanup.
- Prefer small implementation slices from issue #143 over broad rewrites.
- When touching a large hotspot, extract a bounded helper/policy only when it is required by the task; do not combine behavior changes with opportunistic decomposition.

## Agent delivery defaults

Unless the task explicitly says otherwise:

- Keep work bounded to the requested task/slice and use the authority hierarchy above; stale docs do not expand scope.
- Do not update unrelated roadmap/release/status documents or opportunistically refactor unrelated hotspots.
- Use `npm run test:affected` during iteration where useful, then run the canonical final validation required by the task.
- When delivery asks for a PR, push the branch and open or update the requested PR. Do not merge your own PR.
- Run Android APK/release workflows only when the task explicitly requires physical-device or release work.
- Report which validation ran and what was intentionally deferred.

## Connection and gameplay safety

- One authentication lifetime uses one logical `NetworkSession`.
- Never expose cookies, session tokens, or Cookie headers to application code if the platform networking stack can keep them private.
- `POST /login` success does not prove an authenticated session. `/test-cookie == 200` proves the HTTP session; a valid `welcome` proves the realtime session.
- Only `/test-cookie == 204` means the session is missing. Other HTTP or transport failures are indeterminate, not logout.
- Outgoing gameplay commands are never queued, persisted, retried, or replayed across a connection boundary.
- Stale connection callbacks must not mutate current state. Stale resources must be disposed.
- Replay/Rewind/Hypothetical inspection must not create a live gameplay send path.
- Card-bound state follows stable authoritative `card.order`, not a transient displayed slot.
- Never stress-test, fuzz, or load-test production hanab.live.

## Secrets

Never log or commit:

- account passwords;
- `hanabi.sid`;
- Cookie headers;
- table passwords;
- other authentication secrets.

Raw protocol captures must remain local until sanitized and manually inspected.

## Upstream

Protocol and game behavior use the scoped pins in `docs/UPSTREAM.md`. Do not silently switch analysis or implementation to a newer upstream `main`.

Vendored upstream code has additional local instructions under `src/game/upstream/AGENTS.md`.

## Source-contract tests

This repository intentionally has tests that read implementation source as text to protect structural UI/runtime contracts.

Before moving JSX, renaming a source-level control, or extracting code from files such as `App.tsx`, `C17GameScreen.tsx`, or Pregame/Lobby screens:

1. search tests for the touched filename and for `readFileSync`;
2. determine whether the source-contract expectation is still part of the product contract;
3. update the test only when the intended contract moved with the implementation.

For new code, prefer behavioral/helper-level tests when practical. Do not rewrite existing source-contract tests during unrelated work.

## Validation

During implementation, use `npm run test:affected` for fast feedback on branch and worktree changes, including source-contract tests. Use `npm run test:affected -- --list` to inspect the selection or `--base <ref>` to override the comparison base. This helper does not replace full validation.

The canonical normal validation entry point is:

```text
npm run validate
git diff --check
```

`npm run validate` runs TypeScript checking and the Jest suite.

Task-specific checks:

- bot registry changes: `npm run bot:check`;
- generated card assets: `npm run cards:check`;
- Android beta/release behavior: follow the release task and `docs/ANDROID_BETA_RELEASE.md`.

There is currently **no lint script**. Do not add or install a linter merely because an old note mentions linting.

On the first unexplained validation failure, collect evidence and diagnose it. Do not install alternative libraries or rewrite the approach unless the task explicitly requires that.
