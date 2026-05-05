import { test, expect, beforeEach, afterEach } from 'bun:test';
import { setStatus } from '../../src/core/operations';
import { writeItem } from '../../src/core/writer';
import { findById } from '../../src/core/spine';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-ops-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const epic = {
  id: 'EPIC-001', title: 'Auth',
  status: 'ready' as const, phase: 'mvp', order: 10,
  created: '2026-05-05', updated: '2026-05-05',
};

test('setStatus updates an item from ready to in_progress', () => {
  writeItem('epic', epic, '', { rootDir: tmp });
  setStatus(tmp, 'EPIC-001', 'in_progress');
  const after = findById(tmp, 'EPIC-001');
  expect(after?.data.status).toBe('in_progress');
});

test('setStatus rejects illegal transitions', () => {
  writeItem('epic', epic, '', { rootDir: tmp });
  expect(() => setStatus(tmp, 'EPIC-001', 'done'))
    .toThrow(/illegal transition/i);
});

test('setStatus throws for unknown ID', () => {
  expect(() => setStatus(tmp, 'EPIC-999', 'in_progress')).toThrow(/not found/i);
});

test('setStatus updates the updated timestamp', () => {
  writeItem('epic', { ...epic, updated: '2020-01-01' }, '', { rootDir: tmp });
  setStatus(tmp, 'EPIC-001', 'in_progress');
  const after = findById(tmp, 'EPIC-001');
  expect(after?.data.updated).not.toBe('2020-01-01');
});
