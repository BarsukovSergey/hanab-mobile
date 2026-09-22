# Hanab Mobile

Mobile Hanabi client focused on serious live play on phones.

The current development line is **C17**, a gameplay UX redesign built around a dense table view plus a reserved decision workspace. The branch is still under active development and should be treated as a test build, not a finished release.

## For testers

If someone sent you an Android build/APK, you do **not** need to build the project from source. Install the build you were given and follow [`TESTING.md`](./TESTING.md).

Please test the app as a player, not as someone trying to guess how the UI was implemented. If an action is hard to discover or a screen is confusing without instructions, report that as a UX problem.

## Current test focus

The main C17 areas being validated are:

- dense 5P/6P live gameplay;
- card selection and explicit Play/Discard actions;
- Last Action / Recent actions;
- live rewind/history without leaving the active game;
- notes, clue planning, knowledge/empathy and discard inspection as those slices land;
- Android safe-area, rotation, keyboard and reconnect behavior.

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

Release variant:

```bash
npm run android:release
```

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
