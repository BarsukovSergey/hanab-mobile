# Documentation map

This directory mixes current product/technical authority with historical implementation evidence. Use this page to avoid treating an old milestone note as current release guidance.

## Start here

- `../README.md` — project overview, local development, current Android beta scope.
- `../TESTING.md` — tester-facing beta script and bug-report format.
- `BETA_2_RELEASE_NOTES.md` — exact beta.2 candidate/build identity, tester-visible changes, known limitations, and focused regression targets.
- `ANDROID_BETA_RELEASE.md` — current internal APK version, build command, acceptance checklist, and frozen-build policy.
- `BETA_FEEDBACK_AND_NEXT_RELEASE.md` — maintainer triage rules during the tester window plus the next tester-build/version/upgrade checklist.

## Current authority

- `ARCHITECTURE.md` — technical boundaries: server authority, networking, reconnect safety, and upstream ownership.
- `PROTOCOL.md` — mobile/server protocol notes.
- `UPSTREAM.md` — pinned upstream ownership and reuse rules.
- `C17_UX_CONTRACT.md` — current gameplay/product contract.
- `C17_UX_DECISIONS.md` — ratified product decisions and explicit revisions.
- `CARD_PRESENTATION_PARITY.md` — card-presentation semantic parity constraints.

## Current validation and evidence

- `C17_VALIDATION.md` — active beta acceptance scope and physical validation gates.
- `C17_EVIDENCE.md` — preserved device observations and defect history; evidence, not authority.
- `DEPENDENCY_AUDIT.md` — current npm/deprecation findings and the safe maintenance order.
- `UPSTREAM_PARITY_AUDIT.md` — comprehensive current Hanabi-Live/mobile parity matrix, effort/importance assessment, command/settings coverage, and scoped upstream-drift review.
- `GAMEPLAY_SCENARIOS.md` — deterministic gameplay scenario harness and coverage model.

## Deferred work

- `C17_BACKLOG.md` — explicit post-beta C17/product deferrals and the default home for newly deferred product work.
- `BACKLOG.md` — legacy non-authoritative parking lot retained for history. Do not add new work there.
- GitHub issues — concrete defects selected for follow-up, such as replay scrubber performance.

## Historical snapshots

These are useful for archaeology but must not override current authority:

- `archive/C17_HANDOFF.md` — continuation handoff from the old feature-branch phase.
- `archive/MOBILE_GAMEPLAY_REDESIGN.md` — superseded pre-C17 presentation proposal.
- `archive/FEATURE_MATRIX.md` — historical milestone matrix with stale pre-beta statuses.
- `archive/C1_RESULTS.md` through `archive/C16_RESULTS.md` and related result files — milestone evidence captured during development.

When documents conflict, prefer the current authority list above, then the current beta release scope.
