import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runStory } from '../../src/runner/dispatch';
import type { ImplementerOutcome, Dispatcher } from '../../src/runner/dispatch';

function seedStory(root: string, storyId: string, plan: string) {
  const story = join(root, `.kadai/epics/EPIC-001-x/features/FEAT-001-y/stories/${storyId}-z`);
  mkdirSync(story, { recursive: true });
  writeFileSync(join(story, 'story.md'), `---\nid: ${storyId}\nparent: FEAT-001\ntitle: x\nphase: mvp\nstatus: ready\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n`);
  writeFileSync(join(story, 'plan.md'), plan);
  // Minimum spine setup
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/feature.md'), '---\nid: FEAT-001\nparent: EPIC-001\ntitle: Y\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":1,"feature":1,"story":1,"task":0}');
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n');
}

test('runStory iterates each ## Task heading in plan.md and dispatches', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-dispatch-'));
  try {
    seedStory(root, 'STORY-001', '# Plan\n\n## Task 1: Alpha\n\nbody\n\n## Task 2: Beta\n\nbody\n\n## Task 3: Gamma\n\nbody\n');
    const dispatched: string[] = [];
    const dispatcher: Dispatcher = async (taskTitle) => { dispatched.push(taskTitle); return { status: 'DONE' }; };
    const result = await runStory(root, 'STORY-001', dispatcher);
    expect(dispatched).toEqual(['Task 1: Alpha', 'Task 2: Beta', 'Task 3: Gamma']);
    expect(result.kind).toBe('story-done');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runStory stops at first BLOCKED outcome and surfaces the blocker', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-dispatch-'));
  try {
    seedStory(root, 'STORY-002', '# Plan\n\n## Task 1: A\n\nbody\n\n## Task 2: B\n\nbody\n');
    let i = 0;
    const dispatcher: Dispatcher = async () => {
      const r: ImplementerOutcome = i++ === 0 ? { status: 'DONE' } : { status: 'BLOCKED', reason: 'something hard' };
      return r;
    };
    const result = await runStory(root, 'STORY-002', dispatcher);
    expect(result.kind).toBe('blocked');
    if (result.kind === 'blocked') {
      expect(result.blocker.kind).toBe('generic');
      if (result.blocker.kind === 'generic') expect(result.blocker.reason).toBe('something hard');
      expect(result.completedTasks).toBe(1);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runStory escalates needs-feature blocker (parses "needs-feature: <desc>")', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-dispatch-'));
  try {
    seedStory(root, 'STORY-003', '# Plan\n\n## Task 1: A\n\nbody\n');
    const dispatcher: Dispatcher = async () => ({ status: 'BLOCKED', reason: 'needs-feature: a config loading utility' });
    const result = await runStory(root, 'STORY-003', dispatcher);
    expect(result.kind).toBe('needs-feature');
    if (result.kind === 'needs-feature') {
      expect(result.description).toBe('a config loading utility');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runStory returns story-not-found when the story has no plan.md', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-dispatch-'));
  try {
    seedStory(root, 'STORY-004', '');  // empty plan
    // Remove the plan.md to simulate genuinely missing
    const planPath = join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/stories/STORY-004-z/plan.md');
    rmSync(planPath);
    const dispatcher: Dispatcher = async () => ({ status: 'DONE' });
    const result = await runStory(root, 'STORY-004', dispatcher);
    expect(result.kind).toBe('error');
    if (result.kind === 'error') expect(result.message).toMatch(/no plan/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runStory tolerates a plan with no Task headings (empty plan)', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-dispatch-'));
  try {
    seedStory(root, 'STORY-005', '# Plan\n\nJust prose. No tasks.\n');
    const dispatcher: Dispatcher = async () => ({ status: 'DONE' });
    const result = await runStory(root, 'STORY-005', dispatcher);
    expect(result.kind).toBe('story-done');  // vacuously done
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runStory escalates NEEDS_CONTEXT as blocked with prefixed reason', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-dispatch-'));
  try {
    seedStory(root, 'STORY-006', '# Plan\n\n## Task 1: A\n\nbody\n');
    const dispatcher: Dispatcher = async () => ({ status: 'NEEDS_CONTEXT', missing: 'the auth schema' });
    const result = await runStory(root, 'STORY-006', dispatcher);
    expect(result.kind).toBe('blocked');
    if (result.kind === 'blocked') {
      expect(result.blocker.kind).toBe('generic');
      if (result.blocker.kind === 'generic') {
        expect(result.blocker.reason).toBe('needs context: the auth schema');
      }
      expect(result.completedTasks).toBe(0);
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
