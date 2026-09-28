# Hanab Mobile 1.0.0-beta.3

Date: **2026-09-28**

Status: **GitHub prerelease published; physical-device validation pending**

## Candidate identity

- version: `1.0.0-beta.3`
- Android `versionCode`: `3`
- runtime candidate: `fd9919bf7b764354c4f4cce75a96a90c1f2e5506`
- ordinary CI: **success — run #719 / run ID `36361502403`**
- Android workflow: `Android Beta APK`
- Android workflow run: **success — #3 / run ID `36361833453`**
- workflow artifact: `Hanab-Mobile-1.0.0-beta.3`
- artifact ID: `10945838465`
- APK filename: `Hanab-Mobile-1.0.0-beta.3.apk`
- APK byte size: `135761383`
- APK SHA-256: `37daceaaac21c4867825876ff19e549654e5ae56f17c75482d08d1fcec92abcf`
- GitHub release: `v1.0.0-beta.3` / release ID `397876619`
- release asset ID: `594109178`
- published: `2026-09-28T00:46:57Z`

The runtime candidate is `fd9919bf7b764354c4f4cce75a96a90c1f2e5506`. Android workflow #3 ran from docs-only descendant `3d75474b92b7626086b1d55905f91dbbf5922f58`; the runtime content is equivalent to the candidate. A subsequent runtime fix requires a new candidate and rebuild.

## What changed since beta.2

### Lobby, Pregame, account, and social

- native Pregame Kick, Find variant, and Missing scores actions;
- multi-bot Create/Pregame picker with transient protected-table password handling;
- stronger friend visibility in People/Lobby;
- account creation clarification plus Change password / Forgot password entry points;
- server maintenance/shutdown and lobby table-progress presentation;
- authoritative table-chat read acknowledgement and mute-state guarding.

### History, tags, and replay

- read-only Tagged games for the authenticated user;
- exact tag search with the upstream read-only API;
- arbitrary JSON replay import;
- finished-review replay export/share (`/copy` equivalent);
- canonical replay, running-game, and pregame link opening;
- specific-seed Create and History `Play this seed` prefill;
- upstream #3139 replay URL visibility parity verified with no mobile code change.

### Gameplay and settings

- additional pinned-upstream H-group/resource-state presentation cues;
- server-backed Reverse hands;
- supported server-backed Create-table preference persistence;
- Show turn timers in untimed games, including authoritative untimed clock ingestion and count-up
  presentation;
- Hypothetical card morph/unmorph controls.

## Known limitations / intentionally deferred

- rapid replay scrubber movement may still show visible jank (#4);
- app-shell/Pregame information-density redesign remains in the major Mobile App Design pass (#58);
- private Dialog history remains session-local today; durable Chats/Messages is a design/backlog item;
- richer profiles/social/history, advanced replay annotations/sounds, and serious-player productivity
  tools remain post-beta.3;
- this APK is for direct tester installation and is not a Play Store/AAB release.

## What testers should focus on

Prefer installing beta.3 **over beta.2 without uninstalling**.

Please especially exercise:

- normal 2P/3P play and explicit Play/Discard safety;
- Rewind / Return to Live;
- finished/shared replay and Hypothetical;
- spectator mode and perspective switching;
- Tagged games and exact tag search;
- Create-table preference restore/save;
- Reverse hands and untimed timer presentation;
- table chat and private Dialogs;
- background/foreground and reconnect behavior;
- one clean-install launch in addition to the upgrade path.

Report the build version, device model, Android version, and the first point where behavior became
confusing or incorrect.

## Distribution record

GitHub prerelease is published with the exact checksum-verified APK. Physical smoke remains pending before treating beta.3 as a validated tester release.
