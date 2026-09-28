# Android Beta Release

Planned Android tester candidate: **1.0.0-beta.3**

Build status: **runtime candidate frozen; ordinary CI passed on the exact candidate; APK build and physical-device smoke are still pending.**

## Beta.3 version identity

- version: `1.0.0-beta.3`
- Android `versionCode`: `3`
- workflow: `Android Beta APK`
- workflow artifact: `Hanab-Mobile-1.0.0-beta.3`
- expected APK: `Hanab-Mobile-1.0.0-beta.3.apk`
- runtime candidate: `fd9919bf7b764354c4f4cce75a96a90c1f2e5506`
- ordinary CI: **success — run #719 / run ID `36361502403`**
- Android workflow run: **not started**
- APK size / SHA-256: **not recorded yet**

The merge commit `fd9919bf7b764354c4f4cce75a96a90c1f2e5506` is the immutable beta.3 runtime candidate. If a later runtime fix is required, select a new candidate and rebuild. Documentation-only recording commits do not redefine the candidate binary.

## Frozen beta.2 reference

The previous tester release remains:

- version: `1.0.0-beta.2`
- Android `versionCode`: `2`
- runtime candidate: `45d99d15960d04934ea0ce07fcb90db73eb206df`
- workflow run: `#2` / run ID `35932310051`
- artifact: `Hanab-Mobile-1.0.0-beta.2` / artifact ID `10781674355`
- APK: `Hanab-Mobile-1.0.0-beta.2.apk`
- APK size: `134635991` bytes
- APK SHA-256: `17f88df7ce70e4889495cda68eca9117540bc644f3ca3ba9e0e42757de6014f8`

See `BETA_2_RELEASE_NOTES.md` for the historical tester packet.

## Beta.3 scope

Beta.3 is the pre-redesign baseline. Major additions since the frozen beta.2 runtime include:

- richer account entry points and server-status/lobby progress handling;
- native Pregame Kick / Find variant / Missing scores actions and the multi-bot picker;
- read-only Tagged games and exact tag search in History;
- stronger friend visibility and authoritative mute-state handling;
- H-group/resource-state presentation cues and server-backed gameplay presentation settings;
- Hypothetical card morph/unmorph controls;
- arbitrary JSON replay import, finished-review `/copy` export/share, and canonical replay/game/pregame
  link opening;
- specific-seed Create and History prefill;
- server-backed Reverse hands;
- supported server-backed Create-table preference persistence;
- Show turn timers in untimed games with upstream-compatible count-up semantics.

Upstream #3139 JSON replay URL visibility was sanity-checked against mobile and requires no beta.3 code
change.

Feature scope is frozen here. Chat / Messaging redesign, the major mobile shell/IA pass, richer
profiles/social/history, advanced replay tooling, and serious-player productivity work remain
post-beta.3.

Known non-blockers include:

- rapid replay scrubber jank (#4);
- compact shell/Pregame information-density redesign (#58);
- session PM dialogs are not durable cross-reconnect account history;
- this remains a standalone internal APK flow, not the Play Store/AAB pipeline.

## Build

From a clean checkout of the frozen runtime candidate:

```bash
npm ci
npm run android:beta-apk
```

Expected APK:

```text
dist/Hanab-Mobile-1.0.0-beta.3.apk
```

The build runs Expo prebuild and Gradle `:app:assembleRelease`.

## Physical acceptance before sharing

Prefer an **upgrade over beta.2** on a physical Android device:

1. install beta.3 over beta.2 without uninstalling;
2. verify launch/session continuity without Metro;
3. complete ordinary 2P/3P actions;
4. exercise Rewind / Return to Live;
5. open finished/shared replay and Hypothetical;
6. spectate and switch perspective;
7. exercise tag discovery/search;
8. verify Create preference restore/save;
9. toggle Reverse hands and untimed timers in representative live games;
10. exercise table chat and a private Dialog;
11. background/foreground once and verify no stale gameplay action fires.

Also perform at least one clean install.

Until this smoke is complete, beta.3 is a **built release candidate**, not a validated tester release.
