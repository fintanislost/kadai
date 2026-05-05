import { test, expect, beforeEach, afterEach } from 'bun:test';
import { runList } from '../../src/cli/list';
import { runAdd } from '../../src/cli/add';
import { runInit } from '../../src/cli/init';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-list-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runList returns all epics when no filters', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'v1' });
  const items = runList({ rootDir: tmp, kind: 'epic' });
  expect(items.length).toBe(2);
});

test('runList filters by phase', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'v1' });
  const items = runList({ rootDir: tmp, kind: 'epic', phase: 'mvp' });
  expect(items.length).toBe(1);
  expect(items[0].data.title).toBe('A');
});

test('runList filters by parent', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F1', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F2', phase: 'mvp', parent: 'EPIC-002' });
  const items = runList({ rootDir: tmp, kind: 'feature', parent: 'EPIC-001' });
  expect(items.length).toBe(1);
  expect(items[0].data.id).toBe('FEAT-001');
});

test('runList filters by status', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  expect(runList({ rootDir: tmp, kind: 'epic', status: 'done' }).length).toBe(0);
  expect(runList({ rootDir: tmp, kind: 'epic', status: 'ready' }).length).toBe(1);
});
