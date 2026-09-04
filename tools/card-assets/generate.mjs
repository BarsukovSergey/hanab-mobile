import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPSTREAM_COMMIT, UPSTREAM_REPOSITORY } from './upstreamPin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_DIR = path.join(ROOT, '.cache', 'hanabi-live-card-assets');
const OUTPUT_DIR = path.join(ROOT, 'assets', 'cards', 'upstream');
const RUNNER = path.join(ROOT, 'tools', 'card-assets', 'runUpstream.ts');
const READY_MARKER = path.join(CACHE_DIR, '.git', 'hanab-mobile-card-assets-ready');
const checkOnly = process.argv.includes('--check');

function executable(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function run(command, args, cwd = ROOT) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
}

async function exists(target) {
  try {
    await stat(target);
    return true;
  } catch {
    return false;
  }
}

async function ensureUpstreamCheckout() {
  await mkdir(path.dirname(CACHE_DIR), { recursive: true });

  if (!(await exists(path.join(CACHE_DIR, '.git')))) {
    await rm(CACHE_DIR, { recursive: true, force: true });
    run('git', ['clone', '--filter=blob:none', '--no-checkout', UPSTREAM_REPOSITORY, CACHE_DIR]);
  }

  run('git', ['fetch', 'origin', UPSTREAM_COMMIT, '--depth=1'], CACHE_DIR);
  run('git', ['checkout', '--detach', '--force', UPSTREAM_COMMIT], CACHE_DIR);
  run('git', ['reset', '--hard', UPSTREAM_COMMIT], CACHE_DIR);
  run('git', ['clean', '-fd'], CACHE_DIR);

  let readyCommit = '';
  if (await exists(READY_MARKER)) {
    readyCommit = (await readFile(READY_MARKER, 'utf8')).trim();
  }

  const gameDist = path.join(CACHE_DIR, 'packages', 'game', 'dist', 'index.js');
  if (readyCommit !== UPSTREAM_COMMIT || !(await exists(gameDist))) {
    run(executable('npm'), ['ci'], CACHE_DIR);
    run(executable('npm'), ['--prefix', 'packages/game', 'run', 'build'], CACHE_DIR);
    await writeFile(READY_MARKER, `${UPSTREAM_COMMIT}\n`, 'utf8');
  }
}

async function listFiles(root, relative = '') {
  const current = path.join(root, relative);
  if (!(await exists(current))) {
    return [];
  }

  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const next = path.join(relative, entry.name);
    if (entry.isDirectory()) {
      files.push(...await listFiles(root, next));
    } else if (entry.isFile()) {
      files.push(next.replaceAll('\\', '/'));
    }
  }
  return files.sort();
}

async function assertDirectoriesEqual(expectedDir, actualDir) {
  const expectedFiles = await listFiles(expectedDir);
  const actualFiles = await listFiles(actualDir);

  if (JSON.stringify(expectedFiles) !== JSON.stringify(actualFiles)) {
    throw new Error('Generated card asset file list differs from committed assets. Run npm run cards:generate.');
  }

  for (const relative of expectedFiles) {
    const [expected, actual] = await Promise.all([
      readFile(path.join(expectedDir, relative)),
      readFile(path.join(actualDir, relative)),
    ]);
    if (!expected.equals(actual)) {
      throw new Error(`Generated card asset differs: ${relative}. Run npm run cards:generate.`);
    }
  }
}

async function main() {
  await ensureUpstreamCheckout();

  const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'hanab-card-assets-'));
  const generatedDir = path.join(tempRoot, 'upstream');
  await mkdir(generatedDir, { recursive: true });

  try {
    run(
      executable('npx'),
      ['--no-install', 'tsx', RUNNER, CACHE_DIR, generatedDir, UPSTREAM_COMMIT],
      CACHE_DIR,
    );

    if (checkOnly) {
      await assertDirectoriesEqual(OUTPUT_DIR, generatedDir);
      console.log('Card assets match the pinned upstream renderer.');
      return;
    }

    await rm(OUTPUT_DIR, { recursive: true, force: true });
    await mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
    await cp(generatedDir, OUTPUT_DIR, { recursive: true });
    console.log(`Generated card assets from ${UPSTREAM_COMMIT}.`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();