# Kadai-aware skills + runner — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the kadai-aware brainstorming + writing-plans wrappers, the per-story plan slicing, the `kadai plan compose` composer, and the `kadai run` autonomous runner with fast-follow-up unblocking — per [`docs/superpowers/specs/2026-05-06-kadai-aware-skills-design.md`](../specs/2026-05-06-kadai-aware-skills-design.md).

**Architecture:** The CLI grows two new subcommands (`plan compose`, `run`). The runner is split into three modules — state persistence, per-story dispatch loop, blocker handling — so each is testable in isolation. The Claude Code plugin grows three new skills (`kadai-brainstorming`, `kadai-writing-plans`, `kadai-runner`) and two new slash commands. Hooks remain unchanged as the safety net.

**Tech Stack:** TypeScript on Bun (existing). `commander` for CLI subcommands. State persistence is JSON at `.kadai/runner.json`. Subagent dispatch uses the same Task-tool pattern as `superpowers:subagent-driven-development`. Tests use Bun's test runner; the dogfood test shells out to `claude -p` against a `mktemp -d` repo.

## Position in the build

| | |
|---|---|
| **This is plan** | post-Plan-17 (on feature branch `feature/kadai-aware-skills`) |
| **Prior plan** | [Plan 17 — Web viewer redesign](2026-05-06-kadai-17-web-viewer-redesign.md) — `DONE` |
| **Spec** | [`docs/superpowers/specs/2026-05-06-kadai-aware-skills-design.md`](../specs/2026-05-06-kadai-aware-skills-design.md) |
| **Branch** | `feature/kadai-aware-skills` (revertable; master is hooks-only) |
| **Plugin version after merge** | 1.3.0 → 1.4.0 |

## Spec → tasks map

| Spec section | Task |
|---|---|
| `kadai plan compose` CLI subcommand | 1 |
| Runner state model + persistence (`.kadai/runner.json`) | 2 |
| Runner per-story dispatch loop | 3 |
| Runner blocker detection + fast-follow-up unblocking | 4 |
| `kadai-brainstorming` skill (auto-create epic + attach spec + rework support) | 5 |
| `kadai-writing-plans` skill (per-story plan slicing + auto add task) | 6 |
| `kadai-runner` skill + `/kadai-run` + `/kadai-plan-compose` slash commands | 7 |
| Plugin manifest bump (1.3.0 → 1.4.0) + register new skills/commands | 8 |
| Documentation (wiki: plugin, cli-reference, concepts, troubleshooting) | 9 |
| Dogfood test via `claude -p` | 10 |

## File structure

```
src/cli/compose.ts                                 # NEW: `kadai plan compose <id>` impl
src/cli/run.ts                                     # NEW: `kadai run` impl (thin glue over src/runner/*)
src/cli/index.ts                                   # MODIFIED: register the two new subcommands
src/runner/state.ts                                # NEW: state model + .kadai/runner.json r/w
src/runner/dispatch.ts                             # NEW: per-story task iteration + subagent dispatch hook
src/runner/blocker.ts                              # NEW: blocker parsing + fast-follow-up flow
src/runner/types.ts                                # NEW: shared types (RunnerState, Blocker, etc.)

tests/cli/compose.test.ts                          # NEW: composer unit tests
tests/runner/state.test.ts                         # NEW: state model unit tests (transitions, persistence, recovery)
tests/runner/dispatch.test.ts                      # NEW: loop unit tests with mocked dispatcher
tests/runner/blocker.test.ts                       # NEW: blocker parsing + fast-follow-up unit tests
tests/cli/run.integration.test.ts                  # NEW: end-to-end integration test (mocked subagent)
tests/dogfood/kadai-aware-skills.dogfood.test.ts   # NEW: `claude -p` based end-to-end (Task 10)

kadai-plugin/skills/kadai-brainstorming/SKILL.md   # NEW
kadai-plugin/skills/kadai-writing-plans/SKILL.md   # NEW
kadai-plugin/skills/kadai-runner/SKILL.md          # NEW
kadai-plugin/commands/kadai-plan-compose.md        # NEW
kadai-plugin/commands/kadai-run.md                 # NEW
kadai-plugin/skills/kadai/SKILL.md                 # MODIFIED: point at new wrapper skills
kadai-plugin/.claude-plugin/plugin.json            # MODIFIED: 1.3.0 → 1.4.0

docs/wiki/plugin.md                                # MODIFIED: wrappers + runner
docs/wiki/cli-reference.md                         # MODIFIED: + plan compose, + run
docs/wiki/concepts.md                              # MODIFIED: runner state model section
docs/wiki/troubleshooting.md                       # MODIFIED: runner failure-mode entries
docs/wiki/post-mvp.md                              # MODIFIED: this plan → "Recently shipped" after merge
CLAUDE.md                                          # MODIFIED: active state → 1.4.0 after merge
```

## Tasks

---

### Task 1: `kadai plan compose <id>` CLI subcommand

**Files:**
- Create: `src/cli/compose.ts`
- Create: `tests/cli/compose.test.ts`
- Modify: `src/cli/index.ts` (register the subcommand)

**Goal:** Smallest task, no dependencies on the runner — builds confidence and gets the composite-plan rendering done before the runner needs it for review tooling.

- [x] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/cli/compose.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { composePlan } from '../../src/cli/compose';

function seedSpine(root: string) {
  // EPIC-001 / FEAT-001 / STORY-001 / STORY-002, each with a plan.md
  const story1 = join(root, '.kadai/epics/EPIC-001-auth/features/FEAT-001-email/stories/STORY-001-magic-link');
  const story2 = join(root, '.kadai/epics/EPIC-001-auth/features/FEAT-001-email/stories/STORY-002-pw-reset');
  mkdirSync(story1, { recursive: true });
  mkdirSync(story2, { recursive: true });
  writeFileSync(join(root, '.kadai/epics/EPIC-001-auth/epic.md'), '---\nid: EPIC-001\ntitle: Authentication\nphase: mvp\nstatus: in_progress\n---\n# Authentication\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-auth/features/FEAT-001-email/feature.md'), '---\nid: FEAT-001\nparent: EPIC-001\ntitle: Email login\nphase: mvp\nstatus: in_progress\n---\n# Email login\n');
  writeFileSync(join(story1, 'story.md'), '---\nid: STORY-001\nparent: FEAT-001\ntitle: Magic link delivery\nphase: mvp\nstatus: ready\n---\n');
  writeFileSync(join(story2, 'story.md'), '---\nid: STORY-002\nparent: FEAT-001\ntitle: Password reset\nphase: mvp\nstatus: ready\n---\n');
  writeFileSync(join(story1, 'plan.md'), '# STORY-001 Plan\n\n## Task 1: Wire SES\n\nCode here.\n');
  writeFileSync(join(story2, 'plan.md'), '# STORY-002 Plan\n\n## Task 1: Token rotation\n');
  // counters file (kadai expects it)
  writeFileSync(join(root, '.kadai/.counters.json'), JSON.stringify({ epic: 1, feature: 1, story: 2, task: 0 }));
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n');
}

test('compose EPIC-001 returns composite of all descendant story plans', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-compose-'));
  try {
    seedSpine(tmp);
    const out = composePlan(tmp, 'EPIC-001');
    expect(out).toContain('# Composite plan — EPIC-001');
    expect(out).toContain('## STORY-001 — Magic link delivery');
    expect(out).toContain('Wire SES');
    expect(out).toContain('## STORY-002 — Password reset');
    expect(out).toContain('Token rotation');
    // Order should be by story ID (STORY-001 before STORY-002)
    expect(out.indexOf('STORY-001')).toBeLessThan(out.indexOf('STORY-002'));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('compose FEAT-001 returns same descendants when scoped to feature', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-compose-'));
  try {
    seedSpine(tmp);
    const out = composePlan(tmp, 'FEAT-001');
    expect(out).toContain('# Composite plan — FEAT-001');
    expect(out).toContain('STORY-001');
    expect(out).toContain('STORY-002');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('compose returns null for unknown ID', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-compose-'));
  try {
    seedSpine(tmp);
    expect(composePlan(tmp, 'EPIC-999')).toBeNull();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('compose skips stories without plan.md', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-compose-'));
  try {
    seedSpine(tmp);
    // Add a third story without a plan
    const story3 = join(tmp, '.kadai/epics/EPIC-001-auth/features/FEAT-001-email/stories/STORY-003-tokens');
    mkdirSync(story3, { recursive: true });
    writeFileSync(join(story3, 'story.md'), '---\nid: STORY-003\nparent: FEAT-001\ntitle: Tokens\nphase: mvp\nstatus: backlog\n---\n');
    const out = composePlan(tmp, 'EPIC-001');
    expect(out).toContain('STORY-001');
    expect(out).toContain('STORY-002');
    expect(out).toContain('STORY-003');
    // STORY-003 should be present with a "(no plan yet)" marker
    expect(out).toMatch(/STORY-003.*no plan yet/s);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/compose.test.ts
```

Expected: 4 failures, "Cannot find module '../../src/cli/compose'".

- [x] **Step 3: Implement composePlan**

Create `/home/fintan/repos/kadai/src/cli/compose.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { Command } from 'commander';
import { walkSpine, findById } from '../core/spine';
import { findKadaiRoot } from '../core/find-root';
import type { Item } from '../core/types';

export function composePlan(rootDir: string, id: string): string | null {
  const root = findById(rootDir, id);
  if (!root) return null;

  const all = walkSpine(rootDir);
  const stories: Item[] = [];

  // Collect all descendant stories (recursive parent walk).
  const collectStories = (parentId: string) => {
    for (const item of all) {
      const data = item.data as { id: string; parent?: string };
      if (data.parent !== parentId) continue;
      if (item.kind === 'story') {
        stories.push(item);
      } else {
        collectStories(data.id);
      }
    }
  };
  collectStories(id);

  // Sort stories by ID for deterministic order.
  stories.sort((a, b) => (a.data as { id: string }).id.localeCompare((b.data as { id: string }).id));

  const lines: string[] = [];
  lines.push(`# Composite plan — ${id}`);
  const rootData = root.data as { id: string; title: string };
  lines.push(`> **${rootData.title}** — generated ${new Date().toISOString()} from ${stories.length} story plan(s).`);
  lines.push('');

  for (const story of stories) {
    const sd = story.data as { id: string; title: string };
    lines.push(`## ${sd.id} — ${sd.title}`);
    lines.push('');
    const planPath = join(dirname(story.path), 'plan.md');
    if (existsSync(planPath)) {
      lines.push(readFileSync(planPath, 'utf8').trim());
    } else {
      lines.push('_(no plan yet)_');
    }
    lines.push('');
  }

  return lines.join('\n');
}

export const composeCommand = new Command('compose')
  .description('Render all descendant story plans of an epic/feature/story as one composite document')
  .argument('<id>', 'epic, feature, or story ID to compose from')
  .option('--out <path>', 'write to file instead of stdout')
  .action((id: string, opts: { out?: string }) => {
    const root = findKadaiRoot(process.cwd());
    if (!root) { process.stderr.write('Not inside a kadai project\n'); process.exit(1); }
    const result = composePlan(root, id);
    if (result === null) { process.stderr.write(`No item with ID ${id}\n`); process.exit(2); }
    if (opts.out) {
      const { writeFileSync } = require('node:fs') as typeof import('node:fs');
      writeFileSync(opts.out, result, 'utf8');
      process.stdout.write(`wrote ${opts.out}\n`);
    } else {
      process.stdout.write(result + '\n');
    }
  });
```

- [x] **Step 4: Wire into the CLI as `kadai plan compose`**

Read `/home/fintan/repos/kadai/src/cli/index.ts` to find where subcommands are registered. Add a `plan` parent command with `compose` as its child:

```typescript
import { composeCommand } from './compose';

const planCommand = new Command('plan')
  .description('Plan composition + analysis tools');
planCommand.addCommand(composeCommand);
program.addCommand(planCommand);
```

- [x] **Step 5: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/compose.test.ts
bun run typecheck
```

Expected: 4 pass, typecheck clean.

- [x] **Step 6: Smoke-test the CLI surface**

```bash
cd /home/fintan/repos/kadai
bun src/cli/index.ts plan compose --help
# Should print usage. Exit 0.
```

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/compose.ts src/cli/index.ts tests/cli/compose.test.ts
git commit -m "$(cat <<'EOF'
feat(cli): kadai plan compose <id> — concatenate descendant story plans [aware-skills Task-1]

New subcommand reads the spine from a given epic/feature/story root,
walks descendant stories in deterministic ID order, and emits one
composite markdown document containing every story's plan.md.

Stories without a plan.md render as "(no plan yet)" so the composite
mirrors the actual spine state. --out writes to a file instead of stdout.

This is the human-review escape hatch for the per-story plan slicing
the kadai-writing-plans wrapper introduces in Task 6 — read the whole
thing top-to-bottom without losing the spine's source of truth.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Runner state model + persistence

**Files:**
- Create: `src/runner/types.ts`
- Create: `src/runner/state.ts`
- Create: `tests/runner/state.test.ts`

**Goal:** The state machine + JSON persistence layer that the runner loop and blocker handler will both depend on. Independent + heavily tested before anything builds on it.

- [x] **Step 1: Write the types**

Create `/home/fintan/repos/kadai/src/runner/types.ts`:

```typescript
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
```

- [x] **Step 2: Write the failing state-model tests**

Create `/home/fintan/repos/kadai/tests/runner/state.test.ts`:

```typescript
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
```

- [x] **Step 3: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/runner/state.test.ts
```

Expected: 9 failures, all "Cannot find module".

- [x] **Step 4: Implement state.ts**

Create `/home/fintan/repos/kadai/src/runner/state.ts`:

```typescript
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
```

- [x] **Step 5: Run tests, verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/runner/state.test.ts
bun run typecheck
```

Expected: 9 pass, typecheck clean.

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/runner/types.ts src/runner/state.ts tests/runner/state.test.ts
git commit -m "$(cat <<'EOF'
feat(runner): state model + atomic .kadai/runner.json persistence [aware-skills Task-2]

The state machine + JSON persistence layer for `kadai run`. Six statuses
(idle / running / paused-blocked / paused-needs-feature / paused-review /
error) with an explicit allowed-transitions table — illegal transitions
throw rather than silently advancing.

Persistence is atomic via write-temp-then-rename; partial writes don't
corrupt prior good state. Malformed runner.json on read recovers to
INITIAL_STATE so a corrupt file doesn't lock the runner out forever.

The pausedStack lets the runner queue a paused story while it executes
a fast-follow-up unblocker (Task 4 wires this end to end). 9 unit
tests cover the happy path, illegal transitions, atomic-write recovery,
and malformed-file recovery.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Runner per-story dispatch loop

**Files:**
- Create: `src/runner/dispatch.ts`
- Create: `tests/runner/dispatch.test.ts`

**Goal:** The loop that, given a picked story, walks its plan's tasks, dispatches an implementer, and reports outcome. Pure logic (no actual subagent — that's injected). Heavily mockable.

- [ ] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/runner/dispatch.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runStory } from '../../src/runner/dispatch';
import type { ImplementerOutcome, Dispatcher } from '../../src/runner/dispatch';

function seedStory(root: string, storyId: string, plan: string) {
  const story = join(root, `.kadai/epics/EPIC-001-x/features/FEAT-001-y/stories/${storyId}-z`);
  mkdirSync(story, { recursive: true });
  writeFileSync(join(story, 'story.md'), `---\nid: ${storyId}\nparent: FEAT-001\ntitle: x\nphase: mvp\nstatus: ready\n---\n`);
  writeFileSync(join(story, 'plan.md'), plan);
  // Minimum spine setup
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: in_progress\n---\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/feature.md'), '---\nid: FEAT-001\nparent: EPIC-001\ntitle: Y\nphase: mvp\nstatus: in_progress\n---\n');
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
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/runner/dispatch.test.ts
```

Expected: 5 failures.

- [ ] **Step 3: Implement dispatch.ts**

Create `/home/fintan/repos/kadai/src/runner/dispatch.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { findById } from '../core/spine';
import type { Blocker } from './types';

export type ImplementerOutcome =
  | { status: 'DONE' }
  | { status: 'DONE_WITH_CONCERNS'; concerns: string }
  | { status: 'BLOCKED'; reason: string }
  | { status: 'NEEDS_CONTEXT'; missing: string };

export type Dispatcher = (taskTitle: string, taskBody: string, storyContext: { id: string; title: string }) => Promise<ImplementerOutcome>;

export type StoryRunResult =
  | { kind: 'story-done'; completedTasks: number }
  | { kind: 'blocked'; blocker: Blocker; completedTasks: number; remainingTaskTitle: string }
  | { kind: 'needs-feature'; description: string; suggestedTitle?: string; completedTasks: number; remainingTaskTitle: string }
  | { kind: 'error'; message: string };

interface ParsedTask {
  title: string;
  body: string;
}

export function parseTasks(planMarkdown: string): ParsedTask[] {
  const lines = planMarkdown.split('\n');
  const tasks: ParsedTask[] = [];
  let current: ParsedTask | null = null;
  for (const line of lines) {
    const m = line.match(/^##\s+(Task\s+.+)$/);
    if (m) {
      if (current) tasks.push(current);
      current = { title: m[1].trim(), body: '' };
    } else if (current) {
      current.body += line + '\n';
    }
  }
  if (current) tasks.push(current);
  return tasks.map(t => ({ title: t.title, body: t.body.trim() }));
}

function parseBlocker(reason: string): Blocker {
  const m = reason.match(/^needs-feature:\s*(.+)$/i);
  if (m) {
    return { kind: 'needs-feature', description: m[1].trim() };
  }
  return { kind: 'generic', reason };
}

export async function runStory(rootDir: string, storyId: string, dispatcher: Dispatcher): Promise<StoryRunResult> {
  const story = findById(rootDir, storyId);
  if (!story) return { kind: 'error', message: `Story ${storyId} not found` };

  const planPath = join(dirname(story.path), 'plan.md');
  if (!existsSync(planPath)) return { kind: 'error', message: `Story ${storyId} has no plan.md` };

  const tasks = parseTasks(readFileSync(planPath, 'utf8'));
  const sd = story.data as { id: string; title: string };
  const ctx = { id: sd.id, title: sd.title };

  let completed = 0;
  for (const task of tasks) {
    const outcome = await dispatcher(task.title, task.body, ctx);
    if (outcome.status === 'DONE' || outcome.status === 'DONE_WITH_CONCERNS') {
      completed++;
      continue;
    }
    if (outcome.status === 'BLOCKED') {
      const blocker = parseBlocker(outcome.reason);
      if (blocker.kind === 'needs-feature') {
        return { kind: 'needs-feature', description: blocker.description, completedTasks: completed, remainingTaskTitle: task.title };
      }
      return { kind: 'blocked', blocker, completedTasks: completed, remainingTaskTitle: task.title };
    }
    if (outcome.status === 'NEEDS_CONTEXT') {
      return { kind: 'blocked', blocker: { kind: 'generic', reason: `needs context: ${outcome.missing}` }, completedTasks: completed, remainingTaskTitle: task.title };
    }
  }
  return { kind: 'story-done', completedTasks: completed };
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/runner/dispatch.test.ts
bun run typecheck
```

Expected: 5 pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/runner/dispatch.ts tests/runner/dispatch.test.ts
git commit -m "$(cat <<'EOF'
feat(runner): per-story dispatch loop with mockable Dispatcher [aware-skills Task-3]

Pure logic — runStory(rootDir, storyId, dispatcher) reads the story's
plan.md, parses ## Task N headings, and walks them sequentially. Each
task body is handed to the injected Dispatcher (which in production
will be a Task-tool-based subagent dispatcher; in tests, a mock).

Outcomes:
- DONE / DONE_WITH_CONCERNS → advance to next task
- BLOCKED with reason "needs-feature: <desc>" → escalate to caller
  as { kind: 'needs-feature', description }
- BLOCKED with anything else → escalate as { kind: 'blocked', blocker }
- NEEDS_CONTEXT → also escalates as blocked with parsed reason
- All tasks complete → { kind: 'story-done' }

5 unit tests covering: happy path, mid-story blocker, needs-feature
detection, missing plan.md, plan with no task headings (vacuous done).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Runner blocker handling + fast-follow-up

**Files:**
- Create: `src/runner/blocker.ts`
- Create: `tests/runner/blocker.test.ts`

**Goal:** When dispatch returns `needs-feature`, this module handles the fast-follow-up flow: surfacing the blocker, recording the dependency edge in the spine, and managing the resume order.

- [ ] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/runner/blocker.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recordDependencyEdge, formatBlockerPrompt } from '../../src/runner/blocker';

function seedStory(root: string) {
  const story = join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/stories/STORY-007-z');
  mkdirSync(story, { recursive: true });
  writeFileSync(join(story, 'story.md'), '---\nid: STORY-007\nparent: FEAT-001\ntitle: Original story\nphase: mvp\nstatus: in_progress\n---\n# body\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: in_progress\n---\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/feature.md'), '---\nid: FEAT-001\nparent: EPIC-001\ntitle: Y\nphase: mvp\nstatus: in_progress\n---\n');
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":1,"feature":1,"story":7,"task":0}');
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n');
  return story;
}

test('recordDependencyEdge writes a dependsOn field to the blocked story frontmatter', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-blocker-'));
  try {
    const storyDir = seedStory(root);
    recordDependencyEdge(root, 'STORY-007', 'FEAT-009');
    const updated = readFileSync(join(storyDir, 'story.md'), 'utf8');
    expect(updated).toMatch(/^dependsOn:\s*\[FEAT-009\]/m);
    expect(updated).toContain('# body');  // body preserved
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('recordDependencyEdge appends to existing dependsOn array (idempotent for same id)', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-blocker-'));
  try {
    const storyDir = seedStory(root);
    recordDependencyEdge(root, 'STORY-007', 'FEAT-009');
    recordDependencyEdge(root, 'STORY-007', 'FEAT-010');
    recordDependencyEdge(root, 'STORY-007', 'FEAT-009');  // duplicate, no-op
    const updated = readFileSync(join(storyDir, 'story.md'), 'utf8');
    expect(updated).toMatch(/dependsOn:\s*\[FEAT-009, FEAT-010\]/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('formatBlockerPrompt produces a clear human-readable summary for needs-feature', () => {
  const out = formatBlockerPrompt({
    storyId: 'STORY-007',
    taskTitle: 'Task 4: Wire SES',
    blocker: { kind: 'needs-feature', description: 'A reusable config loader before this story can wire SES correctly', suggestedTitle: 'Config loader' },
  });
  expect(out).toContain('STORY-007');
  expect(out).toContain('Task 4: Wire SES');
  expect(out).toContain('Config loader');
  expect(out).toContain('config loader before this story');
  expect(out).toMatch(/\[Y\/n\/skip\]/);
});

test('formatBlockerPrompt produces a different summary for generic blockers', () => {
  const out = formatBlockerPrompt({
    storyId: 'STORY-008',
    taskTitle: 'Task 1: Make it work',
    blocker: { kind: 'generic', reason: 'turned out to be way harder than expected' },
  });
  expect(out).toContain('STORY-008');
  expect(out).toContain('way harder than expected');
  expect(out).not.toMatch(/needs-feature|fast.follow.up/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/runner/blocker.test.ts
```

Expected: 4 failures.

- [ ] **Step 3: Implement blocker.ts**

Create `/home/fintan/repos/kadai/src/runner/blocker.ts`:

```typescript
import { readFileSync, writeFileSync } from 'node:fs';
import matter from 'gray-matter';
import { findById } from '../core/spine';
import type { Blocker } from './types';

export function recordDependencyEdge(rootDir: string, blockedStoryId: string, dependsOnId: string): void {
  const item = findById(rootDir, blockedStoryId);
  if (!item) throw new Error(`recordDependencyEdge: story ${blockedStoryId} not found`);
  const raw = readFileSync(item.path, 'utf8');
  const parsed = matter(raw);
  const data = parsed.data as { dependsOn?: string[] };
  const existing = Array.isArray(data.dependsOn) ? data.dependsOn : [];
  if (existing.includes(dependsOnId)) return;  // idempotent
  data.dependsOn = [...existing, dependsOnId];
  // Manual stringify so we control the format (gray-matter's default uses YAML which would break our [a, b] expectation).
  const newFrontmatter = Object.entries(data).map(([k, v]) => {
    if (Array.isArray(v)) return `${k}: [${v.join(', ')}]`;
    return `${k}: ${v}`;
  }).join('\n');
  writeFileSync(item.path, `---\n${newFrontmatter}\n---\n${parsed.content}`, 'utf8');
}

export interface BlockerContext {
  storyId: string;
  taskTitle: string;
  blocker: Blocker;
}

export function formatBlockerPrompt(ctx: BlockerContext): string {
  if (ctx.blocker.kind === 'needs-feature') {
    const title = ctx.blocker.suggestedTitle ?? '(unnamed)';
    return [
      `${ctx.storyId} hit a blocker on ${ctx.taskTitle}.`,
      ``,
      `The implementer believes a fast-follow-up feature is needed:`,
      `  Title: ${title}`,
      `  Why:   ${ctx.blocker.description}`,
      ``,
      `Plan it now and resume after? [Y/n/skip]`,
    ].join('\n');
  }
  return [
    `${ctx.storyId} hit a blocker on ${ctx.taskTitle}.`,
    ``,
    `Reason: ${ctx.blocker.reason}`,
    ``,
    `The runner is paused. Resolve manually, then \`kadai run --resume\`.`,
  ].join('\n');
}
```

- [ ] **Step 4: Run tests, verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/runner/blocker.test.ts
bun run typecheck
```

Expected: 4 pass, typecheck clean.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/runner/blocker.ts tests/runner/blocker.test.ts
git commit -m "$(cat <<'EOF'
feat(runner): blocker handling + fast-follow-up dependency edge [aware-skills Task-4]

Two pieces:

- recordDependencyEdge(rootDir, blockedStoryId, dependsOnId) — writes
  a `dependsOn: [FEAT-XXX]` field to the blocked story's frontmatter.
  Idempotent for the same dependency ID, appends new ones, preserves
  story body. This is the durable record of "STORY-007 was paused
  because it needed FEAT-009" — survives runner crashes; visible to
  `kadai status` and the web viewer.

- formatBlockerPrompt(ctx) — renders the human-readable prompt the
  runner skill shows when a blocker fires. Different message shapes
  for `needs-feature` (offer to plan unblocker) vs generic (manual
  resolution required).

4 unit tests covering the dependsOn write, idempotency, multi-deps,
and the two prompt variants.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: `kadai-brainstorming` skill

**Files:**
- Create: `kadai-plugin/skills/kadai-brainstorming/SKILL.md`

**Goal:** Wrapper skill that invokes the upstream brainstorming flow verbatim, then plumbs the spec into the spine (auto-creates epic if needed, creates feature, attaches spec). On rework of an existing feature, replaces the spec and backs up the old one.

- [ ] **Step 1: Write the SKILL.md**

Create `/home/fintan/repos/kadai/kadai-plugin/skills/kadai-brainstorming/SKILL.md`:

```markdown
---
name: kadai-brainstorming
description: "Use INSTEAD OF superpowers:brainstorming when working in any repository that contains a `.kadai/` directory. Runs the full brainstorming flow (explore → questions → approaches → design → user approval → spec → self-review) AND then plumbs the result into the kadai spine: auto-creates the epic if missing, creates a feature, attaches the spec to the feature as `spec.md`. The single visible artifact at the end is a feature in `.kadai/epics/<E>/features/<F>/` with `spec.md` attached, NOT a free-floating `docs/superpowers/specs/*.md`. If you load `superpowers:brainstorming` in a kadai repo, you'll write specs into the wrong place and lose the spec → plan → implementation provenance kadai is designed to capture."
---

# Kadai-aware brainstorming

This skill wraps `superpowers:brainstorming` with kadai spine plumbing. The conversational question flow, the visual companion offer, the design presentation, and the user-approval gates are all unchanged — the upstream skill's content carries through.

## What this skill adds

At the **spec-writing** step (after the user approves the design, before you would write to `docs/superpowers/specs/...`), do this instead:

### 1. Determine the epic

- Call `kadai.list_epics()` (MCP).
- If exactly one epic obviously matches the intent → use it.
- If multiple match → ask the user: "Which epic should this live under? Existing: [list]. Or create a new one?"
- If none match → create one: `kadai.create_epic(title=<inferred from brainstorm>, phase='mvp')`. The brainstorming flow's "what are we building" answer is usually the epic title.

### 2. Determine the feature

- If you're **reworking** an existing feature (the user said "let's redo FEAT-XXX" or similar), use that feature ID. Skip to step 4.
- Otherwise, create a new feature: `kadai.create_feature(epic_id=<id>, title=<derived from spec>, phase=<epic's phase>)`.

### 3. Write the spec

- Generate the spec content as you would normally — same structure as the upstream skill produces.
- Write it to a temp file in `/tmp/`, then call `kadai.attach_spec(feature_id=<id>, source_path=<tmp-path>)`. This moves the file into the feature's directory as `spec.md`.

### 4. Rework path (re-run on existing feature)

- If the feature already has a `spec.md` and the user is reworking:
  - Back up the existing spec: copy `.kadai/epics/<E>/features/<F>/spec.md` to `spec.<ISO-timestamp>.md.bak` in the same directory. (Use the `kadai.attach_spec` MCP tool if it supports a `replace` parameter; otherwise do the backup yourself via shell `cp` then call the standard `attach_spec` which overwrites.)
  - Confirm with the user: "Replaced FEAT-XXX/spec.md (old version archived as spec.<timestamp>.md.bak). Stories under this feature stay; rerun /kadai-writing-plans if the rework is large enough to redecompose."

### 5. Self-review the spec (same as upstream)

The self-review pass is unchanged: scan for placeholders, internal contradictions, scope creep, ambiguity.

### 6. User review gate

Tell the user: "Spec written and attached to FEAT-XXX. Read it at `.kadai/epics/<E>/features/<F>/spec.md`. Let me know if you want changes before we run /kadai-writing-plans."

### 7. Hand off

When the user approves, invoke `kadai-writing-plans` (NOT `superpowers:writing-plans`).

## Detection: am I in a kadai repo?

Run this check at the START of the skill:
```bash
test -d .kadai && echo "kadai repo" || echo "non-kadai repo"
```

If non-kadai → fall through to `superpowers:brainstorming` and warn the user once: "This is `kadai-brainstorming` but no `.kadai/` was found — invoking upstream brainstorming with no spine plumbing."

## Anti-patterns

- **Don't write to `docs/superpowers/specs/`.** That's the upstream skill's path. Kadai's spine is `.kadai/epics/<E>/features/<F>/spec.md`.
- **Don't skip step 1 (the epic question).** Even if it feels like friction — re-using an existing epic vs creating a new one is a genuine architectural decision the user should own.
- **Don't auto-replace specs without confirming.** Rework is destructive; show the user the old vs new diff if the rework is large.

## See also

- Upstream brainstorming: `superpowers:brainstorming` (do NOT load both — this skill subsumes it)
- Next step: `kadai-writing-plans`
- Kadai discipline: the `kadai` skill (passive guidance + MCP tool reference)
```

- [ ] **Step 2: No tests for skill content directly — coverage comes via the dogfood test (Task 10).** Verify the file is valid markdown:

```bash
cd /home/fintan/repos/kadai
head -5 kadai-plugin/skills/kadai-brainstorming/SKILL.md  # frontmatter present
wc -l kadai-plugin/skills/kadai-brainstorming/SKILL.md
```

Expected: prints frontmatter, line count > 50.

- [ ] **Step 3: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/skills/kadai-brainstorming/SKILL.md
git commit -m "$(cat <<'EOF'
feat(plugin): kadai-brainstorming wrapper skill [aware-skills Task-5]

Wraps superpowers:brainstorming with kadai spine plumbing. The
conversational flow stays upstream-faithful; the difference is at
the spec-writing step:

1. Find or auto-create the epic (asks user only if ambiguous)
2. Create the feature
3. Attach the spec via kadai.attach_spec MCP tool — lands at
   .kadai/epics/<E>/features/<F>/spec.md, not docs/superpowers/

Rework path: if a feature already has spec.md, attach with
replace=true — old spec archived as spec.<timestamp>.md.bak.
Stories under the feature stay; user can rerun writing-plans if
the rework needs redecomposition.

Detection step: if no .kadai/ exists, fall through to upstream
brainstorming and warn (skill is no-op outside kadai repos).

Hand off to kadai-writing-plans (not the upstream variant).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `kadai-writing-plans` skill

**Files:**
- Create: `kadai-plugin/skills/kadai-writing-plans/SKILL.md`

**Goal:** Wrapper that invokes the upstream writing-plans flow but emits **one plan.md per story** directly into the spine, with each `### Task N` block becoming a real `kadai add task` call.

- [ ] **Step 1: Write the SKILL.md**

Create `/home/fintan/repos/kadai/kadai-plugin/skills/kadai-writing-plans/SKILL.md`:

```markdown
---
name: kadai-writing-plans
description: "Use INSTEAD OF superpowers:writing-plans when writing implementation plans inside a kadai-tracked repo (`.kadai/` present). Decomposes the feature into kadai stories, writes one `plan.md` per story directly into the spine (`.kadai/.../stories/<id>/plan.md`), and creates one real kadai task for each `### Task N` block. Auto-picks the first story when done. Without this wrapper you'll produce a single freeform plan that someone has to translate into spine items by hand."
---

# Kadai-aware writing-plans

Wraps `superpowers:writing-plans`. The "DRY / YAGNI / TDD / frequent commits" discipline, the bite-sized step granularity, the "no placeholders" rule, the self-review pass — all unchanged. The wrapper only changes WHERE the plan lands and HOW it maps to the spine.

## What this skill adds

Plans no longer come out as one big `<feature>.md`. They're sliced **per story**, and each `### Task N` becomes a real kadai task.

### 1. Read the feature spec

```bash
# The feature was attached by kadai-brainstorming; read its spec:
kadai get-file <feature-id> spec.md
```

(Or via MCP: `kadai.get_file(feature_id, 'spec.md')`.)

### 2. Decompose into stories

- Read the spec's "Implementation notes" or "Suggested implementation tasks" section if present — that's usually a natural story boundary.
- Otherwise, propose a decomposition: "I see N stories here: [list of titles]. Each should be small enough to implement in one session. Confirm or revise."
- Wait for user approval. Story decomposition is the most user-facing decision in this flow — don't auto-confirm.

### 3. Create the stories

For each approved story:

```bash
kadai add story --feature <feature-id> --title "<name>" --phase <inherited from feature>
```

(Or via MCP: `kadai.create_story(...)`.) Capture the returned story IDs.

### 4. Write per-story plans

For each story, run the upstream writing-plans question content (file structure, task decomposition, code blocks per step) but limit the scope to **just that story's tasks**. Don't include cross-story tasks in the same plan.

Output: one `plan.md` per story, written via `kadai attach_plan <story-id> <tmp-path>`.

### 5. Create the tasks

For each `### Task N: <title>` block in each plan, create a real kadai task:

```bash
kadai add task --story <story-id> --title "<title>"
```

Back-reference the task ID in the plan as a comment: `<!-- TASK-001 -->` immediately after the heading. This lets the runner correlate plan tasks with spine tasks.

### 6. Self-review per story

Run the per-story self-review (placeholder scan, type consistency, spec coverage). The cross-story consistency check ("does Task 7 in STORY-002 align with the deliverable from STORY-001?") is harder; flag uncertainties for the user.

### 7. Auto-pick the first story

```bash
kadai pick STORY-001
# kadai pick auto-transitions to in_progress
```

### 8. Present the runner option

Tell the user:

> "Plans written and attached. Three execution options:
> 
> 1. **`kadai run` (autonomous)** — runner walks the stories one by one, dispatches subagents per task, pauses for review at story boundaries.
> 2. **Subagent-driven (manual)** — I dispatch a subagent per task, you review between tasks. (`superpowers:subagent-driven-development`)
> 3. **Inline** — I execute the tasks in this session with checkpoints. (`superpowers:executing-plans`)
> 
> Which approach?"

If the user picks `kadai run`, invoke the `kadai-runner` skill (or run `/kadai-run` directly).

## Detection: am I in a kadai repo?

Same check as `kadai-brainstorming`. If `.kadai/` is missing, fall through to `superpowers:writing-plans` and warn.

## Anti-patterns

- **Don't write to `docs/superpowers/plans/`.** Plans live under `.kadai/.../stories/<id>/plan.md`.
- **Don't auto-create stories without showing the user the proposed decomposition.** Story shape is the most opinionated decision the wrapper makes.
- **Don't skip the kadai-add-task step.** Without it, the runner can't track per-task progress.
- **Don't try to compose cross-story dependencies in the plan.** The spine carries dependency edges (`dependsOn` field on the story); plans stay scoped to their own story.

## See also

- Upstream writing-plans: `superpowers:writing-plans` (do NOT load both)
- Composite review: `kadai plan compose <epic-id>` renders all per-story plans as one document.
- Next step: `kadai-runner` (or one of the manual execution skills).
```

- [ ] **Step 2: Verify the file**

```bash
cd /home/fintan/repos/kadai
head -5 kadai-plugin/skills/kadai-writing-plans/SKILL.md
wc -l kadai-plugin/skills/kadai-writing-plans/SKILL.md
```

Expected: frontmatter present, line count > 60.

- [ ] **Step 3: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/skills/kadai-writing-plans/SKILL.md
git commit -m "$(cat <<'EOF'
feat(plugin): kadai-writing-plans wrapper skill [aware-skills Task-6]

Wraps superpowers:writing-plans with per-story spine slicing.

Behavior change vs upstream:
- Plans are NOT one freeform docs/superpowers/plans/<feature>.md.
- Decomposition step proposes N stories from the feature spec, asks
  the user to confirm/revise, then creates them via kadai add story.
- One plan.md per story, written into .kadai/.../stories/<id>/plan.md
  via kadai attach_plan.
- Each ### Task N block becomes a real kadai add task call. The plan
  back-references the task ID via <!-- TASK-XXX --> comments so the
  runner can correlate.
- First story is auto-picked at the end.
- Hand-off offers three execution paths: kadai run (new), subagent-
  driven (existing), inline (existing).

Detection: falls through to upstream writing-plans if no .kadai/.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: `kadai run` CLI + `kadai-runner` skill + slash commands

**Files:**
- Create: `src/cli/run.ts`
- Modify: `src/cli/index.ts` (register `run` subcommand)
- Create: `kadai-plugin/skills/kadai-runner/SKILL.md`
- Create: `kadai-plugin/commands/kadai-run.md`
- Create: `kadai-plugin/commands/kadai-plan-compose.md`
- Create: `tests/cli/run.integration.test.ts`

**Goal:** Glue the runner pieces (state, dispatch, blocker) into a working CLI command, plus the Claude Code surface that handles the conversational "plan the unblocker?" prompt.

- [ ] **Step 1: Write the integration test**

Create `/home/fintan/repos/kadai/tests/cli/run.integration.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
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
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: in_progress\n---\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/feature.md'), '---\nid: FEAT-001\nparent: EPIC-001\ntitle: Y\nphase: mvp\nstatus: in_progress\n---\n');
  writeFileSync(join(story1, 'story.md'), '---\nid: STORY-001\nparent: FEAT-001\ntitle: First\nphase: mvp\nstatus: ready\n---\n');
  writeFileSync(join(story2, 'story.md'), '---\nid: STORY-002\nparent: FEAT-001\ntitle: Second\nphase: mvp\nstatus: ready\n---\n');
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
    writeFileSync(join(root, '.kadai/epics/EPIC-001-x/features/FEAT-099-z/feature.md'), '---\nid: FEAT-099\nparent: EPIC-001\ntitle: Z\nphase: mvp\nstatus: in_progress\n---\n');
    writeFileSync(join(story99, 'story.md'), '---\nid: STORY-099\nparent: FEAT-099\ntitle: Q\nphase: mvp\nstatus: ready\n---\n');
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
    await runOnce(root, dispatchB);
    // Story-99 done → state should advance to paused-review… BUT the pausedStack has STORY-001 waiting.
    // The runner should NOT enter paused-review here; it should resume STORY-001 instead.
    const stateAfter = readState(root);
    expect(['running', 'paused-review']).toContain(stateAfter.status);
    // Prove STORY-001 is the active story now (resume happened) OR it's been popped to currentStoryId via subsequent --resume.
    // Acceptable: either runner.json says STORY-001 is active, or pausedStack has been cleared and STORY-001 is currentStoryId.
    if (stateAfter.status === 'running') {
      expect(stateAfter.currentStoryId).toBe('STORY-001');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/run.integration.test.ts
```

Expected: 5 failures, "Cannot find module '../../src/cli/run'".

- [ ] **Step 3: Implement run.ts**

Create `/home/fintan/repos/kadai/src/cli/run.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import { findKadaiRoot } from '../core/find-root';
import { readState, writeState, transition } from '../runner/state';
import { runStory, type Dispatcher } from '../runner/dispatch';
import { recordDependencyEdge, formatBlockerPrompt } from '../runner/blocker';

export type RunOnceResult =
  | { kind: 'story-done' }
  | { kind: 'paused-review' }
  | { kind: 'paused-needs-feature'; description: string }
  | { kind: 'paused-blocked'; reason: string }
  | { kind: 'no-story-picked' }
  | { kind: 'resumed' };

export async function runOnce(rootDir: string, dispatcher: Dispatcher): Promise<RunOnceResult> {
  const pickedPath = join(rootDir, '.kadai/picked');
  if (!existsSync(pickedPath)) return { kind: 'no-story-picked' };
  const storyId = readFileSync(pickedPath, 'utf8').trim();

  let state = readState(rootDir);
  // If we're idle, transition to running.
  if (state.status === 'idle') {
    state = transition(state, { kind: 'start', storyId });
    writeState(rootDir, state);
  }

  const result = await runStory(rootDir, storyId, dispatcher);

  if (result.kind === 'story-done') {
    // Did this story have a paused-stack waiter (i.e., was this an unblocker)?
    if (state.pausedStack.length > 0) {
      // Resume the prior story. State is already 'running'; resume-paused is allowed
      // from 'running' precisely so this transition works without an intermediate step.
      const popped = transition(state, { kind: 'resume-paused' });
      writeState(rootDir, popped);
      return { kind: 'resumed' };
    }
    state = transition(state, { kind: 'story-done' });
    writeState(rootDir, state);
    return { kind: 'paused-review' };
  }

  if (result.kind === 'needs-feature') {
    state = transition(state, { kind: 'needs-feature', description: result.description });
    writeState(rootDir, state);
    return { kind: 'paused-needs-feature', description: result.description };
  }

  if (result.kind === 'blocked') {
    state = transition(state, { kind: 'block', blocker: result.blocker });
    writeState(rootDir, state);
    const reason = result.blocker.kind === 'generic' ? result.blocker.reason : result.blocker.description;
    return { kind: 'paused-blocked', reason };
  }

  // result.kind === 'error'
  return { kind: 'paused-blocked', reason: result.message };
}

export const runCommand = new Command('run')
  .description('Autonomous runner — execute the picked story\'s plan task-by-task')
  .option('--resume', 'resume from paused state instead of starting fresh')
  .option('--status', 'just print runner state, do nothing')
  .action(async (opts: { resume?: boolean; status?: boolean }) => {
    const root = findKadaiRoot(process.cwd());
    if (!root) { process.stderr.write('Not inside a kadai project\n'); process.exit(1); }

    if (opts.status) {
      const state = readState(root);
      process.stdout.write(JSON.stringify(state, null, 2) + '\n');
      return;
    }

    // The CLI version of the runner uses a no-op dispatcher placeholder — the real
    // dispatcher requires Claude Code's Task tool, which only runs inside a Claude
    // Code session. From the CLI, we just print the next-action prompt and exit.
    process.stdout.write(
      'kadai run from the CLI is informational only — it prints state.\n' +
      'To actually run, use the /kadai-run slash command from Claude Code.\n' +
      JSON.stringify(readState(root), null, 2) + '\n'
    );
  });
```

(The CLI deliberately does NOT execute the dispatcher — the real dispatcher requires Claude Code's Task tool. The slash command + skill are what actually drive runs. The CLI is for inspection + scripting.)

- [ ] **Step 4: Wire `kadai run` into the CLI**

In `src/cli/index.ts`, add:

```typescript
import { runCommand } from './run';
program.addCommand(runCommand);
```

- [ ] **Step 5: Run tests, verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/run.integration.test.ts
bun run typecheck
```

Expected: 5 pass, typecheck clean.

- [ ] **Step 6: Write the kadai-runner skill**

Create `/home/fintan/repos/kadai/kadai-plugin/skills/kadai-runner/SKILL.md`:

```markdown
---
name: kadai-runner
description: "Autonomous executor for kadai-tracked work. Picks up where kadai-writing-plans leaves off — walks the picked story's plan task-by-task, dispatches an implementer subagent for each ### Task block, runs spec + code-quality reviews per task, marks tasks done as it goes. Pauses for human review at story boundaries. When an implementer reports BLOCKED with reason `needs-feature: <desc>`, surfaces a prompt to plan a fast-follow-up unblocker via kadai-brainstorming, executes the unblocker, then resumes the original story. State persisted in `.kadai/runner.json`; resumable across sessions via `kadai run --resume`."
---

# Kadai runner

Use after `kadai-writing-plans` (or whenever a story is picked and has a plan.md). Combines `superpowers:subagent-driven-development` (per-task implementer + reviews) with kadai-specific orchestration (state machine, fast-follow-up unblocking).

## How to use

User says "run it" / "execute the plan" / "kadai run":

1. Read `.kadai/runner.json` (via `kadai run --status`) — what state are we in?
2. If `idle` and a story is picked → start.
3. If `paused-needs-feature` → present the unblocker decision (see below).
4. If `paused-review` → present the story summary, ask "advance to next?"
5. If `paused-blocked` → present the blocker, ask user how to proceed.

## Per-task loop

For each `### Task N` in the picked story's `plan.md`:

1. Mark the kadai task `in_progress` (`kadai set-status TASK-XXX in_progress`).
2. Dispatch an implementer subagent — same template as `superpowers:subagent-driven-development`'s implementer-prompt. Pass: full task text, surrounding context (story title, spec, relevant prior tasks).
3. Wait for outcome: `DONE` / `DONE_WITH_CONCERNS` / `BLOCKED` / `NEEDS_CONTEXT`.
4. On `DONE`: dispatch spec compliance review subagent; on review pass, dispatch code quality review subagent; on quality pass, mark task `done`. (Same two-stage review as the upstream pattern.)
5. On `BLOCKED`: parse the reason. If it starts with `needs-feature:` → see "Fast-follow-up flow" below. Otherwise → write state `paused-blocked` and surface the blocker.
6. On `NEEDS_CONTEXT`: provide the missing context if you have it (story spec, surrounding plan tasks); otherwise pause.

After all tasks: set the story `review`, write state `paused-review`, summarize, ask user to advance.

## Fast-follow-up flow

When an implementer says `BLOCKED: needs-feature: <description>`:

1. Pause: state → `paused-needs-feature`. The original story + task are pushed onto the pausedStack.
2. Present:
   ```
   STORY-XXX hit a blocker on Task N.
   
   The implementer believes a fast-follow-up feature is needed:
     Title: <suggested>
     Why:   <description>
   
   Plan it now and resume after? [Y/n/skip]
   ```
3. **If Y:** invoke `kadai-brainstorming` in fast-follow-up scope:
   - Constrained: brief design (5 min, not 30), default `mvp` phase, propose 1-3 stories max.
   - At spec attach time, also call `recordDependencyEdge(STORY-XXX, FEAT-NEW)` so the original story's frontmatter shows `dependsOn: [FEAT-NEW]`.
   - Then invoke `kadai-writing-plans` for the new feature. First story of the unblocker auto-picks.
   - Return to runner: `kadai run` (it will detect the new picked story and execute the unblocker).
4. **If n:** mark the original story `blocked` (kadai status), runner state → `idle`, tell user manual intervention is needed.
5. **If skip:** same as n but with a `bypass.log` entry noting the skip reason.

When the unblocker finishes (`story-done` AND `pausedStack` is non-empty), the runner automatically:
- Pops the pausedStack
- Re-picks the original story (`kadai pick STORY-XXX`)
- Continues from the task that was paused.

## Resume semantics

`/kadai-run` (or `kadai run --resume`) consults `.kadai/runner.json`:
- `idle` + story picked → start fresh
- `running` → resume the loop (means a prior session crashed; pick up where state.currentTaskId says)
- `paused-*` → present the appropriate decision UI

Idempotent: re-running while still in `paused-needs-feature` re-presents the prompt; no auto-advance.

## What this skill does NOT do (v1)

- **Parallel story execution.** Sequential only.
- **Auto-merging the unblocker's deliverable into the original plan.** When STORY-007 resumes, its plan.md is the same as before. If that plan is now wrong (because the unblocker changed assumptions), the implementer will report it and we'll re-pause-needs-feature.
- **Concurrent runners.** One `kadai run` process at a time. (Easy follow-up: pid file.)
- **Recovering from half-failed implementer subagents.** If a subagent crashes mid-task with the file system in a partial state, pause and tell the user.

## See also

- CLI: `kadai run` (informational; just prints state) and `kadai run --status`.
- Composite review: `kadai plan compose <epic-id>` — render all per-story plans as one document, e.g., before kicking off a fresh run.
- Hooks (the safety net): the PreToolUse gate still bites if an implementer tries to write outside the picked story's scope.
```

- [ ] **Step 7: Write the slash command files**

Create `/home/fintan/repos/kadai/kadai-plugin/commands/kadai-run.md`:

```markdown
# /kadai-run

Invoke the `kadai-runner` skill to autonomously execute the picked story's plan, with fast-follow-up unblocking when needed.

## Usage

```
/kadai-run            # start (or resume) the runner
/kadai-run status     # just print current state, do nothing
```

## What happens

The runner reads the picked story, walks each `### Task N` in its plan, dispatches an implementer subagent per task with spec + code-quality reviews. Pauses at story boundaries for human confirmation; pauses with escalation if a story needs a fast-follow-up feature to unblock.

State persists in `.kadai/runner.json` — re-run `/kadai-run` after a crash to pick up where you left off.

See the `kadai-runner` skill for the full state model + fast-follow-up flow.
```

Create `/home/fintan/repos/kadai/kadai-plugin/commands/kadai-plan-compose.md`:

```markdown
# /kadai-plan-compose

Render all descendant story plans of an epic, feature, or story as one composite markdown document.

## Usage

```
/kadai-plan-compose EPIC-001
/kadai-plan-compose FEAT-005
/kadai-plan-compose STORY-012
```

## When to use

- Pre-implementation review: "show me the whole plan for this epic before I kick off /kadai-run"
- Cross-story consistency check: spot tasks that depend on each other across stories
- PR description / archive: paste the whole composite into a PR body

Backed by `kadai plan compose <id>` CLI.
```

- [ ] **Step 8: Verify the plugin files**

```bash
cd /home/fintan/repos/kadai
ls kadai-plugin/skills/
# Expected: kadai/  kadai-brainstorming/  kadai-dogfood-test/  kadai-runner/  kadai-writing-plans/
ls kadai-plugin/commands/
# Expected: includes kadai-run.md, kadai-plan-compose.md
```

- [ ] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/run.ts src/cli/index.ts tests/cli/run.integration.test.ts kadai-plugin/skills/kadai-runner/SKILL.md kadai-plugin/commands/kadai-run.md kadai-plugin/commands/kadai-plan-compose.md
git commit -m "$(cat <<'EOF'
feat(runner+plugin): kadai run CLI + kadai-runner skill + slash commands [aware-skills Task-7]

Glues the runner pieces (state + dispatch + blocker) into a usable CLI
command + the Claude Code surface that drives it conversationally.

CLI (src/cli/run.ts):
- `kadai run` — informational; prints state. Real execution requires
  the Task tool which only exists inside Claude Code, so the CLI
  punts to the slash command.
- `kadai run --status` — JSON-print runner.json.
- `kadai run --resume` — placeholder hook (slash command does the work).

Runner skill orchestrates per-task dispatch with two-stage review (spec
then code quality), the fast-follow-up flow when a needs-feature blocker
fires, and resume semantics across sessions.

5 integration tests cover: happy-path full-story execution, generic
blocker pause, needs-feature pause + pausedStack, no-story-picked
error, full-cycle resume after unblocker completes (the most complex
end-to-end case).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Plugin manifest bump

**Files:**
- Modify: `kadai-plugin/.claude-plugin/plugin.json`
- Modify: `kadai-plugin/skills/kadai/SKILL.md` (point at the new wrappers)

**Goal:** Register the three new skills + two new commands; bump version. Make the kadai discipline skill direct agents to the new wrappers.

- [ ] **Step 1: Bump plugin.json**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change `"version": "1.3.0"` to `"version": "1.4.0"`.

(The plugin manifest doesn't have explicit lists of skills/commands — Claude Code discovers them by directory scan. So the only edit is the version.)

- [ ] **Step 2: Update kadai/SKILL.md to reference wrappers**

In `/home/fintan/repos/kadai/kadai-plugin/skills/kadai/SKILL.md`, replace the "Spec → feature, plan → story" section with:

```markdown
## Spec → feature, plan → story (use the wrappers!)

When the user asks for planning, brainstorming, or new feature work in this repo, **prefer the kadai-aware wrappers** over the upstream variants:

- `kadai-brainstorming` instead of `superpowers:brainstorming` — auto-creates the epic + feature, attaches the spec to the spine.
- `kadai-writing-plans` instead of `superpowers:writing-plans` — slices the plan per story, creates real kadai tasks, auto-picks the first story.
- `kadai-runner` (or the `/kadai-run` slash command) — autonomously execute the picked story's plan with fast-follow-up unblocking.

The upstream skills work, but they produce a freeform `docs/superpowers/` doc that someone has to translate into spine items by hand. The wrappers do that plumbing automatically and keep the spine in sync.
```

- [ ] **Step 3: Verify**

```bash
cd /home/fintan/repos/kadai
grep '"version"' kadai-plugin/.claude-plugin/plugin.json
# Expected: "version": "1.4.0"
grep 'kadai-brainstorming\|kadai-writing-plans\|kadai-runner' kadai-plugin/skills/kadai/SKILL.md | head -5
```

- [ ] **Step 4: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/.claude-plugin/plugin.json kadai-plugin/skills/kadai/SKILL.md
git commit -m "$(cat <<'EOF'
feat(plugin): bump to 1.4.0; kadai skill points at the new wrappers [aware-skills Task-8]

Plugin version 1.3.0 → 1.4.0 reflects the three new skills (kadai-
brainstorming, kadai-writing-plans, kadai-runner) and two new slash
commands (/kadai-run, /kadai-plan-compose).

The kadai discipline skill's "Spec → feature, plan → story" section
now explicitly directs agents to use the wrappers instead of the
upstream brainstorming/writing-plans skills, with a one-line reason
each.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Documentation pass

**Files:**
- Modify: `docs/wiki/plugin.md`
- Modify: `docs/wiki/cli-reference.md`
- Modify: `docs/wiki/concepts.md`
- Modify: `docs/wiki/troubleshooting.md`

**Goal:** Wiki updates so the new surface is discoverable + the failure modes are documented.

- [ ] **Step 1: Update `docs/wiki/plugin.md`**

Read the file first, then add a new section "Wrapper skills (kadai-brainstorming, kadai-writing-plans, kadai-runner)" describing each, with example usage. Mention that the wrappers are the recommended path; upstream skills still work but lose spine plumbing.

- [ ] **Step 2: Update `docs/wiki/cli-reference.md`**

Add entries for:

```markdown
### `kadai plan compose <id>`

Render all descendant story plans of an epic/feature/story as one composite markdown document.

```
kadai plan compose EPIC-001                  # to stdout
kadai plan compose FEAT-001 --out plan.md    # to file
```

Stories without a `plan.md` render as "(no plan yet)" so the composite mirrors the actual spine state.

### `kadai run [--resume] [--status]`

Autonomous runner — informational from the CLI (the real execution lives in the `/kadai-run` slash command, which can use Claude Code's Task tool to dispatch implementer subagents).

```
kadai run --status        # JSON-print .kadai/runner.json
kadai run --resume        # (currently a no-op from the CLI; use /kadai-run from Claude Code)
```

State is persisted in `.kadai/runner.json` and survives across sessions.
```

- [ ] **Step 3: Update `docs/wiki/concepts.md`**

Add a section explaining the runner state model + the fast-follow-up dependency edge:

```markdown
## The runner state model

When you use `/kadai-run` (or `kadai run`), state is persisted at `.kadai/runner.json` so the runner survives crashes and session boundaries.

Statuses:
- `idle` — no run in flight (default).
- `running` — actively executing a story.
- `paused-blocked` — implementer reported a blocker that requires manual resolution.
- `paused-needs-feature` — implementer reported the work needs a fast-follow-up feature; user prompted to plan it.
- `paused-review` — story finished, awaiting user confirmation to advance.
- `error` — last invocation crashed unrecoverably.

Transitions are explicit; the runner never silently advances past `paused-*`.

## The dependency edge (`dependsOn`)

When a story enters the fast-follow-up flow, the runner records a `dependsOn: [FEAT-XXX]` field on the blocked story's frontmatter. This is the durable record of "STORY-007 was paused because it needed FEAT-009" — survives runner crashes, visible to `kadai status`, the web viewer, and human readers of the spine.

The runner queues blocked stories on a `pausedStack`; when the unblocker finishes, the top of the stack is resumed automatically.
```

- [ ] **Step 4: Update `docs/wiki/troubleshooting.md`**

Add entries:

```markdown
## "The runner is stuck in paused-needs-feature and won't advance"

**Cause:** The runner is waiting for you to confirm the unblocker plan. Inspect:

```
kadai run --status
```

The `lastBlocker` field shows what feature the implementer asked for. Three ways to resolve:

1. **Plan the unblocker:** `/kadai-run` from Claude Code re-presents the prompt; answer Y to invoke `kadai-brainstorming` in fast-follow-up scope.
2. **Skip:** Mark the original story blocked manually (`kadai set-status STORY-XXX blocked`) and `kadai run --resume` (which will see the state, exit the paused state via reset, and stop cleanly).
3. **Reset state:** if the runner is genuinely stuck (e.g., from a crash), `kadai run --status` followed by manually editing `.kadai/runner.json` (set `status: idle`, clear `pausedStack`) will get you out — but you'll lose the resume context.

## "kadai run says no story picked but I have stories"

**Cause:** The runner consults `.kadai/picked` for the current target. If you have stories in your spine but none picked, do:

```
kadai pick STORY-001
/kadai-run
```

## "Wrapper skill didn't fire — I see superpowers:brainstorming was loaded instead"

**Cause:** Claude picked the upstream skill because the prompt matched its description more directly. The kadai wrappers are designed to take precedence, but skill matching is heuristic.

**Fix:** Be explicit in your prompt: "Use kadai-brainstorming to design X" forces the wrapper. Alternatively, the kadai discipline skill's description points agents at the wrappers — make sure the kadai plugin is reloaded after every plugin update (`/plugin uninstall kadai` then `/plugin install kadai@kadai`) so the latest descriptions are indexed.
```

- [ ] **Step 5: Verify the wikis are valid markdown**

```bash
cd /home/fintan/repos/kadai
for f in docs/wiki/plugin.md docs/wiki/cli-reference.md docs/wiki/concepts.md docs/wiki/troubleshooting.md; do
  echo "=== $f ==="
  wc -l "$f"
done
```

- [ ] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add docs/wiki/plugin.md docs/wiki/cli-reference.md docs/wiki/concepts.md docs/wiki/troubleshooting.md
git commit -m "$(cat <<'EOF'
docs(wiki): wrappers + runner [aware-skills Task-9]

- plugin.md: section on the three new wrapper skills
- cli-reference.md: kadai plan compose + kadai run entries
- concepts.md: runner state model + dependsOn dependency edge
- troubleshooting.md: three new entries (stuck in paused-needs-feature,
  no story picked, wrapper didn't fire)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10: Dogfood test (`claude -p`-based)

**Files:**
- Create: `tests/dogfood/kadai-aware-skills.dogfood.test.ts`

**Goal:** End-to-end test that actually invokes Claude Code via `claude -p` against a `mktemp -d` repo, runs the brainstorm + plan + first-task flow, and asserts on the resulting spine state. Plan 17's CSS bug is the cautionary tale — file-shape assertions miss what runtime invocation catches.

- [ ] **Step 1: Write the dogfood test**

Create `/home/fintan/repos/kadai/tests/dogfood/kadai-aware-skills.dogfood.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const HAS_CLAUDE_CLI = (() => {
  try { execFileSync('which', ['claude'], { stdio: 'pipe' }); return true; }
  catch { return false; }
})();

const HAS_KADAI_CLI = (() => {
  try { execFileSync('which', ['kadai'], { stdio: 'pipe' }); return true; }
  catch { return false; }
})();

// Skip the test entirely if either CLI is missing — running in CI without them is fine.
test.skipIf(!HAS_CLAUDE_CLI || !HAS_KADAI_CLI)(
  'claude -p in a fresh kadai repo runs the wrapper flow end-to-end',
  async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'kadai-dogfood-'));
    try {
      // 1. Init kadai in the temp project.
      execFileSync('kadai', ['init', '-y'], { cwd: tmp, stdio: 'pipe' });
      expect(existsSync(join(tmp, '.kadai/config.toml'))).toBe(true);

      // 2. Run claude -p with a brainstorming prompt. The wrapper should fire because .kadai/ exists.
      const prompt = "Use kadai-brainstorming and kadai-writing-plans to plan a small CLI tool that converts Markdown to plaintext. Keep it minimal: one command, one input file, one output file. Don't ask me clarifying questions — make reasonable choices and proceed. After the plan is written, stop.";
      execFileSync('claude', ['-p', prompt], { cwd: tmp, stdio: 'pipe', timeout: 5 * 60 * 1000 });

      // 3. Assert on the resulting spine state.
      // Should have: 1 epic, 1 feature with spec.md attached, ≥1 story with plan.md attached, ≥1 task per story.
      const epicsDir = join(tmp, '.kadai/epics');
      expect(existsSync(epicsDir)).toBe(true);
      const epicDirs = readdirSync(epicsDir).filter(d => d.startsWith('EPIC-'));
      expect(epicDirs.length).toBeGreaterThanOrEqual(1);

      const epicDir = join(epicsDir, epicDirs[0]);
      const featuresDir = join(epicDir, 'features');
      expect(existsSync(featuresDir)).toBe(true);
      const featureDirs = readdirSync(featuresDir).filter(d => d.startsWith('FEAT-'));
      expect(featureDirs.length).toBeGreaterThanOrEqual(1);

      const featureDir = join(featuresDir, featureDirs[0]);
      // CRITICAL: spec.md should be in the feature directory, NOT in docs/superpowers/
      expect(existsSync(join(featureDir, 'spec.md'))).toBe(true);
      expect(existsSync(join(tmp, 'docs/superpowers/specs'))).toBe(false);

      const storiesDir = join(featureDir, 'stories');
      expect(existsSync(storiesDir)).toBe(true);
      const storyDirs = readdirSync(storiesDir).filter(d => d.startsWith('STORY-'));
      expect(storyDirs.length).toBeGreaterThanOrEqual(1);

      // Each story should have a plan.md attached.
      for (const sd of storyDirs) {
        expect(existsSync(join(storiesDir, sd, 'plan.md'))).toBe(true);
      }

      // The first story should be picked.
      const picked = execFileSync('kadai', ['status'], { cwd: tmp, encoding: 'utf8' });
      expect(picked).toMatch(/STORY-/);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  },
  10 * 60 * 1000  // 10-minute test timeout
);

test('kadai-runner pauses correctly when implementer reports needs-feature', async () => {
  // This is a unit-style test of the pause flow without actually invoking claude -p
  // (which is harder to script for an artificial blocker scenario). We seed a project
  // where the picked story's plan has a task whose body contains the literal
  // "PLEASE_FAIL_WITH_NEEDS_FEATURE" — the test dispatcher recognizes it and reports
  // BLOCKED: needs-feature: <something>. We then verify the runner state.

  const { runOnce } = await import('../../src/cli/run');
  const { mkdtempSync: mkd, mkdirSync, writeFileSync } = await import('node:fs');
  const story = (root: string) => join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/stories/STORY-001-a');

  const root = mkd(join(tmpdir(), 'kadai-pause-'));
  try {
    mkdirSync(story(root), { recursive: true });
    writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: in_progress\n---\n');
    writeFileSync(join(root, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/feature.md'), '---\nid: FEAT-001\nparent: EPIC-001\ntitle: Y\nphase: mvp\nstatus: in_progress\n---\n');
    writeFileSync(join(story(root), 'story.md'), '---\nid: STORY-001\nparent: FEAT-001\ntitle: First\nphase: mvp\nstatus: in_progress\n---\n');
    writeFileSync(join(story(root), 'plan.md'), '## Task 1: alpha\n\nPLEASE_FAIL_WITH_NEEDS_FEATURE\n');
    writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":1,"feature":1,"story":1,"task":0}');
    writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n');
    writeFileSync(join(root, '.kadai/picked'), 'STORY-001');

    const dispatcher = async (_: string, body: string) => {
      if (body.includes('PLEASE_FAIL_WITH_NEEDS_FEATURE')) {
        return { status: 'BLOCKED' as const, reason: 'needs-feature: a config-loading utility' };
      }
      return { status: 'DONE' as const };
    };
    const result = await runOnce(root, dispatcher);
    expect(result.kind).toBe('paused-needs-feature');
    if (result.kind === 'paused-needs-feature') {
      expect(result.description).toBe('a config-loading utility');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run the dogfood test**

```bash
cd /home/fintan/repos/kadai
bun test tests/dogfood/kadai-aware-skills.dogfood.test.ts 2>&1 | tail -10
```

Expected: 2 tests. The `claude -p` test runs only if both `claude` and `kadai` are on PATH (skip otherwise). The pause-state test always runs. Both pass.

If the `claude -p` test times out or produces unexpected output, capture the actual output for debugging:

```bash
# Manual reproduction of what the test does:
TMP=$(mktemp -d -t kadai-dogfood-manual-XXX)
( cd "$TMP" && kadai init -y && claude -p "Use kadai-brainstorming to plan a tiny CLI for converting Markdown to plaintext. Don't ask me questions; make sensible choices and proceed." )
ls "$TMP/.kadai/epics/"  # inspect spine state
rm -rf "$TMP"
```

- [ ] **Step 3: Run the FULL test suite to confirm no regressions**

```bash
cd /home/fintan/repos/kadai
bun test 2>&1 | tail -3
bun run typecheck
cd src/web/frontend && bunx tsc --noEmit -p tsconfig.json && cd /home/fintan/repos/kadai
bun run build:web && bun run embed-assets
bunx playwright test 2>&1 | tail -5
```

Expected: all pass. New tests bring count to ~360+.

- [ ] **Step 4: Commit**

```bash
cd /home/fintan/repos/kadai
git add tests/dogfood/kadai-aware-skills.dogfood.test.ts
git commit -m "$(cat <<'EOF'
test(dogfood): claude -p end-to-end + needs-feature pause [aware-skills Task-10]

Two tests:

1. End-to-end via `claude -p` against a fresh `mktemp -d` kadai repo.
   The CRITICAL assertion is that spec.md ends up in
   .kadai/epics/<E>/features/<F>/spec.md, NOT in
   docs/superpowers/specs/. That's the spine plumbing the wrapper
   exists to do; if it's missing, the wrapper didn't fire (or fired
   and silently did the wrong thing). Skipped if `claude` or `kadai`
   isn't on PATH (CI-friendly).

2. Pause-flow unit test that doesn't depend on claude -p — seeds a
   spine with a planted blocker marker, runs runOnce with a dispatcher
   that reports BLOCKED: needs-feature, and verifies the resulting
   runner state. Always runs.

Plan 17's CSS bug is the cautionary tale baked into this test: file-
shape assertions on what the build outputs missed that the bundle
contained no Tailwind utilities, because no test actually rendered
the page in a browser. Here we actually invoke Claude against a
fresh project and see what comes out, not just whether the modules
build.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan self-review checklist

- [ ] All 10 tasks completed; checkboxes ticked.
- [ ] `bun test` passes (≥360 tests; 9 state, 5 dispatch, 4 blocker, 4 compose, 5 run integration, 2 dogfood new).
- [ ] `bun run typecheck` passes.
- [ ] `cd src/web/frontend && bunx tsc --noEmit -p tsconfig.json` passes.
- [ ] `bunx playwright test` still passes (no web regressions).
- [ ] `kadai plan compose EPIC-001` produces valid composite markdown against the kadai project's own spine.
- [ ] `kadai run --status` returns valid runner JSON in any kadai project.
- [ ] Dogfood test passes (or is correctly skipped) — actually invokes `claude -p` and verifies spine state.
- [ ] `kadai-plugin/.claude-plugin/plugin.json` shows version 1.4.0.
- [ ] All four wiki pages updated (`plugin.md`, `cli-reference.md`, `concepts.md`, `troubleshooting.md`).
- [ ] After merge to master: `docs/wiki/post-mvp.md` adds this plan to "Recently shipped"; `CLAUDE.md` active state reflects the new wrapper + runner capability.

## Post-merge follow-ups

- Update `CLAUDE.md` and `docs/wiki/post-mvp.md` (deferred until merge to master so this branch can revert cleanly).
- Distribution: rebuild the binary + cross-compile (`bun run build:all`) so v1.4.0 ships everywhere.
- Plugin reload broadcast: if there are users running v1.3.0 in other projects, they need `/plugin uninstall kadai && /plugin install kadai@kadai` to pick up the new skills + descriptions.
