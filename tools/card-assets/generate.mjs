import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UPSTREAM_COMMIT, UPSTREAM_REPOSITORY } from './upstreamPin.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE_DIR = path.join(ROOT, '.cache', 'hanabi-live-card-assets');
const OUTPUT_DIR = path.join(ROOT, 'assets', 'cards', 'upstream');
const UI_OUTPUT_DIR = path.join(ROOT, 'assets', 'ui', 'upstream');
const UI_ASSET_FILES = [
  'critical.png', 'trashcan2.png', 'wastebasket.png', 'dda.png', 'wrench.png',
  'question-mark2.png', 'exclamation-mark.png', 'note.png',
];
const RUNNER = path.join(ROOT, 'tools', 'card-assets', 'runUpstream.ts');
const READY_MARKER = path.join(CACHE_DIR, '.git', 'hanab-mobile-card-assets-ready');
const checkOnly = process.argv.includes('--check');

function executable(name) {
  return process.platform === 'win32' ? `${name}.cmd` : name;
}

function run(command, args, cwd = ROOT) {
  const needsShell = process.platform === 'win32' && /\.(?:cmd|bat)$/i.test(command);
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: needsShell,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
  }
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
    const gameDistDir = path.dirname(gameDist);
    await rm(gameDistDir, { recursive: true, force: true });
    run(process.execPath, [
      path.join(CACHE_DIR, 'node_modules', 'typescript', 'bin', 'tsc'),
      '--project',
      path.join(CACHE_DIR, 'packages', 'game', 'tsconfig.npm.json'),
    ], CACHE_DIR);
    if (!(await exists(gameDist))) {
      throw new Error('Pinned upstream game build did not produce packages/game/dist/index.js.');
    }
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
  const generatedUiDir = path.join(tempRoot, 'ui-upstream');
  await mkdir(generatedDir, { recursive: true });
  await mkdir(generatedUiDir, { recursive: true });

  try {
    run(
      executable('npx'),
      ['--no-install', 'tsx', RUNNER, CACHE_DIR, generatedDir, UPSTREAM_COMMIT],
      CACHE_DIR,
    );
    for (const filename of UI_ASSET_FILES) {
      await cp(path.join(CACHE_DIR, 'public', 'img', filename), path.join(generatedUiDir, filename));
    }

    if (checkOnly) {
      await assertDirectoriesEqual(OUTPUT_DIR, generatedDir);
      await assertDirectoriesEqual(UI_OUTPUT_DIR, generatedUiDir);
      console.log('Card assets match the pinned upstream renderer.');
      return;
    }

    await rm(OUTPUT_DIR, { recursive: true, force: true });
    await mkdir(path.dirname(OUTPUT_DIR), { recursive: true });
    await cp(generatedDir, OUTPUT_DIR, { recursive: true });
    await rm(UI_OUTPUT_DIR, { recursive: true, force: true });
    await mkdir(path.dirname(UI_OUTPUT_DIR), { recursive: true });
    await cp(generatedUiDir, UI_OUTPUT_DIR, { recursive: true });
    console.log(`Generated card assets from ${UPSTREAM_COMMIT}.`);
  } finally {
    await rm(tempRoot, { recursive: true, force: true });
  }
}

await main();
