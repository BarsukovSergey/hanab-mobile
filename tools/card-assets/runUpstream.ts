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

type CardMode = {
  name: 'default' | 'style-numbers' | 'colorblind';
  colorblindMode: boolean;
  styleNumbers: boolean;
};

const MODES: readonly CardMode[] = [
  { name: 'default', colorblindMode: false, styleNumbers: false },
  { name: 'style-numbers', colorblindMode: false, styleNumbers: true },
  { name: 'colorblind', colorblindMode: true, styleNumbers: false },
];

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

  const cardsDir = path.join(outputDir, 'cards');
  await mkdir(cardsDir, { recursive: true });

  const manifest: {
    upstreamCommit: string;
    renderer: {
      width: number;
      height: number;
      enableShadows: false;
      modes: readonly string[];
    };
    variants: Record<string, Record<string, Record<string, string>>>;
  } = {
    upstreamCommit,
    renderer: {
      width: constantsModule.CARD_W,
      height: constantsModule.CARD_H,
      enableShadows: false,
      modes: MODES.map((mode) => mode.name),
    },
    variants: {},
  };

  const writtenAssets = new Set<string>();

  for (const variantName of SUPPORTED_VARIANT_NAMES) {
    const variant = gameModule.getVariant(variantName);
    const variantEntry: Record<string, Record<string, string>> = {};

    for (const mode of MODES) {
      const images = drawCardsModule.drawCards(
        variant,
        mode.colorblindMode,
        mode.styleNumbers,
        false,
        createSvgCardRendererBackend(constantsModule.CARD_W, constantsModule.CARD_H),
      );
      const modeEntry: Record<string, string> = {};

      for (const [cardKey, svg] of [...images.entries()].sort(([left], [right]) => (
        left.localeCompare(right)
      ))) {
        const hash = sha256(svg);
        const fileName = `${hash}.svg`;
        modeEntry[cardKey] = `cards/${fileName}`;

        if (!writtenAssets.has(fileName)) {
          await writeFile(path.join(cardsDir, fileName), svg, 'utf8');
          writtenAssets.add(fileName);
        }
      }

      variantEntry[mode.name] = modeEntry;
    }

    manifest.variants[variantName] = variantEntry;
  }

  await writeFile(
    path.join(outputDir, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );
}

void main();
