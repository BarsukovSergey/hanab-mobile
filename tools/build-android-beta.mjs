import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const app = JSON.parse(readFileSync(path.join(root, 'app.json'), 'utf8'));
const version = app.expo?.version ?? 'unknown';
const androidDir = path.join(root, 'android');
const outputDir = path.join(root, 'dist');
const builtApk = path.join(androidDir, 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk');
const outputApk = path.join(outputDir, `Hanab-Mobile-${version}.apk`);

run(process.platform === 'win32' ? 'npx.cmd' : 'npx', [
  'expo',
  'prebuild',
  '--platform',
  'android',
  '--no-install',
  '--clean',
], root);

const gradleWrapper = process.platform === 'win32'
  ? path.join(androidDir, 'gradlew.bat')
  : path.join(androidDir, 'gradlew');

if (!existsSync(gradleWrapper)) {
  throw new Error(`Gradle wrapper not found at ${gradleWrapper}`);
}
if (process.platform !== 'win32') chmodSync(gradleWrapper, 0o755);

run(gradleWrapper, [':app:assembleRelease'], androidDir);

if (!existsSync(builtApk)) {
  throw new Error(`Release APK was not produced at ${builtApk}`);
}

mkdirSync(outputDir, { recursive: true });
copyFileSync(builtApk, outputApk);

console.log(`Android beta APK: ${path.relative(root, outputApk)}`);

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} exited with status ${result.status ?? 'unknown'}`);
  }
}
