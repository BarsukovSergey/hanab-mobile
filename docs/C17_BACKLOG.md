# C17 Post-beta Backlog

Date: 2026-09-22

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
- **Live HUD hierarchy / compact notation:** revisit the dense Score/Max/Clues/Strikes/Deck/Pace/Eff presentation, including compact score/max notation and whether some metrics belong closer to their table context. Preserve upstream semantics; do not invent mobile-only stats.
- **Live-game header chrome:** reduce the visual prominence/cost of rarely used Lobby navigation during active play while keeping exit/navigation discoverable and safe.
- **Card presentation preferences:** investigate exposing upstream-compatible card preferences such as colorblind mode and styled numbers. If added, generate/bundle the corresponding pinned renderer assets deliberately rather than approximating them in UI.
- **4P–6P gameplay redesign / repair:** diagnosis and implementation direction are recorded in `docs/4P_6P_LAYOUT_RESEARCH.md`. Replace the current normal Compact Overview / summary-icon fallback with a dense real-card allocation that protects the own/observed hand, reduces dense chrome/Workbench reservation before sacrificing card identity, and physically revalidates ordinary 4P, 5P, and 6P play.
- Dedicated two-column landscape composition.
- Dedicated tablet / large-screen persistent side-pane composition and polish.
- Richer / prettier / cinematic gameplay animations beyond the minimal functional C17 transitions.

## Product shell / social

- **Lobby table sections and create-table placement:** research and implementation contract are recorded in `docs/LOBBY_SECTIONS_RESEARCH.md`. Render Pregame -> Create table (only when there is no reattendable own running game) -> Running -> Shared replays. Keep the user's own reattendable game inside Running, first and clearly marked, rather than as a separate section. Shared replays must never be grouped into Running. Use theme-aware web-like semantic distinctions plus text/status labels; do not rely on color alone.
- **Native controls for useful slash-command actions:** research is recorded in `docs/COMMANDS_AND_BOTS_RESEARCH.md`. Prioritize contextual PM/player-info/friend actions, pregame kick and score/variant helpers, shared-replay turn suggestion, and tags where the structured mobile context improves on command typing. Existing leader/variant/pause/termination controls are already first-class UI. Preserve slash-command support as the parity/fallback path.
- **Simple bot invite UI:** research is recorded in `docs/COMMANDS_AND_BOTS_RESEARCH.md`. Use a **multi-select** bot picker in Create table so the creator can choose several bots up to available player capacity; for a newly created protected table, reuse the still-transient create-form password for each `/join <password>` without asking twice, then clear it after authoritative create/invite. Keep the same multi-select `Add bot` action in Pregame for existing tables, capped by current free player slots and requesting a protected-table password transiently only when it is no longer available from the create flow. Back both paths with an explicit registry of verified bot usernames and existing `chatPM` + `/join` semantics; do not persist table passwords or create a bot-only protocol.
- People surface.
- Rich/compact profiles beyond what is strictly required by existing gameplay/table identity.
- Friends list / online-friends affordances.
- Social feeds, recommendations, achievements, messaging redesign.
- **Chat typing/read-state polish:** optional typing indicators and/or unread/read-state affordances if the authoritative server/client capability is worth exposing on mobile.
- **Push notifications:** research mobile notifications for genuinely useful events (for example turn/table/social events) only after verifying server/background-delivery capability and notification permission UX.
- **Discord/account linking:** optional account-integration parity; no implementation until the upstream purpose, transport, and mobile value are verified.

## Replay / command parity

- **Seed comparison / other scores:** investigate a history/replay view for other games played on the same seed, using authoritative history/server data rather than client-side score guessing. Treat this as an optional history enhancement.
- **Advanced shared-replay parity:** research the remaining useful web power-user features such as replay arrows/annotations, replay sounds, and user-facing efficiency-mod controls. The mobile state already retains upstream `sharedReplayEffMod`; do not rebuild that semantic state separately in UI.
- **Game/replay tags workflow:** the protocol/runtime can already carry game-history `tags` data and raw tag commands, but there is no first-class mobile workflow. Research whether tag search/add/delete deserves native UI. This is distinct from note quick tags.
- **`/copy` replay export:** implement the deliberately deferred replay-copy flow, including the required replay JSON/clipboard mechanics, without changing existing server-handled slash-command fallback behavior.
- **Replay scrubber performance:** investigate rapid-scrub rendering/update cost while preserving authoritative replay semantics and the existing final-position flush behavior. Concrete defect tracking remains GitHub issue #4.

## Release / packaging / maintenance

- **Remembered-password policy:** do **not** add password persistence by default. The current platform-owned authenticated session already survives normal relaunches without exposing cookies or credentials to app code. Revisit only if real session-persistence evidence creates a user problem; if ever implemented, require explicit opt-in and platform secure storage (Android Keystore / iOS Keychain).
- **Beta upgrade continuity:** use `docs/BETA_FEEDBACK_AND_NEXT_RELEASE.md` for the next tester build. Bump the app version and Android `versionCode`, keep the Android build manual-only, verify installation over `1.0.0-beta.1` without uninstalling, and record exact candidate SHA/artifact hash plus expected session/app continuity.
- **Play Store / AAB pipeline:** define store signing, AAB packaging, versioning, and release policy separately from the current standalone internal APK flow. Keep the heavy APK/AAB workflow manual unless deliberately changed.
- **Dependency maintenance:** current findings and remediation order are recorded in `docs/DEPENDENCY_AUDIT.md`. The present lockfile reports 10 moderate / 0 high / 0 critical findings, all expanding from the Expo config -> `xcode@3.0.1` -> `uuid@7.0.3` advisory chain. Do not use `npm audit fix --force`; wait for a compatible upstream fix or handle it in an isolated, validated maintenance slice.
- **Release housekeeping:** before a public/store release, explicitly verify final icon/splash/branding assets, About/licenses obligations, and the release checklist rather than inheriting historical C16/C17 assumptions.

## Non-backlog C17 capabilities

For avoidance of doubt, the following are **not** backlog and remain C17 MUST:

- Live Rewind/history.
- Finished game and ordinary replay in the C17 workspace.
- Shared review including follow/detach/leader semantics.
- Hypothetical using upstream/server semantics.
- Live spectator C17 workspace.
- Pregame player/spectator role switching where authoritative capability permits.
- Minimal functional state-change animation.
