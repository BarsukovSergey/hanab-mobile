# Beta.4 physical smoke

Date: **2026-10-07**

Status: **waiting for the frozen beta.4 APK**

Version: `1.0.0-beta.4`

Android `versionCode`: `5`

Runtime candidate: **TBD**

APK: `Hanab-Mobile-1.0.0-beta.4.apk`

APK byte size: **TBD**

APK SHA-256: **TBD**

This is the maintainer release gate before beta.4 is sent to the broader tester group. It is a short
blocker-focused smoke, not the full Slice 12 device matrix.

## Before installing

Record:

- candidate SHA:
- Android workflow run:
- device model:
- Android version:
- navigation mode: gesture / three-button
- system font scale:
- currently installed Hanab version:
- downloaded APK byte size:
- downloaded APK SHA-256:

## 1. Upgrade / launch

Prefer installing over `v1.0.0-beta.3-hotfix.1` without uninstalling.

- [ ] Android accepts the upgrade.
- [ ] App launches without Metro/development tooling.
- [ ] Existing account/session behavior is sane.
- [ ] The app reports `1.0.0-beta.4`.

Failure here blocks distribution.

## 2. Browse / room ownership

- [ ] Home, History, People, and More are reachable while browsing.
- [ ] Create Table opens as a dedicated task.
- [ ] Join/create a Pregame and verify focused room presentation has no global bottom navigation.
- [ ] Browse away using the explicit room browsing action and Return to the attended room.
- [ ] Browse/Return does not Leave, Unattend, or Stop watching.

## 3. Ordinary live gameplay

In a normal 2P or 3P game:

- [ ] Play one legal card.
- [ ] Discard one legal card.
- [ ] Give one clue.
- [ ] Play/Discard remain explicit commit actions.
- [ ] Turn, hand, clues, strikes, and deck presentation update from authoritative actions.
- [ ] No duplicate gameplay command is sent.

Any accidental or duplicate gameplay send blocks distribution.

## 4. Chat / menu / keyboard

- [ ] Open Chat/Conversation from the focused room.
- [ ] Send and receive one table-chat message.
- [ ] Open the contextual room/game menu and return to the game.
- [ ] With the keyboard open, the first Android Back dismisses the IME instead of leaving the room.
- [ ] Opening/closing Conversation does not alter attendance.

## 5. Rewind / Hypothetical

- [ ] Enter Rewind and inspect an earlier segment.
- [ ] No live gameplay command is emitted while reviewing.
- [ ] Return to Live shows the current authoritative state.
- [ ] Enter a representative Hypothetical.
- [ ] Perform one hypothetical action, Back once, then exit.
- [ ] Hypothetical actions remain local/shared-replay actions and do not become live gameplay sends.

## 6. Rotation / landscape

- [ ] Rotate portrait -> landscape -> the other landscape orientation where practical -> portrait.
- [ ] Required gameplay controls remain reachable.
- [ ] Chat/menu remain usable in landscape.
- [ ] Rotation does not fire an armed/stale Play, Discard, or Clue.

## 7. Background / reconnect safety

During live play:

- [ ] Begin an interaction but do not confirm/send it.
- [ ] Background and foreground the app.
- [ ] Allow reconnect/recovery if it occurs.
- [ ] Current authoritative state wins.
- [ ] No old gameplay command is queued, retried, or replayed.
- [ ] No stale callback mutates the current room/game state.

Any stale gameplay send blocks distribution.

## 8. Android Back / attendance

As both player and spectator when practical:

- [ ] Bare Back in focused Pregame/Live is consumed according to the v2 contract.
- [ ] Leaving/Unattending/Stop watching requires an explicit action.
- [ ] No ordinary Back path silently changes authoritative attendance.

## 9. Spectator sanity

- [ ] Spectate one live game.
- [ ] Switch perspective and return to the normal spectator view.
- [ ] Participant-only gameplay actions are not accidentally available.
- [ ] Browse/Return preserves spectator attendance until explicitly stopped.

## 10. Clean-install sanity

After the upgrade-path check, perform one clean install if practical:

- [ ] Fresh install launches.
- [ ] Login/account selection works.
- [ ] Lobby/Home hydration succeeds.
- [ ] Create/join reaches Pregame and Live.

## Maintainer result

- [ ] PASS — publish the exact tested APK to beta testers.
- [ ] BLOCKED — fix the release/runtime defect, choose a new candidate, rebuild, and repeat.
- [ ] PASS WITH KNOWN NON-BLOCKER — only an already accepted limitation was observed.

Record any failure with exact step, device/Android version, navigation mode, font scale, expected
behavior, observed behavior, and screenshot/video when useful.

## Tester expansion after publication

The broader tester group supplies the rest of Slice 12 evidence. Spread coverage rather than asking
every tester to run everything:

- smaller phone / A55-class phone / tablet;
- portrait and both phone landscape orientations;
- 2P / 3P / 4P / 6P;
- font scales around 1.0 / 1.3 / 1.5 / 2.0;
- gesture and three-button navigation;
- player and spectator;
- Rewind / Review / Hypothetical;
- notes and Chat / Conversation;
- IME, rotation, background/foreground, and reconnect.

High-priority reports are crashes, clipped required controls, accidental gameplay sends, stale state,
wrong card identity, lost attendance, or inability to understand whether the app is browsing,
focused in a room, Live, or reviewing history.
