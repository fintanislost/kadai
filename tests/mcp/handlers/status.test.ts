import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerStatusTools } from '../../../src/mcp/handlers/status';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';
import { findById } from '../../../src/core/spine';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerStatusTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-status-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('set_status moves an item from ready to in_progress', async () => {
  const tool = getTool('set_status')!;
  await tool.handler({ id: 'EPIC-001', status: 'in_progress' }, ctx());
  expect(findById(tmp, 'EPIC-001')?.data.status).toBe('in_progress');
});

test('set_status rejects illegal transitions', async () => {
  const tool = getTool('set_status')!;
  await expect(tool.handler({ id: 'EPIC-001', status: 'done' }, ctx()))
    .rejects.toThrow(/illegal transition/i);
});

test('set_phase updates phase on an epic', async () => {
  const tool = getTool('set_phase')!;
  await tool.handler({ id: 'EPIC-001', phase: 'v1' }, ctx());
  expect((findById(tmp, 'EPIC-001')?.data as any).phase).toBe('v1');
});

test('set_phase updates order when provided', async () => {
  const tool = getTool('set_phase')!;
  await tool.handler({ id: 'EPIC-001', phase: 'mvp', order: 50 }, ctx());
  expect((findById(tmp, 'EPIC-001')?.data as any).order).toBe(50);
});

test('set_phase rejects tasks (tasks inherit phase from story)', async () => {
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T', parent: 'STORY-001' });
  const tool = getTool('set_phase')!;
  await expect(tool.handler({ id: 'TASK-001', phase: 'v1' }, ctx()))
    .rejects.toThrow(/tasks inherit/i);
});
