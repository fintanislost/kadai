import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerGetTools } from '../../../src/mcp/handlers/get';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';
import { setPicked } from '../../../src/core/picked';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerGetTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-get-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('get returns an existing item', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  const tool = getTool('get')!;
  const result = await tool.handler({ id: 'EPIC-001' }, ctx()) as { data: { title: string } } | null;
  expect(result?.data.title).toBe('Auth');
});

test('get returns null for unknown ID', async () => {
  const tool = getTool('get')!;
  const result = await tool.handler({ id: 'EPIC-999' }, ctx());
  expect(result).toBeNull();
});

test('get_active_story returns null when nothing picked', async () => {
  const tool = getTool('get_active_story')!;
  const result = await tool.handler({}, ctx());
  expect(result).toBeNull();
});

test('get_active_story returns the picked story', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  setPicked(tmp, 'STORY-001');
  const tool = getTool('get_active_story')!;
  const result = await tool.handler({}, ctx()) as { data: { id: string } };
  expect(result.data.id).toBe('STORY-001');
});
