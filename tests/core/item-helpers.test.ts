import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { getId, getTitle, getStatus, getPhase, getParent, getOrder, getSpec, getPlan } from '../../src/core/item-helpers';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-helpers-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('getId / getTitle / getStatus return the basic fields for any item kind', () => {
  const epic = findById(tmp, 'EPIC-001')!;
  expect(getId(epic)).toBe('EPIC-001');
  expect(getTitle(epic)).toBe('Auth');
  expect(getStatus(epic)).toBe('ready');
});

test('getPhase returns the phase slug for ordered kinds', () => {
  const epic = findById(tmp, 'EPIC-001')!;
  expect(getPhase(epic)).toBe('mvp');
});

test('getPhase returns undefined for tasks (not phase-bound)', () => {
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T', parent: 'STORY-001' });
  const task = findById(tmp, 'TASK-001')!;
  expect(getPhase(task)).toBeUndefined();
});

test('getParent returns the parent ID for non-epic kinds', () => {
  const feat = findById(tmp, 'FEAT-001')!;
  expect(getParent(feat)).toBe('EPIC-001');
});

test('getParent returns undefined for epics', () => {
  const epic = findById(tmp, 'EPIC-001')!;
  expect(getParent(epic)).toBeUndefined();
});

test('getOrder returns the order number for ordered kinds, undefined for tasks', () => {
  const epic = findById(tmp, 'EPIC-001')!;
  expect(typeof getOrder(epic)).toBe('number');
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T', parent: 'STORY-001' });
  const task = findById(tmp, 'TASK-001')!;
  expect(getOrder(task)).toBeUndefined();
});

test('getSpec / getPlan return the attached filename or undefined', () => {
  const feat = findById(tmp, 'FEAT-001')!;
  expect(getSpec(feat)).toBeUndefined();
  expect(getPlan(feat)).toBeUndefined();
});
