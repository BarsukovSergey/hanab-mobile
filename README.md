# Hanab Mobile

Mobile Hanabi client focused on serious live play on phones.

The current Android tester line is **1.0.0-beta.3**. Hotfix 1 is published as `v1.0.0-beta.3-hotfix.1` from runtime candidate `36717a2284490c8179e35b882dca0bde15a14a75`; focused physical re-smoke is still required before marking beta.3 PASS.

C17 is the gameplay UX baseline, built around a dense table view plus a decision workspace.

## For testers

If someone sent you an Android build/APK, you do **not** need to build the project from source. Install the build you were given and follow [`TESTING.md`](./TESTING.md).

Please test the app as a player, not as someone trying to guess how the UI was implemented. If an action is hard to discover or a screen is confusing without instructions, report that as a UX problem.

Beta.3 hotfix identity and current validation state are tracked in [`docs/BETA_3_PHYSICAL_SMOKE.md`](./docs/BETA_3_PHYSICAL_SMOKE.md). The previous beta.2 identity remains frozen in [`docs/BETA_2_RELEASE_NOTES.md`](./docs/BETA_2_RELEASE_NOTES.md).

## Current test focus

The Android beta remains centered on reliable serious play and review flows:

- card selection and explicit Play/Discard actions;
- notes, clue planning, knowledge/empathy and discard inspection;
- Last Action / Recent and live rewind;
- finished/shared replay and Hypothetical;
- spectator and lifecycle behavior;
- Android safe-area, rotation, keyboard and reconnect behavior;
- focused 4P–6P real-card layout regression on supported phone layouts;
- social/history additions shipped after beta.1.

The post-beta mobile shell/IA redesign is now specified in [`docs/MOBILE_APP_DESIGN_V2.md`](./docs/MOBILE_APP_DESIGN_V2.md) and is the next major implementation milestone; it is intentionally separate from the frozen beta.3 tester baseline.

See [`TESTING.md`](./TESTING.md) for the short player-facing test script and bug-report format.

## Development setup

Prerequisites:

- Node.js compatible with the checked-in Expo/React Native toolchain;
- Android Studio / Android SDK for local Android builds;
- an Android device or emulator.

Install dependencies:

```bash
npm ci
```

Start the Expo dev client:

```bash
npm start
```

Build/run Android locally:

```bash
npm run android
```

Install a release variant on a connected Android device:

```bash
npm run android:release
```

Build the standalone internal beta APK:

```bash
npm run android:beta-apk
```

The APK is written to `dist/Hanab-Mobile-1.0.0-beta.3.apk`. This internal beta uses the generated Expo/React Native release signing setup and is **not** the Play Store signing pipeline.

Validation used in CI:

```bash
npm run typecheck
npm test
```

## Project documentation

- Testers: start with [`TESTING.md`](./TESTING.md).
- Beta.2 release notes: [`docs/BETA_2_RELEASE_NOTES.md`](./docs/BETA_2_RELEASE_NOTES.md).
- Android beta build/release guidance: [`docs/ANDROID_BETA_RELEASE.md`](./docs/ANDROID_BETA_RELEASE.md).
- Product roadmap: [`docs/PRODUCT_ROADMAP.md`](./docs/PRODUCT_ROADMAP.md).
- Ratified mobile design v2: [`docs/MOBILE_APP_DESIGN_V2.md`](./docs/MOBILE_APP_DESIGN_V2.md).
- Maintainers: [`docs/README.md`](./docs/README.md) is the documentation map and marks current authority versus historical snapshots.
