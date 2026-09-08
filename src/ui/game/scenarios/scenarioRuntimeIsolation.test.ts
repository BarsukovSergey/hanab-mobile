import { expect, test } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

function read(relativePath: string) {
  return fs.readFileSync(path.join(process.cwd(), ...relativePath.split('/')), 'utf8');
}

test('every production gameplay-screen runtime call is covered by the scenario-gallery command gate', () => {
  const gameplayScreens = [
    read('src/ui/game/GameScreen.tsx'),
    read('src/ui/game/C17GameScreen.tsx'),
    read('src/ui/game/LegacyGameScreen.tsx'),
  ].join('\n');
  const application = read('src/runtime/application.ts');

  const runtimeCalls = [...gameplayScreens.matchAll(/\blobbyRuntime\.([A-Za-z0-9_]+)\s*\(/g)]
    .flatMap((match) => match[1] === undefined ? [] : [match[1]]);
  const gateMatch = application.match(/createRuntimeCommandGate\(rawLobbyRuntime,\s*\[([\s\S]*?)\]\s*\)/);
  expect(gateMatch).not.toBeNull();
  const blockedMethods = [...(gateMatch?.[1] ?? '').matchAll(/['"]([A-Za-z0-9_]+)['"]/g)]
    .flatMap((match) => match[1] === undefined ? [] : [match[1]]);

  expect([...new Set(runtimeCalls)].sort()).toEqual([...new Set(blockedMethods)].sort());
  expect(application).toContain('suppressGameplayRuntimeCommands');
});
