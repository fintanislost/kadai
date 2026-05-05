import { test, expect, beforeEach, afterEach } from 'bun:test';
import { loadConfig, saveConfig, configPath } from '../../src/config/load';
import { DEFAULT_CONFIG } from '../../src/config/defaults';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-config-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('loadConfig returns defaults when no file exists', () => {
  const cfg = loadConfig(tmp);
  expect(cfg).toEqual(DEFAULT_CONFIG);
});

test('saveConfig + loadConfig roundtrip', () => {
  saveConfig(tmp, DEFAULT_CONFIG);
  expect(existsSync(configPath(tmp))).toBe(true);
  const loaded = loadConfig(tmp);
  expect(loaded).toEqual(DEFAULT_CONFIG);
});

test('loadConfig merges partial overrides with defaults', () => {
  const partial = {
    ...DEFAULT_CONFIG,
    auto_transitions: {
      ...DEFAULT_CONFIG.auto_transitions,
      pr_merge_marks_story_done: true,
    },
  };
  saveConfig(tmp, partial);
  const loaded = loadConfig(tmp);
  expect(loaded.auto_transitions.pr_merge_marks_story_done).toBe(true);
  expect(loaded.auto_transitions.plan_attached_marks_ready).toBe(false);
});
