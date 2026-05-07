export type RunnerStatus =
  | 'idle'
  | 'running'
  | 'paused-blocked'
  | 'paused-needs-feature'
  | 'paused-review'
  | 'error';

export interface RunnerState {
  status: RunnerStatus;
  currentStoryId: string | null;
  currentTaskId: string | null;
  // Stack of stories paused because they're waiting on dependencies.
  // Top of stack resumes when its blocker resolves.
  pausedStack: { storyId: string; taskId: string | null; reason: string }[];
  lastBlocker: Blocker | null;
  startedAt: string | null;       // ISO timestamp of current run
  lastUpdatedAt: string;          // ISO timestamp of last state mutation
  version: 1;                     // schema version for future migrations
}

export type Blocker =
  | { kind: 'needs-feature'; description: string; suggestedTitle?: string }
  | { kind: 'generic'; reason: string };

export const INITIAL_STATE: RunnerState = {
  status: 'idle',
  currentStoryId: null,
  currentTaskId: null,
  pausedStack: [],
  lastBlocker: null,
  startedAt: null,
  lastUpdatedAt: '1970-01-01T00:00:00.000Z',
  version: 1,
};
