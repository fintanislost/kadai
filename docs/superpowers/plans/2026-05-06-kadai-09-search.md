# Kadai Plan 9 — Search

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Spine-wide full-text search from the web viewer. Type a query in the top-bar search box, press Enter, see ranked results at `/search?q=...` with snippet excerpts and one-click navigation to each item.

**Architecture:** Extract the existing MCP search-matching logic into `src/core/search.ts` so it returns rich `SearchResult` records (id, kind, title, snippet, match offsets). The web API gains `GET /api/search?q=...` wrapping the core function. The React side adds a search input to the `Layout` top bar, a new `/search` route, and a results page that highlights matches inside snippets via `<mark>`. The MCP `search` tool keeps its existing `Item[]` return contract for backwards compatibility — it now delegates to `searchSpine()` and maps results back to `Item`.

**Tech Stack:** TypeScript on Bun (existing). React 19 + TanStack Router (existing). No new runtime dependencies.

## Position in the build

| | |
|---|---|
| **This is plan** | 9 of N |
| **Prior plan** | [Plan 8 — SSE live updates](2026-05-06-kadai-08-sse-live-updates.md) — `DONE` |
| **Next plan** | Plan 10 — Git integration (`kadai sync`), per [post-mvp.md](../../wiki/post-mvp.md) |
| **Index** | [README.md](README.md) |
| **Backlog** | [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md) |

## What ships at the end

- `src/core/search.ts` — `searchSpine(rootDir, query): SearchResult[]` with `SearchResult { id, kind, title, phase?, status, matchType, snippet, matchStart, matchEnd }`.
- `src/mcp/handlers/search.ts` — refactored to delegate to core; preserves existing `Item[]` return shape.
- `src/web/api.ts` — `GET /api/search?q=...` returns `SearchResult[]` (or `[]` for queries < 2 chars; 400 if `q` missing).
- `src/web/frontend/src/api.ts` — `searchSpine(query): Promise<SearchResult[]>` client wrapper.
- `src/web/frontend/src/components/SearchBox.tsx` — top-bar input that navigates to `/search?q=...` on Enter.
- `src/web/frontend/src/components/Layout.tsx` — wires `SearchBox` into the header.
- `src/web/frontend/src/pages/Search.tsx` — results page with snippet highlighting.
- `src/web/frontend/src/router.tsx` — adds the `/search` route with `q` search param.
- ~12 new unit/integration tests + 1 Playwright E2E flow.
- `docs/wiki/api-reference.md` — `/api/search` row + Search section.
- `docs/wiki/web-viewer.md` — note the search box.
- Plugin version 0.4.0 → 0.5.0.
- All ~215 existing tests still pass; 7 Playwright E2E pass + 1 new = 8 total.

## Out of scope (deferred)

- Search across attached `spec.md` / `plan.md` / `changelog.md` files (only frontmatter title/body/acceptance_criteria for now — that's the existing MCP behavior).
- Result ranking by relevance (title-match-first is the only ordering; body matches preserve walk order).
- Fuzzy/typo matching (substring exact only).
- Result paging (full list returned; spines are small).
- Search history / autocomplete / recent queries.
- Keyboard arrow-key navigation through results.
- Min query length is 2 — single-char queries return empty (avoids "a" matching everything).

## File structure

```
src/core/search.ts                                        # NEW: searchSpine + SearchResult + makeSnippet
src/mcp/handlers/search.ts                                # MODIFIED: delegate to core, return Item[]

src/web/api.ts                                            # MODIFIED: add GET /api/search route

src/web/frontend/src/api.ts                               # MODIFIED: add searchSpine client + SearchResult type
src/web/frontend/src/components/SearchBox.tsx             # NEW: top-bar input
src/web/frontend/src/components/Layout.tsx                # MODIFIED: render SearchBox
src/web/frontend/src/pages/Search.tsx                     # NEW: results page with snippet highlighting
src/web/frontend/src/router.tsx                           # MODIFIED: add /search route

tests/core/search.test.ts                                 # NEW: searchSpine + makeSnippet unit tests
tests/web/api.test.ts                                     # MODIFIED: add 4 new tests for /api/search
tests/web/e2e.pw.ts                                       # MODIFIED: add 1 Playwright flow

docs/wiki/api-reference.md                                # MODIFIED: /api/search row + Search section
docs/wiki/web-viewer.md                                   # MODIFIED: mention top-bar search
docs/wiki/post-mvp.md                                     # MODIFIED: Plan 9 → Recently shipped, Plan 10 → next
docs/dogfood-acceptance-test.md                           # APPEND: Plan 9 verification
kadai-plugin/.claude-plugin/plugin.json                   # MODIFIED: 0.4.0 → 0.5.0
```

## Tasks

---

### Task 1: Extract search to core with snippet support

**Files:**
- Create: `src/core/search.ts`
- Create: `tests/core/search.test.ts`
- Modify: `src/mcp/handlers/search.ts` (delegate to core)

**Goal:** A pure `searchSpine(rootDir, query): SearchResult[]` that walks the spine, matches case-insensitively against title / body / acceptance criteria, and returns rich result records with snippet excerpts and match offsets. MCP keeps its `Item[]` contract by mapping back through `findById`.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/core/search.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { searchSpine, makeSnippet } from '../../src/core/search';
import { findById } from '../../src/core/spine';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-search-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Authentication', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Email login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Magic link delivery', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('makeSnippet: short text returns the full text', () => {
  const r = makeSnippet('hello world', 'world');
  expect(r.snippet).toBe('hello world');
  expect(r.matchStart).toBe(6);
  expect(r.matchEnd).toBe(11);
});

test('makeSnippet: long text returns ~80 chars around the match with ellipses', () => {
  const text = 'a'.repeat(100) + ' MATCH ' + 'b'.repeat(100);
  const r = makeSnippet(text, 'MATCH');
  expect(r.snippet.length).toBeLessThanOrEqual(90);  // ~80 + ellipses
  expect(r.snippet).toContain('MATCH');
  expect(r.snippet.startsWith('…')).toBe(true);
  expect(r.snippet.endsWith('…')).toBe(true);
  expect(r.snippet.slice(r.matchStart, r.matchEnd).toLowerCase()).toBe('match');
});

test('makeSnippet: case-insensitive match locates the original-case substring', () => {
  const r = makeSnippet('Hello World', 'WORLD');
  expect(r.snippet.slice(r.matchStart, r.matchEnd)).toBe('World');
});

test('makeSnippet: missing match returns first 80 chars with offsets at 0', () => {
  const r = makeSnippet('hello world', 'absent');
  expect(r.snippet).toBe('hello world');
  expect(r.matchStart).toBe(0);
  expect(r.matchEnd).toBe(0);
});

test('searchSpine: matches an item title (matchType=title)', () => {
  const results = searchSpine(tmp, 'Authentication');
  expect(results.length).toBe(1);
  expect(results[0].id).toBe('EPIC-001');
  expect(results[0].matchType).toBe('title');
  expect(results[0].snippet).toBe('Authentication');
});

test('searchSpine: matches body content of an item', () => {
  // Append body content directly to STORY-001's file.
  const story = findById(tmp, 'STORY-001')!;
  const original = readFileSync(story.path, 'utf8');
  writeFileSync(story.path, original + '\n\nThe magic-link email is sent via SES with a signed token.\n');

  const results = searchSpine(tmp, 'SES');
  expect(results.length).toBe(1);
  expect(results[0].id).toBe('STORY-001');
  expect(results[0].matchType).toBe('body');
  expect(results[0].snippet).toContain('SES');
});

test('searchSpine: case-insensitive matching', () => {
  const results = searchSpine(tmp, 'authentication');
  expect(results.length).toBe(1);
  expect(results[0].id).toBe('EPIC-001');
});

test('searchSpine: empty query returns empty list', () => {
  expect(searchSpine(tmp, '')).toEqual([]);
});

test('searchSpine: 1-char query returns empty list (min length is 2)', () => {
  expect(searchSpine(tmp, 'a')).toEqual([]);
});

test('searchSpine: title matches sort before body matches', () => {
  // STORY-001's title already contains "Magic". Add a second story whose body mentions Magic.
  runAdd({ rootDir: tmp, kind: 'story', title: 'Other story', phase: 'mvp', parent: 'FEAT-001' });
  const story2 = findById(tmp, 'STORY-002')!;
  const original = readFileSync(story2.path, 'utf8');
  writeFileSync(story2.path, original + '\n\nWe also need a Magic feature here.\n');

  const results = searchSpine(tmp, 'Magic');
  expect(results.length).toBe(2);
  expect(results[0].matchType).toBe('title');
  expect(results[0].id).toBe('STORY-001');
  expect(results[1].matchType).toBe('body');
  expect(results[1].id).toBe('STORY-002');
});

test('searchSpine: result includes phase + status + kind for downstream rendering', () => {
  const results = searchSpine(tmp, 'Email');
  expect(results.length).toBe(1);
  expect(results[0].kind).toBe('feature');
  expect(results[0].phase).toBe('mvp');
  expect(results[0].status).toBe('ready');
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/search.test.ts
```

Expected: FAIL with "Cannot find module ../../src/core/search".

- [x] **Step 3: Implement core/search.ts**

Create `/home/fintan/repos/kadai/src/core/search.ts`:

```typescript
import { walkSpine } from './spine';
import type { Item } from './types';
import type { ItemKind, Status } from './state-machine';

export interface SearchResult {
  id: string;
  kind: ItemKind;
  title: string;
  phase?: string;
  status: Status;
  matchType: 'title' | 'body' | 'acceptance';
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

const SNIPPET_BEFORE = 30;
const SNIPPET_AFTER = 50;
const SNIPPET_MAX = SNIPPET_BEFORE + SNIPPET_AFTER + 2;  // +2 for the two ellipsis chars
const MIN_QUERY = 2;

/**
 * Build a snippet ~80 chars long centered on the first case-insensitive match of
 * `query` inside `text`. Returns offsets into `snippet` (NOT into `text`) so the
 * caller can highlight without a second search.
 */
export function makeSnippet(text: string, query: string): { snippet: string; matchStart: number; matchEnd: number } {
  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const idx = lowerText.indexOf(lowerQuery);
  if (idx === -1) {
    return { snippet: text.slice(0, SNIPPET_MAX), matchStart: 0, matchEnd: 0 };
  }
  if (text.length <= SNIPPET_MAX) {
    return { snippet: text, matchStart: idx, matchEnd: idx + query.length };
  }
  const start = Math.max(0, idx - SNIPPET_BEFORE);
  const end = Math.min(text.length, idx + query.length + SNIPPET_AFTER);
  let snippet = text.slice(start, end);
  let matchStart = idx - start;
  if (start > 0) {
    snippet = '…' + snippet;
    matchStart += 1;
  }
  if (end < text.length) {
    snippet = snippet + '…';
  }
  return { snippet, matchStart, matchEnd: matchStart + query.length };
}

function buildResult(item: Item, query: string): SearchResult | null {
  const lq = query.toLowerCase();
  const data = item.data as { id: string; title: string; phase?: string; status: Status; acceptance_criteria?: string[] };

  if (data.title.toLowerCase().includes(lq)) {
    const s = makeSnippet(data.title, query);
    return {
      id: data.id,
      kind: item.kind,
      title: data.title,
      phase: data.phase,
      status: data.status,
      matchType: 'title',
      snippet: s.snippet,
      matchStart: s.matchStart,
      matchEnd: s.matchEnd,
    };
  }

  if (data.acceptance_criteria) {
    for (const criterion of data.acceptance_criteria) {
      if (criterion.toLowerCase().includes(lq)) {
        const s = makeSnippet(criterion, query);
        return {
          id: data.id,
          kind: item.kind,
          title: data.title,
          phase: data.phase,
          status: data.status,
          matchType: 'acceptance',
          snippet: s.snippet,
          matchStart: s.matchStart,
          matchEnd: s.matchEnd,
        };
      }
    }
  }

  if (item.body.toLowerCase().includes(lq)) {
    const s = makeSnippet(item.body, query);
    return {
      id: data.id,
      kind: item.kind,
      title: data.title,
      phase: data.phase,
      status: data.status,
      matchType: 'body',
      snippet: s.snippet,
      matchStart: s.matchStart,
      matchEnd: s.matchEnd,
    };
  }

  return null;
}

export function searchSpine(rootDir: string, query: string): SearchResult[] {
  if (query.length < MIN_QUERY) return [];
  const items = walkSpine(rootDir);
  const results: SearchResult[] = [];
  for (const item of items) {
    const r = buildResult(item, query);
    if (r) results.push(r);
  }
  // Sort: title matches first, then acceptance, then body.
  const order = { title: 0, acceptance: 1, body: 2 } as const;
  results.sort((a, b) => order[a.matchType] - order[b.matchType]);
  return results;
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/search.test.ts
```

Expected: 11 tests pass.

- [x] **Step 5: Refactor MCP handler to delegate**

Replace `/home/fintan/repos/kadai/src/mcp/handlers/search.ts` ENTIRELY with:

```typescript
import { z } from 'zod';
import { searchSpine } from '../../core/search';
import { findById } from '../../core/spine';
import { registerTool } from '../registry';
import type { Item } from '../../core/types';

export function registerSearchTools(): void {
  registerTool({
    name: 'search',
    description: 'Full-text search across the spine. Matches against item title, body content, and acceptance criteria. Case-insensitive substring match.',
    inputSchema: z.object({
      query: z.string().min(1),
    }),
    handler: async (args, ctx) => {
      const results = searchSpine(ctx.rootDir, args.query);
      // Preserve existing MCP contract: return full Items, not the new SearchResult shape.
      const items: Item[] = [];
      for (const r of results) {
        const item = findById(ctx.rootDir, r.id);
        if (item) items.push(item);
      }
      return items;
    },
  });
}
```

- [x] **Step 6: Run the full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: 226 tests pass (215 prior + 11 new). Typecheck clean.

- [x] **Step 7: Tick the 7 checkboxes for Task 1 in the plan**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-09-search.md`, find Task 1 and tick all 7 step checkboxes.

- [x] **Step 8: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/core/search.ts src/mcp/handlers/search.ts tests/core/search.test.ts docs/superpowers/plans/2026-05-06-kadai-09-search.md
git commit -m "$(cat <<'EOF'
refactor(core): extract searchSpine() with snippet support [Plan-9 Task-1]

Pure searchSpine(rootDir, query) returns SearchResult[] with id/kind/title/
phase/status/matchType + a ~80-char snippet centered on the match plus
matchStart/matchEnd offsets so the renderer can highlight without a second
search. Title matches sort before acceptance + body. Min query length is 2.

MCP search handler now delegates to core and maps results back to Item[]
so the existing MCP contract is preserved.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: GET /api/search endpoint

**Files:**
- Modify: `src/web/api.ts`
- Modify: `tests/web/api.test.ts`

**Goal:** `GET /api/search?q=<query>` returns `SearchResult[]` (or `[]` for `q.length < 2`). 400 if `q` is missing entirely.

- [x] **Step 1: Write the failing tests**

APPEND to `/home/fintan/repos/kadai/tests/web/api.test.ts`:

```typescript
test('GET /api/search?q=Auth returns matching items', async () => {
  const r = await fetch(`${base()}/api/search?q=Auth`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(Array.isArray(json)).toBe(true);
  expect(json.length).toBeGreaterThanOrEqual(1);
  expect(json[0].id).toBe('EPIC-001');
  expect(json[0].matchType).toBe('title');
  expect(json[0].snippet).toContain('Auth');
});

test('GET /api/search?q=a returns empty list (under min query length)', async () => {
  const r = await fetch(`${base()}/api/search?q=a`);
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual([]);
});

test('GET /api/search?q= returns empty list (empty string)', async () => {
  const r = await fetch(`${base()}/api/search?q=`);
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual([]);
});

test('GET /api/search with no q parameter returns 400', async () => {
  const r = await fetch(`${base()}/api/search`);
  expect(r.status).toBe(400);
  const json = await r.json();
  expect(json.error).toMatch(/q/i);
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/api.test.ts
```

Expected: 4 new tests fail with 404 (route not registered).

- [x] **Step 3: Implement the endpoint**

Edit `/home/fintan/repos/kadai/src/web/api.ts`. Add this import alongside the existing ones:

```typescript
import { searchSpine } from '../core/search';
```

Inside `handleApi`, after the `/api/phases` handler (or anywhere before the 404 fallback), add:

```typescript
  if (path === '/api/search' && req.method === 'GET') {
    const q = url.searchParams.get('q');
    if (q === null) {
      return Response.json({ error: 'Missing required parameter: q' }, { status: 400 });
    }
    return Response.json(searchSpine(rootDir, q));
  }
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/api.test.ts
```

Expected: all tests pass.

- [x] **Step 5: Run the full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: 230 pass (226 + 4 new). Typecheck clean.

- [x] **Step 6: Tick the 5 checkboxes for Task 2 in the plan**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-09-search.md`, find Task 2 and tick all 5 step checkboxes.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/api.ts tests/web/api.test.ts docs/superpowers/plans/2026-05-06-kadai-09-search.md
git commit -m "$(cat <<'EOF'
feat(web): add GET /api/search?q=... endpoint [Plan-9 Task-2]

Wraps core searchSpine. Returns SearchResult[] (or [] for queries under
the 2-char minimum). 400 when the q parameter is missing entirely.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Client API addition

**Files:**
- Modify: `src/web/frontend/src/api.ts`

**Goal:** Add a typed client wrapper plus the `SearchResult` type so React components can call the new endpoint.

- [x] **Step 1: Add the new function and type**

APPEND to `/home/fintan/repos/kadai/src/web/frontend/src/api.ts`:

```typescript
import type { ItemKind } from './types';

export interface SearchResult {
  id: string;
  kind: ItemKind;
  title: string;
  phase?: string;
  status: Status;
  matchType: 'title' | 'body' | 'acceptance';
  snippet: string;
  matchStart: number;
  matchEnd: number;
}

export async function searchSpine(query: string): Promise<SearchResult[]> {
  const r = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  if (!r.ok) {
    const json = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(json.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<SearchResult[]>;
}
```

(Note: `Status` is already imported from `./types` after Plan 7 Task 4. Add the new `ItemKind` import alongside it. If TypeScript prefers, merge `Status` and `ItemKind` into the existing types import line.)

- [x] **Step 2: Verify typecheck passes**

```bash
cd /home/fintan/repos/kadai
bun run typecheck
```

Expected: clean (no TS errors).

- [x] **Step 3: Tick the 3 checkboxes for Task 3 in the plan**

Tick all 3 step checkboxes in Task 3.

- [x] **Step 4: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/api.ts docs/superpowers/plans/2026-05-06-kadai-09-search.md
git commit -m "$(cat <<'EOF'
feat(web/client): add searchSpine + SearchResult client wrapper [Plan-9 Task-3]

Typed thin fetch over GET /api/search. Errors are thrown as Error(message)
so consumers can surface them.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: SearchBox component + Layout wiring

**Files:**
- Create: `src/web/frontend/src/components/SearchBox.tsx`
- Modify: `src/web/frontend/src/components/Layout.tsx`

**Goal:** A small input in the header. Submitting (Enter or pressing the search icon) navigates to `/search?q=<value>`. The input is controlled; on the Search page (Task 5), the input pre-fills from the URL `q` param.

- [x] **Step 1: Create the SearchBox component**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/SearchBox.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';

interface Props {
  initialQuery?: string;
}

export function SearchBox({ initialQuery = '' }: Props) {
  const [value, setValue] = useState(initialQuery);
  const navigate = useNavigate();

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = value.trim();
    if (trimmed.length < 2) return;
    navigate({ to: '/search', search: { q: trimmed } });
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center">
      <input
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder="Search…"
        aria-label="Search the kadai spine"
        className="bg-zinc-900 border border-zinc-700 rounded text-sm px-3 py-1 w-48 focus:outline-none focus:border-zinc-500"
      />
    </form>
  );
}
```

- [x] **Step 2: Wire SearchBox into Layout**

Read `/home/fintan/repos/kadai/src/web/frontend/src/components/Layout.tsx` to confirm shape. Add this import:

```typescript
import { SearchBox } from './SearchBox';
```

Inside the header (currently `<header className="bg-panel ...">`), insert the `<SearchBox />` between the phase pills `<div>` and the picked indicator `<div className="ml-auto ...">`. The result should look like:

```tsx
<header className="bg-panel border-b border-zinc-800 px-6 py-3 flex items-center gap-4">
  <Link to="/" className="font-bold text-lg">Kadai</Link>
  <div className="flex items-center gap-2 text-sm">
    {phases.map(p => (
      <span ... >{p.display}</span>
    ))}
  </div>
  <SearchBox />
  <div className="ml-auto text-sm">
    {picked ? (...) : (...)}
  </div>
</header>
```

(The `ml-auto` on the picked indicator pushes it to the right; the SearchBox sits centered between phase pills and picked.)

- [x] **Step 3: Build the SPA**

```bash
cd /home/fintan/repos/kadai
bun run build:web
```

Expected: clean build. (The build will likely emit a TanStack Router type warning about the missing `/search` route — that's resolved in Task 5. If the build fails on this, switch to `<a href="/search?q=...">` form action temporarily; you'll convert back to `useNavigate` after Task 5.)

- [x] **Step 4: Verify typecheck + tests**

```bash
cd /home/fintan/repos/kadai
bun run typecheck
bun test
```

Expected: 230 tests pass. Typecheck may flag the `/search` route as unknown — if so, add a temporary type assertion:

```typescript
navigate({ to: '/search' as string, search: { q: trimmed } });
```

(You'll remove the `as string` after Task 5 declares the route.)

- [x] **Step 5: Tick the 5 checkboxes for Task 4 in the plan**

Tick all 5 step checkboxes for Task 4.

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/components/SearchBox.tsx src/web/frontend/src/components/Layout.tsx docs/superpowers/plans/2026-05-06-kadai-09-search.md
git commit -m "$(cat <<'EOF'
feat(web/client): add SearchBox to top bar [Plan-9 Task-4]

Controlled input + form. Enter submits and navigates to /search?q=<value>
(min 2 chars). Whitespace-only queries are ignored.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Search results page + route

**Files:**
- Create: `src/web/frontend/src/pages/Search.tsx`
- Modify: `src/web/frontend/src/router.tsx`

**Goal:** A new `/search` route that reads `q` from the URL search params and renders results. Each result is a clickable card showing kind / id / title / phase / status, plus the snippet with the matched substring wrapped in `<mark>` for highlighting.

- [x] **Step 1: Create the Search page**

Create `/home/fintan/repos/kadai/src/web/frontend/src/pages/Search.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Link, useSearch } from '@tanstack/react-router';
import { searchSpine, type SearchResult } from '../api';

const ROUTE_BY_KIND: Record<string, string> = {
  epic: '/epics/$id',
  feature: '/features/$id',
  story: '/stories/$id',
  task: '/stories/$id',  // tasks live under their story
};

function Highlighted({ snippet, matchStart, matchEnd }: { snippet: string; matchStart: number; matchEnd: number }) {
  if (matchEnd === 0) return <>{snippet}</>;
  return (
    <>
      {snippet.slice(0, matchStart)}
      <mark className="bg-yellow-700/40 text-yellow-100 rounded px-0.5">
        {snippet.slice(matchStart, matchEnd)}
      </mark>
      {snippet.slice(matchEnd)}
    </>
  );
}

export function Search() {
  const search = useSearch({ from: '/search' }) as { q?: string };
  const q = search.q ?? '';
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    setError(null);
    searchSpine(q)
      .then(setResults)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [q]);

  return (
    <div className="space-y-4">
      <div>
        <div className="text-xs text-muted">Search results</div>
        <h1 className="text-2xl font-bold">{q ? `“${q}”` : 'Type a query in the top bar'}</h1>
      </div>

      {q.length > 0 && q.length < 2 && (
        <div className="text-muted italic">Type at least 2 characters.</div>
      )}

      {loading && <div className="text-muted italic">Searching…</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {!loading && !error && q.length >= 2 && results.length === 0 && (
        <div className="text-muted italic">No results.</div>
      )}

      <div className="space-y-2">
        {results.map(r => {
          const route = ROUTE_BY_KIND[r.kind] ?? '/';
          return (
            <Link
              key={r.id}
              to={route}
              params={{ id: r.id }}
              className="block bg-panel border border-zinc-800 rounded p-3 hover:border-zinc-600"
            >
              <div className="flex items-baseline gap-3">
                <span className="text-xs text-muted uppercase">{r.kind}</span>
                <span className="text-xs text-muted">{r.id}</span>
                {r.phase && <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{r.phase}</span>}
                <span className="text-xs bg-zinc-800 px-2 py-0.5 rounded">{r.status}</span>
                <span className="ml-auto text-[10px] text-muted">{r.matchType} match</span>
              </div>
              <div className="mt-1 font-medium">{r.title}</div>
              {r.matchType !== 'title' && (
                <div className="mt-1 text-sm text-zinc-400">
                  <Highlighted snippet={r.snippet} matchStart={r.matchStart} matchEnd={r.matchEnd} />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
```

- [x] **Step 2: Register the route**

Edit `/home/fintan/repos/kadai/src/web/frontend/src/router.tsx`. Add the import alongside existing page imports:

```typescript
import { Search } from './pages/Search';
```

Add the route definition alongside `epicRoute`, `featureRoute`, etc.:

```typescript
const searchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/search',
  component: Search,
  validateSearch: (s: Record<string, unknown>): { q?: string } => {
    return { q: typeof s.q === 'string' ? s.q : undefined };
  },
});
```

Add `searchRoute` to the route tree:

```typescript
const routeTree = rootRoute.addChildren([homeRoute, epicRoute, featureRoute, storyRoute, searchRoute]);
```

- [x] **Step 3: Remove any temporary type assertions from Task 4**

If you added `as string` in Task 4 Step 4, remove it now — the route is registered, so `to: '/search'` should be valid.

- [x] **Step 4: Build the SPA**

```bash
cd /home/fintan/repos/kadai
bun run build:web
```

Expected: clean build, no TanStack Router type warnings about `/search`.

- [x] **Step 5: Smoke test**

```bash
TMP=$(mktemp -d) && cd "$TMP" && \
  kadai init -y > /dev/null && \
  kadai add feature --title "Email login" --phase mvp --epic EPIC-001 > /dev/null && \
  kadai add story --title "Magic link" --phase mvp --feature FEAT-001 > /dev/null && \
  kadai serve --no-open --port 4949 &
sleep 2
echo "--- search Email ---"
curl -s "http://localhost:4949/api/search?q=Email" | head -c 400
echo ""
pkill -f "kadai serve --no-open --port 4949" || true
sleep 1
cd / && rm -rf "$TMP"
```

Expected: JSON list with FEAT-001 result.

- [x] **Step 6: Verify typecheck + tests**

```bash
cd /home/fintan/repos/kadai
bun run typecheck
bun test
```

Expected: clean.

- [x] **Step 7: Tick the 7 checkboxes for Task 5 in the plan**

Tick all 7 step checkboxes for Task 5.

- [x] **Step 8: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/pages/Search.tsx src/web/frontend/src/router.tsx src/web/frontend/src/components/SearchBox.tsx docs/superpowers/plans/2026-05-06-kadai-09-search.md
git commit -m "$(cat <<'EOF'
feat(web/client): add /search results page with snippet highlighting [Plan-9 Task-5]

TanStack Router /search route with validated q search param. Results render
as clickable cards (kind / id / phase / status / title + highlighted snippet
for non-title matches) linking to the appropriate detail page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

(If you DID NOT modify SearchBox.tsx in Step 3 — i.e., you never added the `as string` cast in Task 4 — drop it from the `git add` list.)

---

### Task 6: Playwright E2E for search

**Files:**
- Modify: `tests/web/e2e.pw.ts`

**Goal:** One end-to-end flow: type a query in the top-bar SearchBox, press Enter, see results, click into one.

- [ ] **Step 1: Add the E2E test**

APPEND to `/home/fintan/repos/kadai/tests/web/e2e.pw.ts`:

```typescript
test('searching from the top bar lists matches and links to detail pages', async ({ page }) => {
  await page.goto(serverUrl);
  await page.waitForLoadState('load');

  // Type into the top-bar SearchBox.
  const searchInput = page.locator('input[type="search"]');
  await searchInput.fill('Email');
  await searchInput.press('Enter');

  // We should land on /search?q=Email.
  await page.waitForURL(/\/search\?q=Email/);
  await page.waitForLoadState('load');

  // Heading reflects the query.
  await expect(page.locator('h1', { hasText: '“Email”' })).toBeVisible();

  // The seeded feature "Login" has no "Email" match, but the seeded epic title
  // "Authentication" has none either. The seed adds a feature called "Login".
  // Add a result we can rely on by also searching for "Authentication".
  await searchInput.fill('Authentication');
  await searchInput.press('Enter');
  await page.waitForURL(/\/search\?q=Authentication/);

  // Result card visible.
  await expect(page.locator('text=EPIC-001').first()).toBeVisible();
  await expect(page.locator('text=Authentication').first()).toBeVisible();

  // Clicking the card navigates to the epic page.
  await page.locator('a', { hasText: 'Authentication' }).first().click();
  await page.waitForURL(/\/epics\/EPIC-001/);
  await expect(page.locator('h1', { hasText: 'Authentication' })).toBeVisible();
});
```

- [ ] **Step 2: Build the SPA + run Playwright**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bunx playwright test
```

Expected: 8/8 tests pass (3 Plan 4 + 3 Plan 7 + 1 Plan 8 + 1 new Plan 9).

- [ ] **Step 3: Verify the unit suite**

```bash
cd /home/fintan/repos/kadai
bun test
```

Expected: 230 pass (no change — bun test doesn't pick up `.pw.ts`).

- [ ] **Step 4: Tick the 4 checkboxes for Task 6 in the plan**

Tick all 4 step checkboxes for Task 6.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add tests/web/e2e.pw.ts docs/superpowers/plans/2026-05-06-kadai-09-search.md
git commit -m "$(cat <<'EOF'
test(web/e2e): top-bar search → results page → detail navigation [Plan-9 Task-6]

End-to-end flow: type a query, hit Enter, land on /search?q=...,
click a result card, arrive on the epic detail page.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Docs + plugin v0.5.0 + post-MVP tracking + dogfood

**Files:**
- Modify: `docs/wiki/api-reference.md`
- Modify: `docs/wiki/web-viewer.md`
- Modify: `docs/wiki/post-mvp.md`
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (0.4.0 → 0.5.0)
- Append: `docs/dogfood-acceptance-test.md`
- Modify: `docs/superpowers/plans/2026-05-06-kadai-09-search.md`

- [ ] **Step 1: Update api-reference.md**

In `/home/fintan/repos/kadai/docs/wiki/api-reference.md`, find the "Read endpoints" table. Add this row at the bottom (after the `/api/events` row):

```markdown
| `GET` | `/api/search?q=<query>` | `SearchResult[]` (or `[]` for queries < 2 chars; 400 if `q` is missing) |
```

Add a new section after the existing "Live updates" section:

```markdown
## Search

`GET /api/search?q=<query>` does a case-insensitive substring match across each item's title, body, and acceptance_criteria. Min query length is 2 characters; shorter queries return `[]`.

`SearchResult` shape:

```json
{
  "id": "STORY-042",
  "kind": "story",
  "title": "Magic link delivery",
  "phase": "mvp",
  "status": "ready",
  "matchType": "body",
  "snippet": "…the magic-link email is sent via SES with a signed token…",
  "matchStart": 28,
  "matchEnd": 31
}
```

Results are sorted: title matches first, then acceptance-criteria matches, then body matches. Within a match-type, original spine order is preserved. The `snippet` is ~80 chars centered on the first match in the source field; `matchStart`/`matchEnd` are offsets into `snippet` (NOT the source field) so the renderer can highlight without a second search.

The MCP `search` tool is still available and continues to return `Item[]` (full frontmatter + body) for backwards compatibility.
```

- [ ] **Step 2: Update web-viewer.md**

In `/home/fintan/repos/kadai/docs/wiki/web-viewer.md`, find the "Layout" section (or the most appropriate place near the top). Add:

```markdown
The header has a **search box** — type a query (min 2 chars), press Enter to land on `/search?q=...` with full-spine results. See [api-reference.md#search](api-reference.md#search) for the underlying endpoint.
```

- [ ] **Step 3: Update post-mvp.md**

In `/home/fintan/repos/kadai/docs/wiki/post-mvp.md`:

(a) Find `### Plan 9 — Search 🟢 **next**` and remove the entire section.

(b) Find the next plan in the list (should be `### Plan 10 — Git integration (\`kadai sync\`)`). Add the badge:

```markdown
### Plan 10 — Git integration (`kadai sync`) 🟢 **next**
```

(c) In the "Recently shipped" section at the bottom, ABOVE the existing `### Plan 8` entry, insert:

```markdown
### Plan 9 — Search (shipped 2026-05-06)

- `GET /api/search?q=...` returning `SearchResult[]` (id, kind, title, phase, status, matchType, snippet + match offsets)
- `src/core/search.ts` — `searchSpine()` + `makeSnippet()`; title matches sort before acceptance + body
- MCP `search` tool refactored to delegate to core (preserves `Item[]` return contract)
- SearchBox in the top bar; `/search?q=...` results page with `<mark>` highlighting
- 1 new Playwright E2E flow
- Plugin version bumped to 0.5.0
```

- [ ] **Step 4: Bump plugin version**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change `"version": "0.4.0"` to `"version": "0.5.0"`.

- [ ] **Step 5: Dogfood verification**

```bash
TMP=$(mktemp -d -t kadai-plan9-XXXXXX)
cd "$TMP"

kadai init -y > /dev/null
kadai add feature --title "Email login" --phase mvp --epic EPIC-001 > /dev/null
kadai add story --title "Magic link delivery" --phase mvp --feature FEAT-001 > /dev/null

kadai serve --no-open --port 7949 > /tmp/kadai-plan9-serve.log 2>&1 &
SERVE_PID=$!
sleep 2

echo "=== GET /api/search?q=Magic ==="
curl -s "http://localhost:7949/api/search?q=Magic"
echo ""

echo "=== GET /api/search?q=Email ==="
curl -s "http://localhost:7949/api/search?q=Email"
echo ""

echo "=== GET /api/search?q=a (under min length) ==="
curl -s "http://localhost:7949/api/search?q=a"
echo ""

echo "=== GET /api/search (missing q) ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" "http://localhost:7949/api/search"

kill $SERVE_PID || true
sleep 1
cd / && rm -rf "$TMP" /tmp/kadai-plan9-serve.log
```

Expected:
- Search for "Magic" → STORY-001 result with title match
- Search for "Email" → FEAT-001 result with title match
- Search for "a" → `[]`
- Missing `q` → HTTP 400

CAPTURE the actual output to cite in Step 6.

- [ ] **Step 6: Append a section to docs/dogfood-acceptance-test.md**

APPEND:

```markdown

---

## Search run — Plan 9 verification — 2026-05-06

Spot-checked the new search endpoint via curl against a real `kadai serve` process.

- `GET /api/search?q=Magic` → 1 result, STORY-001, matchType=title ✅
- `GET /api/search?q=Email` → 1 result, FEAT-001, matchType=title ✅
- `GET /api/search?q=a` → `[]` (under 2-char minimum) ✅
- `GET /api/search` (missing q) → HTTP 400 with error message ✅
- `bun test` → 230/0 pass ✅
- `bunx playwright test` → 8/8 pass (3 Plan 4 + 3 Plan 7 + 1 Plan 8 + 1 Plan 9) ✅

### Verdict: PASS

Spine search works end-to-end through the API and the new /search results page.
```

(Use actual numbers from your run if they differ.)

- [ ] **Step 7: Run all the final checks**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
bun run build:web
bunx playwright test
```

Expected: every step exits clean.

- [ ] **Step 8: Tick the Task 7 checkboxes + Plan 9 self-review checklist**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-09-search.md`:
- Tick all 9 step checkboxes for Task 7
- Tick all checkboxes in the "Plan 9 self-review checklist" section near the bottom

- [ ] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add docs/wiki/api-reference.md docs/wiki/web-viewer.md docs/wiki/post-mvp.md docs/dogfood-acceptance-test.md kadai-plugin/.claude-plugin/plugin.json docs/superpowers/plans/2026-05-06-kadai-09-search.md
git commit -m "$(cat <<'EOF'
docs(plan-9): api-reference, web-viewer, post-mvp shipped + plugin 0.5.0 [Plan-9 Task-7]

- api-reference.md: new /api/search row + Search section
- web-viewer.md: mention top-bar search
- post-mvp.md: Plan 9 → Recently shipped, Plan 10 → next
- plugin.json: 0.4.0 → 0.5.0
- dogfood-acceptance-test.md: search spot-check appended

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan 9 self-review checklist

- [ ] All 7 tasks completed; checkboxes ticked.
- [ ] `bun test` passes (~230 tests).
- [ ] `bun run typecheck` passes.
- [ ] `bunx playwright test` passes (8/8).
- [ ] `GET /api/search?q=...` returns `SearchResult[]` with snippets + offsets (verified in Task 7 dogfood).
- [ ] MCP `search` tool still returns `Item[]` (backwards compatible).
- [ ] Top-bar SearchBox + `/search?q=...` page render and link correctly (verified in Task 6 E2E).
- [ ] Plugin v0.5.0 in the manifest.
- [ ] post-mvp.md: Plan 9 in "Recently shipped"; Plan 10 marked 🟢 **next**.
- [ ] api-reference.md and web-viewer.md updated.

---

## Proceed to Plan 10

Once the self-review checklist is fully ticked, update the active plan in `/home/fintan/repos/kadai/CLAUDE.md` to point at Plan 10 (Git integration / `kadai sync`). Plan 10 is brainstormed/drafted from `docs/wiki/post-mvp.md` § Plan 10 — `kadai sync` scrapes git log for `STORY-NNN` references and appends matching commits to that story's `changelog.md`.
