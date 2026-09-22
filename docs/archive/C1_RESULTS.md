# C1 Results — Physical Android NetworkSession Proof

Status: **GO**

Test date: 2026-08-30

## What C1 proved

On a physical Samsung Galaxy A55 (`SM-A556E`), the minimal Expo / React Native development build successfully used the built-in React Native networking stack to authenticate against production `hanab.live` without a cookie-management library or custom native networking code.

The proof established that:

- HTTP login can establish the production hanab.live session;
- `/test-cookie` reports the session as valid after login;
- the built-in React Native `WebSocket` can authenticate using that session and receive a valid `welcome`;
- `tableList` is received on the authenticated WebSocket;
- the HTTP session survives a true Android process force-stop and cold launch;
- a new WebSocket after cold launch authenticates without another login;
- when the app is backgrounded, the existing socket may close on this device;
- after returning to foreground, a manually opened fresh socket authenticates successfully without another login.

This removes the C1 blocker. Do not add a third-party cookie manager or a native cookie bridge for the currently proven Android path.

## Runtime matrix

```text
Expo SDK: 57.0.0 (expo package 57.0.18 during implementation report)
React Native: 0.86.3
Device: Samsung Galaxy A55 / SM-A556E
Android OS: not recorded during C1
Development build: Expo development client, physical Android build
Node: v24.19.0 during implementation report
Package manager: npm 11.17.0 during implementation report
Lockfile: package-lock.json
Architecture tested by Expo run: arm64-v8a
```

Android build prerequisites observed during the physical build included Android SDK Platform 36, Build Tools 36.0.0, NDK `27.1.12297006`, CMake `3.22.1`, and JDK 21. These are environment observations, not application-level architecture requirements unless the current Expo toolchain continues to require them.

## Scenario A — Fresh login

Observed on the physical device:

```text
POST /login: SUCCESS
/test-cookie after login: VALID
WebSocket: OPEN
welcome: YES
tableList: YES
Tables observed: 12
```

`POST /login` success was not treated as authentication proof. The valid HTTP session probe and valid WebSocket `welcome` were the proof points.

The C1 UI did not expose the session cookie or authentication secret.

## Scenario B — Cold process restart

The application was force-stopped using Android process control for package:

```text
live.hanab.mobile.c1
```

App data was not cleared.

After reopening the app without logging in again:

```text
/test-cookie: VALID
new WebSocket: OPEN
welcome: YES
```

Therefore the production hanab.live session survived the true cold process restart and remained usable for realtime authentication.

## Scenario C — Background / foreground observation

The app was backgrounded while connected.

Observed behavior:

```text
old WebSocket: CLOSED while/backgrounded
foreground: application returned normally
fresh manually opened WebSocket: OPEN
welcome on fresh socket: YES
re-login required: NO
```

The exact background duration was not recorded in the final manual report.

This was observation only. C1 did not implement automatic reconnect, backoff, AppState policy, connection epochs, or reattend behavior.

## Architectural consequence

For the Android path proven by C1:

```text
React Native fetch
        +
platform-owned HttpOnly session
        +
React Native WebSocket
        ↓
authenticated hanab.live realtime session
```

This is the preferred path until evidence proves otherwise.

The background result is also evidence that mobile lifecycle handling is necessary later: application code must not assume an OPEN socket will survive backgrounding. Reconnect remains deferred to the planned reconnect/lifecycle milestone; it should be implemented as authoritative resynchronization with the documented epoch/single-flight rules, not as command replay.

## Build validation completed before physical test

The implementation report recorded successful:

```text
npm install
npm run typecheck
npx expo-doctor
npx expo config --type public
Android Hermes export
npm ls --depth=0
git diff --check
```

The physical Android build subsequently completed and installed the debug development build on the Samsung device.

A first Android build temporarily failed at `:app:checkDebugAarMetadata` while Android toolchain components were being populated. After the required SDK/NDK/CMake components were installed, the same metadata task completed successfully and the subsequent physical build installed successfully. No networking-library workaround was introduced.

## C1 decision

**GO to C2.**

Next milestone:

```text
C2 — pinned upstream game-core + Hermes
     + strict TypeScript
     + realistic reducer/action-sequence proof
     + serializability analysis
     + mutation/immutability semantics
     + dependency/type containment
```

C1 code should remain a risk-spike reference. Do not expand it into reconnect, lobby, or game architecture as part of closing C1.
