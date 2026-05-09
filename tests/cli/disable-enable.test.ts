import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const KADAI_CLI = join(__dirname, '../../src/cli/index.ts');

function fresh(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-de-'));
  mkdirSync(join(tmp, '.kadai/epics'), { recursive: true });
  // Minimum spine for findKadaiRoot to find this tmp.
  return tmp;
}

function run(cwd: string, ...args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync('bun', [KADAI_CLI, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { stdout, stderr: '', status: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? ''), status: err.status ?? 1 };
  }
}

test('kadai disable creates .kadai/disabled with timestamp; exits 0', () => {
  const root = fresh();
  try {
    const r = run(root, 'disable');
    expect(r.status).toBe(0);
    expect(existsSync(join(root, '.kadai/disabled'))).toBe(true);
    expect(readFileSync(join(root, '.kadai/disabled'), 'utf8')).toMatch(/disabled-since:/);
    expect(r.stdout).toMatch(/disabled/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai disable --reason "..." records the reason', () => {
  const root = fresh();
  try {
    const r = run(root, 'disable', '--reason', 'quick refactor');
    expect(r.status).toBe(0);
    expect(readFileSync(join(root, '.kadai/disabled'), 'utf8')).toContain('reason: quick refactor');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai enable removes .kadai/disabled; exits 0', () => {
  const root = fresh();
  try {
    run(root, 'disable');
    const r = run(root, 'enable');
    expect(r.status).toBe(0);
    expect(existsSync(join(root, '.kadai/disabled'))).toBe(false);
    expect(r.stdout).toMatch(/enabled/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai disable while already disabled is a no-op + warning', () => {
  const root = fresh();
  try {
    run(root, 'disable', '--reason', 'first');
    const r = run(root, 'disable', '--reason', 'second');
    expect(r.status).toBe(0);
    expect(r.stderr + r.stdout).toMatch(/already disabled/i);
    // First reason preserved (we don't auto-overwrite without explicit instruction)
    expect(readFileSync(join(root, '.kadai/disabled'), 'utf8')).toContain('reason: first');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai enable while already enabled is a no-op + info', () => {
  const root = fresh();
  try {
    const r = run(root, 'enable');
    expect(r.status).toBe(0);
    expect(r.stderr + r.stdout).toMatch(/already enabled/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
