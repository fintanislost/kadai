# Kadai Plan 8 — SSE live updates

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `.kadai/` changes (CLI write, MCP tool call, hook append, another browser tab), the open web viewer auto-refreshes within ~1 second — no manual page reload needed.

**Architecture:** A small in-process `EventBus` lives next to `src/web/api.ts`. A debounced filesystem watcher on `.kadai/` (Node's built-in `fs.watch` with `recursive: true`, available on Bun) infers a change scope (`spine` / `picked` / `config`) from the changed path and notifies the bus. A new `GET /api/events` endpoint returns `text/event-stream` and pipes bus events into a `ReadableStream`. On the client a `LiveUpdatesProvider` context opens an `EventSource`, increments a `key` counter on each `spine` event, and pages include the key in their `useEffect` dependency arrays so they refetch.

**Tech Stack:** TypeScript on Bun (existing). No new runtime dependencies — Node's `fs.watch({recursive: true})` works under Bun on Linux ≥ kernel 4.7 (uses inotify). Browser `EventSource` for the client (built-in, no library). Heartbeat every 15s to keep the SSE connection alive through proxies.

## Position in the build

| | |
|---|---|
| **This is plan** | 8 of N |
| **Prior plan** | [Plan 7 — Web viewer interactivity](2026-05-05-kadai-07-web-viewer-interactivity.md) — `DONE` |
| **Next plan** | Plan 9 — Search (per [post-mvp.md](../../wiki/post-mvp.md)) |
| **Index** | [README.md](README.md) |
| **Backlog** | [`docs/wiki/post-mvp.md`](../../wiki/post-mvp.md) |

## What ships at the end

- `src/web/events.ts` — `EventBus` (subscribe/notify) + `inferScope(path)` + `startWatcher(rootDir, bus)`.
- `GET /api/events` — `text/event-stream` endpoint that streams `data: {"scope":"spine"}\n\n` (etc.) on every change, plus a 15-second heartbeat (`: ping\n\n` comment lines).
- `src/web/server.ts` — owns the singleton `EventBus` + watcher lifecycle (start/stop).
- `src/web/frontend/src/live.tsx` — `LiveUpdatesProvider` (opens `EventSource`, exposes `liveKey`) + `useLiveKey()` hook.
- `src/web/frontend/src/components/Layout.tsx` — wrapped with the provider.
- All 4 pages (`Home`, `Epic`, `Feature`, `Story`) — useEffect deps include `liveKey` so they refetch on every spine change.
- ~6 new unit/integration tests (events bus, watcher, SSE endpoint shape) + 1 Playwright E2E (write via API, observe UI update without reload).
- `docs/wiki/api-reference.md` — adds the `/api/events` row.
- `docs/wiki/web-viewer.md` — replaces the "Plan 8 forthcoming" line with the actual behavior.
- Plugin version 0.3.0 → 0.4.0.
- All 200+ existing tests still pass; 6 Playwright E2E pass.

## Out of scope (deferred)

- Per-item targeted invalidation (events carry only `scope`, not the affected item ID). Page refetches are cheap; targeting is premature optimization.
- WebSockets — SSE is plenty for one-way server→client, no need for the bidirectional complexity.
- Multi-server / cluster broadcast (kadai is single-process per project).
- Authenticated SSE — `kadai serve` listens on localhost only.
- Reconnect UI ("connecting…" toast) — `EventSource` reconnects silently and the next event refetches state, so it's invisible by design.

## File structure

```
src/web/events.ts                                  # NEW: EventBus + inferScope + startWatcher
src/web/api.ts                                     # MODIFIED: add GET /api/events route; signature accepts bus
src/web/server.ts                                  # MODIFIED: own EventBus + watcher lifecycle

tests/web/events.test.ts                           # NEW: bus + scope inference unit tests
tests/web/watcher.test.ts                          # NEW: watcher integration test (touch file → bus fires)
tests/web/sse.test.ts                              # NEW: GET /api/events integration test

src/web/frontend/src/live.tsx                      # NEW: LiveUpdatesProvider + useLiveKey
src/web/frontend/src/components/Layout.tsx         # MODIFIED: wrap children with provider
src/web/frontend/src/pages/Home.tsx                # MODIFIED: useLiveKey in deps
src/web/frontend/src/pages/Epic.tsx                # MODIFIED: useLiveKey in deps
src/web/frontend/src/pages/Feature.tsx             # MODIFIED: useLiveKey in deps
src/web/frontend/src/pages/Story.tsx               # MODIFIED: useLiveKey in deps

tests/web/e2e.pw.ts                                # MODIFIED: add 1 live-update E2E

docs/wiki/api-reference.md                         # MODIFIED: add /api/events row
docs/wiki/web-viewer.md                            # MODIFIED: replace "Plan 8 forthcoming"
docs/wiki/post-mvp.md                              # MODIFIED: Plan 8 → Recently shipped, Plan 9 → next
docs/dogfood-acceptance-test.md                    # APPEND: Plan 8 verification
kadai-plugin/.claude-plugin/plugin.json            # MODIFIED: 0.3.0 → 0.4.0
```

## Tasks

---

### Task 1: EventBus + scope inference

**Files:**
- Create: `src/web/events.ts`
- Create: `tests/web/events.test.ts`

**Goal:** A tiny in-memory pub/sub plus a pure function that maps a changed file path to a `'spine' | 'picked' | 'config'` scope. No I/O — pure logic, easy to test.

- [ ] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/web/events.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { EventBus, inferScope } from '../../src/web/events';

test('EventBus.subscribe receives subsequent notify calls', () => {
  const bus = new EventBus();
  const events: string[] = [];
  bus.subscribe(e => events.push(e.scope));
  bus.notify('spine');
  bus.notify('picked');
  expect(events).toEqual(['spine', 'picked']);
});

test('EventBus unsubscribe stops delivery', () => {
  const bus = new EventBus();
  const events: string[] = [];
  const unsub = bus.subscribe(e => events.push(e.scope));
  bus.notify('spine');
  unsub();
  bus.notify('config');
  expect(events).toEqual(['spine']);
});

test('EventBus delivers to multiple subscribers', () => {
  const bus = new EventBus();
  const a: string[] = [];
  const b: string[] = [];
  bus.subscribe(e => a.push(e.scope));
  bus.subscribe(e => b.push(e.scope));
  bus.notify('spine');
  expect(a).toEqual(['spine']);
  expect(b).toEqual(['spine']);
});

test('EventBus listener exception does not break other listeners', () => {
  const bus = new EventBus();
  const ok: string[] = [];
  bus.subscribe(() => { throw new Error('boom'); });
  bus.subscribe(e => ok.push(e.scope));
  expect(() => bus.notify('spine')).not.toThrow();
  expect(ok).toEqual(['spine']);
});

test('inferScope: .picked file → picked', () => {
  expect(inferScope('.picked')).toBe('picked');
  expect(inferScope('/abs/path/.kadai/.picked')).toBe('picked');
});

test('inferScope: config.toml → config', () => {
  expect(inferScope('config.toml')).toBe('config');
  expect(inferScope('/abs/path/.kadai/config.toml')).toBe('config');
});

test('inferScope: anything else → spine', () => {
  expect(inferScope('epics/EPIC-001-x/epic.md')).toBe('spine');
  expect(inferScope('epics/EPIC-001-x/features/FEAT-001-y/feature.md')).toBe('spine');
  expect(inferScope('.counters.json')).toBe('spine');
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/events.test.ts
```

Expected: FAIL with "Cannot find module ../../src/web/events".

- [ ] **Step 3: Implement events.ts (bus + scope only)**

Create `/home/fintan/repos/kadai/src/web/events.ts`:

```typescript
export type ChangeScope = 'spine' | 'picked' | 'config';

export interface ChangeEvent {
  scope: ChangeScope;
}

export type ChangeListener = (event: ChangeEvent) => void;

export class EventBus {
  private listeners = new Set<ChangeListener>();

  subscribe(fn: ChangeListener): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  notify(scope: ChangeScope): void {
    const event: ChangeEvent = { scope };
    for (const fn of this.listeners) {
      try { fn(event); } catch { /* swallow listener errors */ }
    }
  }
}

export function inferScope(path: string): ChangeScope {
  if (path.endsWith('.picked')) return 'picked';
  if (path.endsWith('config.toml')) return 'config';
  return 'spine';
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/events.test.ts
```

Expected: 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/events.ts tests/web/events.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add EventBus + inferScope for live-update plumbing [Plan-8 Task-1]

Tiny in-process pub/sub with subscribe/notify and a pure path-to-scope
helper. Listener exceptions are swallowed so one bad subscriber can't
silence the rest. Foundation for the SSE stream + filesystem watcher.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Filesystem watcher

**Files:**
- Modify: `src/web/events.ts` (add `startWatcher`)
- Create: `tests/web/watcher.test.ts`

**Goal:** Watch `.kadai/` recursively. On a change, debounce briefly (avoid storms from `writeFileAtomic`'s rename), infer scope from the changed path, call `bus.notify(scope)`. Returns a stop function.

- [ ] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/web/watcher.test.ts`:

```typescript
import { test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EventBus, startWatcher } from '../../src/web/events';

let tmp: string;
let stop: (() => void) | null = null;
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-watch-'));
  mkdirSync(join(tmp, '.kadai', 'epics'), { recursive: true });
});
afterEach(() => {
  if (stop) { stop(); stop = null; }
  rmSync(tmp, { recursive: true, force: true });
});

function waitForEvent(bus: EventBus, timeoutMs = 1000): Promise<{ scope: string }> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout waiting for event')), timeoutMs);
    const unsub = bus.subscribe(e => {
      clearTimeout(t);
      unsub();
      resolve(e);
    });
  });
}

test('startWatcher fires a spine event when an epic file is written', async () => {
  const bus = new EventBus();
  stop = startWatcher(tmp, bus, { debounceMs: 30 });

  const epicPath = join(tmp, '.kadai', 'epics', 'EPIC-001-x', 'epic.md');
  mkdirSync(join(tmp, '.kadai', 'epics', 'EPIC-001-x'), { recursive: true });
  // Tiny delay so the watcher's mkdir-add doesn't collide with the file write.
  await new Promise(r => setTimeout(r, 50));
  writeFileSync(epicPath, '---\nid: EPIC-001\n---\n');

  const event = await waitForEvent(bus, 1500);
  expect(event.scope).toBe('spine');
});

test('startWatcher fires a picked event when .picked is written', async () => {
  const bus = new EventBus();
  stop = startWatcher(tmp, bus, { debounceMs: 30 });

  await new Promise(r => setTimeout(r, 50));
  writeFileSync(join(tmp, '.kadai', '.picked'), 'STORY-001');

  const event = await waitForEvent(bus, 1500);
  expect(event.scope).toBe('picked');
});

test('startWatcher debounces multiple writes into one event', async () => {
  const bus = new EventBus();
  stop = startWatcher(tmp, bus, { debounceMs: 50 });

  const events: string[] = [];
  bus.subscribe(e => events.push(e.scope));

  await new Promise(r => setTimeout(r, 50));
  for (let i = 0; i < 5; i++) {
    writeFileSync(join(tmp, '.kadai', `file-${i}.tmp`), 'x');
  }
  await new Promise(r => setTimeout(r, 200));

  // After the debounce window, all 5 writes should collapse into ≤2 events
  // (in practice 1, but allow 2 to absorb OS-level interleaving).
  expect(events.length).toBeGreaterThan(0);
  expect(events.length).toBeLessThanOrEqual(2);
});

test('startWatcher stop() prevents subsequent events', async () => {
  const bus = new EventBus();
  stop = startWatcher(tmp, bus, { debounceMs: 30 });

  await new Promise(r => setTimeout(r, 50));
  stop();
  stop = null;

  let fired = false;
  bus.subscribe(() => { fired = true; });
  writeFileSync(join(tmp, '.kadai', 'after-stop.tmp'), 'x');
  await new Promise(r => setTimeout(r, 150));

  expect(fired).toBe(false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/watcher.test.ts
```

Expected: FAIL with "Cannot find startWatcher" (export missing).

- [ ] **Step 3: Add startWatcher to events.ts**

Edit `/home/fintan/repos/kadai/src/web/events.ts`. Add these imports at the top:

```typescript
import { watch, type FSWatcher } from 'node:fs';
import { join } from 'node:path';
```

Append to the file:

```typescript
export interface WatcherOptions {
  debounceMs?: number;
}

/**
 * Watch <rootDir>/.kadai recursively. On a change, debounce briefly (50ms by default),
 * infer the scope from the most recent path, and notify the bus. Returns a stop function.
 */
export function startWatcher(rootDir: string, bus: EventBus, opts: WatcherOptions = {}): () => void {
  const debounceMs = opts.debounceMs ?? 50;
  const kadaiDir = join(rootDir, '.kadai');

  let watcher: FSWatcher | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pendingScope: ChangeScope = 'spine';

  try {
    watcher = watch(kadaiDir, { recursive: true }, (_eventType, filename) => {
      if (filename) pendingScope = inferScope(String(filename));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        bus.notify(pendingScope);
        pendingScope = 'spine';
        timer = null;
      }, debounceMs);
    });
  } catch {
    // .kadai may not exist yet — return a noop stop so the caller doesn't crash.
    return () => {};
  }

  return () => {
    if (timer) { clearTimeout(timer); timer = null; }
    if (watcher) { watcher.close(); watcher = null; }
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/watcher.test.ts
```

Expected: 4 tests pass. (If a test is flaky on the first run, do NOT add retries — investigate. The debounce test in particular depends on inotify timing; bumping `debounceMs` higher in the test setup is acceptable if needed.)

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/events.ts tests/web/watcher.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add startWatcher for .kadai/ filesystem changes [Plan-8 Task-2]

Recursive fs.watch with 50ms debounce so writeFileAtomic rename storms
collapse into single notifications. Returns a stop function for clean
shutdown. Falls back to a noop watcher if .kadai/ doesn't exist yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: SSE endpoint

**Files:**
- Modify: `src/web/api.ts` (signature change + new route)
- Create: `tests/web/sse.test.ts`

**Goal:** `GET /api/events` returns `text/event-stream`. The body is a `ReadableStream` that subscribes to the bus and writes `data: {"scope":"spine"}\n\n` on each event, plus a heartbeat comment (`: ping\n\n`) every 15 seconds. On client disconnect (stream cancel), unsubscribe.

- [ ] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/web/sse.test.ts`:

```typescript
import { test, expect, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInit } from '../../src/cli/init';
import { runAdd } from '../../src/cli/add';
import { startServer, type ServerHandle } from '../../src/web/server';
import { EventBus } from '../../src/web/events';

let tmp: string;
let server: ServerHandle;
let bus: EventBus;

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'kadai-sse-'));
  runInit({ rootDir: tmp, productDescription: 'X', skipFirstEpic: true });
  runAdd({ rootDir: tmp, kind: 'epic', title: 'Auth', phase: 'mvp' });

  bus = new EventBus();
  server = await startServer({ rootDir: tmp, port: 0, eventBus: bus, startWatcher: false });
});

afterAll(async () => {
  await server.stop();
  rmSync(tmp, { recursive: true, force: true });
});

test('GET /api/events returns text/event-stream content type', async () => {
  const r = await fetch(`http://localhost:${server.port}/api/events`);
  expect(r.status).toBe(200);
  expect(r.headers.get('content-type')).toMatch(/text\/event-stream/);
  // Cancel the stream so the test exits cleanly.
  await r.body!.cancel();
});

test('GET /api/events delivers a notify() to a connected client', async () => {
  const r = await fetch(`http://localhost:${server.port}/api/events`);
  const reader = r.body!.getReader();
  const decoder = new TextDecoder();

  // Fire an event after the connection is open.
  setTimeout(() => bus.notify('spine'), 50);

  // Read chunks until we see a `data:` line; bail after 2 seconds.
  const start = Date.now();
  let buffer = '';
  while (Date.now() - start < 2000) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (buffer.includes('data:')) break;
  }
  await reader.cancel();

  expect(buffer).toMatch(/data: \{"scope":"spine"\}/);
});
```

- [ ] **Step 2: Run test — should fail (signature mismatch + missing route)**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/sse.test.ts
```

Expected: TS error (startServer doesn't accept eventBus / startWatcher options yet) OR runtime error (route 404).

- [ ] **Step 3: Update startServer signature in server.ts**

Edit `/home/fintan/repos/kadai/src/web/server.ts`. The current `ServerOptions` interface is:

```typescript
export interface ServerOptions {
  rootDir: string;
  port: number;
  distDir?: string;
}
```

Replace with:

```typescript
export interface ServerOptions {
  rootDir: string;
  port: number;
  distDir?: string;
  eventBus?: EventBus;
  startWatcher?: boolean;  // default true
}
```

Add this import at the top:

```typescript
import { EventBus, startWatcher as startFsWatcher } from './events';
```

Inside `startServer`, after the `indexHtml` line and BEFORE `const server = Bun.serve(...)`, add:

```typescript
  const bus = opts.eventBus ?? new EventBus();
  const stopWatcher = (opts.startWatcher !== false)
    ? startFsWatcher(opts.rootDir, bus)
    : () => {};
```

Update the `fetch` handler to pass the bus through:

```typescript
      if (path.startsWith('/api/')) {
        return handleApi(req, opts.rootDir, bus);
      }
```

Update the returned `ServerHandle.stop` to also tear down the watcher:

```typescript
  return {
    port: server.port!,
    url: `http://localhost:${server.port}`,
    stop: async () => { stopWatcher(); server.stop(); },
  };
```

- [ ] **Step 4: Update handleApi signature in api.ts to accept the bus**

Edit `/home/fintan/repos/kadai/src/web/api.ts`. Add this import alongside the existing ones:

```typescript
import type { EventBus } from './events';
```

Change the signature from:

```typescript
export async function handleApi(req: Request, rootDir: string): Promise<Response> {
```

To:

```typescript
export async function handleApi(req: Request, rootDir: string, bus?: EventBus): Promise<Response> {
```

Inside `handleApi`, after the `if (path === '/api/phases') ...` block (or anywhere before the `404` fallback), add:

```typescript
  if (path === '/api/events' && req.method === 'GET') {
    if (!bus) {
      return new Response('Event bus not configured', { status: 503 });
    }
    let cleanup: () => void = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const encoder = new TextEncoder();
        const send = (text: string) => {
          try { controller.enqueue(encoder.encode(text)); } catch { /* stream closed */ }
        };
        // Initial comment so EventSource immediately considers the connection open.
        send(': open\n\n');
        const unsub = bus.subscribe(event => {
          send(`data: ${JSON.stringify(event)}\n\n`);
        });
        const heartbeat = setInterval(() => send(': ping\n\n'), 15_000);
        cleanup = () => {
          clearInterval(heartbeat);
          unsub();
        };
      },
      cancel() {
        cleanup();
      },
    });
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  }
```

- [ ] **Step 5: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/sse.test.ts
```

Expected: 2 tests pass.

- [ ] **Step 6: Run the full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: ~213 tests pass (200 existing + 7 from Task 1 + 4 from Task 2 + 2 from Task 3 = 213). Typecheck clean.

- [ ] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/api.ts src/web/server.ts tests/web/sse.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add GET /api/events SSE stream + wire EventBus into server [Plan-8 Task-3]

text/event-stream Response built from a ReadableStream that subscribes
to the bus on connect and unsubscribes on stream cancel (browser disconnect).
Heartbeat every 15s as a comment line keeps proxies from killing idle
connections. Server owns the bus + watcher; tests can inject a custom bus
and disable the watcher to keep them deterministic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Client LiveUpdatesProvider + useLiveKey hook

**Files:**
- Create: `src/web/frontend/src/live.tsx`
- Modify: `src/web/frontend/src/components/Layout.tsx`

**Goal:** Open an `EventSource` connection at the layout level. Maintain a `liveKey` counter that increments on every `spine`-scope event. Expose it via context + `useLiveKey()` hook. Pages will use the hook in Task 5.

Note: `EventSource` doesn't fire on `picked` or `config` events for now — those scopes are reserved for finer-grained invalidation later. Only `spine` events bump `liveKey`. (Pages don't currently render config or picked-aware UI in a way that benefits from refetch.)

- [ ] **Step 1: Create live.tsx**

Create `/home/fintan/repos/kadai/src/web/frontend/src/live.tsx`:

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const LiveKeyContext = createContext<number>(0);

interface ProviderProps {
  children: ReactNode;
}

export function LiveUpdatesProvider({ children }: ProviderProps) {
  const [liveKey, setLiveKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const es = new EventSource('/api/events');

    es.onmessage = (ev) => {
      if (cancelled) return;
      try {
        const parsed = JSON.parse(ev.data) as { scope?: string };
        if (parsed.scope === 'spine') {
          setLiveKey(k => k + 1);
        }
      } catch {
        // ignore malformed payloads
      }
    };

    es.onerror = () => {
      // EventSource auto-reconnects; nothing to do.
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, []);

  return (
    <LiveKeyContext.Provider value={liveKey}>{children}</LiveKeyContext.Provider>
  );
}

export function useLiveKey(): number {
  return useContext(LiveKeyContext);
}
```

- [ ] **Step 2: Wrap Layout with the provider**

Read `/home/fintan/repos/kadai/src/web/frontend/src/components/Layout.tsx` to confirm shape. Then add this import alongside the existing imports:

```typescript
import { LiveUpdatesProvider } from '../live';
```

Wrap the existing children render with `<LiveUpdatesProvider>...</LiveUpdatesProvider>`. The exact JSX depends on the current Layout — typically you'll find an `<Outlet />` from `@tanstack/react-router` somewhere; wrap that. Example transformation:

If the current return is something like:

```tsx
return (
  <div className="min-h-screen ...">
    <header>...</header>
    <main className="...">
      <Outlet />
    </main>
  </div>
);
```

Change to:

```tsx
return (
  <LiveUpdatesProvider>
    <div className="min-h-screen ...">
      <header>...</header>
      <main className="...">
        <Outlet />
      </main>
    </div>
  </LiveUpdatesProvider>
);
```

(Wrap as high in the tree as practical so every page sees the same context.)

- [ ] **Step 3: Build the SPA**

```bash
cd /home/fintan/repos/kadai
bun run build:web
```

Expected: clean build.

- [ ] **Step 4: Verify typecheck + tests**

```bash
cd /home/fintan/repos/kadai
bun run typecheck
bun test
```

Expected: clean.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/live.tsx src/web/frontend/src/components/Layout.tsx
git commit -m "$(cat <<'EOF'
feat(web/client): add LiveUpdatesProvider + useLiveKey hook [Plan-8 Task-4]

Opens an EventSource against /api/events at the layout level and exposes
a liveKey counter that increments on each spine-scope server event.
Pages will consume the key in their useEffect dep array (next task).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wire useLiveKey into all 4 pages

**Files:**
- Modify: `src/web/frontend/src/pages/Home.tsx`
- Modify: `src/web/frontend/src/pages/Epic.tsx`
- Modify: `src/web/frontend/src/pages/Feature.tsx`
- Modify: `src/web/frontend/src/pages/Story.tsx`

**Goal:** Each page calls `useLiveKey()` and includes the key in its `useEffect` dependency array — so when the server pushes a spine change, React re-runs the effect and refetches.

- [ ] **Step 1: Update Home.tsx**

Edit `/home/fintan/repos/kadai/src/web/frontend/src/pages/Home.tsx`. Add this import:

```typescript
import { useLiveKey } from '../live';
```

Inside the `Home` function, immediately after the existing `useState` calls, add:

```typescript
const liveKey = useLiveKey();
```

Change the `useEffect` dependency array from `[]` to `[liveKey]`:

```typescript
useEffect(() => {
  listPhases().then(setPhases);
  listEpics().then(setEpics);
}, [liveKey]);
```

- [ ] **Step 2: Update Epic.tsx**

Same pattern. Add the import. Add `const liveKey = useLiveKey();` after the existing `useState`s. Change the `useEffect` deps from `[id]` to `[id, liveKey]`:

```typescript
useEffect(() => {
  getItem(id).then(setEpic);
  listFeatures({ epic_id: id }).then(setFeatures);
}, [id, liveKey]);
```

- [ ] **Step 3: Update Feature.tsx**

Same pattern. Add the import. Add `const liveKey = useLiveKey();` after the existing `useState`s. Change deps from `[id]` to `[id, liveKey]`:

```typescript
useEffect(() => {
  getItem(id).then(setFeature);
  listStories({ feature_id: id }).then(setStories);
}, [id, liveKey]);
```

- [ ] **Step 4: Update Story.tsx**

Same pattern. Add the import. Add `const liveKey = useLiveKey();` after the existing `useState`s. Change deps from `[id]` to `[id, liveKey]`:

```typescript
useEffect(() => {
  getItem(id).then(setStory);
  listTasks({ story_id: id }).then(setTasks);
  getFile(id, 'spec.md').then(setSpec);
  getFile(id, 'plan.md').then(setPlan);
  getFile(id, 'changelog.md').then(setChangelog);
}, [id, liveKey]);
```

- [ ] **Step 5: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run typecheck
bun test
```

Expected: clean.

- [ ] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/frontend/src/pages/Home.tsx src/web/frontend/src/pages/Epic.tsx src/web/frontend/src/pages/Feature.tsx src/web/frontend/src/pages/Story.tsx
git commit -m "$(cat <<'EOF'
feat(web/client): refetch all pages on liveKey bump [Plan-8 Task-5]

Each page subscribes to LiveKeyContext via useLiveKey() and includes
the key in its useEffect dep array, so a server-side spine change
triggers a refetch within ~50ms (debounce) + RTT.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Playwright E2E for live updates

**Files:**
- Modify: `tests/web/e2e.pw.ts`

**Goal:** Open the home page, write a new epic via the API in a separate request, expect the new title to appear in the DOM without a manual page reload.

- [ ] **Step 1: Add the E2E test**

APPEND to `/home/fintan/repos/kadai/tests/web/e2e.pw.ts`:

```typescript
test('home page auto-refreshes when an epic is added via the API', async ({ page }) => {
  await page.goto(serverUrl);
  await page.waitForLoadState('networkidle');

  // Sanity: the seeded epic title is visible.
  await expect(page.locator('text=Authentication')).toBeVisible();

  // The seed has already added a feature + 3 stories; trigger an additional change
  // by POSTing a status update via the existing API (Plan 7) — this writes to disk,
  // which the watcher should observe and stream to the browser.
  await page.evaluate(async () => {
    await fetch('/api/items/STORY-001/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'in_progress' }),
    });
  });

  // Navigate to the feature page to observe the column re-render. Wait for the
  // card to appear in the in_progress column WITHOUT calling page.reload().
  await page.goto(`${serverUrl}/features/FEAT-001`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[data-testid="column-in_progress"]').locator('[data-testid="card-STORY-001"]')).toBeVisible({ timeout: 5000 });

  // Now mutate again from outside the tab (via fetch) and watch the column update live.
  await page.evaluate(async () => {
    await fetch('/api/items/STORY-001/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'review' }),
    });
  });

  // No reload — wait for STORY-001 to appear in the review column.
  await expect(page.locator('[data-testid="column-review"]').locator('[data-testid="card-STORY-001"]')).toBeVisible({ timeout: 5000 });
  // And it should no longer be in in_progress.
  await expect(page.locator('[data-testid="column-in_progress"]').locator('[data-testid="card-STORY-001"]')).toHaveCount(0, { timeout: 5000 });
});
```

- [ ] **Step 2: Build the SPA + run Playwright**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bunx playwright test
```

Expected: 7/7 tests pass (3 from Plan 4, 3 from Plan 7, 1 from Plan 8).

If the live-update test fails on first run with a timeout, the most likely cause is the watcher not firing fast enough on the test's filesystem; bump the `toBeVisible` timeout to 8000 and re-run. If it still fails, suspect the EventSource connection isn't being established before the first mutation (race condition); add `await page.waitForTimeout(100)` after the first `goto` and re-run.

- [ ] **Step 3: Verify the unit suite**

```bash
cd /home/fintan/repos/kadai
bun test
```

Expected: 213/0.

- [ ] **Step 4: Commit**

```bash
cd /home/fintan/repos/kadai
git add tests/web/e2e.pw.ts
git commit -m "$(cat <<'EOF'
test(web/e2e): home page auto-refreshes via SSE when API mutates [Plan-8 Task-6]

Verifies that a status change posted to the API (writeFileAtomic on disk)
flows through the filesystem watcher → EventBus → SSE stream → EventSource
→ liveKey bump → useEffect refetch — all without page.reload().

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Robustness pass — reconnect timing + watcher edge cases

**Files:**
- Modify: `src/web/events.ts` (resilience tweaks)
- Modify: `tests/web/watcher.test.ts` (one more test)

**Goal:** Two small hardening fixes: (a) the watcher should not crash if `.kadai/` is renamed/deleted while running (e.g., during `git checkout`), and (b) successive distinct-scope events within the debounce window should fire as separate events, not collapse into one. We tighten this without changing the public API.

- [ ] **Step 1: Add the failing test**

APPEND to `/home/fintan/repos/kadai/tests/web/watcher.test.ts`:

```typescript
test('startWatcher delivers each scope as a separate event when scopes differ within the window', async () => {
  const bus = new EventBus();
  stop = startWatcher(tmp, bus, { debounceMs: 50 });

  const events: string[] = [];
  bus.subscribe(e => events.push(e.scope));

  await new Promise(r => setTimeout(r, 50));
  // First a spine change…
  writeFileSync(join(tmp, '.kadai', 'note.tmp'), 'x');
  // …then a picked change before the spine debounce fires.
  await new Promise(r => setTimeout(r, 10));
  writeFileSync(join(tmp, '.kadai', '.picked'), 'STORY-001');
  // …and a config change.
  await new Promise(r => setTimeout(r, 60));
  writeFileSync(join(tmp, '.kadai', 'config.toml'), 'x');

  await new Promise(r => setTimeout(r, 200));

  expect(events).toContain('spine');
  expect(events).toContain('picked');
  expect(events).toContain('config');
});
```

- [ ] **Step 2: Run tests to verify the failure**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/watcher.test.ts
```

Expected: the new test fails — the existing `startWatcher` collapses *everything* in the debounce window into a single event using whatever scope landed last.

- [ ] **Step 3: Update startWatcher to track per-scope debounces**

In `/home/fintan/repos/kadai/src/web/events.ts`, replace the body of `startWatcher` with a per-scope timer map:

```typescript
export function startWatcher(rootDir: string, bus: EventBus, opts: WatcherOptions = {}): () => void {
  const debounceMs = opts.debounceMs ?? 50;
  const kadaiDir = join(rootDir, '.kadai');

  let watcher: FSWatcher | null = null;
  const timers = new Map<ChangeScope, ReturnType<typeof setTimeout>>();

  function schedule(scope: ChangeScope) {
    const existing = timers.get(scope);
    if (existing) clearTimeout(existing);
    timers.set(scope, setTimeout(() => {
      timers.delete(scope);
      bus.notify(scope);
    }, debounceMs));
  }

  try {
    watcher = watch(kadaiDir, { recursive: true }, (_eventType, filename) => {
      if (!filename) return;
      schedule(inferScope(String(filename)));
    });
    watcher.on('error', () => {
      // Filesystem went away (rename/delete). Stop quietly; caller can restart later.
      if (watcher) { watcher.close(); watcher = null; }
    });
  } catch {
    return () => {};
  }

  return () => {
    for (const t of timers.values()) clearTimeout(t);
    timers.clear();
    if (watcher) { watcher.close(); watcher = null; }
  };
}
```

- [ ] **Step 4: Run tests to verify they all pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/watcher.test.ts
```

Expected: 5 tests pass (the original 4 still green plus the new multi-scope one).

- [ ] **Step 5: Run the full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
```

Expected: 214 tests pass (213 + 1 new); typecheck clean.

- [ ] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/events.ts tests/web/watcher.test.ts
git commit -m "$(cat <<'EOF'
fix(web): per-scope debounce in startWatcher + tolerate watcher errors [Plan-8 Task-7]

Previously a fast burst of writes touching different scopes (spine + picked
+ config) collapsed into a single event using whichever path landed last.
Now each scope has its own debounce timer so distinct kinds of change all
get notified. Also: silently stop on watcher 'error' (e.g., .kadai/ rename
or delete) instead of crashing the server.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Docs + plugin v0.4.0 + post-MVP tracking + dogfood

**Files:**
- Modify: `docs/wiki/api-reference.md`
- Modify: `docs/wiki/web-viewer.md`
- Modify: `docs/wiki/post-mvp.md`
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (0.3.0 → 0.4.0)
- Append: `docs/dogfood-acceptance-test.md`
- Modify: `docs/superpowers/plans/2026-05-06-kadai-08-sse-live-updates.md` (tick checkboxes)

**Goal:** Document the new endpoint + behavior, mark Plan 8 shipped, bump plugin version, run a quick dogfood spot-check.

- [ ] **Step 1: Update api-reference.md**

In `/home/fintan/repos/kadai/docs/wiki/api-reference.md`, find the "Read endpoints" table. ADD this row at the bottom (after the `/api/files/...` row):

```markdown
| `GET` | `/api/events` | `text/event-stream` of `data: {"scope":"spine\|picked\|config"}` lines |
```

Then add a new section after the existing "Notes" section:

```markdown
## Live updates

`/api/events` is a Server-Sent Events stream. The server watches `.kadai/` for filesystem changes (recursive `fs.watch`); each change is debounced (50ms per scope) then pushed as one `data: {...}` line per event:

- `{"scope":"spine"}` — any item file or `.counters.json` etc. changed
- `{"scope":"picked"}` — `.kadai/.picked` changed
- `{"scope":"config"}` — `.kadai/config.toml` changed

A `:` comment heartbeat is sent every 15 seconds so proxies don't kill idle connections. Browsers consume this via `EventSource`; the kadai web viewer re-runs all `useEffect` data fetches on every `spine` event.
```

- [ ] **Step 2: Update web-viewer.md**

In `/home/fintan/repos/kadai/docs/wiki/web-viewer.md`, find the line:

```markdown
Status changes are optimistic — the UI updates immediately and reverts if the server rejects (e.g., illegal transition). For real-time sync across multiple browser tabs, see Plan 8 (forthcoming).
```

REPLACE it with:

```markdown
Status changes are optimistic — the UI updates immediately and reverts if the server rejects (e.g., illegal transition).

The viewer also auto-refreshes on any change to `.kadai/` (CLI write, MCP tool, hook append, or another browser tab). It uses Server-Sent Events on `/api/events` — see [api-reference.md](api-reference.md#live-updates) for the protocol details.
```

- [ ] **Step 3: Update post-mvp.md**

In `/home/fintan/repos/kadai/docs/wiki/post-mvp.md`:

(a) Find the section `### Plan 8 — Live updates (SSE) 🟢 **next**` (with its description bullets + estimate). REMOVE the entire section.

(b) Find the next plan in the list (should be `### Plan 9 — Search`). Add the badge:

```markdown
### Plan 9 — Search 🟢 **next**
```

(c) In the "Recently shipped" section at the bottom, ABOVE the existing `### Plan 7` entry, insert:

```markdown
### Plan 8 — Live updates (SSE) (shipped 2026-05-06)

- `GET /api/events` — text/event-stream powered by an in-process EventBus
- `src/web/events.ts` — bus + scope inference + recursive fs.watch with per-scope debounce
- `src/web/server.ts` — owns watcher lifecycle, injects bus into handleApi
- `LiveUpdatesProvider` + `useLiveKey()` on the client; all 4 pages refetch on spine events
- 1 new Playwright E2E (status mutation → kanban column update without page.reload)
- Plugin version bumped to 0.4.0
```

- [ ] **Step 4: Bump plugin version**

In `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`, change `"version": "0.3.0"` to `"version": "0.4.0"`.

- [ ] **Step 5: Dogfood verification**

Run a short Path A flow that demonstrates the SSE stream works end-to-end via curl:

```bash
TMP=$(mktemp -d -t kadai-plan8-XXXXXX)
cd "$TMP"

kadai init -y > /dev/null
kadai add feature --title "T" --phase mvp --epic EPIC-001 > /dev/null
kadai add story --title "S" --phase mvp --feature FEAT-001 > /dev/null

kadai serve --no-open --port 7847 > /tmp/kadai-plan8-serve.log 2>&1 &
SERVE_PID=$!
sleep 2

# Connect to /api/events in the background, write 5 lines to a temp file, then trigger a change.
curl -sN --max-time 4 http://localhost:7847/api/events > /tmp/kadai-sse.out &
CURL_PID=$!
sleep 1

# Trigger a write that should hit the watcher.
kadai set-status STORY-001 in_progress > /dev/null

# Give the watcher a moment to fire.
sleep 1
kill $CURL_PID 2>/dev/null || true
wait $CURL_PID 2>/dev/null || true

echo "=== SSE stream excerpt ==="
cat /tmp/kadai-sse.out

echo ""
echo "=== Verify status persisted ==="
kadai list story

kill $SERVE_PID || true
sleep 1
cd / && rm -rf "$TMP" /tmp/kadai-plan8-serve.log /tmp/kadai-sse.out
```

Expected:
- SSE stream excerpt contains `: open` and at least one `data: {"scope":"spine"}` line.
- `kadai list story` shows STORY-001 in_progress.

- [ ] **Step 6: Append a section to docs/dogfood-acceptance-test.md**

Read `/home/fintan/repos/kadai/docs/dogfood-acceptance-test.md` to see prior format. APPEND:

```markdown

---

## SSE live updates run — Plan 8 verification — 2026-05-06

Verified the watcher → bus → stream pipeline end-to-end via `curl` against a real `kadai serve` process.

- Connected `curl -sN .../api/events` in a background subshell.
- Triggered a CLI write: `kadai set-status STORY-001 in_progress`.
- The SSE stream emitted `: open` then `data: {"scope":"spine"}` within ~100ms of the file write.
- `kadai list story` confirmed the on-disk write happened.
- `bun test` → 214/0 pass ✅
- `bunx playwright test` → 7/7 pass (3 Plan 4 + 3 Plan 7 + 1 Plan 8) ✅

### Verdict: PASS

Web viewer auto-refreshes without manual reload.
```

(Use the actual numbers/output from your dogfood run if they differ — be accurate, not aspirational.)

- [ ] **Step 7: Run all the final checks**

```bash
cd /home/fintan/repos/kadai
bun test
bun run typecheck
bun run build:web
bunx playwright test
```

Expected: every step exits clean. If anything fails, do NOT commit — report.

- [ ] **Step 8: Tick the Task 8 checkboxes + the Plan 8 self-review checklist**

In `/home/fintan/repos/kadai/docs/superpowers/plans/2026-05-06-kadai-08-sse-live-updates.md`:
- Tick all 8 step checkboxes for Task 8
- Tick all checkboxes in the "Plan 8 self-review checklist" section near the bottom

- [ ] **Step 9: Commit**

```bash
cd /home/fintan/repos/kadai
git add docs/wiki/api-reference.md docs/wiki/web-viewer.md docs/wiki/post-mvp.md docs/dogfood-acceptance-test.md kadai-plugin/.claude-plugin/plugin.json docs/superpowers/plans/2026-05-06-kadai-08-sse-live-updates.md
git commit -m "$(cat <<'EOF'
docs(plan-8): api-reference, web-viewer, post-mvp shipped + plugin 0.4.0 [Plan-8 Task-8]

- api-reference.md: new /api/events row + Live updates section
- web-viewer.md: replaces "Plan 8 forthcoming" with the live behavior
- post-mvp.md: Plan 8 → Recently shipped, Plan 9 → next
- plugin.json: 0.3.0 → 0.4.0
- dogfood-acceptance-test.md: SSE pipeline spot-check appended

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan 8 self-review checklist

- [ ] All 8 tasks above completed; checkboxes ticked.
- [ ] `bun test` passes (~214 tests including 7 events + 5 watcher + 2 sse).
- [ ] `bun run typecheck` passes.
- [ ] `bunx playwright test` passes (7/7).
- [ ] `GET /api/events` returns text/event-stream with heartbeat + scope events (verified in Task 8 dogfood).
- [ ] Watcher fires on filesystem change (verified in Task 2 + Task 7 tests).
- [ ] Browser refetches on spine event (verified in Task 6 E2E).
- [ ] Plugin v0.4.0 in the manifest.
- [ ] post-mvp.md updated: Plan 8 in "Recently shipped"; Plan 9 marked 🟢 **next**.
- [ ] api-reference.md and web-viewer.md updated.

---

## Proceed to Plan 9

Once the self-review checklist is fully ticked, update the active plan in `/home/fintan/repos/kadai/CLAUDE.md` to point at Plan 9 (Search). Plan 9 is brainstormed/drafted from `docs/wiki/post-mvp.md` § Plan 9 — the spine-wide full-text search backed by the existing MCP `search` tool plus a search box in the web viewer.
