import { test, expect, beforeEach, afterEach } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { runSync } from '../../src/cli/sync';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-cli-sync-'));
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: tmp });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmp });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmp });
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
  execFileSync('git', ['add', '-A'], { cwd: tmp });
  execFileSync('git', ['commit', '-q', '-m', 'chore: initial'], { cwd: tmp });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runSync returns zero appended on a clean repo with no ID-referencing commits', () => {
  const r = runSync(tmp, {});
  expect(r.appended).toBe(0);
});

test('runSync appends a single referenced commit', () => {
  writeFileSync(join(tmp, 'a.txt'), 'x');
  execFileSync('git', ['add', '-A'], { cwd: tmp });
  execFileSync('git', ['commit', '-q', '-m', 'feat: STORY-001 add the thing'], { cwd: tmp });

  const r = runSync(tmp, {});
  expect(r.appended).toBe(1);
  expect(r.byId['STORY-001']).toBe(1);
});

test('runSync --dry-run reports counts but does not modify changelogs', () => {
  writeFileSync(join(tmp, 'a.txt'), 'x');
  execFileSync('git', ['add', '-A'], { cwd: tmp });
  execFileSync('git', ['commit', '-q', '-m', 'fix: STORY-001 something'], { cwd: tmp });

  const r1 = runSync(tmp, { dryRun: true });
  expect(r1.appended).toBe(1);

  // Re-running without dry-run should still find the same entry to append.
  const r2 = runSync(tmp, {});
  expect(r2.appended).toBe(1);

  // And one more time with no flag — now it's already there.
  const r3 = runSync(tmp, {});
  expect(r3.appended).toBe(0);
});
