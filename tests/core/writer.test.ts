import { test, expect, beforeEach, afterEach } from 'bun:test';
import { writeItem } from '../../src/core/writer';
import { readItem } from '../../src/core/reader';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-writer-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const epicData = {
  id: 'EPIC-001',
  title: 'Authentication',
  status: 'ready' as const,
  phase: 'mvp',
  order: 10,
  created: '2026-05-05',
  updated: '2026-05-05',
};

test('writeItem writes an epic and roundtrips through readItem', () => {
  const path = writeItem('epic', epicData, '## Description\n\nAuth stuff.', { rootDir: tmp });
  expect(existsSync(path)).toBe(true);
  const back = readItem(path);
  expect(back.data.id).toBe('EPIC-001');
  expect(back.data.title).toBe('Authentication');
  expect(back.body).toContain('Auth stuff');
});

test('writeItem creates correct directory for epic', () => {
  const path = writeItem('epic', epicData, '', { rootDir: tmp });
  expect(path).toBe(join(tmp, '.kadai', 'epics', 'EPIC-001-authentication', 'epic.md'));
});

test('writeItem creates correct directory for nested feature', () => {
  writeItem('epic', epicData, '', { rootDir: tmp });
  const epicDir = join(tmp, '.kadai', 'epics', 'EPIC-001-authentication');
  const featData = {
    id: 'FEAT-001',
    parent: 'EPIC-001',
    title: 'User login',
    status: 'ready' as const,
    phase: 'mvp',
    order: 10,
    created: '2026-05-05',
    updated: '2026-05-05',
  };
  const path = writeItem('feature', featData, '', { rootDir: tmp, parentPath: epicDir });
  expect(path).toBe(join(epicDir, 'features', 'FEAT-001-user-login', 'feature.md'));
});

test('writeItem creates correct filename for task', () => {
  writeItem('epic', epicData, '', { rootDir: tmp });
  const epicDir = join(tmp, '.kadai/epics/EPIC-001-authentication');
  writeItem('feature', {
    id: 'FEAT-001', parent: 'EPIC-001', title: 'Login',
    status: 'ready' as const, phase: 'mvp', order: 10,
    created: '2026-05-05', updated: '2026-05-05',
  }, '', { rootDir: tmp, parentPath: epicDir });
  const featDir = join(epicDir, 'features/FEAT-001-login');
  writeItem('story', {
    id: 'STORY-001', parent: 'FEAT-001', title: 'Email login',
    status: 'ready' as const, phase: 'mvp', order: 10,
    created: '2026-05-05', updated: '2026-05-05',
  }, '', { rootDir: tmp, parentPath: featDir });
  const storyDir = join(featDir, 'stories/STORY-001-email-login');
  const path = writeItem('task', {
    id: 'TASK-001', parent: 'STORY-001', title: 'Add bcrypt hashing',
    status: 'ready' as const,
    created: '2026-05-05', updated: '2026-05-05',
  }, '', { rootDir: tmp, parentPath: storyDir });
  expect(path).toBe(join(storyDir, 'tasks', 'TASK-001-add-bcrypt-hashing.md'));
});

test('writeItem rejects invalid frontmatter', () => {
  expect(() => writeItem('epic', { ...epicData, status: 'bogus' } as any, '', { rootDir: tmp }))
    .toThrow();
});

test('writeItem requires parentPath for non-epics', () => {
  const featData = {
    ...epicData, id: 'FEAT-001', parent: 'EPIC-001',
  } as any;
  expect(() => writeItem('feature', featData, '', { rootDir: tmp })).toThrow(/requires parentPath/);
});
