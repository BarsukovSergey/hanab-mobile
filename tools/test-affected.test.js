const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { parseArgs, discoverChanges, matchesSourceRead, selectTests } = require('./test-affected.cjs');

test('CLI accepts an explicit base and list mode, rejecting malformed options', () => {
  expect(parseArgs(['--list', '--base', 'HEAD~2'])).toEqual({ base: 'HEAD~2', list: true });
  for (const args of [['--base'], ['--base', '--list'], ['--unknown'], ['--base', 'main', '--base', 'HEAD']]) {
    expect(() => parseArgs(args)).toThrow('Usage:');
  }
});

test.each([
  ["readFileSync('App.tsx')", 'App.tsx'],
  ["readFileSync(resolve(__dirname, '../../App.tsx'))", 'App.tsx'],
  ["fs.readFileSync(path.join(root, 'src', 'ui', 'game', 'C17GameScreen.tsx'))", 'src/ui/game/C17GameScreen.tsx'],
  ["readFileSync('src/ui/screens/PeopleScreen.tsx')", 'src/ui/screens/PeopleScreen.tsx'],
  ["fs.promises.readFile('./PeopleScreen.tsx')", 'src/ui/screens/PeopleScreen.tsx'],
  ["import { readFile as read } from 'node:fs/promises'; read('PeopleScreen.tsx')", 'src/ui/screens/PeopleScreen.tsx'],
  ['readFileSync("src\\\\ui\\\\screens\\\\PeopleScreen.tsx")', 'src\\ui\\screens\\PeopleScreen.tsx'],
])('matches textual source reference %s', (source, file) => {
  expect(matchesSourceRead(source, file)).toBe(true);
});

test('matching is conservative but does not select unrelated source contracts', () => {
  expect(matchesSourceRead("readFileSync('OtherApp.tsx')", 'App.tsx')).toBe(false);
  expect(matchesSourceRead("readFileSync('App.tsx.bak')", 'App.tsx')).toBe(false);
  expect(matchesSourceRead("import App from './App.tsx'", 'App.tsx')).toBe(false);
  expect(matchesSourceRead("readFileSync('PeopleScreen.tsx')", 'docs/README.md')).toBe(false);
});

test('selection combines normal, changed and tracked textual suites exactly once', () => {
  const sources = {
    'contract.test.js': "readFileSync('../App.tsx')",
    'unrelated.test.js': "readFileSync('Other.tsx')",
    'untracked.test.js': "readFileSync('App.tsx')",
  };
  expect(selectTests({
    changed: ['App.tsx', 'changed.test.js', 'new.test.js'],
    tracked: ['contract.test.js', 'unrelated.test.js'],
    suites: ['normal.test.js', 'changed.test.js', 'new.test.js', ...Object.keys(sources)],
    related: ['normal.test.js', 'contract.test.js', 'ignored.test.js'],
    readSource: (file) => sources[file],
  })).toEqual(['changed.test.js', 'contract.test.js', 'new.test.js', 'normal.test.js']);
  expect(selectTests({
    changed: ['docs/README.md'], tracked: Object.keys(sources),
    suites: Object.keys(sources), related: [], readSource: (file) => sources[file],
  })).toEqual([]);
});

describe('local Git discovery', () => {
  let root;
  const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const write = (file, text = file) => writeFileSync(path.join(root, file), text);
  const commit = () => { git('add', '.'); git('commit', '-qm', 'fixture'); };
  beforeEach(() => {
    root = mkdtempSync(path.join(tmpdir(), 'hanab-affected-'));
    git('init', '-q', '-b', 'main');
    git('config', 'user.name', 'Fixture');
    git('config', 'user.email', 'fixture@example.invalid');
    git('config', 'commit.gpgsign', 'false');
    write('initial.txt');
    commit();
  });
  afterEach(() => rmSync(root, { recursive: true, force: true }));

  test('uses merge base, includes branch/index/worktree/untracked paths and deduplicates', () => {
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('switch', '-qc', 'topic');
    write('branch.txt');
    commit();
    const topic = git('rev-parse', 'HEAD');
    git('switch', '-q', 'main');
    write('main-only.txt');
    commit();
    git('update-ref', 'refs/remotes/origin/main', 'HEAD');
    git('switch', '-q', 'topic');
    write('staged.txt');
    write('branch.txt', 'staged');
    git('add', '.');
    write('branch.txt', 'unstaged');
    write('initial.txt', 'unstaged');
    write('untracked space.txt');
    mkdirSync(path.join(root, 'nested'));
    const result = discoverChanges(path.join(root, 'nested'));
    expect(result.base).toBe('refs/remotes/origin/main');
    expect(result.changed).toEqual(['branch.txt', 'initial.txt', 'staged.txt', 'untracked space.txt']);
    expect(discoverChanges(root, topic).changed).toEqual(result.changed);
    expect(() => discoverChanges(root, 'missing-ref')).toThrow('git failed');
  });

  test('uses local main then explicit HEAD fallback and handles a clean worktree', () => {
    expect(discoverChanges(root).base).toBe('refs/heads/main');
    expect(discoverChanges(root).changed).toEqual([]);
    git('branch', '-m', 'topic');
    expect(discoverChanges(root)).toMatchObject({ base: 'HEAD', fallback: true, changed: [] });
    write('harmless.md');
    expect(discoverChanges(root).changed).toEqual(['harmless.md']);
  });

  test('retains deleted and both renamed paths for textual source matching', () => {
    write('Old.tsx');
    commit();
    git('mv', 'Old.tsx', 'New.tsx');
    git('rm', '-q', 'initial.txt');
    expect(discoverChanges(root).changed).toEqual(['New.tsx', 'Old.tsx', 'initial.txt']);
  });
});
