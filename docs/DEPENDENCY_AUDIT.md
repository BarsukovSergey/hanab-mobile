# Dependency audit

Date: 2026-09-22

Status: current lockfile audit / maintenance guidance.

This audit is intentionally separate from beta.1 runtime work. It records the current dependency
findings without applying package upgrades or `npm audit fix --force`.

## Evidence

Audit probe:

- temporary PR: #24 (`chore: probe dependency audit`), closed without merge;
- workflow run: `35715596995`;
- Node: 24;
- package manager path: checked-in `package-lock.json` + `npm ci`;
- commands:
  - `npm audit --omit=dev --json`
  - `npm audit --json`

Both commands reported exactly:

- 0 low;
- 10 moderate;
- 0 high;
- 0 critical;
- 10 total.

The full graph and `--omit=dev` graph reported the same 10 findings. Current lockfile metadata
contains 574 production, 170 development, 13 optional, and 74 peer dependency entries.

## Security finding

The 10 npm-audit entries are an expanded dependency chain around one advisory:

`expo@57.0.18 -> @expo/config-plugins@57.0.9 -> xcode@3.0.1 -> uuid@7.0.3`

Advisory:

- `GHSA-w5hq-g745-h8pq`
- `CVE-2026-41907`
- moderate severity;
- affected API methods are `uuid.v3()`, `uuid.v5()`, and `uuid.v6()` when a caller supplies an
  external output buffer/offset without adequate bounds validation;
- GitHub's reviewed advisory lists `11.1.1`, `12.0.1`, and `13.0.1` as patched releases for their
  corresponding affected version lines.

The npm audit output reports the transitive Expo/config/xcode packages as affected because they lead
to the vulnerable `uuid` package. They are not ten unrelated security defects.

Reference: https://github.com/advisories/GHSA-w5hq-g745-h8pq

## Exposure assessment for Hanab Mobile

Immediate beta risk is low for the currently distributed Android build:

1. `xcode` is native-project build/config tooling reached through Expo config plugins; it is not
   application runtime code shipped as a JavaScript dependency that the Android player invokes.
2. The `xcode@3.0.1` project-ID generator uses `uuid.v4()`.
3. The reviewed advisory explicitly concerns the `v3`, `v5`, and `v6` APIs, and contrasts them
   with `v4` as already performing the relevant bounds check.
4. The active beta is Android-only; the vulnerable package is specifically an Xcode project parser.

This does not mean the audit warning should be suppressed. It means there is no evidence here for a
beta.1 Android hotfix or for destabilizing the Expo toolchain during the tester window.

## Upstream status

The currently published `xcode` package remains `3.0.1` and declares `uuid ^7.0.3`.

The upstream `apache/cordova-node-xcode` master branch is already `4.0.0-dev.0` and no longer
declares `uuid`; its current implementation uses the platform `crypto.randomUUID` path instead.
That fix is therefore moving upstream but is not yet available through the published package used by
Expo SDK 57.

The current SDK-57 `@expo/config-plugins@57.0.9` still declares `xcode ^3.0.1`.

## Do not use npm audit fix --force

For this graph, npm currently advertises a force-fix path through `expo@46.0.21`.

That is a large backwards major change from Expo 57 and is not a meaningful safe remediation for
this project.

Do not run `npm audit fix --force` against this repository.

Likewise, do not introduce a blind major `uuid` override under `xcode` during the beta freeze.
If an override is ever considered, it needs an isolated prebuild/build compatibility check first.

## Deprecation warnings from npm ci

The current install also prints deprecation warnings. They fall into two different groups.

### Test / tooling dependencies

The following are reached through Jest/jsdom/coverage tooling rather than ordinary app runtime:

- `abab@2.0.6` through `jest-expo -> jest-environment-jsdom -> jsdom`;
- `domexception@4.0.0` through the same jsdom chain;
- `whatwg-encoding@2.0.0` through the same jsdom chain;
- old `glob@7.2.3` copies through Jest/coverage;
- `inflight@1.0.6` under the old coverage `glob` path.

These are maintenance noise worth eliminating when the compatible Jest/Expo test stack moves
forward, but the current npm audit does not report additional security findings from them.

### uuid / xcode

`uuid@7.0.3` is also deprecated and is the package behind the current moderate security advisory.
Treat it with the upstream plan above rather than as a separate independent task.

## GitHub Actions maintenance

The repository workflows use the current supported majors:

- `actions/checkout@v7`;
- `actions/setup-node@v7`.

This is CI-only maintenance and does not change the Hanab Mobile runtime or npm dependency graph.
The workflows continue to request Node 24 explicitly and use their existing npm cache configuration.

Keep GitHub Actions upgrades separate from Expo/npm dependency remediation so build-infrastructure
changes remain easy to validate and revert independently.

## Recommended maintenance order

During the active beta.1 tester window:

1. do not change the dependency graph solely to make `npm audit` print zero;
2. keep the current moderate advisory recorded and monitor the published `xcode` / Expo config
   plugin chain;
3. do not run `npm audit fix --force`;
4. do not combine dependency upgrades with beta bug hotfixes.

After the feedback window, or when preparing a deliberate maintenance slice:

1. keep the now-updated GitHub Actions majors current in isolated CI-only maintenance slices;
2. check the newest compatible Expo SDK-57 patch set and re-run both audit commands;
3. if the published Expo/xcode chain has adopted the upstream uuid removal, take that compatible
   update and verify Android prebuild/release build;
4. otherwise continue to track the advisory unless a concrete build-host exposure justifies an
   isolated override;
5. handle Jest/jsdom deprecations with the compatible Expo/Jest stack rather than individually
   forcing transitive versions.

Any dependency change intended for a tester APK must go through the normal beta upgrade/regression
process in `docs/BETA_FEEDBACK_AND_NEXT_RELEASE.md`.
