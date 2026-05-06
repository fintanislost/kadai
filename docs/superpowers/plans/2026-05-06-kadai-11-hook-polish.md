# Kadai Plan 11 — Hook polish (UserPromptSubmit + Stop)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the two remaining Claude Code hooks called out in spec §5.2: `UserPromptSubmit` injects an "active story" context block into every prompt while a story is picked; `Stop` reminds the agent when a turn finished work on the picked story without updating its status.

**Architecture:** Two new `kadai hook` CLI subcommands (`user-prompt-submit` and `stop`) following the same shape as the existing `pre-tool-use` / `post-tool-use` ones — read JSON from stdin, look up the picked story, exit 0 with appropriate stdout/stderr. `kadai init` is updated to merge both new hook entries into `.claude/settings.json` alongside the existing two. No new runtime deps.

**Tech Stack:** TypeScript on Bun (existing). Standard library only.

## Position in the build

| | |
|---|---|
| **This is plan** | 11 of N |
| **Prior plan** | [Plan 10 — Git integration](2026-05-06-kadai-10-git-integration.md) — `DONE` |
| **Next plan** | Plan 12 — Distribution polish, per [post-mvp.md](../../wiki/post-mvp.md) |
| **Index** | [README.md](README.md) |
| **Backlog** | [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md) |

## What ships at the end

- `kadai hook user-prompt-submit` — reads `{prompt, session_id, ...}` from stdin; if a story is picked, emits an `[kadai-active-story]` context block to stdout (Claude injects it into the prompt). Silent (exit 0, no output) when no story is picked.
- `kadai hook stop` — reads stop-event JSON from stdin; if the picked story is `in_progress` AND the changelog has fresh entries (within the last 30 minutes), emits a JSON `{"reason": "..."}` reminder telling the agent to update status. Silent otherwise.
- `src/cli/init.ts` — `mergeKadaiHooksIntoSettingsJson` now registers all four hooks (`PreToolUse`, `PostToolUse`, `UserPromptSubmit`, `Stop`).
- `docs/wiki/cli-reference.md` — `kadai hook (...)` section lists all four subcommands.
- `docs/wiki/concepts.md` — short paragraph on the four hook touchpoints.
- Plugin version 0.6.0 → 0.7.0.
- ~13 new unit tests + integration test for the init wiring.
- All ~252 existing tests still pass.

## Out of scope (deferred)

- Changing the existing PreToolUse / PostToolUse behavior — those are stable.
- Adding a config flag to disable each hook independently — `change_capture.enabled` already gates PostToolUse; we don't add per-hook toggles for the new ones unless real complaints arise (YAGNI). Users can edit `.claude/settings.json` to remove hooks they don't want.
- Injecting the actual content of `spec.md` / `plan.md` into the prompt (just point to the files; the agent can Read them).
- Stop hook auto-running `kadai sync` — that's a separate concern; users can run it manually.

## File structure

```
src/cli/hook.ts                                      # MODIFIED: add user-prompt-submit + stop subcommands; add buildActiveStoryContext + buildStopReminder
src/cli/init.ts                                      # MODIFIED: register the 2 new hooks in settings.json

tests/cli/hook-user-prompt-submit.test.ts            # NEW: ~7 tests
tests/cli/hook-stop.test.ts                          # NEW: ~6 tests
tests/cli/init.test.ts                               # MODIFIED: assert all 4 hooks land in settings.json

docs/wiki/cli-reference.md                           # MODIFIED: list the 4 hook subcommands
docs/wiki/concepts.md                                # MODIFIED: hook touchpoints paragraph
docs/wiki/post-mvp.md                                # MODIFIED: Plan 11 → Recently shipped, Plan 12 → next
docs/dogfood-acceptance-test.md                      # APPEND: Plan 11 verification
kadai-plugin/.claude-plugin/plugin.json              # MODIFIED: 0.6.0 → 0.7.0
```

## Tasks

---

### Task 1: `kadai hook user-prompt-submit` subcommand

**Files:**
- Modify: `src/cli/hook.ts`
- Create: `tests/cli/hook-user-prompt-submit.test.ts`

**Goal:** Pure builder + thin CLI wrapper. The builder takes a `(rootDir, pickedId)` and returns either `null` (no injection) or a multi-line context string. The CLI wraps it: read stdin (we don't actually need the prompt content), look up picked, print to stdout, exit 0.

The injected block format:

```
[kadai-active-story]
STORY-042 — Implement add(a,b)
phase=mvp status=in_progress parent=FEAT-001
spec: spec.md (attached)
plan: plan.md (attached)
acceptance criteria:
  - add(2, 3) returns 5
  - add(0, 0) returns 0
[/kadai-active-story]
```

Lines for `spec` / `plan` only appear if attached. The `acceptance criteria:` section only appears if present. If story has no spec, plan, or AC, the block is just header + 2 lines.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/cli/hook-user-prompt-submit.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { execFileSync, spawnSync } from 'node:child_process';
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
  // Add a spec attachment by writing a file + updating frontmatter.
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
  // Run the CLI: bun run src/cli/index.ts hook user-prompt-submit
  const result = spawnSync('bun', ['run', join(import.meta.dir, '..', '..', 'src', 'cli', 'index.ts'), 'hook', 'user-prompt-submit'], {
    cwd: tmp,
    input: stdinPayload,
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toContain('[kadai-active-story]');
  expect(result.stdout).toContain('STORY-001');
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/hook-user-prompt-submit.test.ts
```

Expected: FAIL — `buildActiveStoryContext` not exported, the CLI subcommand doesn't exist yet.

- [x] **Step 3: Add `buildActiveStoryContext` + the subcommand to hook.ts**

Edit `/home/fintan/repos/kadai/src/cli/hook.ts`. Add this export anywhere logical (after `recordPostToolUse` is fine):

```typescript
export function buildActiveStoryContext(rootDir: string): string | null {
  const pickedId = readPicked(rootDir);
  if (!pickedId) return null;
  const story = findById(rootDir, pickedId);
  if (!story) return null;

  const data = story.data as {
    id: string;
    title: string;
    phase?: string;
    status: string;
    parent?: string;
    spec?: string;
    plan?: string;
    acceptance_criteria?: string[];
  };

  const lines: string[] = ['[kadai-active-story]'];
  lines.push(`${data.id} — ${data.title}`);
  const meta: string[] = [];
  if (data.phase) meta.push(`phase=${data.phase}`);
  meta.push(`status=${data.status}`);
  if (data.parent) meta.push(`parent=${data.parent}`);
  lines.push(meta.join(' '));
  if (data.spec) lines.push(`spec: ${data.spec} (attached)`);
  if (data.plan) lines.push(`plan: ${data.plan} (attached)`);
  if (data.acceptance_criteria && data.acceptance_criteria.length > 0) {
    lines.push('acceptance criteria:');
    for (const c of data.acceptance_criteria) {
      lines.push(`  - ${c}`);
    }
  }
  lines.push('[/kadai-active-story]');
  return lines.join('\n');
}
```

Add the subcommand registration after the existing `post-tool-use` block:

```typescript
hookCommand
  .command('user-prompt-submit')
  .description('UserPromptSubmit hook: injects active-story context into the prompt when a story is picked')
  .action(async () => {
    const root = findKadaiRoot(process.cwd());
    if (!root) process.exit(0);
    // Drain stdin (Claude Code sends JSON we don't need to inspect — the picked
    // file is the source of truth, not the prompt content).
    try { await readStdinJson<unknown>(); } catch { /* empty stdin is OK */ }
    const context = buildActiveStoryContext(root);
    if (context) process.stdout.write(context + '\n');
    process.exit(0);
  });
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/hook-user-prompt-submit.test.ts
```

Expected: 7 tests pass.

- [x] **Step 5: Run the full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: 259 pass (252 + 7 new). Typecheck clean.

- [x] **Step 6: Tick the 5 checkboxes for Task 1 in the plan**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-11-hook-polish.md`, find Task 1 and tick all 5 step checkboxes.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/hook.ts tests/cli/hook-user-prompt-submit.test.ts docs/superpowers/plans/2026-05-06-kadai-11-hook-polish.md
git commit -m "$(cat <<'EOF'
feat(hook): add 'kadai hook user-prompt-submit' [Plan-11 Task-1]

Pure buildActiveStoryContext + CLI wrapper. When a story is picked,
emits a `[kadai-active-story]` block to stdout that Claude Code injects
into the prompt context. Includes spec/plan attachment markers and
acceptance criteria when present. Silent when no story is picked.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `kadai hook stop` subcommand

**Files:**
- Modify: `src/cli/hook.ts`
- Create: `tests/cli/hook-stop.test.ts`

**Goal:** Pure `buildStopReminder(rootDir, opts?: {now?: Date}): string | null` + CLI wrapper. Returns a reminder JSON string when:
- A story is picked, AND
- The story status is `in_progress`, AND
- The story's `changelog.md` has been touched within the last 30 minutes (signal: real work happened this turn)

Otherwise returns `null` (silent stop). The CLI prints the JSON to stdout — Claude Code parses `{"reason": "..."}` and surfaces it on the next prompt.

The JSON shape:
```json
{"reason": "Picked story STORY-042 is still in_progress. Run `kadai set-status STORY-042 review` (or done) when finished, or `kadai unpick` to step back."}
```

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/cli/hook-stop.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync, utimesSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { setPicked } from '../../src/core/picked';
import { findById } from '../../src/core/spine';
import { setStatus } from '../../src/core/operations';
import { buildStopReminder } from '../../src/cli/hook';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-stop-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function touchChangelog(itemId: string, ageSeconds: number): void {
  const item = findById(tmp, itemId)!;
  const path = join(dirname(item.path), 'changelog.md');
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `- ${new Date().toISOString()} \`Write\` test.txt\n`);
  const when = new Date(Date.now() - ageSeconds * 1000);
  utimesSync(path, when, when);
}

test('buildStopReminder returns null when no story is picked', () => {
  expect(buildStopReminder(tmp)).toBeNull();
});

test('buildStopReminder returns null when picked story status is review', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  setStatus(tmp, 'STORY-001', 'review');
  expect(buildStopReminder(tmp)).toBeNull();
});

test('buildStopReminder returns null when picked story status is done', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  setStatus(tmp, 'STORY-001', 'done');
  expect(buildStopReminder(tmp)).toBeNull();
});

test('buildStopReminder returns null when in_progress but no recent changelog activity', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  // No changelog file at all → no signal that work happened this turn → silent.
  expect(buildStopReminder(tmp)).toBeNull();
});

test('buildStopReminder returns null when changelog is older than 30 minutes', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  touchChangelog('STORY-001', 60 * 60);  // 1 hour old
  expect(buildStopReminder(tmp)).toBeNull();
});

test('buildStopReminder returns a JSON reason when in_progress + recent changelog', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  touchChangelog('STORY-001', 5 * 60);  // 5 minutes old
  const out = buildStopReminder(tmp);
  expect(out).not.toBeNull();
  const parsed = JSON.parse(out!) as { reason: string };
  expect(parsed.reason).toContain('STORY-001');
  expect(parsed.reason).toMatch(/in_progress/);
  expect(parsed.reason).toContain('kadai set-status');
});

test('kadai hook stop emits the JSON to stdout when relevant', () => {
  setPicked(tmp, 'STORY-001');
  setStatus(tmp, 'STORY-001', 'in_progress');
  touchChangelog('STORY-001', 5 * 60);

  const stdinPayload = JSON.stringify({
    session_id: 's1', transcript_path: '/tmp/x', cwd: tmp,
    permission_mode: 'default', hook_event_name: 'Stop',
  });
  const result = spawnSync('bun', ['run', join(import.meta.dir, '..', '..', 'src', 'cli', 'index.ts'), 'hook', 'stop'], {
    cwd: tmp,
    input: stdinPayload,
    encoding: 'utf8',
  });
  expect(result.status).toBe(0);
  const parsed = JSON.parse(result.stdout.trim()) as { reason: string };
  expect(parsed.reason).toContain('STORY-001');
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/hook-stop.test.ts
```

Expected: FAIL — `buildStopReminder` not exported, subcommand doesn't exist.

- [x] **Step 3: Add `buildStopReminder` + the subcommand to hook.ts**

Edit `/home/fintan/repos/kadai/src/cli/hook.ts`. Add this export (anywhere after `buildActiveStoryContext`):

```typescript
import { existsSync, statSync } from 'node:fs';

const STOP_REMINDER_WINDOW_MS = 30 * 60 * 1000;  // 30 minutes

export interface StopReminderOptions {
  now?: Date;
}

export function buildStopReminder(rootDir: string, opts: StopReminderOptions = {}): string | null {
  const pickedId = readPicked(rootDir);
  if (!pickedId) return null;
  const story = findById(rootDir, pickedId);
  if (!story) return null;
  if (story.data.status !== 'in_progress') return null;

  const changelogPath = join(dirname(story.path), 'changelog.md');
  if (!existsSync(changelogPath)) return null;

  const now = (opts.now ?? new Date()).getTime();
  const mtime = statSync(changelogPath).mtimeMs;
  if (now - mtime > STOP_REMINDER_WINDOW_MS) return null;

  const data = story.data as { id: string };
  const reason = `Picked story ${data.id} is still in_progress. Run \`kadai set-status ${data.id} review\` (or done) when finished, or \`kadai unpick\` to step back.`;
  return JSON.stringify({ reason });
}
```

(Note: `dirname`, `join`, `findById`, `readPicked` are already imported at the top of the file. The new imports needed are `existsSync` and `statSync` from `node:fs` — `appendFileSync` and `mkdirSync` are already imported, so add to that line.)

The full updated import line at the top should be:

```typescript
import { appendFileSync, existsSync, mkdirSync, statSync } from 'node:fs';
```

Add the subcommand registration after the existing `user-prompt-submit` block:

```typescript
hookCommand
  .command('stop')
  .description('Stop hook: reminds the agent to update the picked story status if work happened this turn')
  .action(async () => {
    const root = findKadaiRoot(process.cwd());
    if (!root) process.exit(0);
    try { await readStdinJson<unknown>(); } catch { /* empty stdin OK */ }
    const reminder = buildStopReminder(root);
    if (reminder) process.stdout.write(reminder + '\n');
    process.exit(0);
  });
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/hook-stop.test.ts
```

Expected: 7 tests pass.

- [x] **Step 5: Run the full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: 266 pass (259 + 7 new). Typecheck clean.

- [x] **Step 6: Tick the 5 checkboxes for Task 2 in the plan**

Tick all 5 step checkboxes for Task 2.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/hook.ts tests/cli/hook-stop.test.ts docs/superpowers/plans/2026-05-06-kadai-11-hook-polish.md
git commit -m "$(cat <<'EOF'
feat(hook): add 'kadai hook stop' [Plan-11 Task-2]

Pure buildStopReminder + CLI wrapper. Reminds the agent when a turn ended
with the picked story still in_progress AND fresh changelog activity
(within 30 minutes). Returns a JSON {"reason": "..."} that Claude Code
adds to the next prompt context. Silent in all other cases.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `kadai init` registers the new hooks

**Files:**
- Modify: `src/cli/init.ts`
- Modify: `tests/cli/init.test.ts`

**Goal:** Update `mergeKadaiHooksIntoSettingsJson` so `kadai init` lays down all four hook entries in `.claude/settings.json`. Idempotent: re-running `init` doesn't duplicate.

The two new entries (UserPromptSubmit and Stop) have empty matchers — these hook events fire on every occurrence (no per-tool matcher).

- [x] **Step 1: Update tests/cli/init.test.ts**

Read `/home/fintan/repos/kadai/tests/cli/init.test.ts` to find the existing assertions about `.claude/settings.json`. Add (or amend) tests that assert:

```typescript
test('runInit registers all four hook entries in .claude/settings.json', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-init-hooks-'));
  try {
    runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
    const settings = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8')) as {
      hooks: Record<string, Array<{ matcher?: string; hooks: Array<{ command: string }> }>>;
    };
    const eventNames = Object.keys(settings.hooks).sort();
    expect(eventNames).toEqual(['PostToolUse', 'PreToolUse', 'Stop', 'UserPromptSubmit']);

    const ups = settings.hooks.UserPromptSubmit[0];
    expect(ups.matcher ?? '').toBe('');
    expect(ups.hooks[0].command).toBe('kadai hook user-prompt-submit');

    const stop = settings.hooks.Stop[0];
    expect(stop.matcher ?? '').toBe('');
    expect(stop.hooks[0].command).toBe('kadai hook stop');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test('runInit is idempotent — re-running does not duplicate hook entries', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-init-idempotent-'));
  try {
    runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
    runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
    const settings = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8')) as {
      hooks: Record<string, unknown[]>;
    };
    expect(settings.hooks.PreToolUse.length).toBe(1);
    expect(settings.hooks.PostToolUse.length).toBe(1);
    expect(settings.hooks.UserPromptSubmit.length).toBe(1);
    expect(settings.hooks.Stop.length).toBe(1);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

(If `mkdtempSync, rmSync, readFileSync, tmpdir, join` aren't already imported in the test file, add them. The existing `runInit` import should already be there.)

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/init.test.ts
```

Expected: the new tests fail — current `init` only registers PreToolUse and PostToolUse.

- [x] **Step 3: Update mergeKadaiHooksIntoSettingsJson in init.ts**

Read `/home/fintan/repos/kadai/src/cli/init.ts`. Find `mergeKadaiHooksIntoSettingsJson`. Inside that function, after the existing PreToolUse + PostToolUse blocks, insert these two:

```typescript
  if (!parsed.hooks.UserPromptSubmit) parsed.hooks.UserPromptSubmit = [];
  if (!parsed.hooks.Stop) parsed.hooks.Stop = [];

  const hasUps = parsed.hooks.UserPromptSubmit.some(entry =>
    entry.hooks?.some(h => h.command === 'kadai hook user-prompt-submit'));
  if (!hasUps) {
    parsed.hooks.UserPromptSubmit.push({
      matcher: '',
      hooks: [{ type: 'command', command: 'kadai hook user-prompt-submit' }],
    });
  }

  const hasStop = parsed.hooks.Stop.some(entry =>
    entry.hooks?.some(h => h.command === 'kadai hook stop'));
  if (!hasStop) {
    parsed.hooks.Stop.push({
      matcher: '',
      hooks: [{ type: 'command', command: 'kadai hook stop' }],
    });
  }
```

The condition that triggers the file write at the bottom of the function currently checks `if (!hasPre || !hasPost)`. Change it to also include the new flags:

```typescript
  if (!hasPre || !hasPost || !hasUps || !hasStop) {
    mkdirSync(join(rootDir, '.claude'), { recursive: true });
    writeFileAtomic(path, JSON.stringify(parsed, null, 2) + '\n');
  }
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/init.test.ts
```

Expected: all tests pass (existing + 2 new).

- [x] **Step 5: Run the full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: 268 pass (266 + 2 new). Typecheck clean.

- [x] **Step 6: Tick the 5 checkboxes for Task 3 in the plan**

Tick all 5 step checkboxes for Task 3.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/init.ts tests/cli/init.test.ts docs/superpowers/plans/2026-05-06-kadai-11-hook-polish.md
git commit -m "$(cat <<'EOF'
feat(init): register UserPromptSubmit + Stop hooks in settings.json [Plan-11 Task-3]

mergeKadaiHooksIntoSettingsJson now lays down all four hook entries.
Idempotent: re-running init doesn't duplicate. Empty matcher on the new
two — UserPromptSubmit + Stop fire on every occurrence (no per-tool gating).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Docs + plugin v0.7.0 + post-MVP tracking + dogfood

**Files:**
- Modify: `docs/wiki/cli-reference.md`
- Modify: `docs/wiki/concepts.md`
- Modify: `docs/wiki/post-mvp.md`
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (0.6.0 → 0.7.0)
- Append: `docs/dogfood-acceptance-test.md`
- Modify: `docs/superpowers/plans/2026-05-06-kadai-11-hook-polish.md`

- [x] **Step 1: Update cli-reference.md**

In `/home/fintan/repos/kadai/docs/wiki/cli-reference.md`, find the existing `## kadai hook` section. Replace its contents (or add to it) so it lists all four subcommands:

````markdown
## `kadai hook (pre-tool-use|post-tool-use|user-prompt-submit|stop)`

Hook scripts invoked by Claude Code via `.claude/settings.json`. Read JSON from stdin, exit 0 (allow / inject) or 2 (block, with stderr message).

| Subcommand | Trigger | Effect |
|---|---|---|
| `pre-tool-use` | Before `Edit` / `Write` | Blocks edits to paths outside `.kadai/` and the configured allowlist when no story is picked. Honors `KADAI_BYPASS=1` (logged to `.kadai/bypass.log`). |
| `post-tool-use` | After `Edit` / `Write` | Appends each edit to the picked story's `changelog.md` if `change_capture.enabled = true`. |
| `user-prompt-submit` | Before each user prompt | Injects an `[kadai-active-story]` context block into the prompt when a story is picked (id, title, phase, status, spec/plan attachments, acceptance criteria). Silent otherwise. |
| `stop` | After Claude finishes a turn | If the picked story is `in_progress` AND the changelog has fresh entries (within 30 minutes), prints a JSON `{"reason": "..."}` reminder; Claude Code surfaces it on the next prompt. Silent otherwise. |

`kadai init` registers all four entries in `.claude/settings.json` automatically. Re-running `init` is safe (idempotent on hook entries).
````

- [x] **Step 2: Update concepts.md**

In `/home/fintan/repos/kadai/docs/wiki/concepts.md`, find an appropriate place (the "Hooks" section if it exists, or near the bottom). Add:

```markdown
### Hook touchpoints

Kadai integrates with Claude Code through four hook events, all dispatched through the `kadai hook <subcommand>` CLI:

- **`PreToolUse`** (Edit | Write) — blocks edits outside the spine when no story is picked.
- **`PostToolUse`** (Edit | Write) — captures every edit into the picked story's `changelog.md`.
- **`UserPromptSubmit`** — injects active-story context (id, title, status, attached spec/plan, acceptance criteria) into every prompt while a story is picked.
- **`Stop`** — reminds the agent to update status when a turn ended with the story still `in_progress` and recent changelog activity.

The first two are gating / capture (always-on while change_capture is enabled). The latter two are observability — they shape what Claude sees but never block work. All are registered automatically by `kadai init` in `.claude/settings.json`.
```

- [x] **Step 3: Update post-mvp.md**

In `/home/fintan/repos/kadai/docs/wiki/post-mvp.md`:

(a) Find `### Plan 11 — Hook polish 🟢 **next**` and remove the entire section.

(b) Find the next plan in the list (should be `### Plan 12 — Distribution polish`). Add the badge:

```markdown
### Plan 12 — Distribution polish 🟢 **next**
```

(c) In the "Recently shipped" section, ABOVE the existing `### Plan 10` entry, insert:

```markdown
### Plan 11 — Hook polish (shipped 2026-05-06)

- `kadai hook user-prompt-submit` — injects `[kadai-active-story]` block (id, title, phase, status, spec/plan/AC) into prompt context when a story is picked
- `kadai hook stop` — reminds via `{"reason":"..."}` when a turn ended with the picked story still in_progress + recent changelog activity (30-min window)
- `kadai init` now lays down all four hook entries (idempotent re-run)
- 14 new tests + 2 init regression tests
- Plugin version bumped to 0.7.0
```

- [x] **Step 4: Bump plugin version**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change `"version": "0.6.0"` to `"version": "0.7.0"`.

- [x] **Step 5: Dogfood verification**

```bash
TMP=$(mktemp -d -t kadai-plan11-XXXXXX)
cd "$TMP"

kadai init -y > /dev/null
kadai add feature --title "Math utils" --phase mvp --epic EPIC-001 > /dev/null
kadai add story --title "Implement add(a,b)" --phase mvp --feature FEAT-001 > /dev/null

echo "=== settings.json hooks ==="
cat .claude/settings.json | head -40

echo ""
echo "=== user-prompt-submit (no story picked) ==="
echo '{"hook_event_name":"UserPromptSubmit","prompt":"hi"}' | kadai hook user-prompt-submit
echo "(exit code: $?)"

echo ""
echo "=== pick STORY-001 ==="
kadai pick STORY-001 > /dev/null

echo ""
echo "=== user-prompt-submit (story picked) ==="
echo '{"hook_event_name":"UserPromptSubmit","prompt":"hi"}' | kadai hook user-prompt-submit
echo "(exit code: $?)"

echo ""
echo "=== stop hook (no recent changelog) ==="
echo '{"hook_event_name":"Stop"}' | kadai hook stop
echo "(exit code: $?)"

echo ""
echo "=== simulate fresh changelog activity, then stop ==="
# Find the story changelog dir + write an entry now.
STORY_DIR=$(find .kadai -path '*STORY-001*' -type d | head -1)
echo "- $(date -Iseconds) \`Write\` test.txt" > "$STORY_DIR/changelog.md"
echo '{"hook_event_name":"Stop"}' | kadai hook stop
echo "(exit code: $?)"

cd / && rm -rf "$TMP"
```

Expected:
- `settings.json` shows 4 hook events registered.
- UserPromptSubmit with no story picked → no output, exit 0.
- After `kadai pick STORY-001`, UserPromptSubmit emits `[kadai-active-story]` block.
- Stop with no changelog → no output.
- Stop with fresh changelog → JSON `{"reason":"Picked story STORY-001 is still in_progress..."}`.

CAPTURE the actual output for the log entry.

- [x] **Step 6: Append a section to docs/dogfood-acceptance-test.md**

APPEND:

```markdown

---

## Hook polish run — Plan 11 verification — 2026-05-06

Verified the two new hook subcommands end-to-end with `echo | kadai hook ...`.

- `kadai init -y` registered all 4 hook events in `.claude/settings.json` ✅
- `kadai hook user-prompt-submit` with no story picked → silent, exit 0 ✅
- After `kadai pick STORY-001`, `kadai hook user-prompt-submit` → emitted `[kadai-active-story]` context block with id/title/phase/status ✅
- `kadai hook stop` with no recent changelog → silent ✅
- `kadai hook stop` after fresh changelog write → JSON `{"reason":"Picked story STORY-001 is still in_progress..."}` ✅
- `bun test` → 268/0 pass ✅

### Verdict: PASS

All four hook touchpoints are now wired. Real Claude Code session would inject context on each prompt and remind on stop.
```

(Use actual outputs from your dogfood run.)

- [x] **Step 7: Run all the final checks**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
bun run build:web
bunx playwright test
```

Expected: every step exits clean. (build:web + playwright are unchanged — no regression.)

- [x] **Step 8: Tick the Task 4 checkboxes + Plan 11 self-review checklist**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-11-hook-polish.md`:
- Tick all 9 step checkboxes for Task 4
- Tick all checkboxes in the "Plan 11 self-review checklist" section near the bottom

- [x] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add docs/wiki/cli-reference.md docs/wiki/concepts.md docs/wiki/post-mvp.md docs/dogfood-acceptance-test.md kadai-plugin/.claude-plugin/plugin.json docs/superpowers/plans/2026-05-06-kadai-11-hook-polish.md
git commit -m "$(cat <<'EOF'
docs(plan-11): cli-reference, concepts, post-mvp shipped + plugin 0.7.0 [Plan-11 Task-4]

- cli-reference.md: kadai hook section now lists all 4 subcommands
- concepts.md: 'Hook touchpoints' subsection
- post-mvp.md: Plan 11 → Recently shipped, Plan 12 → next
- plugin.json: 0.6.0 → 0.7.0
- dogfood-acceptance-test.md: hook polish spot-check appended

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan 11 self-review checklist

- [x] All 4 tasks completed; checkboxes ticked.
- [x] `bun test` passes (~268 tests).
- [x] `bun run typecheck` passes.
- [x] `bunx playwright test` passes (8/8 — no change).
- [x] `kadai hook user-prompt-submit` injects context when story picked, silent otherwise (verified in Task 4 dogfood).
- [x] `kadai hook stop` emits reminder JSON only when story is in_progress + recent changelog activity (verified in Task 4 dogfood).
- [x] `kadai init -y` lays down all 4 hook entries in `.claude/settings.json`.
- [x] Re-running `init` doesn't duplicate hook entries (idempotent).
- [x] Plugin v0.7.0 in the manifest.
- [x] post-mvp.md: Plan 11 in "Recently shipped"; Plan 12 marked 🟢 **next**.
- [x] cli-reference.md and concepts.md updated.

---

## Proceed to Plan 12

Once the self-review checklist is fully ticked, update the active plan in `/home/fintan/repos/kadai/CLAUDE.md` to point at Plan 12 (Distribution polish — `bun build --compile`, asset embedding, brew/npm/curl). The next plan is brainstormed/drafted from `docs/wiki/post-mvp.md` § Plan 12.
