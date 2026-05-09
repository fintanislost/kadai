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
    // Pass an unknown subcommand; commander returns a non-zero exit reliably.
    const result = runKadai({ KADAI_RECORD_TO: cassettePath }, 'definitely-not-a-real-subcommand');
    // Cassette MUST exist regardless of what the CLI returned — that's the whole point of the test.
    expect(existsSync(cassettePath)).toBe(true);
    const line = readFileSync(cassettePath, 'utf8').trim();
    const parsed = JSON.parse(line);
    expect(parsed.argv).toEqual(['definitely-not-a-real-subcommand']);
    // Commander exits non-zero on unknown subcommand — verify both the captured exit
    // and the actual subprocess exit are non-zero (and consistent with each other).
    expect(parsed.exit).not.toBe(0);
    expect(result.status).not.toBe(0);
    expect(parsed.exit).toBe(result.status);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI does NOT record `hook` subcommands (session lifecycle noise)', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    // hook subcommands read stdin; we feed empty stdin so they exit cleanly.
    runKadai({ KADAI_RECORD_TO: cassettePath }, 'hook', '--help');
    if (existsSync(cassettePath)) {
      const lines = readFileSync(cassettePath, 'utf8').trim().split('\n').filter(Boolean);
      // No line should record a `hook ...` invocation.
      for (const line of lines) {
        const parsed = JSON.parse(line) as { argv: string[] };
        expect(parsed.argv[0]).not.toBe('hook');
      }
    }
    // No file is also acceptable — it means filter ran and nothing was written.
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI does NOT record `mcp` or `serve` subcommands', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    runKadai({ KADAI_RECORD_TO: cassettePath }, 'mcp', '--help');
    runKadai({ KADAI_RECORD_TO: cassettePath }, 'serve', '--help');
    if (existsSync(cassettePath)) {
      const lines = readFileSync(cassettePath, 'utf8').trim().split('\n').filter(Boolean);
      for (const line of lines) {
        const parsed = JSON.parse(line) as { argv: string[] };
        expect(parsed.argv[0]).not.toBe('mcp');
        expect(parsed.argv[0]).not.toBe('serve');
      }
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI DOES record spine-mutating subcommands like `add` and `init`', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    runKadai({ KADAI_RECORD_TO: cassettePath }, 'init', '-y');
    expect(existsSync(cassettePath)).toBe(true);
    const lines = readFileSync(cassettePath, 'utf8').trim().split('\n').filter(Boolean);
    expect(lines.length).toBeGreaterThanOrEqual(1);
    const initCall = lines.map(l => JSON.parse(l) as { argv: string[] }).find(c => c.argv[0] === 'init');
    expect(initCall).toBeTruthy();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI calls now record with kind:cli', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    runKadai({ KADAI_RECORD_TO: cassettePath }, '--version');
    const lines = readFileSync(cassettePath, 'utf8').trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]) as { kind: string; argv: string[] };
    expect(parsed.kind).toBe('cli');
    expect(parsed.argv).toEqual(['--version']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
