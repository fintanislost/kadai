import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readState, writeState, transition } from '../../src/runner/state';
import { INITIAL_STATE, type RunnerState } from '../../src/runner/types';

function freshRoot(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-runner-state-'));
  mkdirSync(join(tmp, '.kadai'), { recursive: true });
  return tmp;
}

test('readState returns INITIAL_STATE when no file exists', () => {
  const root = freshRoot();
  try {
    const s = readState(root);
    expect(s.status).toBe('idle');
    expect(s.currentStoryId).toBeNull();
    expect(s.pausedStack).toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('writeState then readState round-trips', () => {
  const root = freshRoot();
  try {
    const s: RunnerState = {
      ...INITIAL_STATE,
      status: 'running',
      currentStoryId: 'STORY-001',
      currentTaskId: 'TASK-003',
      lastUpdatedAt: new Date().toISOString(),
    };
    writeState(root, s);
    expect(existsSync(join(root, '.kadai/runner.json'))).toBe(true);
    const back = readState(root);
    expect(back.status).toBe('running');
    expect(back.currentStoryId).toBe('STORY-001');
    expect(back.currentTaskId).toBe('TASK-003');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('transition idle → running is allowed and stamps startedAt', () => {
  const root = freshRoot();
  try {
    const s = readState(root);
    const next = transition(s, { kind: 'start', storyId: 'STORY-001' });
    expect(next.status).toBe('running');
    expect(next.currentStoryId).toBe('STORY-001');
    expect(next.startedAt).toBeTruthy();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('transition running → paused-blocked records the blocker', () => {
  const root = freshRoot();
  try {
    let s = transition(readState(root), { kind: 'start', storyId: 'STORY-001' });
    s = transition(s, { kind: 'block', blocker: { kind: 'generic', reason: 'something hard' } });
    expect(s.status).toBe('paused-blocked');
    expect(s.lastBlocker).toEqual({ kind: 'generic', reason: 'something hard' });
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('transition running → paused-needs-feature records the blocker AND pauses the stack', () => {
  const root = freshRoot();
  try {
    let s = transition(readState(root), { kind: 'start', storyId: 'STORY-007' });
    s = { ...s, currentTaskId: 'TASK-014' };
    s = transition(s, { kind: 'needs-feature', description: 'need a config-loading util', suggestedTitle: 'Config loader' });
    expect(s.status).toBe('paused-needs-feature');
    expect(s.lastBlocker).toEqual({ kind: 'needs-feature', description: 'need a config-loading util', suggestedTitle: 'Config loader' });
    // The original story is pushed onto the pausedStack so we can resume after the unblocker.
    expect(s.pausedStack).toHaveLength(1);
    expect(s.pausedStack[0].storyId).toBe('STORY-007');
    expect(s.pausedStack[0].taskId).toBe('TASK-014');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('transition resume pops the stack and re-enters running', () => {
  const root = freshRoot();
  try {
    let s = transition(readState(root), { kind: 'start', storyId: 'STORY-007' });
    s = { ...s, currentTaskId: 'TASK-014' };
    s = transition(s, { kind: 'needs-feature', description: 'need util', suggestedTitle: 'Util' });
    // Now we're running the unblocker. Pretend it finished:
    s = transition(s, { kind: 'start', storyId: 'STORY-099' }); // unblocker's story
    s = transition(s, { kind: 'story-done' });
    s = transition(s, { kind: 'resume-paused' });
    expect(s.status).toBe('running');
    expect(s.currentStoryId).toBe('STORY-007');
    expect(s.currentTaskId).toBe('TASK-014');
    expect(s.pausedStack).toEqual([]);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('transition rejects illegal moves (idle → paused-blocked directly)', () => {
  const root = freshRoot();
  try {
    const s = readState(root);
    expect(() => transition(s, { kind: 'block', blocker: { kind: 'generic', reason: 'x' } })).toThrow(/illegal/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('writeState is atomic — partial write does not corrupt prior state', () => {
  const root = freshRoot();
  try {
    const s1: RunnerState = { ...INITIAL_STATE, status: 'running', currentStoryId: 'STORY-001', lastUpdatedAt: new Date().toISOString() };
    writeState(root, s1);
    // Simulate a crash by trying to write an invalid state — should not corrupt prior good state.
    expect(() => writeState(root, { ...s1, status: 'invalid' as never })).toThrow();
    const back = readState(root);
    expect(back.status).toBe('running');  // prior state intact
    expect(back.currentStoryId).toBe('STORY-001');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('readState recovers from a malformed runner.json by returning INITIAL_STATE + warning', () => {
  const root = freshRoot();
  try {
    const { writeFileSync } = require('node:fs') as typeof import('node:fs');
    writeFileSync(join(root, '.kadai/runner.json'), '{ malformed json');
    const s = readState(root);
    expect(s.status).toBe('idle');  // recovered cleanly
  } finally { rmSync(root, { recursive: true, force: true }); }
});
