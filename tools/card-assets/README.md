# Upstream card assets

The mobile client does not maintain a second implementation of Hanabi Live card rendering.

`npm run cards:generate`:

1. checks out `Hanabi-Live/hanabi-live` at the exact commit in `upstreamPin.mjs` into `.cache/`;
2. installs that checkout's dependencies and builds `packages/game`;
3. runs the pinned upstream `drawCards` renderer with the local deterministic SVG backend;
4. renders every variant currently accepted by `SUPPORTED_VARIANT_NAMES` with the mobile default card settings;
5. deduplicates identical SVGs by SHA-256 and writes a compact manifest plus 32 JSON chunks under `assets/cards/upstream/`.
6. synchronizes the card-state PNG artwork used by the web client into `assets/ui/upstream/`.

The SVG backend only implements Canvas 2D output. Card rules, dimensions, colors, ranks, pips, and variant-specific presentation remain owned by the pinned upstream renderer.

The current mobile UI does not expose Hanabi Live's `colorblindMode` or `styleNumbers` card preferences, so those alternate render modes are intentionally not bundled. They can be generated if mobile adds those settings later.

`npm run cards:check` regenerates into a temporary directory and fails if either the committed card SVG output or synced UI PNG assets differ.

The full regeneration/check workflow runs in the existing Ubuntu card-assets workflow; native Windows is not a supported environment for the pinned upstream build.

The upstream checkout and dependency install are cached. Changing the pin invalidates the cache automatically.
