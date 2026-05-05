import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerPickTools } from '../../../src/mcp/handlers/picks';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';
import { readPicked } from '../../../src/core/picked';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerPickTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-picks-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('pick_story sets the picked flag', async () => {
  const tool = getTool('pick_story')!;
  await tool.handler({ id: 'STORY-001' }, ctx());
  expect(readPicked(tmp)).toBe('STORY-001');
});

test('pick_story rejects non-stories', async () => {
  const tool = getTool('pick_story')!;
  await expect(tool.handler({ id: 'EPIC-001' }, ctx()))
    .rejects.toThrow();
});

test('unpick clears the picked flag', async () => {
  const pickTool = getTool('pick_story')!;
  await pickTool.handler({ id: 'STORY-001' }, ctx());
  const unpickTool = getTool('unpick')!;
  await unpickTool.handler({}, ctx());
  expect(readPicked(tmp)).toBeNull();
});
