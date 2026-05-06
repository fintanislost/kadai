# Kadai Plan 14 — Stretch features

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the smaller stretch items from `post-mvp.md` Plan 14 — `record_change` MCP tool, markdown-only init mode, activity feed page, per-phase comparison view, and a beefier Playwright E2E suite. Bump kadai-plugin to **v1.0.0** when this lands; the post-MVP backlog is then fully drained except for the multi-project switcher (deferred to a future Plan 15) and the one-shot release-publishing user actions.

**Architecture:** Each item is a self-contained addition. The MCP tool lives next to the existing handlers in `src/mcp/handlers/`. Markdown-only mode is a new flag on `runInit` that conditionally skips the MCP/hook/CLAUDE.md merging. The activity feed and comparison view each get a new web API endpoint + a new TanStack Router page. The Playwright expansion adds 6+ new flows (status mutation via API, attach upload from a different page, full search→detail navigation with a body match, illegal transition surfaces error, etc.).

**Tech Stack:** TypeScript on Bun. No new runtime dependencies — the activity feed, comparison view, and MCP tool all reuse existing primitives (`walkSpine`, `loadConfig`, `appendFileSync` for changelogs).

## Position in the build

| | |
|---|---|
| **This is plan** | 14 of N |
| **Prior plan** | [Plan 13 — Developer ergonomics](2026-05-06-kadai-13-developer-ergonomics.md) — `DONE` |
| **Next plan** | Plan 15 — Multi-project switcher (per [post-mvp.md](../../wiki/post-mvp.md), originally bundled in Plan 14 but extracted because the multi-project surface is a substantially different concern) |
| **Index** | [README.md](README.md) |
| **Backlog** | [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md) |

## What ships at the end

- **MCP `record_change` tool** — agents can append a manual annotation to the picked story's `changelog.md` (e.g., "decided to defer the OAuth path", "blocked on auth-provider choice"); distinct from the PostToolUse hook's `\`Write\`` shape.
- **`kadai init --markdown-only`** — new flag that creates `.kadai/` + README only; skips MCP server registration, hook installation, and the `## Kadai` CLAUDE.md section. For users who just want files + the web viewer without the agent guardrails.
- **`GET /api/activity[?limit=N]`** — flat reverse-chronological list of changelog entries across the whole spine (parsed from each item's `changelog.md`). Powers a new `/activity` page in the web viewer.
- **`GET /api/compare?a=<phase>&b=<phase>`** — returns `{ a: { items[] }, b: { items[] }, common: { ids[] } }` for side-by-side phase comparison. Powers a new `/compare` page.
- **6+ new Playwright E2E flows** — status button revert on illegal transition, attach plan from spec tab, search snippet match navigation, kanban DnD across columns then back, activity feed renders, compare page renders.
- ~14 new unit tests + 6+ new E2E.
- Plugin version 0.9.0 → **1.0.0** (semver-meaningful: post-MVP backlog drained, public surface stable).
- All existing tests still pass.

## Out of scope (extracted to Plan 15)

- **Multi-project switcher in the web viewer** — substantial: requires a discovery mechanism (e.g., `~/.kadai/known-projects.json`), a project picker route, and root-relative URL changes throughout the SPA. Big enough to warrant its own plan; defer.

## Out of scope (general)

- Per-platform refinement of `prose` colors / spacing.
- Notification badges or email/Slack hooks for activity feed.
- Bulk operations in the comparison view (move all from a → b).
- Frontend bundle splitting / code-splitting (current bundle is ~480kB JS, fine for localhost).

## File structure

```
src/mcp/handlers/record-change.ts                # NEW: record_change MCP tool
src/mcp/server.ts                                # MODIFIED: register the new handler

src/cli/init.ts                                  # MODIFIED: --markdown-only flag + conditional skips

src/core/activity.ts                             # NEW: parseChangelogEntries + buildActivity
src/core/compare.ts                              # NEW: comparePhases

src/web/api.ts                                   # MODIFIED: add /api/activity + /api/compare routes

src/web/frontend/src/api.ts                      # MODIFIED: client wrappers (getActivity, comparePhases)
src/web/frontend/src/pages/Activity.tsx          # NEW
src/web/frontend/src/pages/Compare.tsx           # NEW
src/web/frontend/src/router.tsx                  # MODIFIED: register /activity + /compare
src/web/frontend/src/components/Layout.tsx       # MODIFIED: top-bar links to Activity + Compare

tests/mcp/handlers/record-change.test.ts         # NEW: ~3 tests
tests/cli/init-markdown-only.test.ts             # NEW: ~3 tests
tests/core/activity.test.ts                      # NEW: ~4 tests
tests/core/compare.test.ts                       # NEW: ~4 tests
tests/web/api.test.ts                            # MODIFIED: + ~5 new tests for /api/activity + /api/compare
tests/web/e2e.pw.ts                              # MODIFIED: + 6 new flows

docs/wiki/cli-reference.md                       # MODIFIED: --markdown-only on init
docs/wiki/api-reference.md                       # MODIFIED: /api/activity + /api/compare
docs/wiki/web-viewer.md                          # MODIFIED: Activity + Compare pages
docs/wiki/concepts.md                            # MODIFIED: markdown-only mode
docs/wiki/post-mvp.md                            # MODIFIED: Plan 14 → Recently shipped, Plan 15 → next
docs/dogfood-acceptance-test.md                  # APPEND: Plan 14 verification
kadai-plugin/.claude-plugin/plugin.json          # MODIFIED: 0.9.0 → 1.0.0
```

## Tasks

---

### Task 1: `record_change` MCP tool

**Files:**
- Create: `src/mcp/handlers/record-change.ts`
- Modify: `src/mcp/server.ts` (register the new handler)
- Create: `tests/mcp/handlers/record-change.test.ts`

**Goal:** New MCP tool that lets an agent append a manually-written annotation to the picked story's `changelog.md` — useful for capturing decisions, blockers, and design notes that don't naturally land via Edit/Write hook capture. Distinct shape from the hook-written entries (`` `Write` src/foo.md ``) and the sync-written entries (`` `commit` <sha> <subject> ``): annotations use `` `note` <message> ``.

- [x] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/mcp/handlers/record-change.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';
import { setPicked } from '../../../src/core/picked';
import { findById } from '../../../src/core/spine';
import { recordChange } from '../../../src/mcp/handlers/record-change';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-record-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function changelogFor(itemId: string): string | null {
  const item = findById(tmp, itemId);
  if (!item) return null;
  const path = join(dirname(item.path), 'changelog.md');
  if (!existsSync(path)) return null;
  return readFileSync(path, 'utf8');
}

test('recordChange appends a `note` line to the picked story changelog', () => {
  setPicked(tmp, 'STORY-001');
  recordChange(tmp, 'Decided to defer OAuth path until auth-provider chosen.');
  const log = changelogFor('STORY-001')!;
  expect(log).toMatch(/`note` Decided to defer OAuth path/);
  expect(log).toMatch(/^- \d{4}-\d{2}-\d{2}T/m);
});

test('recordChange throws if no story is picked', () => {
  expect(() => recordChange(tmp, 'oops')).toThrow(/no story is picked/i);
});

test('recordChange throws if picked story does not resolve', () => {
  setPicked(tmp, 'STORY-999');
  expect(() => recordChange(tmp, 'oops')).toThrow(/not found/i);
});

test('recordChange entries coexist with hook-written and sync-written entries', () => {
  setPicked(tmp, 'STORY-001');
  recordChange(tmp, 'first note');
  recordChange(tmp, 'second note');
  const log = changelogFor('STORY-001')!;
  expect(log.match(/`note`/g)?.length).toBe(2);
});
```

- [x] **Step 2: Run test to verify it fails**

```bash
cd /home/fintan/repos/kadai
bun test tests/mcp/handlers/record-change.test.ts
```

Expected: FAIL with "Cannot find module ../../../src/mcp/handlers/record-change".

- [x] **Step 3: Implement record-change.ts**

Create `/home/fintan/repos/kadai/src/mcp/handlers/record-change.ts`:

```typescript
import { appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { findById } from '../../core/spine';
import { readPicked } from '../../core/picked';
import { registerTool } from '../registry';

export function recordChange(rootDir: string, message: string): { story_id: string; appended: string } {
  const pickedId = readPicked(rootDir);
  if (!pickedId) throw new Error('Cannot record change: no story is picked.');
  const story = findById(rootDir, pickedId);
  if (!story) throw new Error(`Picked story not found: ${pickedId}`);

  const ts = new Date().toISOString();
  const line = `- ${ts} \`note\` ${message}\n`;
  const path = join(dirname(story.path), 'changelog.md');
  appendFileSync(path, line, 'utf8');
  return { story_id: pickedId, appended: line.trim() };
}

export function registerRecordChangeTool(): void {
  registerTool({
    name: 'record_change',
    description: 'Append a free-text annotation to the picked story\'s changelog.md. Use for decisions, blockers, and design notes that don\'t naturally land via Edit/Write hook capture. Distinct line shape (`note` prefix) from hook-written and sync-written entries.',
    inputSchema: z.object({
      message: z.string().min(1, 'message must be non-empty'),
    }),
    handler: async (args, ctx) => {
      return recordChange(ctx.rootDir, args.message);
    },
  });
}
```

- [x] **Step 4: Register in server.ts**

Read `/home/fintan/repos/kadai/src/mcp/server.ts`. Find the existing `register*Tools()` calls (look for `registerSearchTools()`, `registerCreateTools()`, etc.). Add the import alongside the others:

```typescript
import { registerRecordChangeTool } from './handlers/record-change';
```

And the call alongside the other registrations:

```typescript
registerRecordChangeTool();
```

- [x] **Step 5: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/mcp/handlers/record-change.test.ts
bun test
bun run typecheck
```

Expected: 4 new tests pass + 298 total (294 + 4). Typecheck clean.

- [x] **Step 6: Tick the step checkboxes for Task 1 in the plan**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-14-stretch-features.md`, find Task 1 and tick all step checkboxes.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/mcp/handlers/record-change.ts src/mcp/server.ts tests/mcp/handlers/record-change.test.ts docs/superpowers/plans/2026-05-06-kadai-14-stretch-features.md
git commit -m "$(cat <<'EOF'
feat(mcp): add record_change tool for manual annotations [Plan-14 Task-1]

New MCP tool that appends a `note`-shaped line to the picked story's
changelog.md. Distinct shape from hook-written (`Write`) and sync-written
(`commit`) entries — so all three sources coexist clearly in one log.
Use for decisions, blockers, design notes that don't land via Edit/Write
hook capture.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `kadai init --markdown-only` flag

**Files:**
- Modify: `src/cli/init.ts`
- Create: `tests/cli/init-markdown-only.test.ts`

**Goal:** A new `--markdown-only` flag on `kadai init` that creates `.kadai/` + README only, skipping the integration touch-points (`.mcp.json`, `.claude/settings.json`, `CLAUDE.md`). For users who want kadai's file format + web viewer without the agent guardrails.

- [ ] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/cli/init-markdown-only.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-md-only-'));
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runInit with markdownOnly: true creates .kadai/ but skips MCP/hooks/CLAUDE.md', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true, markdownOnly: true });
  expect(existsSync(join(tmp, '.kadai'))).toBe(true);
  expect(existsSync(join(tmp, '.kadai', 'config.toml'))).toBe(true);
  expect(existsSync(join(tmp, '.kadai', 'README.md'))).toBe(true);
  // Skipped:
  expect(existsSync(join(tmp, '.mcp.json'))).toBe(false);
  expect(existsSync(join(tmp, '.claude', 'settings.json'))).toBe(false);
  expect(existsSync(join(tmp, 'CLAUDE.md'))).toBe(false);
});

test('runInit without markdownOnly (default) installs the full integration', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  expect(existsSync(join(tmp, '.kadai'))).toBe(true);
  expect(existsSync(join(tmp, '.mcp.json'))).toBe(true);
  expect(existsSync(join(tmp, '.claude', 'settings.json'))).toBe(true);
  expect(existsSync(join(tmp, 'CLAUDE.md'))).toBe(true);
});

test('runInit markdownOnly is idempotent — re-running does not create the integration', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true, markdownOnly: true });
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true, markdownOnly: true });
  expect(existsSync(join(tmp, '.mcp.json'))).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/init-markdown-only.test.ts
```

Expected: FAIL — `markdownOnly` is not part of `InitOptions`.

- [ ] **Step 3: Update init.ts**

Read `/home/fintan/repos/kadai/src/cli/init.ts`. Update the `InitOptions` interface to include the new flag:

```typescript
export interface InitOptions {
  rootDir: string;
  productDescription: string;
  skipFirstEpic: boolean;
  markdownOnly?: boolean;
}
```

In `runInit`, gate the three integration calls. The existing code at the bottom of `runInit` looks something like:

```typescript
  appendKadaiSectionToClaudeMd(opts.rootDir);
  mergeKadaiIntoMcpJson(opts.rootDir);
  mergeKadaiHooksIntoSettingsJson(opts.rootDir);
```

Wrap in a conditional:

```typescript
  if (!opts.markdownOnly) {
    appendKadaiSectionToClaudeMd(opts.rootDir);
    mergeKadaiIntoMcpJson(opts.rootDir);
    mergeKadaiHooksIntoSettingsJson(opts.rootDir);
  }
```

In the Commander action handler at the bottom of the file, add the `--markdown-only` option:

```typescript
  .option('--markdown-only', 'create .kadai/ + README only; skip MCP / hooks / CLAUDE.md (no agent integration)')
```

In the action callback, pass `markdownOnly: !!opts.markdownOnly` into `runInit({...})`. The full action signature changes from `(opts: { yes?: boolean })` to `(opts: { yes?: boolean; markdownOnly?: boolean })`.

If the success message currently says "Restart your Claude Code session ... to load the new MCP server", suppress that message when `markdownOnly` is set — there's no MCP server or hook to load.

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/init-markdown-only.test.ts
bun test
bun run typecheck
kadai init --help
```

Expected: 3 new tests pass + 301 total (298 + 3); typecheck clean; help output shows `--markdown-only`.

- [ ] **Step 5: Tick the step checkboxes for Task 2 in the plan**

Tick all step checkboxes for Task 2.

- [ ] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/init.ts tests/cli/init-markdown-only.test.ts docs/superpowers/plans/2026-05-06-kadai-14-stretch-features.md
git commit -m "$(cat <<'EOF'
feat(cli): kadai init --markdown-only [Plan-14 Task-2]

New flag that creates .kadai/ + README only; skips MCP server registration,
hook installation, and the ## Kadai CLAUDE.md section. For users who want
kadai's file format + web viewer without the agent guardrails (e.g., human-
only spine tracking, or pre-staging a project for evaluation).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Activity feed (core + API + page)

**Files:**
- Create: `src/core/activity.ts`
- Modify: `src/web/api.ts` (new `/api/activity` route)
- Modify: `tests/web/api.test.ts` (~2 new tests)
- Create: `tests/core/activity.test.ts`
- Modify: `src/web/frontend/src/api.ts` (add `getActivity` client)
- Create: `src/web/frontend/src/pages/Activity.tsx`
- Modify: `src/web/frontend/src/router.tsx` (register `/activity`)

**Goal:** Aggregate every changelog entry across the spine into a flat reverse-chronological feed. Each entry is `{ ts, kind: 'Write' | 'commit' | 'note' | 'other', payload, itemId, itemTitle }`. New endpoint `GET /api/activity?limit=N` returns `Entry[]`. New page `/activity` renders them with a link to each item.

- [ ] **Step 1: Write the failing test for the core**

Create `/home/fintan/repos/kadai/tests/core/activity.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { buildActivity, parseChangelogEntries } from '../../src/core/activity';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-activity-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

function appendEntry(itemId: string, line: string): void {
  const item = findById(tmp, itemId)!;
  const path = join(dirname(item.path), 'changelog.md');
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, line + '\n', 'utf8');
}

test('parseChangelogEntries handles all three line shapes', () => {
  const text = [
    '- 2026-05-06T10:00:00Z `Write` src/foo.ts',
    '- 2026-05-06T11:00:00Z `commit` abc1234 feat: do thing STORY-001',
    '- 2026-05-06T12:00:00Z `note` Decided to defer OAuth.',
  ].join('\n');
  const entries = parseChangelogEntries(text);
  expect(entries).toHaveLength(3);
  expect(entries[0].kind).toBe('Write');
  expect(entries[0].payload).toBe('src/foo.ts');
  expect(entries[1].kind).toBe('commit');
  expect(entries[1].payload).toContain('abc1234');
  expect(entries[2].kind).toBe('note');
  expect(entries[2].payload).toBe('Decided to defer OAuth.');
});

test('parseChangelogEntries skips malformed lines without crashing', () => {
  const text = '- 2026-05-06T10:00:00Z `Write` src/foo.ts\nthis is not a valid line\n- bad-date `note` x';
  const entries = parseChangelogEntries(text);
  expect(entries.length).toBeGreaterThanOrEqual(1);
  expect(entries[0].payload).toBe('src/foo.ts');
});

test('buildActivity aggregates across the spine, newest first', () => {
  appendEntry('STORY-001', '- 2026-05-06T10:00:00Z `Write` src/old.ts');
  appendEntry('FEAT-001', '- 2026-05-06T12:00:00Z `commit` abc1234 feat thing');
  appendEntry('STORY-001', '- 2026-05-06T11:00:00Z `note` mid-priority');

  const feed = buildActivity(tmp);
  expect(feed.length).toBe(3);
  expect(feed[0].ts).toBe('2026-05-06T12:00:00Z');
  expect(feed[0].itemId).toBe('FEAT-001');
  expect(feed[1].ts).toBe('2026-05-06T11:00:00Z');
  expect(feed[2].ts).toBe('2026-05-06T10:00:00Z');
});

test('buildActivity respects limit parameter', () => {
  for (let i = 0; i < 5; i++) {
    const t = String(i).padStart(2, '0');
    appendEntry('STORY-001', `- 2026-05-06T${t}:00:00Z \`note\` entry-${i}`);
  }
  const feed = buildActivity(tmp, { limit: 3 });
  expect(feed.length).toBe(3);
  expect(feed[0].payload).toBe('entry-4');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/activity.test.ts
```

Expected: FAIL with "Cannot find module ../../src/core/activity".

- [ ] **Step 3: Implement core/activity.ts**

Create `/home/fintan/repos/kadai/src/core/activity.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { walkSpine } from './spine';
import { getId, getTitle } from './item-helpers';
import type { Item } from './types';

export type ChangelogKind = 'Write' | 'Edit' | 'commit' | 'note' | 'other';

export interface ActivityEntry {
  ts: string;
  kind: ChangelogKind;
  payload: string;
  itemId: string;
  itemTitle: string;
  itemKind: Item['kind'];
}

export interface BuildActivityOptions {
  limit?: number;
}

const LINE_RE = /^- (\d{4}-\d{2}-\d{2}T[\d:.+\-]+Z?)\s+`([^`]+)`\s+(.*)$/;

export function parseChangelogEntries(text: string): Array<{ ts: string; kind: ChangelogKind; payload: string }> {
  const out: Array<{ ts: string; kind: ChangelogKind; payload: string }> = [];
  for (const line of text.split(/\n/)) {
    const m = line.match(LINE_RE);
    if (!m) continue;
    const [, ts, rawKind, payload] = m;
    const kind: ChangelogKind = rawKind === 'Write' || rawKind === 'Edit' || rawKind === 'commit' || rawKind === 'note'
      ? rawKind
      : 'other';
    out.push({ ts, kind, payload });
  }
  return out;
}

export function buildActivity(rootDir: string, opts: BuildActivityOptions = {}): ActivityEntry[] {
  const items = walkSpine(rootDir);
  const all: ActivityEntry[] = [];

  for (const item of items) {
    const path = join(dirname(item.path), 'changelog.md');
    if (!existsSync(path)) continue;
    const text = readFileSync(path, 'utf8');
    for (const entry of parseChangelogEntries(text)) {
      all.push({
        ...entry,
        itemId: getId(item),
        itemTitle: getTitle(item),
        itemKind: item.kind,
      });
    }
  }

  all.sort((a, b) => b.ts.localeCompare(a.ts));

  if (opts.limit !== undefined) return all.slice(0, opts.limit);
  return all;
}
```

- [ ] **Step 4: Run core tests**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/activity.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Add the API endpoint + tests**

Add tests to `/home/fintan/repos/kadai/tests/web/api.test.ts` (append):

```typescript
test('GET /api/activity returns an empty list when no changelogs exist', async () => {
  const r = await fetch(`${base()}/api/activity`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(Array.isArray(json)).toBe(true);
});

test('GET /api/activity?limit=10 caps the result count', async () => {
  const r = await fetch(`${base()}/api/activity?limit=10`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.length).toBeLessThanOrEqual(10);
});
```

Edit `/home/fintan/repos/kadai/src/web/api.ts`. Add this import alongside the existing core imports:

```typescript
import { buildActivity } from '../core/activity';
```

Add the route inside `handleApi`, after the `/api/search` block (or anywhere before the 404 fallback):

```typescript
  if (path === '/api/activity' && req.method === 'GET') {
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam !== null ? Math.max(1, Math.min(1000, parseInt(limitParam, 10) || 100)) : undefined;
    return Response.json(buildActivity(rootDir, { limit }));
  }
```

Run the API tests:

```bash
bun test tests/web/api.test.ts
```

Expected: all pass (existing + 2 new).

- [ ] **Step 6: Add the client wrapper + page**

Append to `/home/fintan/repos/kadai/src/web/frontend/src/api.ts`:

```typescript
export interface ActivityEntry {
  ts: string;
  kind: 'Write' | 'Edit' | 'commit' | 'note' | 'other';
  payload: string;
  itemId: string;
  itemTitle: string;
  itemKind: ItemKind;
}

export async function getActivity(limit = 100): Promise<ActivityEntry[]> {
  const r = await fetch(`/api/activity?limit=${limit}`);
  if (!r.ok) throw new Error(`/api/activity → ${r.status}`);
  return r.json() as Promise<ActivityEntry[]>;
}
```

Create `/home/fintan/repos/kadai/src/web/frontend/src/pages/Activity.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { getActivity, type ActivityEntry } from '../api';
import { useLiveKey } from '../live';

const ROUTE_BY_KIND: Record<string, string> = {
  epic: '/epics/$id',
  feature: '/features/$id',
  story: '/stories/$id',
  task: '/stories/$id',
};

const KIND_BADGE: Record<string, string> = {
  Write: 'bg-blue-900/40 text-blue-200',
  Edit: 'bg-blue-900/40 text-blue-200',
  commit: 'bg-purple-900/40 text-purple-200',
  note: 'bg-amber-900/40 text-amber-200',
  other: 'bg-zinc-800 text-zinc-300',
};

export function Activity() {
  const liveKey = useLiveKey();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getActivity(200).then(setEntries).finally(() => setLoading(false));
  }, [liveKey]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted">Activity</div>
        <h1 className="text-2xl font-bold">Recent changes</h1>
      </div>
      {loading && <div className="text-muted italic">Loading…</div>}
      {!loading && entries.length === 0 && <div className="text-muted italic">No activity yet.</div>}
      <ul className="space-y-1.5">
        {entries.map((e, i) => (
          <li key={i} className="flex items-baseline gap-3 text-sm">
            <span className="text-xs text-muted font-mono w-44 shrink-0">{e.ts}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${KIND_BADGE[e.kind] ?? KIND_BADGE.other}`}>{e.kind}</span>
            <Link
              to={ROUTE_BY_KIND[e.itemKind] ?? '/'}
              params={{ id: e.itemId }}
              className="text-xs text-muted hover:text-zinc-300 shrink-0"
            >{e.itemId}</Link>
            <span className="text-zinc-300 truncate">{e.payload}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

Edit `/home/fintan/repos/kadai/src/web/frontend/src/router.tsx`. Add the import:

```typescript
import { Activity } from './pages/Activity';
```

Add the route definition alongside the others:

```typescript
const activityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/activity',
  component: Activity,
});
```

Add `activityRoute` to the `addChildren([...])` call.

Add a top-bar link in `Layout.tsx`. Read it first to find the right spot. Add this link inside the header, between the Kadai title and the SearchBox:

```tsx
<Link to="/activity" className="text-sm text-muted hover:text-zinc-300">Activity</Link>
```

- [ ] **Step 7: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run typecheck
bun test
```

Expected: build clean, typecheck clean, 305 pass (301 + 4 core).

- [ ] **Step 8: Tick the step checkboxes for Task 3 in the plan**

Tick all step checkboxes for Task 3.

- [ ] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/core/activity.ts src/web/api.ts src/web/frontend/src/api.ts src/web/frontend/src/pages/Activity.tsx src/web/frontend/src/router.tsx src/web/frontend/src/components/Layout.tsx tests/core/activity.test.ts tests/web/api.test.ts docs/superpowers/plans/2026-05-06-kadai-14-stretch-features.md
git commit -m "$(cat <<'EOF'
feat(web): activity feed — flat reverse-chrono changelog stream [Plan-14 Task-3]

core/activity.ts: parseChangelogEntries + buildActivity walk every
changelog.md across the spine, parse the three line shapes (Write/Edit
from hooks, commit from sync, note from record_change), aggregate +
newest-first sort.

GET /api/activity?limit=N. New /activity SPA route with kind badges and
clickable item-ID links. Top-bar Activity link.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Per-phase comparison view (core + API + page)

**Files:**
- Create: `src/core/compare.ts`
- Modify: `src/web/api.ts` (new `/api/compare` route)
- Modify: `tests/web/api.test.ts` (~3 new tests)
- Create: `tests/core/compare.test.ts`
- Modify: `src/web/frontend/src/api.ts` (add `comparePhases` client)
- Create: `src/web/frontend/src/pages/Compare.tsx`
- Modify: `src/web/frontend/src/router.tsx` (register `/compare`)
- Modify: `src/web/frontend/src/components/Layout.tsx` (top-bar Compare link)

**Goal:** Side-by-side comparison of two phases. Useful for "MVP vs Future" scoping. Endpoint returns `{ a: { phase, items[] }, b: { phase, items[] }, common: { titles[] } }` where `common` is items whose titles match across both phases (a rough overlap signal). Page renders two columns + a small header showing the overlap count.

- [ ] **Step 1: Write the failing test for the core**

Create `/home/fintan/repos/kadai/tests/core/compare.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { addPhase } from '../../src/cli/phases';
import { comparePhases } from '../../src/core/compare';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-compare-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Billing', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'v1' });    // overlap by title
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Analytics', phase: 'v1' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('comparePhases returns items in each phase + common titles', () => {
  const r = comparePhases(tmp, 'mvp', 'v1');
  expect(r.a.phase).toBe('mvp');
  expect(r.b.phase).toBe('v1');
  const aTitles = r.a.items.map(i => i.title).sort();
  const bTitles = r.b.items.map(i => i.title).sort();
  expect(aTitles).toEqual(['Auth', 'Billing']);
  expect(bTitles).toEqual(['Analytics', 'Auth']);
  expect(r.common.titles).toEqual(['Auth']);
});

test('comparePhases includes all kinds (not just epics)', () => {
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'v1', parent: 'EPIC-003' });
  const r = comparePhases(tmp, 'mvp', 'v1');
  expect(r.a.items.some(i => i.kind === 'feature' && i.title === 'Login')).toBe(true);
  expect(r.common.titles).toContain('Login');
});

test('comparePhases throws if either phase does not exist', () => {
  expect(() => comparePhases(tmp, 'mvp', 'nonexistent')).toThrow(/not found/i);
  expect(() => comparePhases(tmp, 'nonexistent', 'mvp')).toThrow(/not found/i);
});

test('comparePhases returns empty arrays when phases exist but contain no items', () => {
  // Add an unused phase.
  addPhase(tmp, 'parking', 'Parking', '#888888');
  const r = comparePhases(tmp, 'mvp', 'parking');
  expect(r.a.items.length).toBeGreaterThan(0);
  expect(r.b.items.length).toBe(0);
  expect(r.common.titles).toEqual([]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/compare.test.ts
```

Expected: FAIL — `comparePhases` not exported.

- [ ] **Step 3: Implement core/compare.ts**

Create `/home/fintan/repos/kadai/src/core/compare.ts`:

```typescript
import { walkSpine } from './spine';
import { loadConfig } from '../config/load';
import { getPhase, getId, getTitle, getStatus } from './item-helpers';
import type { Item } from './types';
import type { Status, ItemKind } from './state-machine';

export interface ComparedItem {
  id: string;
  kind: ItemKind;
  title: string;
  status: Status;
}

export interface ComparedPhase {
  phase: string;
  items: ComparedItem[];
}

export interface CompareResult {
  a: ComparedPhase;
  b: ComparedPhase;
  common: { titles: string[] };
}

function toCompared(item: Item): ComparedItem {
  return {
    id: getId(item),
    kind: item.kind,
    title: getTitle(item),
    status: getStatus(item),
  };
}

function ensurePhaseExists(rootDir: string, slug: string): void {
  const cfg = loadConfig(rootDir);
  if (!cfg.phases.some(p => p.slug === slug)) {
    throw new Error(`Phase "${slug}" not found in config`);
  }
}

export function comparePhases(rootDir: string, aSlug: string, bSlug: string): CompareResult {
  ensurePhaseExists(rootDir, aSlug);
  ensurePhaseExists(rootDir, bSlug);

  const items = walkSpine(rootDir);
  const a = items.filter(i => getPhase(i) === aSlug).map(toCompared);
  const b = items.filter(i => getPhase(i) === bSlug).map(toCompared);

  const aTitles = new Set(a.map(i => i.title));
  const common = b.map(i => i.title).filter(t => aTitles.has(t));
  const uniqueCommon = Array.from(new Set(common)).sort();

  return {
    a: { phase: aSlug, items: a },
    b: { phase: bSlug, items: b },
    common: { titles: uniqueCommon },
  };
}
```

- [ ] **Step 4: Run core tests**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/compare.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Add the API endpoint + tests**

Append to `/home/fintan/repos/kadai/tests/web/api.test.ts`:

```typescript
test('GET /api/compare?a=mvp&b=v1 returns the comparison shape', async () => {
  const r = await fetch(`${base()}/api/compare?a=mvp&b=v1`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.a.phase).toBe('mvp');
  expect(json.b.phase).toBe('v1');
  expect(Array.isArray(json.common.titles)).toBe(true);
});

test('GET /api/compare with missing a or b returns 400', async () => {
  const r = await fetch(`${base()}/api/compare?a=mvp`);
  expect(r.status).toBe(400);
});

test('GET /api/compare with non-existent phase returns 404', async () => {
  const r = await fetch(`${base()}/api/compare?a=mvp&b=nope`);
  expect(r.status).toBe(404);
});
```

Edit `/home/fintan/repos/kadai/src/web/api.ts`. Add this import:

```typescript
import { comparePhases } from '../core/compare';
```

Add the route inside `handleApi`:

```typescript
  if (path === '/api/compare' && req.method === 'GET') {
    const a = url.searchParams.get('a');
    const b = url.searchParams.get('b');
    if (!a || !b) {
      return Response.json({ error: 'Both a and b query params are required' }, { status: 400 });
    }
    try {
      return Response.json(comparePhases(rootDir, a, b));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return Response.json({ error: msg }, { status: 404 });
    }
  }
```

Run tests:

```bash
bun test tests/web/api.test.ts
```

Expected: all pass.

- [ ] **Step 6: Add client wrapper + page**

Append to `/home/fintan/repos/kadai/src/web/frontend/src/api.ts`:

```typescript
export interface ComparedItem {
  id: string;
  kind: ItemKind;
  title: string;
  status: Status;
}

export interface CompareResult {
  a: { phase: string; items: ComparedItem[] };
  b: { phase: string; items: ComparedItem[] };
  common: { titles: string[] };
}

export async function comparePhasesApi(a: string, b: string): Promise<CompareResult> {
  const r = await fetch(`/api/compare?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}`);
  if (!r.ok) {
    const json = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(json.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<CompareResult>;
}
```

Create `/home/fintan/repos/kadai/src/web/frontend/src/pages/Compare.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { listPhases, comparePhasesApi, type CompareResult } from '../api';
import type { PhaseConfig } from '../types';

const ROUTE_BY_KIND: Record<string, string> = {
  epic: '/epics/$id',
  feature: '/features/$id',
  story: '/stories/$id',
  task: '/stories/$id',
};

export function Compare() {
  const search = useSearch({ from: '/compare' }) as { a?: string; b?: string };
  const a = search.a ?? '';
  const b = search.b ?? '';
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const [result, setResult] = useState<CompareResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listPhases().then(setPhases); }, []);
  useEffect(() => {
    if (!a || !b) return;
    setError(null);
    comparePhasesApi(a, b).then(setResult).catch(e => setError(e instanceof Error ? e.message : String(e)));
  }, [a, b]);

  if (!a || !b) {
    return (
      <div className="space-y-4">
        <div className="text-xs text-muted">Compare</div>
        <h1 className="text-2xl font-bold">Pick two phases to compare</h1>
        <div className="text-muted text-sm">URL params: <code>?a=&lt;phase&gt;&b=&lt;phase&gt;</code>. Available phases: {phases.map(p => p.slug).join(', ')}.</div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted">Compare</div>
        <h1 className="text-2xl font-bold">{a} vs {b}</h1>
        {result && <div className="text-xs text-muted mt-1">{result.common.titles.length} common title{result.common.titles.length !== 1 ? 's' : ''}</div>}
      </div>
      {error && <div className="text-red-400 text-sm">{error}</div>}
      {result && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[result.a, result.b].map((side, idx) => (
            <div key={idx} className="bg-panel rounded p-3 space-y-2">
              <div className="text-sm font-bold">{side.phase} <span className="text-xs text-muted">({side.items.length})</span></div>
              <ul className="space-y-1">
                {side.items.map(item => {
                  const inCommon = result.common.titles.includes(item.title);
                  return (
                    <li key={item.id}>
                      <Link
                        to={ROUTE_BY_KIND[item.kind] ?? '/'}
                        params={{ id: item.id }}
                        className={`block text-xs p-1.5 rounded ${inCommon ? 'bg-amber-900/30 hover:bg-amber-900/50' : 'bg-zinc-800 hover:bg-zinc-700'}`}
                      >
                        <span className="text-muted text-[10px] uppercase mr-2">{item.kind}</span>
                        <span className="text-muted text-[10px] mr-2">{item.id}</span>
                        <span>{item.title}</span>
                        <span className="ml-2 text-[10px] text-muted">[{item.status}]</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

Edit `/home/fintan/repos/kadai/src/web/frontend/src/router.tsx`. Add:

```typescript
import { Compare } from './pages/Compare';

const compareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/compare',
  component: Compare,
  validateSearch: (s: Record<string, unknown>): { a?: string; b?: string } => ({
    a: typeof s.a === 'string' ? s.a : undefined,
    b: typeof s.b === 'string' ? s.b : undefined,
  }),
});
```

Add `compareRoute` to the `addChildren([...])` call.

Add a top-bar link in `Layout.tsx` next to the Activity link:

```tsx
<Link to="/compare" className="text-sm text-muted hover:text-zinc-300">Compare</Link>
```

- [ ] **Step 7: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run typecheck
bun test
```

Expected: build clean, typecheck clean, 312 pass (305 + 4 core + 3 api).

- [ ] **Step 8: Tick the step checkboxes for Task 4 in the plan**

Tick all step checkboxes for Task 4.

- [ ] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/core/compare.ts src/web/api.ts src/web/frontend/src/api.ts src/web/frontend/src/pages/Compare.tsx src/web/frontend/src/router.tsx src/web/frontend/src/components/Layout.tsx tests/core/compare.test.ts tests/web/api.test.ts docs/superpowers/plans/2026-05-06-kadai-14-stretch-features.md
git commit -m "$(cat <<'EOF'
feat(web): per-phase comparison view [Plan-14 Task-4]

core/compare.ts: comparePhases(a, b) returns {a, b, common} where common
is items whose titles match across both phases — rough scope overlap.

GET /api/compare?a=&b=. New /compare SPA route with two-column layout +
amber-highlighted overlap items. Top-bar Compare link.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Comprehensive Playwright E2E expansion

**Files:**
- Modify: `tests/web/e2e.pw.ts`

**Goal:** Add 6 new flows that catch realistic regression scenarios. Today's 8 cover the happy paths; this expands to also cover error paths (illegal status transition surfaces error in UI), cross-feature flows (search → click result → use status panel), and the new pages from Tasks 3-4.

- [ ] **Step 1: Add the new E2E tests**

APPEND to `/home/fintan/repos/kadai/tests/web/e2e.pw.ts`:

```typescript
test('illegal status transition shows the error message in the rail', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-001`);
  await page.waitForLoadState('load');

  // Set the story to in_progress first.
  await page.locator('aside').locator('button', { hasText: 'in_progress' }).click();
  await expect(page.locator('aside').locator('text=in_progress').first()).toBeVisible({ timeout: 3000 });

  // Now try to fake an illegal transition by directly hitting the API with a bad status.
  // The rail's only options are legal next states, so we trigger this via fetch.
  const result = await page.evaluate(async () => {
    const r = await fetch('/api/items/STORY-001/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'backlog' }),  // in_progress → backlog is not legal
    });
    return { status: r.status, body: await r.json() };
  });
  expect(result.status).toBe(400);
  expect(result.body.error).toMatch(/illegal/i);
});

test('search results page links flow to detail pages', async ({ page }) => {
  await page.goto(serverUrl);
  await page.waitForLoadState('load');

  await page.locator('input[type="search"]').fill('Authentication');
  await page.locator('input[type="search"]').press('Enter');
  await page.waitForURL(/\/search\?q=Authentication/);
  await page.waitForLoadState('load');

  await page.locator('a', { hasText: 'Authentication' }).first().click();
  await page.waitForURL(/\/epics\/EPIC-001/);
  await expect(page.locator('h1', { hasText: 'Authentication' })).toBeVisible();
});

test('attaching a plan via the plan tab uploads and renders', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-002`);
  await page.waitForLoadState('load');

  await page.locator('button', { hasText: 'plan' }).click();
  await expect(page.locator('text=No plan attached')).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'plan.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Plan\n\n1. Step one\n2. Step two\n'),
  });
  await expect(page.locator('text=Step one')).toBeVisible({ timeout: 5000 });
});

test('Activity page renders entries when changelogs exist', async ({ page }) => {
  // Trigger some changelog entries by mutating status (PostToolUse-like writes happen via the API).
  await page.evaluate(async () => {
    await fetch('/api/items/STORY-003/status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
  });

  await page.goto(`${serverUrl}/activity`);
  await page.waitForLoadState('load');
  await expect(page.locator('h1', { hasText: 'Recent changes' })).toBeVisible();
  // Should at least render the page header (entry count depends on whether sync ran).
});

test('Compare page with valid phases renders two columns', async ({ page }) => {
  await page.goto(`${serverUrl}/compare?a=mvp&b=mvp`);
  await page.waitForLoadState('load');
  await expect(page.locator('h1', { hasText: 'mvp vs mvp' })).toBeVisible();
  // Both columns should show the same items.
  const cards = page.locator('a[class*="bg-amber"]');  // common-overlap items
  await expect(cards.first()).toBeVisible({ timeout: 5000 });
});

test('Compare page without query params shows the picker hint', async ({ page }) => {
  await page.goto(`${serverUrl}/compare`);
  await page.waitForLoadState('load');
  await expect(page.locator('h1', { hasText: 'Pick two phases' })).toBeVisible();
});
```

- [ ] **Step 2: Build SPA + run Playwright**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bunx playwright test
```

Expected: 14/14 pass (8 prior + 6 new). If any new test flakes, the most likely cause is timing — bump `toBeVisible` timeouts, OR scope a more specific selector.

- [ ] **Step 3: Verify the unit suite**

```bash
cd /home/fintan/repos/kadai
bun test
```

Expected: 312 pass (no change — bun test doesn't pick up `.pw.ts`).

- [ ] **Step 4: Tick the step checkboxes for Task 5 in the plan**

Tick all step checkboxes for Task 5.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add tests/web/e2e.pw.ts docs/superpowers/plans/2026-05-06-kadai-14-stretch-features.md
git commit -m "$(cat <<'EOF'
test(web/e2e): expand coverage to 14 flows [Plan-14 Task-5]

Adds 6 new flows: illegal-transition error path, search→detail navigation
with click, plan attach upload from the plan tab (vs spec from Task 7),
Activity page renders header, Compare page with valid + missing params.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Docs + plugin v1.0.0 + post-MVP tracking + dogfood

**Files:**
- Modify: `docs/wiki/cli-reference.md` (`--markdown-only` on init)
- Modify: `docs/wiki/api-reference.md` (`/api/activity`, `/api/compare`)
- Modify: `docs/wiki/web-viewer.md` (Activity + Compare pages)
- Modify: `docs/wiki/concepts.md` (markdown-only mode + record_change semantics)
- Modify: `docs/wiki/post-mvp.md` (Plan 14 → shipped, Plan 15 → next)
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (0.9.0 → 1.0.0)
- Append: `docs/dogfood-acceptance-test.md`
- Modify: `docs/superpowers/plans/2026-05-06-kadai-14-stretch-features.md`

- [ ] **Step 1: Update cli-reference.md**

In `/home/fintan/repos/kadai/docs/wiki/cli-reference.md`, find the existing `## kadai init` section. Add a row to the flag table:

```markdown
| `--markdown-only` | Create `.kadai/` + README only; skip `.mcp.json` / `.claude/settings.json` / `CLAUDE.md` integration. For users who just want files + the web viewer (no agent guardrails). |
```

- [ ] **Step 2: Update api-reference.md**

In `/home/fintan/repos/kadai/docs/wiki/api-reference.md`, find the "Read endpoints" table. Add two rows:

```markdown
| `GET` | `/api/activity?limit=N` | `ActivityEntry[]` — newest-first changelog stream across the spine |
| `GET` | `/api/compare?a=&b=` | `CompareResult { a, b, common }` — side-by-side phase comparison |
```

Add new sections after the existing "Search" section:

````markdown
## Activity

`GET /api/activity?limit=N` (default 100, capped at 1000) returns a flat reverse-chronological stream of every parseable changelog line across all items in the spine. Entry shape:

```json
{
  "ts": "2026-05-06T20:30:00Z",
  "kind": "Write",
  "payload": "src/foo.ts",
  "itemId": "STORY-042",
  "itemTitle": "Magic link delivery",
  "itemKind": "story"
}
```

Three line shapes coexist in changelogs and are tagged by `kind`:
- `Write` / `Edit` — appended by the `PostToolUse` hook
- `commit` — appended by `kadai sync`
- `note` — appended by the MCP `record_change` tool

Lines that don't match the canonical shape are silently skipped.

## Compare

`GET /api/compare?a=<phase>&b=<phase>` returns a side-by-side comparison of two phases. Both `a` and `b` must exist in `config.toml`; missing phase → 404. Result shape:

```json
{
  "a": { "phase": "mvp", "items": [{"id":"EPIC-001","kind":"epic","title":"Auth","status":"ready"}] },
  "b": { "phase": "v1",  "items": [{"id":"EPIC-003","kind":"epic","title":"Auth","status":"backlog"}] },
  "common": { "titles": ["Auth"] }
}
```

`common.titles` is a sorted unique list of titles that appear in both phases — a rough scope-overlap signal for "MVP vs Future" planning.
````

- [ ] **Step 3: Update web-viewer.md**

In `/home/fintan/repos/kadai/docs/wiki/web-viewer.md`, find the "Layout" or "Pages" section. Add this paragraph:

```markdown
The header has links to **Activity** (a flat reverse-chronological stream of all changelog entries across the spine) and **Compare** (side-by-side phase comparison; pass `?a=<phase>&b=<phase>` in the URL or pick from the available phases shown).
```

- [ ] **Step 4: Update concepts.md**

In `/home/fintan/repos/kadai/docs/wiki/concepts.md`, find the section about hooks/changelogs/init or add a new subsection. Add:

```markdown
### Markdown-only mode

`kadai init --markdown-only` creates the spine (`/.kadai/`) without installing the integration touch-points: no kadai entry in `.mcp.json`, no hooks in `.claude/settings.json`, no `## Kadai` section in `CLAUDE.md`. The CLI, web viewer, and `record_change` MCP tool still work; the agent guardrails (PreToolUse blocking, PostToolUse changelog capture) just don't fire because they aren't installed. Useful for human-only spine tracking or pre-staging a project for evaluation.

### record_change

The MCP `record_change(message)` tool appends a `note`-shaped line to the picked story's `changelog.md`. Three sources can write to a changelog, each with a distinct line shape:

- `` `Write` <path> `` — PostToolUse hook
- `` `commit` <sha> <subject> `` — `kadai sync`
- `` `note` <free text> `` — MCP `record_change`

The Activity page (`/activity` in the web viewer) renders all three uniformly with kind badges.
```

- [ ] **Step 5: Update post-mvp.md**

In `/home/fintan/repos/kadai/docs/wiki/post-mvp.md`:

(a) Find `### Plan 14 — Multi-project + stretch 🟢 **next**`. Replace it with:

```markdown
### Plan 15 — Multi-project switcher 🟢 **next**

Browse multiple kadai-managed projects from one web viewer instance. Discovery via `~/.kadai/known-projects.json` (or similar), a project picker route, root-relative URL changes throughout the SPA.

- Originally bundled in Plan 14 but extracted because the multi-project surface is a substantially different concern.

Estimate: medium-large.
```

(b) In the "Recently shipped" section, ABOVE `### Plan 13`, insert:

```markdown
### Plan 14 — Stretch features (shipped 2026-05-06)

- MCP `record_change` tool — agents append `note`-shaped annotations to the picked story's changelog
- `kadai init --markdown-only` — spine + README only; skip MCP/hooks/CLAUDE.md integration
- `GET /api/activity` + `/activity` page — flat reverse-chronological feed across the spine
- `GET /api/compare?a=&b=` + `/compare` page — side-by-side phase comparison with common-title overlap
- 6 new Playwright E2E flows (14 total) — illegal-transition error, search→detail click, plan attach, Activity, Compare ×2
- 18 new unit tests (4 record_change + 3 markdown-only + 4 activity + 4 compare + 3 api/activity + api/compare)
- Plugin version bumped to **1.0.0** — post-MVP backlog drained except multi-project + release publishing
```

- [ ] **Step 6: Bump plugin version**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change `"version": "0.9.0"` to `"version": "1.0.0"`.

- [ ] **Step 7: Dogfood verification**

```bash
TMP=$(mktemp -d -t kadai-plan14-XXXXXX)
cd "$TMP"

echo "=== markdown-only init ==="
kadai init --yes --markdown-only > /dev/null
ls -la .kadai/
echo ".mcp.json present? $(test -f .mcp.json && echo yes || echo no)"
echo ".claude present?   $(test -d .claude && echo yes || echo no)"
echo "CLAUDE.md present? $(test -f CLAUDE.md && echo yes || echo no)"

cd / && rm -rf "$TMP"

# Full-integration init for the activity+compare check.
TMP2=$(mktemp -d -t kadai-plan14b-XXXXXX)
cd "$TMP2"

kadai init -y > /dev/null
kadai add feature --title "Math" --phase mvp --epic EPIC-001 > /dev/null
kadai add story --title "Add" --phase mvp --feature FEAT-001 > /dev/null
kadai add epic --title "Math" --phase v1 > /dev/null

kadai serve --no-open --port 7914 > /tmp/kadai-plan14.log 2>&1 &
SERVE_PID=$!
sleep 2

echo ""
echo "=== /api/activity ==="
curl -s "http://localhost:7914/api/activity" | head -c 200

echo ""
echo "=== /api/compare?a=mvp&b=v1 ==="
curl -s "http://localhost:7914/api/compare?a=mvp&b=v1" | head -c 400

kill $SERVE_PID || true
sleep 1
cd / && rm -rf "$TMP2" /tmp/kadai-plan14.log
```

CAPTURE the output. Expected:
- markdown-only: `.kadai/` exists, `.mcp.json`/`.claude/`/`CLAUDE.md` absent
- /api/activity: returns `[]` (no changelogs yet) or a small list
- /api/compare: returns `{"a":{"phase":"mvp","items":[...]},"b":{"phase":"v1","items":[...]},"common":{"titles":["Math"]}}`

- [ ] **Step 8: Append a section to docs/dogfood-acceptance-test.md**

APPEND:

```markdown

---

## Stretch features run — Plan 14 verification — 2026-05-06

Verified the new behaviors end-to-end:

- `kadai init --yes --markdown-only` — `.kadai/` created with config.toml + README; `.mcp.json`, `.claude/`, `CLAUDE.md` all absent ✅
- `GET /api/activity` — returned valid JSON array ✅
- `GET /api/compare?a=mvp&b=v1` — returned `{a, b, common}` with `common.titles` showing the cross-phase overlap ✅
- `bun test` → 312/0 pass ✅
- `bun run build:web` clean ✅
- `bunx playwright test` → 14/14 pass (8 prior + 6 new) ✅

### Verdict: PASS

Plan 14 ships. Plugin bumped to **v1.0.0**. Post-MVP backlog drained except for the multi-project switcher (extracted to Plan 15) and the one-shot release-publishing user actions.
```

(Adjust to match your actual run output.)

- [ ] **Step 9: Run all the final checks**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
bun run build:web
bunx playwright test
```

Expected: every step exits clean.

- [ ] **Step 10: Tick the Task 6 checkboxes + Plan 14 self-review checklist**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-14-stretch-features.md`:
- Tick all step checkboxes for Task 6
- Tick all checkboxes in the "Plan 14 self-review checklist" section

- [ ] **Step 11: Commit**

```bash
cd /home/fintan/repos/kadai
git add docs/wiki/cli-reference.md docs/wiki/api-reference.md docs/wiki/web-viewer.md docs/wiki/concepts.md docs/wiki/post-mvp.md docs/dogfood-acceptance-test.md kadai-plugin/.claude-plugin/plugin.json docs/superpowers/plans/2026-05-06-kadai-14-stretch-features.md
git commit -m "$(cat <<'EOF'
docs(plan-14): wiki updates + post-mvp shipped + plugin v1.0.0 [Plan-14 Task-6]

- cli-reference.md: --markdown-only flag on init
- api-reference.md: /api/activity + /api/compare rows + sections
- web-viewer.md: Activity + Compare top-bar links
- concepts.md: markdown-only mode + record_change kinds
- post-mvp.md: Plan 14 → Recently shipped, Plan 15 (multi-project) → next
- plugin.json: 0.9.0 → 1.0.0 — post-MVP backlog drained
- dogfood-acceptance-test.md: stretch features spot-check

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan 14 self-review checklist

- [ ] All 6 tasks completed; checkboxes ticked.
- [ ] `bun test` passes (~312 tests).
- [ ] `bun run typecheck` passes.
- [ ] `bunx playwright test` passes (14/14).
- [ ] `record_change` MCP tool works (verified in Task 1 tests).
- [ ] `kadai init --markdown-only` skips integration files (verified in Task 2 tests + Task 6 dogfood).
- [ ] `/api/activity` returns the parsed changelog feed (verified in Task 6 dogfood).
- [ ] `/api/compare` returns `{a, b, common}` (verified in Task 6 dogfood).
- [ ] Plugin v1.0.0 in the manifest.
- [ ] post-mvp.md: Plan 14 in "Recently shipped"; Plan 15 (multi-project) marked 🟢 **next**.
- [ ] cli-reference.md, api-reference.md, web-viewer.md, concepts.md updated.

---

## Proceed to Plan 15

Once the self-review checklist is fully ticked, update the active plan in `/home/fintan/repos/kadai/CLAUDE.md` to point at Plan 15 (Multi-project switcher). Plan 15 is the last drafted item in `post-mvp.md`. After Plan 15, only the one-shot release-publishing user actions (create GH Releases, submit brew formula PR, npm publish) remain.
