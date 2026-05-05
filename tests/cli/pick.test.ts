import { test, expect, beforeEach, afterEach } from 'bun:test';
import { runPick, runUnpick } from '../../src/cli/pick';
import { runAdd } from '../../src/cli/add';
import { runInit } from '../../src/cli/init';
import { readPicked } from '../../src/core/picked';
import { findById } from '../../src/core/spine';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-pick-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runPick sets picked and transitions story to in_progress', () => {
  runPick(tmp, 'STORY-001');
  expect(readPicked(tmp)).toBe('STORY-001');
  expect(findById(tmp, 'STORY-001')?.data.status).toBe('in_progress');
});

test('runPick rejects non-story IDs', () => {
  expect(() => runPick(tmp, 'EPIC-001')).toThrow(/only stories/i);
});

test('runPick rejects unknown story ID', () => {
  expect(() => runPick(tmp, 'STORY-999')).toThrow(/not found/i);
});

test('runPick of already-in-progress story is idempotent (no error)', () => {
  runPick(tmp, 'STORY-001');
  runPick(tmp, 'STORY-001');
  expect(readPicked(tmp)).toBe('STORY-001');
});

test('runUnpick clears picked but does not change status', () => {
  runPick(tmp, 'STORY-001');
  runUnpick(tmp);
  expect(readPicked(tmp)).toBeNull();
  expect(findById(tmp, 'STORY-001')?.data.status).toBe('in_progress');
});
