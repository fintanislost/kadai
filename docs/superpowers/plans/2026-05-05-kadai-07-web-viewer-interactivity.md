# Kadai Plan 7 — Web viewer interactivity

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the kadai web viewer writable. Add status changers in the story right rail, drag-drop status changes in the feature kanban, and a spec/plan upload UI on story pages — backed by three new write endpoints (`POST /api/items/:id/status`, `POST /api/items/:id/attach`, plus a small `GET /api/items/:id/transitions` helper).

**Architecture:** The web API gains write endpoints that wrap existing core operations (`setStatus` already exists; a new `attachFile` core operation is extracted from the MCP `attach_spec` / `attach_plan` handlers so both transports share one validated implementation). The React frontend adds a status panel, drop-target kanban (via `@dnd-kit`), and an `<input type="file">`-driven attach widget — all using optimistic UI with revert-on-error. No SSE / live updates yet (that's Plan 8); changes are visible after a tab refresh in other browsers.

**Tech Stack:** TypeScript on Bun (existing). React 19 + Vite + TanStack Router + Tailwind v3 (existing frontend). New runtime dep: `@dnd-kit/core` and `@dnd-kit/sortable` (~25 kB gzipped, headless DnD library; React 19 compatible). All HTTP between client and server is JSON or `multipart/form-data` (built-in `Request.formData()` on Bun).

## Position in the build

| | |
|---|---|
| **This is plan** | 7 of N |
| **Prior plan** | [Plan 6 — Workflow completion](2026-05-05-kadai-06-workflow-completion.md) — `DONE` |
| **Next plan** | Plan 8 — SSE live updates (per [post-mvp.md](../../wiki/post-mvp.md)) |
| **Index** | [README.md](README.md) |
| **Backlog** | [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md) |

## What ships at the end

- `POST /api/items/:id/status` — body `{"status":"<status>"}`, returns updated item or 4xx with error.
- `GET /api/items/:id/transitions` — returns `{"current":"in_progress","allowed":["blocked","review","done"]}` (story-aware).
- `POST /api/items/:id/attach` — multipart upload of a `spec.md` or `plan.md`; writes into the item's directory and updates frontmatter.
- New `core/attach.ts` module with `attachFile(rootDir, itemId, kind, srcPath)` — used by both web and MCP.
- React: status-changer panel in the story right rail + drop-target columns in the feature kanban + attach button + file input on the story spec/plan tabs.
- ~10+ new unit tests for the API endpoints and the `attachFile` core; 2-3 new Playwright E2E tests covering the new interactions.
- `docs/wiki/api-reference.md` (new page) + updates to `docs/wiki/web-viewer.md` and `docs/wiki/concepts.md` if any concept shifts.
- All ~182 existing tests still pass; no regression.

## Out of scope (deferred)

- SSE / real-time updates — Plan 8.
- Search box wiring — Plan 9.
- Drag to reorder (only drag for status change in this plan) — punted (would need an order-mutation endpoint).
- Drag-and-drop on the home roadmap (epic ordering) — punted.
- Mobile / touch DnD — `@dnd-kit` supports it out of the box but isn't a Plan 7 acceptance criterion.

## File structure

```
src/web/api.ts                                 # MODIFIED: add 3 routes (status POST, transitions GET, attach POST)
src/web/server.ts                              # No change (already passes /api/* through to handleApi)

src/core/attach.ts                             # NEW: attachFile() — extract from mcp/handlers/attach.ts
src/mcp/handlers/attach.ts                     # MODIFIED: delegate to core/attach.ts
src/core/operations.ts                         # No change (setStatus stays as-is)

src/web/frontend/src/api.ts                    # MODIFIED: add setItemStatus, getTransitions, attachFile client funcs
src/web/frontend/src/components/StatusPanel.tsx          # NEW: status-changer rail panel
src/web/frontend/src/components/AttachButton.tsx         # NEW: file picker + upload
src/web/frontend/src/components/KanbanBoard.tsx          # MODIFIED: become DnD-aware via @dnd-kit
src/web/frontend/src/pages/Story.tsx                     # MODIFIED: add right rail with StatusPanel + AttachButtons
src/web/frontend/src/pages/Feature.tsx                   # MODIFIED: pass onStatusChange callback to KanbanBoard

tests/web/api.test.ts                          # MODIFIED: add ~8 new tests for status / transitions / attach endpoints
tests/core/attach.test.ts                      # NEW: attachFile core tests
tests/web/e2e.pw.ts                            # MODIFIED: add 3 new E2E flows (status button, kanban DnD, attach upload)

docs/wiki/api-reference.md                     # NEW
docs/wiki/web-viewer.md                        # MODIFIED: document interactivity
docs/wiki/post-mvp.md                          # MODIFIED at end: move Plan 7 to "Recently shipped"
kadai-plugin/.claude-plugin/plugin.json        # MODIFIED at end: 0.2.0 → 0.3.0 (no plugin behavior change but version sync convention)
```

## Tasks

---

### Task 1: Status mutation + transitions API endpoints

**Files:**
- Modify: `src/web/api.ts`
- Modify: `tests/web/api.test.ts`

**Goal:** Add `POST /api/items/:id/status` and `GET /api/items/:id/transitions`. The POST validates body, calls `setStatus`, returns the updated item (200) or a 400/404 with an error message JSON. The GET returns the legal next states for the item, computed via `legalNextStates(kind, currentStatus)`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/fintan/repos/kadai/tests/web/api.test.ts` (after the existing `GET /api/picked` tests):

```typescript
test('GET /api/items/EPIC-001/transitions returns legal next states', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001/transitions`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.current).toBe('ready');
  // From 'ready' an epic can go to 'in_progress' or 'cancelled' (state machine).
  expect(json.allowed).toContain('in_progress');
});

test('GET /api/items/MISSING/transitions returns 404', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-999/transitions`);
  expect(r.status).toBe(404);
});

test('POST /api/items/:id/status moves a legal transition', async () => {
  const r = await fetch(`${base()}/api/items/STORY-001/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.data.status).toBe('in_progress');

  // Reset for downstream tests:
  await fetch(`${base()}/api/items/STORY-001/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'review' }),
  });
  await fetch(`${base()}/api/items/STORY-001/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });
});

test('POST /api/items/:id/status rejects an illegal transition with 400', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'done' }),  // ready → done is illegal
  });
  expect(r.status).toBe(400);
  const json = await r.json();
  expect(json.error).toMatch(/illegal transition/i);
});

test('POST /api/items/:id/status returns 404 for unknown ID', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-999/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'in_progress' }),
  });
  expect(r.status).toBe(404);
});

test('POST /api/items/:id/status returns 400 for missing body', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(r.status).toBe(400);
  const json = await r.json();
  expect(json.error).toMatch(/status/i);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/api.test.ts
```

Expected: the 6 new tests fail with 404 (route not registered yet).

- [ ] **Step 3: Implement the endpoints**

Edit `/home/fintan/repos/kadai/src/web/api.ts`. Add these imports at the top (alongside existing imports):

```typescript
import { setStatus } from '../core/operations';
import { legalNextStates } from '../core/state-machine';
```

Inside `handleApi`, **before** the existing `const itemMatch = path.match(/^\/api\/items\/(.+)$/);` block, add:

```typescript
  const transitionsMatch = path.match(/^\/api\/items\/([A-Z]+-\d+)\/transitions$/);
  if (transitionsMatch && req.method === 'GET') {
    const item = findById(rootDir, transitionsMatch[1]);
    if (!item) return new Response('Not found', { status: 404 });
    return Response.json({
      current: item.data.status,
      allowed: legalNextStates(item.kind, item.data.status),
    });
  }

  const statusMatch = path.match(/^\/api\/items\/([A-Z]+-\d+)\/status$/);
  if (statusMatch && req.method === 'POST') {
    const id = statusMatch[1];
    let body: { status?: string };
    try {
      body = await req.json() as { status?: string };
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    if (!body.status || typeof body.status !== 'string') {
      return Response.json({ error: 'Missing required field: status' }, { status: 400 });
    }
    const item = findById(rootDir, id);
    if (!item) return Response.json({ error: `Item not found: ${id}` }, { status: 404 });
    try {
      setStatus(rootDir, id, body.status as Status);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return Response.json({ error: msg }, { status: 400 });
    }
    const updated = findById(rootDir, id);
    return Response.json(updated);
  }
```

The `itemMatch` block right after must continue to handle GETs only — so amend its guard from:

```typescript
  const itemMatch = path.match(/^\/api\/items\/(.+)$/);
  if (itemMatch) {
```

to:

```typescript
  const itemMatch = path.match(/^\/api\/items\/(.+)$/);
  if (itemMatch && req.method === 'GET') {
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/api.test.ts
```

Expected: all original tests still pass + 6 new tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/api.ts tests/web/api.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add POST /api/items/:id/status + GET /api/items/:id/transitions [Plan-7 Task-1]

Wraps existing core setStatus + legalNextStates.
Returns 200 with updated item, 400 on illegal transition or missing body, 404 on unknown ID.
EOF
)"
```

---

### Task 2: Extract `attachFile` to core

**Files:**
- Create: `src/core/attach.ts`
- Create: `tests/core/attach.test.ts`
- Modify: `src/mcp/handlers/attach.ts` (delegate to core)

**Goal:** Move the spec/plan attach logic out of the MCP-only `mcp/handlers/attach.ts` and into `core/attach.ts` so it's reusable. The MCP handlers become thin wrappers, just like Plan 6 Task 1's `set-status` CLI wrapped existing core. Pure refactor — no behavior change in MCP, no new functionality yet.

- [ ] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/core/attach.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { findById } from '../../src/core/spine';
import { attachFile } from '../../src/core/attach';

let tmp: string;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-attach-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

test('attachFile copies a spec.md into the feature dir and updates frontmatter', () => {
  const src = join(tmp, '_src.md');
  writeFileSync(src, '# Spec\n\nContent.\n');

  const result = attachFile(tmp, 'FEAT-001', 'spec', src);

  expect(existsSync(result.targetPath)).toBe(true);
  expect(readFileSync(result.targetPath, 'utf8')).toBe('# Spec\n\nContent.\n');
  expect(existsSync(src)).toBe(false);  // source removed

  const feat = findById(tmp, 'FEAT-001');
  expect((feat!.data as any).spec).toBe('spec.md');
});

test('attachFile copies a plan.md into the story dir and updates frontmatter', () => {
  const src = join(tmp, '_src.md');
  writeFileSync(src, '# Plan\n');

  const result = attachFile(tmp, 'STORY-001', 'plan', src);

  expect(existsSync(result.targetPath)).toBe(true);
  expect((findById(tmp, 'STORY-001')!.data as any).plan).toBe('plan.md');
});

test('attachFile attaches a spec.md to a story (story can have both spec and plan)', () => {
  const src = join(tmp, '_src.md');
  writeFileSync(src, '# Spec for story\n');
  attachFile(tmp, 'STORY-001', 'spec', src);
  expect((findById(tmp, 'STORY-001')!.data as any).spec).toBe('spec.md');
});

test('attachFile rejects unknown ID', () => {
  const src = join(tmp, '_src.md');
  writeFileSync(src, 'x');
  expect(() => attachFile(tmp, 'FEAT-999', 'spec', src)).toThrow(/not found/i);
});

test('attachFile rejects spec on a task (kind not allowed)', () => {
  runAdd({ rootDir: tmp, kind: 'task', title: 'T', parent: 'STORY-001' });
  const src = join(tmp, '_src.md');
  writeFileSync(src, 'x');
  expect(() => attachFile(tmp, 'TASK-001', 'spec', src)).toThrow(/cannot attach/i);
});

test('attachFile rejects missing source file', () => {
  expect(() => attachFile(tmp, 'FEAT-001', 'spec', '/nonexistent/source.md'))
    .toThrow(/source.*not found/i);
});

test('attachFile rejects plan on an epic', () => {
  const src = join(tmp, '_src.md');
  writeFileSync(src, 'x');
  expect(() => attachFile(tmp, 'EPIC-001', 'plan', src)).toThrow(/cannot attach/i);
});
```

- [ ] **Step 2: Run test — should fail on missing module**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/attach.test.ts
```

Expected: FAIL with "Cannot find module ../../src/core/attach".

- [ ] **Step 3: Implement core/attach.ts**

Create `/home/fintan/repos/kadai/src/core/attach.ts`:

```typescript
import { copyFileSync, existsSync, unlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { findById } from './spine';
import { writeFileAtomic } from './files';
import { serialize } from './frontmatter';

export type AttachKind = 'spec' | 'plan';

export interface AttachResult {
  itemId: string;
  kind: AttachKind;
  targetPath: string;
}

/**
 * Attach a markdown file to an item.
 * - spec → allowed on feature and story; written as `spec.md` in the item dir.
 * - plan → allowed on story only; written as `plan.md`.
 * The source file is moved (copy + remove). The item's frontmatter is updated.
 */
export function attachFile(
  rootDir: string,
  itemId: string,
  kind: AttachKind,
  sourcePath: string,
): AttachResult {
  const item = findById(rootDir, itemId);
  if (!item) throw new Error(`Item not found: ${itemId}`);

  const allowed = kind === 'spec'
    ? (item.kind === 'feature' || item.kind === 'story')
    : (item.kind === 'story');
  if (!allowed) {
    throw new Error(`Cannot attach ${kind} to ${item.kind} (${itemId})`);
  }

  const src = isAbsolute(sourcePath) ? sourcePath : resolve(rootDir, sourcePath);
  if (!existsSync(src)) throw new Error(`Source file not found: ${src}`);

  const filename = kind === 'spec' ? 'spec.md' : 'plan.md';
  const itemDir = dirname(item.path);
  const target = join(itemDir, filename);

  copyFileSync(src, target);
  unlinkSync(src);

  const updated: Record<string, unknown> = {
    ...item.data,
    [kind]: filename,
    updated: new Date().toISOString().slice(0, 10),
  };
  writeFileAtomic(item.path, serialize(updated, item.body));

  return { itemId, kind, targetPath: target };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/attach.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Refactor MCP handlers to delegate**

Replace `/home/fintan/repos/kadai/src/mcp/handlers/attach.ts` entirely with:

```typescript
import { z } from 'zod';
import { attachFile } from '../../core/attach';
import { registerTool } from '../registry';

export function registerAttachTools(): void {
  registerTool({
    name: 'attach_spec',
    description: 'Move a spec markdown file from its current location (typically docs/superpowers/specs/) into the named feature\'s directory as spec.md, and set the feature\'s frontmatter `spec` field to "spec.md". The original source file is removed after the move.',
    inputSchema: z.object({
      feature_id: z.string().regex(/^FEAT-\d+$/),
      source_path: z.string().min(1),
    }),
    handler: async (args, ctx) => {
      const result = attachFile(ctx.rootDir, args.feature_id, 'spec', args.source_path);
      return { feature_id: result.itemId, attached_at: result.targetPath };
    },
  });

  registerTool({
    name: 'attach_plan',
    description: 'Move a plan markdown file from its current location (typically docs/superpowers/plans/) into the named story\'s directory as plan.md, and set the story\'s frontmatter `plan` field to "plan.md". The original source file is removed after the move.',
    inputSchema: z.object({
      story_id: z.string().regex(/^STORY-\d+$/),
      source_path: z.string().min(1),
    }),
    handler: async (args, ctx) => {
      const result = attachFile(ctx.rootDir, args.story_id, 'plan', args.source_path);
      return { story_id: result.itemId, attached_at: result.targetPath };
    },
  });
}
```

- [ ] **Step 6: Run the full suite to verify no MCP regression**

```bash
cd /home/fintan/repos/kadai
bun test
```

Expected: all tests pass (including any existing MCP attach tests).

- [ ] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/core/attach.ts src/mcp/handlers/attach.ts tests/core/attach.test.ts
git commit -m "$(cat <<'EOF'
refactor(core): extract attachFile() so it's reusable [Plan-7 Task-2]

MCP handlers now delegate to core/attach.ts. Core enforces kind/parent rules
(spec on feature|story; plan on story only). No behavior change in MCP.
EOF
)"
```

---

### Task 3: Attach API endpoint

**Files:**
- Modify: `src/web/api.ts`
- Modify: `tests/web/api.test.ts`

**Goal:** Add `POST /api/items/:id/attach` accepting multipart `file=<binary>` + `kind=spec|plan`. Stores the upload to a tmp file, then calls `attachFile`. Returns 200 with the updated item or 4xx with `{error}`.

- [ ] **Step 1: Write the failing tests**

Append to `/home/fintan/repos/kadai/tests/web/api.test.ts`:

```typescript
test('POST /api/items/FEAT-001/attach uploads a spec.md', async () => {
  const form = new FormData();
  form.append('kind', 'spec');
  form.append('file', new Blob(['# Spec content\n'], { type: 'text/markdown' }), 'spec.md');

  const r = await fetch(`${base()}/api/items/FEAT-001/attach`, {
    method: 'POST',
    body: form,
  });
  expect(r.status).toBe(200);
  const json = await r.json();
  expect((json.data as any).spec).toBe('spec.md');

  // Verify the file is also fetchable via GET /api/files/...
  const fr = await fetch(`${base()}/api/files/FEAT-001/spec.md`);
  expect(fr.status).toBe(200);
  expect(await fr.text()).toBe('# Spec content\n');
});

test('POST /api/items/STORY-001/attach uploads a plan.md', async () => {
  const form = new FormData();
  form.append('kind', 'plan');
  form.append('file', new Blob(['# Plan\n- step 1\n'], { type: 'text/markdown' }), 'plan.md');

  const r = await fetch(`${base()}/api/items/STORY-001/attach`, {
    method: 'POST',
    body: form,
  });
  expect(r.status).toBe(200);
  expect((((await r.json()) as any).data as any).plan).toBe('plan.md');
});

test('POST /api/items/EPIC-001/attach with kind=plan returns 400', async () => {
  const form = new FormData();
  form.append('kind', 'plan');
  form.append('file', new Blob(['x'], { type: 'text/markdown' }), 'plan.md');

  const r = await fetch(`${base()}/api/items/EPIC-001/attach`, {
    method: 'POST',
    body: form,
  });
  expect(r.status).toBe(400);
  const json = await r.json();
  expect(json.error).toMatch(/cannot attach/i);
});

test('POST /api/items/:id/attach with no file returns 400', async () => {
  const form = new FormData();
  form.append('kind', 'spec');

  const r = await fetch(`${base()}/api/items/FEAT-001/attach`, {
    method: 'POST',
    body: form,
  });
  expect(r.status).toBe(400);
  const json = await r.json();
  expect(json.error).toMatch(/file/i);
});

test('POST /api/items/:id/attach with bad kind returns 400', async () => {
  const form = new FormData();
  form.append('kind', 'changelog');
  form.append('file', new Blob(['x']), 'spec.md');

  const r = await fetch(`${base()}/api/items/FEAT-001/attach`, {
    method: 'POST',
    body: form,
  });
  expect(r.status).toBe(400);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/api.test.ts
```

Expected: 5 new tests fail (route not registered).

- [ ] **Step 3: Implement the endpoint**

Edit `/home/fintan/repos/kadai/src/web/api.ts`. Add this import alongside the existing ones:

```typescript
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { attachFile } from '../core/attach';
```

(Note: `dirname`, `join`, `existsSync`, `readFileSync` are already imported. Add only the new ones.)

Inside `handleApi`, **after** the new status route from Task 1 and **before** the `itemMatch` block, add:

```typescript
  const attachMatch = path.match(/^\/api\/items\/([A-Z]+-\d+)\/attach$/);
  if (attachMatch && req.method === 'POST') {
    const id = attachMatch[1];
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return Response.json({ error: 'Invalid multipart body' }, { status: 400 });
    }
    const kind = form.get('kind');
    const file = form.get('file');
    if (kind !== 'spec' && kind !== 'plan') {
      return Response.json({ error: 'Field "kind" must be "spec" or "plan"' }, { status: 400 });
    }
    if (!(file instanceof Blob)) {
      return Response.json({ error: 'Missing required field: file' }, { status: 400 });
    }

    // Stage to a tmp file because attachFile takes a source path (it copies + unlinks).
    const stageDir = mkdtempSync(join(tmpdir(), 'kadai-attach-'));
    const stagePath = join(stageDir, kind === 'spec' ? 'spec.md' : 'plan.md');
    writeFileSync(stagePath, new Uint8Array(await file.arrayBuffer()));

    try {
      attachFile(rootDir, id, kind, stagePath);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      const code = msg.includes('not found') && msg.includes(id) ? 404 : 400;
      return Response.json({ error: msg }, { status: code });
    }
    const updated = findById(rootDir, id);
    return Response.json(updated);
  }
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/api.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/api.ts tests/web/api.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add POST /api/items/:id/attach for spec/plan upload [Plan-7 Task-3]

Multipart form: kind=spec|plan, file=<binary>. Stages to tmp then calls
core attachFile(). Returns updated item or 4xx with error message.
EOF
)"
```

---

### Task 4: Client-side API additions

**Files:**
- Modify: `src/web/frontend/src/api.ts`

**Goal:** Add typed client wrappers for the three new endpoints. No tests — these are thin fetch wrappers exercised by the Playwright E2E in Task 8.

- [ ] **Step 1: Add the new functions**

Append to `/home/fintan/repos/kadai/src/web/frontend/src/api.ts`:

```typescript
import type { Status } from './types';

export interface Transitions {
  current: Status;
  allowed: Status[];
}

export async function getTransitions(id: string): Promise<Transitions | null> {
  const r = await fetch(`/api/items/${id}/transitions`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`/api/items/${id}/transitions → ${r.status}`);
  return r.json() as Promise<Transitions>;
}

export async function setItemStatus(id: string, status: Status): Promise<Item> {
  const r = await fetch(`/api/items/${id}/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!r.ok) {
    const json = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(json.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<Item>;
}

export async function attachFile(id: string, kind: 'spec' | 'plan', file: File): Promise<Item> {
  const form = new FormData();
  form.append('kind', kind);
  form.append('file', file);
  const r = await fetch(`/api/items/${id}/attach`, { method: 'POST', body: form });
  if (!r.ok) {
    const json = await r.json().catch(() => ({ error: `HTTP ${r.status}` }));
    throw new Error(json.error ?? `HTTP ${r.status}`);
  }
  return r.json() as Promise<Item>;
}
```

(Note: `Item` is already imported at the top of the file. Add only the `Status` import.)

- [ ] **Step 2: Verify typecheck passes**

```bash
cd /home/fintan/repos/kadai
bun run typecheck
```

Expected: clean exit (no TS errors).

- [ ] **Step 3: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/api.ts
git commit -m "$(cat <<'EOF'
feat(web/client): add setItemStatus, getTransitions, attachFile [Plan-7 Task-4]

Typed wrappers for the new write endpoints. Errors come back as thrown
Error(message) so consumers can surface them in the UI.
EOF
)"
```

---

### Task 5: StatusPanel component + Story right rail

**Files:**
- Create: `src/web/frontend/src/components/StatusPanel.tsx`
- Modify: `src/web/frontend/src/pages/Story.tsx`

**Goal:** Add a panel in the story page showing the current status + a button per legal next state. Clicking sends `setItemStatus`; on success the local story state updates; on error a small inline message appears below the buttons. Optimistic UI: button click flips the status immediately; if the server rejects, revert + show the error.

- [ ] **Step 1: Create the StatusPanel component**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/StatusPanel.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { getTransitions, setItemStatus } from '../api';
import type { Status } from '../types';

interface Props {
  itemId: string;
  currentStatus: Status;
  onStatusChange: (newStatus: Status) => void;
}

export function StatusPanel({ itemId, currentStatus, onStatusChange }: Props) {
  const [allowed, setAllowed] = useState<Status[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    getTransitions(itemId).then(t => setAllowed(t?.allowed ?? []));
  }, [itemId, currentStatus]);

  async function move(target: Status) {
    setPending(true);
    setError(null);
    const previous = currentStatus;
    onStatusChange(target);  // optimistic
    try {
      await setItemStatus(itemId, target);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      onStatusChange(previous);  // revert
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="bg-panel rounded p-3 space-y-2">
      <div className="text-xs font-bold uppercase tracking-wider text-muted">Status</div>
      <div className="text-sm">{currentStatus}</div>
      {allowed.length > 0 && (
        <div className="space-y-1 pt-2 border-t border-zinc-800">
          <div className="text-[10px] text-muted uppercase">Move to</div>
          {allowed.map(s => (
            <button
              key={s}
              disabled={pending}
              onClick={() => move(s)}
              className="block w-full text-left text-xs px-2 py-1 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 rounded"
            >
              {s}
            </button>
          ))}
        </div>
      )}
      {error && (
        <div className="text-xs text-red-400 pt-2 border-t border-zinc-800">{error}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire StatusPanel into Story.tsx**

Edit `/home/fintan/repos/kadai/src/web/frontend/src/pages/Story.tsx`. At the top of the file, add:

```typescript
import { StatusPanel } from '../components/StatusPanel';
import type { Status } from '../types';
```

Replace the outer return wrapper. The current outer JSX is:

```tsx
return (
  <div className="space-y-6">
    <div>
      <Link ...>← back to {d.parent}</Link>
      <div className="mt-2 text-xs text-muted">{d.id} · phase {d.phase} · {d.status}</div>
      <h1 className="text-2xl font-bold">{d.title}</h1>
    </div>
    ...rest...
  </div>
);
```

Change it to a 2-column grid (main + right rail):

```tsx
function patchStatus(next: Status) {
  setStory(prev => prev ? { ...prev, data: { ...prev.data, status: next } } : prev);
}

return (
  <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px] gap-6">
    <div className="space-y-6">
      <div>
        <Link to="/features/$id" params={{ id: d.parent }} className="text-xs text-muted hover:text-zinc-300">← back to {d.parent}</Link>
        <div className="mt-2 text-xs text-muted">{d.id} · phase {d.phase} · {d.status}</div>
        <h1 className="text-2xl font-bold">{d.title}</h1>
      </div>

      <div className="border-b border-zinc-800 flex gap-4">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 text-sm capitalize ${tab === t ? 'text-zinc-100 border-b-2 border-zinc-100 -mb-px' : 'text-muted hover:text-zinc-300'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-panel rounded p-4">
        {/* keep the existing tab body unchanged */}
        {tab === 'story' && (
          <div className="space-y-3">
            {d.acceptance_criteria && (
              <div>
                <h3 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">Acceptance criteria</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {d.acceptance_criteria.map((c, i) => <li key={i}>{c}</li>)}
                </ul>
              </div>
            )}
            <Markdown>{story.body}</Markdown>
          </div>
        )}
        {tab === 'spec' && (spec ? <Markdown>{spec}</Markdown> : <div className="text-muted italic">No spec attached.</div>)}
        {tab === 'plan' && (plan ? <Markdown>{plan}</Markdown> : <div className="text-muted italic">No plan attached.</div>)}
        {tab === 'changelog' && (changelog ? <Markdown>{changelog}</Markdown> : <div className="text-muted italic">No changelog yet.</div>)}
        {tab === 'tasks' && (
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <div className="text-muted italic">No tasks yet.</div>
            ) : tasks.map(t => {
              const td = t.data as { id: string; title: string; status: string };
              return (
                <div key={td.id} className="flex items-center gap-3">
                  <input type="checkbox" checked={td.status === 'done'} readOnly />
                  <span className="text-xs text-muted">{td.id}</span>
                  <span>{td.title}</span>
                  <span className="ml-auto text-xs bg-zinc-800 px-2 py-0.5 rounded">{td.status}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>

    <aside className="space-y-4">
      <StatusPanel
        itemId={d.id}
        currentStatus={d.status as Status}
        onStatusChange={patchStatus}
      />
    </aside>
  </div>
);
```

- [ ] **Step 3: Build the SPA + smoke-test in browser**

```bash
cd /home/fintan/repos/kadai
bun run build:web
```

Then in a temp dir, manually verify the panel renders:

```bash
TMP=$(mktemp -d) && cd "$TMP" && \
  kadai init -y > /dev/null && \
  kadai add feature --title "T" --phase mvp --epic EPIC-001 > /dev/null && \
  kadai add story --title "S" --phase mvp --feature FEAT-001 > /dev/null && \
  kadai serve --no-open --port 4747 &
sleep 2
curl -s http://localhost:4747/api/items/STORY-001/transitions | head -c 200
echo ""
# Visit http://localhost:4747/stories/STORY-001 in a browser if available; verify the right rail "Status" panel renders with action buttons.
# Then:
pkill -f "kadai serve --no-open --port 4747" || true
cd / && rm -rf "$TMP"
```

Expected curl output: `{"current":"ready","allowed":["in_progress","cancelled"]}`

- [ ] **Step 4: Verify typecheck + tests still pass**

```bash
cd /home/fintan/repos/kadai
bun run typecheck
bun test
```

Expected: clean exit on both.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/components/StatusPanel.tsx src/web/frontend/src/pages/Story.tsx
git commit -m "$(cat <<'EOF'
feat(web/client): add StatusPanel right rail on story page [Plan-7 Task-5]

Renders current status + a button per legal next state. Optimistic UI with
revert-on-error. Layout becomes a 2-column grid (lg+) — main content left,
220px rail right.
EOF
)"
```

---

### Task 6: Drag-drop kanban

**Files:**
- Modify: `package.json` (add `@dnd-kit/core`, `@dnd-kit/sortable`)
- Modify: `src/web/frontend/src/components/KanbanBoard.tsx`
- Modify: `src/web/frontend/src/pages/Feature.tsx`

**Goal:** Make the kanban columns drop targets. Dragging a story card to a new column triggers `setItemStatus`. If the transition is illegal, the card snaps back and an error toast appears at the top of the board for 4 seconds. Cards remain clickable as `<Link>` for navigation (DnD only fires on a real drag, not a click).

- [ ] **Step 1: Install dependencies**

```bash
cd /home/fintan/repos/kadai
bun add @dnd-kit/core@^6.3.1
```

(`@dnd-kit/sortable` is not needed — we're using `useDraggable`/`useDroppable` directly, not a sortable list.)

Verify it landed in package.json + lockfile:

```bash
grep "@dnd-kit/core" package.json
```

Expected: `"@dnd-kit/core": "^6.3.1"`.

- [ ] **Step 2: Rewrite KanbanBoard.tsx**

Replace `/home/fintan/repos/kadai/src/web/frontend/src/components/KanbanBoard.tsx` entirely with:

```typescript
import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  type DragEndEvent,
} from '@dnd-kit/core';
import type { Item, Status } from '../types';
import { setItemStatus } from '../api';

const COLUMNS: Status[] = ['backlog', 'ready', 'in_progress', 'blocked', 'review', 'done'];

interface Props {
  stories: Item[];
  onLocalStatusChange: (storyId: string, newStatus: Status) => void;
}

export function KanbanBoard({ stories, onLocalStatusChange }: Props) {
  const [error, setError] = useState<string | null>(null);
  // Require 6px of movement before dragging — otherwise <Link> clicks would never fire.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  async function handleDragEnd(e: DragEndEvent) {
    if (!e.over) return;
    const storyId = String(e.active.id);
    const target = String(e.over.id) as Status;
    const story = stories.find(s => (s.data as any).id === storyId);
    if (!story || story.data.status === target) return;

    const previous = story.data.status;
    onLocalStatusChange(storyId, target);  // optimistic
    setError(null);
    try {
      await setItemStatus(storyId, target);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      onLocalStatusChange(storyId, previous);
      setTimeout(() => setError(null), 4000);
    }
  }

  return (
    <div className="space-y-2">
      {error && (
        <div className="bg-red-900/50 text-red-200 text-xs px-3 py-2 rounded">{error}</div>
      )}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {COLUMNS.map(col => (
            <Column key={col} status={col} stories={stories.filter(s => s.data.status === col)} />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

function Column({ status, stories }: { status: Status; stories: Item[] }) {
  const { isOver, setNodeRef } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      data-testid={`column-${status}`}
      className={`bg-panel rounded p-2 ${isOver ? 'ring-2 ring-zinc-400' : ''}`}
    >
      <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{status}</div>
      <div className="space-y-2">
        {stories.map(s => <Card key={(s.data as any).id} story={s} />)}
      </div>
    </div>
  );
}

function Card({ story }: { story: Item }) {
  const d = story.data as { id: string; title: string };
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: d.id });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid={`card-${d.id}`}
      className={`bg-zinc-800 rounded p-2 text-xs hover:bg-zinc-700 ${isDragging ? 'opacity-50' : ''}`}
      {...listeners}
      {...attributes}
    >
      <div className="text-muted text-[10px]">{d.id}</div>
      <Link to="/stories/$id" params={{ id: d.id }} className="block">{d.title}</Link>
    </div>
  );
}
```

- [ ] **Step 3: Update Feature.tsx to pass onLocalStatusChange**

Edit `/home/fintan/repos/kadai/src/web/frontend/src/pages/Feature.tsx`. Replace the existing `<KanbanBoard stories={stories} />` line with:

```tsx
<KanbanBoard
  stories={stories}
  onLocalStatusChange={(storyId, newStatus) =>
    setStories(prev => prev.map(s =>
      (s.data as any).id === storyId
        ? { ...s, data: { ...s.data, status: newStatus } }
        : s
    ))
  }
/>
```

Also add this import (alongside the existing `Item` import):

```typescript
import type { Status } from '../types';
```

(Used implicitly via the callback signature; if TS doesn't complain, you can omit it.)

- [ ] **Step 4: Build + smoke test**

```bash
cd /home/fintan/repos/kadai
bun run build:web
```

Manual test (similar to Task 5 Step 3): start `kadai serve` against a temp project that has at least 2 stories in different columns; in the browser, drag a card from one column to another and confirm the column count updates + the change persists across refresh.

- [ ] **Step 5: Verify typecheck + tests still pass**

```bash
cd /home/fintan/repos/kadai
bun run typecheck
bun test
```

Expected: clean exit on both.

- [ ] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add package.json bun.lock src/web/frontend/src/components/KanbanBoard.tsx src/web/frontend/src/pages/Feature.tsx
git commit -m "$(cat <<'EOF'
feat(web/client): drag-drop status changes on the feature kanban [Plan-7 Task-6]

Adds @dnd-kit/core. Cards are draggable; columns are drop targets;
PointerSensor distance:6 keeps <Link> click navigation working.
Optimistic UI with revert + 4s error toast on illegal transition.
EOF
)"
```

---

### Task 7: Attach UI on the story page

**Files:**
- Create: `src/web/frontend/src/components/AttachButton.tsx`
- Modify: `src/web/frontend/src/pages/Story.tsx`

**Goal:** When the spec or plan tab is empty, show an "Attach a spec.md" / "Attach a plan.md" button. Clicking it opens a hidden file picker; the selected file uploads via `attachFile`; on success, the tab content refreshes to show the new markdown.

- [ ] **Step 1: Create the AttachButton component**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/AttachButton.tsx`:

```typescript
import { useRef, useState } from 'react';
import { attachFile } from '../api';

interface Props {
  itemId: string;
  kind: 'spec' | 'plan';
  onAttached: () => void;
}

export function AttachButton({ itemId, kind, onAttached }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPending(true);
    setError(null);
    try {
      await attachFile(itemId, kind, file);
      onAttached();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div className="space-y-2">
      <button
        disabled={pending}
        onClick={() => inputRef.current?.click()}
        className="bg-zinc-800 hover:bg-zinc-700 text-sm px-3 py-1.5 rounded disabled:opacity-50"
      >
        {pending ? 'Uploading…' : `Attach a ${kind}.md`}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept=".md,text/markdown"
        className="hidden"
        onChange={handleChange}
      />
      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Wire AttachButton into Story.tsx**

Edit `/home/fintan/repos/kadai/src/web/frontend/src/pages/Story.tsx`. Add the import alongside the others:

```typescript
import { AttachButton } from '../components/AttachButton';
```

Add a refresh helper inside the component, near `patchStatus`:

```typescript
function reloadAttached(filename: 'spec.md' | 'plan.md') {
  getFile(d.id, filename).then(content => {
    if (filename === 'spec.md') setSpec(content);
    else setPlan(content);
  });
}
```

Replace the spec and plan tab bodies. Currently:

```tsx
{tab === 'spec' && (spec ? <Markdown>{spec}</Markdown> : <div className="text-muted italic">No spec attached.</div>)}
{tab === 'plan' && (plan ? <Markdown>{plan}</Markdown> : <div className="text-muted italic">No plan attached.</div>)}
```

Change to:

```tsx
{tab === 'spec' && (spec ? (
  <Markdown>{spec}</Markdown>
) : (
  <div className="space-y-3">
    <div className="text-muted italic">No spec attached.</div>
    <AttachButton itemId={d.id} kind="spec" onAttached={() => reloadAttached('spec.md')} />
  </div>
))}
{tab === 'plan' && (plan ? (
  <Markdown>{plan}</Markdown>
) : (
  <div className="space-y-3">
    <div className="text-muted italic">No plan attached.</div>
    <AttachButton itemId={d.id} kind="plan" onAttached={() => reloadAttached('plan.md')} />
  </div>
))}
```

- [ ] **Step 3: Build + smoke test**

```bash
cd /home/fintan/repos/kadai
bun run build:web
```

Manual test: start `kadai serve` against a temp project, navigate to a story, switch to the "spec" tab, click "Attach a spec.md", pick any small `.md` file from disk, confirm the markdown renders after upload, refresh the page, confirm it persists.

- [ ] **Step 4: Verify typecheck + tests**

```bash
cd /home/fintan/repos/kadai
bun run typecheck
bun test
```

Expected: clean exit on both.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/components/AttachButton.tsx src/web/frontend/src/pages/Story.tsx
git commit -m "$(cat <<'EOF'
feat(web/client): add AttachButton on empty spec/plan tabs [Plan-7 Task-7]

Hidden <input type=file>; on upload, calls POST /api/items/:id/attach
and refetches the file content to render the markdown.
EOF
)"
```

---

### Task 8: Playwright E2E for the new interactions

**Files:**
- Modify: `tests/web/e2e.pw.ts`

**Goal:** Add 3 E2E flows: (a) click a status button in the story rail; (b) drag a card across columns; (c) attach a spec via the file input.

- [ ] **Step 1: Extend the seed**

Edit `/home/fintan/repos/kadai/tests/web/e2e.pw.ts`. Inside the `helperScript` template literal in `spawnServer`, expand the `runAdd` calls so the seed has 3 stories (so DnD has somewhere to drag from/to):

Replace the existing 4 runAdd lines:

```typescript
runAdd({ rootDir: tmp, kind: 'epic', title: 'Authentication', phase: 'mvp' });
runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
runAdd({ rootDir: tmp, kind: 'story', title: 'Email login', phase: 'mvp', parent: 'FEAT-001' });
```

With:

```typescript
runAdd({ rootDir: tmp, kind: 'epic', title: 'Authentication', phase: 'mvp' });
runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
runAdd({ rootDir: tmp, kind: 'story', title: 'Email login', phase: 'mvp', parent: 'FEAT-001' });
runAdd({ rootDir: tmp, kind: 'story', title: 'OAuth login', phase: 'mvp', parent: 'FEAT-001' });
runAdd({ rootDir: tmp, kind: 'story', title: 'Magic link', phase: 'mvp', parent: 'FEAT-001' });
```

- [ ] **Step 2: Add a status-button test**

Append to `/home/fintan/repos/kadai/tests/web/e2e.pw.ts`:

```typescript
test('clicking a status button on the story page moves the story', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-001`);
  await page.waitForLoadState('networkidle');

  // Right rail Status panel should show "ready" current + an "in_progress" button.
  await expect(page.locator('aside').locator('text=ready').first()).toBeVisible();
  await page.locator('aside').locator('button', { hasText: 'in_progress' }).click();

  // Wait for the status text in the rail to update.
  await expect(page.locator('aside').locator('text=in_progress').first()).toBeVisible({ timeout: 3000 });

  // Reload and confirm it persisted.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('aside').locator('text=in_progress').first()).toBeVisible();
});
```

- [ ] **Step 3: Add a drag-drop kanban test**

Append:

```typescript
test('dragging a story card across columns updates its status', async ({ page }) => {
  await page.goto(`${serverUrl}/features/FEAT-001`);
  await page.waitForLoadState('networkidle');

  // Move STORY-002 from the 'ready' column into 'blocked'.
  // (After the previous test STORY-001 may already be in_progress; STORY-002/003 should still be 'ready'.)
  const card = page.locator('[data-testid="card-STORY-002"]');
  const blocked = page.locator('[data-testid="column-blocked"]');

  // PointerSensor in KanbanBoard requires distance:6 movement before drag activates,
  // so we have to move the mouse explicitly (not just hover + down + hover + up).
  const cardBox = await card.boundingBox();
  const blockedBox = await blocked.boundingBox();
  if (!cardBox || !blockedBox) throw new Error('Bounding boxes unavailable');
  await page.mouse.move(cardBox.x + 10, cardBox.y + 10);
  await page.mouse.down();
  await page.mouse.move(cardBox.x + 10, cardBox.y + 30, { steps: 5 });  // exceed 6px to activate
  await page.mouse.move(blockedBox.x + blockedBox.width / 2, blockedBox.y + blockedBox.height / 2, { steps: 10 });
  await page.mouse.up();

  // After drop, the card should now appear inside the 'blocked' column container.
  await expect(blocked.locator('[data-testid="card-STORY-002"]')).toBeVisible({ timeout: 3000 });

  // Reload and confirm it persisted.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-testid="column-blocked"]').locator('[data-testid="card-STORY-002"]')).toBeVisible();
});
```

- [ ] **Step 4: Add an attach-upload test**

Append:

```typescript
test('attaching a spec.md uploads and renders it', async ({ page }) => {
  await page.goto(`${serverUrl}/stories/STORY-003`);
  await page.waitForLoadState('networkidle');

  // Switch to the spec tab. It starts empty + shows the Attach button.
  await page.locator('button', { hasText: 'spec' }).click();
  await expect(page.locator('text=No spec attached')).toBeVisible();

  // Set the hidden file input directly (Playwright's setInputFiles bypasses the click).
  await page.locator('input[type="file"]').setInputFiles({
    name: 'spec.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from('# Uploaded spec\n\nHello kadai.\n'),
  });

  // The markdown should render.
  await expect(page.locator('text=Uploaded spec')).toBeVisible({ timeout: 5000 });
});
```

- [ ] **Step 5: Build the SPA + run Playwright**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bunx playwright install chromium  # idempotent; only downloads if missing
bunx playwright test
```

Expected: all E2E tests pass (3 existing + 3 new = 6).

- [ ] **Step 6: Verify the unit suite still passes**

```bash
cd /home/fintan/repos/kadai
bun test
```

Expected: clean (~189+ tests pass; new attach/api ones included).

- [ ] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add tests/web/e2e.pw.ts
git commit -m "$(cat <<'EOF'
test(web/e2e): cover status button, kanban DnD, attach upload [Plan-7 Task-8]

Expands the seed to 3 stories so DnD has somewhere to drag.
Three new flows verify the new interactivity end-to-end via headless chromium.
EOF
)"
```

---

### Task 9: Docs + plugin version + post-MVP tracking + dogfood

**Files:**
- Create: `docs/wiki/api-reference.md`
- Modify: `docs/wiki/web-viewer.md` (existing — see what's there first)
- Modify: `docs/wiki/post-mvp.md`
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (0.2.0 → 0.3.0)
- Append: `docs/dogfood-acceptance-test.md`

**Goal:** Capture the new endpoints in a fresh `api-reference.md`, note the new interactivity in `web-viewer.md`, mark Plan 7 shipped in `post-mvp.md`, bump the plugin patch version (no plugin changes but version sync makes "what's the current build" easy to answer), and run a brief dogfood verification.

- [ ] **Step 1: Create the API reference doc**

Create `/home/fintan/repos/kadai/docs/wiki/api-reference.md`:

````markdown
# Web API reference

The kadai web viewer (`kadai serve`) exposes a small HTTP API at `/api/*`. All paths are JSON unless noted.

## Read endpoints

| Method | Path | Returns |
|---|---|---|
| `GET` | `/api/phases` | `PhaseConfig[]` from `.kadai/config.toml` |
| `GET` | `/api/epics?phase=&status=` | `Item[]` |
| `GET` | `/api/features?epic_id=&phase=&status=` | `Item[]` |
| `GET` | `/api/stories?feature_id=&phase=&status=` | `Item[]` |
| `GET` | `/api/tasks?story_id=&status=` | `Item[]` |
| `GET` | `/api/items/:id` | `Item` (404 if not found) |
| `GET` | `/api/items/:id/transitions` | `{ current: Status, allowed: Status[] }` |
| `GET` | `/api/picked` | `Item \| null` |
| `GET` | `/api/files/:id/(spec.md\|plan.md\|changelog.md)` | `text/plain` of the file contents |

## Write endpoints

| Method | Path | Body | Returns |
|---|---|---|---|
| `POST` | `/api/items/:id/status` | `{"status":"<status>"}` | updated `Item` (200), `{"error"}` (400/404) |
| `POST` | `/api/items/:id/attach` | multipart: `kind=spec\|plan`, `file=<binary>` | updated `Item` (200), `{"error"}` (400/404) |

### `POST /api/items/:id/status`

Validates the transition against the state machine. Illegal transitions return 400 with `{"error":"Illegal transition for <id> (<kind>): <from> → <to>"}`.

```bash
curl -X POST http://localhost:7777/api/items/STORY-001/status \
  -H 'Content-Type: application/json' \
  -d '{"status":"in_progress"}'
```

### `POST /api/items/:id/attach`

Accepts a multipart form with `kind` (`spec` or `plan`) and `file` (the markdown blob). Writes the file as `spec.md` or `plan.md` inside the item's directory and updates the item's frontmatter.

- `kind=spec` is allowed on `feature` and `story` items.
- `kind=plan` is allowed on `story` items only.

```bash
curl -X POST http://localhost:7777/api/items/STORY-001/attach \
  -F 'kind=plan' \
  -F 'file=@./my-plan.md'
```

## Notes

- All write endpoints validate via the same core logic as the CLI and MCP tools, so concurrent CLI/MCP/web edits stay schema-correct.
- There is no auth — `kadai serve` listens on localhost only and assumes the operator is the user.
- For real-time updates across browser tabs, see Plan 8 (SSE) once it ships.
````

- [ ] **Step 2: Update web-viewer.md**

Read `/home/fintan/repos/kadai/docs/wiki/web-viewer.md` first to see what's there. Find the section that describes the story detail / feature detail behavior. Add a paragraph that says:

```markdown
## Interactivity (Plan 7+)

The viewer is no longer read-only. From the story page right rail you can move the story to any legal next status. From the feature page kanban you can drag a story card across columns to change its status. From the spec/plan tabs you can upload a markdown file via the **Attach** button — the file is moved into the item directory and the frontmatter is updated.

Status changes are optimistic — the UI updates immediately and reverts if the server rejects (e.g., illegal transition). For real-time sync across multiple browser tabs, see Plan 8 (forthcoming).
```

(If `web-viewer.md` doesn't exist, create it with the section above as the body and a `# Web viewer` heading at the top.)

- [ ] **Step 3: Update post-mvp.md**

In `/home/fintan/repos/kadai/docs/wiki/post-mvp.md`:

(a) Remove the entire "### Plan 7 — Web viewer interactivity 🟢 **next**" section.

(b) Mark the next plan with the 🟢 **next** badge. Per the current order, that's:

```markdown
### Plan 8 — Live updates (SSE) 🟢 **next**
```

(c) In the "Recently shipped" section, add (above the existing Plan 6 entry):

```markdown
### Plan 7 — Web viewer interactivity (shipped 2026-05-05)

- `POST /api/items/:id/status` — status mutations from the web
- `GET /api/items/:id/transitions` — exposes legal next states
- `POST /api/items/:id/attach` — multipart upload for spec.md / plan.md
- `core/attach.ts` — extracted from MCP handlers; shared by web + MCP
- StatusPanel right rail on the story page (optimistic UI)
- Drag-drop kanban via @dnd-kit on the feature page
- AttachButton on empty spec/plan tabs
- 3 new Playwright E2E flows
- Plugin version bumped to 0.3.0
```

- [ ] **Step 4: Bump plugin version**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change:

```json
  "version": "0.2.0",
```

to:

```json
  "version": "0.3.0",
```

- [ ] **Step 5: Dogfood verification (shell test)**

Run a short Path A flow in a temp dir to verify the web viewer is reachable and the new endpoints respond. (The skill `kadai-dogfood-test` covers MCP/hooks; for Plan 7 we add a small web-API spot check.)

```bash
TMP=$(mktemp -d -t kadai-plan7-XXXXXX)
cd "$TMP"

kadai init -y > /dev/null
kadai add feature --title "T" --phase mvp --epic EPIC-001 > /dev/null
kadai add story --title "S" --phase mvp --feature FEAT-001 > /dev/null

# Start serve in the background on a fixed port.
kadai serve --no-open --port 7747 > /tmp/kadai-plan7-serve.log 2>&1 &
SERVE_PID=$!
sleep 2

echo "=== GET /api/items/STORY-001/transitions ==="
curl -s http://localhost:7747/api/items/STORY-001/transitions

echo ""
echo "=== POST /api/items/STORY-001/status -d '{\"status\":\"in_progress\"}' ==="
curl -s -X POST http://localhost:7747/api/items/STORY-001/status \
  -H 'Content-Type: application/json' \
  -d '{"status":"in_progress"}' | head -c 300

echo ""
echo "=== Verify status persisted via kadai status ==="
kadai status

kill $SERVE_PID || true
cd / && rm -rf "$TMP" /tmp/kadai-plan7-serve.log
```

Expected: transitions endpoint returns JSON with `allowed` array; status POST returns the updated item with `status: "in_progress"`; `kadai status` confirms STORY-001 is `in_progress`.

- [ ] **Step 6: Append the run to the dogfood acceptance log**

Append a section to `/home/fintan/repos/kadai/docs/dogfood-acceptance-test.md`:

```markdown
## Web API run — Plan 7 verification — 2026-05-05

Spot-checked the new write endpoints via curl after building the SPA + starting `kadai serve` against a temp project.

- `GET /api/items/STORY-001/transitions` → `{"current":"ready","allowed":[...]}` ✅
- `POST /api/items/STORY-001/status {"status":"in_progress"}` → 200 with updated item ✅
- `kadai status` confirmed the file write persisted ✅
- `bun test` → 189+/0 pass ✅
- `bunx playwright test` → 6/6 pass (3 existing + 3 Plan 7 flows) ✅

### Verdict: PASS

Web viewer is now writable end-to-end.
```

- [ ] **Step 7: Run all checks one last time**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
bun run build:web
bunx playwright test
```

Expected: every step exits clean.

- [ ] **Step 8: Commit**

```bash
cd /home/fintan/repos/kadai
git add docs/wiki/api-reference.md docs/wiki/web-viewer.md docs/wiki/post-mvp.md docs/dogfood-acceptance-test.md kadai-plugin/.claude-plugin/plugin.json docs/superpowers/plans/2026-05-05-kadai-07-web-viewer-interactivity.md
git commit -m "$(cat <<'EOF'
docs(plan-7): api-reference, web-viewer, post-mvp shipped + plugin 0.3.0 [Plan-7 Task-9]

- New docs/wiki/api-reference.md covers the GET + POST endpoint surface
- web-viewer.md gains an Interactivity section
- post-mvp.md: Plan 7 → Recently shipped, Plan 8 → next
- plugin.json: 0.2.0 → 0.3.0
- dogfood-acceptance-test.md: Plan 7 web-API spot check appended
EOF
)"
```

---

## Plan 7 self-review checklist

- [ ] All 9 tasks above completed; checkboxes ticked.
- [ ] `bun test` passes (~189+ tests including the new attach + status + transitions tests).
- [ ] `bun run typecheck` passes.
- [ ] `bunx playwright test` passes (6/6).
- [ ] `POST /api/items/:id/status` works end-to-end (verified in Task 9 dogfood).
- [ ] `POST /api/items/:id/attach` works end-to-end (verified in Task 8 E2E).
- [ ] Drag-drop kanban changes status persistently (verified in Task 8 E2E).
- [ ] StatusPanel reverts on illegal transition (visual smoke check in Task 5 step 3).
- [ ] Plugin v0.3.0 in the manifest.
- [ ] post-mvp.md updated: Plan 7 in "Recently shipped"; Plan 8 marked 🟢 **next**.
- [ ] api-reference.md and web-viewer.md committed.

---

## Proceed to Plan 8

Once the self-review checklist is fully ticked, the active plan in `/home/fintan/repos/kadai/CLAUDE.md` should be updated to point at Plan 8 (SSE live updates). The next plan is brainstormed/drafted from `docs/wiki/post-mvp.md` § Plan 8.
