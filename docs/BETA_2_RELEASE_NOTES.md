# Hanab Mobile 1.0.0-beta.2

Date: **2026-09-24**

Status: **release candidate build in progress**

## Frozen candidate

- version: `1.0.0-beta.2`
- Android `versionCode`: `2`
- candidate commit: `45d99d15960d04934ea0ce07fcb90db73eb206df`
- GitHub Actions workflow: `Android Beta APK`
- workflow run: `#2` / run ID `35932310051`
- workflow artifact name: `Hanab-Mobile-1.0.0-beta.2`
- expected APK filename: `Hanab-Mobile-1.0.0-beta.2.apk`
- APK byte size: **pending**
- APK SHA-256: **pending**

The candidate SHA above defines the runtime code for beta.2. Later documentation-only commits do not redefine the binary.

## What changed since beta.1

Beta.2 is a broad tester refresh rather than a single-feature build.

### Gameplay and presentation

- improved dense real-card 4P–6P allocation and physical phone fit;
- improved clue readability/discoverability and dense clue composition;
- spectator perspective switching between all hands and authoritative player views;
- several card-border, spectator-label, note-editor, Hypothetical clipping and Rewind-coordinate fixes;
- generated upstream-backed card presentation modes with mobile settings for supported appearance options.

### Lobby and Pregame

- clearer lobby sectioning with the authenticated user's running game kept prominent;
- richer table details and player roster presentation;
- authoritative Pregame player stats and spectator list;
- upstream-compatible random table names for blank table creation;
- friend-aware lobby discovery.

### History and shared review

- Friends history;
- same-seed Other Scores comparison;
- shared replay creation from History;
- shared-replay turn suggestion receive/UI;
- first-class game tag action.

### Chat and social

- contextual Friend/Unfriend and private-message actions;
- first-class session PM dialog showing live private messages with one user during the current realtime connection;
- PM dialog entry points for live-game players and spectators through the Game menu;
- live table-chat unread indicator/direct-open flow;
- direct submitted `/r <message>` reply command now works correctly.

## Known limitations / intentionally deferred

- rapid replay scrubber movement may still show visible jank; tracked in issue #4;
- compact mobile shell/Pregame information-density polish is still future work; tracked in issue #58;
- `/copy` replay export is intentionally deprioritized;
- account-management UX remains limited;
- richer profiles/social, bot picker, advanced replay annotations/sounds, JSON import and optional gesture workflows remain post-beta work;
- this APK is for direct tester installation and is not a Play Store/AAB release.

## What testers should focus on

Prefer installing beta.2 **over beta.1 without uninstalling**.

Please especially exercise:

- normal 2P/3P play;
- at least one 4P–6P game if a group is available;
- Rewind and Return to Live;
- finished/shared replay and Hypothetical;
- spectator mode and perspective switching;
- History, Friends history and Other Scores;
- table chat and private Dialogs;
- background/foreground and reconnect behavior;
- rotation, keyboard and Android system-inset behavior.

Report the build version, device model, Android version and the first point where behavior became confusing or incorrect.

## Distribution record

Do not mark this candidate as distributed until the workflow completes successfully and the exact APK hash is recorded above.
