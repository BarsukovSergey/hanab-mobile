# Upstream pin

This project currently documents hanab.live behavior against:

- Repository: `Hanabi-Live/hanabi-live`
- Commit: `e78e82bce2ff5d54b9d2ec359530955fd354e9b7`
- Commit date: 2026-09-03

This pin exists for reproducibility. Production hanab.live may move ahead of it, so runtime diagnostics must eventually expose this pinned SHA alongside protocol compatibility errors.

The previous pin was `054e859b97ebacc514ca37470e6bdfae5a93d467`. The only upstream change between that commit and this pin is the merged card-renderer backend refactor from Hanabi-Live PR #3110; the vendored game/reducer/protocol closures are unchanged.

Do not silently switch implementation assumptions to a newer upstream `main`. If behavior must be updated, first update this file and the corresponding protocol documentation deliberately.