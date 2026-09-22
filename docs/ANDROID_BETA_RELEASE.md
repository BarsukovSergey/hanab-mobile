# Android Beta Release

Current internal beta: **1.0.0-beta.1**

Distributed beta build commit: `d297ad71153095f18fba3101f760e306ed69e214`

The APK built from that commit is the frozen beta.1 test artifact. Documentation-only changes after that commit do not redefine the distributed binary; code/build changes intended for testers should ship as the next beta version.

During the active tester window, classify incoming reports and prepare any later tester build using [`BETA_FEEDBACK_AND_NEXT_RELEASE.md`](./BETA_FEEDBACK_AND_NEXT_RELEASE.md).

## Scope

The first beta acceptance target is Android **2P/3P** gameplay and lifecycle coverage.

Included:
- normal live play and direct actions
- notes, clue planning and empathy/knowledge
- live Rewind
- finished and shared replay
- Hypothetical
- spectator flow
- chat/PM parity except `/copy`

Known non-blockers:
- 4P–6P dense layout / Compact Overview is not accepted as final UX and is outside this beta gate
- rapid replay scrubber jank is tracked separately
- `/copy` is deferred

## Build

From a clean checkout:

```bash
npm ci
npm run android:beta-apk
```

Expected artifact:

```text
dist/Hanab-Mobile-1.0.0-beta.1.apk
```

The build runs Expo prebuild and Gradle `:app:assembleRelease`. It is intended for direct internal APK installation, not Play Store submission.

## Acceptance before sharing

Record the exact commit SHA, then verify on a physical Android device:

1. clean install or upgrade succeeds
2. app launches without Metro or a development machine
3. login succeeds
4. enter a 2P/3P table and complete ordinary gameplay actions
5. enter/exit Rewind
6. open finished/shared replay and Hypothetical
7. enter one spectator session
8. background/foreground once and confirm no stale gameplay action fires

If these pass, the APK is suitable for the first internal beta.
