import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setDisabled } from '../../src/core/toggle';

const KADAI_CLI = join(__dirname, '../../src/cli/index.ts');

function seedSpine(root: string): void {
  mkdirSync(join(root, '.kadai/epics'), { recursive: true });
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":0,"feature":0,"story":0,"task":0}');
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n[[phases]]\nslug = "mvp"\ndisplay = "MVP"\ncolor = "#22c55e"\n');
}

function run(cwd: string, ...args: string[]): string {
  return execFileSync('bun', [KADAI_CLI, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
}

test('kadai status without disabled flag does NOT show DISABLED preamble', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-sd-'));
  try {
    seedSpine(root);
    const out = run(root, 'status');
    expect(out).not.toMatch(/DISABLED/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai status with disabled shows DISABLED preamble + since + re-enable hint', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-sd-'));
  try {
    seedSpine(root);
    setDisabled(root, 'quick refactor');
    const out = run(root, 'status');
    expect(out).toMatch(/DISABLED/);
    expect(out).toMatch(/since:/i);
    expect(out).toMatch(/quick refactor/);
    expect(out).toMatch(/kadai enable/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai status with disabled but no reason shows preamble without reason line', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-sd-'));
  try {
    seedSpine(root);
    setDisabled(root);
    const out = run(root, 'status');
    expect(out).toMatch(/DISABLED/);
    expect(out).not.toMatch(/^\s*reason:/m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
