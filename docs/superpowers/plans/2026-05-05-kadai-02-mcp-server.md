# Kadai Plan 2 — MCP server

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working `kadai mcp` stdio MCP server that exposes the kadai spine to agents through 18 typed tools (read + write + pick + attach), plus an extension to `kadai init` that registers the server in `.mcp.json`.

**Architecture:** Pure TypeScript on Bun. The MCP server is one process (started by Claude Code via `.mcp.json`) that imports the same Plan 1 core modules as the CLI. Tools are organized as a registry of `{name, description, inputSchema (Zod), handler}` objects; `server.ts` walks the registry to dispatch incoming MCP `tools/call` requests. **Each handler module exports a `registerXxxTools()` function** (rather than registering at import time) so tests have full control over registry state. Handlers delegate to existing core operations — no business logic is duplicated.

**Tech Stack:** TypeScript, Bun, `@modelcontextprotocol/sdk` (stdio transport), `zod` (already used; for tool input schemas), `zod-to-json-schema` (Zod → JSON Schema for MCP `tools/list` responses), `proper-lockfile` (advisory file lock for the `.counters.json` file to prevent races between MCP and CLI writes).

## Position in the build

| | |
|---|---|
| **This is plan** | 2 of 5 |
| **Prior plan** | [Plan 1 — Spine + CLI](2026-05-05-kadai-01-spine-and-cli.md) — `DONE` |
| **Next plan** | [Plan 3 — Hooks (guardrails)](2026-05-05-kadai-03-hooks.md) |
| **Index** | [README.md](README.md) |
| **Spec** | [`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md) (read §5.1, §5.5, §8) |

## What ships at the end

- `kadai mcp` launches a working stdio MCP server
- 18 tools callable from a connected MCP client:
  - **Reads (8):** `list_phases`, `list_epics`, `list_features`, `list_stories`, `list_tasks`, `get`, `get_active_story`, `search`
  - **Writes (10):** `create_epic`, `create_feature`, `create_story`, `create_task`, `set_status`, `set_phase`, `pick_story`, `unpick`, `attach_spec`, `attach_plan`
- All write tools validate inputs (Zod) and reject illegal state transitions with clear error messages
- `kadai init` extended to merge `kadai` MCP registration into `.mcp.json` (creating the file if missing)
- `nextId` (Plan 1) wrapped with advisory file lock so concurrent MCP + CLI writes don't race
- Integration smoke test spawns `kadai mcp` and verifies tool list + a representative round-trip
- All tests pass; typecheck clean

## Out of scope (deferred to later plans)

- `record_change` MCP tool — Plan 3 (paired with the PostToolUse hook)
- `sync_git` MCP tool — post-MVP
- Hooks installation — Plan 3
- `UserPromptSubmit` and `Stop` hooks — post-MVP
- Web viewer — Plan 4
- Bundled skill + slash commands — Plan 5

## File structure (created by this plan)

```
src/mcp/
├── types.ts              # ToolDef<Input> interface, ToolContext interface
├── registry.ts           # registerTool / listTools / getTool helpers (in-memory)
├── server.ts             # MCP server bootstrap; stdio transport; dispatcher; calls registry
└── handlers/
    ├── reads.ts          # list_*, get, get_active_story, search
    ├── creates.ts        # create_epic / create_feature / create_story / create_task
    ├── status.ts         # set_status, set_phase
    ├── picks.ts          # pick_story, unpick
    └── attach.ts         # attach_spec, attach_plan (file move + frontmatter update)

src/cli/
└── mcp.ts                # mcpCommand: imports server.ts, runs it; registered in index.ts

src/core/
└── (modify) ids.ts       # wrap counter read/write in proper-lockfile (Task 2)
```

## Tasks

---

### Task 1: Install MCP SDK + create `src/mcp/` structure

**Files:**
- Modify: `/home/fintan/repos/kadai/package.json` (add `@modelcontextprotocol/sdk`, `zod-to-json-schema`, `proper-lockfile` to dependencies; add `@types/proper-lockfile` to devDependencies)
- Create directories: `src/mcp/`, `src/mcp/handlers/`, `tests/mcp/`, `tests/mcp/handlers/`

**Goal:** Get the MCP SDK installed and the directory layout in place. No code yet.

- [x] **Step 1: Add dependencies**

```bash
cd /home/fintan/repos/kadai
bun add @modelcontextprotocol/sdk zod-to-json-schema proper-lockfile
bun add -d @types/proper-lockfile
```

Expected: `package.json` updated; `bun.lock` updated; `node_modules` populated.

- [x] **Step 2: Create directories**

```bash
mkdir -p src/mcp/handlers tests/mcp/handlers
touch src/mcp/.gitkeep tests/mcp/.gitkeep
```

(The `.gitkeep` files are removed once real files are created in Tasks 3+.)

- [x] **Step 3: Verify install**

```bash
bun run typecheck
```

Expected: exit 0 (existing code still compiles; new packages resolved).

- [x] **Step 4: Commit**

```bash
git add package.json bun.lock src/mcp tests/mcp docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "chore(mcp): install MCP SDK and scaffold src/mcp/ [Plan-2 Task-1]"
```

---

### Task 2: ID counter file locking

**Files:**
- Modify: `/home/fintan/repos/kadai/src/core/ids.ts`
- Modify: `/home/fintan/repos/kadai/tests/core/ids.test.ts`

**Goal:** Wrap `nextId`'s read-increment-write cycle in an advisory file lock so concurrent CLI + MCP writes don't race.

- [x] **Step 1: Add a failing concurrency test**

Append to `/home/fintan/repos/kadai/tests/core/ids.test.ts`:

```typescript
test('nextId is safe under concurrent calls', async () => {
  const promises = Array.from({ length: 10 }, () => Promise.resolve(nextId('epic', tmp)));
  const ids = await Promise.all(promises);
  const unique = new Set(ids);
  expect(unique.size).toBe(10);
});
```

> Note: This test simulates concurrency via Promise.all in a single process. With JavaScript's single-threaded model, this won't actually trigger a race in pure JS — but the lock ensures that even if two PROCESSES (CLI + MCP) hit the file simultaneously, ordering is enforced. The test verifies that `nextId` doesn't return duplicates under burst calls.

- [x] **Step 2: Run the test**

```bash
cd /home/fintan/repos/kadai && bun test tests/core/ids.test.ts
```

Expected: this specific new test passes already (single-threaded JS won't race in-process), but Step 3's lock-add still happens to defend against multi-process races.

- [x] **Step 3: Add file locking**

Replace the body of `/home/fintan/repos/kadai/src/core/ids.ts`'s `nextId` function (only — leave `formatId` and `parseId` as-is). The full new file:

```typescript
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import lockfile from 'proper-lockfile';
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

function ensureCounterFile(rootDir: string): string {
  const path = counterPath(rootDir);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify({ epic: 0, feature: 0, story: 0, task: 0 }, null, 2) + '\n');
  }
  return path;
}

function readCounters(path: string): Counters {
  return JSON.parse(readFileSync(path, 'utf8')) as Counters;
}

function writeCounters(path: string, counters: Counters): void {
  writeFileSync(path, JSON.stringify(counters, null, 2) + '\n', 'utf8');
}

export function nextId(kind: ItemKind, rootDir: string): string {
  const path = ensureCounterFile(rootDir);
  // Synchronous advisory file lock; release returned for cleanup
  const release = lockfile.lockSync(path, { retries: { retries: 5, minTimeout: 10, maxTimeout: 100 } });
  try {
    const counters = readCounters(path);
    counters[kind] += 1;
    writeCounters(path, counters);
    return formatId(kind, counters[kind]);
  } finally {
    release();
  }
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

- [x] **Step 4: Run all ID tests**

```bash
cd /home/fintan/repos/kadai && bun test tests/core/ids.test.ts
```

Expected: all 7 tests pass (6 original + 1 new concurrency test).

- [x] **Step 5: Run full test suite (regression check)**

```bash
cd /home/fintan/repos/kadai && bun test
```

Expected: 105 tests pass, 0 fail.

- [x] **Step 6: Commit**

```bash
git add src/core/ids.ts tests/core/ids.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "feat(core): add file lock to nextId counter writes [Plan-2 Task-2]"
```

---

### Task 3: MCP server bootstrap + tool registry framework

**Files:**
- Create: `/home/fintan/repos/kadai/src/mcp/types.ts`
- Create: `/home/fintan/repos/kadai/src/mcp/registry.ts`
- Create: `/home/fintan/repos/kadai/src/mcp/server.ts`
- Create: `/home/fintan/repos/kadai/tests/mcp/registry.test.ts`

**Goal:** Server bootstrap that loads an empty tool registry and stands up an MCP stdio server. No tools yet; that comes in Tasks 4+. Each subsequent task plugs handlers into the registry.

- [x] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/mcp/registry.test.ts`:

```typescript
import { test, expect, beforeEach } from 'bun:test';
import { z } from 'zod';
import { registerTool, listTools, getTool, _resetRegistry } from '../../src/mcp/registry';

beforeEach(() => { _resetRegistry(); });

test('registerTool adds a tool to the registry', () => {
  registerTool({
    name: 'test_tool',
    description: 'a test tool',
    inputSchema: z.object({}),
    handler: async () => 'ok',
  });
  expect(listTools().length).toBe(1);
  expect(listTools()[0].name).toBe('test_tool');
});

test('getTool returns the named tool', () => {
  registerTool({
    name: 'foo',
    description: 'x',
    inputSchema: z.object({}),
    handler: async () => null,
  });
  expect(getTool('foo')?.name).toBe('foo');
  expect(getTool('missing')).toBeUndefined();
});

test('registerTool rejects duplicate names', () => {
  registerTool({
    name: 'dup',
    description: 'x',
    inputSchema: z.object({}),
    handler: async () => null,
  });
  expect(() => registerTool({
    name: 'dup',
    description: 'x',
    inputSchema: z.object({}),
    handler: async () => null,
  })).toThrow(/duplicate/i);
});
```

- [x] **Step 2: Run the test (should fail)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/registry.test.ts
```

Expected: FAIL — modules not found.

- [x] **Step 3: Implement types + registry**

Create `/home/fintan/repos/kadai/src/mcp/types.ts`:

```typescript
import type { z } from 'zod';

export interface ToolContext {
  rootDir: string;
}

export interface ToolDef<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodType<Input>;
  handler: (input: Input, ctx: ToolContext) => Promise<Output>;
}
```

Create `/home/fintan/repos/kadai/src/mcp/registry.ts`:

```typescript
import type { ToolDef } from './types';

let tools: ToolDef[] = [];

export function registerTool(def: ToolDef): void {
  if (tools.some(t => t.name === def.name)) {
    throw new Error(`Duplicate tool name: ${def.name}`);
  }
  tools.push(def);
}

export function listTools(): ToolDef[] {
  return [...tools];
}

export function getTool(name: string): ToolDef | undefined {
  return tools.find(t => t.name === name);
}

/** Test-only: reset the registry. Not exported for production use. */
export function _resetRegistry(): void {
  tools = [];
}
```

- [x] **Step 4: Implement server bootstrap**

Create `/home/fintan/repos/kadai/src/mcp/server.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { listTools, getTool } from './registry';
import type { ToolContext } from './types';

export async function runServer(rootDir: string): Promise<void> {
  const server = new Server(
    { name: 'kadai', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const ctx: ToolContext = { rootDir };

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: listTools().map(t => ({
        name: t.name,
        description: t.description,
        inputSchema: zodToJsonSchema(t.inputSchema, { target: 'jsonSchema7' }) as Record<string, unknown>,
      })),
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const { name, arguments: args } = req.params;
    const tool = getTool(name);
    if (!tool) {
      return {
        content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
        isError: true,
      };
    }
    try {
      const parsed = tool.inputSchema.parse(args ?? {});
      const result = await tool.handler(parsed, ctx);
      const text = result === undefined || result === null
        ? 'OK'
        : JSON.stringify(result, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return {
        content: [{ type: 'text' as const, text: msg }],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
```

- [x] **Step 5: Run the registry test**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/registry.test.ts
```

Expected: 3 tests pass.

- [x] **Step 6: Verify typecheck**

```bash
cd /home/fintan/repos/kadai && bun run typecheck
```

Expected: exit 0.

- [x] **Step 7: Commit**

```bash
git add src/mcp/types.ts src/mcp/registry.ts src/mcp/server.ts tests/mcp/registry.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "feat(mcp): add server bootstrap and tool registry framework [Plan-2 Task-3]"
```

---

### Task 4: Read tools — `list_*` (5 tools)

**Files:**
- Create: `/home/fintan/repos/kadai/src/mcp/handlers/reads.ts`
- Create: `/home/fintan/repos/kadai/tests/mcp/handlers/reads.test.ts`

**Goal:** Five list tools (`list_phases`, `list_epics`, `list_features`, `list_stories`, `list_tasks`) registered in the registry. Filter inputs (phase, status, parent IDs).

- [ ] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/mcp/handlers/reads.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerReadTools } from '../../../src/mcp/handlers/reads';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerReadTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-reads-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('list_phases returns the configured phases', async () => {
  const tool = getTool('list_phases')!;
  const result = await tool.handler({}, ctx()) as Array<{ slug: string }>;
  expect(result.map(p => p.slug)).toEqual(['mvp', 'v1', 'future', 'parking-lot']);
});

test('list_epics returns all epics with no filter', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'v1' });
  const tool = getTool('list_epics')!;
  const result = await tool.handler({}, ctx()) as unknown[];
  expect(result.length).toBe(2);
});

test('list_epics filters by phase', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'v1' });
  const tool = getTool('list_epics')!;
  const result = await tool.handler({ phase: 'mvp' }, ctx()) as unknown[];
  expect(result.length).toBe(1);
});

test('list_features filters by epic_id', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'B', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F1', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F2', phase: 'mvp', parent: 'EPIC-002' });
  const tool = getTool('list_features')!;
  const result = await tool.handler({ epic_id: 'EPIC-001' }, ctx()) as Array<{ data: { id: string } }>;
  expect(result.length).toBe(1);
  expect(result[0].data.id).toBe('FEAT-001');
});

test('list_stories filters by feature_id', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  const tool = getTool('list_stories')!;
  const result = await tool.handler({ feature_id: 'FEAT-001' }, ctx()) as unknown[];
  expect(result.length).toBe(1);
});

test('list_tasks filters by story_id', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T1', parent: 'STORY-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T2', parent: 'STORY-001' });
  const tool = getTool('list_tasks')!;
  const result = await tool.handler({ story_id: 'STORY-001' }, ctx()) as unknown[];
  expect(result.length).toBe(2);
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/reads.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement read handlers**

Create `/home/fintan/repos/kadai/src/mcp/handlers/reads.ts`:

```typescript
import { z } from 'zod';
import { walkSpine } from '../../core/spine';
import { loadConfig } from '../../config/load';
import { registerTool } from '../registry';
import type { Item } from '../../core/types';
import type { ItemKind, Status } from '../../core/state-machine';

const STATUS_VALUES = [
  'backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'cancelled',
] as const;

function filterItems(
  items: Item[],
  kind: ItemKind,
  filters: { phase?: string; status?: Status; parent?: string },
): Item[] {
  return items.filter(item => {
    if (item.kind !== kind) return false;
    const d = item.data as Record<string, unknown>;
    if (filters.phase && d.phase !== filters.phase) return false;
    if (filters.status && item.data.status !== filters.status) return false;
    if (filters.parent && d.parent !== filters.parent) return false;
    return true;
  });
}

export function registerReadTools(): void {
  registerTool({
    name: 'list_phases',
    description: 'List all configured phases (slug, display name, color). Phases are the scope tiers (e.g. mvp, v1, future) that epics/features/stories belong to.',
    inputSchema: z.object({}),
    handler: async (_args, ctx) => {
      return loadConfig(ctx.rootDir).phases;
    },
  });

  registerTool({
    name: 'list_epics',
    description: 'List epics in the spine, optionally filtered by phase and/or status.',
    inputSchema: z.object({
      phase: z.string().optional(),
      status: z.enum(STATUS_VALUES).optional(),
    }),
    handler: async (args, ctx) => {
      return filterItems(walkSpine(ctx.rootDir), 'epic', args);
    },
  });

  registerTool({
    name: 'list_features',
    description: 'List features, optionally filtered by epic_id (parent), phase, and/or status.',
    inputSchema: z.object({
      epic_id: z.string().regex(/^EPIC-\d+$/).optional(),
      phase: z.string().optional(),
      status: z.enum(STATUS_VALUES).optional(),
    }),
    handler: async (args, ctx) => {
      return filterItems(walkSpine(ctx.rootDir), 'feature', {
        phase: args.phase,
        status: args.status,
        parent: args.epic_id,
      });
    },
  });

  registerTool({
    name: 'list_stories',
    description: 'List stories, optionally filtered by feature_id (parent), phase, and/or status.',
    inputSchema: z.object({
      feature_id: z.string().regex(/^FEAT-\d+$/).optional(),
      phase: z.string().optional(),
      status: z.enum(STATUS_VALUES).optional(),
    }),
    handler: async (args, ctx) => {
      return filterItems(walkSpine(ctx.rootDir), 'story', {
        phase: args.phase,
        status: args.status,
        parent: args.feature_id,
      });
    },
  });

  registerTool({
    name: 'list_tasks',
    description: 'List tasks, optionally filtered by story_id (parent) and/or status.',
    inputSchema: z.object({
      story_id: z.string().regex(/^STORY-\d+$/).optional(),
      status: z.enum(STATUS_VALUES).optional(),
    }),
    handler: async (args, ctx) => {
      return filterItems(walkSpine(ctx.rootDir), 'task', {
        status: args.status,
        parent: args.story_id,
      });
    },
  });
}
```

- [ ] **Step 4: Run the tests (should pass)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/reads.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/handlers/reads.ts tests/mcp/handlers/reads.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "feat(mcp): add list_* read tools [Plan-2 Task-4]"
```

---

### Task 5: Read tools — `get` + `get_active_story`

**Files:**
- Create: `/home/fintan/repos/kadai/src/mcp/handlers/get.ts`
- Create: `/home/fintan/repos/kadai/tests/mcp/handlers/get.test.ts`

**Goal:** `get(id)` returns any item by ID; `get_active_story()` returns the currently picked story (or null).

- [ ] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/mcp/handlers/get.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerGetTools } from '../../../src/mcp/handlers/get';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';
import { setPicked } from '../../../src/core/picked';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerGetTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-get-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('get returns an existing item', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  const tool = getTool('get')!;
  const result = await tool.handler({ id: 'EPIC-001' }, ctx()) as { data: { title: string } } | null;
  expect(result?.data.title).toBe('Auth');
});

test('get returns null for unknown ID', async () => {
  const tool = getTool('get')!;
  const result = await tool.handler({ id: 'EPIC-999' }, ctx());
  expect(result).toBeNull();
});

test('get_active_story returns null when nothing picked', async () => {
  const tool = getTool('get_active_story')!;
  const result = await tool.handler({}, ctx());
  expect(result).toBeNull();
});

test('get_active_story returns the picked story', async () => {
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  setPicked(tmp, 'STORY-001');
  const tool = getTool('get_active_story')!;
  const result = await tool.handler({}, ctx()) as { data: { id: string } };
  expect(result.data.id).toBe('STORY-001');
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/get.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `/home/fintan/repos/kadai/src/mcp/handlers/get.ts`:

```typescript
import { z } from 'zod';
import { findById } from '../../core/spine';
import { readPicked } from '../../core/picked';
import { registerTool } from '../registry';

export function registerGetTools(): void {
  registerTool({
    name: 'get',
    description: 'Fetch a single item (epic, feature, story, or task) by its ID. Returns null if not found.',
    inputSchema: z.object({
      id: z.string().regex(/^(EPIC|FEAT|STORY|TASK)-\d+$/),
    }),
    handler: async (args, ctx) => {
      return findById(ctx.rootDir, args.id);
    },
  });

  registerTool({
    name: 'get_active_story',
    description: 'Get the currently picked story (the one the agent is actively working on). Returns null if no story is picked.',
    inputSchema: z.object({}),
    handler: async (_args, ctx) => {
      const id = readPicked(ctx.rootDir);
      if (!id) return null;
      return findById(ctx.rootDir, id);
    },
  });
}
```

- [ ] **Step 4: Run the tests (should pass)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/get.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/handlers/get.ts tests/mcp/handlers/get.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "feat(mcp): add get + get_active_story read tools [Plan-2 Task-5]"
```

---

### Task 6: Read tool — `search`

**Files:**
- Create: `/home/fintan/repos/kadai/src/mcp/handlers/search.ts`
- Create: `/home/fintan/repos/kadai/tests/mcp/handlers/search.test.ts`

**Goal:** Full-text search across the spine. Searches title (case-insensitive substring), body (case-insensitive substring), and acceptance_criteria (any element matches).

- [ ] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/mcp/handlers/search.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerSearchTools } from '../../../src/mcp/handlers/search';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerSearchTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-search-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Authentication system', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Billing', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'OAuth login', phase: 'mvp', parent: 'EPIC-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('search matches by title (case-insensitive)', async () => {
  const tool = getTool('search')!;
  const result = await tool.handler({ query: 'AUTH' }, ctx()) as Array<{ data: { id: string } }>;
  const ids = result.map(r => r.data.id);
  expect(ids).toContain('EPIC-001');
});

test('search matches multiple items', async () => {
  const tool = getTool('search')!;
  const result = await tool.handler({ query: 'login' }, ctx()) as Array<{ data: { id: string } }>;
  const ids = result.map(r => r.data.id);
  expect(ids).toContain('FEAT-001');
});

test('search returns empty for no matches', async () => {
  const tool = getTool('search')!;
  const result = await tool.handler({ query: 'nonexistent-term-xyz' }, ctx()) as unknown[];
  expect(result.length).toBe(0);
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/search.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `/home/fintan/repos/kadai/src/mcp/handlers/search.ts`:

```typescript
import { z } from 'zod';
import { walkSpine } from '../../core/spine';
import { registerTool } from '../registry';
import type { Item } from '../../core/types';

function matches(item: Item, q: string): boolean {
  const lq = q.toLowerCase();
  if (item.data.title.toLowerCase().includes(lq)) return true;
  if (item.body.toLowerCase().includes(lq)) return true;
  const ac = (item.data as { acceptance_criteria?: string[] }).acceptance_criteria;
  if (ac && ac.some(c => c.toLowerCase().includes(lq))) return true;
  return false;
}

export function registerSearchTools(): void {
  registerTool({
    name: 'search',
    description: 'Full-text search across the spine. Matches against item title, body content, and acceptance criteria. Case-insensitive substring match.',
    inputSchema: z.object({
      query: z.string().min(1),
    }),
    handler: async (args, ctx) => {
      return walkSpine(ctx.rootDir).filter(item => matches(item, args.query));
    },
  });
}
```

- [ ] **Step 4: Run the tests (should pass)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/search.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/handlers/search.ts tests/mcp/handlers/search.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "feat(mcp): add search read tool [Plan-2 Task-6]"
```

---

### Task 7: Write tools — `create_*` (4 tools, with body support)

**Files:**
- Create: `/home/fintan/repos/kadai/src/mcp/handlers/creates.ts`
- Create: `/home/fintan/repos/kadai/tests/mcp/handlers/creates.test.ts`
- Modify: `/home/fintan/repos/kadai/src/cli/add.ts` (add optional `body` to `AddOptions`)

**Goal:** Four create tools delegating to `runAdd`. To support custom descriptions from MCP callers, extend `AddOptions` with an optional `body` field.

- [ ] **Step 1: Extend `runAdd` to accept body**

Modify `/home/fintan/repos/kadai/src/cli/add.ts`:

Replace the `AddOptions` interface (lines 12-19) with:

```typescript
export interface AddOptions {
  rootDir: string;
  kind: ItemKind;
  title: string;
  phase?: string;
  order?: number;
  parent?: string;
  body?: string;
  acceptance_criteria?: string[];
  plan_step?: number;
}
```

Replace the writeItem call (line 71) with:

```typescript
  if (opts.kind === 'story' && opts.acceptance_criteria) {
    data.acceptance_criteria = opts.acceptance_criteria;
  }
  if (opts.kind === 'task' && typeof opts.plan_step === 'number') {
    data.plan_step = opts.plan_step;
  }

  const ctx = { rootDir: opts.rootDir, parentPath: parentItem ? dirname(parentItem.path) : undefined };
  const body = opts.body ?? '## Description\n\n_Add a description here._\n';
  writeItem(opts.kind, data as unknown as AnyFrontmatter, body, ctx);
  return id;
```

- [ ] **Step 2: Verify existing add tests still pass**

```bash
cd /home/fintan/repos/kadai && bun test tests/cli/add.test.ts
```

Expected: all 6 existing tests pass.

- [ ] **Step 3: Write the failing MCP create tests**

Create `/home/fintan/repos/kadai/tests/mcp/handlers/creates.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerCreateTools } from '../../../src/mcp/handlers/creates';
import { runInit } from '../../../src/cli/init';
import { findById } from '../../../src/core/spine';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerCreateTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-creates-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('create_epic creates an epic and returns its ID', async () => {
  const tool = getTool('create_epic')!;
  const result = await tool.handler({
    title: 'Auth', phase: 'mvp', description: 'Auth system',
  }, ctx()) as { id: string };
  expect(result.id).toBe('EPIC-001');
  expect(findById(tmp, 'EPIC-001')?.data.title).toBe('Auth');
});

test('create_epic stores description in body', async () => {
  const tool = getTool('create_epic')!;
  await tool.handler({
    title: 'Auth', phase: 'mvp', description: 'Custom description text here.',
  }, ctx());
  const item = findById(tmp, 'EPIC-001');
  expect(item?.body).toContain('Custom description text here.');
});

test('create_feature requires parent_epic', async () => {
  const tool = getTool('create_feature')!;
  await expect(tool.handler({
    title: 'F', phase: 'mvp', description: '', parent_epic: 'EPIC-001',
  }, ctx())).rejects.toThrow(/parent not found/i);
});

test('create_story attaches acceptance_criteria', async () => {
  const epicTool = getTool('create_epic')!;
  await epicTool.handler({ title: 'A', phase: 'mvp', description: '' }, ctx());
  const featTool = getTool('create_feature')!;
  await featTool.handler({
    title: 'F', phase: 'mvp', description: '', parent_epic: 'EPIC-001',
  }, ctx());
  const storyTool = getTool('create_story')!;
  await storyTool.handler({
    title: 'S', phase: 'mvp', description: '', parent_feature: 'FEAT-001',
    acceptance_criteria: ['First', 'Second'],
  }, ctx());
  const story = findById(tmp, 'STORY-001');
  expect((story?.data as any).acceptance_criteria).toEqual(['First', 'Second']);
});

test('create_task takes plan_step', async () => {
  const epicTool = getTool('create_epic')!;
  await epicTool.handler({ title: 'A', phase: 'mvp', description: '' }, ctx());
  const featTool = getTool('create_feature')!;
  await featTool.handler({ title: 'F', phase: 'mvp', description: '', parent_epic: 'EPIC-001' }, ctx());
  const storyTool = getTool('create_story')!;
  await storyTool.handler({ title: 'S', phase: 'mvp', description: '', parent_feature: 'FEAT-001' }, ctx());
  const taskTool = getTool('create_task')!;
  await taskTool.handler({
    title: 'T', description: '', parent_story: 'STORY-001', plan_step: 3,
  }, ctx());
  const task = findById(tmp, 'TASK-001');
  expect((task?.data as any).plan_step).toBe(3);
});
```

- [ ] **Step 4: Run the tests (should fail)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/creates.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 5: Implement**

Create `/home/fintan/repos/kadai/src/mcp/handlers/creates.ts`:

```typescript
import { z } from 'zod';
import { runAdd } from '../../cli/add';
import { registerTool } from '../registry';

const titleField = z.string().min(1);
const phaseField = z.string().min(1);
const orderField = z.number().int().min(0).optional();
const descriptionField = z.string().default('');

function bodyFromDescription(desc: string): string {
  if (!desc.trim()) return '## Description\n\n_Add a description here._\n';
  return `## Description\n\n${desc}\n`;
}

export function registerCreateTools(): void {
  registerTool({
    name: 'create_epic',
    description: 'Create a new epic at the top level of the spine. Phase is required (e.g. "mvp"). Returns the new epic\'s ID.',
    inputSchema: z.object({
      title: titleField,
      phase: phaseField,
      order: orderField,
      description: descriptionField,
    }),
    handler: async (args, ctx) => {
      const id = runAdd({
        rootDir: ctx.rootDir,
        kind: 'epic',
        title: args.title,
        phase: args.phase,
        order: args.order,
        body: bodyFromDescription(args.description),
      });
      return { id };
    },
  });

  registerTool({
    name: 'create_feature',
    description: 'Create a new feature under a parent epic. Returns the new feature\'s ID.',
    inputSchema: z.object({
      parent_epic: z.string().regex(/^EPIC-\d+$/),
      title: titleField,
      phase: phaseField,
      order: orderField,
      description: descriptionField,
    }),
    handler: async (args, ctx) => {
      const id = runAdd({
        rootDir: ctx.rootDir,
        kind: 'feature',
        title: args.title,
        phase: args.phase,
        order: args.order,
        parent: args.parent_epic,
        body: bodyFromDescription(args.description),
      });
      return { id };
    },
  });

  registerTool({
    name: 'create_story',
    description: 'Create a new story under a parent feature. acceptance_criteria is an optional list of strings. Returns the new story\'s ID.',
    inputSchema: z.object({
      parent_feature: z.string().regex(/^FEAT-\d+$/),
      title: titleField,
      phase: phaseField,
      order: orderField,
      description: descriptionField,
      acceptance_criteria: z.array(z.string()).optional(),
    }),
    handler: async (args, ctx) => {
      const id = runAdd({
        rootDir: ctx.rootDir,
        kind: 'story',
        title: args.title,
        phase: args.phase,
        order: args.order,
        parent: args.parent_feature,
        body: bodyFromDescription(args.description),
        acceptance_criteria: args.acceptance_criteria,
      });
      return { id };
    },
  });

  registerTool({
    name: 'create_task',
    description: 'Create a new task under a parent story. plan_step is an optional integer referencing a step in the parent story\'s plan.md. Returns the new task\'s ID.',
    inputSchema: z.object({
      parent_story: z.string().regex(/^STORY-\d+$/),
      title: titleField,
      description: descriptionField,
      plan_step: z.number().int().min(1).optional(),
    }),
    handler: async (args, ctx) => {
      const id = runAdd({
        rootDir: ctx.rootDir,
        kind: 'task',
        title: args.title,
        parent: args.parent_story,
        body: bodyFromDescription(args.description),
        plan_step: args.plan_step,
      });
      return { id };
    },
  });
}
```

- [ ] **Step 6: Run the tests (should pass)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/creates.test.ts tests/cli/add.test.ts
```

Expected: 5 MCP tests pass + 6 add tests pass (no regression).

- [ ] **Step 7: Commit**

```bash
git add src/cli/add.ts src/mcp/handlers/creates.ts tests/mcp/handlers/creates.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "feat(mcp): add create_* write tools and runAdd body support [Plan-2 Task-7]"
```

---

### Task 8: Write tools — `set_status` + `set_phase`

**Files:**
- Create: `/home/fintan/repos/kadai/src/mcp/handlers/status.ts`
- Create: `/home/fintan/repos/kadai/tests/mcp/handlers/status.test.ts`

**Goal:** `set_status(id, status, reason?)` validates against the state machine. `set_phase(id, phase, order?)` updates phase + order on epics/features/stories (errors on tasks).

- [ ] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/mcp/handlers/status.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerStatusTools } from '../../../src/mcp/handlers/status';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';
import { findById } from '../../../src/core/spine';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerStatusTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-status-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('set_status moves an item from ready to in_progress', async () => {
  const tool = getTool('set_status')!;
  await tool.handler({ id: 'EPIC-001', status: 'in_progress' }, ctx());
  expect(findById(tmp, 'EPIC-001')?.data.status).toBe('in_progress');
});

test('set_status rejects illegal transitions', async () => {
  const tool = getTool('set_status')!;
  await expect(tool.handler({ id: 'EPIC-001', status: 'done' }, ctx()))
    .rejects.toThrow(/illegal transition/i);
});

test('set_phase updates phase on an epic', async () => {
  const tool = getTool('set_phase')!;
  await tool.handler({ id: 'EPIC-001', phase: 'v1' }, ctx());
  expect((findById(tmp, 'EPIC-001')?.data as any).phase).toBe('v1');
});

test('set_phase updates order when provided', async () => {
  const tool = getTool('set_phase')!;
  await tool.handler({ id: 'EPIC-001', phase: 'mvp', order: 50 }, ctx());
  expect((findById(tmp, 'EPIC-001')?.data as any).order).toBe(50);
});

test('set_phase rejects tasks (tasks inherit phase from story)', async () => {
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
  runAdd({ rootDir: tmp, kind: 'task', title: 'T', parent: 'STORY-001' });
  const tool = getTool('set_phase')!;
  await expect(tool.handler({ id: 'TASK-001', phase: 'v1' }, ctx()))
    .rejects.toThrow(/tasks inherit/i);
});
```

- [ ] **Step 2: Run the tests (should fail)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/status.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `/home/fintan/repos/kadai/src/mcp/handlers/status.ts`:

```typescript
import { z } from 'zod';
import { setStatus } from '../../core/operations';
import { findById } from '../../core/spine';
import { writeFileAtomic } from '../../core/files';
import { serialize } from '../../core/frontmatter';
import { registerTool } from '../registry';

const STATUS_VALUES = [
  'backlog', 'ready', 'in_progress', 'blocked', 'review', 'done', 'cancelled',
] as const;

export function registerStatusTools(): void {
  registerTool({
    name: 'set_status',
    description: 'Update the status of any item. Validates against the state machine; illegal transitions return an error. The optional reason field is recorded for audit but is not written to the item.',
    inputSchema: z.object({
      id: z.string().regex(/^(EPIC|FEAT|STORY|TASK)-\d+$/),
      status: z.enum(STATUS_VALUES),
      reason: z.string().optional(),
    }),
    handler: async (args, ctx) => {
      setStatus(ctx.rootDir, args.id, args.status);
      // reason currently not persisted; reserved for future audit logging
      return { id: args.id, status: args.status };
    },
  });

  registerTool({
    name: 'set_phase',
    description: 'Move an epic, feature, or story to a different phase, optionally setting a new order within that phase. Tasks inherit phase from their story; calling on a task is an error.',
    inputSchema: z.object({
      id: z.string().regex(/^(EPIC|FEAT|STORY|TASK)-\d+$/),
      phase: z.string().min(1),
      order: z.number().int().min(0).optional(),
    }),
    handler: async (args, ctx) => {
      const item = findById(ctx.rootDir, args.id);
      if (!item) throw new Error(`Item not found: ${args.id}`);
      if (item.kind === 'task') {
        throw new Error('Tasks inherit phase from their story; cannot set phase on a task.');
      }
      const updated: Record<string, unknown> = {
        ...item.data,
        phase: args.phase,
        updated: new Date().toISOString().slice(0, 10),
      };
      if (typeof args.order === 'number') updated.order = args.order;
      writeFileAtomic(item.path, serialize(updated, item.body));
      return { id: args.id, phase: args.phase, order: updated.order };
    },
  });
}
```

- [ ] **Step 4: Run the tests (should pass)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/status.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/handlers/status.ts tests/mcp/handlers/status.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "feat(mcp): add set_status and set_phase write tools [Plan-2 Task-8]"
```

---

### Task 9: Write tools — `pick_story` + `unpick`

**Files:**
- Create: `/home/fintan/repos/kadai/src/mcp/handlers/picks.ts`
- Create: `/home/fintan/repos/kadai/tests/mcp/handlers/picks.test.ts`

**Goal:** Two simple wrappers around the picked-state module. `pick_story(id)` only sets the picked flag (does NOT auto-transition to in_progress — agents call `set_status` separately if they want that, mirroring the orthogonal model in spec §4).

- [ ] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/mcp/handlers/picks.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerPickTools } from '../../../src/mcp/handlers/picks';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';
import { readPicked } from '../../../src/core/picked';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerPickTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-picks-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

test('pick_story sets the picked flag', async () => {
  const tool = getTool('pick_story')!;
  await tool.handler({ id: 'STORY-001' }, ctx());
  expect(readPicked(tmp)).toBe('STORY-001');
});

test('pick_story rejects non-stories', async () => {
  const tool = getTool('pick_story')!;
  await expect(tool.handler({ id: 'EPIC-001' }, ctx()))
    .rejects.toThrow(/only stories/i);
});

test('unpick clears the picked flag', async () => {
  const pickTool = getTool('pick_story')!;
  await pickTool.handler({ id: 'STORY-001' }, ctx());
  const unpickTool = getTool('unpick')!;
  await unpickTool.handler({}, ctx());
  expect(readPicked(tmp)).toBeNull();
});
```

- [ ] **Step 2: Run the tests (should fail)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/picks.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `/home/fintan/repos/kadai/src/mcp/handlers/picks.ts`:

```typescript
import { z } from 'zod';
import { setPicked, clearPicked } from '../../core/picked';
import { findById } from '../../core/spine';
import { registerTool } from '../registry';

export function registerPickTools(): void {
  registerTool({
    name: 'pick_story',
    description: 'Set the active story (the one the agent is currently editing code for). Only stories can be picked. Does NOT change the story\'s status — call set_status separately if you also want to mark the story in_progress.',
    inputSchema: z.object({
      id: z.string().regex(/^STORY-\d+$/),
    }),
    handler: async (args, ctx) => {
      const item = findById(ctx.rootDir, args.id);
      if (!item) throw new Error(`Story not found: ${args.id}`);
      setPicked(ctx.rootDir, args.id);
      return { picked: args.id };
    },
  });

  registerTool({
    name: 'unpick',
    description: 'Clear the picked-story flag. Does not change any item\'s status.',
    inputSchema: z.object({}),
    handler: async (_args, ctx) => {
      clearPicked(ctx.rootDir);
      return { picked: null };
    },
  });
}
```

- [ ] **Step 4: Run the tests (should pass)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/picks.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/handlers/picks.ts tests/mcp/handlers/picks.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "feat(mcp): add pick_story and unpick write tools [Plan-2 Task-9]"
```

---

### Task 10: Write tools — `attach_spec` + `attach_plan`

**Files:**
- Create: `/home/fintan/repos/kadai/src/mcp/handlers/attach.ts`
- Create: `/home/fintan/repos/kadai/tests/mcp/handlers/attach.test.ts`

**Goal:** Move a spec file from `docs/superpowers/specs/` into the feature's directory as `spec.md`, and update the feature's frontmatter to reference it. Same for plans → stories.

- [ ] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/mcp/handlers/attach.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { _resetRegistry, getTool } from '../../../src/mcp/registry';
import { registerAttachTools } from '../../../src/mcp/handlers/attach';
import { runInit } from '../../../src/cli/init';
import { runAdd } from '../../../src/cli/add';
import { findById } from '../../../src/core/spine';

let tmp: string;
beforeEach(() => {
  _resetRegistry();
  registerAttachTools();
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-attach-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'A', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'F', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'S', phase: 'mvp', parent: 'FEAT-001' });
});
afterEach(() => { rmSync(tmp, { recursive: true, force: true }); });

const ctx = () => ({ rootDir: tmp });

function writeSpec(relPath: string, content: string): string {
  const abs = join(tmp, relPath);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  return abs;
}

test('attach_spec moves spec into feature dir and updates frontmatter', async () => {
  const sourcePath = writeSpec('docs/superpowers/specs/feature-spec.md', '# Spec\n\nContent here.');
  const tool = getTool('attach_spec')!;
  await tool.handler({ feature_id: 'FEAT-001', source_path: sourcePath }, ctx());

  const feature = findById(tmp, 'FEAT-001');
  const featureDir = dirname(feature!.path);
  expect(existsSync(join(featureDir, 'spec.md'))).toBe(true);
  expect(existsSync(sourcePath)).toBe(false);
  expect((feature?.data as any).spec).toBe('spec.md');
});

test('attach_plan moves plan into story dir and updates frontmatter', async () => {
  const sourcePath = writeSpec('docs/superpowers/plans/story-plan.md', '# Plan\n\nSteps here.');
  const tool = getTool('attach_plan')!;
  await tool.handler({ story_id: 'STORY-001', source_path: sourcePath }, ctx());

  const story = findById(tmp, 'STORY-001');
  const storyDir = dirname(story!.path);
  expect(existsSync(join(storyDir, 'plan.md'))).toBe(true);
  expect(existsSync(sourcePath)).toBe(false);
  expect((story?.data as any).plan).toBe('plan.md');
});

test('attach_spec errors if feature not found', async () => {
  const sourcePath = writeSpec('docs/superpowers/specs/x.md', 'x');
  const tool = getTool('attach_spec')!;
  await expect(tool.handler({ feature_id: 'FEAT-999', source_path: sourcePath }, ctx()))
    .rejects.toThrow(/feature not found/i);
});

test('attach_spec errors if source file missing', async () => {
  const tool = getTool('attach_spec')!;
  await expect(tool.handler({
    feature_id: 'FEAT-001', source_path: join(tmp, 'docs/missing.md'),
  }, ctx())).rejects.toThrow(/source.*not found|no such file/i);
});
```

- [ ] **Step 2: Run the tests (should fail)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/attach.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `/home/fintan/repos/kadai/src/mcp/handlers/attach.ts`:

```typescript
import { existsSync, copyFileSync, unlinkSync } from 'node:fs';
import { dirname, join, isAbsolute, resolve } from 'node:path';
import { z } from 'zod';
import { findById } from '../../core/spine';
import { writeFileAtomic } from '../../core/files';
import { serialize } from '../../core/frontmatter';
import { registerTool } from '../registry';

function resolveSource(rootDir: string, sourcePath: string): string {
  return isAbsolute(sourcePath) ? sourcePath : resolve(rootDir, sourcePath);
}

export function registerAttachTools(): void {
  registerTool({
    name: 'attach_spec',
    description: 'Move a spec markdown file from its current location (typically docs/superpowers/specs/) into the named feature\'s directory as spec.md, and set the feature\'s frontmatter `spec` field to "spec.md". The original source file is removed after the move.',
    inputSchema: z.object({
      feature_id: z.string().regex(/^FEAT-\d+$/),
      source_path: z.string().min(1),
    }),
    handler: async (args, ctx) => {
      const feature = findById(ctx.rootDir, args.feature_id);
      if (!feature || feature.kind !== 'feature') {
        throw new Error(`Feature not found: ${args.feature_id}`);
      }
      const src = resolveSource(ctx.rootDir, args.source_path);
      if (!existsSync(src)) throw new Error(`Source spec not found: ${src}`);

      const featureDir = dirname(feature.path);
      const target = join(featureDir, 'spec.md');
      copyFileSync(src, target);
      unlinkSync(src);

      const updated: Record<string, unknown> = {
        ...feature.data,
        spec: 'spec.md',
        updated: new Date().toISOString().slice(0, 10),
      };
      writeFileAtomic(feature.path, serialize(updated, feature.body));
      return { feature_id: args.feature_id, attached_at: target };
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
      const story = findById(ctx.rootDir, args.story_id);
      if (!story || story.kind !== 'story') {
        throw new Error(`Story not found: ${args.story_id}`);
      }
      const src = resolveSource(ctx.rootDir, args.source_path);
      if (!existsSync(src)) throw new Error(`Source plan not found: ${src}`);

      const storyDir = dirname(story.path);
      const target = join(storyDir, 'plan.md');
      copyFileSync(src, target);
      unlinkSync(src);

      const updated: Record<string, unknown> = {
        ...story.data,
        plan: 'plan.md',
        updated: new Date().toISOString().slice(0, 10),
      };
      writeFileAtomic(story.path, serialize(updated, story.body));
      return { story_id: args.story_id, attached_at: target };
    },
  });
}
```

- [ ] **Step 4: Run the tests (should pass)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/handlers/attach.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/mcp/handlers/attach.ts tests/mcp/handlers/attach.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "feat(mcp): add attach_spec and attach_plan write tools [Plan-2 Task-10]"
```

---

### Task 11: CLI: `kadai mcp` command + register

**Files:**
- Create: `/home/fintan/repos/kadai/src/cli/mcp.ts`
- Modify: `/home/fintan/repos/kadai/src/cli/index.ts`
- Create: `/home/fintan/repos/kadai/tests/cli/mcp.test.ts`

**Goal:** `kadai mcp` subcommand. When invoked, imports all handler modules (triggering registration into the registry) then calls `runServer(process.cwd())`. The dynamic imports keep the registry side effects scoped to the MCP command path.

- [ ] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/cli/mcp.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mcpCommand } from '../../src/cli/mcp';

test('mcpCommand has the expected name and description', () => {
  expect(mcpCommand.name()).toBe('mcp');
  expect(mcpCommand.description()).toContain('MCP');
});
```

- [ ] **Step 2: Run the test (should fail)**

```bash
cd /home/fintan/repos/kadai && bun test tests/cli/mcp.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

Create `/home/fintan/repos/kadai/src/cli/mcp.ts`:

```typescript
import { Command } from 'commander';
import { registerReadTools } from '../mcp/handlers/reads';
import { registerGetTools } from '../mcp/handlers/get';
import { registerSearchTools } from '../mcp/handlers/search';
import { registerCreateTools } from '../mcp/handlers/creates';
import { registerStatusTools } from '../mcp/handlers/status';
import { registerPickTools } from '../mcp/handlers/picks';
import { registerAttachTools } from '../mcp/handlers/attach';
import { runServer } from '../mcp/server';

export const mcpCommand = new Command('mcp')
  .description('Run the kadai MCP stdio server (spawned by Claude Code via .mcp.json)')
  .action(async () => {
    registerReadTools();
    registerGetTools();
    registerSearchTools();
    registerCreateTools();
    registerStatusTools();
    registerPickTools();
    registerAttachTools();
    await runServer(process.cwd());
  });
```

Modify `/home/fintan/repos/kadai/src/cli/index.ts` to register `mcpCommand`:

```typescript
#!/usr/bin/env bun
import { Command } from 'commander';
import { initCommand } from './init';
import { addCommand } from './add';
import { listCommand } from './list';
import { statusCommand } from './status';
import { pickCommand, unpickCommand } from './pick';
import { phasesCommand } from './phases';
import { configCommand } from './config';
import { mcpCommand } from './mcp';

const program = new Command();
program
  .name('kadai')
  .description('Local-first product spine for projects driven by agentic coding')
  .version('0.1.0');

program.addCommand(initCommand);
program.addCommand(addCommand);
program.addCommand(listCommand);
program.addCommand(statusCommand);
program.addCommand(pickCommand);
program.addCommand(unpickCommand);
program.addCommand(phasesCommand);
program.addCommand(configCommand);
program.addCommand(mcpCommand);

program.parseAsync(process.argv);
```

- [ ] **Step 4: Run the test (should pass)**

```bash
cd /home/fintan/repos/kadai && bun test tests/cli/mcp.test.ts
```

Expected: 1 test passes.

- [ ] **Step 5: Verify CLI registers the new command**

```bash
cd /home/fintan/repos/kadai && bun run src/cli/index.ts --help
```

Expected: output lists `mcp` among the commands.

- [ ] **Step 6: Commit**

```bash
git add src/cli/mcp.ts src/cli/index.ts tests/cli/mcp.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "feat(cli): add 'kadai mcp' command [Plan-2 Task-11]"
```

---

### Task 12: `kadai init` extension — write/merge `.mcp.json`

**Files:**
- Modify: `/home/fintan/repos/kadai/src/cli/init.ts`
- Modify: `/home/fintan/repos/kadai/tests/cli/init.test.ts`

**Goal:** Extend `runInit` to merge a `kadai` MCP server entry into the project's `.mcp.json` (creating the file if missing, never overwriting other entries).

- [ ] **Step 1: Add failing tests for `.mcp.json` merge**

Append to `/home/fintan/repos/kadai/tests/cli/init.test.ts`:

```typescript
import { existsSync as _existsSync, readFileSync as _readFileSync, writeFileSync as _writeFileSync } from 'node:fs';

test('init creates .mcp.json with kadai server entry if missing', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const mcpPath = join(tmp, '.mcp.json');
  expect(_existsSync(mcpPath)).toBe(true);
  const json = JSON.parse(_readFileSync(mcpPath, 'utf8'));
  expect(json.mcpServers?.kadai?.command).toBe('kadai');
  expect(json.mcpServers?.kadai?.args).toEqual(['mcp']);
});

test('init merges into existing .mcp.json without overwriting other servers', () => {
  const mcpPath = join(tmp, '.mcp.json');
  _writeFileSync(mcpPath, JSON.stringify({
    mcpServers: { other: { command: 'foo', args: [] } },
  }, null, 2));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const json = JSON.parse(_readFileSync(mcpPath, 'utf8'));
  expect(json.mcpServers.other?.command).toBe('foo');
  expect(json.mcpServers.kadai?.command).toBe('kadai');
});

test('init re-run does not duplicate kadai entry', () => {
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  const mcpPath = join(tmp, '.mcp.json');
  const json = JSON.parse(_readFileSync(mcpPath, 'utf8'));
  expect(Object.keys(json.mcpServers).filter(k => k === 'kadai').length).toBe(1);
});
```

- [ ] **Step 2: Run the tests (should fail)**

```bash
cd /home/fintan/repos/kadai && bun test tests/cli/init.test.ts
```

Expected: 5 existing tests pass, 3 new ones FAIL.

- [ ] **Step 3: Implement the `.mcp.json` merge in init.ts**

In `/home/fintan/repos/kadai/src/cli/init.ts`, add this function near `appendKadaiSectionToClaudeMd`:

```typescript
function mergeKadaiIntoMcpJson(rootDir: string): void {
  const path = join(rootDir, '.mcp.json');
  let parsed: { mcpServers?: Record<string, unknown> } = {};
  if (existsSync(path)) {
    try {
      parsed = JSON.parse(readFileSync(path, 'utf8'));
    } catch {
      // malformed JSON — start fresh rather than blow up
      parsed = {};
    }
  }
  if (!parsed.mcpServers) parsed.mcpServers = {};
  if (!parsed.mcpServers.kadai) {
    parsed.mcpServers.kadai = { command: 'kadai', args: ['mcp'] };
    writeFileAtomic(path, JSON.stringify(parsed, null, 2) + '\n');
  }
}
```

Then call it from `runInit`, immediately after `appendKadaiSectionToClaudeMd(opts.rootDir);`:

```typescript
  appendKadaiSectionToClaudeMd(opts.rootDir);
  mergeKadaiIntoMcpJson(opts.rootDir);
```

- [ ] **Step 4: Run the tests (should pass)**

```bash
cd /home/fintan/repos/kadai && bun test tests/cli/init.test.ts
```

Expected: 8 tests pass total (5 original + 3 new).

- [ ] **Step 5: Smoke-test in a temp dir**

```bash
TMP=$(mktemp -d)
cd "$TMP"
bun run /home/fintan/repos/kadai/src/cli/index.ts init -y
cat .mcp.json
cd / && rm -rf "$TMP"
```

Expected: `.mcp.json` contains `{"mcpServers":{"kadai":{"command":"kadai","args":["mcp"]}}}`.

- [ ] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/init.ts tests/cli/init.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "feat(cli): extend kadai init to merge .mcp.json [Plan-2 Task-12]"
```

---

### Task 13: Integration smoke test (spawn `kadai mcp` + verify wire)

**Files:**
- Create: `/home/fintan/repos/kadai/tests/mcp/integration.test.ts`

**Goal:** Spawn `kadai mcp` as a subprocess, connect via the MCP SDK Client over stdio, list tools, and exercise one round-trip (create_epic + get).

- [ ] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/mcp/integration.test.ts`:

```typescript
import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { runInit } from '../../src/cli/init';

const REPO_ROOT = '/home/fintan/repos/kadai';
const CLI_PATH = join(REPO_ROOT, 'src/cli/index.ts');

let tmp: string;
let client: Client;
let transport: StdioClientTransport;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-mcp-int-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  transport = new StdioClientTransport({
    command: 'bun',
    args: ['run', CLI_PATH, 'mcp'],
    cwd: tmp,
  });
  client = new Client({ name: 'kadai-int-test', version: '0.1.0' }, { capabilities: {} });
  await client.connect(transport);
});

afterAll(async () => {
  await client.close();
  rmSync(tmp, { recursive: true, force: true });
});

test('listTools returns all 18 expected MCP tools', async () => {
  const { tools } = await client.listTools();
  const names = tools.map(t => t.name).sort();
  expect(names).toEqual([
    'attach_plan', 'attach_spec',
    'create_epic', 'create_feature', 'create_story', 'create_task',
    'get', 'get_active_story',
    'list_epics', 'list_features', 'list_phases', 'list_stories', 'list_tasks',
    'pick_story', 'search', 'set_phase', 'set_status', 'unpick',
  ]);
});

test('create_epic + get round-trips through the wire', async () => {
  const created = await client.callTool({
    name: 'create_epic',
    arguments: { title: 'Wire test', phase: 'mvp', description: 'from int test' },
  });
  expect(created.isError).toBeUndefined();
  const epicId = JSON.parse((created.content as any[])[0].text as string).id;
  expect(epicId).toMatch(/^EPIC-\d+$/);

  const got = await client.callTool({
    name: 'get',
    arguments: { id: epicId },
  });
  expect(got.isError).toBeUndefined();
  const item = JSON.parse((got.content as any[])[0].text as string);
  expect(item.data.title).toBe('Wire test');
});

test('illegal status transition returns isError true with message', async () => {
  // Create a story we can attempt an illegal transition on
  const epic = await client.callTool({ name: 'create_epic', arguments: { title: 'E', phase: 'mvp', description: '' } });
  const epicId = JSON.parse((epic.content as any[])[0].text as string).id;
  const feat = await client.callTool({
    name: 'create_feature',
    arguments: { title: 'F', phase: 'mvp', description: '', parent_epic: epicId },
  });
  const featId = JSON.parse((feat.content as any[])[0].text as string).id;
  const story = await client.callTool({
    name: 'create_story',
    arguments: { title: 'S', phase: 'mvp', description: '', parent_feature: featId },
  });
  const storyId = JSON.parse((story.content as any[])[0].text as string).id;

  // ready → done is illegal
  const bad = await client.callTool({ name: 'set_status', arguments: { id: storyId, status: 'done' } });
  expect(bad.isError).toBe(true);
  expect((bad.content as any[])[0].text).toMatch(/illegal/i);
});
```

- [ ] **Step 2: Run the test (should fail before MCP wiring is right; otherwise pass)**

```bash
cd /home/fintan/repos/kadai && bun test tests/mcp/integration.test.ts
```

Expected: PASS (3 tests). If the spawned `kadai mcp` process exits early with an error, check that all handler modules import cleanly. If `client.connect` hangs, the server isn't responding to JSON-RPC handshake — check `runServer` in `src/mcp/server.ts`.

> **Notes:**
> - This test spawns a subprocess. Bun's test runner handles this fine, but the test may take a few seconds (process startup + handshake).
> - The test uses `cwd: tmp` so the spawned `kadai mcp` reads the temp spine (created via `runInit`), not the kadai project itself.
> - If the test times out, increase Bun's test timeout: `bun test --timeout 30000 tests/mcp/integration.test.ts`.

- [ ] **Step 3: Run full test suite**

```bash
cd /home/fintan/repos/kadai && bun test
bun run typecheck
```

Expected: all tests pass; no type errors.

- [ ] **Step 4: Commit**

```bash
cd /home/fintan/repos/kadai
git add tests/mcp/integration.test.ts docs/superpowers/plans/2026-05-05-kadai-02-mcp-server.md
git commit -m "test(mcp): add integration smoke test [Plan-2 Task-13]"
```

---

## Plan 2 self-review checklist

(Run before declaring Plan 2 complete.)

- [ ] All 13 tasks above completed; checkboxes ticked.
- [ ] `bun test` passes (~140+ tests including all new MCP tests).
- [ ] `bun run typecheck` passes.
- [ ] `kadai mcp` spawns successfully and the integration test verifies the wire end-to-end.
- [ ] `kadai init` writes `.mcp.json` with the kadai entry and merges into existing files.
- [ ] [`/CLAUDE.md`](../../../CLAUDE.md) "Active plan" updated to Plan 3.
- [ ] [`README.md`](README.md) status: Plan 2 → `DONE`, Plan 3 → `STUB — write next`.

---

## Proceed to Plan 3

When all checkboxes above are ticked:

1. Update [`README.md`](README.md): Plan 2 → `DONE`, Plan 3 → `STUB — write next`.
2. Update [`/CLAUDE.md`](../../../CLAUDE.md) "Active plan" to: `Plan 3 — Hooks (guardrails)`.
3. Run: `/writing-plans` and reference [`2026-05-05-kadai-03-hooks.md`](2026-05-05-kadai-03-hooks.md). The Plan 3 stub documents exactly what inputs to read from this plan's deliverables (the MCP server handlers, the registry, the new init merge logic).
4. **Do not start Plan 3 implementation work without first running `/writing-plans` against the stub.** The stub is a description, not an executable plan.

If a fresh Claude session is reading this after a compaction:
- Verify each task above by checking the corresponding source files exist and `bun test` passes.
- The first unchecked `- [ ]` task above is your next action.
- The spec at [`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md) §5.1 is the source of truth for the MCP tool surface.
