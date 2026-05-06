import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { attachFile } from '../../src/core/attach';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-attach-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('attachFile copies a spec.md into the feature dir and updates frontmatter', () => {
  const src = join(tmp, '_src.md');
  writeFileSync(src, '# Spec\n\nContent.\n');

  const result = attachFile(tmp, 'FEAT-001', 'spec', src);

  expect(existsSync(result.targetPath)).toBe(true);
  expect(readFileSync(result.targetPath, 'utf8')).toBe('# Spec\n\nContent.\n');
  expect(existsSync(src)).toBe(false);

  const feat = findById(tmp, 'FEAT-001');
  expect((feat!.data as any).spec).toBe('spec.md');
});

test('attachFile copies a plan.md into the story dir and updates frontmatter', () => {
  const src = join(tmp, '_src.md');
  writeFileSync(src, '# Plan\n');

  const result = attachFile(tmp, 'STORY-001', 'plan', src);

  expect(existsSync(result.targetPath)).toBe(true);
  expect((findById(tmp, 'STORY-001')!.data as any).plan).toBe('plan.md');
});

test('attachFile attaches a spec.md to a story (story can have both spec and plan)', () => {
  const src = join(tmp, '_src.md');
  writeFileSync(src, '# Spec for story\n');
  attachFile(tmp, 'STORY-001', 'spec', src);
  expect((findById(tmp, 'STORY-001')!.data as any).spec).toBe('spec.md');
});

test('attachFile rejects unknown ID', () => {
  const src = join(tmp, '_src.md');
  writeFileSync(src, 'x');
  expect(() => attachFile(tmp, 'FEAT-999', 'spec', src)).toThrow(/not found/i);
});

test('attachFile rejects spec on a task (kind not allowed)', () => {
  runAdd({ rootDir: tmp, kind: 'task', title: 'T', parent: 'STORY-001' });
  const src = join(tmp, '_src.md');
  writeFileSync(src, 'x');
  expect(() => attachFile(tmp, 'TASK-001', 'spec', src)).toThrow(/cannot attach/i);
});

test('attachFile rejects missing source file', () => {
  expect(() => attachFile(tmp, 'FEAT-001', 'spec', '/nonexistent/source.md'))
    .toThrow(/source.*not found/i);
});

test('attachFile rejects plan on an epic', () => {
  const src = join(tmp, '_src.md');
  writeFileSync(src, 'x');
  expect(() => attachFile(tmp, 'EPIC-001', 'plan', src)).toThrow(/cannot attach/i);
});
