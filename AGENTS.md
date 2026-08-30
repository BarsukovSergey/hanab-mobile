# Hanab Mobile

Unofficial Android-first React Native client for hanab.live. iOS must remain supportable by the architecture.

## Working rules

- Read `docs/` before implementing a task.
- The hanab.live server is authoritative.
- UI never talks directly to a raw WebSocket.
- Protocol/domain code must stay platform-independent.
- Platform-specific networking belongs behind the `NetworkSession` boundary.
- Do not invent hanab.live protocol behavior. If a required fact is undocumented, stop and report it.
- Do not add dependencies unless the current task explicitly allows them.
- Do not redesign unrelated code.
- Do not expand MVP scope without an explicit task.

## Connection safety

- One authentication lifetime uses one logical `NetworkSession`.
- Never expose cookies, session tokens, or Cookie headers to application code if the platform networking stack can keep them private.
- `POST /login` success does not prove an authenticated session. `/test-cookie == 200` proves the HTTP session; a valid `welcome` proves the realtime session.
- Only `/test-cookie == 204` means the session is missing. Other HTTP failures or transport failures are indeterminate, not logout.
- Outgoing gameplay commands are never queued, persisted, retried, or replayed across a connection boundary.
- Stale connection callbacks must not mutate current state. Stale resources must be disposed.
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

Protocol and game behavior are documented against the pinned upstream commit in `docs/UPSTREAM.md`. Do not silently switch analysis to a newer upstream `main`.

## Before finishing an implementation task

Run the validation required by that task. When the project has the relevant scripts, prefer:

```text
npm run typecheck
npm run lint
npm test
```

On the first unexplained failure: collect evidence and stop. Do not install alternative libraries or rewrite the approach unless the task explicitly says to do so.
