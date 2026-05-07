import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runOnce } from '../../src/cli/run';
import type { Dispatcher } from '../../src/runner/dispatch';
import { readState } from '../../src/runner/state';

function seedSpine(root: string) {
  const story1 = join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/stories/STORY-001-a');
  const story2 = join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/stories/STORY-002-b');
  mkdirSync(story1, { recursive: true });
  mkdirSync(story2, { recursive: true });
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/feature.md'), '---\nid: FEAT-001\nparent: EPIC-001\ntitle: Y\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
  writeFileSync(join(story1, 'story.md'), '---\nid: STORY-001\nparent: FEAT-001\ntitle: First\nphase: mvp\nstatus: ready\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
  writeFileSync(join(story2, 'story.md'), '---\nid: STORY-002\nparent: FEAT-001\ntitle: Second\nphase: mvp\nstatus: ready\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 2\n---\n');
  writeFileSync(join(story1, 'plan.md'), '## Task 1: alpha\n\n## Task 2: beta\n');
  writeFileSync(join(story2, 'plan.md'), '## Task 1: gamma\n');
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":1,"feature":1,"story":2,"task":0}');
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n');
  writeFileSync(join(root, '.kadai/picked'), 'STORY-001');
}

test('runOnce executes picked story to completion when dispatcher always succeeds, ends in paused-review', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-run-'));
  try {
    seedSpine(root);
    const dispatcher: Dispatcher = async () => ({ status: 'DONE' });
    await runOnce(root, dispatcher);
    const state = readState(root);
    expect(state.status).toBe('paused-review');
    expect(state.currentStoryId).toBeNull();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runOnce halts in paused-needs-feature when dispatcher reports needs-feature', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-run-'));
  try {
    seedSpine(root);
    const dispatcher: Dispatcher = async () => ({ status: 'BLOCKED', reason: 'needs-feature: a config loader' });
    await runOnce(root, dispatcher);
    const state = readState(root);
    expect(state.status).toBe('paused-needs-feature');
    expect(state.lastBlocker?.kind).toBe('needs-feature');
    if (state.lastBlocker?.kind === 'needs-feature') {
      expect(state.lastBlocker.description).toBe('a config loader');
    }
    // Original story is on the pausedStack so we can resume it later.
    expect(state.pausedStack).toHaveLength(1);
    expect(state.pausedStack[0].storyId).toBe('STORY-001');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runOnce halts in paused-blocked for generic blockers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-run-'));
  try {
    seedSpine(root);
    const dispatcher: Dispatcher = async () => ({ status: 'BLOCKED', reason: 'something else entirely' });
    await runOnce(root, dispatcher);
    const state = readState(root);
    expect(state.status).toBe('paused-blocked');
    if (state.lastBlocker?.kind === 'generic') {
      expect(state.lastBlocker.reason).toBe('something else entirely');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runOnce errors gracefully when no story is picked', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-run-'));
  try {
    seedSpine(root);
    rmSync(join(root, '.kadai/picked'));  // unpick
    const dispatcher: Dispatcher = async () => ({ status: 'DONE' });
    const result = await runOnce(root, dispatcher);
    expect(result.kind).toBe('no-story-picked');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('runOnce --resume picks up from a paused-needs-feature state when the unblocker is done', async () => {
  // This test simulates: STORY-001 paused-needs-feature → user planned the unblocker
  // (FEAT-099 / STORY-099) → STORY-099 runs to completion → resume picks up STORY-001 task 2.
  const root = mkdtempSync(join(tmpdir(), 'kadai-run-'));
  try {
    seedSpine(root);
    // Add the unblocker feature/story manually (simulating what kadai-brainstorming would do).
    const story99 = join(root, '.kadai/epics/EPIC-001-x/features/FEAT-099-z/stories/STORY-099-q');
    mkdirSync(story99, { recursive: true });
    writeFileSync(join(root, '.kadai/epics/EPIC-001-x/features/FEAT-099-z/feature.md'), '---\nid: FEAT-099\nparent: EPIC-001\ntitle: Z\nphase: mvp\nstatus: in_progress\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 99\n---\n');
    writeFileSync(join(story99, 'story.md'), '---\nid: STORY-099\nparent: FEAT-099\ntitle: Q\nphase: mvp\nstatus: ready\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
    writeFileSync(join(story99, 'plan.md'), '## Task 1: implement unblocker\n');

    // Step 1: First run — STORY-001 hits needs-feature on Task 1.
    const dispatchA: Dispatcher = async (title) => {
      if (title.includes('alpha')) return { status: 'BLOCKED', reason: 'needs-feature: a thing' };
      return { status: 'DONE' };
    };
    await runOnce(root, dispatchA);
    expect(readState(root).status).toBe('paused-needs-feature');

    // Step 2: User pivots — picks STORY-099 manually + writes pickedFile.
    writeFileSync(join(root, '.kadai/picked'), 'STORY-099');
    // Update state to reflect pivot. (In production the runner skill does this when the user accepts the unblocker plan.)
    const { writeState } = await import('../../src/runner/state');
    const state = readState(root);
    writeState(root, { ...state, status: 'running', currentStoryId: 'STORY-099', currentTaskId: null });

    // Step 3: Run STORY-099 to completion — dispatcher always succeeds now.
    const dispatchB: Dispatcher = async () => ({ status: 'DONE' });
    const result = await runOnce(root, dispatchB);
    // The runner MUST resume STORY-001 — pausedStack had it waiting.
    // Permissive assertions ([running, paused-review]) hide whether the resume
    // actually happened, so assert the exact outcome.
    expect(result.kind).toBe('resumed');
    if (result.kind === 'resumed') {
      expect(result.storyId).toBe('STORY-001');
    }
    const stateAfter = readState(root);
    expect(stateAfter.status).toBe('running');
    expect(stateAfter.currentStoryId).toBe('STORY-001');
    expect(stateAfter.pausedStack).toHaveLength(0);
    // CRITICAL: .kadai/picked must also point at STORY-001 now, otherwise
    // the next runOnce dispatches the wrong story.
    const picked = readFileSync(join(root, '.kadai/picked'), 'utf8').trim();
    expect(picked).toBe('STORY-001');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
