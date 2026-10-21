# Android 1.0.0-rc.1 — release candidate gate

Date: 2026-10-21

Status: **build/test candidate only, not approved for public distribution**.

## Identity

- App version: `1.0.0-rc.1`
- Android versionCode: `6`
- Expected APK: `Hanab-Mobile-1.0.0-rc.1.apk`
- GitHub Actions workflow: **Android Release Candidate APK**
- Workflow artifact: `Hanab-Mobile-1.0.0-rc.1`
- Candidate commit: record the exact release-candidate branch SHA after CI/build
- APK SHA-256: record before installing or sharing

The current public tester build remains `v1.0.0-beta.3-hotfix.1`.
The untested beta.4 must never be distributed as a passing release.

## Why this candidate exists

It includes compatibility with the current upstream chat/source contract,
chat deletion handling, guarded incoming WebSocket processing and a React
error screen. It **does not** prove the earlier on-device
`Checking session -> process exit` has been fixed.

## Build

A push to a dedicated `release-candidate/**` branch, or a manual workflow
dispatch, creates a **build artifact**, not a GitHub release.
The artifact is retained for 14 days. The workflow runs:

```sh
npm ci
npm run android:beta-apk
```

No signing-store/upload/publication action occurs in this workflow.

## Minimum maintainer physical smoke — release blockers only

- [ ] Record exact candidate commit and APK SHA-256.
- [ ] Attempt upgrade over beta.3-hotfix.1 without wiping app data first.
- [ ] App starts without Metro, checks the saved session, and reaches Home.
- [ ] Clean-install/login path works on at least one Android device.
- [ ] Create or join a normal 2P table and start a game.
- [ ] Execute one legal Play, Discard, and Clue; verify authoritative state updates.
- [ ] Send and receive table chat and a PM against current production server.
- [ ] Background/foreground during a game; no stale or duplicate gameplay send.
- [ ] Open keyboard and use Android Back; navigation does not silently leave a game.
- [ ] Rotate once; essential gameplay controls remain reachable.
- [ ] If an exception occurs, capture Android logcat and the exact reproduction steps.

A startup/process crash, broken login, bad gameplay state, accidental/duplicate
gameplay command, non-functional core chat, or unrecoverable navigation **blocks**
public distribution. Non-blocking styling/replay/device-matrix issues can be
reported by public RC testers once the above passes.

## Next step

Only after physical smoke passes, promote **this exact tested artifact** to a
GitHub prerelease and announce it to testers. Do not call it `1.0.0` or a
stable release yet.

For known beta.4 testing history, see `BETA_4_PHYSICAL_SMOKE.md`.
