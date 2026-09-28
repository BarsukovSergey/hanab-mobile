# Beta feedback triage and next tester release

Date: 2026-09-28

Status: maintainer guidance for the frozen `1.0.0-beta.2` tester line and the planned
`1.0.0-beta.3` Android tester build.

## Frozen beta.2 reference

The previously distributed tester APK remains frozen at:

- version: `1.0.0-beta.2`;
- Android `versionCode`: `2`;
- runtime candidate: `45d99d15960d04934ea0ce07fcb90db73eb206df`;
- APK: `Hanab-Mobile-1.0.0-beta.2.apk`;
- APK SHA-256: `17f88df7ce70e4889495cda68eca9117540bc644f3ca3ba9e0e42757de6014f8`.

Documentation-only commits after that runtime candidate do not redefine the beta.2 binary.

## Beta.3 scope freeze

Beta.3 feature scope is frozen. The intended runtime line includes the small independent slices
completed through PR #133 plus the reconciled planning state in PR #134. Do not add new product
features to the candidate.

Only confirmed correctness/safety regressions should change runtime code before the beta.3 candidate
is frozen. UX ideas and feature requests belong in the post-beta design/backlog unless they are
required to make the candidate usable.

## Versioning contract

For `1.0.0-beta.3`, keep all release-facing version locations synchronized:

- `package.json` version;
- the root/package entry versions in `package-lock.json`;
- `app.json` Expo version;
- `app.json` Android `versionCode` = `3`;
- `.github/workflows/android-beta.yml` artifact name.

The local build script derives the APK filename from `app.json`. The workflow artifact name is
hard-coded separately and must match the intended beta version.

Expected APK filename:

```text
dist/Hanab-Mobile-1.0.0-beta.3.apk
```

## Candidate commit

The release-prep merge commit becomes the beta.3 runtime candidate unless a subsequent runtime fix is
required.

Before building:

1. record the exact candidate SHA;
2. verify all intended runtime work is merged and no unrelated experimental branch is included;
3. require ordinary CI to pass on the candidate code line;
4. treat the candidate SHA as immutable for the produced APK;
5. if runtime code changes afterward, choose a new candidate SHA and rebuild.

A later documentation-only commit may record the candidate/build identity without redefining the
runtime binary.

## Build

Keep the Android beta workflow manual-only.

Local equivalent:

```bash
npm ci
npm run android:beta-apk
```

The GitHub Actions workflow must remain `workflow_dispatch` only unless CI policy is deliberately
changed.

## Upgrade-over-beta.2 validation

Validate beta.3 as an upgrade, not only as a clean install.

On a physical Android device with beta.2 already installed:

1. install beta.3 over beta.2 without uninstalling;
2. confirm Android accepts the upgrade, proving package/signing/versionCode continuity;
3. launch without Metro/development tooling;
4. verify expected authenticated/session continuity;
5. create or join a normal 2P/3P table and complete ordinary actions;
6. exercise Rewind and Return to Live;
7. open finished replay, shared review, and a relevant Hypothetical path;
8. enter spectator mode and switch perspective;
9. exercise History tag discovery / exact tag search;
10. verify supported Create-table preferences restore and save correctly;
11. verify Reverse hands and Show turn timers in untimed games;
12. exercise table chat and a private Dialog;
13. background/foreground once and confirm no stale gameplay action fires.

Also perform at least one clean install before distribution.

For 4P–6P, one focused physical sanity pass is still useful because beta.3 inherits the dense C17
layout from beta.2, but beta.3 does not reopen layout redesign as release scope.

## Artifact identity

Before sending the APK to testers, record:

- marketing version;
- Android `versionCode`;
- exact runtime candidate SHA;
- ordinary CI result;
- Android workflow run ID/result;
- artifact name and artifact ID;
- APK filename;
- APK byte size;
- APK SHA-256;
- build source/date;
- short tester-facing release notes.

Never replace an already distributed APK while keeping the same recorded version/hash identity.

## Distribution notes

Tell testers:

- install beta.3 over beta.2 when possible;
- the exact version they should see;
- the main changes since beta.2;
- the remaining known limitations;
- the areas that deserve focused regression testing;
- to include build/version, device model, Android version, and reproduction steps in reports.

## Relationship to Play Store work

This remains the standalone internal APK flow. AAB packaging, store signing, Play Console policy, and
production release versioning remain separate post-beta work.
