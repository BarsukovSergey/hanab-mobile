import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

const ALLOWED_PREFIXES = [
  'src/game/upstream/',
  'src/game/selectors/',
  'src/game/c2/',
];

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(target);
    return /\.tsx?$/.test(entry.name) ? [target] : [];
  });
}

test('direct upstream imports stay inside the allowed C2 boundary', () => {
  const projectRoot = process.cwd();
  const upstreamRoot = path.join(projectRoot, 'src', 'game', 'upstream');
  const files = [path.join(projectRoot, 'App.tsx'), ...sourceFiles(path.join(projectRoot, 'src'))];
  const violations = files.flatMap((file) => {
    const relative = path.relative(projectRoot, file).replaceAll('\\', '/');
    if (ALLOWED_PREFIXES.some((prefix) => relative.startsWith(prefix))) return [];
    const text = fs.readFileSync(file, 'utf8');
    const imports = [...text.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)]
      .map((match) => match[1])
      .filter((specifier): specifier is string => specifier !== undefined);
    const importsUpstream = imports.some((specifier) => {
      if (specifier.includes('src/game/upstream')) return true;
      if (!specifier.startsWith('.')) return false;
      const resolved = path.resolve(path.dirname(file), specifier);
      return resolved === upstreamRoot || resolved.startsWith(`${upstreamRoot}${path.sep}`);
    });
    return importsUpstream
      ? [relative]
      : [];
  });

  expect(violations).toEqual([]);
});
