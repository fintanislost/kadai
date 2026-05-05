import { test, expect, beforeEach, afterEach } from 'bun:test';
import { getConfigKey, setConfigKey } from '../../src/cli/config';
import { runInit } from '../../src/cli/init';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-cfg-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('getConfigKey reads a nested boolean', () => {
  expect(getConfigKey(tmp, 'change_capture.enabled')).toBe(true);
});

test('getConfigKey reads a nested array', () => {
  const v = getConfigKey(tmp, 'guardrail.allowed_paths');
  expect(Array.isArray(v)).toBe(true);
  expect(v).toContain('docs/');
});

test('setConfigKey writes a boolean', () => {
  setConfigKey(tmp, 'change_capture.enabled', 'false');
  expect(getConfigKey(tmp, 'change_capture.enabled')).toBe(false);
});

test('setConfigKey writes a flag in auto_transitions', () => {
  setConfigKey(tmp, 'auto_transitions.pr_merge_marks_story_done', 'true');
  expect(getConfigKey(tmp, 'auto_transitions.pr_merge_marks_story_done')).toBe(true);
});

test('getConfigKey throws on unknown key', () => {
  expect(() => getConfigKey(tmp, 'foo.bar')).toThrow(/unknown config key/i);
});
