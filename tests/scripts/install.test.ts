import { test, expect, beforeEach, afterEach } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCRIPT = join(import.meta.dir, '..', '..', 'scripts', 'install.sh');

let tmp: string;
let releaseDir: string;
let binDir: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-install-'));
  releaseDir = join(tmp, 'release');
  binDir = join(tmp, 'bin');
  mkdirSync(releaseDir, { recursive: true });
  mkdirSync(binDir, { recursive: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function detectExpectedBinaryName(): string {
  const platform = process.platform;
  const arch = process.arch;
  const os = platform === 'darwin' ? 'darwin' : platform === 'linux' ? 'linux' : 'windows';
  const a = arch === 'x64' ? 'x64' : 'arm64';
  const suffix = os === 'windows' ? '.exe' : '';
  return `kadai-${os}-${a}${suffix}`;
}

test('install.sh downloads the OS/arch-matched binary and chmod +x', () => {
  const expected = detectExpectedBinaryName();
  writeFileSync(join(releaseDir, expected), '#!/bin/sh\necho "kadai stub v0\n"\n');

  execFileSync('bash', [SCRIPT], {
    env: { ...process.env, INSTALL_URL: `file://${releaseDir}`, BIN_DIR: binDir, HOME: tmp },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const placed = join(binDir, expected.startsWith('kadai-windows') ? 'kadai.exe' : 'kadai');
  expect(existsSync(placed)).toBe(true);
  expect(readFileSync(placed, 'utf8')).toContain('kadai stub');
  expect((statSync(placed).mode & 0o111) !== 0).toBe(true);
});

test('install.sh fails cleanly when the matched binary is missing', () => {
  let err: Error | null = null;
  try {
    execFileSync('bash', [SCRIPT], {
      env: { ...process.env, INSTALL_URL: `file://${releaseDir}`, BIN_DIR: binDir, HOME: tmp },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e: unknown) {
    err = e as Error;
  }
  expect(err).not.toBeNull();
});

test('install.sh prints PATH warning when BIN_DIR is not on $PATH', () => {
  const expected = detectExpectedBinaryName();
  writeFileSync(join(releaseDir, expected), 'fake');

  const r = execFileSync('bash', [SCRIPT], {
    env: { INSTALL_URL: `file://${releaseDir}`, BIN_DIR: binDir, HOME: tmp, PATH: '/usr/bin:/bin' },
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf8',
  });
  expect(r).toMatch(/not on your \$PATH/);
});
