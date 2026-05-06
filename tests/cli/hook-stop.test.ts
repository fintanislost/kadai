import { test, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { setPicked } from '../../src/core/picked';
import { findById } from '../../src/core/spine';
import { setStatus } from '../../src/core/operations';
import { buildStopReminder } from '../../src/cli/hook';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-stop-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function touchChangelog(itemId: string, ageSeconds: number): void {
  const item = findById(tmp, itemId)!;
  const path = join(dirname(item.path), 'changelog.md');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `- ${new Date().toISOString()} \`Write\` test.txt\n`);
  // Set mtime to ageSeconds ago. Bun's utimesSync is unreliable on this platform,
  // so we use the system `touch` command instead.
  execFileSync('touch', ['-d', `${ageSeconds} seconds ago`, path]);
}

test('buildStopReminder returns null when no story is picked', () => {
  expect(buildStopReminder(tmp)).toBeNull();
});

test('buildStopReminder returns null when picked story status is review', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  setStatus(tmp, 'STORY-001', 'review');
  expect(buildStopReminder(tmp)).toBeNull();
});

test('buildStopReminder returns null when picked story status is done', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  setStatus(tmp, 'STORY-001', 'done');
  expect(buildStopReminder(tmp)).toBeNull();
});

test('buildStopReminder returns null when in_progress but no recent changelog activity', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  // No changelog file at all → no signal that work happened this turn → silent.
  expect(buildStopReminder(tmp)).toBeNull();
});

test('buildStopReminder returns null when changelog is older than 30 minutes', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  touchChangelog('STORY-001', 60 * 60);  // 1 hour old
  expect(buildStopReminder(tmp)).toBeNull();
});

test('buildStopReminder returns a JSON reason when in_progress + recent changelog', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  touchChangelog('STORY-001', 5 * 60);  // 5 minutes old
  const out = buildStopReminder(tmp);
  expect(out).not.toBeNull();
  const parsed = JSON.parse(out!) as { reason: string };
  expect(parsed.reason).toContain('STORY-001');
  expect(parsed.reason).toMatch(/in_progress/);
  expect(parsed.reason).toContain('kadai set-status');
});

test('kadai hook stop emits the JSON to stdout when relevant', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  touchChangelog('STORY-001', 5 * 60);

  const stdinPayload = JSON.stringify({
    session_id: 's1', transcript_path: '/tmp/x', cwd: tmp,
    permission_mode: 'default', hook_event_name: 'Stop',
  });
  const result = spawnSync('bun', ['run', join(import.meta.dir, '..', '..', 'src', 'cli', 'index.ts'), 'hook', 'stop'], {
    cwd: tmp,
    input: stdinPayload,
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  const parsed = JSON.parse(result.stdout.trim()) as { reason: string };
  expect(parsed.reason).toContain('STORY-001');
});
