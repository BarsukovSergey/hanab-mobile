# Android Beta Release

Current Android tester candidate: **1.0.0-beta.2**

Frozen beta.2 candidate commit:

`45d99d15960d04934ea0ce07fcb90db73eb206df`

Android `versionCode`: **2**

Manual GitHub Actions build: **Android Beta APK run #2** (artifact identity is finalized in [`BETA_2_RELEASE_NOTES.md`](./BETA_2_RELEASE_NOTES.md)).

The binary identity is the candidate commit above plus the exact produced APK hash. Documentation-only commits after that candidate do **not** redefine the beta.2 binary.

## Beta.2 scope

Beta.2 intentionally batches the accumulated post-beta.1 product work instead of trying to empty the entire backlog.

Major areas included:

- dense real-card 4P–6P layout improvements and physical-fit fixes;
- spectator perspective switching and spectator presentation fixes;
- card-presentation settings including colorblind/styled-number modes;
- lobby/pregame information and social improvements;
- Friends history and same-seed Other Scores;
- game tags and shared-replay creation/suggestion flows;
- table-chat unread state and direct-reply correctness;
- first-class session PM dialogs from People/Pregame/live-game user context;
- focused Rewind, Hypothetical, note, clue and card-presentation fixes.

Known non-blockers:

- rapid replay scrubber jank remains tracked in GitHub issue #4;
- compact shell/Pregame information-density redesign remains tracked in issue #58;
- `/copy` replay export is intentionally deferred;
- broader account-management UX remains future product work;
- this remains a standalone internal APK flow, not the Play Store/AAB pipeline.

See [`BETA_2_RELEASE_NOTES.md`](./BETA_2_RELEASE_NOTES.md) for tester-facing notes.

## Build

From a clean checkout of the frozen candidate:

```bash
npm ci
npm run android:beta-apk
```

Expected APK:

```text
dist/Hanab-Mobile-1.0.0-beta.2.apk
```

The build runs Expo prebuild and Gradle `:app:assembleRelease`. It is intended for direct internal APK installation, not Play Store submission.

## Acceptance before sharing

Prefer validating beta.2 as an **upgrade over beta.1** on a physical Android device:

1. confirm beta.1 is currently installed;
2. install beta.2 over it without uninstalling;
3. launch without Metro/development tooling;
4. verify expected authenticated/session continuity;
5. enter a normal 2P/3P table and complete ordinary actions;
6. exercise Rewind and Return to Live;
7. open a finished/shared replay and a relevant Hypothetical path;
8. enter a spectator session and switch perspective;
9. exercise table chat and a session PM dialog;
10. background/foreground once and confirm no stale gameplay action fires.

Also perform at least one clean install before wider distribution.

## Historical beta.1 reference

The previously distributed beta.1 remains frozen at:

- version: `1.0.0-beta.1`;
- Android `versionCode`: `1`;
- commit: `d297ad71153095f18fba3101f760e306ed69e214`;
- artifact: `Hanab-Mobile-1.0.0-beta.1.apk`.

That historical identity remains useful when reproducing beta.1 tester reports.
