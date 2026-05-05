# Kadai Plan 1 — Spine + CLI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Working kadai CLI that creates and manages epics, features, stories, and tasks as markdown files in `.kadai/` — no agents, no MCP, no web viewer yet.

**Architecture:** Pure TypeScript on Bun. Core data layer (types, schemas, file IO, state machine) is a library exporting clean functions. CLI is a thin layer over the library using commander. Data lives in `.kadai/` as markdown with YAML frontmatter; config in TOML.

**Tech Stack:** TypeScript, Bun (runtime + test runner + bundler), commander (CLI), zod (validation), gray-matter (frontmatter), smol-toml (config), picocolors (terminal colors), prompts (interactive input).

## Position in the build

| | |
|---|---|
| **This is plan** | 1 of 5 |
| **Prior plan** | — (first plan) |
| **Next plan** | [Plan 2 — MCP server](2026-05-05-kadai-02-mcp-server.md) |
| **Index** | [README.md](README.md) |
| **Spec** | [`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md) |

## What ships at the end

- `kadai init` bootstraps a project's `.kadai/` directory and adds a kadai section to `CLAUDE.md`
- `kadai add (epic|feature|story|task)` interactively creates items (with `--id`, `--phase`, `--order`, `--parent` flags as overrides)
- `kadai list <type> [filters]` lists items with `--phase`, `--status`, `--parent` filters
- `kadai status` shows the picked story, ready queue, and recent items
- `kadai pick <story-id>` / `kadai unpick` mutate the picked-story flag and transition status to `in_progress` (pick) where legal
- `kadai phases` lists/adds/removes/renames phases
- `kadai config <key> [=value]` reads/writes config keys
- `bun test` passes for all core modules and CLI commands

## Out of scope (deferred to later plans)

- MCP server (Plan 2)
- Hooks (Plan 3) — therefore `kadai init` does NOT write to `.claude/settings.json` or `.mcp.json` in this plan
- Spec/plan attachment (`attach_spec`, `attach_plan`) — Plan 2 (MCP)
- Changelog auto-capture — Plan 3 (needs PostToolUse hook)
- Git sync — post-MVP
- Web viewer — Plan 4
- Bundled skill + slash commands — Plan 5

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `bunfig.toml`
- Create: `src/cli/index.ts` (placeholder)
- Create directories: `src/core/`, `src/config/`, `src/cli/`, `tests/core/`, `tests/config/`, `tests/cli/`

**Goal:** Bootable Bun + TypeScript project with all dependencies installed.

- [x] **Step 1: Write `package.json`**

```json
{
  "name": "kadai",
  "version": "0.1.0",
  "description": "Local-first product spine for projects driven by agentic coding",
  "type": "module",
  "bin": {
    "kadai": "./src/cli/index.ts"
  },
  "scripts": {
    "kadai": "bun run src/cli/index.ts",
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "build": "bun build --compile --target=bun src/cli/index.ts --outfile dist/kadai"
  },
  "dependencies": {
    "commander": "^12.1.0",
    "zod": "^3.23.8",
    "gray-matter": "^4.0.3",
    "smol-toml": "^1.3.0",
    "picocolors": "^1.1.0",
    "prompts": "^2.4.2"
  },
  "devDependencies": {
    "@types/bun": "latest",
    "@types/prompts": "^2.4.9",
    "typescript": "^5.5.0"
  }
}
```

- [x] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["bun-types"],
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": false,
    "noEmit": true
  },
  "include": ["src/**/*", "tests/**/*"]
}
```

- [x] **Step 3: Write `bunfig.toml`**

```toml
[install]
exact = false

[test]
preload = []
```

- [x] **Step 4: Create directory structure**

```bash
mkdir -p src/core src/config src/cli tests/core tests/config tests/cli
touch src/cli/index.ts tests/core/.gitkeep tests/config/.gitkeep tests/cli/.gitkeep
```

- [x] **Step 5: Install dependencies**

```bash
bun install
```

Expected: creates `node_modules/` and `bun.lockb`.

- [x] **Step 6: Verify scaffolding**

```bash
bun --version
bun run typecheck
bun test
```

Expected: bun version printed; `typecheck` passes (empty source files compile fine); `bun test` reports `0 tests` and exits 0.

- [x] **Step 7: Commit**

```bash
git add package.json tsconfig.json bunfig.toml bun.lockb src/ tests/
git commit -m "chore(scaffold): bootstrap bun + typescript project [Plan-1 Task-1]"
```

---

## Task 2: State machine

**Files:**
- Create: `src/core/state-machine.ts`
- Test: `tests/core/state-machine.test.ts`

**Goal:** Pure module that knows the legal status transitions per item kind (with `review` story-only).

- [x] **Step 1: Write the failing test**

Create `tests/core/state-machine.test.ts`:

```typescript
import { test, expect, describe } from 'bun:test';
import { isLegalTransition, legalNextStates } from '../../src/core/state-machine';

describe('state machine — universal transitions', () => {
  test('ready → in_progress is legal for any kind', () => {
    expect(isLegalTransition('epic', 'ready', 'in_progress')).toBe(true);
    expect(isLegalTransition('feature', 'ready', 'in_progress')).toBe(true);
    expect(isLegalTransition('story', 'ready', 'in_progress')).toBe(true);
    expect(isLegalTransition('task', 'ready', 'in_progress')).toBe(true);
  });

  test('backlog → done is illegal (must go through ready/in_progress)', () => {
    expect(isLegalTransition('story', 'backlog', 'done')).toBe(false);
  });

  test('done is terminal — no outgoing transitions', () => {
    expect(legalNextStates('story', 'done')).toEqual([]);
  });

  test('cancelled is terminal', () => {
    expect(legalNextStates('story', 'cancelled')).toEqual([]);
  });

  test('blocked can return to in_progress or be cancelled', () => {
    expect(legalNextStates('story', 'blocked').sort()).toEqual(['cancelled', 'in_progress']);
  });
});

describe('state machine — story-only review state', () => {
  test('story can enter review from in_progress', () => {
    expect(isLegalTransition('story', 'in_progress', 'review')).toBe(true);
  });

  test('non-story cannot enter review', () => {
    expect(isLegalTransition('feature', 'in_progress', 'review')).toBe(false);
    expect(isLegalTransition('epic', 'in_progress', 'review')).toBe(false);
    expect(isLegalTransition('task', 'in_progress', 'review')).toBe(false);
  });

  test('legalNextStates excludes review for non-stories', () => {
    expect(legalNextStates('feature', 'in_progress')).not.toContain('review');
    expect(legalNextStates('story', 'in_progress')).toContain('review');
  });
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
bun test tests/core/state-machine.test.ts
```

Expected: FAIL — module `../../src/core/state-machine` not found.

- [x] **Step 3: Implement**

Create `src/core/state-machine.ts`:

```typescript
export type Status =
  | 'backlog'
  | 'ready'
  | 'in_progress'
  | 'blocked'
  | 'review'
  | 'done'
  | 'cancelled';

export type ItemKind = 'epic' | 'feature' | 'story' | 'task';

const TRANSITIONS: Record<Status, ReadonlyArray<Status>> = {
  backlog:     ['ready', 'cancelled'],
  ready:       ['in_progress', 'cancelled'],
  in_progress: ['blocked', 'review', 'done', 'cancelled'],
  blocked:     ['in_progress', 'cancelled'],
  review:      ['in_progress', 'done', 'cancelled'],
  done:        [],
  cancelled:   [],
};

function involvesReview(from: Status, to: Status): boolean {
  return from === 'review' || to === 'review';
}

export function isLegalTransition(kind: ItemKind, from: Status, to: Status): boolean {
  if (kind !== 'story' && involvesReview(from, to)) return false;
  return TRANSITIONS[from].includes(to);
}

export function legalNextStates(kind: ItemKind, from: Status): Status[] {
  return TRANSITIONS[from].filter(s => kind === 'story' || s !== 'review');
}
```

- [x] **Step 4: Run the test (should pass)**

```bash
bun test tests/core/state-machine.test.ts
```

Expected: PASS — 8 tests passing.

- [x] **Step 5: Commit**

```bash
git add src/core/state-machine.ts tests/core/state-machine.test.ts
git commit -m "feat(core): add state machine with story-only review state [Plan-1 Task-2]"
```

---

## Task 3: ID generator

**Files:**
- Create: `src/core/ids.ts`
- Test: `tests/core/ids.test.ts`

**Goal:** Generate sequential IDs per kind (`EPIC-001`, `STORY-042`) with persistent counters in `.kadai/.counters.json`.

- [x] **Step 1: Write the failing test**

Create `tests/core/ids.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { nextId, formatId, parseId } from '../../src/core/ids';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-ids-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('nextId starts at 001', () => {
  expect(nextId('epic', tmp)).toBe('EPIC-001');
});

test('nextId increments per type independently', () => {
  expect(nextId('epic', tmp)).toBe('EPIC-001');
  expect(nextId('epic', tmp)).toBe('EPIC-002');
  expect(nextId('story', tmp)).toBe('STORY-001');
  expect(nextId('epic', tmp)).toBe('EPIC-003');
});

test('counters persist across calls (simulating fresh process)', () => {
  nextId('feature', tmp);
  nextId('feature', tmp);
  nextId('feature', tmp);
  expect(nextId('feature', tmp)).toBe('FEAT-004');
});

test('formatId pads to 3 digits', () => {
  expect(formatId('story', 5)).toBe('STORY-005');
  expect(formatId('story', 42)).toBe('STORY-042');
  expect(formatId('story', 1234)).toBe('STORY-1234');
});

test('parseId handles valid IDs', () => {
  expect(parseId('EPIC-001')).toEqual({ kind: 'epic', n: 1 });
  expect(parseId('STORY-042')).toEqual({ kind: 'story', n: 42 });
  expect(parseId('FEAT-100')).toEqual({ kind: 'feature', n: 100 });
  expect(parseId('TASK-007')).toEqual({ kind: 'task', n: 7 });
});

test('parseId returns null for invalid', () => {
  expect(parseId('FOO-001')).toBeNull();
  expect(parseId('EPIC-')).toBeNull();
  expect(parseId('not-an-id')).toBeNull();
  expect(parseId('')).toBeNull();
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
bun test tests/core/ids.test.ts
```

Expected: FAIL — module not found.

- [x] **Step 3: Implement**

Create `src/core/ids.ts`:

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { ItemKind } from './state-machine';

const COUNTERS_FILE = '.counters.json';

const PREFIX: Record<ItemKind, string> = {
  epic: 'EPIC',
  feature: 'FEAT',
  story: 'STORY',
  task: 'TASK',
};

const PREFIX_TO_KIND: Record<string, ItemKind> = {
  EPIC: 'epic',
  FEAT: 'feature',
  STORY: 'story',
  TASK: 'task',
};

type Counters = Record<ItemKind, number>;

function counterPath(rootDir: string): string {
  return join(rootDir, '.kadai', COUNTERS_FILE);
}

function readCounters(rootDir: string): Counters {
  const path = counterPath(rootDir);
  if (!existsSync(path)) {
    return { epic: 0, feature: 0, story: 0, task: 0 };
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Counters;
}

function writeCounters(rootDir: string, counters: Counters): void {
  const path = counterPath(rootDir);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(counters, null, 2) + '\n', 'utf8');
}

export function nextId(kind: ItemKind, rootDir: string): string {
  const counters = readCounters(rootDir);
  counters[kind] += 1;
  writeCounters(rootDir, counters);
  return formatId(kind, counters[kind]);
}

export function formatId(kind: ItemKind, n: number): string {
  return `${PREFIX[kind]}-${String(n).padStart(3, '0')}`;
}

export function parseId(id: string): { kind: ItemKind; n: number } | null {
  const m = id.match(/^(EPIC|FEAT|STORY|TASK)-(\d+)$/);
  if (!m) return null;
  return { kind: PREFIX_TO_KIND[m[1]], n: parseInt(m[2], 10) };
}
```

- [x] **Step 4: Run the test (should pass)**

```bash
bun test tests/core/ids.test.ts
```

Expected: PASS — 6 tests.

- [x] **Step 5: Commit**

```bash
git add src/core/ids.ts tests/core/ids.test.ts
git commit -m "feat(core): add persistent ID generator [Plan-1 Task-3]"
```

---

## Task 4: Sparse ordering

**Files:**
- Create: `src/core/ordering.ts`
- Test: `tests/core/ordering.test.ts`

**Goal:** Helpers for sparse ordering (10, 20, 30…) so insertions don't require renumbering, with a re-densify path when midpoints get tight.

- [x] **Step 1: Write the failing test**

Create `tests/core/ordering.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { nextOrder, orderAfter, redensify, needsRedensify } from '../../src/core/ordering';

test('nextOrder on empty list returns 10', () => {
  expect(nextOrder([])).toBe(10);
});

test('nextOrder returns max + 10', () => {
  expect(nextOrder([{ order: 10 }, { order: 30 }, { order: 50 }])).toBe(60);
});

test('orderAfter computes midpoint', () => {
  const items = [{ order: 10 }, { order: 30 }, { order: 50 }];
  expect(orderAfter(items, 10)).toBe(20);
  expect(orderAfter(items, 30)).toBe(40);
});

test('orderAfter on last item returns +10', () => {
  expect(orderAfter([{ order: 10 }, { order: 30 }], 30)).toBe(40);
});

test('orderAfter throws for unknown order', () => {
  expect(() => orderAfter([{ order: 10 }], 99)).toThrow(/No item with order=99/);
});

test('redensify reassigns to 10, 20, 30 in current sorted order', () => {
  const items = [{ order: 1 }, { order: 5 }, { order: 100 }];
  expect(redensify(items)).toEqual([{ order: 10 }, { order: 20 }, { order: 30 }]);
});

test('needsRedensify true when gap < 2', () => {
  expect(needsRedensify([{ order: 10 }, { order: 11 }])).toBe(true);
});

test('needsRedensify false with healthy gaps', () => {
  expect(needsRedensify([{ order: 10 }, { order: 20 }])).toBe(false);
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
bun test tests/core/ordering.test.ts
```

Expected: FAIL — module not found.

- [x] **Step 3: Implement**

Create `src/core/ordering.ts`:

```typescript
const SPACING = 10;

export interface Ordered {
  order: number;
}

export function nextOrder<T extends Ordered>(items: T[]): number {
  if (items.length === 0) return SPACING;
  const max = Math.max(...items.map(i => i.order));
  return max + SPACING;
}

export function orderAfter<T extends Ordered>(items: T[], targetOrder: number): number {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex(i => i.order === targetOrder);
  if (idx === -1) throw new Error(`No item with order=${targetOrder}`);
  const next = sorted[idx + 1];
  if (!next) return targetOrder + SPACING;
  return Math.floor((targetOrder + next.order) / 2);
}

export function redensify<T extends Ordered>(items: T[]): T[] {
  return [...items]
    .sort((a, b) => a.order - b.order)
    .map((item, i) => ({ ...item, order: (i + 1) * SPACING }));
}

export function needsRedensify<T extends Ordered>(items: T[]): boolean {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].order - sorted[i - 1].order < 2) return true;
  }
  return false;
}
```

- [x] **Step 4: Run the test (should pass)**

```bash
bun test tests/core/ordering.test.ts
```

Expected: PASS — 8 tests.

- [x] **Step 5: Commit**

```bash
git add src/core/ordering.ts tests/core/ordering.test.ts
git commit -m "feat(core): add sparse ordering helpers [Plan-1 Task-4]"
```

---

## Task 5: Slug generator

**Files:**
- Create: `src/core/slug.ts`
- Test: `tests/core/slug.test.ts`

**Goal:** `slugify(title)` for human-readable directory names.

- [x] **Step 1: Write the failing test**

Create `tests/core/slug.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { slugify } from '../../src/core/slug';

test('slugify lowercases and replaces spaces with dashes', () => {
  expect(slugify('User Login')).toBe('user-login');
});

test('slugify strips diacritics', () => {
  expect(slugify('café au lait')).toBe('cafe-au-lait');
});

test('slugify removes special chars', () => {
  expect(slugify('User can log in! (with email)')).toBe('user-can-log-in-with-email');
});

test('slugify trims leading/trailing dashes', () => {
  expect(slugify('  -hello-  ')).toBe('hello');
});

test('slugify truncates to 50 chars', () => {
  const long = 'a'.repeat(100);
  expect(slugify(long).length).toBe(50);
});

test('slugify collapses repeated separators', () => {
  expect(slugify('foo   ---   bar')).toBe('foo-bar');
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
bun test tests/core/slug.test.ts
```

Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/core/slug.ts`:

```typescript
export function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
}
```

- [x] **Step 4: Run the test (should pass)**

```bash
bun test tests/core/slug.test.ts
```

Expected: PASS — 6 tests.

- [x] **Step 5: Commit**

```bash
git add src/core/slug.ts tests/core/slug.test.ts
git commit -m "feat(core): add slugify helper [Plan-1 Task-5]"
```

---

## Task 6: Frontmatter parse + serialize

**Files:**
- Create: `src/core/frontmatter.ts`
- Test: `tests/core/frontmatter.test.ts`

**Goal:** Thin typed wrapper over `gray-matter` for parsing/writing YAML frontmatter + markdown body.

- [x] **Step 1: Write the failing test**

Create `tests/core/frontmatter.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { parse, serialize } from '../../src/core/frontmatter';

test('parse extracts YAML frontmatter and body', () => {
  const src = `---
id: STORY-001
title: Test
---

## Description

Some content.
`;
  const { data, body } = parse<{ id: string; title: string }>(src);
  expect(data.id).toBe('STORY-001');
  expect(data.title).toBe('Test');
  expect(body.trim()).toContain('## Description');
});

test('serialize roundtrips with parse', () => {
  const data = { id: 'STORY-001', title: 'Test' };
  const body = '## Description\n\nContent.\n';
  const result = serialize(data, body);
  const parsed = parse(result);
  expect(parsed.data).toEqual(data);
  expect(parsed.body.trim()).toContain('## Description');
});

test('parse handles missing frontmatter', () => {
  const { data, body } = parse('Just content, no frontmatter.');
  expect(data).toEqual({});
  expect(body).toBe('Just content, no frontmatter.');
});

test('parse handles array values in frontmatter', () => {
  const src = `---
id: STORY-001
acceptance_criteria:
  - First criterion
  - Second criterion
---
body
`;
  const { data } = parse<{ acceptance_criteria: string[] }>(src);
  expect(data.acceptance_criteria).toEqual(['First criterion', 'Second criterion']);
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
bun test tests/core/frontmatter.test.ts
```

Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/core/frontmatter.ts`:

```typescript
import matter from 'gray-matter';

export interface ParsedDoc<T> {
  data: T;
  body: string;
}

export function parse<T = Record<string, unknown>>(source: string): ParsedDoc<T> {
  const { data, content } = matter(source);
  return { data: data as T, body: content };
}

export function serialize<T extends Record<string, unknown>>(data: T, body: string): string {
  return matter.stringify(body, data);
}
```

- [x] **Step 4: Run the test (should pass)**

```bash
bun test tests/core/frontmatter.test.ts
```

Expected: PASS — 4 tests.

- [x] **Step 5: Commit**

```bash
git add src/core/frontmatter.ts tests/core/frontmatter.test.ts
git commit -m "feat(core): add frontmatter parse/serialize [Plan-1 Task-6]"
```

---

## Task 7: Atomic file write

**Files:**
- Create: `src/core/files.ts`
- Test: `tests/core/files.test.ts`

**Goal:** `writeFileAtomic(path, contents)` — temp file + rename for crash safety.

- [x] **Step 1: Write the failing test**

Create `tests/core/files.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { writeFileAtomic } from '../../src/core/files';
import { mkdtempSync, rmSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-files-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('writeFileAtomic writes file', () => {
  const path = join(tmp, 'sub', 'file.txt');
  writeFileAtomic(path, 'hello');
  expect(readFileSync(path, 'utf8')).toBe('hello');
});

test('writeFileAtomic creates intermediate directories', () => {
  const path = join(tmp, 'a', 'b', 'c', 'file.txt');
  writeFileAtomic(path, 'data');
  expect(existsSync(path)).toBe(true);
});

test('writeFileAtomic does not leave temp files', () => {
  writeFileAtomic(join(tmp, 'file.txt'), 'data');
  const files = readdirSync(tmp);
  expect(files.filter(f => f.endsWith('.tmp'))).toEqual([]);
});

test('writeFileAtomic overwrites existing file', () => {
  const path = join(tmp, 'file.txt');
  writeFileAtomic(path, 'first');
  writeFileAtomic(path, 'second');
  expect(readFileSync(path, 'utf8')).toBe('second');
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
bun test tests/core/files.test.ts
```

Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/core/files.ts`:

```typescript
import { writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';

export function writeFileAtomic(path: string, contents: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmp = join(dirname(path), `.${randomBytes(8).toString('hex')}.tmp`);
  writeFileSync(tmp, contents);
  renameSync(tmp, path);
}
```

- [x] **Step 4: Run the test (should pass)**

```bash
bun test tests/core/files.test.ts
```

Expected: PASS — 4 tests.

- [x] **Step 5: Commit**

```bash
git add src/core/files.ts tests/core/files.test.ts
git commit -m "feat(core): add atomic file write helper [Plan-1 Task-7]"
```

---

## Task 8: Item type definitions

**Files:**
- Create: `src/core/types.ts`

**Goal:** TypeScript interfaces for each item kind. No tests (types are checked at compile time).

- [x] **Step 1: Implement**

Create `src/core/types.ts`:

```typescript
import type { ItemKind, Status } from './state-machine';

export type Phase = string;

export interface BaseFrontmatter {
  id: string;
  title: string;
  status: Status;
  created: string;
  updated: string;
}

export interface OrderedFrontmatter extends BaseFrontmatter {
  phase: Phase;
  order: number;
}

export interface EpicFrontmatter extends OrderedFrontmatter {}

export interface FeatureFrontmatter extends OrderedFrontmatter {
  parent: string;
  spec?: string;
}

export interface StoryFrontmatter extends OrderedFrontmatter {
  parent: string;
  spec?: string;
  plan?: string;
  acceptance_criteria?: string[];
}

export interface TaskFrontmatter extends BaseFrontmatter {
  parent: string;
  plan_step?: number;
}

export type AnyFrontmatter =
  | EpicFrontmatter
  | FeatureFrontmatter
  | StoryFrontmatter
  | TaskFrontmatter;

export interface Item<F extends AnyFrontmatter = AnyFrontmatter> {
  kind: ItemKind;
  path: string;
  data: F;
  body: string;
}

export type Epic = Item<EpicFrontmatter>;
export type Feature = Item<FeatureFrontmatter>;
export type Story = Item<StoryFrontmatter>;
export type Task = Item<TaskFrontmatter>;
```

- [x] **Step 2: Verify it compiles**

```bash
bun run typecheck
```

Expected: PASS (no type errors).

- [x] **Step 3: Commit**

```bash
git add src/core/types.ts
git commit -m "feat(core): add item type definitions [Plan-1 Task-8]"
```

---

## Task 9: Zod schemas + validation

**Files:**
- Create: `src/core/schema.ts`
- Test: `tests/core/schema.test.ts`

**Goal:** Per-kind Zod schemas + `validateFrontmatter(kind, data)` helper.

- [x] **Step 1: Write the failing test**

Create `tests/core/schema.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { validateFrontmatter, safeValidateFrontmatter } from '../../src/core/schema';

const baseEpic = {
  id: 'EPIC-001',
  title: 'Auth',
  status: 'ready',
  phase: 'mvp',
  order: 10,
  created: '2026-05-05',
  updated: '2026-05-05',
};

test('validateFrontmatter accepts valid epic', () => {
  expect(() => validateFrontmatter('epic', baseEpic)).not.toThrow();
});

test('validateFrontmatter rejects wrong id prefix', () => {
  expect(() => validateFrontmatter('epic', { ...baseEpic, id: 'FEAT-001' })).toThrow();
});

test('validateFrontmatter rejects missing parent on feature', () => {
  const feat = { ...baseEpic, id: 'FEAT-001' };
  expect(() => validateFrontmatter('feature', feat)).toThrow();
});

test('validateFrontmatter accepts story with acceptance_criteria', () => {
  const story = {
    ...baseEpic,
    id: 'STORY-001',
    parent: 'FEAT-001',
    acceptance_criteria: ['Form submits', 'Redirects on success'],
  };
  expect(() => validateFrontmatter('story', story)).not.toThrow();
});

test('validateFrontmatter rejects invalid status', () => {
  expect(() => validateFrontmatter('epic', { ...baseEpic, status: 'shipped' })).toThrow();
});

test('safeValidateFrontmatter returns success: false on bad input', () => {
  const r = safeValidateFrontmatter('epic', { ...baseEpic, id: 'BAD' });
  expect(r.success).toBe(false);
});

test('safeValidateFrontmatter returns success: true on good input', () => {
  const r = safeValidateFrontmatter('epic', baseEpic);
  expect(r.success).toBe(true);
});

test('task does not require phase or order (inherits from story)', () => {
  const task = {
    id: 'TASK-001',
    parent: 'STORY-001',
    title: 'bcrypt',
    status: 'ready',
    created: '2026-05-05',
    updated: '2026-05-05',
  };
  expect(() => validateFrontmatter('task', task)).not.toThrow();
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
bun test tests/core/schema.test.ts
```

Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/core/schema.ts`:

```typescript
import { z } from 'zod';
import type { ItemKind } from './state-machine';

const STATUS = z.enum([
  'backlog',
  'ready',
  'in_progress',
  'blocked',
  'review',
  'done',
  'cancelled',
]);

const baseFrontmatter = z.object({
  id: z.string().regex(/^(EPIC|FEAT|STORY|TASK)-\d+$/),
  title: z.string().min(1),
  status: STATUS,
  created: z.string(),
  updated: z.string(),
});

const orderedFrontmatter = baseFrontmatter.extend({
  phase: z.string().min(1),
  order: z.number().int().min(0),
});

export const epicSchema = orderedFrontmatter.extend({
  id: z.string().regex(/^EPIC-\d+$/),
});

export const featureSchema = orderedFrontmatter.extend({
  id: z.string().regex(/^FEAT-\d+$/),
  parent: z.string().regex(/^EPIC-\d+$/),
  spec: z.string().optional(),
});

export const storySchema = orderedFrontmatter.extend({
  id: z.string().regex(/^STORY-\d+$/),
  parent: z.string().regex(/^FEAT-\d+$/),
  spec: z.string().optional(),
  plan: z.string().optional(),
  acceptance_criteria: z.array(z.string()).optional(),
});

export const taskSchema = baseFrontmatter.extend({
  id: z.string().regex(/^TASK-\d+$/),
  parent: z.string().regex(/^STORY-\d+$/),
  plan_step: z.number().int().min(1).optional(),
});

const SCHEMAS = {
  epic: epicSchema,
  feature: featureSchema,
  story: storySchema,
  task: taskSchema,
} as const;

export function validateFrontmatter(kind: ItemKind, data: unknown) {
  return SCHEMAS[kind].parse(data);
}

export function safeValidateFrontmatter(kind: ItemKind, data: unknown) {
  return SCHEMAS[kind].safeParse(data);
}
```

- [x] **Step 4: Run the test (should pass)**

```bash
bun test tests/core/schema.test.ts
```

Expected: PASS — 8 tests.

- [x] **Step 5: Commit**

```bash
git add src/core/schema.ts tests/core/schema.test.ts
git commit -m "feat(core): add zod schemas and validation [Plan-1 Task-9]"
```

---

## Task 10: Item reader

**Files:**
- Create: `src/core/reader.ts`
- Test: `tests/core/reader.test.ts`

**Goal:** `readItem(path)` — read a markdown file, parse frontmatter, validate, and return a typed `Item`.

- [x] **Step 1: Write the failing test**

Create `tests/core/reader.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { readItem } from '../../src/core/reader';
import { writeFileAtomic } from '../../src/core/files';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-reader-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('readItem parses a valid epic file', () => {
  const path = join(tmp, 'epic.md');
  writeFileAtomic(path, `---
id: EPIC-001
title: Authentication
status: ready
phase: mvp
order: 10
created: 2026-05-05
updated: 2026-05-05
---

## Description
Auth stuff.
`);
  const item = readItem(path);
  expect(item.kind).toBe('epic');
  expect(item.data.id).toBe('EPIC-001');
  expect(item.data.title).toBe('Authentication');
  expect(item.body).toContain('Auth stuff');
});

test('readItem throws on missing id', () => {
  const path = join(tmp, 'broken.md');
  writeFileAtomic(path, '---\ntitle: No ID\n---\n');
  expect(() => readItem(path)).toThrow(/Missing id/);
});

test('readItem throws on invalid id format', () => {
  const path = join(tmp, 'broken.md');
  writeFileAtomic(path, '---\nid: BAD-FORMAT\ntitle: x\n---\n');
  expect(() => readItem(path)).toThrow(/Invalid id/);
});

test('readItem throws on schema violation', () => {
  const path = join(tmp, 'broken.md');
  writeFileAtomic(path, `---
id: EPIC-001
title: x
status: bogus_status
phase: mvp
order: 10
created: 2026-05-05
updated: 2026-05-05
---
`);
  expect(() => readItem(path)).toThrow();
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
bun test tests/core/reader.test.ts
```

Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/core/reader.ts`:

```typescript
import { readFileSync } from 'node:fs';
import { parseId } from './ids';
import { parse } from './frontmatter';
import { validateFrontmatter } from './schema';
import type { Item, AnyFrontmatter } from './types';

export function readItem(path: string): Item {
  const source = readFileSync(path, 'utf8');
  const { data, body } = parse(source);
  const id = (data as { id?: string }).id;
  if (!id) throw new Error(`Missing id in frontmatter at ${path}`);
  const parsed = parseId(id);
  if (!parsed) throw new Error(`Invalid id "${id}" at ${path}`);
  const validated = validateFrontmatter(parsed.kind, data) as AnyFrontmatter;
  return {
    kind: parsed.kind,
    path,
    data: validated,
    body,
  };
}
```

- [x] **Step 4: Run the test (should pass)**

```bash
bun test tests/core/reader.test.ts
```

Expected: PASS — 4 tests.

- [x] **Step 5: Commit**

```bash
git add src/core/reader.ts tests/core/reader.test.ts
git commit -m "feat(core): add item reader [Plan-1 Task-10]"
```

---

## Task 11: Item writer

**Files:**
- Create: `src/core/writer.ts`
- Test: `tests/core/writer.test.ts`

**Goal:** `writeItem(kind, data, body, ctx)` — compute the right directory + filename from item kind, slugify the title, atomic-write the file.

- [x] **Step 1: Write the failing test**

Create `tests/core/writer.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { writeItem } from '../../src/core/writer';
import { readItem } from '../../src/core/reader';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-writer-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const epicData = {
  id: 'EPIC-001',
  title: 'Authentication',
  status: 'ready' as const,
  phase: 'mvp',
  order: 10,
  created: '2026-05-05',
  updated: '2026-05-05',
};

test('writeItem writes an epic and roundtrips through readItem', () => {
  const path = writeItem('epic', epicData, '## Description\n\nAuth stuff.', { rootDir: tmp });
  expect(existsSync(path)).toBe(true);
  const back = readItem(path);
  expect(back.data.id).toBe('EPIC-001');
  expect(back.data.title).toBe('Authentication');
  expect(back.body).toContain('Auth stuff');
});

test('writeItem creates correct directory for epic', () => {
  const path = writeItem('epic', epicData, '', { rootDir: tmp });
  expect(path).toBe(join(tmp, '.kadai', 'epics', 'EPIC-001-authentication', 'epic.md'));
});

test('writeItem creates correct directory for nested feature', () => {
  writeItem('epic', epicData, '', { rootDir: tmp });
  const epicDir = join(tmp, '.kadai', 'epics', 'EPIC-001-authentication');
  const featData = {
    id: 'FEAT-001',
    parent: 'EPIC-001',
    title: 'User login',
    status: 'ready' as const,
    phase: 'mvp',
    order: 10,
    created: '2026-05-05',
    updated: '2026-05-05',
  };
  const path = writeItem('feature', featData, '', { rootDir: tmp, parentPath: epicDir });
  expect(path).toBe(join(epicDir, 'features', 'FEAT-001-user-login', 'feature.md'));
});

test('writeItem creates correct filename for task', () => {
  writeItem('epic', epicData, '', { rootDir: tmp });
  const epicDir = join(tmp, '.kadai/epics/EPIC-001-authentication');
  writeItem('feature', {
    id: 'FEAT-001', parent: 'EPIC-001', title: 'Login',
    status: 'ready' as const, phase: 'mvp', order: 10,
    created: '2026-05-05', updated: '2026-05-05',
  }, '', { rootDir: tmp, parentPath: epicDir });
  const featDir = join(epicDir, 'features/FEAT-001-login');
  writeItem('story', {
    id: 'STORY-001', parent: 'FEAT-001', title: 'Email login',
    status: 'ready' as const, phase: 'mvp', order: 10,
    created: '2026-05-05', updated: '2026-05-05',
  }, '', { rootDir: tmp, parentPath: featDir });
  const storyDir = join(featDir, 'stories/STORY-001-email-login');
  const path = writeItem('task', {
    id: 'TASK-001', parent: 'STORY-001', title: 'Add bcrypt hashing',
    status: 'ready' as const,
    created: '2026-05-05', updated: '2026-05-05',
  }, '', { rootDir: tmp, parentPath: storyDir });
  expect(path).toBe(join(storyDir, 'tasks', 'TASK-001-add-bcrypt-hashing.md'));
});

test('writeItem rejects invalid frontmatter', () => {
  expect(() => writeItem('epic', { ...epicData, status: 'bogus' } as any, '', { rootDir: tmp }))
    .toThrow();
});

test('writeItem requires parentPath for non-epics', () => {
  const featData = {
    ...epicData, id: 'FEAT-001', parent: 'EPIC-001',
  } as any;
  expect(() => writeItem('feature', featData, '', { rootDir: tmp })).toThrow(/requires parentPath/);
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
bun test tests/core/writer.test.ts
```

Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/core/writer.ts`:

```typescript
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from './files';
import { serialize } from './frontmatter';
import { slugify } from './slug';
import { validateFrontmatter } from './schema';
import type { ItemKind } from './state-machine';
import type { AnyFrontmatter } from './types';

export interface WriteContext {
  rootDir: string;
  parentPath?: string;
}

const FILENAMES: Record<Exclude<ItemKind, 'task'>, string> = {
  epic: 'epic.md',
  feature: 'feature.md',
  story: 'story.md',
};

function computeItemDir(kind: ItemKind, id: string, title: string, ctx: WriteContext): string {
  const slug = slugify(title);
  const dirName = `${id}-${slug}`;
  if (kind === 'epic') {
    return join(ctx.rootDir, '.kadai', 'epics', dirName);
  }
  if (!ctx.parentPath) throw new Error(`${kind} requires parentPath`);
  if (kind === 'feature') return join(ctx.parentPath, 'features', dirName);
  if (kind === 'story') return join(ctx.parentPath, 'stories', dirName);
  if (kind === 'task') return join(ctx.parentPath, 'tasks');
  throw new Error(`Unknown kind: ${kind}`);
}

export function writeItem(
  kind: ItemKind,
  data: AnyFrontmatter,
  body: string,
  ctx: WriteContext,
): string {
  const validated = validateFrontmatter(kind, data) as AnyFrontmatter;
  const itemDir = computeItemDir(kind, validated.id, validated.title, ctx);
  mkdirSync(itemDir, { recursive: true });

  let filename: string;
  if (kind === 'task') {
    const slug = slugify(validated.title);
    filename = `${validated.id}-${slug}.md`;
  } else {
    filename = FILENAMES[kind];
  }

  const filePath = join(itemDir, filename);
  const content = serialize(validated as Record<string, unknown>, body);
  writeFileAtomic(filePath, content);
  return filePath;
}
```

- [x] **Step 4: Run the test (should pass)**

```bash
bun test tests/core/writer.test.ts
```

Expected: PASS — 6 tests.

- [x] **Step 5: Commit**

```bash
git add src/core/writer.ts tests/core/writer.test.ts docs/superpowers/plans/2026-05-05-kadai-01-spine-and-cli.md
git commit -m "feat(core): add item writer with slug + atomic write [Plan-1 Task-11]"
```

---

## Task 12: Spine walker

**Files:**
- Create: `src/core/spine.ts`
- Test: `tests/core/spine.test.ts`

**Goal:** `walkSpine(rootDir)` enumerates all items in deterministic order. `findById(rootDir, id)` looks up a single item.

- [x] **Step 1: Write the failing test**

Create `tests/core/spine.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { walkSpine, findById } from '../../src/core/spine';
import { writeItem } from '../../src/core/writer';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-spine-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const baseFields = {
  status: 'ready' as const,
  phase: 'mvp',
  order: 10,
  created: '2026-05-05',
  updated: '2026-05-05',
};

test('walkSpine returns empty for missing .kadai', () => {
  expect(walkSpine(tmp)).toEqual([]);
});

test('walkSpine yields a single epic', () => {
  writeItem('epic', { ...baseFields, id: 'EPIC-001', title: 'Auth' }, '', { rootDir: tmp });
  const items = walkSpine(tmp);
  expect(items.length).toBe(1);
  expect(items[0].data.id).toBe('EPIC-001');
});

test('walkSpine yields nested epic + feature + story in order', () => {
  writeItem('epic', { ...baseFields, id: 'EPIC-001', title: 'Auth' }, '', { rootDir: tmp });
  const epicDir = join(tmp, '.kadai/epics/EPIC-001-auth');
  writeItem('feature',
    { ...baseFields, id: 'FEAT-001', parent: 'EPIC-001', title: 'Login' },
    '', { rootDir: tmp, parentPath: epicDir });
  const featDir = join(epicDir, 'features/FEAT-001-login');
  writeItem('story',
    { ...baseFields, id: 'STORY-001', parent: 'FEAT-001', title: 'Email login' },
    '', { rootDir: tmp, parentPath: featDir });

  const items = walkSpine(tmp);
  expect(items.map(i => i.data.id)).toEqual(['EPIC-001', 'FEAT-001', 'STORY-001']);
});

test('findById returns the matching item', () => {
  writeItem('epic', { ...baseFields, id: 'EPIC-001', title: 'A' }, '', { rootDir: tmp });
  writeItem('epic', { ...baseFields, id: 'EPIC-002', title: 'B', order: 20 }, '', { rootDir: tmp });
  expect(findById(tmp, 'EPIC-002')?.data.title).toBe('B');
});

test('findById returns null for missing ID', () => {
  expect(findById(tmp, 'EPIC-999')).toBeNull();
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
bun test tests/core/spine.test.ts
```

Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/core/spine.ts`:

```typescript
import { readdirSync, statSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { readItem } from './reader';
import type { Item } from './types';

export function walkSpine(rootDir: string): Item[] {
  const kadaiDir = join(rootDir, '.kadai');
  if (!existsSync(kadaiDir)) return [];
  const items: Item[] = [];
  walkEpics(join(kadaiDir, 'epics'), items);
  return items;
}

function walkEpics(dir: string, out: Item[]) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    const epicDir = join(dir, entry);
    if (!statSync(epicDir).isDirectory()) continue;
    const epicFile = join(epicDir, 'epic.md');
    if (existsSync(epicFile)) {
      out.push(readItem(epicFile));
      walkFeatures(join(epicDir, 'features'), out);
    }
  }
}

function walkFeatures(dir: string, out: Item[]) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    const featureDir = join(dir, entry);
    if (!statSync(featureDir).isDirectory()) continue;
    const featureFile = join(featureDir, 'feature.md');
    if (existsSync(featureFile)) {
      out.push(readItem(featureFile));
      walkStories(join(featureDir, 'stories'), out);
    }
  }
}

function walkStories(dir: string, out: Item[]) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    const storyDir = join(dir, entry);
    if (!statSync(storyDir).isDirectory()) continue;
    const storyFile = join(storyDir, 'story.md');
    if (existsSync(storyFile)) {
      out.push(readItem(storyFile));
      walkTasks(join(storyDir, 'tasks'), out);
    }
  }
}

function walkTasks(dir: string, out: Item[]) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    if (!entry.endsWith('.md')) continue;
    if (!entry.startsWith('TASK-')) continue;
    out.push(readItem(join(dir, entry)));
  }
}

export function findById(rootDir: string, id: string): Item | null {
  for (const item of walkSpine(rootDir)) {
    if (item.data.id === id) return item;
  }
  return null;
}
```

- [x] **Step 4: Run the test (should pass)**

```bash
bun test tests/core/spine.test.ts
```

Expected: PASS — 5 tests.

- [x] **Step 5: Commit**

```bash
git add src/core/spine.ts tests/core/spine.test.ts
git commit -m "feat(core): add spine walker and findById [Plan-1 Task-12]"
```

---

## Task 13: Config types + defaults

**Files:**
- Create: `src/config/types.ts`
- Create: `src/config/defaults.ts`

**Goal:** Type definitions and default config object. No tests (constants).

- [x] **Step 1: Implement types**

Create `src/config/types.ts`:

```typescript
export interface PhaseConfig {
  slug: string;
  display: string;
  color: string;
}

export interface AutoTransitionsConfig {
  spec_attached_marks_ready: boolean;
  plan_attached_marks_ready: boolean;
  plan_step_completion_marks_task_done: boolean;
  all_tasks_done_marks_story_review: boolean;
  pr_merge_marks_story_done: boolean;
}

export interface GuardrailConfig {
  allowed_paths: string[];
}

export interface ChangeCaptureConfig {
  enabled: boolean;
}

export interface Config {
  phases: PhaseConfig[];
  auto_transitions: AutoTransitionsConfig;
  guardrail: GuardrailConfig;
  change_capture: ChangeCaptureConfig;
}
```

- [x] **Step 2: Implement defaults**

Create `src/config/defaults.ts`:

```typescript
import type { Config } from './types';

export const DEFAULT_CONFIG: Config = {
  phases: [
    { slug: 'mvp', display: 'MVP', color: '#22c55e' },
    { slug: 'v1', display: 'v1.0', color: '#3b82f6' },
    { slug: 'future', display: 'Future', color: '#a78bfa' },
    { slug: 'parking-lot', display: 'Parking Lot', color: '#9ca3af' },
  ],
  auto_transitions: {
    spec_attached_marks_ready: false,
    plan_attached_marks_ready: false,
    plan_step_completion_marks_task_done: false,
    all_tasks_done_marks_story_review: false,
    pr_merge_marks_story_done: false,
  },
  guardrail: {
    allowed_paths: ['docs/', 'scripts/', 'README.md', '.gitignore', 'CLAUDE.md'],
  },
  change_capture: {
    enabled: true,
  },
};
```

- [x] **Step 3: Verify it compiles**

```bash
bun run typecheck
```

Expected: PASS.

- [x] **Step 4: Commit**

```bash
git add src/config/types.ts src/config/defaults.ts
git commit -m "feat(config): add config types and defaults [Plan-1 Task-13]"
```

---

## Task 14: Config loader + saver

**Files:**
- Create: `src/config/load.ts`
- Test: `tests/config/load.test.ts`

**Goal:** TOML config load/save with defaults merge.

- [x] **Step 1: Write the failing test**

Create `tests/config/load.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { loadConfig, saveConfig, configPath } from '../../src/config/load';
import { DEFAULT_CONFIG } from '../../src/config/defaults';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-config-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('loadConfig returns defaults when no file exists', () => {
  const cfg = loadConfig(tmp);
  expect(cfg).toEqual(DEFAULT_CONFIG);
});

test('saveConfig + loadConfig roundtrip', () => {
  saveConfig(tmp, DEFAULT_CONFIG);
  expect(existsSync(configPath(tmp))).toBe(true);
  const loaded = loadConfig(tmp);
  expect(loaded).toEqual(DEFAULT_CONFIG);
});

test('loadConfig merges partial overrides with defaults', () => {
  const partial = {
    ...DEFAULT_CONFIG,
    auto_transitions: {
      ...DEFAULT_CONFIG.auto_transitions,
      pr_merge_marks_story_done: true,
    },
  };
  saveConfig(tmp, partial);
  const loaded = loadConfig(tmp);
  expect(loaded.auto_transitions.pr_merge_marks_story_done).toBe(true);
  expect(loaded.auto_transitions.plan_attached_marks_ready).toBe(false);
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
bun test tests/config/load.test.ts
```

Expected: FAIL.

- [x] **Step 3: Implement**

Create `src/config/load.ts`:

```typescript
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';
import { writeFileAtomic } from '../core/files';
import { DEFAULT_CONFIG } from './defaults';
import type { Config } from './types';

const CONFIG_FILE = 'config.toml';

export function configPath(rootDir: string): string {
  return join(rootDir, '.kadai', CONFIG_FILE);
}

export function loadConfig(rootDir: string): Config {
  const path = configPath(rootDir);
  if (!existsSync(path)) return DEFAULT_CONFIG;
  const parsed = parseToml(readFileSync(path, 'utf8')) as unknown as Partial<Config>;
  return mergeConfig(DEFAULT_CONFIG, parsed);
}

export function saveConfig(rootDir: string, config: Config): void {
  const path = configPath(rootDir);
  writeFileAtomic(path, stringifyToml(config as unknown as Record<string, unknown>));
}

function mergeConfig(base: Config, override: Partial<Config>): Config {
  return {
    phases: override.phases ?? base.phases,
    auto_transitions: { ...base.auto_transitions, ...(override.auto_transitions ?? {}) },
    guardrail: { ...base.guardrail, ...(override.guardrail ?? {}) },
    change_capture: { ...base.change_capture, ...(override.change_capture ?? {}) },
  };
}
```

- [x] **Step 4: Run the test (should pass)**

```bash
bun test tests/config/load.test.ts
```

Expected: PASS — 3 tests.

- [x] **Step 5: Commit**

```bash
git add src/config/load.ts tests/config/load.test.ts docs/superpowers/plans/2026-05-05-kadai-01-spine-and-cli.md
git commit -m "feat(config): add TOML loader/saver with defaults merge [Plan-1 Task-14]"
```

---

## Task 15: Picked state + setStatus operation

**Files:**
- Create: `src/core/picked.ts`
- Create: `src/core/operations.ts`
- Test: `tests/core/picked.test.ts`
- Test: `tests/core/operations.test.ts`

**Goal:** `readPicked` / `setPicked` / `clearPicked` for the `.kadai/.picked` file. `setStatus(rootDir, id, newStatus)` validates against the state machine and atomic-writes the updated frontmatter.

- [ ] **Step 1: Write picked tests**

Create `tests/core/picked.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { readPicked, setPicked, clearPicked } from '../../src/core/picked';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-picked-'));
  mkdirSync(join(tmp, '.kadai'), { recursive: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('readPicked returns null when no file exists', () => {
  expect(readPicked(tmp)).toBeNull();
});

test('setPicked + readPicked roundtrip', () => {
  setPicked(tmp, 'STORY-042');
  expect(readPicked(tmp)).toBe('STORY-042');
});

test('clearPicked removes the file', () => {
  setPicked(tmp, 'STORY-042');
  clearPicked(tmp);
  expect(readPicked(tmp)).toBeNull();
});

test('setPicked rejects non-story IDs', () => {
  expect(() => setPicked(tmp, 'EPIC-001')).toThrow(/only stories can be picked/i);
});
```

- [ ] **Step 2: Write operations tests**

Create `tests/core/operations.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { setStatus } from '../../src/core/operations';
import { writeItem } from '../../src/core/writer';
import { findById } from '../../src/core/spine';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-ops-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const epic = {
  id: 'EPIC-001', title: 'Auth',
  status: 'ready' as const, phase: 'mvp', order: 10,
  created: '2026-05-05', updated: '2026-05-05',
};

test('setStatus updates an item from ready to in_progress', () => {
  writeItem('epic', epic, '', { rootDir: tmp });
  setStatus(tmp, 'EPIC-001', 'in_progress');
  const after = findById(tmp, 'EPIC-001');
  expect(after?.data.status).toBe('in_progress');
});

test('setStatus rejects illegal transitions', () => {
  writeItem('epic', epic, '', { rootDir: tmp });
  expect(() => setStatus(tmp, 'EPIC-001', 'done'))
    .toThrow(/illegal transition/i);
});

test('setStatus throws for unknown ID', () => {
  expect(() => setStatus(tmp, 'EPIC-999', 'in_progress')).toThrow(/not found/i);
});

test('setStatus updates the updated timestamp', () => {
  writeItem('epic', { ...epic, updated: '2020-01-01' }, '', { rootDir: tmp });
  setStatus(tmp, 'EPIC-001', 'in_progress');
  const after = findById(tmp, 'EPIC-001');
  expect(after?.data.updated).not.toBe('2020-01-01');
});
```

- [ ] **Step 3: Run tests (should fail)**

```bash
bun test tests/core/picked.test.ts tests/core/operations.test.ts
```

Expected: FAIL.

- [ ] **Step 4: Implement picked**

Create `src/core/picked.ts`:

```typescript
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from './files';
import { parseId } from './ids';

const PICKED_FILE = '.picked';

function pickedPath(rootDir: string): string {
  return join(rootDir, '.kadai', PICKED_FILE);
}

export function readPicked(rootDir: string): string | null {
  const path = pickedPath(rootDir);
  if (!existsSync(path)) return null;
  const v = readFileSync(path, 'utf8').trim();
  return v.length === 0 ? null : v;
}

export function setPicked(rootDir: string, storyId: string): void {
  const parsed = parseId(storyId);
  if (!parsed || parsed.kind !== 'story') {
    throw new Error(`Only stories can be picked (got ${storyId})`);
  }
  writeFileAtomic(pickedPath(rootDir), storyId);
}

export function clearPicked(rootDir: string): void {
  const path = pickedPath(rootDir);
  if (existsSync(path)) unlinkSync(path);
}
```

- [ ] **Step 5: Implement operations**

Create `src/core/operations.ts`:

```typescript
import { findById } from './spine';
import { isLegalTransition, type Status } from './state-machine';
import { writeFileAtomic } from './files';
import { serialize } from './frontmatter';

export function setStatus(rootDir: string, id: string, newStatus: Status): void {
  const item = findById(rootDir, id);
  if (!item) throw new Error(`Item not found: ${id}`);
  if (!isLegalTransition(item.kind, item.data.status, newStatus)) {
    throw new Error(
      `Illegal transition for ${id} (${item.kind}): ${item.data.status} → ${newStatus}`,
    );
  }
  const updated = {
    ...item.data,
    status: newStatus,
    updated: new Date().toISOString().slice(0, 10),
  };
  writeFileAtomic(item.path, serialize(updated as Record<string, unknown>, item.body));
}
```

- [ ] **Step 6: Run tests (should pass)**

```bash
bun test tests/core/picked.test.ts tests/core/operations.test.ts
```

Expected: PASS — 8 tests across both files.

- [ ] **Step 7: Commit**

```bash
git add src/core/picked.ts src/core/operations.ts tests/core/picked.test.ts tests/core/operations.test.ts
git commit -m "feat(core): add picked-state module and setStatus operation [Plan-1 Task-15]"
```

---

## Task 16: CLI entry (barebones)

**Files:**
- Modify: `src/cli/index.ts`

**Goal:** Working CLI entry point that responds to `--version` and `--help`. Subcommands added in subsequent tasks.

- [ ] **Step 1: Implement entry**

Replace `src/cli/index.ts` with:

```typescript
#!/usr/bin/env bun
import { Command } from 'commander';

const program = new Command();
program
  .name('kadai')
  .description('Local-first product spine for projects driven by agentic coding')
  .version('0.1.0');

program.parseAsync(process.argv);
```

- [ ] **Step 2: Verify**

```bash
bun run src/cli/index.ts --version
bun run src/cli/index.ts --help
```

Expected: prints `0.1.0`, then prints help text.

- [ ] **Step 3: Commit**

```bash
git add src/cli/index.ts
git commit -m "feat(cli): add commander entry point [Plan-1 Task-16]"
```

---

## Task 17: CLI: `init` — filesystem + CLAUDE.md

**Files:**
- Create: `src/cli/init.ts`
- Create: `tests/cli/init.test.ts`
- Modify: `src/cli/index.ts`

**Goal:** `kadai init` creates `.kadai/`, writes default `config.toml`, writes `.kadai/README.md`, writes `.kadai/.gitignore`, and appends a kadai section to the project's `CLAUDE.md` (creating it if missing).

- [ ] **Step 1: Write the failing test**

Create `tests/cli/init.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { runInit } from '../../src/cli/init';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => { tmp = mkdtempSync(join(tmpdir(), 'kadai-init-')); });
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('init creates .kadai/ with config, README, .gitignore, epics dir', () => {
  runInit({ rootDir: tmp, productDescription: 'A test product', skipFirstEpic: true });
  expect(existsSync(join(tmp, '.kadai/config.toml'))).toBe(true);
  expect(existsSync(join(tmp, '.kadai/README.md'))).toBe(true);
  expect(existsSync(join(tmp, '.kadai/.gitignore'))).toBe(true);
  expect(existsSync(join(tmp, '.kadai/epics'))).toBe(true);
});

test('init writes product description to .kadai/README.md', () => {
  runInit({ rootDir: tmp, productDescription: 'My cool app', skipFirstEpic: true });
  const readme = readFileSync(join(tmp, '.kadai/README.md'), 'utf8');
  expect(readme).toContain('My cool app');
});

test('init creates CLAUDE.md with kadai section if missing', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const claude = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
  expect(claude).toContain('## Kadai');
});

test('init appends to existing CLAUDE.md without overwriting', () => {
  writeFileSync(join(tmp, 'CLAUDE.md'), '# My Project\n\nExisting content.\n');
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const claude = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
  expect(claude).toContain('Existing content');
  expect(claude).toContain('## Kadai');
});

test('init does not duplicate the kadai section on re-run', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const claude = readFileSync(join(tmp, 'CLAUDE.md'), 'utf8');
  const occurrences = claude.match(/## Kadai/g)?.length ?? 0;
  expect(occurrences).toBe(1);
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
bun test tests/cli/init.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/cli/init.ts`:

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import prompts from 'prompts';
import { saveConfig } from '../config/load';
import { DEFAULT_CONFIG } from '../config/defaults';
import { writeFileAtomic } from '../core/files';

export interface InitOptions {
  rootDir: string;
  productDescription: string;
  skipFirstEpic: boolean;
}

const KADAI_GITIGNORE = `.picked
bypass.log
`;

const CLAUDE_KADAI_SECTION = `## Kadai

This project uses kadai for product/feature/story tracking (spine in \`.kadai/\`).
Use the \`kadai\` CLI to read/update the spine — direct edits to \`.kadai/\` are allowed but \`kadai add\` validates schema and increments IDs.

Run \`kadai status\` to see the picked story and queue.
`;

function readmeContent(productDescription: string): string {
  return `# Product spine\n\n**Product:** ${productDescription}\n\nThis directory is the kadai spine — the source of truth for what this product should do.\n\n- \`epics/\` — top-level capability areas, each with \`features/\` and below them \`stories/\` and \`tasks/\`\n- \`config.toml\` — phases, auto-transition flags, guardrail allowlist\n- \`.counters.json\` — ID counters (committed)\n\nDon't edit by hand if you're not sure of the schema; use \`kadai add (epic|feature|story|task)\`.\n`;
}

export function runInit(opts: InitOptions): void {
  const kadaiDir = join(opts.rootDir, '.kadai');
  mkdirSync(join(kadaiDir, 'epics'), { recursive: true });

  if (!existsSync(join(kadaiDir, 'config.toml'))) {
    saveConfig(opts.rootDir, DEFAULT_CONFIG);
  }
  if (!existsSync(join(kadaiDir, 'README.md'))) {
    writeFileAtomic(join(kadaiDir, 'README.md'), readmeContent(opts.productDescription));
  }
  if (!existsSync(join(kadaiDir, '.gitignore'))) {
    writeFileAtomic(join(kadaiDir, '.gitignore'), KADAI_GITIGNORE);
  }

  appendKadaiSectionToClaudeMd(opts.rootDir);
}

function appendKadaiSectionToClaudeMd(rootDir: string): void {
  const path = join(rootDir, 'CLAUDE.md');
  let existing = '';
  if (existsSync(path)) {
    existing = readFileSync(path, 'utf8');
    if (existing.includes('## Kadai')) return;
  }
  const sep = existing && !existing.endsWith('\n') ? '\n\n' : existing ? '\n' : '';
  writeFileAtomic(path, existing + sep + CLAUDE_KADAI_SECTION);
}

export const initCommand = new Command('init')
  .description('Bootstrap a kadai spine in the current directory')
  .option('-y, --yes', 'skip prompts; use defaults')
  .action(async (opts: { yes?: boolean }) => {
    const rootDir = process.cwd();
    let productDescription = '';
    if (opts.yes) {
      productDescription = 'Untitled product';
    } else {
      const r = await prompts({
        type: 'text',
        name: 'productDescription',
        message: 'What is the product you are tracking?',
        initial: 'Untitled product',
      });
      productDescription = r.productDescription ?? 'Untitled product';
    }
    runInit({ rootDir, productDescription, skipFirstEpic: true });
    console.log(pc.green('✓ kadai initialized in ' + rootDir));
    console.log('  - .kadai/ created with config + README');
    console.log('  - CLAUDE.md updated with kadai section');
    console.log('Next: ' + pc.cyan('kadai add epic'));
  });
```

Modify `src/cli/index.ts` to register init:

```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { initCommand } from './init';

const program = new Command();
program
  .name('kadai')
  .description('Local-first product spine for projects driven by agentic coding')
  .version('0.1.0');

program.addCommand(initCommand);

program.parseAsync(process.argv);
```

- [ ] **Step 4: Run the test (should pass)**

```bash
bun test tests/cli/init.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Smoke-test the command**

```bash
mkdir -p /tmp/kadai-smoke-init && cd /tmp/kadai-smoke-init && bun run /home/fintan/repos/kadai/src/cli/index.ts init -y && ls -la .kadai && cat CLAUDE.md
```

Expected: directory created with `config.toml`, `README.md`, `.gitignore`, `epics/`. CLAUDE.md contains the kadai section.

```bash
rm -rf /tmp/kadai-smoke-init
```

- [ ] **Step 6: Commit**

```bash
git add src/cli/init.ts src/cli/index.ts tests/cli/init.test.ts
git commit -m "feat(cli): add kadai init (filesystem + CLAUDE.md) [Plan-1 Task-17]"
```

---

## Task 18: CLI: `init` — interactive wizard for first epic

**Files:**
- Modify: `src/cli/init.ts`
- Modify: `tests/cli/init.test.ts`

**Goal:** After filesystem creation, interactively offer to create the first epic via the `add epic` flow. Skipped with `--yes`.

> **Note on testing:** The wizard's interactive `prompts()` calls aren't unit-testable without mocking. We rely on the smoke test (Task 25) to manually verify the wizard prompts work. The `runInit` core function is already covered by Task 17's tests.

- [ ] **Step 1: Add the wizard to the action handler**

In `src/cli/init.ts`, replace the `initCommand` action with:

```typescript
export const initCommand = new Command('init')
  .description('Bootstrap a kadai spine in the current directory')
  .option('-y, --yes', 'skip prompts; use defaults; no first epic')
  .action(async (opts: { yes?: boolean }) => {
    const rootDir = process.cwd();
    let productDescription = 'Untitled product';
    let createFirstEpic = false;
    let firstEpicTitle = '';

    if (!opts.yes) {
      const r1 = await prompts({
        type: 'text',
        name: 'productDescription',
        message: 'What is the product you are tracking?',
        initial: 'Untitled product',
      });
      productDescription = r1.productDescription ?? 'Untitled product';

      const r2 = await prompts({
        type: 'confirm',
        name: 'createFirstEpic',
        message: 'Want to create your first epic now?',
        initial: true,
      });
      createFirstEpic = !!r2.createFirstEpic;

      if (createFirstEpic) {
        const r3 = await prompts({
          type: 'text',
          name: 'firstEpicTitle',
          message: 'First epic title:',
          initial: 'Project setup',
        });
        firstEpicTitle = r3.firstEpicTitle ?? 'Project setup';
      }
    }

    runInit({ rootDir, productDescription, skipFirstEpic: !createFirstEpic });
    console.log(pc.green('✓ kadai initialized in ' + rootDir));

    if (createFirstEpic && firstEpicTitle) {
      const { runAdd } = await import('./add');
      runAdd({
        rootDir,
        kind: 'epic',
        title: firstEpicTitle,
        phase: DEFAULT_CONFIG.phases[0].slug,
      });
      console.log(pc.green('✓ first epic created'));
    }
    console.log('Next: ' + pc.cyan('kadai add feature'));
  });
```

- [ ] **Step 2: Verify type-check + existing tests still pass**

```bash
bun run typecheck
bun test tests/cli/init.test.ts
```

Expected: typecheck clean; init tests still PASS (5 tests).

> Note: `runAdd` is implemented in Task 19. This task imports it dynamically (`await import('./add')`) so this file compiles before Task 19 lands. Until Task 19 is done, the wizard's epic-creation branch will throw at runtime if exercised. Tests don't exercise it; manual smoke after Task 19 will.

- [ ] **Step 3: Commit**

```bash
git add src/cli/init.ts
git commit -m "feat(cli): add interactive wizard to kadai init [Plan-1 Task-18]"
```

---

## Task 19: CLI: `add` (parameterized for all 4 types)

**Files:**
- Create: `src/cli/add.ts`
- Create: `tests/cli/add.test.ts`
- Modify: `src/cli/index.ts`

**Goal:** `kadai add <kind>` creates an item. Supports `--id`, `--title`, `--phase`, `--order`, `--parent` flags. Interactive when flags are missing.

- [ ] **Step 1: Write the failing test**

Create `tests/cli/add.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { runAdd } from '../../src/cli/add';
import { runInit } from '../../src/cli/init';
import { findById } from '../../src/core/spine';
import { mkdtempSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-add-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runAdd creates an epic with auto ID', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  const item = findById(tmp, 'EPIC-001');
  expect(item?.data.title).toBe('Auth');
  expect(item?.data.status).toBe('ready');
});

test('runAdd auto-orders within phase', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'mvp' });
  const a = findById(tmp, 'EPIC-001');
  const b = findById(tmp, 'EPIC-002');
  expect(a?.data.order).toBe(10);
  expect(b?.data.order).toBe(20);
});

test('runAdd creates a feature under an epic', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  const feat = findById(tmp, 'FEAT-001');
  expect(feat?.data.title).toBe('Login');
  expect((feat?.data as any).parent).toBe('EPIC-001');
});

test('runAdd rejects feature without parent', () => {
  expect(() => runAdd({ rootDir: tmp, kind: 'feature', title: 'X', phase: 'mvp' }))
    .toThrow(/parent required/i);
});

test('runAdd rejects feature with bad parent kind', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  expect(() => runAdd({ rootDir: tmp, kind: 'story', title: 'X', phase: 'mvp', parent: 'EPIC-001' }))
    .toThrow(/parent must be a/i);
});

test('runAdd creates a task without phase/order (inherits)', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T', parent: 'STORY-001' });
  const task = findById(tmp, 'TASK-001');
  expect(task?.data.title).toBe('T');
  expect((task?.data as any).parent).toBe('STORY-001');
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
bun test tests/cli/add.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/cli/add.ts`:

```typescript
import { dirname } from 'node:path';
import { Command } from 'commander';
import pc from 'picocolors';
import prompts from 'prompts';
import { nextId, parseId } from '../core/ids';
import { writeItem } from '../core/writer';
import { findById, walkSpine } from '../core/spine';
import { nextOrder } from '../core/ordering';
import type { ItemKind } from '../core/state-machine';
import type { AnyFrontmatter } from '../core/types';

export interface AddOptions {
  rootDir: string;
  kind: ItemKind;
  title: string;
  phase?: string;
  order?: number;
  parent?: string;
}

const PARENT_KIND: Record<ItemKind, ItemKind | null> = {
  epic: null,
  feature: 'epic',
  story: 'feature',
  task: 'story',
};

export function runAdd(opts: AddOptions): string {
  const expectedParentKind = PARENT_KIND[opts.kind];
  if (expectedParentKind && !opts.parent) {
    throw new Error(`parent required for ${opts.kind}`);
  }
  let parentItem = null;
  if (opts.parent) {
    const parsed = parseId(opts.parent);
    if (!parsed) throw new Error(`invalid parent ID: ${opts.parent}`);
    if (parsed.kind !== expectedParentKind) {
      throw new Error(`parent must be a ${expectedParentKind} (got ${parsed.kind})`);
    }
    parentItem = findById(opts.rootDir, opts.parent);
    if (!parentItem) throw new Error(`parent not found: ${opts.parent}`);
  }

  const id = nextId(opts.kind, opts.rootDir);
  const today = new Date().toISOString().slice(0, 10);

  const data: Record<string, unknown> = {
    id,
    title: opts.title,
    status: 'ready',
    created: today,
    updated: today,
  };
  if (opts.parent) data.parent = opts.parent;

  if (opts.kind !== 'task') {
    if (!opts.phase) throw new Error(`phase required for ${opts.kind}`);
    data.phase = opts.phase;
    if (typeof opts.order === 'number') {
      data.order = opts.order;
    } else {
      const siblings = walkSpine(opts.rootDir).filter(
        i => i.kind === opts.kind && (i.data as any).phase === opts.phase
          && (!opts.parent || (i.data as any).parent === opts.parent),
      ).map(i => ({ order: (i.data as any).order as number }));
      data.order = nextOrder(siblings);
    }
  }

  const ctx = { rootDir: opts.rootDir, parentPath: parentItem ? dirname(parentItem.path) : undefined };
  writeItem(opts.kind, data as AnyFrontmatter, '## Description\n\n_Add a description here._\n', ctx);
  return id;
}

export const addCommand = new Command('add')
  .description('Create an epic, feature, story, or task')
  .argument('<kind>', 'kind of item (epic|feature|story|task)')
  .option('-t, --title <title>', 'title of the item')
  .option('-p, --phase <phase>', 'phase slug (e.g. mvp)')
  .option('-o, --order <n>', 'explicit order within phase', (v) => parseInt(v, 10))
  .option('--parent <id>', 'parent item ID (required except for epics)')
  .action(async (kind: string, opts: { title?: string; phase?: string; order?: number; parent?: string }) => {
    if (!['epic', 'feature', 'story', 'task'].includes(kind)) {
      throw new Error(`unknown kind: ${kind}`);
    }
    const k = kind as ItemKind;
    let title = opts.title;
    let phase = opts.phase;
    let parent = opts.parent;

    if (!title) {
      const r = await prompts({ type: 'text', name: 'title', message: `${k} title:` });
      title = r.title;
    }
    if (!title) throw new Error('title is required');

    if (k !== 'task' && !phase) {
      const r = await prompts({
        type: 'text', name: 'phase', message: 'phase slug:', initial: 'mvp',
      });
      phase = r.phase ?? 'mvp';
    }

    if (PARENT_KIND[k] && !parent) {
      const r = await prompts({
        type: 'text', name: 'parent', message: `parent ${PARENT_KIND[k]} ID:`,
      });
      parent = r.parent;
    }

    const id = runAdd({
      rootDir: process.cwd(),
      kind: k,
      title,
      phase,
      order: opts.order,
      parent,
    });
    console.log(pc.green(`✓ created ${id}`));
  });
```

Modify `src/cli/index.ts` to register `addCommand`:

```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { initCommand } from './init';
import { addCommand } from './add';

const program = new Command();
program
  .name('kadai')
  .description('Local-first product spine for projects driven by agentic coding')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(addCommand);

program.parseAsync(process.argv);
```

- [ ] **Step 4: Run the test (should pass)**

```bash
bun test tests/cli/add.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cli/add.ts src/cli/index.ts tests/cli/add.test.ts
git commit -m "feat(cli): add 'kadai add' for all 4 item kinds [Plan-1 Task-19]"
```

---

## Task 20: CLI: `list` with filters

**Files:**
- Create: `src/cli/list.ts`
- Create: `tests/cli/list.test.ts`
- Modify: `src/cli/index.ts`

**Goal:** `kadai list <kind> [--phase] [--status] [--parent]` prints items matching filters.

- [ ] **Step 1: Write the failing test**

Create `tests/cli/list.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { runList } from '../../src/cli/list';
import { runAdd } from '../../src/cli/add';
import { runInit } from '../../src/cli/init';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-list-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runList returns all epics when no filters', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'v1' });
  const items = runList({ rootDir: tmp, kind: 'epic' });
  expect(items.length).toBe(2);
});

test('runList filters by phase', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'v1' });
  const items = runList({ rootDir: tmp, kind: 'epic', phase: 'mvp' });
  expect(items.length).toBe(1);
  expect(items[0].data.title).toBe('A');
});

test('runList filters by parent', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F1', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F2', phase: 'mvp', parent: 'EPIC-002' });
  const items = runList({ rootDir: tmp, kind: 'feature', parent: 'EPIC-001' });
  expect(items.length).toBe(1);
  expect(items[0].data.id).toBe('FEAT-001');
});

test('runList filters by status', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  // status defaults to 'ready', filter for something else returns empty
  expect(runList({ rootDir: tmp, kind: 'epic', status: 'done' }).length).toBe(0);
  expect(runList({ rootDir: tmp, kind: 'epic', status: 'ready' }).length).toBe(1);
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
bun test tests/cli/list.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/cli/list.ts`:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { walkSpine } from '../core/spine';
import type { Item } from '../core/types';
import type { ItemKind, Status } from '../core/state-machine';

export interface ListOptions {
  rootDir: string;
  kind: ItemKind;
  phase?: string;
  status?: Status;
  parent?: string;
}

export function runList(opts: ListOptions): Item[] {
  return walkSpine(opts.rootDir).filter(item => {
    if (item.kind !== opts.kind) return false;
    if (opts.phase && (item.data as any).phase !== opts.phase) return false;
    if (opts.status && item.data.status !== opts.status) return false;
    if (opts.parent && (item.data as any).parent !== opts.parent) return false;
    return true;
  });
}

export const listCommand = new Command('list')
  .description('List items in the spine')
  .argument('<kind>', 'kind of item (epic|feature|story|task)')
  .option('-p, --phase <phase>', 'filter by phase')
  .option('-s, --status <status>', 'filter by status')
  .option('--parent <id>', 'filter by parent ID')
  .action((kind: string, opts: { phase?: string; status?: Status; parent?: string }) => {
    const items = runList({
      rootDir: process.cwd(),
      kind: kind as ItemKind,
      phase: opts.phase,
      status: opts.status,
      parent: opts.parent,
    });
    if (items.length === 0) {
      console.log(pc.dim('(no items match)'));
      return;
    }
    for (const item of items) {
      const d = item.data as any;
      const phase = d.phase ? pc.cyan(d.phase) : pc.dim('—');
      const order = d.order ? String(d.order).padStart(3) : '   ';
      console.log(
        `${pc.bold(d.id.padEnd(12))} ${phase.padEnd(20)} ${order}  ${pc.yellow(d.status.padEnd(12))}  ${d.title}`,
      );
    }
  });
```

Modify `src/cli/index.ts`:

```typescript
import { listCommand } from './list';
// ...
program.addCommand(listCommand);
```

- [ ] **Step 4: Run the test (should pass)**

```bash
bun test tests/cli/list.test.ts
```

Expected: PASS — 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cli/list.ts src/cli/index.ts tests/cli/list.test.ts
git commit -m "feat(cli): add 'kadai list' with filters [Plan-1 Task-20]"
```

---

## Task 21: CLI: `status`

**Files:**
- Create: `src/cli/status.ts`
- Create: `tests/cli/status.test.ts`
- Modify: `src/cli/index.ts`

**Goal:** `kadai status` prints the picked story (if any), the ready queue (next things to work on), and recent items by phase.

- [ ] **Step 1: Write the failing test**

Create `tests/cli/status.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { computeStatus } from '../../src/cli/status';
import { runAdd } from '../../src/cli/add';
import { runInit } from '../../src/cli/init';
import { setPicked } from '../../src/core/picked';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-status-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('computeStatus returns picked=null when nothing picked', () => {
  const s = computeStatus(tmp);
  expect(s.picked).toBeNull();
});

test('computeStatus returns picked story when set', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  setPicked(tmp, 'STORY-001');
  const s = computeStatus(tmp);
  expect(s.picked?.data.id).toBe('STORY-001');
});

test('computeStatus returns ready stories in queue', () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S1', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S2', phase: 'mvp', parent: 'FEAT-001' });
  const s = computeStatus(tmp);
  expect(s.readyStories.length).toBe(2);
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
bun test tests/cli/status.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/cli/status.ts`:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { walkSpine, findById } from '../core/spine';
import { readPicked } from '../core/picked';
import type { Item } from '../core/types';

export interface StatusReport {
  picked: Item | null;
  readyStories: Item[];
  inProgress: Item[];
}

export function computeStatus(rootDir: string): StatusReport {
  const items = walkSpine(rootDir);
  const pickedId = readPicked(rootDir);
  const picked = pickedId ? findById(rootDir, pickedId) : null;
  const readyStories = items.filter(i => i.kind === 'story' && i.data.status === 'ready');
  const inProgress = items.filter(i => i.data.status === 'in_progress');
  return { picked, readyStories, inProgress };
}

export const statusCommand = new Command('status')
  .description('Show picked story, queue, and in-progress items')
  .action(() => {
    const s = computeStatus(process.cwd());
    if (s.picked) {
      const d = s.picked.data as any;
      console.log(pc.bold('Picked: ') + pc.green(d.id) + ' — ' + d.title);
    } else {
      console.log(pc.bold('Picked: ') + pc.dim('(nothing)'));
    }

    console.log('\n' + pc.bold('In progress (' + s.inProgress.length + '):'));
    for (const item of s.inProgress) {
      const d = item.data as any;
      console.log('  ' + d.id.padEnd(12) + ' ' + d.title);
    }

    console.log('\n' + pc.bold('Ready stories (' + s.readyStories.length + '):'));
    for (const item of s.readyStories) {
      const d = item.data as any;
      console.log('  ' + d.id.padEnd(12) + ' ' + d.title);
    }
  });
```

Modify `src/cli/index.ts`:

```typescript
import { statusCommand } from './status';
// ...
program.addCommand(statusCommand);
```

- [ ] **Step 4: Run the test (should pass)**

```bash
bun test tests/cli/status.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cli/status.ts src/cli/index.ts tests/cli/status.test.ts
git commit -m "feat(cli): add 'kadai status' [Plan-1 Task-21]"
```

---

## Task 22: CLI: `pick` + `unpick`

**Files:**
- Create: `src/cli/pick.ts`
- Create: `tests/cli/pick.test.ts`
- Modify: `src/cli/index.ts`

**Goal:** `kadai pick <story-id>` sets the picked story and transitions its status to `in_progress`. `kadai unpick` clears the picked flag (does NOT change status).

- [ ] **Step 1: Write the failing test**

Create `tests/cli/pick.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { runPick, runUnpick } from '../../src/cli/pick';
import { runAdd } from '../../src/cli/add';
import { runInit } from '../../src/cli/init';
import { readPicked } from '../../src/core/picked';
import { findById } from '../../src/core/spine';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-pick-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('runPick sets picked and transitions story to in_progress', () => {
  runPick(tmp, 'STORY-001');
  expect(readPicked(tmp)).toBe('STORY-001');
  expect(findById(tmp, 'STORY-001')?.data.status).toBe('in_progress');
});

test('runPick rejects non-story IDs', () => {
  expect(() => runPick(tmp, 'EPIC-001')).toThrow(/only stories/i);
});

test('runPick rejects unknown story ID', () => {
  expect(() => runPick(tmp, 'STORY-999')).toThrow(/not found/i);
});

test('runPick of already-in-progress story is idempotent (no error)', () => {
  runPick(tmp, 'STORY-001');
  runPick(tmp, 'STORY-001');
  expect(readPicked(tmp)).toBe('STORY-001');
});

test('runUnpick clears picked but does not change status', () => {
  runPick(tmp, 'STORY-001');
  runUnpick(tmp);
  expect(readPicked(tmp)).toBeNull();
  expect(findById(tmp, 'STORY-001')?.data.status).toBe('in_progress');
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
bun test tests/cli/pick.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/cli/pick.ts`:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { setPicked, clearPicked } from '../core/picked';
import { setStatus } from '../core/operations';
import { findById } from '../core/spine';
import { parseId } from '../core/ids';

export function runPick(rootDir: string, storyId: string): void {
  const parsed = parseId(storyId);
  if (!parsed || parsed.kind !== 'story') {
    throw new Error(`Only stories can be picked (got ${storyId})`);
  }
  const item = findById(rootDir, storyId);
  if (!item) throw new Error(`Story not found: ${storyId}`);
  if (item.data.status !== 'in_progress') {
    setStatus(rootDir, storyId, 'in_progress');
  }
  setPicked(rootDir, storyId);
}

export function runUnpick(rootDir: string): void {
  clearPicked(rootDir);
}

export const pickCommand = new Command('pick')
  .description('Pick a story for active work (sets it as picked and transitions to in_progress)')
  .argument('<story-id>', 'story ID like STORY-042')
  .action((storyId: string) => {
    runPick(process.cwd(), storyId);
    console.log(pc.green('✓ picked ' + storyId));
  });

export const unpickCommand = new Command('unpick')
  .description('Clear the picked story (does not change status)')
  .action(() => {
    runUnpick(process.cwd());
    console.log(pc.green('✓ unpicked'));
  });
```

Modify `src/cli/index.ts`:

```typescript
import { pickCommand, unpickCommand } from './pick';
// ...
program.addCommand(pickCommand);
program.addCommand(unpickCommand);
```

- [ ] **Step 4: Run the test (should pass)**

```bash
bun test tests/cli/pick.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cli/pick.ts src/cli/index.ts tests/cli/pick.test.ts
git commit -m "feat(cli): add 'kadai pick' and 'kadai unpick' [Plan-1 Task-22]"
```

---

## Task 23: CLI: `phases` (list + add + remove + rename)

**Files:**
- Create: `src/cli/phases.ts`
- Create: `tests/cli/phases.test.ts`
- Modify: `src/cli/index.ts`

**Goal:** `kadai phases` (list), `kadai phases add <slug>`, `kadai phases remove <slug>`, `kadai phases rename <old> <new>`.

- [ ] **Step 1: Write the failing test**

Create `tests/cli/phases.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { listPhases, addPhase, removePhase, renamePhase } from '../../src/cli/phases';
import { runInit } from '../../src/cli/init';
import { loadConfig } from '../../src/config/load';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-phases-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('listPhases returns the default phases', () => {
  const slugs = listPhases(tmp).map(p => p.slug);
  expect(slugs).toEqual(['mvp', 'v1', 'future', 'parking-lot']);
});

test('addPhase appends a new phase', () => {
  addPhase(tmp, 'v2', 'v2.0', '#ff0000');
  const slugs = listPhases(tmp).map(p => p.slug);
  expect(slugs).toContain('v2');
});

test('addPhase rejects duplicate slug', () => {
  expect(() => addPhase(tmp, 'mvp', 'X', '#000')).toThrow(/already exists/i);
});

test('removePhase removes a phase', () => {
  removePhase(tmp, 'parking-lot');
  expect(listPhases(tmp).map(p => p.slug)).not.toContain('parking-lot');
});

test('removePhase throws for unknown slug', () => {
  expect(() => removePhase(tmp, 'nonexistent')).toThrow(/not found/i);
});

test('renamePhase changes display and slug', () => {
  renamePhase(tmp, 'v1', 'v1-rebrand', 'V1 Rebrand');
  const found = listPhases(tmp).find(p => p.slug === 'v1-rebrand');
  expect(found?.display).toBe('V1 Rebrand');
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
bun test tests/cli/phases.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/cli/phases.ts`:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { loadConfig, saveConfig } from '../config/load';
import type { PhaseConfig } from '../config/types';

export function listPhases(rootDir: string): PhaseConfig[] {
  return loadConfig(rootDir).phases;
}

export function addPhase(rootDir: string, slug: string, display: string, color: string): void {
  const cfg = loadConfig(rootDir);
  if (cfg.phases.some(p => p.slug === slug)) {
    throw new Error(`Phase "${slug}" already exists`);
  }
  cfg.phases.push({ slug, display, color });
  saveConfig(rootDir, cfg);
}

export function removePhase(rootDir: string, slug: string): void {
  const cfg = loadConfig(rootDir);
  const idx = cfg.phases.findIndex(p => p.slug === slug);
  if (idx === -1) throw new Error(`Phase "${slug}" not found`);
  cfg.phases.splice(idx, 1);
  saveConfig(rootDir, cfg);
}

export function renamePhase(rootDir: string, oldSlug: string, newSlug: string, newDisplay: string): void {
  const cfg = loadConfig(rootDir);
  const phase = cfg.phases.find(p => p.slug === oldSlug);
  if (!phase) throw new Error(`Phase "${oldSlug}" not found`);
  phase.slug = newSlug;
  phase.display = newDisplay;
  saveConfig(rootDir, cfg);
}

export const phasesCommand = new Command('phases')
  .description('Manage phases (list/add/remove/rename)');

phasesCommand
  .command('list', { isDefault: true })
  .description('List configured phases')
  .action(() => {
    for (const p of listPhases(process.cwd())) {
      console.log(`${pc.bold(p.slug.padEnd(20))} ${pc.dim(p.color)}  ${p.display}`);
    }
  });

phasesCommand
  .command('add')
  .argument('<slug>')
  .argument('<display>')
  .argument('[color]', 'hex color', '#888888')
  .action((slug: string, display: string, color: string) => {
    addPhase(process.cwd(), slug, display, color);
    console.log(pc.green(`✓ added phase ${slug}`));
  });

phasesCommand
  .command('remove')
  .argument('<slug>')
  .action((slug: string) => {
    removePhase(process.cwd(), slug);
    console.log(pc.green(`✓ removed phase ${slug}`));
  });

phasesCommand
  .command('rename')
  .argument('<oldSlug>')
  .argument('<newSlug>')
  .argument('<newDisplay>')
  .action((oldSlug: string, newSlug: string, newDisplay: string) => {
    renamePhase(process.cwd(), oldSlug, newSlug, newDisplay);
    console.log(pc.green(`✓ renamed ${oldSlug} → ${newSlug}`));
  });
```

Modify `src/cli/index.ts`:

```typescript
import { phasesCommand } from './phases';
// ...
program.addCommand(phasesCommand);
```

- [ ] **Step 4: Run the test (should pass)**

```bash
bun test tests/cli/phases.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cli/phases.ts src/cli/index.ts tests/cli/phases.test.ts
git commit -m "feat(cli): add 'kadai phases' (list/add/remove/rename) [Plan-1 Task-23]"
```

---

## Task 24: CLI: `config` get + set

**Files:**
- Create: `src/cli/config.ts`
- Create: `tests/cli/config.test.ts`
- Modify: `src/cli/index.ts`

**Goal:** `kadai config <key>` reads, `kadai config <key>=<value>` writes (string/bool/number type-coerced based on existing value).

- [ ] **Step 1: Write the failing test**

Create `tests/cli/config.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { getConfigKey, setConfigKey } from '../../src/cli/config';
import { runInit } from '../../src/cli/init';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-cfg-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('getConfigKey reads a nested boolean', () => {
  expect(getConfigKey(tmp, 'change_capture.enabled')).toBe(true);
});

test('getConfigKey reads a nested array', () => {
  const v = getConfigKey(tmp, 'guardrail.allowed_paths');
  expect(Array.isArray(v)).toBe(true);
  expect(v).toContain('docs/');
});

test('setConfigKey writes a boolean', () => {
  setConfigKey(tmp, 'change_capture.enabled', 'false');
  expect(getConfigKey(tmp, 'change_capture.enabled')).toBe(false);
});

test('setConfigKey writes a flag in auto_transitions', () => {
  setConfigKey(tmp, 'auto_transitions.pr_merge_marks_story_done', 'true');
  expect(getConfigKey(tmp, 'auto_transitions.pr_merge_marks_story_done')).toBe(true);
});

test('getConfigKey throws on unknown key', () => {
  expect(() => getConfigKey(tmp, 'foo.bar')).toThrow(/unknown config key/i);
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
bun test tests/cli/config.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `src/cli/config.ts`:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { loadConfig, saveConfig } from '../config/load';

function getNested(obj: unknown, path: string[]): unknown {
  let cur: any = obj;
  for (const segment of path) {
    if (cur === undefined || cur === null) return undefined;
    cur = cur[segment];
  }
  return cur;
}

function setNested(obj: any, path: string[], value: unknown): void {
  let cur = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (cur[path[i]] === undefined) cur[path[i]] = {};
    cur = cur[path[i]];
  }
  cur[path[path.length - 1]] = value;
}

function coerce(existing: unknown, raw: string): unknown {
  if (typeof existing === 'boolean') return raw === 'true';
  if (typeof existing === 'number') return Number(raw);
  return raw;
}

export function getConfigKey(rootDir: string, key: string): unknown {
  const cfg = loadConfig(rootDir);
  const path = key.split('.');
  const v = getNested(cfg, path);
  if (v === undefined) throw new Error(`Unknown config key: ${key}`);
  return v;
}

export function setConfigKey(rootDir: string, key: string, rawValue: string): void {
  const cfg = loadConfig(rootDir);
  const path = key.split('.');
  const existing = getNested(cfg, path);
  if (existing === undefined) throw new Error(`Unknown config key: ${key}`);
  setNested(cfg, path, coerce(existing, rawValue));
  saveConfig(rootDir, cfg);
}

export const configCommand = new Command('config')
  .description('Read or write a config key (e.g. "change_capture.enabled" or "change_capture.enabled=false")')
  .argument('<expr>', 'KEY or KEY=VALUE')
  .action((expr: string) => {
    const eq = expr.indexOf('=');
    const rootDir = process.cwd();
    if (eq === -1) {
      console.log(JSON.stringify(getConfigKey(rootDir, expr)));
    } else {
      const key = expr.slice(0, eq);
      const value = expr.slice(eq + 1);
      setConfigKey(rootDir, key, value);
      console.log(pc.green(`✓ set ${key}=${value}`));
    }
  });
```

Modify `src/cli/index.ts`:

```typescript
import { configCommand } from './config';
// ...
program.addCommand(configCommand);
```

- [ ] **Step 4: Run the test (should pass)**

```bash
bun test tests/cli/config.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/cli/config.ts src/cli/index.ts tests/cli/config.test.ts
git commit -m "feat(cli): add 'kadai config' get/set [Plan-1 Task-24]"
```

---

## Task 25: End-to-end smoke test

**Files:**
- (no new files; manual verification + script)

**Goal:** Confirm the full CLI works end-to-end in a fresh project.

- [ ] **Step 1: Run the full test suite**

```bash
bun test
bun run typecheck
```

Expected: all tests pass; no type errors.

- [ ] **Step 2: Link kadai globally so `kadai` is on PATH**

From the kadai repo root:

```bash
bun link
```

Expected: bun reports `Success! Registered "kadai"`. Then `kadai --version` should print `0.1.0` from any directory.

> If `bun link` doesn't expose the binary on your PATH, fall back in step 3 to `bun run "$REPO/src/cli/index.ts" <args>` where `REPO` is the absolute path to this repo.

- [ ] **Step 3: Smoke-test the CLI in a temp directory**

```bash
TMP=$(mktemp -d)
cd "$TMP"
kadai init -y
kadai add epic --title 'Authentication' --phase mvp
kadai add feature --title 'User login' --phase mvp --parent EPIC-001
kadai add story --title 'Email login' --phase mvp --parent FEAT-001
kadai add task --title 'bcrypt hashing' --parent STORY-001
kadai list epic
kadai list story --status ready
kadai pick STORY-001
kadai status
kadai list story --status in_progress
kadai unpick
kadai phases list
kadai config change_capture.enabled
kadai config change_capture.enabled=false
ls -la .kadai/epics/EPIC-001-authentication/features/FEAT-001-user-login/stories/STORY-001-email-login/tasks/
cat .kadai/epics/EPIC-001-authentication/epic.md
echo "Smoke OK"
cd / && rm -rf "$TMP"
```

Expected: each command runs without error; the directory tree mirrors the design from spec §2; the picked story moves to `in_progress` and back; config get/set roundtrips.

- [ ] **Step 4: Verify the kadai repo itself still tests clean**

Return to the kadai repo and re-run:

```bash
bun test
bun run typecheck
```

Expected: all green.

- [ ] **Step 5: Commit (an empty commit to mark the milestone if needed; otherwise skip)**

If steps 1–3 pass without any code changes needed, no commit is necessary for this task. If you had to fix anything, commit those fixes:

```bash
git add -A
git commit -m "test(plan-1): end-to-end smoke pass [Plan-1 Task-25]"
```

---

## Plan 1 self-review checklist

(Run before declaring Plan 1 complete.)

- [ ] All 25 task checkboxes above ticked.
- [ ] `bun test` passes with 0 failures.
- [ ] `bun run typecheck` passes (no type errors).
- [ ] Manual smoke test (Task 25) completed without error.
- [ ] [`/CLAUDE.md`](../../../CLAUDE.md) "Active plan" section updated to point to Plan 2.
- [ ] [`README.md`](README.md) status column updated: Plan 1 → `DONE`, Plan 2 → `IN PROGRESS`.

---

## Proceed to Plan 2

When all checkboxes above are ticked:

1. Update [`README.md`](README.md): mark Plan 1 status `DONE`, Plan 2 status `IN PROGRESS`.
2. Update [`/CLAUDE.md`](../../../CLAUDE.md) "Active plan" section to: `Plan 2 — MCP server` with the new file link.
3. Run: `/writing-plans` and reference [`2026-05-05-kadai-02-mcp-server.md`](2026-05-05-kadai-02-mcp-server.md) — that stub already documents inputs (which functions/types Plan 1 has exported), outputs, and trigger conditions for the next slice.
4. **Do not start Plan 2 implementation work without first running `/writing-plans` against the stub.** The stub is a description, not an executable plan.

If a fresh Claude session is reading this after a compaction:
- Verify each task above by checking the corresponding source files exist and `bun test` passes
- The first unchecked `- [ ]` task above is your next action
- The spec at [`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md) is the source of truth — this plan implements §1–§4, §7, and §8 (partially — `kadai init` is extended in Plans 2 and 3)
