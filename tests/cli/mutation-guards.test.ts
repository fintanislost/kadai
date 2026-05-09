import { test, expect, describe } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setDisabled } from '../../src/core/toggle';

const KADAI_CLI = join(__dirname, '../../src/cli/index.ts');

function seedSpine(root: string): void {
  mkdirSync(join(root, '.kadai/epics/EPIC-001-x'), { recursive: true });
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":1,"feature":0,"story":0,"task":0}');
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n[[phases]]\nslug = "mvp"\ndisplay = "MVP"\ncolor = "#22c55e"\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: ready\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
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

const MUTATING_COMMANDS: Array<{ name: string; argv: string[] }> = [
  { name: 'add epic',       argv: ['add', 'epic',    '--title', 'Test', '--phase', 'mvp'] },
  { name: 'add feature',    argv: ['add', 'feature', '--title', 'Test', '--phase', 'mvp', '--epic', 'EPIC-001'] },
  { name: 'pick',           argv: ['pick', 'STORY-001'] },
  { name: 'unpick',         argv: ['unpick'] },
  { name: 'set-status',     argv: ['set-status', 'EPIC-001', 'in_progress'] },
  { name: 'sync',           argv: ['sync'] },
  { name: 'phases add',     argv: ['phases', 'add', 'alpha', 'Alpha'] },
  { name: 'phases rename',  argv: ['phases', 'rename', 'mvp', 'v1', 'Version 1'] },
  { name: 'phases remove',  argv: ['phases', 'remove', 'mvp'] },
  { name: 'config set',     argv: ['config', 'change_capture.enabled=false'] },
];

describe('mutation guards', () => {
  for (const { name, argv } of MUTATING_COMMANDS) {
    test(`${name} errors when disabled`, () => {
      const root = mkdtempSync(join(tmpdir(), 'kadai-mg-'));
      try {
        seedSpine(root);
        setDisabled(root, 'test');
        const r = run(root, ...argv);
        expect(r.status).not.toBe(0);
        expect(r.stderr + r.stdout).toMatch(/kadai is disabled/i);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });

    test(`${name} works when NOT disabled`, () => {
      const root = mkdtempSync(join(tmpdir(), 'kadai-mg-'));
      try {
        seedSpine(root);
        const r = run(root, ...argv);
        // We're not asserting success — some commands might still fail for other
        // reasons (e.g. pick STORY-001 fails because no STORY-001 exists). The
        // assertion is that the FAILURE MODE is NOT the disabled message.
        expect(r.stderr + r.stdout).not.toMatch(/kadai is disabled/i);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });
  }

  test('READ commands work when disabled (sanity — list epics, status)', () => {
    const root = mkdtempSync(join(tmpdir(), 'kadai-mg-'));
    try {
      seedSpine(root);
      setDisabled(root, 'test');
      const list = run(root, 'list', 'epics');
      expect(list.status).toBe(0);
      // status should also work and show DISABLED preamble (Task 6 enforces it)
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('config get works when disabled (read-only subcommand)', () => {
    const root = mkdtempSync(join(tmpdir(), 'kadai-mg-'));
    try {
      seedSpine(root);
      setDisabled(root, 'test');
      const r = run(root, 'config', 'change_capture.enabled');
      // read config should not be blocked by the disabled guard
      expect(r.stderr + r.stdout).not.toMatch(/kadai is disabled/i);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });

  test('phases list works when disabled (read-only subcommand)', () => {
    const root = mkdtempSync(join(tmpdir(), 'kadai-mg-'));
    try {
      seedSpine(root);
      setDisabled(root, 'test');
      const r = run(root, 'phases', 'list');
      expect(r.status).toBe(0);
      expect(r.stderr + r.stdout).not.toMatch(/kadai is disabled/i);
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
