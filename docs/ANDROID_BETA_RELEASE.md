# Android Beta Release

> **Planned tester candidate:** `1.0.0-beta.4` / Android `versionCode` 5.
> Beta.4 has not been built or published yet. Freeze the release-prep merge commit, build once from
> that candidate, complete `BETA_4_PHYSICAL_SMOKE.md`, then publish that exact tested APK.

## Beta.4 version identity

- version: `1.0.0-beta.4`
- Android `versionCode`: `5`
- workflow: `Android Beta APK`
- workflow artifact: `Hanab-Mobile-1.0.0-beta.4`
- expected APK: `Hanab-Mobile-1.0.0-beta.4.apk`
- runtime candidate: **TBD after release-prep merge**
- ordinary CI: **TBD**
- Android workflow run / artifact ID: **TBD**
- APK size / SHA-256: **TBD**
- GitHub prerelease: **TBD**

The release-prep merge commit becomes the immutable runtime candidate unless a subsequent runtime fix
is required. A runtime change requires a new candidate and rebuild. Documentation-only commits may
record build identity without redefining the tested binary.

## Beta.4 scope

Beta.4 is the first tester line carrying the implemented Mobile App Design v2 shell and the current
runtime/replay safety baseline. The release is deliberately being used to gather Slice 12 physical,
accessibility, and performance evidence rather than pretending that full device validation is already
complete.

Tester-facing highlights and known limitations live in `BETA_4_RELEASE_NOTES.md`.

## Build

From a clean checkout of the frozen candidate:

```bash
npm ci
npm run android:beta-apk
```

Expected APK:

```text
dist/Hanab-Mobile-1.0.0-beta.4.apk
```

The build runs Expo prebuild and Gradle `:app:assembleRelease`. The GitHub Actions Android workflow
remains manual-only.

Before distribution record the exact candidate SHA, ordinary CI result, Android workflow run,
artifact ID, APK byte size, and SHA-256.

## Physical acceptance before sharing

Run the short blocker-focused maintainer gate in `BETA_4_PHYSICAL_SMOKE.md`.

At minimum verify:

1. install over `v1.0.0-beta.3-hotfix.1` without uninstalling;
2. launch/session continuity;
3. Home -> Create -> Pregame -> Live;
4. one Play, Discard, and Clue;
5. Chat/contextual menu and IME-first Android Back;
6. Rewind -> Return to Live;
7. representative Hypothetical action -> Back -> exit;
8. portrait/landscape rotation;
9. background/foreground or reconnect with no stale/duplicate gameplay send;
10. v2 Browse/Return and attendance semantics;
11. spectator sanity;
12. one clean-install sanity pass when practical.

Any crash, broken upgrade, accidental gameplay command, stale command after lifecycle/reconnect,
incorrect card identity, lost attendance, or impassable navigation blocks publication.

## Previous tester release

The currently published tester artifact remains:

- release: `v1.0.0-beta.3-hotfix.1`
- app version: `1.0.0-beta.3`
- Android `versionCode`: `4`
- runtime candidate: `36717a2284490c8179e35b882dca0bde15a14a75`
- APK: `Hanab-Mobile-1.0.0-beta.3.apk`
- APK size: `135756615` bytes
- APK SHA-256: `80543d8c8fc2573e0bca3dfc972d00af771bcdd71ca2d5bdfe507e549884a9f9`

Historical beta.3 details remain in `BETA_3_RELEASE_NOTES.md` and
`BETA_3_PHYSICAL_SMOKE.md`.

## Release policy

This remains a standalone internal APK flow. Do not silently replace a distributed APK while keeping
the same version/hash identity. Play Store signing, AAB packaging, and store release policy remain
separate work.
