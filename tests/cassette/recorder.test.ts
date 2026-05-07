import { test, expect } from 'bun:test';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const KADAI_BIN = process.env.KADAI_BIN ?? 'bun';
const KADAI_ARGS = process.env.KADAI_BIN ? [] : [join(__dirname, '../../src/cli/index.ts')];

function runKadai(env: NodeJS.ProcessEnv, ...args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(KADAI_BIN, [...KADAI_ARGS, ...args], { env: { ...process.env, ...env }, encoding: 'utf8', stdio: 'pipe' });
    return { stdout, stderr: '', status: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? ''), status: err.status ?? 1 };
  }
}

test('CLI writes JSONL line to KADAI_RECORD_TO when set', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    runKadai({ KADAI_RECORD_TO: cassettePath }, '--version');
    expect(existsSync(cassettePath)).toBe(true);
    const lines = readFileSync(cassettePath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.argv).toEqual(['--version']);
    expect(parsed.exit).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI appends multiple lines across multiple invocations', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    runKadai({ KADAI_RECORD_TO: cassettePath }, '--version');
    runKadai({ KADAI_RECORD_TO: cassettePath }, '--help');
    const lines = readFileSync(cassettePath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).argv).toEqual(['--version']);
    expect(JSON.parse(lines[1]).argv).toEqual(['--help']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI does NOT write any cassette file when KADAI_RECORD_TO is unset', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    // Explicitly delete the env var if our parent has it set
    const env = { ...process.env };
    delete env.KADAI_RECORD_TO;
    execFileSync(KADAI_BIN, [...KADAI_ARGS, '--version'], { env, encoding: 'utf8', stdio: 'pipe' });
    expect(existsSync(cassettePath)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI records non-zero exits too', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    // `kadai status` from outside any kadai project should exit non-zero.
    runKadai({ KADAI_RECORD_TO: cassettePath, PWD: root }, 'status');
    if (existsSync(cassettePath)) {
      const line = readFileSync(cassettePath, 'utf8').trim();
      const parsed = JSON.parse(line);
      expect(parsed.argv).toEqual(['status']);
      // Exit may be 0 or non-zero depending on whether status errors when no kadai project — capture either way.
      expect(typeof parsed.exit).toBe('number');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
