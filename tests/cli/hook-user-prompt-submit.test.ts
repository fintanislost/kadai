import { test, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { setPicked } from '../../src/core/picked';
import { findById } from '../../src/core/spine';
import { setStatus } from '../../src/core/operations';
import { serialize } from '../../src/core/frontmatter';
import { writeFileAtomic } from '../../src/core/files';
import { buildActiveStoryContext } from '../../src/cli/hook';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-ups-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Implement add(a,b)', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('buildActiveStoryContext returns null when no story is picked', () => {
  expect(buildActiveStoryContext(tmp)).toBeNull();
});

test('buildActiveStoryContext returns null when picked ID does not resolve', () => {
  setPicked(tmp, 'STORY-999');
  expect(buildActiveStoryContext(tmp)).toBeNull();
});

test('buildActiveStoryContext emits the bare block for a story with no spec/plan/AC', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  const out = buildActiveStoryContext(tmp)!;
  expect(out).toContain('[kadai-active-story]');
  expect(out).toContain('STORY-001 — Implement add(a,b)');
  expect(out).toContain('phase=mvp status=in_progress parent=FEAT-001');
  expect(out).not.toContain('spec:');
  expect(out).not.toContain('plan:');
  expect(out).not.toContain('acceptance criteria');
  expect(out).toContain('[/kadai-active-story]');
});

test('buildActiveStoryContext includes spec when frontmatter has spec field', () => {
  setPicked(tmp, 'STORY-001');
  const story = findById(tmp, 'STORY-001')!;
  writeFileSync(join(dirname(story.path), 'spec.md'), '# Spec\n');
  const updated = { ...story.data, spec: 'spec.md' };
  writeFileAtomic(story.path, serialize(updated as Record<string, unknown>, story.body));

  const out = buildActiveStoryContext(tmp)!;
  expect(out).toContain('spec: spec.md (attached)');
});

test('buildActiveStoryContext includes plan when attached', () => {
  setPicked(tmp, 'STORY-001');
  const story = findById(tmp, 'STORY-001')!;
  writeFileSync(join(dirname(story.path), 'plan.md'), '# Plan\n');
  const updated = { ...story.data, plan: 'plan.md' };
  writeFileAtomic(story.path, serialize(updated as Record<string, unknown>, story.body));

  const out = buildActiveStoryContext(tmp)!;
  expect(out).toContain('plan: plan.md (attached)');
});

test('buildActiveStoryContext lists acceptance criteria when present', () => {
  setPicked(tmp, 'STORY-001');
  const story = findById(tmp, 'STORY-001')!;
  const updated = { ...story.data, acceptance_criteria: ['add(2,3) returns 5', 'add(0,0) returns 0'] };
  writeFileAtomic(story.path, serialize(updated as Record<string, unknown>, story.body));

  const out = buildActiveStoryContext(tmp)!;
  expect(out).toContain('acceptance criteria:');
  expect(out).toContain('  - add(2,3) returns 5');
  expect(out).toContain('  - add(0,0) returns 0');
});

test('kadai hook user-prompt-submit reads stdin, prints context, exits 0', () => {
  setPicked(tmp, 'STORY-001');
  const stdinPayload = JSON.stringify({
    session_id: 's1',
    transcript_path: '/tmp/x',
    cwd: tmp,
    permission_mode: 'default',
    hook_event_name: 'UserPromptSubmit',
    prompt: 'hello',
  });
  const result = spawnSync('bun', ['run', join(import.meta.dir, '..', '..', 'src', 'cli', 'index.ts'), 'hook', 'user-prompt-submit'], {
    cwd: tmp,
    input: stdinPayload,
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('[kadai-active-story]');
  expect(result.stdout).toContain('STORY-001');
});
