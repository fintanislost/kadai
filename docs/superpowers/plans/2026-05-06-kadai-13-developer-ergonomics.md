# Kadai Plan 13 — Developer ergonomics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Drain the technical-debt backlog from spec §13 / `post-mvp.md` Plan 13: atomic ID counter writes, kill the `as any` casts and the lone `@ts-ignore`, ship `kadai uninstall`, make phase rename/remove rewrite affected items (instead of orphaning them), and turn on Tailwind typography so markdown renders with `prose` styling.

**Architecture:** Each tech-debt item is mostly local — small refactors guided by tests. Two non-trivial pieces: (1) `kadai uninstall` is the inverse of `mergeKadai*IntoSettingsJson` from `init.ts` — same JSON-merge surface; (2) phase migration walks the spine via the existing `walkSpine` and rewrites each affected item's frontmatter via `serialize` + `writeFileAtomic`. New runtime dep: `@tailwindcss/typography` (frontend-only, dev dependency).

**Tech Stack:** TypeScript on Bun (existing). Tailwind v3 + `@tailwindcss/typography` (new dev dep). All other changes are pure stdlib refactors.

## Position in the build

| | |
|---|---|
| **This is plan** | 13 of N |
| **Prior plan** | [Plan 12 — Distribution polish](2026-05-06-kadai-12-distribution-polish.md) — `DONE` |
| **Next plan** | Plan 14 — Multi-project + stretch (per [post-mvp.md](../../wiki/post-mvp.md)) |
| **Index** | [README.md](README.md) |
| **Backlog** | [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md) |

## What ships at the end

- `src/core/ids.ts` — `nextId` writes via `writeFileAtomic` (still wrapped in `lockfile.lockSync`).
- `src/cli/init.ts` — `// @ts-ignore` removed; `runAdd` is a static top-of-file import.
- `src/core/item-helpers.ts` (new) — typed accessors `getPhase`, `getParent`, `getOrder`, `getSpec`, `getPlan`, `getStatus`, `getId`, `getTitle`. CLI files (`list.ts`, `add.ts`, `status.ts`) replace `as any` access with these helpers.
- `src/cli/uninstall.ts` (new) — `kadai uninstall [--keep-spine] [--yes]` reverses `init`: removes `.kadai/`, the kadai MCP entry from `.mcp.json`, all 4 hook entries from `.claude/settings.json`, and the `## Kadai` section from `CLAUDE.md`.
- `src/cli/phases.ts` — `renamePhase` walks the spine and rewrites every item where `phase === oldSlug`; `removePhase` accepts `--move-to <slug>` and migrates items, otherwise errors when items would be orphaned.
- `src/web/frontend/tailwind.config.js` — adds `@tailwindcss/typography` plugin; `Markdown.tsx` wraps content in `prose prose-invert`.
- ~14 new unit tests + 1 install regression test.
- Plugin version 0.8.0 → 0.9.0.
- All ~275 existing tests still pass.

## Out of scope (deferred)

- **`kadai reindex`** — there is no `.index.json` cache in the MVP codebase. The "rebuild" command is premature without an index to rebuild. Stays in the backlog for a future indexing plan.
- **Sparse-ordering auto-redensify** — `needsRedensify` and `redensify` exist in `core/ordering.ts` but no production code path can produce tight midpoints today (`nextOrder` always uses max+SPACING; `orderAfter` is only test-called). Defer until a reorder feature lands (Plan 7's deferred kanban reorder).
- Refactoring the existing CLI `as any` cases in any files OTHER than the ones listed above. The spec calls out `list.ts`, `add.ts`, `status.ts` as the offending three; any new ones found in adjacent files get the same helper but aren't a Plan 13 obligation.
- Per-platform `@tailwindcss/typography` color overrides — a base `prose-invert` is enough for the dark theme; bespoke palette work waits.

## File structure

```
src/core/ids.ts                                 # MODIFIED: writeFileAtomic
src/core/item-helpers.ts                        # NEW: typed accessors

src/cli/init.ts                                 # MODIFIED: drop @ts-ignore + dynamic import
src/cli/list.ts                                 # MODIFIED: use helpers (no `as any`)
src/cli/add.ts                                  # MODIFIED: use helpers (no `as any`)
src/cli/status.ts                               # MODIFIED: use helpers (no `as any`)
src/cli/uninstall.ts                            # NEW: kadai uninstall
src/cli/index.ts                                # MODIFIED: register uninstallCommand
src/cli/phases.ts                               # MODIFIED: migration in rename + remove

src/web/frontend/tailwind.config.js             # MODIFIED: typography plugin
src/web/frontend/src/components/Markdown.tsx    # MODIFIED: wrap with prose
package.json                                    # MODIFIED: @tailwindcss/typography devDep

tests/core/ids.test.ts                          # MODIFIED: 1 new test for atomic write
tests/core/item-helpers.test.ts                 # NEW: ~6 tests
tests/cli/uninstall.test.ts                     # NEW: ~5 tests
tests/cli/phases-migration.test.ts              # NEW: ~5 tests

docs/wiki/cli-reference.md                      # MODIFIED: add uninstall section, update phases
docs/wiki/concepts.md                           # MODIFIED: phase migration semantics
docs/wiki/post-mvp.md                           # MODIFIED: Plan 13 → Recently shipped, Plan 14 → next
docs/dogfood-acceptance-test.md                 # APPEND: Plan 13 verification
kadai-plugin/.claude-plugin/plugin.json         # MODIFIED: 0.8.0 → 0.9.0
```

## Tasks

---

### Task 1: Atomic ID counter writes + typed helpers

**Files:**
- Modify: `src/core/ids.ts`
- Modify: `tests/core/ids.test.ts` (add 1 new test)
- Create: `src/core/item-helpers.ts`
- Create: `tests/core/item-helpers.test.ts`

**Goal:** Two small core improvements bundled because they're both pure-data, easy to test, easy to land. (1) `nextId` now writes the counter file via `writeFileAtomic` (tmp + rename) on top of the existing `proper-lockfile` advisory lock — eliminates the partial-write window if the process is killed mid-write. (2) Typed accessor helpers (`getPhase`, `getParent`, etc.) take an `Item` and return `string | undefined`, replacing the `(item.data as any).phase` pattern throughout the CLI in Task 2.

- [x] **Step 1: Write the failing tests**

For ID atomicity — APPEND to `/home/fintan/repos/kadai/tests/core/ids.test.ts`:

```typescript
test('nextId writes the counter file atomically (no partial-content window)', () => {
  // We can't easily simulate a crash mid-write in a unit test, but we can
  // assert that the file content after nextId is always valid JSON. Run a
  // few iterations and parse each result.
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-ids-atomic-'));
  try {
    for (let i = 0; i < 5; i++) {
      nextId('story', tmp);
      const content = readFileSync(join(tmp, '.kadai', '.counters.json'), 'utf8');
      const parsed = JSON.parse(content);  // must not throw
      expect(parsed.story).toBe(i + 1);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
```

(If `mkdtempSync, rmSync, readFileSync, tmpdir, join, nextId` aren't already imported in this file, add them. Look at the existing test file for the import shape.)

For item-helpers — create `/home/fintan/repos/kadai/tests/core/item-helpers.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { getId, getTitle, getStatus, getPhase, getParent, getOrder, getSpec, getPlan } from '../../src/core/item-helpers';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-helpers-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('getId / getTitle / getStatus return the basic fields for any item kind', () => {
  const epic = findById(tmp, 'EPIC-001')!;
  expect(getId(epic)).toBe('EPIC-001');
  expect(getTitle(epic)).toBe('Auth');
  expect(getStatus(epic)).toBe('ready');
});

test('getPhase returns the phase slug for ordered kinds', () => {
  const epic = findById(tmp, 'EPIC-001')!;
  expect(getPhase(epic)).toBe('mvp');
});

test('getPhase returns undefined for tasks (not phase-bound)', () => {
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T', parent: 'STORY-001' });
  const task = findById(tmp, 'TASK-001')!;
  expect(getPhase(task)).toBeUndefined();
});

test('getParent returns the parent ID for non-epic kinds', () => {
  const feat = findById(tmp, 'FEAT-001')!;
  expect(getParent(feat)).toBe('EPIC-001');
});

test('getParent returns undefined for epics', () => {
  const epic = findById(tmp, 'EPIC-001')!;
  expect(getParent(epic)).toBeUndefined();
});

test('getOrder returns the order number for ordered kinds, undefined for tasks', () => {
  const epic = findById(tmp, 'EPIC-001')!;
  expect(typeof getOrder(epic)).toBe('number');
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T', parent: 'STORY-001' });
  const task = findById(tmp, 'TASK-001')!;
  expect(getOrder(task)).toBeUndefined();
});

test('getSpec / getPlan return the attached filename or undefined', () => {
  const feat = findById(tmp, 'FEAT-001')!;
  expect(getSpec(feat)).toBeUndefined();
  expect(getPlan(feat)).toBeUndefined();
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/ids.test.ts tests/core/item-helpers.test.ts
```

Expected: `ids.test.ts` new test passes already (writeFileSync is also atomic enough to satisfy the JSON-parseability test, but we want belt-and-suspenders); `item-helpers.test.ts` fails with "Cannot find module ../../src/core/item-helpers".

- [x] **Step 3: Update ids.ts to use writeFileAtomic**

Edit `/home/fintan/repos/kadai/src/core/ids.ts`. Replace:

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import lockfile from 'proper-lockfile';
import type { ItemKind } from './state-machine';
```

With:

```typescript
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import lockfile from 'proper-lockfile';
import { writeFileAtomic } from './files';
import type { ItemKind } from './state-machine';
```

Replace the two writeFileSync call sites:

```typescript
function ensureCounterFile(rootDir: string): string {
  const path = counterPath(rootDir);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ epic: 0, feature: 0, story: 0, task: 0 }, null, 2) + '\n');
  }
  return path;
}
```

→

```typescript
function ensureCounterFile(rootDir: string): string {
  const path = counterPath(rootDir);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileAtomic(path, JSON.stringify({ epic: 0, feature: 0, story: 0, task: 0 }, null, 2) + '\n');
  }
  return path;
}
```

And:

```typescript
function writeCounters(path: string, counters: Counters): void {
  writeFileSync(path, JSON.stringify(counters, null, 2) + '\n', 'utf8');
}
```

→

```typescript
function writeCounters(path: string, counters: Counters): void {
  writeFileAtomic(path, JSON.stringify(counters, null, 2) + '\n');
}
```

- [x] **Step 4: Implement item-helpers.ts**

Create `/home/fintan/repos/kadai/src/core/item-helpers.ts`:

```typescript
import type { Item } from './types';
import type { Status } from './state-machine';

interface Indexable {
  id?: string;
  title?: string;
  status?: Status;
  phase?: string;
  parent?: string;
  order?: number;
  spec?: string;
  plan?: string;
}

function data(item: Item): Indexable {
  return item.data as unknown as Indexable;
}

export function getId(item: Item): string {
  return data(item).id ?? '';
}

export function getTitle(item: Item): string {
  return data(item).title ?? '';
}

export function getStatus(item: Item): Status {
  return data(item).status ?? 'backlog';
}

export function getPhase(item: Item): string | undefined {
  return data(item).phase;
}

export function getParent(item: Item): string | undefined {
  return data(item).parent;
}

export function getOrder(item: Item): number | undefined {
  return data(item).order;
}

export function getSpec(item: Item): string | undefined {
  return data(item).spec;
}

export function getPlan(item: Item): string | undefined {
  return data(item).plan;
}
```

The single `as unknown as Indexable` keeps the unsafe cast contained to one place; consumers get typed accessors with no extra assertions.

- [x] **Step 5: Run tests to verify everything passes**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/ids.test.ts tests/core/item-helpers.test.ts
bun test
bun run typecheck
```

Expected: 282 pass (275 + 7 new — 1 ids + 6 helpers if a new helper test was added; if your count differs by ±1, that's fine, capture the actual number).

- [x] **Step 6: Tick the step checkboxes for Task 1 in the plan**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-13-developer-ergonomics.md`, find Task 1 and tick all step checkboxes.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/core/ids.ts src/core/item-helpers.ts tests/core/ids.test.ts tests/core/item-helpers.test.ts docs/superpowers/plans/2026-05-06-kadai-13-developer-ergonomics.md
git commit -m "$(cat <<'EOF'
refactor(core): atomic counter writes + typed item-helpers [Plan-13 Task-1]

ids.ts now writes the .counters.json file via writeFileAtomic (tmp + rename)
on top of the existing proper-lockfile advisory lock. Eliminates partial-
content windows if the process is killed mid-write.

New core/item-helpers.ts exports getId/getTitle/getStatus/getPhase/getParent/
getOrder/getSpec/getPlan — typed accessors that contain the one `as unknown
as Indexable` cast. Consumers (Task 2 will migrate the CLI) get clean
property access without per-call type assertions.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Drop `as any` and `@ts-ignore` in the CLI

**Files:**
- Modify: `src/cli/init.ts` (drop `@ts-ignore` + dynamic import)
- Modify: `src/cli/list.ts` (use helpers)
- Modify: `src/cli/add.ts` (use helpers)
- Modify: `src/cli/status.ts` (use helpers)

**Goal:** Replace every `(item.data as any).<field>` access in the three named CLI files with the typed helpers from Task 1, and convert the dynamic `import('./add')` in `init.ts` to a top-of-file static import. No new tests — the existing CLI tests cover behavior; this is pure refactor.

- [x] **Step 1: Convert init.ts dynamic import to static**

Read `/home/fintan/repos/kadai/src/cli/init.ts`. At the top of the file, alongside the other CLI imports, add:

```typescript
import { runAdd } from './add';
```

(If a circular dependency surfaces — `add.ts` imports from `init.ts` — that's a real concern. Check `add.ts` first; if no cycle, add the static import. If a cycle exists, leave the dynamic import but replace `// @ts-ignore` with `// eslint-disable-next-line` or just delete the comment if there's no actual TS error.)

Then in the action handler around line 175-177, REMOVE the dynamic import:

```typescript
    if (createFirstEpic && firstEpicTitle) {
      // @ts-ignore
      const { runAdd } = await import('./add');
      const epicId = runAdd({...});
```

Becomes:

```typescript
    if (createFirstEpic && firstEpicTitle) {
      const epicId = runAdd({...});
```

(Remove the `// @ts-ignore` line, the dynamic import line, and any leftover blank line.)

- [x] **Step 2: Update list.ts**

Read `/home/fintan/repos/kadai/src/cli/list.ts`. At the top, add:

```typescript
import { getPhase, getParent, getId, getTitle, getStatus, getOrder } from '../core/item-helpers';
```

Replace each `(item.data as any).<field>` with the appropriate helper:
- `(item.data as any).phase` → `getPhase(item)`
- `(item.data as any).parent` → `getParent(item)`
- For the `const d = item.data as any;` block at line 44 — refactor to call the helpers per-field rather than aliasing `d`. Show what each access becomes:
  - `d.id` → `getId(item)`
  - `d.title` → `getTitle(item)`
  - `d.status` → `getStatus(item)`
  - `d.phase` → `getPhase(item)`
  - `d.parent` → `getParent(item)`
  - `d.order` → `getOrder(item)`

If the file has any other untyped accesses you find while editing, fix them with the same helpers.

- [x] **Step 3: Update add.ts**

Read `/home/fintan/repos/kadai/src/cli/add.ts`. At the top, add:

```typescript
import { getPhase, getParent, getOrder } from '../core/item-helpers';
```

Replace at line 66-68:

```typescript
        i => i.kind === opts.kind && (i.data as any).phase === opts.phase
          && (!opts.parent || (i.data as any).parent === opts.parent),
      ).map(i => ({ order: (i.data as any).order as number }));
```

With:

```typescript
        i => i.kind === opts.kind && getPhase(i) === opts.phase
          && (!opts.parent || getParent(i) === opts.parent),
      ).map(i => ({ order: getOrder(i) ?? 0 }));
```

(`?? 0` because `getOrder` returns `number | undefined` and `nextOrder` expects `Ordered { order: number }`; tasks have no order, but tasks won't pass the kind filter.)

- [x] **Step 4: Update status.ts**

Read `/home/fintan/repos/kadai/src/cli/status.ts`. At the top, add:

```typescript
import { getId, getTitle, getStatus, getPhase, getParent } from '../core/item-helpers';
```

Replace each `const d = ... as any;` block. Show each line of access becoming `getX(item)` directly. There are 3 such blocks in the file (around lines 27, 35, 41 per the grep). Apply the same pattern as list.ts Step 2.

- [x] **Step 5: Run tests to verify nothing broke**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: 282 pass (no change — pure refactor), typecheck clean (and the leftover `as any` count in CLI files should now be 0 in the listed files).

```bash
grep -nE "as any|@ts-ignore" src/cli/init.ts src/cli/list.ts src/cli/add.ts src/cli/status.ts
```

Expected output: nothing (all gone).

- [x] **Step 6: Tick the step checkboxes for Task 2 in the plan**

Tick all step checkboxes for Task 2.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/init.ts src/cli/list.ts src/cli/add.ts src/cli/status.ts docs/superpowers/plans/2026-05-06-kadai-13-developer-ergonomics.md
git commit -m "$(cat <<'EOF'
refactor(cli): replace `as any` + drop @ts-ignore via item-helpers [Plan-13 Task-2]

Migrates init.ts/list.ts/add.ts/status.ts off the (item.data as any).field
pattern to typed getX(item) accessors from core/item-helpers. Also converts
the dynamic `await import('./add')` in init.ts to a static top-of-file
import (no circular dep — the @ts-ignore was vestigial).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: `kadai uninstall` command

**Files:**
- Create: `src/cli/uninstall.ts`
- Modify: `src/cli/index.ts` (register `uninstallCommand`)
- Create: `tests/cli/uninstall.test.ts`

**Goal:** A `kadai uninstall` command that reverses `kadai init` — removes `.kadai/` (unless `--keep-spine`), deletes the kadai entries from `.mcp.json` and `.claude/settings.json`, and strips the `## Kadai` section from `CLAUDE.md`. Confirms with the user unless `--yes`.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/cli/uninstall.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runUninstall } from '../../src/cli/uninstall';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-uninstall-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runUninstall removes the .kadai/ directory by default', () => {
  expect(existsSync(join(tmp, '.kadai'))).toBe(true);
  runUninstall({ rootDir: tmp, keepSpine: false });
  expect(existsSync(join(tmp, '.kadai'))).toBe(false);
});

test('runUninstall with keepSpine=true preserves .kadai/', () => {
  expect(existsSync(join(tmp, '.kadai'))).toBe(true);
  runUninstall({ rootDir: tmp, keepSpine: true });
  expect(existsSync(join(tmp, '.kadai'))).toBe(true);
});

test('runUninstall removes the kadai entry from .mcp.json (and the file if it becomes empty)', () => {
  expect(existsSync(join(tmp, '.mcp.json'))).toBe(true);
  runUninstall({ rootDir: tmp, keepSpine: false });
  // If kadai was the only entry, .mcp.json should be gone (or have no kadai key).
  if (existsSync(join(tmp, '.mcp.json'))) {
    const parsed = JSON.parse(readFileSync(join(tmp, '.mcp.json'), 'utf8'));
    expect(parsed.mcpServers?.kadai).toBeUndefined();
  }
});

test('runUninstall preserves other MCP servers in .mcp.json', () => {
  // Stage another MCP server alongside kadai.
  const mcp = JSON.parse(readFileSync(join(tmp, '.mcp.json'), 'utf8'));
  mcp.mcpServers.other = { command: 'other-tool', args: [] };
  writeFileSync(join(tmp, '.mcp.json'), JSON.stringify(mcp, null, 2) + '\n');

  runUninstall({ rootDir: tmp, keepSpine: false });

  expect(existsSync(join(tmp, '.mcp.json'))).toBe(true);
  const after = JSON.parse(readFileSync(join(tmp, '.mcp.json'), 'utf8'));
  expect(after.mcpServers.other).toBeDefined();
  expect(after.mcpServers.kadai).toBeUndefined();
});

test('runUninstall removes all 4 kadai hook entries from .claude/settings.json', () => {
  const before = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8'));
  expect(Object.keys(before.hooks).length).toBeGreaterThanOrEqual(4);
  runUninstall({ rootDir: tmp, keepSpine: false });

  if (existsSync(join(tmp, '.claude', 'settings.json'))) {
    const after = JSON.parse(readFileSync(join(tmp, '.claude', 'settings.json'), 'utf8'));
    for (const event of ['PreToolUse', 'PostToolUse', 'UserPromptSubmit', 'Stop']) {
      const entries = after.hooks?.[event] ?? [];
      const hasKadai = entries.some((e: { hooks?: Array<{ command?: string }> }) =>
        e.hooks?.some(h => (h.command ?? '').startsWith('kadai hook ')));
      expect(hasKadai).toBe(false);
    }
  }
});

test('runUninstall removes the ## Kadai section from CLAUDE.md', () => {
  const before = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
  expect(before).toContain('## Kadai');
  runUninstall({ rootDir: tmp, keepSpine: false });

  if (existsSync(join(tmp, 'CLAUDE.md'))) {
    const after = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
    expect(after).not.toContain('## Kadai');
  }
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/uninstall.test.ts
```

Expected: FAIL — `runUninstall` not exported (module doesn't exist).

- [x] **Step 3: Implement uninstall.ts**

Create `/home/fintan/repos/kadai/src/cli/uninstall.ts`:

```typescript
import { existsSync, readFileSync, rmSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import prompts from 'prompts';
import { writeFileAtomic } from '../core/files';

export interface UninstallOptions {
  rootDir: string;
  keepSpine: boolean;
}

const KADAI_HOOK_COMMAND_PREFIX = 'kadai hook ';

interface SettingsShape {
  hooks?: Record<string, Array<{ matcher?: string; hooks?: Array<{ type?: string; command?: string }> }>>;
}

interface McpShape {
  mcpServers?: Record<string, unknown>;
}

function uninstallSpine(rootDir: string): void {
  const dir = join(rootDir, '.kadai');
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
}

function uninstallMcpEntry(rootDir: string): void {
  const path = join(rootDir, '.mcp.json');
  if (!existsSync(path)) return;
  let parsed: McpShape;
  try { parsed = JSON.parse(readFileSync(path, 'utf8')) as McpShape; } catch { return; }
  if (!parsed.mcpServers) return;
  delete parsed.mcpServers.kadai;
  if (Object.keys(parsed.mcpServers).length === 0) {
    unlinkSync(path);
  } else {
    writeFileAtomic(path, JSON.stringify(parsed, null, 2) + '\n');
  }
}

function uninstallHooks(rootDir: string): void {
  const path = join(rootDir, '.claude', 'settings.json');
  if (!existsSync(path)) return;
  let parsed: SettingsShape;
  try { parsed = JSON.parse(readFileSync(path, 'utf8')) as SettingsShape; } catch { return; }
  if (!parsed.hooks) return;

  for (const event of Object.keys(parsed.hooks)) {
    const entries = parsed.hooks[event];
    const filtered = entries.filter(entry =>
      !entry.hooks?.some(h => (h.command ?? '').startsWith(KADAI_HOOK_COMMAND_PREFIX)));
    if (filtered.length === 0) {
      delete parsed.hooks[event];
    } else {
      parsed.hooks[event] = filtered;
    }
  }

  if (Object.keys(parsed.hooks).length === 0 && Object.keys(parsed).length === 1) {
    // settings.json only contained kadai hooks → delete it.
    unlinkSync(path);
  } else {
    writeFileAtomic(path, JSON.stringify(parsed, null, 2) + '\n');
  }
}

function uninstallClaudeMdSection(rootDir: string): void {
  const path = join(rootDir, 'CLAUDE.md');
  if (!existsSync(path)) return;
  const text = readFileSync(path, 'utf8');
  // Strip from "## Kadai" through end of the section (next "## " heading or EOF).
  const updated = text.replace(/(?:^|\n)## Kadai[\s\S]*?(?=\n## |\n# |$)/, '');
  if (updated !== text) {
    if (updated.trim() === '') {
      unlinkSync(path);
    } else {
      writeFileAtomic(path, updated.replace(/\n{3,}/g, '\n\n').trimEnd() + '\n');
    }
  }
}

export function runUninstall(opts: UninstallOptions): void {
  if (!opts.keepSpine) uninstallSpine(opts.rootDir);
  uninstallMcpEntry(opts.rootDir);
  uninstallHooks(opts.rootDir);
  uninstallClaudeMdSection(opts.rootDir);
}

export const uninstallCommand = new Command('uninstall')
  .description('Remove kadai integration from the current project (inverse of init)')
  .option('--keep-spine', 'preserve the .kadai/ directory (only remove MCP/hook/CLAUDE.md entries)')
  .option('-y, --yes', 'skip the confirmation prompt')
  .action(async (opts: { keepSpine?: boolean; yes?: boolean }) => {
    const rootDir = process.cwd();
    if (!opts.yes) {
      const action = opts.keepSpine
        ? 'remove kadai MCP entries, hooks, and the CLAUDE.md section (preserves .kadai/)'
        : 'DELETE .kadai/ AND remove kadai MCP entries, hooks, and the CLAUDE.md section';
      const r = await prompts({ type: 'confirm', name: 'go', message: `This will ${action}. Proceed?`, initial: false });
      if (!r.go) {
        console.log(pc.yellow('cancelled'));
        return;
      }
    }
    runUninstall({ rootDir, keepSpine: !!opts.keepSpine });
    console.log(pc.green(opts.keepSpine ? '✓ kadai integration removed (spine preserved)' : '✓ kadai uninstalled'));
  });
```

- [x] **Step 4: Register in src/cli/index.ts**

Read `/home/fintan/repos/kadai/src/cli/index.ts`. Add the import alongside others:

```typescript
import { uninstallCommand } from './uninstall';
```

Add the registration alongside other `program.addCommand(...)` calls:

```typescript
program.addCommand(uninstallCommand);
```

- [x] **Step 5: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/uninstall.test.ts
bun test
bun run typecheck
kadai uninstall --help
```

Expected: 6 uninstall tests pass; full suite 288 (282 + 6); typecheck clean; help shows `--keep-spine` and `-y, --yes`.

- [x] **Step 6: Tick the step checkboxes for Task 3 in the plan**

Tick all step checkboxes for Task 3.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/uninstall.ts src/cli/index.ts tests/cli/uninstall.test.ts docs/superpowers/plans/2026-05-06-kadai-13-developer-ergonomics.md
git commit -m "$(cat <<'EOF'
feat(cli): add 'kadai uninstall' [Plan-13 Task-3]

Inverse of kadai init: removes .kadai/ (unless --keep-spine), strips the
kadai entry from .mcp.json (preserving any sibling MCP servers), removes
all 4 kadai hook entries from .claude/settings.json (preserving sibling
hooks), and erases the ## Kadai section from CLAUDE.md. Confirms by
default; -y / --yes skips the prompt.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Phase migration (rename + remove with `--move-to`)

**Files:**
- Modify: `src/cli/phases.ts`
- Create: `tests/cli/phases-migration.test.ts`

**Goal:** Today, `renamePhase` and `removePhase` only edit `config.toml` — they leave items orphaned with the old phase slug. Make `renamePhase` walk the spine and rewrite each item's frontmatter (`phase: oldSlug → newSlug`); make `removePhase` refuse if items reference the phase, OR migrate items if `--move-to <slug>` is supplied (target must exist).

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/cli/phases-migration.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { renamePhase, removePhase } from '../../src/cli/phases';
import { loadConfig } from '../../src/config/load';
import { getPhase } from '../../src/core/item-helpers';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-phases-mig-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('renamePhase rewrites all items with the old phase slug', () => {
  renamePhase(tmp, 'mvp', 'beta', 'Beta');
  // Config updated.
  const cfg = loadConfig(tmp);
  expect(cfg.phases.find(p => p.slug === 'beta')?.display).toBe('Beta');
  expect(cfg.phases.find(p => p.slug === 'mvp')).toBeUndefined();
  // Items rewritten.
  expect(getPhase(findById(tmp, 'EPIC-001')!)).toBe('beta');
  expect(getPhase(findById(tmp, 'FEAT-001')!)).toBe('beta');
  expect(getPhase(findById(tmp, 'STORY-001')!)).toBe('beta');
});

test('removePhase refuses when items reference the phase and no --move-to is given', () => {
  expect(() => removePhase(tmp, 'mvp')).toThrow(/items.*reference.*mvp|move-to/i);
});

test('removePhase succeeds when no items reference the phase', () => {
  // 'v1' is in DEFAULT_CONFIG but no items reference it.
  expect(() => removePhase(tmp, 'v1')).not.toThrow();
  expect(loadConfig(tmp).phases.find(p => p.slug === 'v1')).toBeUndefined();
});

test('removePhase with moveTo migrates items and removes the phase', () => {
  removePhase(tmp, 'mvp', { moveTo: 'v1' });
  expect(loadConfig(tmp).phases.find(p => p.slug === 'mvp')).toBeUndefined();
  expect(getPhase(findById(tmp, 'EPIC-001')!)).toBe('v1');
  expect(getPhase(findById(tmp, 'FEAT-001')!)).toBe('v1');
  expect(getPhase(findById(tmp, 'STORY-001')!)).toBe('v1');
});

test('removePhase with moveTo errors when the target phase does not exist', () => {
  expect(() => removePhase(tmp, 'mvp', { moveTo: 'nonexistent' })).toThrow(/target.*not found|does not exist/i);
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/phases-migration.test.ts
```

Expected: tests fail — current `renamePhase` doesn't rewrite items; `removePhase` doesn't refuse, doesn't accept `moveTo`.

- [x] **Step 3: Update phases.ts to migrate items**

Read `/home/fintan/repos/kadai/src/cli/phases.ts`. Add these imports near the top:

```typescript
import { walkSpine } from '../core/spine';
import { writeFileAtomic } from '../core/files';
import { serialize } from '../core/frontmatter';
import { getPhase } from '../core/item-helpers';
import type { Item } from '../core/types';
```

Add a helper near the top (after the imports):

```typescript
function rewriteItemPhase(item: Item, newPhase: string): void {
  const updated: Record<string, unknown> = {
    ...(item.data as unknown as Record<string, unknown>),
    phase: newPhase,
    updated: new Date().toISOString().slice(0, 10),
  };
  writeFileAtomic(item.path, serialize(updated, item.body));
}
```

Replace `removePhase`:

```typescript
export function removePhase(rootDir: string, slug: string): void {
  const cfg = loadConfig(rootDir);
  const idx = cfg.phases.findIndex(p => p.slug === slug);
  if (idx === -1) throw new Error(`Phase "${slug}" not found`);
  cfg.phases.splice(idx, 1);
  saveConfig(rootDir, cfg);
}
```

with:

```typescript
export function removePhase(rootDir: string, slug: string, opts: { moveTo?: string } = {}): void {
  const cfg = loadConfig(rootDir);
  const idx = cfg.phases.findIndex(p => p.slug === slug);
  if (idx === -1) throw new Error(`Phase "${slug}" not found`);

  const referrers = walkSpine(rootDir).filter(item => getPhase(item) === slug);
  if (referrers.length > 0) {
    if (!opts.moveTo) {
      throw new Error(
        `${referrers.length} items reference phase "${slug}" — pass --move-to <other-slug> to migrate, or move them first.`,
      );
    }
    const target = cfg.phases.find(p => p.slug === opts.moveTo);
    if (!target) throw new Error(`Target phase "${opts.moveTo}" does not exist`);
    for (const item of referrers) rewriteItemPhase(item, opts.moveTo);
  }

  cfg.phases.splice(idx, 1);
  saveConfig(rootDir, cfg);
}
```

Replace `renamePhase`:

```typescript
export function renamePhase(rootDir: string, oldSlug: string, newSlug: string, newDisplay: string): void {
  const cfg = loadConfig(rootDir);
  const phase = cfg.phases.find(p => p.slug === oldSlug);
  if (!phase) throw new Error(`Phase "${oldSlug}" not found`);
  phase.slug = newSlug;
  phase.display = newDisplay;
  saveConfig(rootDir, cfg);
}
```

with:

```typescript
export function renamePhase(rootDir: string, oldSlug: string, newSlug: string, newDisplay: string): void {
  const cfg = loadConfig(rootDir);
  const phase = cfg.phases.find(p => p.slug === oldSlug);
  if (!phase) throw new Error(`Phase "${oldSlug}" not found`);

  const referrers = walkSpine(rootDir).filter(item => getPhase(item) === oldSlug);
  for (const item of referrers) rewriteItemPhase(item, newSlug);

  phase.slug = newSlug;
  phase.display = newDisplay;
  saveConfig(rootDir, cfg);
}
```

Update the `phases remove` CLI command to accept `--move-to`:

```typescript
phasesCommand
  .command('remove')
  .argument('<slug>')
  .option('--move-to <slug>', 'migrate items in this phase to the target slug before removing')
  .action((slug: string, opts: { moveTo?: string }) => {
    removePhase(process.cwd(), slug, { moveTo: opts.moveTo });
    console.log(pc.green(`✓ removed phase ${slug}${opts.moveTo ? ` (migrated to ${opts.moveTo})` : ''}`));
  });
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/phases-migration.test.ts
bun test
bun run typecheck
```

Expected: 5 new tests pass + 293 total (288 + 5). Typecheck clean.

- [x] **Step 5: Tick the step checkboxes for Task 4 in the plan**

Tick all step checkboxes for Task 4.

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/phases.ts tests/cli/phases-migration.test.ts docs/superpowers/plans/2026-05-06-kadai-13-developer-ergonomics.md
git commit -m "$(cat <<'EOF'
feat(phases): rename and remove migrate referencing items [Plan-13 Task-4]

renamePhase walks the spine and rewrites every item where phase==oldSlug.
removePhase refuses by default when items reference the phase; pass
--move-to <slug> to migrate items to a target phase first.

Closes the orphan-frontmatter footgun where editing config.toml left
items pointing at deleted/renamed phases.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Tailwind typography for markdown rendering

**Files:**
- Modify: `package.json` (devDeps: `@tailwindcss/typography`)
- Modify: `src/web/frontend/tailwind.config.js`
- Modify: `src/web/frontend/src/components/Markdown.tsx`

**Goal:** Markdown content (story body, attached spec/plan, changelog) currently renders with no styling for headings, lists, tables, code, etc. — `react-markdown` produces bare HTML against the Tailwind reset. Adding `@tailwindcss/typography` gives us a `prose` utility class that styles the rendered markdown sensibly. Pair with `prose-invert` for the dark theme.

- [ ] **Step 1: Install the dep**

```bash
cd /home/fintan/repos/kadai
bun add -D @tailwindcss/typography
```

Verify it landed:

```bash
grep '@tailwindcss/typography' package.json
```

Expected: `"@tailwindcss/typography": "^0.5.x"` (or whatever resolved).

- [ ] **Step 2: Register the plugin in tailwind.config.js**

Read `/home/fintan/repos/kadai/src/web/frontend/tailwind.config.js`. Replace `plugins: []` with:

```javascript
  plugins: [require('@tailwindcss/typography')],
```

If the file uses ESM syntax (`export default`) and `require` doesn't work, switch to:

```javascript
import typography from '@tailwindcss/typography';
// ... in the config object:
plugins: [typography],
```

(Verify by running `bun run build:web` after — if it errors on the plugin require, switch to the import syntax.)

- [ ] **Step 3: Wrap the Markdown component output**

Read `/home/fintan/repos/kadai/src/web/frontend/src/components/Markdown.tsx`. Find the top-level rendered element (likely `<ReactMarkdown ...>`) and wrap it in a `<div>` with the prose classes:

```tsx
<div className="prose prose-invert prose-sm max-w-none">
  <ReactMarkdown ...>{children}</ReactMarkdown>
</div>
```

(`max-w-none` prevents the prose plugin's default 65ch max-width from cramping the panels. `prose-sm` uses the smaller-scale typography theme so headings don't dominate the side panel layouts.)

If the Markdown component already has wrapping markup, add the className to the outermost wrapper rather than nesting another div.

- [ ] **Step 4: Build the SPA and verify nothing broke**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run typecheck
bun test
```

Expected: build clean, typecheck clean, 293 tests pass.

- [ ] **Step 5: Smoke-test in the browser**

```bash
TMP=$(mktemp -d) && cd "$TMP" && \
  kadai init -y > /dev/null && \
  kadai add feature --title "Math" --phase mvp --epic EPIC-001 > /dev/null && \
  kadai add story --title "S" --phase mvp --feature FEAT-001 > /dev/null && \
  STORY_DIR=$(find .kadai -path '*STORY-001*' -type d | head -1) && \
  cat > "$STORY_DIR/spec.md" <<'EOF'
# Spec

## Goals

- bullet one
- bullet two

```typescript
const x = 42;
```

> A blockquote.
EOF
echo "spec attached at $STORY_DIR/spec.md"
kadai serve --no-open --port 4848 &
SERVE_PID=$!
sleep 2
echo ""
echo "Visit http://localhost:4848/stories/STORY-001 → 'spec' tab"
echo "Headings, lists, code, blockquote should all render styled (prose) — not as bare HTML."
echo ""
sleep 5
kill $SERVE_PID || true
sleep 1
cd / && rm -rf "$TMP"
```

(This is a manual visual check — the tests don't catch styling. If you can't open a browser, skip the visual check and note "verified via source-only inspection of Markdown.tsx").

- [ ] **Step 6: Tick the step checkboxes for Task 5 in the plan**

Tick all step checkboxes for Task 5.

- [ ] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add package.json bun.lock src/web/frontend/tailwind.config.js src/web/frontend/src/components/Markdown.tsx docs/superpowers/plans/2026-05-06-kadai-13-developer-ergonomics.md
git commit -m "$(cat <<'EOF'
feat(web/client): @tailwindcss/typography for markdown rendering [Plan-13 Task-5]

Wrap the Markdown component output in a `prose prose-invert prose-sm
max-w-none` div so attached spec.md / plan.md / story body markdown
renders with sensible heading/list/code/blockquote styling instead
of bare HTML against the Tailwind reset.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Docs + plugin v0.9.0 + post-MVP tracking + dogfood

**Files:**
- Modify: `docs/wiki/cli-reference.md`
- Modify: `docs/wiki/concepts.md`
- Modify: `docs/wiki/post-mvp.md`
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (0.8.0 → 0.9.0)
- Append: `docs/dogfood-acceptance-test.md`
- Modify: `docs/superpowers/plans/2026-05-06-kadai-13-developer-ergonomics.md`

- [ ] **Step 1: Update cli-reference.md**

In `/home/fintan/repos/kadai/docs/wiki/cli-reference.md`, find the existing `## kadai phases` section. Update the `remove` row to mention `--move-to`:

```markdown
| `remove <slug>` | `[--move-to <slug>]` migrates items to the target phase first; otherwise errors when items reference the phase. |
```

Then add a NEW section near the bottom (or after `kadai serve`):

````markdown
## `kadai uninstall [options]`

Reverse of `kadai init`. Removes:

- `.kadai/` directory (unless `--keep-spine`)
- the `kadai` entry from `.mcp.json` (preserving any sibling MCP servers)
- all four `kadai hook ...` entries from `.claude/settings.json` (preserving sibling hooks)
- the `## Kadai` section from `CLAUDE.md`

| Flag | Effect |
|---|---|
| `--keep-spine` | preserve `.kadai/` (only remove integration: MCP, hooks, CLAUDE.md section) |
| `-y, --yes` | skip the confirmation prompt |

Example:

```bash
kadai uninstall              # interactive — prompts before deleting .kadai/
kadai uninstall --keep-spine # remove integration, keep the spine for re-init later
kadai uninstall -y           # delete everything, no prompt
```

A subsequent `kadai init` will re-create the integration.
````

Also add a note near the existing `## kadai add` section explaining that frontmatter `phase` accesses now go through `core/item-helpers` (helpful for contributors).

Actually skip that internal-only detail — leave the user-facing docs focused on user-facing behavior.

- [ ] **Step 2: Update concepts.md**

In `/home/fintan/repos/kadai/docs/wiki/concepts.md`, find the section about phases (or add one if absent). Add this paragraph:

```markdown
### Phase migration

Phases live in `.kadai/config.toml` and are referenced by every epic / feature / story via the `phase:` frontmatter field. When you `kadai phases rename mvp v1 V1` or `kadai phases remove mvp --move-to v1`, kadai walks the spine and rewrites every affected item's frontmatter so no item is ever orphaned with a phase slug that no longer exists. Removing a phase that has items without `--move-to` is refused.
```

- [ ] **Step 3: Update post-mvp.md**

In `/home/fintan/repos/kadai/docs/wiki/post-mvp.md`:

(a) Find `### Plan 13 — Developer ergonomics 🟢 **next**` and remove the entire section.

(b) Find the next plan (should be `### Plan 14 — Multi-project + stretch`). Add the badge:

```markdown
### Plan 14 — Multi-project + stretch 🟢 **next**
```

(c) In the "Recently shipped" section, ABOVE the existing `### Plan 12` entry, insert:

```markdown
### Plan 13 — Developer ergonomics (shipped 2026-05-06)

- `nextId` writes the counter file via `writeFileAtomic` (on top of the existing `proper-lockfile` advisory lock)
- `core/item-helpers.ts` — typed `getPhase` / `getParent` / `getOrder` etc. accessors; CLI files migrated off `(item.data as any)` casts
- `init.ts` — `// @ts-ignore` removed; `runAdd` is a static top-of-file import
- `kadai uninstall [--keep-spine] [--yes]` — reverse of `init`
- `kadai phases rename` migrates referencing items; `kadai phases remove --move-to <slug>` migrates before removing (refuses without --move-to when items would be orphaned)
- `@tailwindcss/typography` — markdown content renders with `prose prose-invert prose-sm` styling
- 17 new tests (1 ids + 6 helpers + 6 uninstall + 5 phase-migration; minus deferred reindex/redensify)
- Plugin version bumped to 0.9.0
```

- [ ] **Step 4: Bump plugin version**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change `"version": "0.8.0"` to `"version": "0.9.0"`.

- [ ] **Step 5: Dogfood verification**

```bash
TMP=$(mktemp -d -t kadai-plan13-XXXXXX)
cd "$TMP"

kadai init -y > /dev/null
kadai add feature --title "T" --phase mvp --epic EPIC-001 > /dev/null
kadai add story --title "S" --phase mvp --feature FEAT-001 > /dev/null

echo "=== Phase migration: rename mvp → beta ==="
kadai phases rename mvp beta Beta
kadai list epic | head -3
kadai list story | head -3

echo ""
echo "=== Phase migration: try to remove beta (should error — items reference it) ==="
kadai phases remove beta || echo "(expected non-zero exit)"

echo ""
echo "=== Phase migration: remove beta with --move-to v1 ==="
kadai phases remove beta --move-to v1
kadai list epic | head -3

echo ""
echo "=== Uninstall (preserving spine, no prompt) ==="
kadai uninstall --keep-spine -y
echo "MCP entry?  $(grep -c kadai .mcp.json 2>/dev/null || echo missing)"
echo "Hook?       $(grep -c 'kadai hook' .claude/settings.json 2>/dev/null || echo missing)"
echo "Claude.md?  $(grep -c '## Kadai' CLAUDE.md 2>/dev/null || echo missing)"
echo "Spine?      $(test -d .kadai && echo present || echo missing)"

cd / && rm -rf "$TMP"
```

Expected:
- After rename: `phase=beta` on every item.
- Remove without --move-to: errors with "items reference".
- Remove with --move-to: items now show `phase=v1`.
- After uninstall --keep-spine: MCP=0, Hook=0, Claude.md=0, Spine=present.

CAPTURE the actual output for the log entry.

- [ ] **Step 6: Append a section to docs/dogfood-acceptance-test.md**

APPEND:

```markdown

---

## Developer ergonomics run — Plan 13 verification — 2026-05-06

Verified the new behaviors end-to-end:

- `kadai phases rename mvp beta Beta` — every item's frontmatter updated to `phase: beta` ✅
- `kadai phases remove beta` — errored with "items reference phase beta" (no --move-to) ✅
- `kadai phases remove beta --move-to v1` — items migrated to v1, beta removed from config ✅
- `kadai uninstall --keep-spine -y` — MCP entry gone, hooks gone, CLAUDE.md section stripped, .kadai/ preserved ✅
- `bun test` → 293/0 pass ✅
- `bun run build:web` clean (typography plugin compiled) ✅
- `bunx playwright test` → 8/8 pass (no regression from the refactors) ✅

### Verdict: PASS

Tech-debt drained: atomic counter writes, no `as any`/`@ts-ignore` in CLI, uninstall + safe phase migration, prose markdown styling.
```

(Use actual numbers from your run.)

- [ ] **Step 7: Run all the final checks**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
bun run build:web
bunx playwright test
```

Expected: every step exits clean.

- [ ] **Step 8: Tick the Task 6 checkboxes + Plan 13 self-review checklist**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-13-developer-ergonomics.md`:
- Tick all step checkboxes for Task 6
- Tick all checkboxes in the "Plan 13 self-review checklist" section

- [ ] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add docs/wiki/cli-reference.md docs/wiki/concepts.md docs/wiki/post-mvp.md docs/dogfood-acceptance-test.md kadai-plugin/.claude-plugin/plugin.json docs/superpowers/plans/2026-05-06-kadai-13-developer-ergonomics.md
git commit -m "$(cat <<'EOF'
docs(plan-13): cli-reference, concepts, post-mvp shipped + plugin 0.9.0 [Plan-13 Task-6]

- cli-reference.md: kadai uninstall section + phases remove --move-to
- concepts.md: phase migration paragraph
- post-mvp.md: Plan 13 → Recently shipped, Plan 14 → next
- plugin.json: 0.8.0 → 0.9.0
- dogfood-acceptance-test.md: tech-debt drain spot-check

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan 13 self-review checklist

- [ ] All 6 tasks completed; checkboxes ticked.
- [ ] `bun test` passes (~293 tests).
- [ ] `bun run typecheck` passes.
- [ ] `bunx playwright test` passes (8/8 — no regression from refactors).
- [ ] `grep -nE "as any|@ts-ignore" src/cli/init.ts src/cli/list.ts src/cli/add.ts src/cli/status.ts` is empty.
- [ ] `kadai uninstall` works (verified in Task 6 dogfood).
- [ ] `kadai phases rename` migrates items (verified in Task 6 dogfood).
- [ ] `kadai phases remove` refuses without `--move-to`, succeeds with it (verified in Task 6 dogfood).
- [ ] Markdown renders with `prose` styling in the SPA (Task 5 visual check).
- [ ] Plugin v0.9.0 in the manifest.
- [ ] post-mvp.md: Plan 13 in "Recently shipped"; Plan 14 marked 🟢 **next**.
- [ ] cli-reference.md and concepts.md updated.

---

## Proceed to Plan 14

Once the self-review checklist is fully ticked, update the active plan in `/home/fintan/repos/kadai/CLAUDE.md` to point at Plan 14 (Multi-project switcher in the web viewer, activity feed, per-phase comparison view, markdown-only mode, `record_change` MCP tool, comprehensive Playwright E2E). Plan 14 is the last drafted item in `post-mvp.md`. After Plan 14 the post-MVP backlog is fully drained — only the one-shot user actions (publish GH Releases, submit brew formula, npm publish) remain.
