import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerSearchTools } from '../../../src/mcp/handlers/search';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerSearchTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-search-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Authentication system', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Billing', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'OAuth login', phase: 'mvp', parent: 'EPIC-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('search matches by title (case-insensitive)', async () => {
  const tool = getTool('search')!;
  const result = await tool.handler({ query: 'AUTH' }, ctx()) as Array<{ data: { id: string } }>;
  const ids = result.map(r => r.data.id);
  expect(ids).toContain('EPIC-001');
});

test('search matches multiple items', async () => {
  const tool = getTool('search')!;
  const result = await tool.handler({ query: 'login' }, ctx()) as Array<{ data: { id: string } }>;
  const ids = result.map(r => r.data.id);
  expect(ids).toContain('FEAT-001');
});

test('search returns empty for no matches', async () => {
  const tool = getTool('search')!;
  const result = await tool.handler({ query: 'nonexistent-term-xyz' }, ctx()) as unknown[];
  expect(result.length).toBe(0);
});
