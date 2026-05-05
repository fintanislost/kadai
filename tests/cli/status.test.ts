import { test, expect, beforeEach, afterEach } from 'bun:test';
import { computeStatus } from '../../src/cli/status';
import { runAdd } from '../../src/cli/add';
import { runInit } from '../../src/cli/init';
import { setPicked } from '../../src/core/picked';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-status-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('computeStatus returns picked=null when nothing picked', () => {
  const s = computeStatus(tmp);
  expect(s.picked).toBeNull();
});

test('computeStatus returns picked story when set', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  setPicked(tmp, 'STORY-001');
  const s = computeStatus(tmp);
  expect(s.picked?.data.id).toBe('STORY-001');
});

test('computeStatus returns ready stories in queue', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S1', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S2', phase: 'mvp', parent: 'FEAT-001' });
  const s = computeStatus(tmp);
  expect(s.readyStories.length).toBe(2);
});
