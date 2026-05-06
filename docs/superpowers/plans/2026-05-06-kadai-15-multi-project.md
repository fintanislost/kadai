# Kadai Plan 15 — Multi-project switcher

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Browse multiple kadai-managed projects from one `kadai serve` instance. Register projects via `kadai serve register`, see them in a picker at `/projects`, navigate any project at `/p/<slug>/epics/...`, etc. Single-project users see zero behavior change (the mode is opt-in, gated by whether `~/.kadai/known-projects.json` has entries).

**Architecture:** A new `core/projects.ts` module owns the JSON registry at `~/.kadai/known-projects.json`. `kadai serve` gains three subcommands (`register`, `list`, `unregister`) for managing it. The server detects mode at startup: if registry has entries → multi-project mode (per-slug `EventBus` + watcher; `/api/projects` and `/api/p/<slug>/...` routes; SPA renders picker at `/projects`); otherwise → unchanged single-project mode. New SPA routes `/p/$slug/...` mirror the existing routes, with a `ProjectContext` exposing the active slug to client API calls.

**Tech Stack:** TypeScript on Bun (existing). React 19 + TanStack Router (existing). No new runtime dependencies. SSE stays as one stream per project (the existing `/api/events` endpoint becomes per-project at `/api/p/<slug>/events` in multi-mode); no advanced cross-project subscription.

## Position in the build

| | |
|---|---|
| **This is plan** | 15 of N — final post-MVP plan |
| **Prior plan** | [Plan 14 — Stretch features](2026-05-06-kadai-14-stretch-features.md) — `DONE` (post-MVP backlog otherwise drained) |
| **Next plan** | None drafted — only one-shot release-publishing user actions remain after this |
| **Index** | [README.md](README.md) |
| **Backlog** | [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md) |

## What ships at the end

- **`~/.kadai/known-projects.json`** — registry file with `{ projects: [{slug, name, rootDir, addedAt}] }`.
- **`kadai serve register [path] [--name <name>] [--slug <slug>]`** — adds a project; defaults: path=cwd, slug=basename(rootDir), name=slug.
- **`kadai serve list`** — prints the registered projects.
- **`kadai serve unregister <slug>`** — removes a project from the registry (does NOT delete its `.kadai/`).
- **Multi-project mode** auto-activates when the registry has ≥1 entry; the server maintains a per-slug `EventBus` + `startWatcher`; routes `/api/projects` (list) and `/api/p/<slug>/<rest>` (forward to that project's data + bus).
- **Single-project mode** (registry empty) is unchanged — current URLs, current behavior, no break.
- **SPA picker at `/projects`** lists all registered projects with last-modified timestamps.
- **Project-scoped routes** `/p/$slug/epics/$id`, `/p/$slug/features/$id`, `/p/$slug/stories/$id`, `/p/$slug/search`, `/p/$slug/activity`, `/p/$slug/compare`, `/p/$slug/` (per-project home).
- **Layout:** in multi-project mode the header shows the active project name + a "← Switch" link back to `/projects`.
- **Force flags** on `kadai serve`: `--single` (force single-project mode regardless of registry), `--project <slug>` (start with a specific project pre-selected, redirects `/` → `/p/<slug>/`).
- ~16 new unit tests + 4 new E2E flows.
- Plugin version 1.0.0 → 1.1.0.
- All ~314 existing tests still pass.

## Out of scope (deferred)

- **Project rename** — `register --slug` is the slug at registration time; renaming would require rewriting bookmarks, broadcasting to live tabs, etc. Defer.
- **Bulk import via `--scan <dir>`** — walk a base dir for `.kadai/` and auto-register found projects. Convenience, not necessity. Defer.
- **Per-project independent ports** — multi-project shares one port; a future feature could spawn per-project servers if isolation becomes important.
- **Cross-project search** — `/api/p/<slug>/search` is per-project; a global search across all registered projects is a future enhancement.
- **Project archiving** — keep registered projects forever (or use `unregister` to remove). No "soft-archive" state.
- **Per-project authentication** — `kadai serve` remains localhost-only with no auth.

## File structure

```
src/core/projects.ts                                # NEW: registry read/write + add/remove helpers
src/cli/serve-projects.ts                          # NEW: register/list/unregister subcommands
src/cli/serve.ts                                    # MODIFIED: --single / --project flags; mount subcommands
src/web/server.ts                                   # MODIFIED: per-slug bus + watcher map; path-prefix routing
src/web/api.ts                                      # MODIFIED: /api/projects + /api/p/<slug>/... dispatch
src/web/frontend/src/api.ts                         # MODIFIED: slug-aware client wrappers
src/web/frontend/src/project.tsx                    # NEW: ProjectContext + useProject() + ProjectModeProvider
src/web/frontend/src/pages/Projects.tsx             # NEW: picker page
src/web/frontend/src/router.tsx                     # MODIFIED: register /projects + /p/$slug/... routes
src/web/frontend/src/components/Layout.tsx          # MODIFIED: switcher link in multi-mode

tests/core/projects.test.ts                        # NEW: ~6 tests for registry
tests/cli/serve-projects.test.ts                   # NEW: ~4 tests for register/list/unregister
tests/web/multi-project-api.test.ts                # NEW: ~6 tests for /api/projects + /api/p/<slug>/...
tests/web/e2e.pw.ts                                 # MODIFIED: + 4 multi-project flows

docs/wiki/cli-reference.md                          # MODIFIED: kadai serve subcommands + flags
docs/wiki/api-reference.md                          # MODIFIED: /api/projects + /api/p/<slug>/...
docs/wiki/web-viewer.md                             # MODIFIED: project picker + multi-mode header
docs/wiki/concepts.md                               # MODIFIED: multi-project mode subsection
docs/wiki/post-mvp.md                               # MODIFIED: Plan 15 → Recently shipped (final entry)
docs/dogfood-acceptance-test.md                     # APPEND: Plan 15 verification
kadai-plugin/.claude-plugin/plugin.json             # MODIFIED: 1.0.0 → 1.1.0
```

## Tasks

---

### Task 1: Project registry (`core/projects.ts`)

**Files:**
- Create: `src/core/projects.ts`
- Create: `tests/core/projects.test.ts`

**Goal:** Pure data layer for the `~/.kadai/known-projects.json` registry. Exports `loadKnownProjects(home?)`, `saveKnownProjects(home, list)`, `registerProject(home, project)` (throws on duplicate slug), `unregisterProject(home, slug)`. The `home` parameter defaults to `os.homedir()` and is overridable for tests.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/core/projects.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  loadKnownProjects,
  saveKnownProjects,
  registerProject,
  unregisterProject,
} from '../../src/core/projects';

let home: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'kadai-proj-home-'));
});
afterEach(() => { rmSync(home, { recursive: true, force: true }); });

test('loadKnownProjects returns empty list when file missing', () => {
  expect(loadKnownProjects(home)).toEqual([]);
});

test('saveKnownProjects writes JSON + creates ~/.kadai if needed', () => {
  saveKnownProjects(home, [{ slug: 'a', name: 'A', rootDir: '/path/a', addedAt: '2026-05-06' }]);
  const text = readFileSync(join(home, '.kadai', 'known-projects.json'), 'utf8');
  expect(JSON.parse(text)).toEqual({
    projects: [{ slug: 'a', name: 'A', rootDir: '/path/a', addedAt: '2026-05-06' }],
  });
});

test('loadKnownProjects round-trips after save', () => {
  saveKnownProjects(home, [{ slug: 'a', name: 'A', rootDir: '/path/a', addedAt: '2026-05-06' }]);
  expect(loadKnownProjects(home)).toEqual([
    { slug: 'a', name: 'A', rootDir: '/path/a', addedAt: '2026-05-06' },
  ]);
});

test('registerProject appends a new entry', () => {
  registerProject(home, { slug: 'a', name: 'Alpha', rootDir: '/path/a' });
  registerProject(home, { slug: 'b', name: 'Beta', rootDir: '/path/b' });
  const list = loadKnownProjects(home);
  expect(list.map(p => p.slug)).toEqual(['a', 'b']);
  expect(list[0].addedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test('registerProject throws on duplicate slug', () => {
  registerProject(home, { slug: 'a', name: 'A', rootDir: '/path/a' });
  expect(() => registerProject(home, { slug: 'a', name: 'A2', rootDir: '/path/a2' }))
    .toThrow(/already registered|duplicate/i);
});

test('unregisterProject removes an entry; throws on unknown slug', () => {
  registerProject(home, { slug: 'a', name: 'A', rootDir: '/path/a' });
  unregisterProject(home, 'a');
  expect(loadKnownProjects(home)).toEqual([]);
  expect(() => unregisterProject(home, 'nonexistent')).toThrow(/not registered|not found/i);
});

test('loadKnownProjects ignores malformed JSON gracefully', () => {
  const fs = require('node:fs') as typeof import('node:fs');
  fs.mkdirSync(join(home, '.kadai'), { recursive: true });
  fs.writeFileSync(join(home, '.kadai', 'known-projects.json'), '{garbage}');
  expect(loadKnownProjects(home)).toEqual([]);
});
```

(I noticed the require pattern at the bottom — replace with `import { mkdirSync, writeFileSync as writeSync } from 'node:fs';` at the top and use those instead. Keep `writeFileSync` as a different alias to avoid collision with the test's existing imports if any.)

Update the imports at the top to include those:

```typescript
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
```

And rewrite the malformed-JSON test:

```typescript
test('loadKnownProjects ignores malformed JSON gracefully', () => {
  mkdirSync(join(home, '.kadai'), { recursive: true });
  writeFileSync(join(home, '.kadai', 'known-projects.json'), '{garbage}');
  expect(loadKnownProjects(home)).toEqual([]);
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/projects.test.ts
```

Expected: FAIL with "Cannot find module ../../src/core/projects".

- [x] **Step 3: Implement core/projects.ts**

Create `/home/fintan/repos/kadai/src/core/projects.ts`:

```typescript
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { writeFileAtomic } from './files';

export interface KnownProject {
  slug: string;
  name: string;
  rootDir: string;
  addedAt: string;  // ISO date (YYYY-MM-DD)
}

export interface KnownProjectsFile {
  projects: KnownProject[];
}

const REGISTRY_FILENAME = 'known-projects.json';

function registryPath(home: string): string {
  return join(home, '.kadai', REGISTRY_FILENAME);
}

export function loadKnownProjects(home: string = homedir()): KnownProject[] {
  const path = registryPath(home);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<KnownProjectsFile>;
    return Array.isArray(parsed.projects) ? parsed.projects : [];
  } catch {
    return [];
  }
}

export function saveKnownProjects(home: string = homedir(), projects: KnownProject[]): void {
  const path = registryPath(home);
  mkdirSync(join(home, '.kadai'), { recursive: true });
  const data: KnownProjectsFile = { projects };
  writeFileAtomic(path, JSON.stringify(data, null, 2) + '\n');
}

export interface RegisterInput {
  slug: string;
  name: string;
  rootDir: string;
}

export function registerProject(home: string, input: RegisterInput): KnownProject {
  const list = loadKnownProjects(home);
  if (list.some(p => p.slug === input.slug)) {
    throw new Error(`Project "${input.slug}" already registered`);
  }
  const entry: KnownProject = {
    slug: input.slug,
    name: input.name,
    rootDir: input.rootDir,
    addedAt: new Date().toISOString().slice(0, 10),
  };
  saveKnownProjects(home, [...list, entry]);
  return entry;
}

export function unregisterProject(home: string, slug: string): void {
  const list = loadKnownProjects(home);
  if (!list.some(p => p.slug === slug)) {
    throw new Error(`Project "${slug}" not registered`);
  }
  saveKnownProjects(home, list.filter(p => p.slug !== slug));
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/projects.test.ts
```

Expected: 7 tests pass.

- [x] **Step 5: Run the full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: 321 pass (314 + 7). Typecheck clean.

- [x] **Step 6: Tick the step checkboxes for Task 1 in the plan**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-15-multi-project.md`, find Task 1 and tick all step checkboxes.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/core/projects.ts tests/core/projects.test.ts docs/superpowers/plans/2026-05-06-kadai-15-multi-project.md
git commit -m "$(cat <<'EOF'
feat(core): project registry at ~/.kadai/known-projects.json [Plan-15 Task-1]

core/projects.ts exports loadKnownProjects / saveKnownProjects /
registerProject / unregisterProject. JSON shape: {projects: [{slug,
name, rootDir, addedAt}]}. The home parameter defaults to os.homedir()
and is overridable for tests.

Foundation for multi-project mode in kadai serve.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: `kadai serve register/list/unregister` subcommands

**Files:**
- Create: `src/cli/serve-projects.ts`
- Modify: `src/cli/serve.ts`
- Create: `tests/cli/serve-projects.test.ts`

**Goal:** Three new subcommands of `kadai serve` for managing the registry. `kadai serve` itself stays a runnable command (not just a parent group); the subcommands are listed as `kadai serve register|list|unregister`.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/cli/serve-projects.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';
import { runRegister, runUnregister, runListProjects } from '../../src/cli/serve-projects';
import { loadKnownProjects } from '../../src/core/projects';

let home: string;
let projectDir: string;
beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), 'kadai-srv-home-'));
  projectDir = mkdtempSync(join(tmpdir(), 'kadai-proj-'));
});
afterEach(() => {
  rmSync(home, { recursive: true, force: true });
  rmSync(projectDir, { recursive: true, force: true });
});

test('runRegister adds a project with auto-derived slug from path basename', () => {
  runRegister({ home, rootDir: projectDir });
  const list = loadKnownProjects(home);
  expect(list).toHaveLength(1);
  expect(list[0].slug).toBe(basename(projectDir));
  expect(list[0].rootDir).toBe(projectDir);
});

test('runRegister with explicit --slug and --name overrides', () => {
  runRegister({ home, rootDir: projectDir, slug: 'my-proj', name: 'My Project' });
  const list = loadKnownProjects(home);
  expect(list[0].slug).toBe('my-proj');
  expect(list[0].name).toBe('My Project');
});

test('runRegister throws on duplicate slug', () => {
  runRegister({ home, rootDir: projectDir, slug: 'a' });
  expect(() => runRegister({ home, rootDir: projectDir, slug: 'a' }))
    .toThrow(/already registered/i);
});

test('runUnregister removes an entry', () => {
  runRegister({ home, rootDir: projectDir, slug: 'a' });
  runUnregister({ home, slug: 'a' });
  expect(loadKnownProjects(home)).toEqual([]);
});

test('runListProjects returns the same shape as loadKnownProjects', () => {
  runRegister({ home, rootDir: projectDir, slug: 'a', name: 'Alpha' });
  expect(runListProjects({ home }).map(p => p.slug)).toEqual(['a']);
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/serve-projects.test.ts
```

Expected: FAIL — `runRegister`/`runUnregister`/`runListProjects` not exported.

- [x] **Step 3: Implement serve-projects.ts**

Create `/home/fintan/repos/kadai/src/cli/serve-projects.ts`:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { homedir } from 'node:os';
import { basename } from 'node:path';
import {
  loadKnownProjects,
  registerProject,
  unregisterProject,
  type KnownProject,
} from '../core/projects';

export interface RegisterOptions {
  home?: string;
  rootDir: string;
  slug?: string;
  name?: string;
}

export function runRegister(opts: RegisterOptions): KnownProject {
  const home = opts.home ?? homedir();
  const slug = opts.slug ?? basename(opts.rootDir);
  const name = opts.name ?? slug;
  return registerProject(home, { slug, name, rootDir: opts.rootDir });
}

export interface UnregisterOptions {
  home?: string;
  slug: string;
}

export function runUnregister(opts: UnregisterOptions): void {
  const home = opts.home ?? homedir();
  unregisterProject(home, opts.slug);
}

export interface ListOptions {
  home?: string;
}

export function runListProjects(opts: ListOptions = {}): KnownProject[] {
  return loadKnownProjects(opts.home ?? homedir());
}

export const registerCommand = new Command('register')
  .description('Register a kadai-managed project for the multi-project web viewer')
  .argument('[path]', 'project root directory (default: cwd)')
  .option('--slug <slug>', 'short URL slug (default: basename of path)')
  .option('--name <name>', 'display name (default: slug)')
  .action((pathArg: string | undefined, opts: { slug?: string; name?: string }) => {
    const rootDir = pathArg ?? process.cwd();
    const entry = runRegister({ rootDir, slug: opts.slug, name: opts.name });
    console.log(pc.green(`✓ registered project "${entry.slug}" → ${entry.rootDir}`));
  });

export const listCommand = new Command('list')
  .description('List registered kadai projects')
  .action(() => {
    const list = runListProjects();
    if (list.length === 0) {
      console.log(pc.dim('No projects registered. Run `kadai serve register [path]` to add one.'));
      return;
    }
    for (const p of list) {
      console.log(`${pc.bold(p.slug.padEnd(20))} ${pc.dim(p.addedAt)}  ${p.name}  ${pc.dim(p.rootDir)}`);
    }
  });

export const unregisterCommand = new Command('unregister')
  .description('Unregister a project (does NOT delete its .kadai/)')
  .argument('<slug>', 'slug to remove')
  .action((slug: string) => {
    runUnregister({ slug });
    console.log(pc.green(`✓ unregistered project "${slug}"`));
  });
```

- [x] **Step 4: Mount the subcommands on serveCommand**

Read `/home/fintan/repos/kadai/src/cli/serve.ts`. Add this import alongside others:

```typescript
import { registerCommand, listCommand, unregisterCommand } from './serve-projects';
```

After the existing `serveCommand = new Command('serve')...` block (which uses `.action(...)`), add the subcommand mounts:

```typescript
serveCommand.addCommand(registerCommand);
serveCommand.addCommand(listCommand);
serveCommand.addCommand(unregisterCommand);
```

NOTE: Commander treats a parent command with both `.action(...)` AND subcommands by treating the action as the default. So `kadai serve` (no args) still runs the server; `kadai serve register foo` runs the register subcommand. Verify in Step 5.

- [x] **Step 5: Run tests + smoke**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/serve-projects.test.ts
bun test
bun run typecheck
kadai serve register --help
kadai serve list --help
kadai serve unregister --help
```

Expected: 5 new tests pass; full suite 326 (321 + 5); typecheck clean; help output shows all three subcommands with their flags.

- [x] **Step 6: Tick the step checkboxes for Task 2 in the plan**

Tick all step checkboxes for Task 2.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/serve.ts src/cli/serve-projects.ts tests/cli/serve-projects.test.ts docs/superpowers/plans/2026-05-06-kadai-15-multi-project.md
git commit -m "$(cat <<'EOF'
feat(cli): kadai serve register/list/unregister subcommands [Plan-15 Task-2]

Three new subcommands of kadai serve for managing ~/.kadai/known-projects.json.
register: add a project (slug defaults to basename(path), name defaults to slug).
list: print registered projects.
unregister: remove (does NOT delete .kadai/).

The default `kadai serve` action (start the server) is unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Multi-project server (per-slug bus + watcher; routing)

**Files:**
- Modify: `src/web/server.ts`
- Modify: `src/web/api.ts`
- Modify: `src/cli/serve.ts` (read registry; pass projects to startServer)
- Create: `tests/web/multi-project-api.test.ts`

**Goal:** When the registry has entries, `kadai serve` starts in multi-project mode. The server holds `Map<slug, {bus, rootDir, stopWatcher}>`. New API routes:
- `GET /api/projects` — returns `[{slug, name, rootDir}]`
- `GET /api/p/<slug>/events` — SSE stream for that project's bus
- `<METHOD> /api/p/<slug>/<rest>` — forwards to the existing `handleApi` with the project's `rootDir` and `bus` (e.g., `/api/p/myproj/items/STORY-001` → `/api/items/STORY-001` on `myproj`'s rootDir)

Single-project mode is unchanged when the registry is empty (or `--single` is passed).

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/web/multi-project-api.test.ts`:

```typescript
import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { startServer, type ServerHandle } from '../../src/web/server';
import { EventBus } from '../../src/web/events';

let projA: string;
let projB: string;
let server: ServerHandle;
let busA: EventBus;
let busB: EventBus;

beforeAll(async () => {
  projA = mkdtempSync(join(tmpdir(), 'kadai-mp-a-'));
  projB = mkdtempSync(join(tmpdir(), 'kadai-mp-b-'));

  runInit({ rootDir: projA, productDescription: 'Alpha', skipFirstEpic: true });
  runAdd({ rootDir: projA, kind: 'epic', title: 'Auth', phase: 'mvp' });

  runInit({ rootDir: projB, productDescription: 'Beta', skipFirstEpic: true });
  runAdd({ rootDir: projB, kind: 'epic', title: 'Billing', phase: 'mvp' });

  busA = new EventBus();
  busB = new EventBus();
  server = await startServer({
    rootDir: projA,  // unused in multi-project mode
    port: 0,
    startWatcher: false,
    projects: [
      { slug: 'alpha', name: 'Alpha', rootDir: projA, eventBus: busA },
      { slug: 'beta', name: 'Beta', rootDir: projB, eventBus: busB },
    ],
  });
});

afterAll(async () => {
  await server.stop();
  rmSync(projA, { recursive: true, force: true });
  rmSync(projB, { recursive: true, force: true });
});

const base = () => `http://localhost:${server.port}`;

test('GET /api/projects lists all registered projects', async () => {
  const r = await fetch(`${base()}/api/projects`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.map((p: { slug: string }) => p.slug).sort()).toEqual(['alpha', 'beta']);
});

test('GET /api/p/alpha/items/EPIC-001 returns alpha\'s epic', async () => {
  const r = await fetch(`${base()}/api/p/alpha/items/EPIC-001`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.data.title).toBe('Auth');
});

test('GET /api/p/beta/items/EPIC-001 returns beta\'s (different) epic', async () => {
  const r = await fetch(`${base()}/api/p/beta/items/EPIC-001`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.data.title).toBe('Billing');
});

test('GET /api/p/<unknown-slug>/items/X returns 404', async () => {
  const r = await fetch(`${base()}/api/p/does-not-exist/items/EPIC-001`);
  expect(r.status).toBe(404);
});

test('GET /api/p/alpha/events returns text/event-stream for alpha\'s bus', async () => {
  const r = await fetch(`${base()}/api/p/alpha/events`);
  expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toMatch(/text\/event-stream/);
  await r.body!.cancel();
});

test('In multi-project mode, the legacy /api/items/X route returns 404', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001`);
  expect(r.status).toBe(404);
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/multi-project-api.test.ts
```

Expected: tests fail — `startServer` doesn't accept `projects` yet; routes don't exist.

- [x] **Step 3: Update server.ts to support multi-project mode**

Read `/home/fintan/repos/kadai/src/web/server.ts`. Update `ServerOptions`:

```typescript
export interface ProjectConfig {
  slug: string;
  name: string;
  rootDir: string;
  eventBus?: EventBus;
}

export interface ServerOptions {
  rootDir: string;             // used in single-project mode
  port: number;
  distDir?: string;
  eventBus?: EventBus;
  startWatcher?: boolean;
  projects?: ProjectConfig[];  // when present + non-empty, multi-project mode
}
```

Replace the single bus/stopWatcher block:

```typescript
  const bus = opts.eventBus ?? new EventBus();
  const stopWatcher = (opts.startWatcher !== false)
    ? startFsWatcher(opts.rootDir, bus)
    : () => {};
```

with mode detection:

```typescript
  const isMulti = !!opts.projects && opts.projects.length > 0;

  // Single-project bus + watcher (used only in single-project mode).
  const singleBus = opts.eventBus ?? new EventBus();
  const stopSingleWatcher = !isMulti && (opts.startWatcher !== false)
    ? startFsWatcher(opts.rootDir, singleBus)
    : () => {};

  // Multi-project map: slug → {bus, rootDir, stopWatcher}.
  interface ProjectRuntime { bus: EventBus; rootDir: string; name: string; stopWatcher: () => void }
  const projectRuntimes = new Map<string, ProjectRuntime>();
  if (isMulti) {
    for (const p of opts.projects!) {
      const bus = p.eventBus ?? new EventBus();
      const stopWatcher = (opts.startWatcher !== false)
        ? startFsWatcher(p.rootDir, bus)
        : () => {};
      projectRuntimes.set(p.slug, { bus, rootDir: p.rootDir, name: p.name, stopWatcher });
    }
  }
```

In the `fetch` handler, replace the API dispatch:

```typescript
      if (path.startsWith('/api/')) {
        return handleApi(req, opts.rootDir, bus);
      }
```

with mode-aware dispatch:

```typescript
      if (path.startsWith('/api/')) {
        if (isMulti) {
          // /api/projects → list all
          if (path === '/api/projects' && req.method === 'GET') {
            return Response.json(
              Array.from(projectRuntimes.entries()).map(([slug, r]) => ({
                slug, name: r.name, rootDir: r.rootDir,
              })),
            );
          }
          // /api/p/<slug>/<rest> → forward
          const m = path.match(/^\/api\/p\/([^/]+)(\/.*)?$/);
          if (m) {
            const [, slug, rest = '/'] = m;
            const runtime = projectRuntimes.get(slug);
            if (!runtime) return new Response('Project not found', { status: 404 });
            // Rewrite the URL for the inner handler: /api/p/<slug>/items/X → /api/items/X
            const inner = new Request(
              `${url.origin}/api${rest === '' ? '/' : rest}`,
              req,
            );
            return handleApi(inner, runtime.rootDir, runtime.bus);
          }
          // Anything else under /api/ in multi-project mode is 404.
          return new Response('Not found', { status: 404 });
        }
        // Single-project mode (unchanged).
        return handleApi(req, opts.rootDir, singleBus);
      }
```

Update the returned `stop`:

```typescript
  return {
    port: server.port!,
    url: `http://localhost:${server.port}`,
    stop: async () => {
      stopSingleWatcher();
      for (const r of projectRuntimes.values()) r.stopWatcher();
      server.stop();
    },
  };
```

(NOTE: the rewriting `new Request(...)` constructor — Bun supports this and copies method/headers/body. The path `/api${rest}` becomes the URL the inner handler sees; since `handleApi` reads `new URL(req.url).pathname`, it'll dispatch correctly.)

- [x] **Step 4: Update src/cli/serve.ts to pass `projects` from the registry**

Read `/home/fintan/repos/kadai/src/cli/serve.ts`. Add these imports alongside the existing ones:

```typescript
import { loadKnownProjects } from '../core/projects';
```

Update the action handler. Currently:

```typescript
  .action(async (opts: { port: number; open: boolean }) => {
    const handle = await startServer({ rootDir: process.cwd(), port: opts.port });
```

Change to:

```typescript
  .option('--single', 'force single-project mode regardless of the registry')
  .option('--project <slug>', 'open the picker pre-selected to a specific project (multi-project mode only)')
  .action(async (opts: { port: number; open: boolean; single?: boolean; project?: string }) => {
    const known = opts.single ? [] : loadKnownProjects();
    const isMulti = known.length > 0;
    const handle = await startServer({
      rootDir: process.cwd(),
      port: opts.port,
      projects: isMulti ? known.map(p => ({ slug: p.slug, name: p.name, rootDir: p.rootDir })) : undefined,
    });
    const modeNote = isMulti ? ` (multi-project: ${known.length} project${known.length === 1 ? '' : 's'})` : '';
    console.log(pc.green(`✓ kadai web viewer running at ${handle.url}${modeNote}`));
    const url = opts.project && isMulti ? `${handle.url}/p/${opts.project}/` : handle.url;
    if (opts.open !== false) openBrowser(url);
    process.on('SIGINT', async () => {
      await handle.stop();
      process.exit(0);
    });
  });
```

- [x] **Step 5: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/multi-project-api.test.ts
bun test
bun run typecheck
```

Expected: 6 new tests pass + 332 total (326 + 6). Typecheck clean. (The existing api.test.ts uses single-project mode — make sure nothing regresses.)

- [x] **Step 6: Tick the step checkboxes for Task 3 in the plan**

Tick all step checkboxes for Task 3.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/server.ts src/web/api.ts src/cli/serve.ts tests/web/multi-project-api.test.ts docs/superpowers/plans/2026-05-06-kadai-15-multi-project.md
git commit -m "$(cat <<'EOF'
feat(web): multi-project server mode [Plan-15 Task-3]

When startServer is called with `projects: ProjectConfig[]`, it maintains
per-slug EventBus + watcher, dispatches /api/projects (list) and
/api/p/<slug>/<rest> (forward to that project's data + bus). Legacy
/api/items/X etc. are 404 in multi-mode.

Single-project mode (no `projects` option) is unchanged.

`kadai serve` reads ~/.kadai/known-projects.json and switches mode based
on whether any projects are registered. New flags: --single (force single
mode), --project <slug> (open browser pre-selected).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: SPA project picker page + ProjectContext

**Files:**
- Create: `src/web/frontend/src/project.tsx` (ProjectModeProvider + useProject)
- Create: `src/web/frontend/src/pages/Projects.tsx` (picker page)
- Modify: `src/web/frontend/src/api.ts` (add `listProjects` + slug-aware base URL helper)
- Modify: `src/web/frontend/src/router.tsx` (register `/projects` route)
- Modify: `src/web/frontend/src/components/Layout.tsx` (multi-mode header — show project name + switcher link)

**Goal:** A `ProjectModeProvider` at the root detects mode by calling `/api/projects` once. If empty → single-project mode (existing routes work). If non-empty → multi-project mode is active, app shows picker at `/`. `useProject()` hook returns the active slug (parsed from URL `/p/<slug>/...`) or `null` for single mode.

- [ ] **Step 1: Create project.tsx**

Create `/home/fintan/repos/kadai/src/web/frontend/src/project.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';

export interface ProjectInfo {
  slug: string;
  name: string;
  rootDir: string;
}

export interface ProjectMode {
  isMulti: boolean;
  projects: ProjectInfo[];
  activeSlug: string | null;  // null in single-project mode
}

const ProjectModeContext = createContext<ProjectMode>({
  isMulti: false,
  projects: [],
  activeSlug: null,
});

export function ProjectModeProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const router = useRouter();
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    fetch('/api/projects')
      .then(r => (r.ok ? r.json() : []))
      .then((list: unknown) => setProjects(Array.isArray(list) ? (list as ProjectInfo[]) : []))
      .catch(() => setProjects([]));
  }, []);

  useEffect(() => {
    const unsub = router.subscribe('onLoad', () => setPathname(window.location.pathname));
    return unsub;
  }, [router]);

  const isMulti = projects.length > 0;
  const m = pathname.match(/^\/p\/([^/]+)(?:\/|$)/);
  const activeSlug = m ? m[1] : null;

  return (
    <ProjectModeContext.Provider value={{ isMulti, projects, activeSlug }}>
      {children}
    </ProjectModeContext.Provider>
  );
}

export function useProjectMode(): ProjectMode {
  return useContext(ProjectModeContext);
}

/**
 * Returns the API base URL for the active project.
 * - single mode: '/api'
 * - multi mode: '/api/p/<slug>'
 *
 * Used by client API wrappers to scope requests.
 */
export function apiBase(activeSlug: string | null): string {
  return activeSlug ? `/api/p/${activeSlug}` : '/api';
}
```

- [ ] **Step 2: Update src/web/frontend/src/api.ts to be slug-aware**

Read `/home/fintan/repos/kadai/src/web/frontend/src/api.ts`. The existing wrappers all hard-code `/api/...`. Refactor each to take an optional slug and prepend `/api/p/<slug>/...` instead.

For brevity, the simplest pattern: add a new helper at the top:

```typescript
function withBase(slug: string | null, path: string): string {
  return slug ? `/api/p/${slug}${path}` : `/api${path}`;
}
```

Then change every `fetch('/api/...')` to `fetch(withBase(slug, '/...'))` and add `slug?: string | null = null` parameter to each function.

(There are ~12 client functions to update. The pattern is mechanical: add the slug param, swap `/api` for `withBase(slug, '...')`. Don't break existing callers — make slug optional with `null` default.)

ALSO add a `listProjects` function:

```typescript
export async function listProjects(): Promise<ProjectInfo[]> {
  const r = await fetch('/api/projects');
  if (!r.ok) return [];
  return r.json() as Promise<ProjectInfo[]>;
}
```

(`ProjectInfo` is exported from `./project`. Add `import type { ProjectInfo } from './project';` at the top.)

- [ ] **Step 3: Create the picker page**

Create `/home/fintan/repos/kadai/src/web/frontend/src/pages/Projects.tsx`:

```tsx
import { Link } from '@tanstack/react-router';
import { useProjectMode } from '../project';

export function Projects() {
  const { projects } = useProjectMode();

  if (projects.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">No projects registered</h1>
        <div className="text-muted text-sm">
          Run <code className="bg-zinc-800 px-1.5 py-0.5 rounded">kadai serve register [path]</code> to add a project.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Projects ({projects.length})</h1>
      <ul className="space-y-2">
        {projects.map(p => (
          <li key={p.slug}>
            <Link
              to={`/p/${p.slug}/`}
              className="block bg-panel border border-zinc-800 rounded p-3 hover:border-zinc-600"
            >
              <div className="font-bold">{p.name}</div>
              <div className="text-xs text-muted mt-1">{p.slug} · {p.rootDir}</div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Wire ProjectModeProvider + Projects route**

Read `/home/fintan/repos/kadai/src/web/frontend/src/router.tsx` and `Layout.tsx`.

In `Layout.tsx`, wrap the existing children with `<ProjectModeProvider>` (alongside or inside `<LiveUpdatesProvider>`). The wrapping order should be: ProjectModeProvider → LiveUpdatesProvider → children. Add the import:

```typescript
import { ProjectModeProvider, useProjectMode } from '../project';
```

In `router.tsx`, register the Projects route:

```typescript
import { Projects } from './pages/Projects';

const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: Projects,
});
```

Add `projectsRoute` to `addChildren([...])`.

- [ ] **Step 5: Update Layout to show project context in multi-mode**

In `Layout.tsx`, inside the header, add a conditional rendering block (alongside the existing Search/Activity/Compare links):

```tsx
{(() => {
  const mode = useProjectMode();
  if (!mode.isMulti) return null;
  if (mode.activeSlug) {
    const active = mode.projects.find(p => p.slug === mode.activeSlug);
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted">Project:</span>
        <span className="font-bold">{active?.name ?? mode.activeSlug}</span>
        <Link to="/projects" className="text-xs text-muted hover:text-zinc-300">← Switch</Link>
      </div>
    );
  }
  return <Link to="/projects" className="text-sm text-muted hover:text-zinc-300">Projects</Link>;
})()}
```

(Yes the IIFE inside JSX is awkward — alternative is to pull this into a small `<ProjectIndicator />` component. Either is fine; do whichever reads better given the existing Layout shape.)

- [ ] **Step 6: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bun run typecheck
bun test
```

Expected: build clean, typecheck clean, 332 tests pass.

- [ ] **Step 7: Tick the step checkboxes for Task 4 in the plan**

Tick all step checkboxes for Task 4.

- [ ] **Step 8: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/project.tsx src/web/frontend/src/api.ts src/web/frontend/src/pages/Projects.tsx src/web/frontend/src/router.tsx src/web/frontend/src/components/Layout.tsx docs/superpowers/plans/2026-05-06-kadai-15-multi-project.md
git commit -m "$(cat <<'EOF'
feat(web/client): project picker page + ProjectContext [Plan-15 Task-4]

Adds ProjectModeProvider that detects single vs multi-project mode by
calling /api/projects on mount. useProjectMode() returns {isMulti,
projects, activeSlug} parsed from the URL.

Client API wrappers now accept an optional slug and prepend
/api/p/<slug>/... when set. New /projects picker route lists registered
projects in multi-mode. Layout shows the active project name + switcher
link in the header when multi-mode is active.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Project-scoped SPA routes (`/p/$slug/...`)

**Files:**
- Modify: `src/web/frontend/src/router.tsx`
- Modify: each page that today uses route params (`Home.tsx`, `Epic.tsx`, `Feature.tsx`, `Story.tsx`, `Search.tsx`, `Activity.tsx`, `Compare.tsx`)

**Goal:** Add a parallel set of routes under `/p/$slug/...` that mirror the existing routes. The page components consume `useParams({from: '/p/$slug/epics/$id'})` (or similar) to extract the slug, then pass it to all client API calls. Existing non-prefixed routes keep working in single-project mode.

This task is mostly mechanical duplication. To keep it tight: each page accepts an optional `slug` (from new route params) and threads it through every API call.

- [ ] **Step 1: Register the project-scoped routes in router.tsx**

Read `/home/fintan/repos/kadai/src/web/frontend/src/router.tsx`. Add this block after the existing routes:

```typescript
const projectHomeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/',
  component: Home,
});

const projectEpicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/epics/$id',
  component: Epic,
});

const projectFeatureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/features/$id',
  component: Feature,
});

const projectStoryRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/stories/$id',
  component: Story,
});

const projectSearchRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/search',
  component: Search,
  validateSearch: (s: Record<string, unknown>): { q?: string } => ({
    q: typeof s.q === 'string' ? s.q : undefined,
  }),
});

const projectActivityRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/activity',
  component: Activity,
});

const projectCompareRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/p/$slug/compare',
  component: Compare,
  validateSearch: (s: Record<string, unknown>): { a?: string; b?: string } => ({
    a: typeof s.a === 'string' ? s.a : undefined,
    b: typeof s.b === 'string' ? s.b : undefined,
  }),
});
```

Add all of them to `addChildren([...])`.

- [ ] **Step 2: Update each page to consume slug + thread it through API calls**

For each of the 7 pages, the change is:

(a) Read the slug from `useProjectMode().activeSlug` (which the provider parses from the URL).
(b) Pass `slug` to every client API call.

Since the client wrappers were updated in Task 4 Step 2 to accept an optional slug, this is a small change per file.

For example, `Home.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { listEpics, listPhases } from '../api';
import { useProjectMode } from '../project';
// ...
export function Home() {
  const { activeSlug } = useProjectMode();
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const [epics, setEpics] = useState<Item[]>([]);
  const liveKey = useLiveKey();

  useEffect(() => {
    listPhases(activeSlug).then(setPhases);
    listEpics({}, activeSlug).then(setEpics);
  }, [liveKey, activeSlug]);
  // ... unchanged JSX
}
```

(The `slug` becomes the second argument by convention. Update the type signatures in `api.ts` Task 4 Step 2 accordingly: `listEpics(filters, slug?)` etc.)

Apply the same pattern to `Epic.tsx`, `Feature.tsx`, `Story.tsx`, `Search.tsx`, `Activity.tsx`, `Compare.tsx`.

ALSO: every `<Link to="/epics/$id" params={{id}}>` in these pages needs to become a project-aware link. Easiest: in single mode use existing routes; in multi mode prefix with `/p/<slug>/`. A small helper:

```tsx
function projectLink(slug: string | null, path: string): string {
  return slug ? `/p/${slug}${path}` : path;
}
```

Place this in `src/web/frontend/src/project.tsx` and export it. Use it everywhere routes are constructed in render code (e.g., `<Link to={projectLink(activeSlug, '/epics/' + d.parent)}>`).

NOTE: TanStack Router's typed `<Link to="..." params={...}>` won't easily accept dynamic strings. For paths that need dynamic project prefix, fall back to:

```tsx
<a href={projectLink(activeSlug, `/epics/${id}`)}>...</a>
```

(Using `<a>` loses client-side navigation. To keep client-side navigation, use `useNavigate({...})` and `navigate({to: projectLink(...)})` — but that requires explicit click handlers. Acceptable tradeoff for Plan 15 — we can refine in a future polish.)

Actually a cleaner approach: TanStack Router supports `to` as a templated path (e.g., `to="/p/$slug/epics/$id" params={{slug, id}}`). Use the project-scoped route's `to` value when in multi-mode:

```tsx
{activeSlug ? (
  <Link to="/p/$slug/epics/$id" params={{ slug: activeSlug, id: d.parent }}>...</Link>
) : (
  <Link to="/epics/$id" params={{ id: d.parent }}>...</Link>
)}
```

That's verbose but typesafe. Apply across all internal links.

- [ ] **Step 3: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bun run typecheck
bun test
```

Expected: build clean, typecheck clean, 332 tests pass.

- [ ] **Step 4: Smoke-test single-project mode (no regression)**

```bash
TMP=$(mktemp -d)
cd "$TMP"
kadai init -y > /dev/null
kadai add feature --title "T" --phase mvp --epic EPIC-001 > /dev/null
kadai serve --no-open --port 4915 &
SERVE_PID=$!
sleep 2
curl -s http://localhost:4915/api/items/EPIC-001 | head -c 100
echo ""
kill $SERVE_PID || true
sleep 1
cd / && rm -rf "$TMP"
```

Expected: returns the EPIC-001 JSON (single-project mode unchanged).

- [ ] **Step 5: Smoke-test multi-project mode**

```bash
PROJ_A=$(mktemp -d -t kadai-mp-a-XXXXXX)
PROJ_B=$(mktemp -d -t kadai-mp-b-XXXXXX)
cd "$PROJ_A" && kadai init -y > /dev/null && kadai add feature --title "AlphaFeat" --phase mvp --epic EPIC-001 > /dev/null
cd "$PROJ_B" && kadai init -y > /dev/null && kadai add feature --title "BetaFeat" --phase mvp --epic EPIC-001 > /dev/null

# Register both via the CLI we just built.
kadai serve register "$PROJ_A" --slug alpha --name "Alpha" || true
kadai serve register "$PROJ_B" --slug beta --name "Beta" || true

# Serve.
cd / && kadai serve --no-open --port 4916 &
SERVE_PID=$!
sleep 2

echo "=== /api/projects ==="
curl -s http://localhost:4916/api/projects

echo ""
echo "=== /api/p/alpha/items/EPIC-001 ==="
curl -s http://localhost:4916/api/p/alpha/items/EPIC-001 | head -c 100

echo ""
echo "=== /api/p/beta/items/EPIC-001 ==="
curl -s http://localhost:4916/api/p/beta/items/EPIC-001 | head -c 100

kill $SERVE_PID || true
sleep 1

# Cleanup the registry entries from this test.
kadai serve unregister alpha || true
kadai serve unregister beta || true
rm -rf "$PROJ_A" "$PROJ_B"
```

Expected: `/api/projects` returns alpha + beta; each `/api/p/<slug>/items/EPIC-001` returns that project's epic.

- [ ] **Step 6: Tick the step checkboxes for Task 5 in the plan**

Tick all step checkboxes for Task 5.

- [ ] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/router.tsx src/web/frontend/src/pages/Home.tsx src/web/frontend/src/pages/Epic.tsx src/web/frontend/src/pages/Feature.tsx src/web/frontend/src/pages/Story.tsx src/web/frontend/src/pages/Search.tsx src/web/frontend/src/pages/Activity.tsx src/web/frontend/src/pages/Compare.tsx src/web/frontend/src/project.tsx docs/superpowers/plans/2026-05-06-kadai-15-multi-project.md
git commit -m "$(cat <<'EOF'
feat(web/client): project-scoped SPA routes /p/$slug/... [Plan-15 Task-5]

Mirrors every existing page route under /p/$slug/. Pages now consume
useProjectMode().activeSlug (parsed from the URL) and thread it through
every client API call so requests target the right project's data.
Internal links use the multi-mode `/p/$slug/...` form when activeSlug is
set, fall back to legacy URLs when not.

Single-project mode (no projects registered) continues to use the legacy
non-prefixed routes — fully backward-compatible.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Playwright E2E + Docs + plugin v1.1.0 + dogfood

**Files:**
- Modify: `tests/web/e2e.pw.ts`
- Modify: `docs/wiki/cli-reference.md`
- Modify: `docs/wiki/api-reference.md`
- Modify: `docs/wiki/web-viewer.md`
- Modify: `docs/wiki/concepts.md`
- Modify: `docs/wiki/post-mvp.md`
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (1.0.0 → 1.1.0)
- Append: `docs/dogfood-acceptance-test.md`
- Modify: `docs/superpowers/plans/2026-05-06-kadai-15-multi-project.md`

- [ ] **Step 1: Add 4 multi-project E2E flows**

The existing E2E setup uses single-project mode. Add a SECOND `describe.serial` (or top-level test group) that spawns a multi-project server. Modify the spawnServer helper to accept a list of project dirs.

Read `/home/fintan/repos/kadai/tests/web/e2e.pw.ts`. Add a new helper that spawns a multi-project server:

```typescript
async function spawnMultiServer(projAroot: string, projBroot: string): Promise<string> {
  const helperScript = join(projAroot, '_multi_helper.ts');
  writeFileSync(helperScript, `
import { runInit } from '${repoRoot}/src/cli/init';
import { runAdd } from '${repoRoot}/src/cli/add';
import { startServer } from '${repoRoot}/src/web/server';
import { resolve } from 'node:path';

const projA = ${JSON.stringify(projAroot)};
const projB = ${JSON.stringify(projBroot)};
const distDir = resolve(${JSON.stringify(repoRoot)}, 'src/web/dist');

runInit({ rootDir: projA, productDescription: 'Alpha', skipFirstEpic: true });
runAdd({ rootDir: projA, kind: 'epic', title: 'Auth', phase: 'mvp' });
runInit({ rootDir: projB, productDescription: 'Beta', skipFirstEpic: true });
runAdd({ rootDir: projB, kind: 'epic', title: 'Billing', phase: 'mvp' });

const handle = await startServer({
  rootDir: projA,
  port: 0,
  distDir,
  projects: [
    { slug: 'alpha', name: 'Alpha', rootDir: projA },
    { slug: 'beta', name: 'Beta', rootDir: projB },
  ],
});
process.stdout.write('READY:' + handle.port + '\\n');
process.stdin.resume();
process.stdin.on('close', async () => { await handle.stop(); process.exit(0); });
`);
  // ... same spawn pattern as existing spawnServer ...
}
```

Append a new test block at the end of the file:

```typescript
test.describe('multi-project', () => {
  let multiTmpA: string;
  let multiTmpB: string;
  let multiServer: ChildProcess;
  let multiUrl: string;

  test.beforeAll(async () => {
    multiTmpA = mkdtempSync(join(tmpdir(), 'kadai-e2e-mp-a-'));
    multiTmpB = mkdtempSync(join(tmpdir(), 'kadai-e2e-mp-b-'));
    multiUrl = await spawnMultiServer(multiTmpA, multiTmpB);
    // capture the spawned process; spawnMultiServer should set a module-scoped reference
    // (or refactor to return both). For brevity, follow the existing serverProcess pattern.
  });

  test.afterAll(async () => {
    if (multiServer) {
      multiServer.stdin?.end();
      await new Promise<void>(res => setTimeout(res, 500));
      if (!multiServer.killed) multiServer.kill();
    }
    rmSync(multiTmpA, { recursive: true, force: true });
    rmSync(multiTmpB, { recursive: true, force: true });
  });

  test('GET /projects renders the picker with both projects', async ({ page }) => {
    await page.goto(`${multiUrl}/projects`);
    await page.waitForLoadState('load');
    await expect(page.locator('h1', { hasText: 'Projects' })).toBeVisible();
    await expect(page.locator('text=Alpha')).toBeVisible();
    await expect(page.locator('text=Beta')).toBeVisible();
  });

  test('clicking a project card lands on /p/<slug>/', async ({ page }) => {
    await page.goto(`${multiUrl}/projects`);
    await page.waitForLoadState('load');
    await page.locator('a', { hasText: 'Alpha' }).click();
    await page.waitForURL(/\/p\/alpha\//);
  });

  test('the project header shows the active project name + switcher link', async ({ page }) => {
    await page.goto(`${multiUrl}/p/alpha/`);
    await page.waitForLoadState('load');
    await expect(page.locator('text=Project:').first()).toBeVisible();
    await expect(page.locator('text=Alpha')).toBeVisible();
    await expect(page.locator('a', { hasText: '← Switch' })).toBeVisible();
  });

  test('alpha and beta show different epics on their respective home pages', async ({ page }) => {
    await page.goto(`${multiUrl}/p/alpha/`);
    await page.waitForLoadState('load');
    await expect(page.locator('text=Auth')).toBeVisible();
    await page.goto(`${multiUrl}/p/beta/`);
    await page.waitForLoadState('load');
    await expect(page.locator('text=Billing')).toBeVisible();
  });
});
```

(Adapt to the existing `spawnServer` patterns. The key constraint: the multi-server spawn helper must store its ChildProcess in a `multiServer` variable that `afterAll` can clean up — same shape as the existing `serverProcess`.)

Run the E2E suite:

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bunx playwright test
```

Expected: 18 pass (14 prior + 4 new). If any flake, bump timeouts and capture a more specific selector.

- [ ] **Step 2: Update cli-reference.md**

In `/home/fintan/repos/kadai/docs/wiki/cli-reference.md`, expand the `kadai serve` section to cover the new flags + subcommands. Replace the existing flag table with:

```markdown
| Flag | Effect |
|---|---|
| `-p, --port <n>` | Port (default: ephemeral) |
| `--no-open` | Don't auto-open the browser |
| `--single` | Force single-project mode (ignore the registry) |
| `--project <slug>` | Open browser pre-selected to a registered project (multi-project mode) |
```

Add a new subcommands section right under it:

```markdown
### `kadai serve register [path]`

Add a project to `~/.kadai/known-projects.json`. Multi-project mode auto-activates when ≥1 project is registered.

| Flag | Effect |
|---|---|
| `--slug <slug>` | URL slug (default: basename of path) |
| `--name <name>` | Display name (default: slug) |

```bash
kadai serve register                       # registers cwd
kadai serve register ~/projects/foo        # registers a specific path
kadai serve register . --slug myproj --name "My Project"
```

### `kadai serve list`

Print the registered projects.

### `kadai serve unregister <slug>`

Remove a project from the registry. Does NOT delete its `.kadai/`.
```

- [ ] **Step 3: Update api-reference.md**

In `/home/fintan/repos/kadai/docs/wiki/api-reference.md`, add a new section near the top explaining multi-project routing:

```markdown
## Multi-project routing

When `kadai serve` runs in multi-project mode (i.e., the registry at `~/.kadai/known-projects.json` has entries), all data routes documented below are prefixed with `/api/p/<slug>` instead of `/api`. The picker route `GET /api/projects` lists all registered projects.

In single-project mode (no registry entries) the routes are at `/api/...` as before.

| Multi-project URL | Single-project URL |
|---|---|
| `GET /api/projects` | (n/a) |
| `GET /api/p/<slug>/events` | `GET /api/events` |
| `GET /api/p/<slug>/items/<id>` | `GET /api/items/<id>` |
| `POST /api/p/<slug>/items/<id>/status` | `POST /api/items/<id>/status` |
| `GET /api/p/<slug>/search?q=` | `GET /api/search?q=` |
| `GET /api/p/<slug>/activity` | `GET /api/activity` |
| `GET /api/p/<slug>/compare?a=&b=` | `GET /api/compare?a=&b=` |

(All other endpoints follow the same prefix rule.)
```

- [ ] **Step 4: Update web-viewer.md**

In `/home/fintan/repos/kadai/docs/wiki/web-viewer.md`, add a section:

```markdown
## Multi-project mode

When you've registered ≥1 project via `kadai serve register`, the viewer auto-switches to multi-project mode. The root URL `/` redirects to `/projects`, which shows a picker of all registered projects. Each project's pages live at `/p/<slug>/...` (e.g., `/p/alpha/epics/EPIC-001`). The header shows the active project name and a "← Switch" link back to the picker.

In single-project mode (no projects registered) the viewer behaves as before — root `/` is the project's home, pages are at `/epics/...`, etc.
```

- [ ] **Step 5: Update concepts.md**

In `/home/fintan/repos/kadai/docs/wiki/concepts.md`, add a subsection near the bottom:

```markdown
### Multi-project mode

`kadai serve` operates in one of two modes, decided at startup based on the `~/.kadai/known-projects.json` registry:

- **Single-project mode** (registry empty or missing): the server uses `process.cwd()` as the only project. URLs are `/epics/...`, `/api/...` — unchanged from earlier kadai versions.
- **Multi-project mode** (registry has ≥1 entry): the server tracks each project independently — separate `EventBus`, separate filesystem watcher, independent SSE channel. URLs are `/p/<slug>/...`, `/api/p/<slug>/...`. The picker at `/projects` lists registered projects.

Switch modes by running `kadai serve register [path]` to enter multi-project mode, or `--single` flag to force single-project mode regardless of registry contents.
```

- [ ] **Step 6: Update post-mvp.md**

In `/home/fintan/repos/kadai/docs/wiki/post-mvp.md`:

(a) Find `### Plan 15 — Multi-project switcher 🟢 **next**` and remove the entire section.

(b) The "Shipping plan (proposed)" section will be EMPTY — that's fine. Add a closing note:

```markdown
## Shipping plan (proposed)

🎉 **All planned post-MVP work is shipped.** Only one-shot release-publishing user actions remain (publish GitHub Releases, submit Homebrew formula PR, npm publish).
```

(c) In the "Recently shipped" section at the bottom, ABOVE `### Plan 14`, insert:

```markdown
### Plan 15 — Multi-project switcher (shipped 2026-05-06)

- `~/.kadai/known-projects.json` registry + `core/projects.ts` helpers
- `kadai serve register [path] [--slug] [--name] / list / unregister <slug>` subcommands
- Multi-project server mode: per-slug `EventBus` + `startWatcher` + path-prefixed routing
- `GET /api/projects` + `/api/p/<slug>/<rest>` API surface
- `/projects` picker page + `/p/$slug/...` SPA routes
- Header shows active project name + "← Switch" link in multi-mode
- Single-project mode unchanged (backward compat — no break)
- 18 new unit tests + 4 new E2E flows (18 total)
- Plugin version bumped to **1.1.0** — kadai post-MVP backlog **fully drained**
```

- [ ] **Step 7: Bump plugin version**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change `"version": "1.0.0"` to `"version": "1.1.0"`.

- [ ] **Step 8: Dogfood verification**

```bash
PROJ_A=$(mktemp -d -t kadai-plan15-a-XXXXXX)
PROJ_B=$(mktemp -d -t kadai-plan15-b-XXXXXX)
cd "$PROJ_A" && kadai init -y > /dev/null && kadai add feature --title "AlphaFeature" --phase mvp --epic EPIC-001 > /dev/null
cd "$PROJ_B" && kadai init -y > /dev/null && kadai add feature --title "BetaFeature" --phase mvp --epic EPIC-001 > /dev/null

echo "=== kadai serve register ==="
kadai serve register "$PROJ_A" --slug alpha --name "Alpha"
kadai serve register "$PROJ_B" --slug beta --name "Beta"

echo ""
echo "=== kadai serve list ==="
kadai serve list

# Make sure embedded SPA is fresh.
( cd /home/fintan/repos/kadai && bun run build:web > /dev/null && bun run embed-assets > /dev/null )

cd / && kadai serve --no-open --port 7915 &
SERVE_PID=$!
sleep 2

echo ""
echo "=== /api/projects ==="
curl -s http://localhost:7915/api/projects

echo ""
echo "=== /api/p/alpha/items/EPIC-001 ==="
curl -s http://localhost:7915/api/p/alpha/items/EPIC-001 | head -c 150

echo ""
echo "=== /api/p/beta/items/EPIC-001 ==="
curl -s http://localhost:7915/api/p/beta/items/EPIC-001 | head -c 150

echo ""
echo "=== legacy /api/items/EPIC-001 (should 404 in multi-mode) ==="
curl -s -o /dev/null -w "HTTP %{http_code}\n" http://localhost:7915/api/items/EPIC-001

kill $SERVE_PID || true
sleep 1

# Cleanup the registry entries (be a good citizen).
kadai serve unregister alpha
kadai serve unregister beta
rm -rf "$PROJ_A" "$PROJ_B"
```

CAPTURE the output. Expected:
- list shows both projects
- /api/projects returns alpha + beta
- per-project queries return the right epic title (AlphaFeature vs BetaFeature parents)
- legacy /api/items in multi-mode returns 404

- [ ] **Step 9: Append a section to docs/dogfood-acceptance-test.md**

APPEND:

```markdown

---

## Multi-project run — Plan 15 verification — 2026-05-06

Verified the multi-project mode end-to-end:

- `kadai serve register $PROJ_A --slug alpha` + `register $PROJ_B --slug beta` → both registered ✅
- `kadai serve list` → printed both ✅
- `GET /api/projects` → returned `[{slug:"alpha",...},{slug:"beta",...}]` ✅
- `GET /api/p/alpha/items/EPIC-001` → returned alpha's epic ✅
- `GET /api/p/beta/items/EPIC-001` → returned beta's epic (different content) ✅
- Legacy `GET /api/items/EPIC-001` → HTTP 404 (multi-mode rejects un-prefixed) ✅
- `bun test` → 332/0 pass ✅
- `bun run build:web && bun run embed-assets` clean ✅
- `bunx playwright test` → 18/18 pass (14 prior + 4 multi-project) ✅

### Verdict: PASS

Plan 15 ships. Plugin bumped to **v1.1.0**. The post-MVP backlog is fully drained — only one-shot release-publishing user actions remain.
```

(Adjust to match actual run output.)

- [ ] **Step 10: Run all the final checks**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
bun run build:web && bun run embed-assets
bunx playwright test
```

Expected: every step exits clean.

- [ ] **Step 11: Tick the Task 6 checkboxes + Plan 15 self-review checklist**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-15-multi-project.md`:
- Tick all step checkboxes for Task 6
- Tick all checkboxes in the "Plan 15 self-review checklist" section

- [ ] **Step 12: Commit**

```bash
cd /home/fintan/repos/kadai
git add tests/web/e2e.pw.ts docs/wiki/cli-reference.md docs/wiki/api-reference.md docs/wiki/web-viewer.md docs/wiki/concepts.md docs/wiki/post-mvp.md docs/dogfood-acceptance-test.md kadai-plugin/.claude-plugin/plugin.json docs/superpowers/plans/2026-05-06-kadai-15-multi-project.md
git commit -m "$(cat <<'EOF'
docs(plan-15): wiki updates + post-mvp shipped + plugin v1.1.0 [Plan-15 Task-6]

- 4 new E2E flows for multi-project (picker, click into project, switcher
  link, alpha/beta show different epics)
- cli-reference.md: kadai serve subcommands + flags
- api-reference.md: multi-project routing section
- web-viewer.md: multi-project mode section
- concepts.md: multi-project mode subsection
- post-mvp.md: Plan 15 → Recently shipped (final entry — backlog drained)
- plugin.json: 1.0.0 → 1.1.0
- dogfood-acceptance-test.md: multi-project spot-check

Post-MVP backlog fully drained. Only one-shot release-publishing user
actions remain.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan 15 self-review checklist

- [ ] All 6 tasks completed; checkboxes ticked.
- [ ] `bun test` passes (~332 tests).
- [ ] `bun run typecheck` passes.
- [ ] `bunx playwright test` passes (18/18).
- [ ] `kadai serve register/list/unregister` work end-to-end (verified in Task 6 dogfood).
- [ ] `/api/projects` returns the registered list.
- [ ] `/api/p/<slug>/items/...` routes per-project.
- [ ] `/projects` picker page renders + click-through works (verified in Task 6 E2E).
- [ ] Single-project mode unchanged (verified in Task 5 Step 4 smoke).
- [ ] Plugin v1.1.0 in the manifest.
- [ ] post-mvp.md: Plan 15 in "Recently shipped"; "Shipping plan" section notes backlog is drained.
- [ ] cli-reference.md, api-reference.md, web-viewer.md, concepts.md updated.

---

## Backlog complete

After this plan, the only remaining items are one-shot user actions:
- Create GitHub Releases for v1.1.0 binaries (uses `bun run build:all` from Plan 12)
- Submit Homebrew formula PR (template at `scripts/Formula/kadai.rb`)
- Publish to npm (registry config in `package.json` from Plan 12)
- Update install URLs in `scripts/install.sh` to point at the published release

These are not engineering tasks — they're release operations. Update CLAUDE.md to reflect "post-1.1.0 ready to publish".
