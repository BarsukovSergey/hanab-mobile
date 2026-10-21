# Third-party notices and upstream attribution

Hanab Mobile is an unofficial community Android client for [hanab.live](https://hanab.live). It is not an official Hanabi-Live app and is not endorsed by the Hanabi-Live maintainers.

## Hanabi-Live

- Project: [Hanabi-Live/hanabi-live](https://github.com/Hanabi-Live/hanabi-live)
- License in the pinned upstream repository: GNU General Public License, version 3 (GPLv3)
- License copy in this repository: [`src/game/upstream/LICENSE`](src/game/upstream/LICENSE)
- Provenance and pinned revisions: [`docs/UPSTREAM.md`](docs/UPSTREAM.md) and [`src/game/upstream/UPSTREAM.md`](src/game/upstream/UPSTREAM.md)

Hanab Mobile includes and adapts upstream game/reducer logic and other upstream-derived client behavior. The vendored game sources are in `src/game/upstream/`. Adapted selectors, replay/hypothetical behavior, and protocol-related code are documented with their respective scoped upstream pins in `docs/UPSTREAM.md`.

### Card and UI artwork

The committed card assets under `assets/cards/upstream/` are generated using the pinned Hanabi-Live card renderer; card shapes, visual details and presentation variants originate upstream. Files under `assets/ui/upstream/` include PNG artwork synchronized from the Hanabi-Live web client. See [`tools/card-assets/README.md`](tools/card-assets/README.md) for the reproducible generation and synchronization process.

The above attribution documents provenance. **It does not establish that every third-party image, card design or embedded asset is independently licensable by the Hanab Mobile maintainers.** Image-specific authorship and any third-party artwork rights should be reviewed before describing *all artwork* as GPLv3 without qualification. New assets must preserve applicable source licenses and credit.

## Hanab Mobile original contributions

The project-wide licensing intention is **GPL-3.0-only**; see [`LICENSE`](LICENSE). The copyright in third-party material remains with its respective contributors and copyright holders. No claim of exclusive authorship of upstream components is made.

## Other third-party dependencies

Third-party npm packages and their own licensing terms are not relicensed by this notice. Review the dependency manifests (`package.json`, `package-lock.json`) and the applicable package license files when preparing a redistributed APK. This notice is not a complete software bill of materials or a substitute for validating license obligations for bundled native dependencies.

## Distributed APKs and corresponding source

Each distributed release should identify the **exact source commit** used to build its APK and provide access to the corresponding source and build instructions, together with any additional materials required by GPLv3 for that distribution.

For the `1.0.0-rc.2` APK built before this documentation change, the frozen build source is commit [`2f1a70fd6b6fab91d069703c6643715b6cae7ed3`](https://github.com/BarsukovSergey/hanab-mobile/tree/2f1a70fd6b6fab91d069703c6643715b6cae7ed3). Do **not** substitute a later `main` commit as the corresponding source, and do not claim this later licensing/documentation-only commit was part of that earlier binary. The [release gate](docs/RC_2_RELEASE.md) records that APK's provenance and physical acceptance.

Before public redistribution, verify the completeness of the corresponding-source offer, copyright notices, artwork permissions, and any applicable third-party license conditions. In particular, merely linking to a public repository does not automatically fulfill every GPLv3 binary-distribution obligation.
