# Kadai Plan 10 — Git integration (`kadai sync`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `kadai sync` CLI command that scrapes the git log for `EPIC-NNN` / `FEAT-NNN` / `STORY-NNN` / `TASK-NNN` references in commit messages and appends each matching commit to the referenced item's `changelog.md`. Idempotent — re-running only adds new commits. Optionally (config-gated) auto-transitions a story to `done` when a `Merge pull request` commit references it.

**Architecture:** Two new pure core modules: `src/core/git.ts` shells out to `git log` once and parses commits; `src/core/sync.ts` walks the commit list, extracts ID refs, dedups by SHA against existing `changelog.md` lines, and appends new entries (and optionally calls `setStatus` on PR-merge commits per the existing `auto_transitions.pr_merge_marks_story_done` config flag). The CLI is a thin wrapper. No new runtime dependencies — `child_process.execSync` does the git interaction.

**Tech Stack:** TypeScript on Bun (existing). Standard library `child_process` + `node:os`. The existing `setStatus` core operation handles the auto-transition path.

## Position in the build

| | |
|---|---|
| **This is plan** | 10 of N |
| **Prior plan** | [Plan 9 — Search](2026-05-06-kadai-09-search.md) — `DONE` |
| **Next plan** | Plan 11 — Hook polish (`UserPromptSubmit` + `Stop`), per [post-mvp.md](../../wiki/post-mvp.md) |
| **Index** | [README.md](README.md) |
| **Backlog** | [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md) |

## What ships at the end

- `src/core/git.ts` — `listCommits(rootDir, opts): Commit[]` shells out to `git log` once and returns `{sha, dateIso, subject, body}` records.
- `src/core/sync.ts` — `syncChangelogs(rootDir, opts): SyncResult` walks commits, extracts ID refs (`/\b(EPIC|FEAT|STORY|TASK)-\d+\b/g`), looks up items, dedups by SHA against existing changelog lines, appends new entries, optionally auto-transitions on PR-merge commits.
- `src/cli/sync.ts` — `kadai sync [--since <ref>] [--dry-run] [--branch <name>]` thin CLI wrapper.
- `src/cli/index.ts` — registers `syncCommand`.
- `docs/wiki/cli-reference.md` — adds `kadai sync` section.
- `docs/wiki/concepts.md` — explains the changelog dual-source (hooks + sync).
- Plugin version 0.5.0 → 0.6.0.
- ~15 new unit/integration tests (git parse + sync logic + CLI smoke).
- All ~230 existing tests still pass.

## Out of scope (deferred)

- `kadai sync` as an MCP tool (CLI is sufficient — agents that want to sync use Bash).
- A `Sync now` button in the web viewer.
- A "last synced commit" pointer on disk (full-log scan + SHA dedup is fine for repos with thousands of commits; we can add this later if it becomes slow).
- Cross-branch awareness (default scans HEAD; `--branch <name>` lets you switch — no merging across multiple branches).
- GitHub API integration (the PR-merge transition uses the local commit subject pattern only — `^Merge pull request #\d+`, the convention `gh pr merge --merge` writes).

## File structure

```
src/core/git.ts                                  # NEW: listCommits + parseGitLogOutput
src/core/sync.ts                                 # NEW: syncChangelogs + appendCommitToChangelog + extractIdRefs
src/cli/sync.ts                                  # NEW: runSync + syncCommand
src/cli/index.ts                                 # MODIFIED: register syncCommand

tests/core/git.test.ts                           # NEW: ~6 tests against an ephemeral git repo
tests/core/sync.test.ts                          # NEW: ~8 tests against tmp git + tmp .kadai
tests/cli/sync.test.ts                           # NEW: ~3 smoke tests through runSync

docs/wiki/cli-reference.md                       # MODIFIED: add kadai sync section
docs/wiki/concepts.md                            # MODIFIED: changelog dual-source paragraph
docs/wiki/post-mvp.md                            # MODIFIED: Plan 10 → Recently shipped, Plan 11 → next
docs/dogfood-acceptance-test.md                  # APPEND: Plan 10 verification
kadai-plugin/.claude-plugin/plugin.json          # MODIFIED: 0.5.0 → 0.6.0
```

## Tasks

---

### Task 1: Git log parsing (`core/git.ts`)

**Files:**
- Create: `src/core/git.ts`
- Create: `tests/core/git.test.ts`

**Goal:** Pure function that runs `git log` once and returns parsed `Commit[]`. Uses `\x00` (NUL) as field/record separators so subjects/bodies with newlines and special chars round-trip cleanly. Handles missing `.git/`, empty repos, and `--since` filters.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/core/git.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listCommits } from '../../src/core/git';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-git-'));
  execSync('git init -q -b main', { cwd: tmp });
  execSync('git config user.email "test@example.com"', { cwd: tmp });
  execSync('git config user.name "Test"', { cwd: tmp });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function commit(cwd: string, subject: string, body?: string): string {
  writeFileSync(join(cwd, 'f-' + Date.now() + Math.random() + '.txt'), 'x');
  execSync('git add -A', { cwd });
  const msg = body ? `${subject}\n\n${body}` : subject;
  execSync(`git commit -q -m ${JSON.stringify(msg)}`, { cwd });
  return execSync('git rev-parse HEAD', { cwd, encoding: 'utf8' }).trim();
}

test('listCommits returns [] when there are no commits', () => {
  expect(listCommits(tmp)).toEqual([]);
});

test('listCommits returns one commit with correct fields', () => {
  const sha = commit(tmp, 'feat: hello world');
  const commits = listCommits(tmp);
  expect(commits.length).toBe(1);
  expect(commits[0].sha).toBe(sha);
  expect(commits[0].subject).toBe('feat: hello world');
  expect(commits[0].body).toBe('');
  expect(commits[0].dateIso).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
});

test('listCommits parses multi-line body without truncation', () => {
  commit(tmp, 'feat: thing', 'Line one.\n\nLine two.\n\nReferences STORY-042.');
  const c = listCommits(tmp)[0];
  expect(c.body).toContain('Line one.');
  expect(c.body).toContain('Line two.');
  expect(c.body).toContain('STORY-042');
});

test('listCommits returns commits in newest-first order (matches git log default)', () => {
  const sha1 = commit(tmp, 'first');
  const sha2 = commit(tmp, 'second');
  const sha3 = commit(tmp, 'third');
  const commits = listCommits(tmp);
  expect(commits.map(c => c.sha)).toEqual([sha3, sha2, sha1]);
});

test('listCommits with --since limits the range', () => {
  const sha1 = commit(tmp, 'before');
  // Tag the boundary so --since uses it deterministically (no relative time).
  execSync('git tag boundary', { cwd: tmp });
  const sha2 = commit(tmp, 'after');
  const filtered = listCommits(tmp, { since: 'boundary' });
  expect(filtered.map(c => c.sha)).toEqual([sha2]);
});

test('listCommits returns [] when rootDir is not a git repo', () => {
  const notRepo = mkdtempSync(join(tmpdir(), 'kadai-notgit-'));
  try {
    expect(listCommits(notRepo)).toEqual([]);
  } finally {
    rmSync(notRepo, { recursive: true, force: true });
  }
});

test('listCommits handles a subject containing the field-separator-like sequence', () => {
  // Subject with a literal NUL would be invalid for git anyway; the realistic
  // edge case is subjects with newline-like chars. Test a subject with quotes
  // and pipe characters that don't break parsing.
  commit(tmp, 'feat: "quoted" | piped subject', 'And |body| with chars.');
  const c = listCommits(tmp)[0];
  expect(c.subject).toBe('feat: "quoted" | piped subject');
  expect(c.body).toContain('|body|');
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/git.test.ts
```

Expected: FAIL with "Cannot find module ../../src/core/git".

- [x] **Step 3: Implement core/git.ts**

Create `/home/fintan/repos/kadai/src/core/git.ts`:

```typescript
import { execSync } from 'node:child_process';

export interface Commit {
  sha: string;
  dateIso: string;
  subject: string;
  body: string;
}

export interface ListCommitsOptions {
  since?: string;   // git ref (commit/tag/branch); passed verbatim to --since-as-revision
  branch?: string;  // git ref to scan instead of HEAD
}

const FIELD_SEP = '\x1e';   // record separator (RS)
const COMMIT_SEP = '\x1f';  // unit separator (US) — between commits

/**
 * Run `git log` once and return parsed commits. Returns [] if the directory
 * isn't a git repo or has no commits. Newest-first (git's default).
 */
export function listCommits(rootDir: string, opts: ListCommitsOptions = {}): Commit[] {
  const args = [
    'log',
    `--pretty=format:%H${FIELD_SEP}%aI${FIELD_SEP}%s${FIELD_SEP}%b${COMMIT_SEP}`,
  ];
  if (opts.since) {
    // Use the commit-range form: <since>..HEAD (or <since>..<branch>).
    const head = opts.branch ?? 'HEAD';
    args.push(`${opts.since}..${head}`);
  } else if (opts.branch) {
    args.push(opts.branch);
  }

  let raw: string;
  try {
    raw = execSync(`git ${args.map(a => JSON.stringify(a)).join(' ')}`, {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    // Not a git repo, no commits, or invalid range — caller treats as empty.
    return [];
  }

  return parseGitLogOutput(raw);
}

export function parseGitLogOutput(raw: string): Commit[] {
  const trimmed = raw.replace(new RegExp(`${COMMIT_SEP}$`), '');
  if (!trimmed) return [];
  return trimmed.split(COMMIT_SEP).map(chunk => {
    const fields = chunk.split(FIELD_SEP);
    return {
      sha: (fields[0] ?? '').trim(),
      dateIso: (fields[1] ?? '').trim(),
      subject: fields[2] ?? '',
      body: (fields[3] ?? '').trim(),
    };
  }).filter(c => c.sha.length > 0);
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/git.test.ts
```

Expected: 7 tests pass.

- [x] **Step 5: Run the full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: 237 tests pass (230 prior + 7 new). Typecheck clean.

- [x] **Step 6: Tick the 5 checkboxes for Task 1 in the plan**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-10-git-integration.md`, find Task 1 and tick all 5 step checkboxes.

- [ ] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/core/git.ts tests/core/git.test.ts docs/superpowers/plans/2026-05-06-kadai-10-git-integration.md
git commit -m "$(cat <<'EOF'
feat(core): add listCommits() git log parser [Plan-10 Task-1]

Shells out to git log with ASCII unit/record separators so multi-line
subjects/bodies round-trip cleanly. Returns [] for non-git dirs or empty
repos. Supports --since (commit range) and --branch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Sync logic (`core/sync.ts`)

**Files:**
- Create: `src/core/sync.ts`
- Create: `tests/core/sync.test.ts`

**Goal:** `syncChangelogs(rootDir, opts): SyncResult` walks commits from `listCommits`, extracts ID refs from each commit's `subject + body`, looks up the items, dedups by SHA against the existing changelog, and appends new entries. Returns counts for reporting.

The append format is:
```
- 2026-05-06T20:30:00Z `commit` 7d8cc19 feat(core): add listCommits() git log parser
```

Distinct from the hook-written format (`` `Write` src/foo.md ``) so the two never conflict.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/core/sync.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { setStatus } from '../../src/core/operations';
import { loadConfig, saveConfig } from '../../src/config/load';
import { syncChangelogs, extractIdRefs } from '../../src/core/sync';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-sync-'));
  // Init a git repo first (sync needs one).
  execSync('git init -q -b main', { cwd: tmp });
  execSync('git config user.email "test@example.com"', { cwd: tmp });
  execSync('git config user.name "Test"', { cwd: tmp });
  // Then init kadai inside it.
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
  // Initial commit so the repo has history.
  execSync('git add -A', { cwd: tmp });
  execSync('git commit -q -m "chore: initial spine"', { cwd: tmp });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function commit(subject: string, body?: string): void {
  writeFileSync(join(tmp, 'f-' + Date.now() + Math.random() + '.txt'), 'x');
  execSync('git add -A', { cwd: tmp });
  const msg = body ? `${subject}\n\n${body}` : subject;
  execSync(`git commit -q -m ${JSON.stringify(msg)}`, { cwd: tmp });
}

function changelogFor(itemId: string): string | null {
  const item = findById(tmp, itemId);
  if (!item) return null;
  const path = join(dirname(item.path), 'changelog.md');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

test('extractIdRefs finds STORY-NNN in a string', () => {
  expect(extractIdRefs('Fixes STORY-001 and EPIC-042 today')).toEqual(['STORY-001', 'EPIC-042']);
});

test('extractIdRefs handles all four kinds', () => {
  expect(extractIdRefs('EPIC-1 FEAT-2 STORY-3 TASK-4')).toEqual(['EPIC-1', 'FEAT-2', 'STORY-3', 'TASK-4']);
});

test('extractIdRefs dedups within a single string', () => {
  expect(extractIdRefs('STORY-001 again STORY-001')).toEqual(['STORY-001']);
});

test('extractIdRefs returns [] when nothing matches', () => {
  expect(extractIdRefs('No refs here')).toEqual([]);
});

test('extractIdRefs ignores look-alikes (no word boundary)', () => {
  expect(extractIdRefs('xSTORY-001 STORY-001y')).toEqual([]);
});

test('syncChangelogs appends a referenced commit to the story changelog', () => {
  commit('feat: implement Email login STORY-001');
  const result = syncChangelogs(tmp);
  expect(result.appended).toBe(1);
  expect(result.scanned).toBeGreaterThanOrEqual(1);
  const log = changelogFor('STORY-001');
  expect(log).not.toBeNull();
  expect(log).toMatch(/`commit` [0-9a-f]{7}/);
  expect(log).toContain('feat: implement Email login STORY-001');
});

test('syncChangelogs is idempotent (re-running adds nothing)', () => {
  commit('feat: add thing STORY-001');
  syncChangelogs(tmp);
  const before = changelogFor('STORY-001')!;
  const second = syncChangelogs(tmp);
  expect(second.appended).toBe(0);
  expect(changelogFor('STORY-001')).toBe(before);
});

test('syncChangelogs routes to multiple items when commit references several', () => {
  commit('feat: cross-cutting STORY-001 and FEAT-001');
  const result = syncChangelogs(tmp);
  expect(result.appended).toBe(2);
  expect(changelogFor('STORY-001')).toContain('cross-cutting');
  expect(changelogFor('FEAT-001')).toContain('cross-cutting');
});

test('syncChangelogs skips ID refs that do not exist in the spine', () => {
  commit('feat: ghost STORY-999');
  const result = syncChangelogs(tmp);
  expect(result.appended).toBe(0);
  expect(changelogFor('STORY-001')).toBeNull();  // no entry created
});

test('syncChangelogs --dry-run does not write but reports counts', () => {
  commit('feat: dry STORY-001');
  const result = syncChangelogs(tmp, { dryRun: true });
  expect(result.appended).toBe(1);
  expect(changelogFor('STORY-001')).toBeNull();
});

test('syncChangelogs auto-transitions story to done on PR-merge commit when config enabled', () => {
  // Move STORY-001 into a state from which 'done' is legal (review → done).
  setStatus(tmp, 'STORY-001', 'in_progress');
  setStatus(tmp, 'STORY-001', 'review');

  // Enable the auto-transition flag.
  const config = loadConfig(tmp);
  config.auto_transitions.pr_merge_marks_story_done = true;
  saveConfig(tmp, config);

  commit('Merge pull request #42 from foo/bar', 'Implements STORY-001');
  const result = syncChangelogs(tmp);
  expect(result.appended).toBe(1);
  expect(result.transitionedToDone).toEqual(['STORY-001']);
  expect(findById(tmp, 'STORY-001')!.data.status).toBe('done');
});

test('syncChangelogs does NOT auto-transition when config flag is off', () => {
  setStatus(tmp, 'STORY-001', 'in_progress');
  setStatus(tmp, 'STORY-001', 'review');

  // Default config has pr_merge_marks_story_done = false.
  commit('Merge pull request #42 from foo/bar', 'Implements STORY-001');
  const result = syncChangelogs(tmp);
  expect(result.transitionedToDone).toEqual([]);
  expect(findById(tmp, 'STORY-001')!.data.status).toBe('review');  // unchanged
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/sync.test.ts
```

Expected: FAIL with "Cannot find module ../../src/core/sync".

- [x] **Step 3: Implement core/sync.ts**

Create `/home/fintan/repos/kadai/src/core/sync.ts`:

```typescript
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { listCommits, type Commit, type ListCommitsOptions } from './git';
import { findById } from './spine';
import { setStatus } from './operations';
import { isLegalTransition } from './state-machine';
import { loadConfig } from '../config/load';

export interface SyncOptions extends ListCommitsOptions {
  dryRun?: boolean;
}

export interface SyncResult {
  scanned: number;
  appended: number;
  byId: Record<string, number>;
  transitionedToDone: string[];
}

const ID_PATTERN = /\b(?:EPIC|FEAT|STORY|TASK)-\d+\b/g;
const PR_MERGE_PATTERN = /^Merge pull request #\d+/;

export function extractIdRefs(text: string): string[] {
  const matches = text.match(ID_PATTERN);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

function changelogPath(rootDir: string, itemId: string): string | null {
  const item = findById(rootDir, itemId);
  if (!item) return null;
  return join(dirname(item.path), 'changelog.md');
}

function alreadyHasSha(path: string, sha: string): boolean {
  if (!existsSync(path)) return false;
  const short = sha.slice(0, 7);
  const text = readFileSync(path, 'utf8');
  return text.includes(`\`commit\` ${short}`) || text.includes(`\`commit\` ${sha}`);
}

function buildChangelogLine(commit: Commit): string {
  const short = commit.sha.slice(0, 7);
  // Use the commit's date, not now() — matters when sync runs days after commits land.
  return `- ${commit.dateIso} \`commit\` ${short} ${commit.subject}\n`;
}

export function syncChangelogs(rootDir: string, opts: SyncOptions = {}): SyncResult {
  const commits = listCommits(rootDir, opts);
  const result: SyncResult = { scanned: commits.length, appended: 0, byId: {}, transitionedToDone: [] };
  const config = loadConfig(rootDir);
  const autoDone = config.auto_transitions.pr_merge_marks_story_done;

  for (const c of commits) {
    const refs = extractIdRefs(`${c.subject}\n${c.body}`);
    for (const id of refs) {
      const path = changelogPath(rootDir, id);
      if (!path) continue;  // ID doesn't resolve to an item — skip
      if (alreadyHasSha(path, c.sha)) continue;

      if (!opts.dryRun) {
        appendFileSync(path, buildChangelogLine(c), 'utf8');
      }
      result.appended += 1;
      result.byId[id] = (result.byId[id] ?? 0) + 1;
    }

    if (autoDone && PR_MERGE_PATTERN.test(c.subject)) {
      for (const id of refs) {
        if (!id.startsWith('STORY-')) continue;
        const item = findById(rootDir, id);
        if (!item) continue;
        if (item.data.status === 'done') continue;
        if (!isLegalTransition('story', item.data.status, 'done')) continue;
        if (!opts.dryRun) {
          setStatus(rootDir, id, 'done');
        }
        result.transitionedToDone.push(id);
      }
    }
  }

  return result;
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/sync.test.ts
```

Expected: 12 tests pass.

- [x] **Step 5: Run the full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: 249 pass (237 + 12 new). Typecheck clean.

- [x] **Step 6: Tick the 5 checkboxes for Task 2 in the plan**

Tick all 5 step checkboxes for Task 2.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/core/sync.ts tests/core/sync.test.ts docs/superpowers/plans/2026-05-06-kadai-10-git-integration.md
git commit -m "$(cat <<'EOF'
feat(core): add syncChangelogs + extractIdRefs [Plan-10 Task-2]

Walks commits from listCommits, extracts EPIC/FEAT/STORY/TASK refs from
subject + body, dedups by short SHA against existing changelog lines, and
appends new entries in the format `- <isoDate> \`commit\` <sha7> <subject>`.

When auto_transitions.pr_merge_marks_story_done is true and a commit subject
matches "^Merge pull request #N", referenced stories transition to done
(provided the transition is legal). --dry-run reports counts without writing.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `kadai sync` CLI command

**Files:**
- Create: `src/cli/sync.ts`
- Create: `tests/cli/sync.test.ts`
- Modify: `src/cli/index.ts` (register `syncCommand`)

**Goal:** Thin CLI over `syncChangelogs`. Prints a one-line summary plus a per-item breakdown when there are appends. Flags: `--since <ref>`, `--dry-run`, `--branch <name>`.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/cli/sync.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { execSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { runSync } from '../../src/cli/sync';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-cli-sync-'));
  execSync('git init -q -b main', { cwd: tmp });
  execSync('git config user.email "test@example.com"', { cwd: tmp });
  execSync('git config user.name "Test"', { cwd: tmp });
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
  execSync('git add -A', { cwd: tmp });
  execSync('git commit -q -m "chore: initial"', { cwd: tmp });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runSync returns zero appended on a clean repo with no ID-referencing commits', () => {
  const r = runSync(tmp, {});
  expect(r.appended).toBe(0);
});

test('runSync appends a single referenced commit', () => {
  writeFileSync(join(tmp, 'a.txt'), 'x');
  execSync('git add -A', { cwd: tmp });
  execSync('git commit -q -m "feat: STORY-001 add the thing"', { cwd: tmp });

  const r = runSync(tmp, {});
  expect(r.appended).toBe(1);
  expect(r.byId['STORY-001']).toBe(1);
});

test('runSync --dry-run reports counts but does not modify changelogs', () => {
  writeFileSync(join(tmp, 'a.txt'), 'x');
  execSync('git add -A', { cwd: tmp });
  execSync('git commit -q -m "fix: STORY-001 something"', { cwd: tmp });

  const r1 = runSync(tmp, { dryRun: true });
  expect(r1.appended).toBe(1);

  // Re-running without dry-run should still find the same entry to append.
  const r2 = runSync(tmp, {});
  expect(r2.appended).toBe(1);

  // And one more time with no flag — now it's already there.
  const r3 = runSync(tmp, {});
  expect(r3.appended).toBe(0);
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/sync.test.ts
```

Expected: FAIL with "Cannot find module ../../src/cli/sync".

- [x] **Step 3: Implement src/cli/sync.ts**

Create `/home/fintan/repos/kadai/src/cli/sync.ts`:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { syncChangelogs, type SyncResult, type SyncOptions } from '../core/sync';

export function runSync(rootDir: string, opts: SyncOptions): SyncResult {
  return syncChangelogs(rootDir, opts);
}

interface SyncCliOptions {
  since?: string;
  branch?: string;
  dryRun?: boolean;
}

export const syncCommand = new Command('sync')
  .description('Scan git log for kadai item references (EPIC-/FEAT-/STORY-/TASK-NNN) and append matching commits to changelog.md')
  .option('--since <ref>', 'only scan commits since this git ref (commit/tag/branch); equivalent to git log <ref>..HEAD')
  .option('--branch <name>', 'scan a specific branch instead of HEAD')
  .option('--dry-run', 'show what would be appended without writing')
  .action((opts: SyncCliOptions) => {
    const result = runSync(process.cwd(), {
      since: opts.since,
      branch: opts.branch,
      dryRun: opts.dryRun,
    });
    const verb = opts.dryRun ? 'Would append' : 'Appended';
    console.log(pc.green(`✓ Scanned ${result.scanned} commits — ${verb} ${result.appended} entries`));
    const ids = Object.keys(result.byId);
    if (ids.length > 0) {
      ids.sort();
      for (const id of ids) {
        console.log(`  ${pc.cyan(id)}: ${result.byId[id]}`);
      }
    }
    if (result.transitionedToDone.length > 0) {
      console.log(pc.green(`✓ Auto-transitioned to done: ${result.transitionedToDone.join(', ')}`));
    }
  });
```

- [x] **Step 4: Register in src/cli/index.ts**

Read `/home/fintan/repos/kadai/src/cli/index.ts`. Add this import alongside the existing command imports:

```typescript
import { syncCommand } from './sync';
```

Add this line alongside the other `program.addCommand(...)` lines:

```typescript
program.addCommand(syncCommand);
```

- [x] **Step 5: Run tests + typecheck + smoke**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/sync.test.ts
bun test
bun run typecheck
kadai sync --help
```

Expected: 3 sync.test.ts tests pass; full suite 252 pass (249 + 3); typecheck clean; help output shows the three flags.

- [x] **Step 6: Tick the 5 checkboxes for Task 3 in the plan**

Tick all 5 step checkboxes for Task 3.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/sync.ts src/cli/index.ts tests/cli/sync.test.ts docs/superpowers/plans/2026-05-06-kadai-10-git-integration.md
git commit -m "$(cat <<'EOF'
feat(cli): add 'kadai sync' command [Plan-10 Task-3]

Wraps syncChangelogs. Flags: --since <ref>, --branch <name>, --dry-run.
Prints scanned/appended counts plus per-item breakdown and auto-transition
notices.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Docs + plugin v0.6.0 + post-MVP tracking + dogfood

**Files:**
- Modify: `docs/wiki/cli-reference.md`
- Modify: `docs/wiki/concepts.md`
- Modify: `docs/wiki/post-mvp.md`
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (0.5.0 → 0.6.0)
- Append: `docs/dogfood-acceptance-test.md`
- Modify: `docs/superpowers/plans/2026-05-06-kadai-10-git-integration.md`

- [x] **Step 1: Update cli-reference.md**

In `/home/fintan/repos/kadai/docs/wiki/cli-reference.md`, find a good place near the other commands (after `kadai unpick` or before `kadai phases` is fine). Add this section:

````markdown
## `kadai sync [options]`

Scan the git log for `EPIC-NNN` / `FEAT-NNN` / `STORY-NNN` / `TASK-NNN` references in commit messages and append each matching commit to the referenced item's `changelog.md`. Idempotent — re-running adds only commits not already present (dedup by short SHA).

| Flag | Effect |
|---|---|
| `--since <ref>` | Only scan commits since this git ref (commit/tag/branch). Equivalent to `git log <ref>..HEAD`. |
| `--branch <name>` | Scan a specific branch instead of HEAD. |
| `--dry-run` | Show what would be appended without writing to disk. |

Example:

```bash
kadai sync                              # full scan of HEAD
kadai sync --since v0.5.0               # only commits since the v0.5.0 tag
kadai sync --branch feature/auth        # scan a feature branch
kadai sync --dry-run                    # preview only
```

The append format is:
```
- 2026-05-06T20:30:00Z `commit` 7d8cc19 feat: implement STORY-001 happy path
```

Distinct from the hook-written format (`` `Write` src/foo.md ``) so the two coexist in one changelog without conflict.

When `auto_transitions.pr_merge_marks_story_done = true` (set via `kadai config auto_transitions.pr_merge_marks_story_done=true`), commits whose subject matches `^Merge pull request #N` AND reference a `STORY-NNN` will transition that story to `done` (only if the current status allows the transition).
````

- [x] **Step 2: Update concepts.md**

In `/home/fintan/repos/kadai/docs/wiki/concepts.md`, find the section about the changelog (search for "changelog" — there should be a paragraph or table mentioning it). Add this paragraph:

```markdown
### Changelog dual-source

Each story's `changelog.md` is appended to from two sources:

- **PostToolUse hook** — every `Edit`/`Write` while a story is picked. Format: `` `- 2026-05-06T... `Write` src/foo.md` ``
- **`kadai sync`** — git commits whose message references the item's ID. Format: `` `- 2026-05-06T... `commit` <sha7> <subject>` ``

The shapes are distinct on purpose so a single `changelog.md` can mix both without confusion. `kadai sync` dedups by short SHA, so re-running is safe.
```

- [x] **Step 3: Update post-mvp.md**

In `/home/fintan/repos/kadai/docs/wiki/post-mvp.md`:

(a) Find `### Plan 10 — Git integration (\`kadai sync\`) 🟢 **next**` and remove the entire section (heading + bullets + estimate).

(b) Find the next plan in the list (should be `### Plan 11 — Hook polish`). Add the badge:

```markdown
### Plan 11 — Hook polish 🟢 **next**
```

(c) In the "Recently shipped" section, ABOVE the existing `### Plan 9` entry, insert:

```markdown
### Plan 10 — Git integration (shipped 2026-05-06)

- `kadai sync [--since <ref>] [--branch <name>] [--dry-run]` — scrapes git log for item ID refs and appends to `changelog.md`
- `src/core/git.ts` — `listCommits()` shells out to `git log` with ASCII record separators
- `src/core/sync.ts` — `syncChangelogs()` + `extractIdRefs()`; idempotent via short-SHA dedup
- Auto-transition stories to `done` on `Merge pull request` commits when `auto_transitions.pr_merge_marks_story_done = true`
- 22 new tests (7 git + 12 sync + 3 CLI)
- Plugin version bumped to 0.6.0
```

- [x] **Step 4: Bump plugin version**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change `"version": "0.5.0"` to `"version": "0.6.0"`.

- [x] **Step 5: Dogfood verification**

```bash
TMP=$(mktemp -d -t kadai-plan10-XXXXXX)
cd "$TMP"

git init -q -b main
git config user.email "test@example.com"
git config user.name "Test"

kadai init -y > /dev/null
kadai add feature --title "Math utils" --phase mvp --epic EPIC-001 > /dev/null
kadai add story --title "Implement add(a,b)" --phase mvp --feature FEAT-001 > /dev/null
git add -A
git commit -q -m "chore: initial spine"

# Two commits referencing the story.
echo 'export const add = (a: number, b: number) => a + b;' > add.ts
git add -A
git commit -q -m "feat: add(a,b) impl STORY-001"

echo '// tests' >> add.ts
git add -A
git commit -q -m "test: add cases for STORY-001"

# A commit referencing nothing.
echo 'noise' > misc.txt
git add -A
git commit -q -m "chore: noise"

echo "=== kadai sync ==="
kadai sync

echo ""
echo "=== changelog for STORY-001 ==="
find .kadai -name changelog.md -exec cat {} \;

echo ""
echo "=== kadai sync (idempotency check — should be 0 appended) ==="
kadai sync

echo ""
echo "=== kadai sync --dry-run after a new commit ==="
echo 'extra' >> add.ts
git add -A
git commit -q -m "fix: STORY-001 edge case"
kadai sync --dry-run

cd / && rm -rf "$TMP"
```

Expected:
- First sync appends 2 entries to STORY-001's changelog.
- Second sync appends 0 (idempotent).
- Dry-run after a new commit reports 1 would-be-appended without writing.

CAPTURE the output for the log entry.

- [x] **Step 6: Append a section to docs/dogfood-acceptance-test.md**

APPEND:

```markdown

---

## Git sync run — Plan 10 verification — 2026-05-06

Verified `kadai sync` end-to-end against an ephemeral git repo seeded with kadai items.

- Made 3 commits — 2 referencing `STORY-001`, 1 with no refs.
- `kadai sync` → "Scanned 4 commits — Appended 2 entries" with `STORY-001: 2` ✅
- Inspected `.kadai/.../STORY-001/changelog.md` — both commit lines present, distinct from hook-written shape ✅
- Re-ran `kadai sync` → "Appended 0 entries" (idempotent via SHA dedup) ✅
- Made a 4th commit referencing STORY-001, ran `kadai sync --dry-run` → "Would append 1" without modifying disk ✅
- `bun test` → 252/0 pass ✅

### Verdict: PASS

Git → changelog flow is end-to-end correct, idempotent, and dry-run safe.
```

(Use actual numbers from your run.)

- [x] **Step 7: Run all the final checks**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
bun run build:web
bunx playwright test
```

Expected: every step exits clean. (build:web + playwright are unchanged from Plan 9 — should still pass with no regression.)

- [x] **Step 8: Tick the Task 4 checkboxes + Plan 10 self-review checklist**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-10-git-integration.md`:
- Tick all 9 step checkboxes for Task 4
- Tick all checkboxes in the "Plan 10 self-review checklist" section near the bottom

- [x] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add docs/wiki/cli-reference.md docs/wiki/concepts.md docs/wiki/post-mvp.md docs/dogfood-acceptance-test.md kadai-plugin/.claude-plugin/plugin.json docs/superpowers/plans/2026-05-06-kadai-10-git-integration.md
git commit -m "$(cat <<'EOF'
docs(plan-10): cli-reference, concepts, post-mvp shipped + plugin 0.6.0 [Plan-10 Task-4]

- cli-reference.md: new 'kadai sync' section with flags + format
- concepts.md: changelog dual-source paragraph (hook + sync)
- post-mvp.md: Plan 10 → Recently shipped, Plan 11 → next
- plugin.json: 0.5.0 → 0.6.0
- dogfood-acceptance-test.md: kadai sync spot-check appended

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan 10 self-review checklist

- [x] All 4 tasks completed; checkboxes ticked.
- [x] `bun test` passes (~252 tests).
- [x] `bun run typecheck` passes.
- [x] `bunx playwright test` passes (8/8 — no change).
- [x] `kadai sync` works end-to-end (verified in Task 4 dogfood).
- [x] Idempotency verified (re-running adds 0 entries).
- [x] `--dry-run` does not modify disk.
- [x] Auto-transition on PR merge works when config flag enabled (verified in Task 2 tests).
- [x] Plugin v0.6.0 in the manifest.
- [x] post-mvp.md: Plan 10 in "Recently shipped"; Plan 11 marked 🟢 **next**.
- [x] cli-reference.md and concepts.md updated.

---

## Proceed to Plan 11

Once the self-review checklist is fully ticked, update the active plan in `/home/fintan/repos/kadai/CLAUDE.md` to point at Plan 11 (Hook polish — `UserPromptSubmit` injects "active story" context, `Stop` reminds when a turn ended without a status update).
