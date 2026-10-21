# Hanab Mobile

Mobile Hanabi client focused on serious live play on phones.

The currently published Android tester artifact is **v1.0.0-beta.3-hotfix.1**. The next candidate is **1.0.0-rc.1** / Android `versionCode` 6; it must pass physical smoke before public distribution.

C17 is the gameplay UX baseline, built around a dense table view plus a decision workspace.

## For testers

If someone sent you an Android build/APK, you do **not** need to build the project from source. Install the build you were given and follow [`TESTING.md`](./TESTING.md).

Please test the app as a player, not as someone trying to guess how the UI was implemented. If an action is hard to discover or a screen is confusing without instructions, report that as a UX problem.

RC.1 build identity and the short maintainer release gate are tracked in [`docs/RC_1_RELEASE.md`](./docs/RC_1_RELEASE.md). Beta.4 was never physically accepted or distributed. The published beta.3 hotfix remains frozen in [`docs/BETA_3_PHYSICAL_SMOKE.md`](./docs/BETA_3_PHYSICAL_SMOKE.md).

## Current test focus

RC.1 is the first planned public tester line carrying the implemented Mobile App Design v2 shell. Testing remains centered on reliable serious play/review plus physical hardening of the new navigation and responsive surfaces:

- card selection and explicit Play/Discard actions;
- notes, clue planning, knowledge/empathy and discard inspection;
- Last Action / Recent and live rewind;
- finished/shared replay and Hypothetical;
- spectator and lifecycle behavior;
- Android safe-area, rotation, keyboard and reconnect behavior;
- focused 4P–6P real-card layout regression on supported phone layouts;
- social/history additions shipped after beta.1.

Mobile App Design v2 is implemented through the current product slices; Slice 12 physical hardening / accessibility / performance is the active validation milestone. RC.1 tester feedback is intended to broaden that device evidence before Slice 13 cleanup.

See [`TESTING.md`](./TESTING.md) for the short player-facing test script and bug-report format.

## Development setup

Prerequisites:

- Node.js 24 (see `.nvmrc`, matching CI);
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

The APK is written to `dist/Hanab-Mobile-1.0.0-rc.1.apk`. This internal beta uses the generated Expo/React Native release signing setup and is **not** the Play Store signing pipeline.

Normal local validation:

```bash
npm run validate
git diff --check
```

`npm run validate` runs the strict TypeScript check and the Jest suite. CI runs the same checks explicitly. There is no lint script.

## Project documentation

- Testers: start with [`TESTING.md`](./TESTING.md).
- RC.1 release gate: [`docs/RC_1_RELEASE.md`](./docs/RC_1_RELEASE.md).
- Beta.4 maintainer smoke: [`docs/BETA_4_PHYSICAL_SMOKE.md`](./docs/BETA_4_PHYSICAL_SMOKE.md).
- Android beta build/release guidance: [`docs/ANDROID_BETA_RELEASE.md`](./docs/ANDROID_BETA_RELEASE.md).
- Product roadmap: [`docs/PRODUCT_ROADMAP.md`](./docs/PRODUCT_ROADMAP.md).
- Ratified mobile design v2: [`docs/MOBILE_APP_DESIGN_V2.md`](./docs/MOBILE_APP_DESIGN_V2.md).
- Maintainers: [`docs/README.md`](./docs/README.md) is the documentation map and marks current authority versus historical snapshots.
