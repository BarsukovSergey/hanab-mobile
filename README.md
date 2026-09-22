# Hanab Mobile

Mobile Hanabi client focused on serious live play on phones.

The current Android test build is **1.0.0-beta.1**. C17 is the gameplay UX baseline, built around a dense table view plus a decision workspace.

## For testers

If someone sent you an Android build/APK, you do **not** need to build the project from source. Install the build you were given and follow [`TESTING.md`](./TESTING.md).

Please test the app as a player, not as someone trying to guess how the UI was implemented. If an action is hard to discover or a screen is confusing without instructions, report that as a UX problem.

## Current test focus

The first Android beta is certified around **2P/3P** gameplay and review flows:

- card selection and explicit Play/Discard actions;
- notes, clue planning, knowledge/empathy and discard inspection;
- Last Action / Recent and live rewind;
- finished/shared replay and Hypothetical;
- spectator and lifecycle behavior;
- Android safe-area, rotation, keyboard and reconnect behavior.

**4P–6P dense layout is not part of this beta acceptance scope.** Its current Compact Overview / summary-icon presentation is known unfinished work.

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

The APK is written to `dist/Hanab-Mobile-1.0.0-beta.1.apk`. This internal beta uses the generated Expo/React Native release signing setup and is **not** the Play Store signing pipeline.

Validation used in CI:

```bash
npm run typecheck
npm test
```

## Project documentation

Most files under `docs/` are development/product documents, not tester onboarding:

- `docs/C17_UX_CONTRACT.md` — authoritative C17 product contract;
- `docs/C17_UX_DECISIONS.md` — ratified UX decisions;
- `docs/C17_VALIDATION.md` — developer/physical acceptance gates;
- `docs/C17_EVIDENCE.md` — physical observations and defect history;
- `docs/ARCHITECTURE.md` — architecture and authority boundaries.

For ordinary external testing, start with [`TESTING.md`](./TESTING.md), not the internal C17 documents.
