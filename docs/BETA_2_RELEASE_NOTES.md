# Hanab Mobile 1.0.0-beta.2

Date: **2026-09-24**

Status: **prerelease published and APK distributed to testers; physical-device smoke not formally recorded**

## Frozen candidate

- version: `1.0.0-beta.2`
- Android `versionCode`: `2`
- candidate commit: `45d99d15960d04934ea0ce07fcb90db73eb206df`
- ordinary CI on candidate: **success** (run #608 / run ID `35932060039`)
- Android workflow: `Android Beta APK`
- Android workflow run: **success** (run #2 / run ID `35932310051`)
- workflow artifact: `Hanab-Mobile-1.0.0-beta.2`
- artifact ID: `10781674355`
- artifact ZIP size: `40192228` bytes
- artifact ZIP SHA-256: `375c93551ce1ec17d7818469567fd416aa39d525691bac7c29ca239f85f01c94`
- APK filename: `Hanab-Mobile-1.0.0-beta.2.apk`
- APK byte size: `134635991`
- APK SHA-256: `17f88df7ce70e4889495cda68eca9117540bc644f3ca3ba9e0e42757de6014f8`

The workflow artifact metadata reports `head_sha = 45d99d15960d04934ea0ce07fcb90db73eb206df`, matching the frozen candidate.

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
- first-class game tag display/Add action.

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

- normal 2P/3P play and explicit Play/Discard safety;
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

- GitHub prerelease: `v1.0.0-beta.2`
- prerelease published: **2026-09-24**
- APK distributed to testers: **2026-09-24**
- runtime candidate and APK identity remain frozen exactly as recorded above

Physical upgrade-over-beta.1 and clean-install smoke have **not** been formally recorded as completed. Treat tester feedback against the frozen build identity above; do not replace the distributed APK under the same version/hash.
