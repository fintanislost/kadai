import { test, expect, beforeEach, afterEach } from 'bun:test';
import { runAdd } from '../../src/cli/add';
import { runInit } from '../../src/cli/init';
import { findById } from '../../src/core/spine';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-add-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runAdd creates an epic with auto ID', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  const item = findById(tmp, 'EPIC-001');
  expect(item?.data.title).toBe('Auth');
  expect(item?.data.status).toBe('ready');
});

test('runAdd auto-orders within phase', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'mvp' });
  const a = findById(tmp, 'EPIC-001');
  const b = findById(tmp, 'EPIC-002');
  expect((a?.data as any).order).toBe(10);
  expect((b?.data as any).order).toBe(20);
});

test('runAdd creates a feature under an epic', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  const feat = findById(tmp, 'FEAT-001');
  expect(feat?.data.title).toBe('Login');
  expect((feat?.data as any).parent).toBe('EPIC-001');
});

test('runAdd rejects feature without parent', () => {
  expect(() => runAdd({ rootDir: tmp, kind: 'feature', title: 'X', phase: 'mvp' }))
    .toThrow(/parent required/i);
});

test('runAdd rejects feature with bad parent kind', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  expect(() => runAdd({ rootDir: tmp, kind: 'story', title: 'X', phase: 'mvp', parent: 'EPIC-001' }))
    .toThrow(/parent must be a/i);
});

test('runAdd creates a task without phase/order (inherits)', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T', parent: 'STORY-001' });
  const task = findById(tmp, 'TASK-001');
  expect(task?.data.title).toBe('T');
  expect((task?.data as any).parent).toBe('STORY-001');
});
