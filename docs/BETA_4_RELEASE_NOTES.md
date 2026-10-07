# Hanab Mobile 1.0.0-beta.4

Date: **2026-10-07**

Status: **release-prep candidate; APK not built or published yet**

Beta.4 is the first tester build based on the implemented Mobile App Design v2 shell and the current
post-11c runtime/replay baseline.

## Highlights since beta.3 hotfix 1

- Home / History / People / More browsing destinations;
- focused Pregame, Live, Rewind, Replay, Shared Replay, and Hypothetical presentation;
- room-preserving Browse / Return behavior with explicit attendance ownership;
- dedicated Create Table flow;
- redesigned Pregame and Live phone portrait plus first-class phone landscape layouts;
- contextual Chat / Table / Game / Review menus without global navigation in focused rooms;
- History / Review navigation and current People / Profile / session Messages / Conversation flows;
- safer visibility/task ownership around rotation, backgrounding, reconnect, and room transitions;
- current upstream card-presentation, hypothetical-planning, and hypothetical-state semantics.

## Release identity

- version: `1.0.0-beta.4`
- Android `versionCode`: `5`
- workflow artifact: `Hanab-Mobile-1.0.0-beta.4`
- expected APK: `Hanab-Mobile-1.0.0-beta.4.apk`
- runtime candidate: **TBD after the release-prep PR is merged**
- Android workflow run: **not run yet**
- APK size / SHA-256: **not recorded yet**
- GitHub prerelease: **not published yet**

The release-prep merge commit becomes the candidate unless a runtime fix is required afterward.
If runtime code changes after the candidate is frozen, choose a new candidate and rebuild.

## Validation status

Before tester distribution:

1. ordinary CI must pass on the exact candidate;
2. build the APK from that candidate with the manual Android Beta APK workflow;
3. record APK size and SHA-256;
4. complete the maintainer gate in `BETA_4_PHYSICAL_SMOKE.md`;
5. publish that exact tested APK as the `v1.0.0-beta.4` prerelease.

Do not rebuild or replace the APK after physical acceptance while keeping the same recorded identity.

## Known limitations / follow-up

- Slice 12 physical hardening / accessibility / performance is intentionally not complete before this
  tester release; beta.4 feedback is part of that work.
- Rapid replay scrubbing may still show visible jank (issue #4).
- Session Messages are not durable account-wide message history.
- Slice 13 cleanup of replaced presentation paths comes after physical validation.
- This remains a standalone internal Android APK, not the Play Store / AAB pipeline.
