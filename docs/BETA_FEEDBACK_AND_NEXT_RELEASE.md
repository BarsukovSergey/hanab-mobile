# Beta feedback triage and next tester release

> **Historical beta.4 plan.** The current next tester candidate is `1.0.0-rc.1`; see [RC_1_RELEASE.md](./RC_1_RELEASE.md) for its release gate. Beta.4 was not physically accepted or published.

Date: 2026-10-07

Status: maintainer guidance for the published `1.0.0-beta.3-hotfix.1` tester artifact and the
planned `1.0.0-beta.4` Android tester build.

## Frozen previous tester reference

The currently distributed APK remains frozen at:

- release: `v1.0.0-beta.3-hotfix.1`;
- app version: `1.0.0-beta.3`;
- Android `versionCode`: `4`;
- runtime candidate: `36717a2284490c8179e35b882dca0bde15a14a75`;
- APK: `Hanab-Mobile-1.0.0-beta.3.apk`;
- APK SHA-256: `80543d8c8fc2573e0bca3dfc972d00af771bcdd71ca2d5bdfe507e549884a9f9`.

Never redefine that binary with later `main` state.

## Beta.4 purpose

Beta.4 is a tester checkpoint after the Mobile App Design v2 implementation and recent
runtime/replay/upstream-parity work. It is intentionally released before Slice 12 is exhaustive so
real testers can supply broader physical-device, accessibility, landscape, and lifecycle evidence.

Do not add unrelated features to the release-prep branch. Confirmed blocker fixes discovered during
the maintainer smoke require a new frozen candidate and rebuild.

## Versioning contract

Keep all release-facing locations synchronized:

- `package.json` version = `1.0.0-beta.4`;
- root/package entry versions in `package-lock.json` = `1.0.0-beta.4`;
- `app.json` Expo version = `1.0.0-beta.4`;
- `app.json` Android `versionCode` = `5`;
- `.github/workflows/android-beta.yml` artifact name = `Hanab-Mobile-1.0.0-beta.4`.

The build script derives the APK filename from `app.json`.

Expected APK:

```text
dist/Hanab-Mobile-1.0.0-beta.4.apk
```

## Candidate and build

After the release-prep PR is squash-merged:

1. record the exact merge SHA as the beta.4 candidate;
2. require ordinary CI success on that exact candidate;
3. manually run the Android Beta APK workflow for that candidate;
4. download the artifact and record its ID, byte size, and SHA-256;
5. do not change runtime code without choosing a new candidate and rebuilding.

The Android workflow stays `workflow_dispatch` only.

## Maintainer physical gate

Use `BETA_4_PHYSICAL_SMOKE.md`. The gate is intentionally short and blocker-focused. It must cover
upgrade-over-beta.3-hotfix.1, ordinary gameplay, v2 Browse/Return/attendance, Chat/IME Back,
Rewind/Hypothetical, rotation/landscape, background/reconnect no-replay safety, spectator sanity, and
a clean-install sanity pass when practical.

Do not claim physical validation unless the exact candidate APK was actually used on-device.

## Tester distribution

After the maintainer gate passes, publish the exact tested APK as a GitHub prerelease and tell
testers to report:

- beta version / candidate when known;
- device model and Android version;
- gesture or three-button navigation;
- system font scale;
- expected versus observed behavior;
- reproduction frequency;
- screenshot/video when useful.

Spread Slice 12 coverage across testers: smaller/A55-class phones, tablet, 2P/3P/4P/6P, portrait and
both landscape orientations, large fonts, player/spectator, Rewind/Review/Hypothetical, notes,
Chat/Conversation, IME, rotation, background, and reconnect.

## Artifact identity

Before sending the APK to testers, record in `BETA_4_RELEASE_NOTES.md` and
`BETA_4_PHYSICAL_SMOKE.md`:

- marketing version and Android `versionCode`;
- exact runtime candidate SHA;
- ordinary CI run/result;
- Android workflow run/result and artifact ID;
- APK filename, byte size, and SHA-256;
- maintainer smoke result;
- GitHub prerelease/tag.

Never replace an already distributed APK while keeping the same recorded version/hash identity.

## Relationship to store work

This remains the standalone internal APK flow. AAB packaging, store signing, Play Console policy, and
production release versioning remain separate work.
