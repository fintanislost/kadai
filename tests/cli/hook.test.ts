import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { evaluatePreToolUse } from '../../src/cli/hook';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { setPicked } from '../../src/core/picked';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-hook-pre-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => {
  delete process.env.KADAI_BYPASS;
  delete process.env.KADAI_BYPASS_REASON;
  rmSync(tmp, { recursive: true, force: true });
});

test('allows edit to a path inside .kadai/', () => {
  const input = { tool_name: 'Edit', tool_input: { file_path: join(tmp, '.kadai/epics/foo.md') } };
  expect(evaluatePreToolUse(input, tmp).allow).toBe(true);
});

test('allows edit to a file in [guardrail.allowed_paths]', () => {
  const input = { tool_name: 'Edit', tool_input: { file_path: join(tmp, 'docs/some-file.md') } };
  expect(evaluatePreToolUse(input, tmp).allow).toBe(true);
});

test('blocks edit to a path outside .kadai/ and allowlist when no story picked', () => {
  const input = { tool_name: 'Edit', tool_input: { file_path: join(tmp, 'src/foo.ts') } };
  const result = evaluatePreToolUse(input, tmp);
  expect(result.allow).toBe(false);
  expect(result.message).toMatch(/no story is picked/i);
});

test('allows edit outside .kadai/ when a story is picked', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  setPicked(tmp, 'STORY-001');
  const input = { tool_name: 'Edit', tool_input: { file_path: join(tmp, 'src/foo.ts') } };
  expect(evaluatePreToolUse(input, tmp).allow).toBe(true);
});

test('KADAI_BYPASS=1 allows blocked edit and writes to bypass.log', () => {
  process.env.KADAI_BYPASS = '1';
  process.env.KADAI_BYPASS_REASON = 'quick docs fix';
  const input = { tool_name: 'Edit', tool_input: { file_path: join(tmp, 'src/foo.ts') } };
  expect(evaluatePreToolUse(input, tmp).allow).toBe(true);
  const logPath = join(tmp, '.kadai/bypass.log');
  expect(existsSync(logPath)).toBe(true);
  const log = readFileSync(logPath, 'utf8');
  expect(log).toContain('src/foo.ts');
  expect(log).toContain('quick docs fix');
});

test('only Edit and Write tools are evaluated; other tools allow through', () => {
  const input = { tool_name: 'Read', tool_input: { file_path: join(tmp, 'src/foo.ts') } };
  expect(evaluatePreToolUse(input, tmp).allow).toBe(true);
});
