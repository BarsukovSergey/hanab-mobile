# Upstream card assets

The mobile client does not maintain a second implementation of Hanabi Live card rendering.

`npm run cards:generate`:

1. checks out `Hanabi-Live/hanabi-live` at the exact commit in `upstreamPin.mjs` into `.cache/`;
2. installs that checkout's dependencies and builds `packages/game`;
3. runs the pinned upstream `drawCards` renderer with the local deterministic SVG backend;
4. renders the variants currently accepted by `SUPPORTED_VARIANT_NAMES` in default, style-number, and colorblind modes;
5. deduplicates identical SVGs by SHA-256 and writes `assets/cards/upstream/manifest.json` plus `assets/cards/upstream/cards/*.svg`.

The SVG backend only implements Canvas 2D output. Card rules, dimensions, colors, ranks, pips, and variant-specific presentation remain owned by the pinned upstream renderer.

`npm run cards:check` regenerates into a temporary directory and fails if the committed assets differ.

The upstream checkout and dependency install are cached. Changing the pin invalidates the cache automatically.
