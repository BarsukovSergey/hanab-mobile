import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SUPPORTED_VARIANT_NAMES } from '../../src/game/client/supportedVariants';
import { createSvgCardRendererBackend } from './svgCanvas';

type DrawCards = (
  variant: unknown,
  colorblindMode: boolean,
  styleNumbers: boolean,
  enableShadows: boolean,
  backend: ReturnType<typeof createSvgCardRendererBackend>,
) => ReadonlyMap<string, string>;

type GameModule = {
  getVariant: (name: string) => unknown;
};

type VariantCardHashes = Record<string, string>;

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function asModule<T>(module: T | { default: T }): T {
  if (
    typeof module === 'object'
    && module !== null
    && 'default' in module
    && module.default !== undefined
  ) {
    return module.default;
  }
  return module as T;
}

function getChunkName(hash: string): string {
  const secondNibble = Number.parseInt(hash[1]!, 16);
  const bucketStart = secondNibble < 8 ? '0' : '8';
  return `${hash[0]}${bucketStart}`;
}

async function main(): Promise<void> {
  const [upstreamDir, outputDir, upstreamCommit] = process.argv.slice(2);
  if (upstreamDir === undefined || outputDir === undefined || upstreamCommit === undefined) {
    throw new Error('Usage: runUpstream.ts <upstream-dir> <output-dir> <upstream-commit>');
  }

  const drawCardsUrl = pathToFileURL(
    path.join(upstreamDir, 'packages/client/src/game/ui/drawCards.ts'),
  ).href;
  const constantsUrl = pathToFileURL(
    path.join(upstreamDir, 'packages/client/src/game/ui/constants.ts'),
  ).href;
  const gameUrl = pathToFileURL(
    path.join(upstreamDir, 'packages/game/dist/index.js'),
  ).href;

  const drawCardsModule = await import(drawCardsUrl) as { drawCards: DrawCards };
  const constantsModule = await import(constantsUrl) as { CARD_W: number; CARD_H: number };
  const importedGameModule = await import(gameUrl) as GameModule | { default: GameModule };
  const gameModule = asModule(importedGameModule);

  const variantHashes = new Map<string, VariantCardHashes>();
  const svgByHash = new Map<string, string>();
  const cardKeySet = new Set<string>();

  for (const variantName of [...SUPPORTED_VARIANT_NAMES].sort()) {
    const variant = gameModule.getVariant(variantName);
    const images = drawCardsModule.drawCards(
      variant,
      false,
      false,
      false,
      createSvgCardRendererBackend(constantsModule.CARD_W, constantsModule.CARD_H),
    );
    const hashes: VariantCardHashes = {};

    for (const [cardKey, svg] of [...images.entries()].sort(([left], [right]) => (
      left.localeCompare(right)
    ))) {
      const hash = sha256(svg);
      hashes[cardKey] = hash;
      cardKeySet.add(cardKey);
      if (!svgByHash.has(hash)) {
        svgByHash.set(hash, svg);
      }
    }

    variantHashes.set(variantName, hashes);
  }

  const cardKeys = [...cardKeySet].sort();
  const assets = [...svgByHash.keys()].sort();
  const cardKeyIndexes = new Map(cardKeys.map((key, index) => [key, index]));
  const assetIndexes = new Map(assets.map((hash, index) => [hash, index]));

  const manifestVariants: Record<string, readonly (readonly [number, number])[]> = {};
  for (const [variantName, hashes] of variantHashes) {
    manifestVariants[variantName] = Object.entries(hashes).map(([cardKey, hash]) => [
      cardKeyIndexes.get(cardKey)!,
      assetIndexes.get(hash)!,
    ] as const);
  }

  const manifest = {
    upstreamCommit,
    renderer: {
      width: constantsModule.CARD_W,
      height: constantsModule.CARD_H,
      colorblindMode: false,
      styleNumbers: false,
      enableShadows: false,
    },
    cardKeys,
    assets,
    variants: manifestVariants,
  } as const;

  const chunks = new Map<string, Record<string, string>>();
  for (const hash of assets) {
    const chunkName = getChunkName(hash);
    const chunk = chunks.get(chunkName) ?? {};
    chunk[hash] = svgByHash.get(hash)!;
    chunks.set(chunkName, chunk);
  }

  const chunksDir = path.join(outputDir, 'chunks');
  await mkdir(chunksDir, { recursive: true });

  for (const [chunkName, chunk] of [...chunks.entries()].sort(([left], [right]) => (
    left.localeCompare(right)
  ))) {
    await writeFile(
      path.join(chunksDir, `${chunkName}.json`),
      `${JSON.stringify(chunk)}\n`,
      'utf8',
    );
  }

  await writeFile(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify(manifest)}\n`,
    'utf8',
  );
}

void main();