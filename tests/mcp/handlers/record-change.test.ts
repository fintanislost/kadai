import { test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerRecordChangeTool } from '../../../src/mcp/handlers/record-change';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';
import { setPicked } from '../../../src/core/picked';
import { findById } from '../../../src/core/spine';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerRecordChangeTool();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-record-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function changelogFor(itemId: string): string | null {
  const item = findById(tmp, itemId);
  if (!item) return null;
  const path = join(dirname(item.path), 'changelog.md');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

const ctx = () => ({ rootDir: tmp });

test('record_change appends a `note` line to the picked story changelog', async () => {
  setPicked(tmp, 'STORY-001');
  const tool = getTool('record_change')!;
  await tool.handler({ message: 'Decided to defer OAuth path until auth-provider chosen.' }, ctx());
  const log = changelogFor('STORY-001')!;
  expect(log).toMatch(/`note` Decided to defer OAuth path/);
  expect(log).toMatch(/^- \d{4}-\d{2}-\d{2}T/m);
});

test('record_change throws if no story is picked', async () => {
  const tool = getTool('record_change')!;
  await expect(tool.handler({ message: 'oops' }, ctx()))
    .rejects.toThrow(/no story is picked/i);
});

test('record_change throws if picked story does not resolve', async () => {
  setPicked(tmp, 'STORY-999');
  const tool = getTool('record_change')!;
  await expect(tool.handler({ message: 'oops' }, ctx()))
    .rejects.toThrow(/not found/i);
});

test('record_change entries coexist with multiple annotations', async () => {
  setPicked(tmp, 'STORY-001');
  const tool = getTool('record_change')!;
  await tool.handler({ message: 'first note' }, ctx());
  await tool.handler({ message: 'second note' }, ctx());
  const log = changelogFor('STORY-001')!;
  expect(log.match(/`note`/g)?.length).toBe(2);
});
