# Beta.3 physical smoke

Date: 2026-09-28

Status: initial beta.3 physical smoke found Android UI blockers; hotfix 1 is published and awaits a focused re-smoke.

Initial runtime candidate: `fd9919bf7b764354c4f4cce75a96a90c1f2e5506`

Initial Android workflow run: `#3` / run ID `36361833453`

Initial APK SHA-256: `37daceaaac21c4867825876ff19e549654e5ae56f17c75482d08d1fcec92abcf`

## Beta.3 hotfix 1

Runtime candidate: `36717a2284490c8179e35b882dca0bde15a14a75`

Exact-candidate CI: run `#724` / run ID `36366120596` — success.

Publisher run: `36366347391` — success.

Release: `v1.0.0-beta.3-hotfix.1`

App version remains `1.0.0-beta.3`; Android `versionCode` is `4`.

APK: `Hanab-Mobile-1.0.0-beta.3.apk`

APK byte size: `135756615`

APK SHA-256: `80543d8c8fc2573e0bca3dfc972d00af771bcdd71ca2d5bdfe507e549884a9f9`

The initial physical smoke confirmed the main gameplay path was otherwise usable but found three
Android UI regressions:

- live-game `More` opened with its action area collapsed, which also made in-game Settings/Lobby
  unreachable through that menu;
- the narrow-screen Lobby hero compressed its title/detail into unusable wrapping;
- Pregame Max players had regressed from direct `2–6` choices to a plus/minus stepper.

Hotfix 1 addresses those three regressions. Android Back was observed working and is not part of this
hotfix. A focused install-over re-smoke of the hotfix APK is still required before marking beta.3 PASS.

## Before installing

Record:

- device model:
- Android version:
- currently installed Hanab version:
- downloaded APK filename: `Hanab-Mobile-1.0.0-beta.3.apk`
- downloaded APK byte size: `135756615`
- downloaded APK SHA-256: `80543d8c8fc2573e0bca3dfc972d00af771bcdd71ca2d5bdfe507e549884a9f9`

For the hotfix re-smoke, install this APK directly over the already-installed initial beta.3 build;
Android `versionCode` 4 is intentionally higher than the initial beta.3 `versionCode` 3. If separately
repeating the beta.2 upgrade-path check, do not uninstall beta.2 first.

## 1. Upgrade over beta.2

- [ ] Confirm `1.0.0-beta.2` is installed.
- [ ] Install `Hanab-Mobile-1.0.0-beta.3.apk` over beta.2.
- [ ] Android accepts the upgrade without uninstalling the old app.
- [ ] Launch succeeds without Metro or development tooling.
- [ ] Existing account/session behavior is sane after upgrade.
- [ ] `/version` reports `1.0.0-beta.3`.

Failure here blocks tester distribution because it can indicate signing, package, versionCode, startup,
or migration problems.

## 2. Ordinary live game

Use a normal 2P or 3P table.

- [ ] Create or join the table normally.
- [ ] Play one legal card.
- [ ] Discard one legal card.
- [ ] Give one clue.
- [ ] Explicit Play/Discard confirmation behavior is intact.
- [ ] Turn/player/hand presentation updates correctly after each authoritative action.
- [ ] No stale or duplicate action is sent.

## 3. Create-table preferences

Exercise supported persisted Create options.

- [ ] Change at least variant/max players/timed state and one supported gameplay option.
- [ ] Create a table successfully.
- [ ] Return to Lobby/Create.
- [ ] Supported options restore from server-backed preferences.
- [ ] For a timed table, timer base/per-turn values restore correctly.
- [ ] Switch to untimed and confirm latent timer values are not destroyed.
- [ ] Specific-seed Create still pre-fills and creates correctly.

## 4. Reverse hands

In a live game where hand ordering is obvious:

- [ ] `Reverse hands` off uses the expected default/BGA-style reversed presentation.
- [ ] `Reverse hands` on switches to authoritative array order.
- [ ] Toggling does not mutate authoritative card identity/order.
- [ ] Play/discard/note interactions still target the intended card.

## 5. Show timers in untimed games

Use an untimed live game.

- [ ] With the setting off, no turn clock is shown.
- [ ] Enable `Show turn timers in untimed games`.
- [ ] Active player's clock becomes visible.
- [ ] Active untimed clock counts up, not down.
- [ ] Inactive player clock remains stable until their turn.
- [ ] Turning the setting back off only hides presentation; game state remains sane.
- [ ] Pause remains unavailable in untimed play.

## 6. Rewind / Return to Live

During an active game:

- [ ] Enter Rewind.
- [ ] Scrub or step to an earlier segment.
- [ ] No live gameplay command is emitted while reviewing.
- [ ] Return to Live restores the current authoritative state.
- [ ] Card-bound notes/actions still follow stable card identity.

Visible rapid-scrubber jank alone is the known non-blocking issue #4 unless it becomes severe enough to
make review unusable.

## 7. Finished replay / shared review / Hypothetical

- [ ] Open a finished replay from History.
- [ ] Open a shared replay/review path.
- [ ] Solo JSON replay links open as solo.
- [ ] Shared JSON replay links open as shared.
- [ ] Replay export/share works on a finished review.
- [ ] Enter a representative Hypothetical state.
- [ ] Morph/unmorph controls work.
- [ ] Leaving review does not affect any live game.

## 8. History / tags

- [ ] Open My history.
- [ ] Open Friends history if available.
- [ ] Open Tagged games.
- [ ] Exact tag search returns expected results.
- [ ] Clear tag search returns to the tagged-game list.
- [ ] Opening a tagged/search result reaches the existing replay path correctly.
- [ ] Other Scores remains unavailable where intentionally suppressed.

## 9. Spectator

- [ ] Spectate a live 2–6 player game.
- [ ] C17 workspace is used.
- [ ] Switch perspective to one player.
- [ ] Switch back to All hands.
- [ ] No participant-only gameplay action becomes available accidentally.

## 10. Chat / PM

- [ ] Send and receive a table-chat message.
- [ ] Table unread/read behavior is sensible.
- [ ] Open a player's contextual Dialog.
- [ ] Send and receive one private message while both users are online.
- [ ] `/r` replies to the expected live PM peer.
- [ ] Reconnect behavior does not produce duplicate/stale sends.

Persistent PM history is intentionally not a beta.3 requirement.

## 11. Background / foreground

During a live game:

- [ ] Begin an interaction but do not confirm/send it.
- [ ] Background the app.
- [ ] Foreground the app.
- [ ] Realtime state reconnects/resumes sensibly.
- [ ] No stale Play/Discard/Clue action fires automatically.
- [ ] Current authoritative state wins after reconnect.

## 12. 4P–6P focused sanity

One representative dense game is enough for beta.3.

- [ ] Gameplay remains usable in portrait.
- [ ] Rotate to landscape and back.
- [ ] No required primary control is clipped behind system UI.
- [ ] No unexpected Legacy fallback appears for a normal live 2–6 player room.
- [ ] Touch targets remain usable.

Do not reopen broad layout redesign here; issue #58 belongs to the post-beta Mobile App Design pass.

## 13. Clean install

After upgrade-path validation is complete:

- [ ] Uninstall the app.
- [ ] Install the same beta.3 APK fresh.
- [ ] Launch succeeds without development tooling.
- [ ] Login/account selection works.
- [ ] Lobby hydration succeeds.
- [ ] Create/join one table and reach live gameplay.
- [ ] No stale state from the prior installation is assumed.

## Result

Overall:

- [ ] PASS — suitable for tester distribution.
- [ ] BLOCKED — runtime/release defect found.
- [ ] PASS WITH KNOWN NON-BLOCKER — only already-accepted limitation observed.

Record any failure with:

- exact step;
- device / Android version;
- beta version;
- screenshot/video if useful;
- expected behavior;
- observed behavior;
- whether reproducible after restart.
