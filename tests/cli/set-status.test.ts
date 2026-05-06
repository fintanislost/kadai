import { test, expect, beforeEach, afterEach } from 'bun:test';
import { runSetStatus } from '../../src/cli/set-status';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-set-status-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runSetStatus moves an item from ready to in_progress', () => {
  runSetStatus(tmp, 'EPIC-001', 'in_progress');
  expect(findById(tmp, 'EPIC-001')?.data.status).toBe('in_progress');
});

test('runSetStatus rejects illegal transitions', () => {
  expect(() => runSetStatus(tmp, 'EPIC-001', 'done'))
    .toThrow(/illegal transition/i);
});

test('runSetStatus throws for unknown ID', () => {
  expect(() => runSetStatus(tmp, 'EPIC-999', 'in_progress'))
    .toThrow(/not found/i);
});

test('runSetStatus accepts story review transition (story-only state)', () => {
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runSetStatus(tmp, 'STORY-001', 'in_progress');
  runSetStatus(tmp, 'STORY-001', 'review');
  expect(findById(tmp, 'STORY-001')?.data.status).toBe('review');
});
