# Android 1.0.0-rc.2 - release candidate gate

Date: 2026-10-21

Status: **release preparation only; physical acceptance pending, not approved for public distribution**.

## Identity and scope

- App version: `1.0.0-rc.2`
- Android versionCode: `7` (the tester phone already has code 6)
- Expected APK: `Hanab-Mobile-1.0.0-rc.2.apk`
- GitHub Actions workflow: **Android Release Candidate APK**
- Workflow artifact: `Hanab-Mobile-1.0.0-rc.2`
- Planned tag: `v1.0.0-rc.2`, **GitHub prerelease, not stable**

RC.1 failed its initial physical acceptance due to a startup crash. RC.2 includes
the BrowsingAppBar deferred layout event crash fix (#197) and the C17 landscape
Review workspace height fix (#198). These changes still require a fresh physical
PASS on the exact rc.2 APK. The rc.1 record remains in [RC_1_RELEASE.md](./RC_1_RELEASE.md).

This preparation changes release identity and documentation only. It does not
build an APK, create a tag or release, or publish an artifact.

## Release blockers

- [ ] Release-prep PR reviewed and merged; exact candidate commit recorded.
- [ ] PR CI passes; CI evidence recorded.
- [ ] After review, build the frozen candidate through the existing workflow;
      record the run/artifact and APK SHA-256 before installation.
- [ ] Upgrade over the tester phone's versionCode 6 without wiping app data.
- [ ] Launch without Metro; saved-session check reaches Home without a crash.
- [ ] Clean-install/login path works on at least one Android device.
- [ ] Create/join a 2P table; execute a legal Play, Discard and Clue with correct
      authoritative state and no accidental or duplicate sends.
- [ ] Send/receive table chat and a PM.
- [ ] Background/foreground and reconnect do not send stale gameplay commands.
- [ ] Keyboard/Android Back and Browse/Return preserve intended attendance.
- [ ] Rotate portrait and both landscape orientations; essential controls remain
      reachable, including the Review workspace covered by #198.
- [ ] Rewind/Review returns to current Live state; Hypothetical cannot send live
      gameplay commands. Record device details and physical PASS below.

Startup/process crashes, broken upgrade/login, incorrect gameplay state,
accidental/duplicate/stale commands, broken core chat or impassable navigation
block publication. Use [TESTING.md](../TESTING.md) for the player-facing script.

## Evidence - fill after review and acceptance

- Candidate commit SHA:
- PR CI result / URL:
- Android workflow run / artifact URL:
- APK SHA-256:
- Device / Android version:
- Physical acceptance date / result / evidence:
- GitHub prerelease publication URL:

## Build and publication gate

Keep the existing build workflow and invocation: a manual dispatch or push to
`release-candidate/**` runs `npm ci` and `npm run android:beta-apk`.
The workflow produces a build artifact retained for 14 days; it does not publish
a GitHub release. The `release-prep/rc2` branch does not trigger this APK build.

Do not build, tag or publish during release preparation. Only after PR review
and CI may the candidate be built for physical acceptance. Only after physical
PASS may the exact tested APK be published under `v1.0.0-rc.2` as a GitHub
prerelease. Do not mark it stable or substitute a different APK.
