# Upstream pin

This project currently documents hanab.live behavior against:

- Repository: `Hanabi-Live/hanabi-live`
- Commit: `054e859b97ebacc514ca37470e6bdfae5a93d467`
- Commit date: 2026-08-26

This pin exists for reproducibility. Production hanab.live may move ahead of it, so runtime diagnostics must eventually expose this pinned SHA alongside protocol compatibility errors.

Do not silently switch implementation assumptions to a newer upstream `main`. If behavior must be updated, first update this file and the corresponding protocol documentation deliberately.
