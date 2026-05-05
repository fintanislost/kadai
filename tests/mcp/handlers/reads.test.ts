import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerReadTools } from '../../../src/mcp/handlers/reads';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerReadTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-reads-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('list_phases returns the configured phases', async () => {
  const tool = getTool('list_phases')!;
  const result = await tool.handler({}, ctx()) as Array<{ slug: string }>;
  expect(result.map(p => p.slug)).toEqual(['mvp', 'v1', 'future', 'parking-lot']);
});

test('list_epics returns all epics with no filter', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'v1' });
  const tool = getTool('list_epics')!;
  const result = await tool.handler({}, ctx()) as unknown[];
  expect(result.length).toBe(2);
});

test('list_epics filters by phase', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'v1' });
  const tool = getTool('list_epics')!;
  const result = await tool.handler({ phase: 'mvp' }, ctx()) as unknown[];
  expect(result.length).toBe(1);
});

test('list_features filters by epic_id', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F1', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F2', phase: 'mvp', parent: 'EPIC-002' });
  const tool = getTool('list_features')!;
  const result = await tool.handler({ epic_id: 'EPIC-001' }, ctx()) as Array<{ data: { id: string } }>;
  expect(result.length).toBe(1);
  expect(result[0].data.id).toBe('FEAT-001');
});

test('list_stories filters by feature_id', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  const tool = getTool('list_stories')!;
  const result = await tool.handler({ feature_id: 'FEAT-001' }, ctx()) as unknown[];
  expect(result.length).toBe(1);
});

test('list_tasks filters by story_id', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T1', parent: 'STORY-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T2', parent: 'STORY-001' });
  const tool = getTool('list_tasks')!;
  const result = await tool.handler({ story_id: 'STORY-001' }, ctx()) as unknown[];
  expect(result.length).toBe(2);
});
