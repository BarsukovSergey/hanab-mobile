import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), ...relativePath.split('/')), 'utf8');
}

test('every GameScreen runtime call is covered by the scenario-gallery command gate', () => {
  const gameScreen = read('src/ui/game/GameScreen.tsx');
  const application = read('src/runtime/application.ts');

  const runtimeCalls = [...gameScreen.matchAll(/\blobbyRuntime\.([A-Za-z0-9_]+)\s*\(/g)]
    .flatMap((match) => match[1] === undefined ? [] : [match[1]]);
  const gateMatch = application.match(/createRuntimeCommandGate\(rawLobbyRuntime,\s*\[([\s\S]*?)\]\s*\)/);
  expect(gateMatch).not.toBeNull();
  const blockedMethods = [...(gateMatch?.[1] ?? '').matchAll(/['"]([A-Za-z0-9_]+)['"]/g)]
    .flatMap((match) => match[1] === undefined ? [] : [match[1]]);

  expect([...new Set(runtimeCalls)].sort()).toEqual([...new Set(blockedMethods)].sort());
  expect(application).toContain('suppressGameplayRuntimeCommands');
});
