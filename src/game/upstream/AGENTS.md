# Vendored upstream game-core instructions

Scope: `src/game/upstream/**`.

This directory is a pinned vendored closure, not ordinary application source.

Read:

- `src/game/upstream/UPSTREAM.md`;
- `docs/UPSTREAM.md`;
- the task-specific parity/semantic document, if one is named by the task.

## Rules

- Do not opportunistically edit vendored upstream files.
- Do not silently advance to current Hanabi-Live `main`.
- The baseline vendored closure is expected to remain byte-for-byte upstream source unless a deliberate pin advance says otherwise.
- A scoped upstream adaptation elsewhere does not automatically advance this baseline.
- If behavior must move forward, identify the owning upstream boundary and update the relevant pin/documentation/tests together.
- Keep browser/client/server UI concerns out of the vendored game-core closure.
- Do not add local “fixes” here to compensate for a mobile presentation problem.

Run the repository validation required by the task after any deliberate pin/closure change.
