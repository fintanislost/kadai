# Kadai Plan 4 — Web viewer (read-only)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `kadai serve` launches a localhost web viewer rendering the spine in the roadmap-primary view (per spec §6) with drill-down detail pages for epics, features, and stories.

**Architecture:** Bun HTTP server in `src/web/server.ts` exposes `/api/*` endpoints (read-only delegations to existing core modules) and serves the SPA at all other routes. The SPA is a React app built with Vite + TanStack Router + Tailwind, living in `src/web/frontend/`, building to `src/web/dist/`. Markdown content (`story.md`, `spec.md`, `plan.md`, `changelog.md`) is fetched as text and rendered client-side via `react-markdown`. The CLI subcommand `kadai serve` starts the server and opens the browser.

**Tech Stack:** Bun (HTTP server), Vite + React + TypeScript (SPA), TanStack Router (routing), Tailwind CSS (styling), react-markdown (markdown rendering), Playwright (E2E smoke test). Build pipeline: `vite build` → `src/web/dist/` (frontend), then `bun build --compile` (binary). For Plan 4 MVP, `kadai serve` reads assets from `src/web/dist/` at runtime via `import.meta.dir`-relative paths — embedding into the compiled binary is a post-MVP polish item.

## Position in the build

| | |
|---|---|
| **This is plan** | 4 of 5 |
| **Prior plan** | [Plan 3 — Hooks (guardrails)](2026-05-05-kadai-03-hooks.md) — `DONE` |
| **Next plan** | [Plan 5 — Plugin + dogfood](2026-05-05-kadai-05-plugin-and-dogfood.md) |
| **Index** | [README.md](README.md) |
| **Spec** | [`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md) (read §6) |

## What ships at the end

- `kadai serve [--port N]` launches a Bun HTTP server, opens the browser to the roadmap home
- HTTP API: `/api/phases`, `/api/epics`, `/api/features`, `/api/stories`, `/api/tasks`, `/api/items/:id`, `/api/picked` (all read-only, all delegate to existing core modules)
- React SPA with TanStack Router and routes:
  - `/` — roadmap home (phase swim lanes, ordered epic cards with progress)
  - `/epics/:id` — epic detail (sub-roadmap of features)
  - `/features/:id` — feature detail (kanban of stories + spec preview)
  - `/stories/:id` — story detail (tabs: spec / plan / changelog / tasks)
- Top bar: phase filter chips, active story badge, breadcrumb (back/up navigation)
- Markdown rendering via `react-markdown` for `spec.md` / `plan.md` / `story.md` / `changelog.md` content
- Playwright E2E smoke test: spawn `kadai serve` against a temp-dir spine, verify roadmap renders + drill into story shows tabs
- All ~168 existing tests still pass; no regression

## Out of scope (deferred)

- SSE live updates — post-MVP
- Search across spine (textbox is rendered but no impl) — post-MVP
- Settings page (`/settings` route) — post-MVP
- Interactive mutations from UI (drag-drop kanban, status changers, attach UI) — post-MVP
- Asset embedding into the compiled binary — post-MVP polish (Plan 4 MVP requires `src/web/dist/` to exist beside the binary; covered by `bun run build:web`)
- `/phases/:phase` route (filter is a top-bar chip on the home view instead) — post-MVP

## File structure (created by this plan)

```
src/web/
├── server.ts                         # Bun.serve: routes /api/* to api.ts; falls back to SPA
├── api.ts                            # Read-only API handlers
└── frontend/
    ├── index.html                    # Vite entry
    ├── tsconfig.json                 # Inherits root; adds JSX react config
    ├── vite.config.ts                # Vite + Tailwind; root=this dir; outDir=../dist
    ├── tailwind.config.js
    ├── postcss.config.js
    └── src/
        ├── main.tsx                  # ReactDOM render + Router provider
        ├── router.tsx                # TanStack Router setup with all route definitions
        ├── api.ts                    # Browser fetch helpers
        ├── styles.css                # Tailwind directives
        ├── types.ts                  # Shared types (mirrors src/core/types.ts)
        ├── components/
        │   ├── Layout.tsx            # Top bar + outlet wrapper
        │   ├── EpicCard.tsx
        │   ├── KanbanBoard.tsx
        │   └── Markdown.tsx          # react-markdown wrapper
        └── pages/
            ├── Home.tsx              # Roadmap home (phase swim lanes)
            ├── Epic.tsx
            ├── Feature.tsx
            └── Story.tsx             # Tabs: spec | plan | changelog | tasks

src/cli/serve.ts                      # serveCommand: starts server, opens browser
src/cli/index.ts (modified)           # register serveCommand

tests/web/api.test.ts                 # API endpoint tests (no browser)
tests/web/e2e.test.ts                 # Playwright E2E smoke test

scripts/embed-or-locate-dist.ts       # (small) helper for serve to find dist/
```

## Tasks

---

### Task 1: Install web dependencies + scaffold dirs

**Files:**
- Modify: `/home/fintan/repos/kadai/package.json`
- Modify: `/home/fintan/repos/kadai/.gitignore` (add `src/web/dist/`)
- Create directories: `src/web/`, `src/web/frontend/`, `src/web/frontend/src/components/`, `src/web/frontend/src/pages/`, `tests/web/`

**Goal:** Get all web stack deps installed + directory layout in place.

- [x] **Step 1: Add dependencies**

```bash
cd /home/fintan/repos/kadai
bun add react react-dom @tanstack/react-router react-markdown remark-gfm
bun add -d @types/react @types/react-dom vite @vitejs/plugin-react tailwindcss postcss autoprefixer @playwright/test playwright
```

Expected: `package.json` updated with these deps.

- [x] **Step 2: Create directory structure**

```bash
cd /home/fintan/repos/kadai
mkdir -p src/web/frontend/src/components src/web/frontend/src/pages tests/web
touch src/web/.gitkeep tests/web/.gitkeep
```

- [x] **Step 3: Update .gitignore**

Modify `/home/fintan/repos/kadai/.gitignore` — append:

```
src/web/dist/
src/web/frontend/.vite/
test-results/
playwright-report/
```

- [x] **Step 4: Install Playwright browsers (chromium only — keeps install small)**

```bash
cd /home/fintan/repos/kadai
bunx playwright install --with-deps chromium
```

> If this fails (e.g., on a system without sudo for --with-deps), retry without it: `bunx playwright install chromium`. Document the failure mode in the report if it arises.

- [x] **Step 5: Verify install**

```bash
cd /home/fintan/repos/kadai
bun run typecheck
```

Expected: exit 0.

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add package.json bun.lock src/web tests/web .gitignore docs/superpowers/plans/2026-05-05-kadai-04-web-viewer.md
git commit -m "chore(web): install web stack deps and scaffold src/web/ [Plan-4 Task-1]"
```

## Update Task 1 checkboxes (6 boxes) in plan.

---

### Task 2: Vite + Tailwind config + index.html

**Files:**
- Create: `src/web/frontend/index.html`
- Create: `src/web/frontend/vite.config.ts`
- Create: `src/web/frontend/tailwind.config.js`
- Create: `src/web/frontend/postcss.config.js`
- Create: `src/web/frontend/tsconfig.json`
- Create: `src/web/frontend/src/styles.css`
- Modify: `package.json` — add `build:web` script

- [x] **Step 1: Create `src/web/frontend/index.html`**

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Kadai</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [x] **Step 2: Create `src/web/frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  root: __dirname,
  build: {
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      },
    },
  },
});
```

- [x] **Step 3: Create `src/web/frontend/tailwind.config.js`**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: '#1e1e22',
        panel: '#252528',
        muted: '#9ca3af',
      },
    },
  },
  plugins: [],
};
```

- [x] **Step 4: Create `src/web/frontend/postcss.config.js`**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [x] **Step 5: Create `src/web/frontend/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "useDefineForClassFields": true,
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src", "vite.config.ts"]
}
```

- [x] **Step 6: Create `src/web/frontend/src/styles.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  height: 100%;
  margin: 0;
  background: #1e1e22;
  color: #e4e4e7;
  font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
}
```

- [x] **Step 7: Update `package.json` — add `build:web` script**

In `/home/fintan/repos/kadai/package.json`, add to the `scripts` section:

```json
    "build:web": "vite build --config src/web/frontend/vite.config.ts",
    "dev:web": "vite --config src/web/frontend/vite.config.ts"
```

- [x] **Step 8: Verify typecheck still passes**

```bash
cd /home/fintan/repos/kadai
bun run typecheck
```

Expected: exit 0. (Vite/tailwind configs are JS, not part of the main TS project, but root tsconfig.json includes `src/**/*` which would pick up frontend tsx files. To prevent root typecheck from failing on JSX before main.tsx exists, the root tsconfig already excludes via the frontend/tsconfig.json scoping — but if errors arise, exclude `src/web/frontend/**` from the root tsconfig's `include` and rely on the frontend tsconfig instead.)

- [x] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/index.html src/web/frontend/vite.config.ts src/web/frontend/tailwind.config.js src/web/frontend/postcss.config.js src/web/frontend/tsconfig.json src/web/frontend/src/styles.css package.json docs/superpowers/plans/2026-05-05-kadai-04-web-viewer.md
git commit -m "chore(web): add vite + tailwind config [Plan-4 Task-2]"
```

## Update Task 2 checkboxes (9 boxes) in plan.

---

### Task 3: Frontend scaffold (main.tsx + router + Hello World)

**Files:**
- Create: `src/web/frontend/src/main.tsx`
- Create: `src/web/frontend/src/router.tsx`
- Modify: root `tsconfig.json` to exclude the frontend (so root typecheck doesn't try to compile it under the wrong config)

**Goal:** Build a minimal SPA that renders "Kadai" so we know the frontend pipeline works end-to-end. No real routes yet (those come in later tasks).

- [x] **Step 1: Modify root `/home/fintan/repos/kadai/tsconfig.json`**

Replace the `"include"` line with:

```json
  "include": ["src/**/*", "tests/**/*"],
  "exclude": ["src/web/frontend/**", "src/web/dist/**"]
```

(Add the `exclude` array — the frontend has its own tsconfig and a different module/JSX target.)

- [x] **Step 2: Create `src/web/frontend/src/router.tsx`**

```typescript
import { createRootRoute, createRoute, createRouter, Outlet } from '@tanstack/react-router';

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: () => <div className="p-8 text-2xl">Kadai</div>,
});

const routeTree = rootRoute.addChildren([homeRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

- [x] **Step 3: Create `src/web/frontend/src/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { router } from './router';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
```

- [x] **Step 4: Build the frontend**

```bash
cd /home/fintan/repos/kadai
bun run build:web
ls src/web/dist/
```

Expected: `src/web/dist/index.html` and `src/web/dist/assets/index.js` + `src/web/dist/assets/index.css` exist.

- [x] **Step 5: Verify root typecheck still passes**

```bash
cd /home/fintan/repos/kadai
bun run typecheck
```

Expected: exit 0 (root project doesn't try to compile the frontend).

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add tsconfig.json src/web/frontend/src/main.tsx src/web/frontend/src/router.tsx docs/superpowers/plans/2026-05-05-kadai-04-web-viewer.md
git commit -m "feat(web): add frontend scaffold with TanStack Router [Plan-4 Task-3]"
```

## Update Task 3 checkboxes (6 boxes) in plan.

---

### Task 4: HTTP server + API endpoints

**Files:**
- Create: `src/web/api.ts`
- Create: `src/web/server.ts`
- Create: `tests/web/api.test.ts`

**Goal:** Bun HTTP server with `/api/*` routes that delegate to existing core modules. Read-only. Plus a fallback that serves the SPA assets from `src/web/dist/`.

- [x] **Step 1: Failing test**

Create `/home/fintan/repos/kadai/tests/web/api.test.ts`:

```typescript
import { test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { setPicked } from '../../src/core/picked';
import { startServer, type ServerHandle } from '../../src/web/server';

let tmp: string;
let server: ServerHandle;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-web-api-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email', phase: 'mvp', parent: 'FEAT-001' });
  server = await startServer({ rootDir: tmp, port: 0 }); // 0 = ephemeral port
});

afterAll(async () => {
  await server.stop();
  rmSync(tmp, { recursive: true, force: true });
});

const base = () => `http://localhost:${server.port}`;

test('GET /api/phases returns the configured phases', async () => {
  const r = await fetch(`${base()}/api/phases`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.map((p: any) => p.slug)).toContain('mvp');
});

test('GET /api/epics returns all epics with no filter', async () => {
  const r = await fetch(`${base()}/api/epics`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.length).toBe(1);
  expect(json[0].data.id).toBe('EPIC-001');
});

test('GET /api/features?epic_id=EPIC-001 filters by parent epic', async () => {
  const r = await fetch(`${base()}/api/features?epic_id=EPIC-001`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.length).toBe(1);
});

test('GET /api/items/EPIC-001 returns the item', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-001`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.data.title).toBe('Auth');
});

test('GET /api/items/MISSING returns 404', async () => {
  const r = await fetch(`${base()}/api/items/EPIC-999`);
  expect(r.status).toBe(404);
});

test('GET /api/picked returns null when nothing picked', async () => {
  const r = await fetch(`${base()}/api/picked`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json).toBeNull();
});

test('GET /api/picked returns the picked story', async () => {
  setPicked(tmp, 'STORY-001');
  const r = await fetch(`${base()}/api/picked`);
  const json = await r.json();
  expect(json?.data?.id).toBe('STORY-001');
});
```

- [x] **Step 2:** `bun test tests/web/api.test.ts` — expect FAIL.

- [x] **Step 3: Implement API**

Create `/home/fintan/repos/kadai/src/web/api.ts`:

```typescript
import { walkSpine, findById } from '../core/spine';
import { loadConfig } from '../config/load';
import { readPicked } from '../core/picked';
import type { Item } from '../core/types';
import type { ItemKind, Status } from '../core/state-machine';

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

function readQuery(url: URL, key: string): string | undefined {
  const v = url.searchParams.get(key);
  return v ?? undefined;
}

export async function handleApi(req: Request, rootDir: string): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  if (path === '/api/phases') {
    return Response.json(loadConfig(rootDir).phases);
  }

  if (path === '/api/epics') {
    return Response.json(filterItems(walkSpine(rootDir), 'epic', {
      phase: readQuery(url, 'phase'),
      status: readQuery(url, 'status') as Status | undefined,
    }));
  }

  if (path === '/api/features') {
    return Response.json(filterItems(walkSpine(rootDir), 'feature', {
      phase: readQuery(url, 'phase'),
      status: readQuery(url, 'status') as Status | undefined,
      parent: readQuery(url, 'epic_id'),
    }));
  }

  if (path === '/api/stories') {
    return Response.json(filterItems(walkSpine(rootDir), 'story', {
      phase: readQuery(url, 'phase'),
      status: readQuery(url, 'status') as Status | undefined,
      parent: readQuery(url, 'feature_id'),
    }));
  }

  if (path === '/api/tasks') {
    return Response.json(filterItems(walkSpine(rootDir), 'task', {
      status: readQuery(url, 'status') as Status | undefined,
      parent: readQuery(url, 'story_id'),
    }));
  }

  const itemMatch = path.match(/^\/api\/items\/(.+)$/);
  if (itemMatch) {
    const item = findById(rootDir, itemMatch[1]);
    if (!item) return new Response('Not found', { status: 404 });
    return Response.json(item);
  }

  if (path === '/api/picked') {
    const id = readPicked(rootDir);
    if (!id) return Response.json(null);
    return Response.json(findById(rootDir, id));
  }

  return new Response('Not found', { status: 404 });
}
```

- [x] **Step 4: Implement server**

Create `/home/fintan/repos/kadai/src/web/server.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { handleApi } from './api';

export interface ServerOptions {
  rootDir: string;
  port: number;
  distDir?: string;
}

export interface ServerHandle {
  port: number;
  url: string;
  stop: () => Promise<void>;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

function defaultDistDir(): string {
  // src/web/server.ts → dist at src/web/dist
  return resolve(import.meta.dir, 'dist');
}

function mimeFor(path: string): string {
  const ext = path.match(/\.[^.]+$/)?.[0] ?? '';
  return MIME[ext] ?? 'application/octet-stream';
}

export async function startServer(opts: ServerOptions): Promise<ServerHandle> {
  const distDir = opts.distDir ?? defaultDistDir();
  if (!existsSync(distDir)) {
    throw new Error(
      `Web viewer assets not found at ${distDir}. Run \`bun run build:web\` first.`,
    );
  }
  const indexHtml = readFileSync(join(distDir, 'index.html'), 'utf8');

  const server = Bun.serve({
    port: opts.port,
    async fetch(req) {
      const url = new URL(req.url);
      const path = url.pathname;

      if (path.startsWith('/api/')) {
        return handleApi(req, opts.rootDir);
      }

      // Static asset?
      if (path !== '/' && existsSync(join(distDir, path))) {
        const file = Bun.file(join(distDir, path));
        return new Response(file, { headers: { 'Content-Type': mimeFor(path) } });
      }

      // Otherwise serve index.html (SPA fallback)
      return new Response(indexHtml, { headers: { 'Content-Type': MIME['.html'] } });
    },
  });

  return {
    port: server.port,
    url: `http://localhost:${server.port}`,
    stop: async () => { server.stop(); },
  };
}
```

- [x] **Step 5: Build the frontend (so dist exists for the test)**

```bash
cd /home/fintan/repos/kadai
bun run build:web
```

Expected: `src/web/dist/index.html` exists.

- [x] **Step 6:** `bun test tests/web/api.test.ts` — expect 7 PASS.

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/api.ts src/web/server.ts tests/web/api.test.ts docs/superpowers/plans/2026-05-05-kadai-04-web-viewer.md
git commit -m "feat(web): add HTTP server with read-only API endpoints [Plan-4 Task-4]"
```

## Task 4 checkboxes (7 boxes) COMPLETE.

---

### Task 5: Frontend API client + shared types

**Files:**
- Create: `src/web/frontend/src/types.ts`
- Create: `src/web/frontend/src/api.ts`

**Goal:** Browser-side fetch helpers that call `/api/*`, returning typed results. Types mirror `src/core/types.ts` (duplicated rather than imported because the frontend tsconfig excludes the rest of `src/`).

- [x] **Step 1: Create types**

Create `/home/fintan/repos/kadai/src/web/frontend/src/types.ts`:

```typescript
export type Status = 'backlog' | 'ready' | 'in_progress' | 'blocked' | 'review' | 'done' | 'cancelled';
export type ItemKind = 'epic' | 'feature' | 'story' | 'task';

export interface PhaseConfig {
  slug: string;
  display: string;
  color: string;
}

export interface BaseFrontmatter {
  id: string;
  title: string;
  status: Status;
  created: string;
  updated: string;
}

export interface OrderedFrontmatter extends BaseFrontmatter {
  phase: string;
  order: number;
}

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

export type AnyFrontmatter = OrderedFrontmatter | FeatureFrontmatter | StoryFrontmatter | TaskFrontmatter;

export interface Item<F extends AnyFrontmatter = AnyFrontmatter> {
  kind: ItemKind;
  path: string;
  data: F;
  body: string;
}
```

- [x] **Step 2: Create API client**

Create `/home/fintan/repos/kadai/src/web/frontend/src/api.ts`:

```typescript
import type { Item, PhaseConfig } from './types';

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

export async function listPhases(): Promise<PhaseConfig[]> {
  return get<PhaseConfig[]>('/api/phases');
}

export async function listEpics(filters: { phase?: string; status?: string } = {}): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  return get<Item[]>(`/api/epics${qs ? '?' + qs : ''}`);
}

export async function listFeatures(filters: { epic_id?: string; phase?: string; status?: string } = {}): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  return get<Item[]>(`/api/features${qs ? '?' + qs : ''}`);
}

export async function listStories(filters: { feature_id?: string; phase?: string; status?: string } = {}): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  return get<Item[]>(`/api/stories${qs ? '?' + qs : ''}`);
}

export async function listTasks(filters: { story_id?: string; status?: string } = {}): Promise<Item[]> {
  const qs = new URLSearchParams(filters as Record<string, string>).toString();
  return get<Item[]>(`/api/tasks${qs ? '?' + qs : ''}`);
}

export async function getItem(id: string): Promise<Item | null> {
  const r = await fetch(`/api/items/${id}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`/api/items/${id} → ${r.status}`);
  return r.json() as Promise<Item>;
}

export async function getPicked(): Promise<Item | null> {
  return get<Item | null>('/api/picked');
}
```

> Note: `getFile(id, filename)` for spec/plan/changelog content is added in Task 9 (when the corresponding API endpoint lands).

- [x] **Step 3: Verify frontend builds**

```bash
cd /home/fintan/repos/kadai
bun run build:web
```

Expected: clean build.

- [x] **Step 4: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/types.ts src/web/frontend/src/api.ts docs/superpowers/plans/2026-05-05-kadai-04-web-viewer.md
git commit -m "feat(web): add frontend API client and shared types [Plan-4 Task-5]"
```

## Update Task 5 checkboxes (4 boxes) in plan.

---

### Task 6: Layout + Markdown components

**Files:**
- Create: `src/web/frontend/src/components/Layout.tsx`
- Create: `src/web/frontend/src/components/Markdown.tsx`

- [x] **Step 1: Create Layout**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/Layout.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Link, Outlet } from '@tanstack/react-router';
import { getPicked, listPhases } from '../api';
import type { Item, PhaseConfig } from '../types';

export function Layout() {
  const [picked, setPicked] = useState<Item | null>(null);
  const [phases, setPhases] = useState<PhaseConfig[]>([]);

  useEffect(() => {
    getPicked().then(setPicked).catch(() => setPicked(null));
    listPhases().then(setPhases).catch(() => setPhases([]));
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-panel border-b border-zinc-800 px-6 py-3 flex items-center gap-4">
        <Link to="/" className="font-bold text-lg">Kadai</Link>
        <div className="flex items-center gap-2 text-sm">
          {phases.map(p => (
            <span
              key={p.slug}
              className="px-2 py-0.5 rounded text-xs"
              style={{ background: p.color + '33', color: p.color }}
            >
              {p.display}
            </span>
          ))}
        </div>
        <div className="ml-auto text-sm">
          {picked ? (
            <span className="bg-emerald-900/40 text-emerald-300 px-3 py-1 rounded">
              Picked: {picked.data.id} — {picked.data.title}
            </span>
          ) : (
            <span className="text-muted">No story picked</span>
          )}
        </div>
      </header>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
```

- [x] **Step 2: Create Markdown wrapper**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/Markdown.tsx`:

```typescript
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function Markdown({ children }: { children: string }) {
  return (
    <div className="prose prose-invert max-w-none prose-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown>
    </div>
  );
}
```

> Note: prose styles require @tailwindcss/typography. We're not installing it for MVP — the rendered markdown will use unstyled defaults. Add `@tailwindcss/typography` plugin in a post-MVP polish task if desired.

- [x] **Step 3: Verify build**

```bash
cd /home/fintan/repos/kadai
bun run build:web
```

Expected: clean build (warnings about unused imports OK).

- [x] **Step 4: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/components/Layout.tsx src/web/frontend/src/components/Markdown.tsx docs/superpowers/plans/2026-05-05-kadai-04-web-viewer.md
git commit -m "feat(web): add Layout and Markdown components [Plan-4 Task-6]"
```

## Update Task 6 checkboxes (4 boxes) in plan.

---

### Task 7: Home / Roadmap page

**Files:**
- Create: `src/web/frontend/src/pages/Home.tsx`
- Create: `src/web/frontend/src/components/EpicCard.tsx`
- Modify: `src/web/frontend/src/router.tsx`

**Goal:** Roadmap home — phase swim lanes with epic cards. Click an epic → navigate to `/epics/:id`.

- [x] **Step 1: Create EpicCard**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/EpicCard.tsx`:

```typescript
import { Link } from '@tanstack/react-router';
import type { Item } from '../types';

export function EpicCard({ epic }: { epic: Item }) {
  const d = epic.data as { id: string; title: string; status: string; phase: string };
  return (
    <Link
      to="/epics/$id"
      params={{ id: d.id }}
      className="block bg-panel border border-zinc-700 rounded p-3 hover:border-zinc-500 transition"
    >
      <div className="text-xs text-muted">{d.id}</div>
      <div className="font-medium">{d.title}</div>
      <div className="mt-1 text-xs">
        <span className="bg-zinc-800 px-2 py-0.5 rounded">{d.status}</span>
      </div>
    </Link>
  );
}
```

- [x] **Step 2: Create Home page**

Create `/home/fintan/repos/kadai/src/web/frontend/src/pages/Home.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { listEpics, listPhases } from '../api';
import { EpicCard } from '../components/EpicCard';
import type { Item, PhaseConfig } from '../types';

export function Home() {
  const [phases, setPhases] = useState<PhaseConfig[]>([]);
  const [epics, setEpics] = useState<Item[]>([]);

  useEffect(() => {
    listPhases().then(setPhases);
    listEpics().then(setEpics);
  }, []);

  return (
    <div className="space-y-8">
      {phases.map(phase => {
        const phaseEpics = epics
          .filter(e => (e.data as any).phase === phase.slug)
          .sort((a, b) => ((a.data as any).order ?? 0) - ((b.data as any).order ?? 0));
        return (
          <section key={phase.slug}>
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-3" style={{ color: phase.color }}>
              {phase.display}
            </h2>
            {phaseEpics.length === 0 ? (
              <div className="text-muted text-sm italic">(no epics in this phase)</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {phaseEpics.map(epic => <EpicCard key={(epic.data as any).id} epic={epic} />)}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
```

- [x] **Step 3: Update router with Home + Layout**

Replace `/home/fintan/repos/kadai/src/web/frontend/src/router.tsx`:

```typescript
import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';

const rootRoute = createRootRoute({
  component: Layout,
});

const homeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
});

// Placeholder routes for the not-yet-implemented pages — they fail-safe to a stub.
// Tasks 8/9/10 replace these with real pages.
const epicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/epics/$id',
  component: () => <div>Epic detail (placeholder)</div>,
});

const featureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/features/$id',
  component: () => <div>Feature detail (placeholder)</div>,
});

const storyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stories/$id',
  component: () => <div>Story detail (placeholder)</div>,
});

const routeTree = rootRoute.addChildren([homeRoute, epicRoute, featureRoute, storyRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

- [x] **Step 4: Build**

```bash
cd /home/fintan/repos/kadai && bun run build:web
```

Expected: clean.

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/pages/Home.tsx src/web/frontend/src/components/EpicCard.tsx src/web/frontend/src/router.tsx docs/superpowers/plans/2026-05-05-kadai-04-web-viewer.md
git commit -m "feat(web): add Home roadmap page and router [Plan-4 Task-7]"
```

## Update Task 7 checkboxes (5 boxes) in plan.

---

### Task 8: Epic + Feature detail pages

**Files:**
- Create: `src/web/frontend/src/pages/Epic.tsx`
- Create: `src/web/frontend/src/pages/Feature.tsx`
- Create: `src/web/frontend/src/components/KanbanBoard.tsx`
- Modify: `src/web/frontend/src/router.tsx`

**Goal:** Epic detail shows the epic's metadata + a sub-roadmap of features. Feature detail shows kanban of stories grouped by status + the spec preview (if present).

- [x] **Step 1: Create KanbanBoard component**

Create `/home/fintan/repos/kadai/src/web/frontend/src/components/KanbanBoard.tsx`:

```typescript
import { Link } from '@tanstack/react-router';
import type { Item, Status } from '../types';

const COLUMNS: Status[] = ['backlog', 'ready', 'in_progress', 'blocked', 'review', 'done'];

export function KanbanBoard({ stories }: { stories: Item[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {COLUMNS.map(col => (
        <div key={col} className="bg-panel rounded p-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2">{col}</div>
          <div className="space-y-2">
            {stories.filter(s => s.data.status === col).map(s => {
              const d = s.data as { id: string; title: string };
              return (
                <Link
                  key={d.id}
                  to="/stories/$id"
                  params={{ id: d.id }}
                  className="block bg-zinc-800 rounded p-2 text-xs hover:bg-zinc-700"
                >
                  <div className="text-muted text-[10px]">{d.id}</div>
                  <div>{d.title}</div>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [x] **Step 2: Create Epic page**

Create `/home/fintan/repos/kadai/src/web/frontend/src/pages/Epic.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { getItem, listFeatures } from '../api';
import type { Item } from '../types';

export function Epic() {
  const { id } = useParams({ from: '/epics/$id' });
  const [epic, setEpic] = useState<Item | null>(null);
  const [features, setFeatures] = useState<Item[]>([]);

  useEffect(() => {
    getItem(id).then(setEpic);
    listFeatures({ epic_id: id }).then(setFeatures);
  }, [id]);

  if (!epic) return <div className="text-muted">Loading or not found…</div>;
  const d = epic.data as { id: string; title: string; phase: string; status: string };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/" className="text-xs text-muted hover:text-zinc-300">← back to roadmap</Link>
        <div className="mt-2 text-xs text-muted">{d.id} · phase {d.phase} · {d.status}</div>
        <h1 className="text-2xl font-bold">{d.title}</h1>
      </div>

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-3">Features</h2>
        {features.length === 0 ? (
          <div className="text-muted text-sm italic">(no features yet)</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {features.sort((a, b) => ((a.data as any).order ?? 0) - ((b.data as any).order ?? 0)).map(f => {
              const fd = f.data as { id: string; title: string; status: string };
              return (
                <Link
                  key={fd.id}
                  to="/features/$id"
                  params={{ id: fd.id }}
                  className="block bg-panel border border-zinc-700 rounded p-3 hover:border-zinc-500"
                >
                  <div className="text-xs text-muted">{fd.id}</div>
                  <div className="font-medium">{fd.title}</div>
                  <div className="mt-1 text-xs"><span className="bg-zinc-800 px-2 py-0.5 rounded">{fd.status}</span></div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [x] **Step 3: Create Feature page**

Create `/home/fintan/repos/kadai/src/web/frontend/src/pages/Feature.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { getItem, listStories } from '../api';
import { KanbanBoard } from '../components/KanbanBoard';
import { Markdown } from '../components/Markdown';
import type { Item } from '../types';

export function Feature() {
  const { id } = useParams({ from: '/features/$id' });
  const [feature, setFeature] = useState<Item | null>(null);
  const [stories, setStories] = useState<Item[]>([]);

  useEffect(() => {
    getItem(id).then(setFeature);
    listStories({ feature_id: id }).then(setStories);
  }, [id]);

  if (!feature) return <div className="text-muted">Loading or not found…</div>;
  const d = feature.data as { id: string; title: string; phase: string; status: string; parent: string };

  return (
    <div className="space-y-6">
      <div>
        <Link to="/epics/$id" params={{ id: d.parent }} className="text-xs text-muted hover:text-zinc-300">← back to {d.parent}</Link>
        <div className="mt-2 text-xs text-muted">{d.id} · phase {d.phase} · {d.status}</div>
        <h1 className="text-2xl font-bold">{d.title}</h1>
      </div>

      {feature.body && (
        <div className="bg-panel rounded p-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-2">Description</h2>
          <Markdown>{feature.body}</Markdown>
        </div>
      )}

      <div>
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted mb-3">Stories</h2>
        <KanbanBoard stories={stories} />
      </div>
    </div>
  );
}
```

- [x] **Step 4: Register the new pages in router**

In `/home/fintan/repos/kadai/src/web/frontend/src/router.tsx`, replace the placeholder `epicRoute` and `featureRoute` definitions with:

```typescript
import { Epic } from './pages/Epic';
import { Feature } from './pages/Feature';

// (existing imports stay)

const epicRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/epics/$id',
  component: Epic,
});

const featureRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/features/$id',
  component: Feature,
});
```

(Keep `storyRoute` as the placeholder; Task 9 handles it.)

- [x] **Step 5: Build**

```bash
cd /home/fintan/repos/kadai && bun run build:web
```

Expected: clean.

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/pages/Epic.tsx src/web/frontend/src/pages/Feature.tsx src/web/frontend/src/components/KanbanBoard.tsx src/web/frontend/src/router.tsx docs/superpowers/plans/2026-05-05-kadai-04-web-viewer.md
git commit -m "feat(web): add Epic and Feature detail pages [Plan-4 Task-8]"
```

## Update Task 8 checkboxes (6 boxes) — COMPLETE.

---

### Task 9: Story detail page (with tabs)

**Files:**
- Create: `src/web/frontend/src/pages/Story.tsx`
- Modify: `src/web/frontend/src/router.tsx`

**Goal:** Story detail with tabs — story body, spec, plan, changelog, tasks. For MVP, the spec/plan/changelog content is fetched as text directly from the spine via a new `/api/files/:id/:filename` endpoint (added in this task) since they're separate files.

> **Note:** Plan 4 MVP intentionally keeps this simple — the API endpoint added here just streams the file contents from disk if the story has the corresponding `spec` / `plan` field set, or 404s.

- [x] **Step 1: Add `/api/files/:id/:filename` endpoint**

In `/home/fintan/repos/kadai/src/web/api.ts`, add a new branch before the `/api/picked` branch:

```typescript
  const fileMatch = path.match(/^\/api\/files\/([A-Z]+-\d+)\/([a-z.]+)$/);
  if (fileMatch) {
    const [, id, filename] = fileMatch;
    if (!['spec.md', 'plan.md', 'changelog.md'].includes(filename)) {
      return new Response('Forbidden', { status: 403 });
    }
    const item = findById(rootDir, id);
    if (!item) return new Response('Not found', { status: 404 });
    const itemDir = require('node:path').dirname(item.path);
    const filePath = require('node:path').join(itemDir, filename);
    if (!require('node:fs').existsSync(filePath)) return new Response('Not found', { status: 404 });
    const content = require('node:fs').readFileSync(filePath, 'utf8');
    return new Response(content, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
```

> Replace the `require('node:path')` calls with proper `import` statements at the top of the file:
> ```typescript
> import { dirname, join } from 'node:path';
> import { existsSync, readFileSync } from 'node:fs';
> ```
> And replace the inline calls accordingly.

- [x] **Step 2: Add API client function**

In `/home/fintan/repos/kadai/src/web/frontend/src/api.ts`, add at the end:

```typescript
export async function getFile(id: string, filename: 'spec.md' | 'plan.md' | 'changelog.md'): Promise<string | null> {
  const r = await fetch(`/api/files/${id}/${filename}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`/api/files/${id}/${filename} → ${r.status}`);
  return r.text();
}
```

- [x] **Step 3: Create Story page**

Create `/home/fintan/repos/kadai/src/web/frontend/src/pages/Story.tsx`:

```typescript
import { useEffect, useState } from 'react';
import { Link, useParams } from '@tanstack/react-router';
import { getItem, getFile, listTasks } from '../api';
import { Markdown } from '../components/Markdown';
import type { Item } from '../types';

type TabName = 'story' | 'spec' | 'plan' | 'changelog' | 'tasks';

export function Story() {
  const { id } = useParams({ from: '/stories/$id' });
  const [story, setStory] = useState<Item | null>(null);
  const [tasks, setTasks] = useState<Item[]>([]);
  const [spec, setSpec] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [changelog, setChangelog] = useState<string | null>(null);
  const [tab, setTab] = useState<TabName>('story');

  useEffect(() => {
    getItem(id).then(setStory);
    listTasks({ story_id: id }).then(setTasks);
    getFile(id, 'spec.md').then(setSpec);
    getFile(id, 'plan.md').then(setPlan);
    getFile(id, 'changelog.md').then(setChangelog);
  }, [id]);

  if (!story) return <div className="text-muted">Loading or not found…</div>;
  const d = story.data as {
    id: string;
    title: string;
    phase: string;
    status: string;
    parent: string;
    acceptance_criteria?: string[];
  };

  const tabs: TabName[] = ['story', 'spec', 'plan', 'changelog', 'tasks'];

  return (
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
  );
}
```

- [x] **Step 4: Register Story page in router**

In `/home/fintan/repos/kadai/src/web/frontend/src/router.tsx`, replace the placeholder `storyRoute` with:

```typescript
import { Story } from './pages/Story';

// (existing imports stay; add Story to your imports)

const storyRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/stories/$id',
  component: Story,
});
```

- [x] **Step 5: Build + run API tests (regression)**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun test tests/web/api.test.ts
```

Expected: build clean; all 7 API tests still pass.

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/api.ts src/web/frontend/src/pages/Story.tsx src/web/frontend/src/api.ts src/web/frontend/src/router.tsx docs/superpowers/plans/2026-05-05-kadai-04-web-viewer.md
git commit -m "feat(web): add Story detail page with tabs + /api/files endpoint [Plan-4 Task-9]"
```

## Update Task 9 checkboxes (6 boxes) in plan.

---

### Task 10: CLI: `kadai serve` command

**Files:**
- Create: `src/cli/serve.ts`
- Modify: `src/cli/index.ts`
- Test: `tests/cli/serve.test.ts`

**Goal:** `kadai serve [--port N] [--no-open]` starts the server, optionally opens the browser.

- [x] **Step 1: Failing test**

Create `/home/fintan/repos/kadai/tests/cli/serve.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { serveCommand } from '../../src/cli/serve';

test('serveCommand has expected name and options', () => {
  expect(serveCommand.name()).toBe('serve');
  const optionFlags = serveCommand.options.map(o => o.long);
  expect(optionFlags).toContain('--port');
  expect(optionFlags).toContain('--no-open');
});
```

- [x] **Step 2:** `bun test tests/cli/serve.test.ts` — expect FAIL.

- [x] **Step 3: Implement**

Create `/home/fintan/repos/kadai/src/cli/serve.ts`:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { spawn } from 'node:child_process';
import { startServer } from '../web/server';

function openBrowser(url: string): void {
  const opener =
    process.platform === 'darwin' ? 'open' :
    process.platform === 'win32' ? 'start' :
    'xdg-open';
  const child = spawn(opener, [url], { detached: true, stdio: 'ignore' });
  child.unref();
}

export const serveCommand = new Command('serve')
  .description('Start the kadai web viewer at localhost')
  .option('-p, --port <n>', 'port (default: 0 = ephemeral)', (v) => parseInt(v, 10), 0)
  .option('--no-open', 'do not open the browser automatically')
  .action(async (opts: { port: number; open: boolean }) => {
    const handle = await startServer({ rootDir: process.cwd(), port: opts.port });
    console.log(pc.green(`✓ kadai web viewer running at ${handle.url}`));
    if (opts.open !== false) openBrowser(handle.url);
    // Keep the process alive
    process.on('SIGINT', async () => {
      await handle.stop();
      process.exit(0);
    });
  });
```

Modify `/home/fintan/repos/kadai/src/cli/index.ts` — register `serveCommand`:

```typescript
import { serveCommand } from './serve';
// (existing imports stay)
program.addCommand(serveCommand);
```

- [x] **Step 4:** `bun test tests/cli/serve.test.ts` — expect 1 PASS.

- [x] **Step 5: Verify CLI**

```bash
cd /home/fintan/repos/kadai && bun run src/cli/index.ts --help | grep serve
```

Expected: `serve` command is listed.

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/serve.ts src/cli/index.ts tests/cli/serve.test.ts docs/superpowers/plans/2026-05-05-kadai-04-web-viewer.md
git commit -m "feat(cli): add 'kadai serve' command [Plan-4 Task-10]"
```

## Update Task 10 checkboxes (6 boxes) — COMPLETE.

---

### Task 11: Playwright E2E smoke test

**Files:**
- Create: `playwright.config.ts`
- Create: `tests/web/e2e.spec.ts`

**Goal:** Spawn `kadai serve` against a temp-dir spine, navigate via Playwright, verify the roadmap renders and drilling into a story shows tabs.

> **Note on test runner:** Playwright tests use `@playwright/test` not `bun:test`. They run via `bunx playwright test`, separately from `bun test`. The Playwright config sets up `webServer` to spawn kadai serve.

- [x] **Step 1: Create playwright.config.ts**

Create `/home/fintan/repos/kadai/playwright.config.ts`:

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/web',
  testMatch: /e2e\.spec\.ts/,
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  use: {
    headless: true,
    actionTimeout: 5000,
    navigationTimeout: 10000,
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
});
```

- [x] **Step 2: Create the E2E test**

Create `/home/fintan/repos/kadai/tests/web/e2e.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { startServer, type ServerHandle } from '../../src/web/server';

let tmp: string;
let server: ServerHandle;

test.beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-e2e-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Authentication', phase: 'mvp' });
  runAdd({ rootDir: tmp, kind: 'feature', title: 'Login', phase: 'mvp', parent: 'EPIC-001' });
  runAdd({ rootDir: tmp, kind: 'story', title: 'Email login', phase: 'mvp', parent: 'FEAT-001' });
  server = await startServer({ rootDir: tmp, port: 0 });
});

test.afterAll(async () => {
  await server.stop();
  rmSync(tmp, { recursive: true, force: true });
});

test('roadmap home renders the seeded epic', async ({ page }) => {
  await page.goto(server.url);
  await expect(page.locator('text=Authentication')).toBeVisible();
});

test('drilling into an epic shows its features', async ({ page }) => {
  await page.goto(server.url);
  await page.locator('text=Authentication').click();
  await expect(page.locator('text=Login')).toBeVisible();
});

test('drilling into a story shows the tabs', async ({ page }) => {
  await page.goto(`${server.url}/stories/STORY-001`);
  await expect(page.locator('text=Email login')).toBeVisible();
  await expect(page.locator('button', { hasText: 'spec' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'plan' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'changelog' })).toBeVisible();
  await expect(page.locator('button', { hasText: 'tasks' })).toBeVisible();
});
```

- [x] **Step 3: Make sure web build is fresh, then run E2E**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bunx playwright test
```

Expected: 3 tests pass.

> **If tests fail with "browser not found":** run `bunx playwright install chromium` first.
> **If tests fail with timing issues** (text not visible quickly enough): Tailwind class transitions are minimal here, so timeouts are unlikely; check that the API endpoints respond by visiting `http://localhost:<port>/api/epics` manually.
> **If tests fail because the server isn't ready:** add a `await page.waitForLoadState('networkidle')` after `page.goto`.

- [x] **Step 4: Run full test suite (regression check)**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: all `bun test` pass; typecheck clean. Playwright tests run separately via `bunx playwright test`.

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add playwright.config.ts tests/web/e2e.spec.ts docs/superpowers/plans/2026-05-05-kadai-04-web-viewer.md
git commit -m "test(web): add Playwright E2E smoke test [Plan-4 Task-11]"
```

## Update Task 11 checkboxes (5 boxes) in plan.

---

## Plan 4 self-review checklist

(Run before declaring Plan 4 complete.)

- [ ] All 11 tasks above completed; checkboxes ticked.
- [ ] `bun test` passes (~175+ tests including new API tests).
- [ ] `bun run typecheck` passes (root project).
- [ ] `bun run build:web` produces clean Vite output in `src/web/dist/`.
- [ ] `bunx playwright test` passes (3 E2E tests).
- [ ] `kadai serve` starts the server (manual smoke: `bun run src/cli/index.ts serve` from a temp dir with kadai initialized).
- [ ] **The kadai project repo itself is NOT installed against** — `.kadai/`, `.claude/settings.json` (with kadai entries), and `.mcp.json` should not exist in this repo. (Per the corrected dogfood model.)
- [ ] [`/CLAUDE.md`](../../../CLAUDE.md) "Active plan" updated to Plan 5.
- [ ] [`README.md`](README.md) status: Plan 4 → `DONE`, Plan 5 → `STUB — write next`.

---

## Proceed to Plan 5

When all checkboxes above are ticked:

1. Update [`README.md`](README.md): Plan 4 → `DONE`, Plan 5 → `STUB — write next`.
2. Update [`/CLAUDE.md`](../../../CLAUDE.md) "Active plan" to: `Plan 5 — Plugin + dogfood`.
3. Run: `/writing-plans` and reference [`2026-05-05-kadai-05-plugin-and-dogfood.md`](2026-05-05-kadai-05-plugin-and-dogfood.md). The Plan 5 stub already documents the formal subagent acceptance test (in a temp dir) plus the optional final wrap that installs kadai against the kadai repo.
4. **Do not start Plan 5 implementation work without first running `/writing-plans` against the stub.**

If a fresh Claude session is reading this after a compaction:
- Verify each task above by checking the corresponding source files exist and `bun test` + `bunx playwright test` pass.
- The first unchecked `- [ ]` task above is your next action.
- The spec at [`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md) §6 is the source of truth for the web viewer.
- **Do not install kadai against the kadai repo at the end of this plan.** That happens (optionally) only at the end of Plan 5.
