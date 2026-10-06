#!/usr/bin/env node
// Fast local feedback only; npm run validate remains the full gate.
const { spawnSync } = require('node:child_process');
const { readFileSync, existsSync } = require('node:fs');
const path = require('node:path');

const normalize = (file) => file.replace(/\\/g, '/');
const unique = (files) => [...new Set(files)].sort();

function run(command, args, cwd, inherit = false) {
  const result = spawnSync(command, args, {
    cwd, encoding: 'utf8', stdio: inherit ? 'inherit' : 'pipe',
    maxBuffer: 32 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const error = new Error(`${command} failed (${result.status ?? result.signal})${result.stderr ? `:\n${result.stderr.trim()}` : ''}`);
    error.exitCode = result.status || 1;
    throw error;
  }
  return result.stdout;
}

function parseArgs(args) {
  let base;
  let list = false;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--list') list = true;
    else if (args[i] === '--base' && args[i + 1] && !args[i + 1].startsWith('-') && !base) base = args[++i];
    else throw new Error('Usage: npm run test:affected -- [--base <ref>] [--list]');
  }
  return { base, list };
}

function discoverChanges(cwd, explicitBase) {
  const git = (args) => run('git', args, cwd);
  const root = git(['rev-parse', '--show-toplevel']).trim();
  let base = explicitBase;
  if (!base) {
    for (const ref of ['refs/remotes/origin/main', 'refs/heads/main']) {
      // An absent ref is expected; all other Git failures remain failures.
      const result = spawnSync('git', ['show-ref', '--verify', '--quiet', ref], { cwd: root });
      if (result.error) throw result.error;
      if (result.status === 0) { base = ref; break; }
      if (result.status !== 1) throw new Error(`git show-ref failed (${result.status ?? result.signal})`);
    }
  }
  const fallback = !base;
  base = base || 'HEAD';
  const mergeBase = run('git', ['merge-base', 'HEAD', base], root).trim();
  const paths = (args) => run('git', args, root).split('\0').filter(Boolean).map(normalize);
  const changed = unique([
    ...paths(['diff', '--name-only', '-z', '--no-renames', mergeBase, 'HEAD', '--']),
    ...paths(['diff', '--cached', '--name-only', '-z', '--no-renames', '--']),
    ...paths(['diff', '--name-only', '-z', '--no-renames', '--']),
    ...paths(['ls-files', '--others', '--exclude-standard', '-z']),
  ]);
  return { root, base, fallback, changed, tracked: paths(['ls-files', '-z']) };
}

function matchesSourceRead(source, changedFile) {
  // Includes fs.promises.readFile, aliases of readFile, and textual read helpers.
  // This is deliberately lexical, not an attempt to interpret test JavaScript.
  if (!/\b(?:readFileSync|readFile|readTextFile|readTextFileSync)\b/.test(source)) return false;
  const filename = path.posix.basename(normalize(changedFile));
  const escaped = filename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Basename covers repository paths, relative paths and path.join segments.
  // Boundaries avoid App.tsx accidentally matching OtherApp.tsx or App.tsx.bak.
  return new RegExp(`(^|[^A-Za-z0-9_.-])${escaped}(?=$|[^A-Za-z0-9_.-])`).test(normalize(source));
}

function selectTests({ changed, tracked, suites, related, readSource }) {
  const configured = new Set(suites);
  const trackedSet = new Set(tracked);
  const selected = new Set(related.filter((file) => configured.has(file)));
  for (const file of changed) if (configured.has(file)) selected.add(file);
  const implementation = changed.filter((file) => !configured.has(file));
  for (const suite of suites) {
    if (!trackedSet.has(suite) || selected.has(suite)) continue;
    const source = readSource(suite);
    if (implementation.some((file) => matchesSourceRead(source, file))) selected.add(suite);
  }
  return unique([...selected]);
}

function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);
  const changes = discoverChanges(process.cwd(), options.base);
  const { root, changed } = changes;
  console.log(`Base: ${changes.base}${changes.fallback ? ' (fallback: neither main ref exists; committed branch changes unavailable)' : ''}`);
  console.log(`Changed files considered (${changed.length}):`);
  for (const file of changed) console.log(`  ${file}`);
  if (!changed.length) {
    console.log('Selected test suites (0):');
    console.log('No affected tests.');
    return;
  }

  const jestBin = require.resolve('jest/bin/jest', { paths: [root] });
  const jest = (args) => run(process.execPath, [jestBin, ...args], root);
  const relative = (file) => normalize(path.relative(root, file));
  // Ask the existing Jest configuration which files are suites; no copied globs.
  const suites = JSON.parse(jest(['--listTests', '--json', '--runInBand'])).map(relative);
  const inputs = changed.filter((file) => !suites.includes(file));
  const related = inputs.length
    ? JSON.parse(jest(['--findRelatedTests', ...inputs, '--listTests', '--json', '--runInBand', '--passWithNoTests'])).map(relative)
    : [];
  const selected = selectTests({
    ...changes, suites, related,
    readSource: (file) => readFileSync(path.join(root, file), 'utf8'),
  }).filter((file) => existsSync(path.join(root, file)));
  console.log(`Selected test suites (${selected.length}):`);
  for (const file of selected) console.log(`  ${file}`);
  if (!selected.length) { console.log('No affected tests.'); return; }
  if (!options.list) run(process.execPath, [jestBin, '--runInBand', '--runTestsByPath', ...selected], root, true);
}

module.exports = { parseArgs, discoverChanges, matchesSourceRead, selectTests, main };
if (require.main === module) {
  try { main(); }
  catch (error) { console.error(error.message); process.exitCode = error.exitCode || 1; }
}
