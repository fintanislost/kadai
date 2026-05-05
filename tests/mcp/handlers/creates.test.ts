import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerCreateTools } from '../../../src/mcp/handlers/creates';
import { runInit } from '../../../src/cli/init';
import { findById } from '../../../src/core/spine';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerCreateTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-creates-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('create_epic creates an epic and returns its ID', async () => {
  const tool = getTool('create_epic')!;
  const result = await tool.handler({
    title: 'Auth', phase: 'mvp', description: 'Auth system',
  }, ctx()) as { id: string };
  expect(result.id).toBe('EPIC-001');
  expect(findById(tmp, 'EPIC-001')?.data.title).toBe('Auth');
});

test('create_epic stores description in body', async () => {
  const tool = getTool('create_epic')!;
  await tool.handler({
    title: 'Auth', phase: 'mvp', description: 'Custom description text here.',
  }, ctx());
  const item = findById(tmp, 'EPIC-001');
  expect(item?.body).toContain('Custom description text here.');
});

test('create_feature requires parent_epic to exist', async () => {
  const tool = getTool('create_feature')!;
  await expect(tool.handler({
    title: 'F', phase: 'mvp', description: '', parent_epic: 'EPIC-001',
  }, ctx())).rejects.toThrow(/parent not found/i);
});

test('create_story attaches acceptance_criteria', async () => {
  const epicTool = getTool('create_epic')!;
  await epicTool.handler({ title: 'A', phase: 'mvp', description: '' }, ctx());
  const featTool = getTool('create_feature')!;
  await featTool.handler({
    title: 'F', phase: 'mvp', description: '', parent_epic: 'EPIC-001',
  }, ctx());
  const storyTool = getTool('create_story')!;
  await storyTool.handler({
    title: 'S', phase: 'mvp', description: '', parent_feature: 'FEAT-001',
    acceptance_criteria: ['First', 'Second'],
  }, ctx());
  const story = findById(tmp, 'STORY-001');
  expect((story?.data as any).acceptance_criteria).toEqual(['First', 'Second']);
});

test('create_task takes plan_step', async () => {
  const epicTool = getTool('create_epic')!;
  await epicTool.handler({ title: 'A', phase: 'mvp', description: '' }, ctx());
  const featTool = getTool('create_feature')!;
  await featTool.handler({ title: 'F', phase: 'mvp', description: '', parent_epic: 'EPIC-001' }, ctx());
  const storyTool = getTool('create_story')!;
  await storyTool.handler({ title: 'S', phase: 'mvp', description: '', parent_feature: 'FEAT-001' }, ctx());
  const taskTool = getTool('create_task')!;
  await taskTool.handler({
    title: 'T', description: '', parent_story: 'STORY-001', plan_step: 3,
  }, ctx());
  const task = findById(tmp, 'TASK-001');
  expect((task?.data as any).plan_step).toBe(3);
});
