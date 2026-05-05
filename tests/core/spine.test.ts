import { test, expect, beforeEach, afterEach } from 'bun:test';
import { walkSpine, findById } from '../../src/core/spine';
import { writeItem } from '../../src/core/writer';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-spine-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const baseFields = {
  status: 'ready' as const,
  phase: 'mvp',
  order: 10,
  created: '2026-05-05',
  updated: '2026-05-05',
};

test('walkSpine returns empty for missing .kadai', () => {
  expect(walkSpine(tmp)).toEqual([]);
});

test('walkSpine yields a single epic', () => {
  writeItem('epic', { ...baseFields, id: 'EPIC-001', title: 'Auth' }, '', { rootDir: tmp });
  const items = walkSpine(tmp);
  expect(items.length).toBe(1);
  expect(items[0].data.id).toBe('EPIC-001');
});

test('walkSpine yields nested epic + feature + story in order', () => {
  writeItem('epic', { ...baseFields, id: 'EPIC-001', title: 'Auth' }, '', { rootDir: tmp });
  const epicDir = join(tmp, '.kadai/epics/EPIC-001-auth');
  writeItem('feature',
    { ...baseFields, id: 'FEAT-001', parent: 'EPIC-001', title: 'Login' },
    '', { rootDir: tmp, parentPath: epicDir });
  const featDir = join(epicDir, 'features/FEAT-001-login');
  writeItem('story',
    { ...baseFields, id: 'STORY-001', parent: 'FEAT-001', title: 'Email login' },
    '', { rootDir: tmp, parentPath: featDir });

  const items = walkSpine(tmp);
  expect(items.map(i => i.data.id)).toEqual(['EPIC-001', 'FEAT-001', 'STORY-001']);
});

test('findById returns the matching item', () => {
  writeItem('epic', { ...baseFields, id: 'EPIC-001', title: 'A' }, '', { rootDir: tmp });
  writeItem('epic', { ...baseFields, id: 'EPIC-002', title: 'B', order: 20 }, '', { rootDir: tmp });
  expect(findById(tmp, 'EPIC-002')?.data.title).toBe('B');
});

test('findById returns null for missing ID', () => {
  expect(findById(tmp, 'EPIC-999')).toBeNull();
});
