import { test, expect, beforeEach, afterEach } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { setStatus } from '../../src/core/operations';
import { loadConfig, saveConfig } from '../../src/config/load';
import { syncChangelogs, extractIdRefs } from '../../src/core/sync';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-sync-'));
  // Init a git repo first (sync needs one).
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: tmp });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmp });
  execFileSync('git', ['config', 'user.name', 'Test'], { cwd: tmp });
  // Then init kadai inside it.
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
  // Initial commit so the repo has history.
  execFileSync('git', ['add', '-A'], { cwd: tmp });
  execFileSync('git', ['commit', '-q', '-m', 'chore: initial spine'], { cwd: tmp });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function commit(subject: string, body?: string): void {
  writeFileSync(join(tmp, 'f-' + Date.now() + Math.random() + '.txt'), 'x');
  execFileSync('git', ['add', '-A'], { cwd: tmp });
  const msg = body ? `${subject}\n\n${body}` : subject;
  execFileSync('git', ['commit', '-q', '-m', msg], { cwd: tmp });
}

function changelogFor(itemId: string): string | null {
  const item = findById(tmp, itemId);
  if (!item) return null;
  const path = join(dirname(item.path), 'changelog.md');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

test('extractIdRefs finds STORY-NNN in a string', () => {
  expect(extractIdRefs('Fixes STORY-001 and EPIC-042 today')).toEqual(['STORY-001', 'EPIC-042']);
});

test('extractIdRefs handles all four kinds', () => {
  expect(extractIdRefs('EPIC-1 FEAT-2 STORY-3 TASK-4')).toEqual(['EPIC-1', 'FEAT-2', 'STORY-3', 'TASK-4']);
});

test('extractIdRefs dedups within a single string', () => {
  expect(extractIdRefs('STORY-001 again STORY-001')).toEqual(['STORY-001']);
});

test('extractIdRefs returns [] when nothing matches', () => {
  expect(extractIdRefs('No refs here')).toEqual([]);
});

test('extractIdRefs ignores look-alikes (no word boundary)', () => {
  expect(extractIdRefs('xSTORY-001 STORY-001y')).toEqual([]);
});

test('syncChangelogs appends a referenced commit to the story changelog', () => {
  commit('feat: implement Email login STORY-001');
  const result = syncChangelogs(tmp);
  expect(result.appended).toBe(1);
  expect(result.scanned).toBeGreaterThanOrEqual(1);
  const log = changelogFor('STORY-001');
  expect(log).not.toBeNull();
  expect(log).toMatch(/`commit` [0-9a-f]{7}/);
  expect(log).toContain('feat: implement Email login STORY-001');
});

test('syncChangelogs is idempotent (re-running adds nothing)', () => {
  commit('feat: add thing STORY-001');
  syncChangelogs(tmp);
  const before = changelogFor('STORY-001')!;
  const second = syncChangelogs(tmp);
  expect(second.appended).toBe(0);
  expect(changelogFor('STORY-001')).toBe(before);
});

test('syncChangelogs routes to multiple items when commit references several', () => {
  commit('feat: cross-cutting STORY-001 and FEAT-001');
  const result = syncChangelogs(tmp);
  expect(result.appended).toBe(2);
  expect(changelogFor('STORY-001')).toContain('cross-cutting');
  expect(changelogFor('FEAT-001')).toContain('cross-cutting');
});

test('syncChangelogs skips ID refs that do not exist in the spine', () => {
  commit('feat: ghost STORY-999');
  const result = syncChangelogs(tmp);
  expect(result.appended).toBe(0);
  expect(changelogFor('STORY-001')).toBeNull();  // no entry created
});

test('syncChangelogs --dry-run does not write but reports counts', () => {
  commit('feat: dry STORY-001');
  const result = syncChangelogs(tmp, { dryRun: true });
  expect(result.appended).toBe(1);
  expect(changelogFor('STORY-001')).toBeNull();
});

test('syncChangelogs auto-transitions story to done on PR-merge commit when config enabled', () => {
  // Move STORY-001 into a state from which 'done' is legal (review → done).
  setStatus(tmp, 'STORY-001', 'in_progress');
  setStatus(tmp, 'STORY-001', 'review');

  // Enable the auto-transition flag.
  const config = loadConfig(tmp);
  config.auto_transitions.pr_merge_marks_story_done = true;
  saveConfig(tmp, config);

  commit('Merge pull request #42 from foo/bar', 'Implements STORY-001');
  const result = syncChangelogs(tmp);
  expect(result.appended).toBe(1);
  expect(result.transitionedToDone).toEqual(['STORY-001']);
  expect(findById(tmp, 'STORY-001')!.data.status).toBe('done');
});

test('syncChangelogs does NOT auto-transition when config flag is off', () => {
  setStatus(tmp, 'STORY-001', 'in_progress');
  setStatus(tmp, 'STORY-001', 'review');

  // Default config has pr_merge_marks_story_done = false.
  commit('Merge pull request #42 from foo/bar', 'Implements STORY-001');
  const result = syncChangelogs(tmp);
  expect(result.transitionedToDone).toEqual([]);
  expect(findById(tmp, 'STORY-001')!.data.status).toBe('review');  // unchanged
});
