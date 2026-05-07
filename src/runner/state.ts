import { existsSync, readFileSync, writeFileSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { INITIAL_STATE, type RunnerState, type Blocker, type RunnerStatus } from './types';

const STATE_PATH = '.kadai/runner.json';
const VALID_STATUSES: RunnerStatus[] = ['idle', 'running', 'paused-blocked', 'paused-needs-feature', 'paused-review', 'error'];

export function readState(rootDir: string): RunnerState {
  const path = join(rootDir, STATE_PATH);
  if (!existsSync(path)) return INITIAL_STATE;
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !VALID_STATUSES.includes(parsed.status)) {
      // Malformed — recover to initial state (caller can warn).
      return INITIAL_STATE;
    }
    return { ...INITIAL_STATE, ...parsed, version: 1 };
  } catch {
    return INITIAL_STATE;
  }
}

export function writeState(rootDir: string, state: RunnerState): void {
  if (!VALID_STATUSES.includes(state.status)) {
    throw new Error(`writeState: invalid status "${state.status}"`);
  }
  const path = join(rootDir, STATE_PATH);
  const tmpPath = `${path}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(state, null, 2), 'utf8');
  renameSync(tmpPath, path);  // atomic on POSIX; old file replaced or untouched on failure
}

export type Transition =
  | { kind: 'start'; storyId: string }
  | { kind: 'task-start'; taskId: string }
  | { kind: 'task-done' }
  | { kind: 'story-done' }
  | { kind: 'block'; blocker: Blocker }
  | { kind: 'needs-feature'; description: string; suggestedTitle?: string }
  | { kind: 'resume-paused' }
  | { kind: 'review-confirmed' }
  | { kind: 'reset' };

const ALLOWED: Record<RunnerStatus, Transition['kind'][]> = {
  idle: ['start'],
  running: ['task-start', 'task-done', 'story-done', 'block', 'needs-feature', 'resume-paused'],
  'paused-blocked': ['start', 'resume-paused', 'reset'],
  'paused-needs-feature': ['start', 'resume-paused', 'reset'],
  'paused-review': ['review-confirmed', 'reset'],
  error: ['reset'],
};

export function transition(state: RunnerState, t: Transition): RunnerState {
  if (!ALLOWED[state.status].includes(t.kind)) {
    throw new Error(`illegal transition: ${state.status} → ${t.kind}`);
  }
  const stamp = new Date().toISOString();
  const base = { ...state, lastUpdatedAt: stamp };

  switch (t.kind) {
    case 'start':
      return { ...base, status: 'running', currentStoryId: t.storyId, currentTaskId: null, startedAt: state.startedAt ?? stamp };
    case 'task-start':
      return { ...base, currentTaskId: t.taskId };
    case 'task-done':
      return { ...base, currentTaskId: null };
    case 'story-done': {
      // If we have a paused story to return to, do nothing yet — the runner loop calls 'resume-paused' next.
      // If not, transition to paused-review.
      if (state.pausedStack.length > 0) return base;
      return { ...base, status: 'paused-review' };
    }
    case 'block':
      return { ...base, status: 'paused-blocked', lastBlocker: t.blocker };
    case 'needs-feature': {
      const blocker: Blocker = { kind: 'needs-feature', description: t.description, suggestedTitle: t.suggestedTitle };
      // Push current onto the pausedStack so we can resume after the unblocker.
      const pausedFrame = { storyId: state.currentStoryId!, taskId: state.currentTaskId, reason: t.description };
      return { ...base, status: 'paused-needs-feature', lastBlocker: blocker, pausedStack: [...state.pausedStack, pausedFrame] };
    }
    case 'resume-paused': {
      const top = state.pausedStack[state.pausedStack.length - 1];
      if (!top) throw new Error('resume-paused: no paused story to resume');
      return { ...base, status: 'running', currentStoryId: top.storyId, currentTaskId: top.taskId, lastBlocker: null, pausedStack: state.pausedStack.slice(0, -1) };
    }
    case 'review-confirmed':
      return { ...base, status: 'idle', currentStoryId: null, currentTaskId: null };
    case 'reset':
      return { ...INITIAL_STATE, lastUpdatedAt: stamp };
  }
}
