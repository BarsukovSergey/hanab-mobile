# C17 Post-beta Backlog

Date: 2026-09-26

Last reconciled with `main` at `a89f209fc0335f9e46505da6cf47ec50726609ba` (PR #112 merge).

This file is an inventory, not the sequencing authority. See `PRODUCT_ROADMAP.md` for the current order of work and major product stages.

These items were explicitly removed from the C17 release gate during product review. They must not silently re-enter C17 acceptance work unless separately reprioritized.

## Notes / knowledge

- Dedicated visual identity / possibility picker.
- Note Previous / Next / Save-and-next navigation.
- Instant read-mode quick tags and possible Undo workflow.
- Dedicated one-tap `Clued`, `Unclued`, and `Blank` controls.
- Deep Knowledge workspace beyond ordinary on-card knowledge/empathy.
- Two-card / two-hand compare flows.
- All comparison pins.

## Clue planning

- Multi-candidate Compare / clue pins.
- Read-only off-turn clue planning.
- Zero-token rehearsal with hypothetical touched-card preview and disabled Give.

## Gestures / empathy

- Hold-and-drag across cards to peek notes.
- Optional preference for global empathy Toggle versus Hold behavior.
- Drag-to-play / drag-to-discard as an optional input mode. Safe explicit Play/Discard buttons remain the baseline.

## Layout / presentation

- **2P portrait space allocation:** reduce the large dead vertical band that can appear between the hand/table region and Workbench without destabilizing denser player-count layouts.
- **Live HUD hierarchy / compact notation:** revisit the dense Score/Max/Clues/Strikes/Deck/Pace/Eff presentation, including compact score/max notation and whether some metrics belong closer to their table context. Issue #30 corrected Pace/Eff context semantics; PRs #107/#108 added pinned-upstream Low Score, locked-hand, Double Discard, clue-availability, and discard-state cues. Preserve those semantic boundaries during later visual redesign and do not invent mobile-only stats; PR #110 additionally makes H-group/Real-life presentation gating user-controllable through authoritative server-backed settings.
- **Live-game header chrome:** reduce the visual prominence/cost of rarely used Lobby navigation during active play while keeping exit/navigation discoverable and safe.
- Dedicated two-column landscape composition.
- Dedicated tablet / large-screen persistent side-pane composition and polish.
- Richer / prettier / cinematic gameplay animations beyond the minimal functional C17 transitions.

## Product shell / social

- **Native controls for useful slash-command actions:** research is recorded in `docs/COMMANDS_AND_BOTS_RESEARCH.md`. People/Pregame/live-game contexts already expose Friend/Unfriend and session Dialog actions; shared-replay turn suggestions, Add tag, Pregame Kick, Find variant, and Missing scores also have first-class UI. Native auto-start helpers (`/s`, `/s2`…`/s6`, `/startin`) are explicitly out of scope; preserve the existing slash-command fallback instead. Existing leader/variant/pause/termination controls remain first-class UI.
- **Bot invite follow-up:** the multi-select Create/Pregame picker and exact 19-name registry are implemented for open and password-protected tables. The current 19 entries have verified password-join capability; future registry entries remain capability-gated. Only authoritative online Lobby-status bots are selectable, Busy bots are shown but disabled, and table passwords remain transient rather than entering Redux/persistence. Do not create a bot-only protocol.
- Rich/compact profiles beyond the existing People/context-action surfaces.
- Broader friends/social UX beyond current People/Friend actions, friends-first People ordering, friend-highlighted Lobby discovery, Friends history, Other Scores, and session PM Dialogs.
- **Chat presence/presentation polish:** authoritative table-chat unread counts, best-effort `chatRead` acknowledgements, direct `/r`, and authoritative mute-state guarding are implemented. Future work may research typing indicators or other presentation polish only if authoritative server/client capability is worth exposing on mobile.
- **Push notifications:** research mobile notifications for genuinely useful events (for example turn/table/social events) only after verifying server/background-delivery capability and notification permission UX.
- **Linked hanab.live accounts:** optional native UI for the already-supported `/link` / `/linked` / `/unlink` semantics. Upstream linking is **not Discord account linking**; it is asymmetric hanab.live account linkage used when choosing seeds so linked accounts do not receive deals the linked user has already played. Discord is a separate lobby-chat/community integration.

## Replay / command parity

- **Advanced shared-replay parity:** shared replay creation from History and send/receive turn suggestions are implemented. Remaining power-user candidates include replay arrows/annotations, replay sounds, and user-facing efficiency-mod controls. Initial `sharedReplayEffMod` state and authoritative follower-side `replayEfficiencyMod` updates are supported; controls for originating modifier changes remain future work. Do not rebuild the semantic state separately in UI.
- **Arbitrary JSON replay import:** add the upstream `replayCreate` `source=json` workflow for research/bot review only after deliberately adopting the current upstream JSON seed/deck/player-name semantics recorded in `docs/UPSTREAM_PARITY_AUDIT.md`.
- **Game/replay tag management beyond current Add/display UI:** History/Friends History/Other Scores can display authoritative tags and the Game menu exposes Add tag through the existing server command path. Research whether tag search/delete or richer management deserves first-class mobile UI. This is distinct from note quick tags.
- **`/copy` replay export:** implement the deliberately deferred replay-copy flow, including the required replay JSON/clipboard mechanics, without changing existing server-handled slash-command fallback behavior.
- **Replay scrubber performance:** investigate rapid-scrub rendering/update cost while preserving authoritative replay semantics and the existing final-position flush behavior. Concrete defect tracking remains GitHub issue #4.

## Release / packaging / maintenance

- **Account credentials:** the Android recent-account chooser is current direction: Hanab Mobile may remember usernames only, while Android Credential Manager owns saved account passwords. Hanab Mobile does not persist account passwords.
- **Web / Android credential sharing:** deferred Digital Asset Links integration, including upstream `https://hanab.live/.well-known/assetlinks.json` and package/signing-certificate association. Revisit only when the public/release signing identity is stable and upstream cooperation is appropriate. This association is not implemented.
- **Beta.2 physical validation:** the frozen beta.2 APK has been built successfully and its exact identity is recorded in `docs/BETA_2_RELEASE_NOTES.md`. Before broad distribution, validate upgrade over beta.1 without uninstalling, perform at least one clean install, and complete the short physical smoke without changing the candidate SHA/hash.
- **Play Store / AAB pipeline:** define store signing, AAB packaging, versioning, and release policy separately from the current standalone internal APK flow. Keep the heavy APK/AAB workflow manual unless deliberately changed.
- **Dependency maintenance:** current findings and remediation order are recorded in `docs/DEPENDENCY_AUDIT.md`. The present lockfile reports 10 moderate / 0 high / 0 critical findings, all expanding from the Expo config -> `xcode@3.0.1` -> `uuid@7.0.3` advisory chain. Do not use `npm audit fix --force`; wait for a compatible upstream fix or handle it in an isolated, validated maintenance slice.
- **Release housekeeping:** before a public/store release, explicitly verify final icon/splash/branding assets, About/licenses obligations, and the release checklist rather than inheriting historical C16/C17 assumptions.

## Non-backlog C17 capabilities

For avoidance of doubt, the following are **not** backlog and remain C17 MUST:

- Live Rewind/history.
- Finished game and ordinary replay in the C17 workspace.
- Shared review including follow/detach/leader semantics.
- Shared replay creation from History and turn suggestions.
- Hypothetical using upstream/server semantics.
- Live spectator C17 workspace.
- Pregame player/spectator role switching where authoritative capability permits.
- Spectator perspective switching between all hands and an authoritative player shadow seat.
- Colorblind and styled-number card presentation using generated pinned-upstream assets and server settings, plus server-backed H-group features and Real-life mode presentation toggles.
- Pinned-upstream H-group and resource-state gameplay cues: Low Score, locked hand, Double Discard, clue availability, and discard-state emphasis with real-life/Hypothetical gating.
- People/Pregame/live-game contextual session Dialog and Friend/Unfriend actions, plus friends-first People ordering and visible friend emphasis in Lobby discovery.
- Account creation is explicit on the login screen; Change password and Forgot password entry points preserve the no-credential-storage boundary.
- Compact authoritative Pregame player stats and spectator list.
- Native Pregame Kick, Find variant, and Missing scores actions with slash-command fallback.
- Multi-bot Create/Pregame picker for open and password-protected tables with transient password handling.
- Own History, Friends history, and same-seed Other Scores comparison.
- Authoritative game tag display and first-class Add tag action.
- Live table-chat unread indicator, server-backed read acknowledgement, direct `/r` reply handling, and authoritative mute-state guarding.
- Minimal functional state-change animation.
- Adaptive 4P–6P real-card portrait allocation with the 46 dp opponent floor and emergency-only Compact Overview fallback; current physical evidence covers 5P, true 6P, and 6P + One Extra Card on the tested Android class.
