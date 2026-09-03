type CardAssetManifest = {
  upstreamCommit: string;
  renderer: {
    width: number;
    height: number;
    colorblindMode: boolean;
    styleNumbers: boolean;
    enableShadows: boolean;
  };
  cardKeys: readonly string[];
  assets: readonly string[];
  variants: Readonly<Record<string, readonly (readonly [number, number])[]>>;
};

type SvgChunk = Readonly<Record<string, string>>;

const manifest = require('../../../assets/cards/upstream/manifest.json') as CardAssetManifest;

const cardKeyIndexes = new Map(manifest.cardKeys.map((key, index) => [key, index]));
const variantAssetIndexes = new Map<string, ReadonlyMap<number, number>>();
const loadedChunks = new Map<string, SvgChunk>();

export const UPSTREAM_CARD_ASSET_COMMIT = manifest.upstreamCommit;
export const UPSTREAM_CARD_WIDTH = manifest.renderer.width;
export const UPSTREAM_CARD_HEIGHT = manifest.renderer.height;

export function getUpstreamCardSvg(variantName: string, cardKey: string): string | null {
  const cardKeyIndex = cardKeyIndexes.get(cardKey);
  if (cardKeyIndex === undefined) return null;

  const assetIndex = getVariantAssetIndexes(variantName).get(cardKeyIndex);
  if (assetIndex === undefined) return null;

  const hash = manifest.assets[assetIndex];
  if (hash === undefined) return null;

  return getChunk(hash)[hash] ?? null;
}

export function getUpstreamCardKey(suitName: string | null, rank: number | null): string {
  const resolvedSuit = suitName ?? 'Unknown';
  if (rank === null) return `card-${resolvedSuit}-UnknownRank`;
  if (rank === 0) return `card-${resolvedSuit}-StackBase`;
  return `card-${resolvedSuit}-${rank}`;
}

function getVariantAssetIndexes(variantName: string): ReadonlyMap<number, number> {
  const cached = variantAssetIndexes.get(variantName);
  if (cached !== undefined) return cached;

  const pairs = manifest.variants[variantName] ?? [];
  const indexes = new Map<number, number>(pairs);
  variantAssetIndexes.set(variantName, indexes);
  return indexes;
}

function getChunk(hash: string): SvgChunk {
  const chunkName = getChunkName(hash);
  const cached = loadedChunks.get(chunkName);
  if (cached !== undefined) return cached;

  const chunk = loadChunk(chunkName);
  loadedChunks.set(chunkName, chunk);
  return chunk;
}

function getChunkName(hash: string): string {
  const secondNibble = Number.parseInt(hash[1] ?? '0', 16);
  return `${hash[0] ?? '0'}${secondNibble < 8 ? '0' : '8'}`;
}

function loadChunk(chunkName: string): SvgChunk {
  switch (chunkName) {
    case '00': return require('../../../assets/cards/upstream/chunks/00.json') as SvgChunk;
    case '08': return require('../../../assets/cards/upstream/chunks/08.json') as SvgChunk;
    case '10': return require('../../../assets/cards/upstream/chunks/10.json') as SvgChunk;
    case '18': return require('../../../assets/cards/upstream/chunks/18.json') as SvgChunk;
    case '20': return require('../../../assets/cards/upstream/chunks/20.json') as SvgChunk;
    case '28': return require('../../../assets/cards/upstream/chunks/28.json') as SvgChunk;
    case '30': return require('../../../assets/cards/upstream/chunks/30.json') as SvgChunk;
    case '38': return require('../../../assets/cards/upstream/chunks/38.json') as SvgChunk;
    case '40': return require('../../../assets/cards/upstream/chunks/40.json') as SvgChunk;
    case '48': return require('../../../assets/cards/upstream/chunks/48.json') as SvgChunk;
    case '50': return require('../../../assets/cards/upstream/chunks/50.json') as SvgChunk;
    case '58': return require('../../../assets/cards/upstream/chunks/58.json') as SvgChunk;
    case '60': return require('../../../assets/cards/upstream/chunks/60.json') as SvgChunk;
    case '68': return require('../../../assets/cards/upstream/chunks/68.json') as SvgChunk;
    case '70': return require('../../../assets/cards/upstream/chunks/70.json') as SvgChunk;
    case '78': return require('../../../assets/cards/upstream/chunks/78.json') as SvgChunk;
    case '80': return require('../../../assets/cards/upstream/chunks/80.json') as SvgChunk;
    case '88': return require('../../../assets/cards/upstream/chunks/88.json') as SvgChunk;
    case '90': return require('../../../assets/cards/upstream/chunks/90.json') as SvgChunk;
    case '98': return require('../../../assets/cards/upstream/chunks/98.json') as SvgChunk;
    case 'a0': return require('../../../assets/cards/upstream/chunks/a0.json') as SvgChunk;
    case 'a8': return require('../../../assets/cards/upstream/chunks/a8.json') as SvgChunk;
    case 'b0': return require('../../../assets/cards/upstream/chunks/b0.json') as SvgChunk;
    case 'b8': return require('../../../assets/cards/upstream/chunks/b8.json') as SvgChunk;
    case 'c0': return require('../../../assets/cards/upstream/chunks/c0.json') as SvgChunk;
    case 'c8': return require('../../../assets/cards/upstream/chunks/c8.json') as SvgChunk;
    case 'd0': return require('../../../assets/cards/upstream/chunks/d0.json') as SvgChunk;
    case 'd8': return require('../../../assets/cards/upstream/chunks/d8.json') as SvgChunk;
    case 'e0': return require('../../../assets/cards/upstream/chunks/e0.json') as SvgChunk;
    case 'e8': return require('../../../assets/cards/upstream/chunks/e8.json') as SvgChunk;
    case 'f0': return require('../../../assets/cards/upstream/chunks/f0.json') as SvgChunk;
    case 'f8': return require('../../../assets/cards/upstream/chunks/f8.json') as SvgChunk;
    default: return {};
  }
}
