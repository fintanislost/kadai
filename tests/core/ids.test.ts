import { test, expect, beforeEach, afterEach } from 'bun:test';
import { nextId, formatId, parseId } from '../../src/core/ids';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-ids-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('nextId starts at 001', () => {
  expect(nextId('epic', tmp)).toBe('EPIC-001');
});

test('nextId increments per type independently', () => {
  expect(nextId('epic', tmp)).toBe('EPIC-001');
  expect(nextId('epic', tmp)).toBe('EPIC-002');
  expect(nextId('story', tmp)).toBe('STORY-001');
  expect(nextId('epic', tmp)).toBe('EPIC-003');
});

test('counters persist across calls (simulating fresh process)', () => {
  nextId('feature', tmp);
  nextId('feature', tmp);
  nextId('feature', tmp);
  expect(nextId('feature', tmp)).toBe('FEAT-004');
});

test('formatId pads to 3 digits', () => {
  expect(formatId('story', 5)).toBe('STORY-005');
  expect(formatId('story', 42)).toBe('STORY-042');
  expect(formatId('story', 1234)).toBe('STORY-1234');
});

test('parseId handles valid IDs', () => {
  expect(parseId('EPIC-001')).toEqual({ kind: 'epic', n: 1 });
  expect(parseId('STORY-042')).toEqual({ kind: 'story', n: 42 });
  expect(parseId('FEAT-100')).toEqual({ kind: 'feature', n: 100 });
  expect(parseId('TASK-007')).toEqual({ kind: 'task', n: 7 });
});

test('parseId returns null for invalid', () => {
  expect(parseId('FOO-001')).toBeNull();
  expect(parseId('EPIC-')).toBeNull();
  expect(parseId('not-an-id')).toBeNull();
  expect(parseId('')).toBeNull();
});

test('nextId is safe under concurrent calls', async () => {
  const promises = Array.from({ length: 10 }, () => Promise.resolve(nextId('epic', tmp)));
  const ids = await Promise.all(promises);
  const unique = new Set(ids);
  expect(unique.size).toBe(10);
});
