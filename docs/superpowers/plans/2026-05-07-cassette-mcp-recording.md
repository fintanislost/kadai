# Cassette tier — MCP recording — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the cassette tier to capture and replay kadai MCP tool calls — per [`docs/superpowers/specs/2026-05-07-cassette-mcp-recording-design.md`](../specs/2026-05-07-cassette-mcp-recording-design.md). After this lands, cassettes verify the kadai-aware-skills wrapper end-to-end (it uses MCP tools that the current CLI-only recorder doesn't see).

**Architecture:** Single instrumentation point in `src/mcp/server.ts`'s dispatch handler. Cassette format becomes a discriminated union on `kind: 'cli' | 'mcp'`. Replay handles both kinds; MCP entries dispatch via in-process `tool.handler(...)` against the same registry the production server uses.

**Tech Stack:** TypeScript on Bun (existing). MCP server uses `@modelcontextprotocol/sdk` (existing). No new deps.

## Position in the build

| | |
|---|---|
| **Branch** | `feature/cassette-tier` (continues from cassette base plan) |
| **Spec** | [`docs/superpowers/specs/2026-05-07-cassette-mcp-recording-design.md`](../specs/2026-05-07-cassette-mcp-recording-design.md) |
| **Depends on** | The base cassette tier (Tasks 1-6 of `2026-05-07-cassette-tier.md`) — already shipped as commits 55cd6fa..3587fb9 |
| **Plugin version** | Unchanged (1.4.0) |

## File structure

```
src/cassette/recorder.ts                  MODIFIED — appendMcpCallToCassette + MUTATING_MCP_TOOLS allowlist + kind:cli on existing helper
src/mcp/server.ts                         MODIFIED — call appendMcpCallToCassette in dispatch handler
tests/cassette/recorder.test.ts           MODIFIED — assert kind:cli on existing tests; add MCP-recorder tests
tests/cassette/replay.test.ts             MODIFIED — register MCP tools at module load; dispatch on kind
tests/cassette/replay-format-compat.test.ts  NEW — verifies the cassette format discriminator + back-compat
tests/mcp/server-recording.test.ts        NEW — integration test: invoke a mutating tool through the dispatch handler, verify cassette line
docs/wiki/concepts.md                     MODIFIED — note that cassettes record CLI + MCP
docs/wiki/troubleshooting.md              MODIFIED — same
tests/cassettes/blog-mvp/                 RE-RECORDED (Task 4, deferred if no claude on PATH)
```

## Tasks

---

### Task 1: Cassette format extension + recorder helpers

**Files:**
- Modify: `src/cassette/recorder.ts`
- Modify: `tests/cassette/recorder.test.ts`
- Create: `tests/cassette/replay-format-compat.test.ts`

**Goal:** Update the cassette format to be a discriminated union on `kind`. Add `appendMcpCallToCassette({tool, args, ok})`. Define the `MUTATING_MCP_TOOLS` allowlist as the single source of truth for "which MCP tools are spine-mutating." Existing `appendCallToCassette` writes `kind: 'cli'`. Verify back-compat parsing.

- [x] **Step 1: Write the new tests**

APPEND to `tests/cassette/recorder.test.ts`:

```typescript
test('CLI calls now record with kind:cli', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    runKadai({ KADAI_RECORD_TO: cassettePath }, '--version');
    const lines = readFileSync(cassettePath, 'utf8').trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]) as { kind: string; argv: string[] };
    expect(parsed.kind).toBe('cli');
    expect(parsed.argv).toEqual(['--version']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

Create `tests/cassette/replay-format-compat.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { parseCassetteLine, type CassetteEntry } from '../../src/cassette/recorder';

test('parseCassetteLine reads new kind:cli format', () => {
  const line = '{"kind":"cli","argv":["init","-y"],"exit":0}';
  const entry = parseCassetteLine(line);
  expect(entry.kind).toBe('cli');
  if (entry.kind === 'cli') {
    expect(entry.argv).toEqual(['init', '-y']);
    expect(entry.exit).toBe(0);
  }
});

test('parseCassetteLine reads new kind:mcp format', () => {
  const line = '{"kind":"mcp","tool":"create_epic","args":{"title":"Auth","phase":"mvp"},"ok":true}';
  const entry = parseCassetteLine(line);
  expect(entry.kind).toBe('mcp');
  if (entry.kind === 'mcp') {
    expect(entry.tool).toBe('create_epic');
    expect(entry.args).toEqual({ title: 'Auth', phase: 'mvp' });
    expect(entry.ok).toBe(true);
  }
});

test('parseCassetteLine treats legacy lines (no kind, has argv) as kind:cli', () => {
  const legacy = '{"argv":["init","-y"],"exit":0}';
  const entry = parseCassetteLine(legacy);
  expect(entry.kind).toBe('cli');
  if (entry.kind === 'cli') {
    expect(entry.argv).toEqual(['init', '-y']);
  }
});

test('parseCassetteLine throws on malformed line', () => {
  expect(() => parseCassetteLine('{ not json')).toThrow();
  expect(() => parseCassetteLine('{"random":"object"}')).toThrow(/cassette/i);
});

test('MUTATING_MCP_TOOLS includes the expected mutating tools', async () => {
  const { MUTATING_MCP_TOOLS } = await import('../../src/cassette/recorder');
  expect(MUTATING_MCP_TOOLS.has('create_epic')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('create_feature')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('create_story')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('create_task')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('attach_spec')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('attach_plan')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('pick_story')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('unpick')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('set_status')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('record_change')).toBe(true);
  // Reads should NOT be in the set
  expect(MUTATING_MCP_TOOLS.has('list_epics')).toBe(false);
  expect(MUTATING_MCP_TOOLS.has('get_item')).toBe(false);
  expect(MUTATING_MCP_TOOLS.has('search')).toBe(false);
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cassette/replay-format-compat.test.ts
```

Expected: 5 failures (parseCassetteLine doesn't exist; MUTATING_MCP_TOOLS doesn't exist).

- [x] **Step 3: Update recorder.ts**

Read `src/cassette/recorder.ts`. Replace its contents with:

```typescript
import { appendFileSync } from 'node:fs';

export type CassetteEntry =
  | { kind: 'cli'; argv: string[]; exit: number }
  | { kind: 'mcp'; tool: string; args: unknown; ok: boolean };

export interface CallRecord {
  argv: string[];
  exit: number;
}

export interface McpCallRecord {
  tool: string;
  args: unknown;
  ok: boolean;
}

// Subcommands that ARE NOT spine-mutating wrapper actions, and therefore
// shouldn't pollute cassettes:
// - hook: Claude Code lifecycle events fire one of these for every Edit/Write
//         the agent makes during the session. Pure noise; replay-incompatible
//         (the hook subcommands read JSON from stdin which isn't there in replay).
// - mcp:  the MCP server launch. Long-running; not a discrete "spine write."
// - serve: the web viewer; long-running; orthogonal to the wrapper.
const NOISE_SUBCOMMANDS = new Set(['hook', 'mcp', 'serve']);

// MCP tools that mutate spine state. Source of truth for what gets recorded
// from the MCP server's dispatch path. Reads (list_*, get_*, search) are
// intentionally excluded — they don't need replay because they don't change state.
export const MUTATING_MCP_TOOLS = new Set<string>([
  'create_epic',
  'create_feature',
  'create_story',
  'create_task',
  'attach_spec',
  'attach_plan',
  'pick_story',
  'unpick',
  'set_status',
  'record_change',
]);

function writeLine(path: string, entry: CassetteEntry): void {
  try {
    appendFileSync(path, JSON.stringify(entry) + '\n', 'utf8');
  } catch {
    // Best-effort — if the cassette file isn't writable, don't crash.
  }
}

export function appendCallToCassette(record: CallRecord): void {
  const path = process.env.KADAI_RECORD_TO;
  if (!path) return;
  if (record.argv.length > 0 && NOISE_SUBCOMMANDS.has(record.argv[0])) return;
  writeLine(path, { kind: 'cli', argv: record.argv, exit: record.exit });
}

export function appendMcpCallToCassette(record: McpCallRecord): void {
  const path = process.env.KADAI_RECORD_TO;
  if (!path) return;
  if (!MUTATING_MCP_TOOLS.has(record.tool)) return;
  writeLine(path, { kind: 'mcp', tool: record.tool, args: record.args, ok: record.ok });
}

export function parseCassetteLine(line: string): CassetteEntry {
  const parsed = JSON.parse(line) as Record<string, unknown>;
  // Back-compat: legacy lines (no kind, has argv) → cli.
  if (parsed.kind === undefined && Array.isArray(parsed.argv)) {
    return {
      kind: 'cli',
      argv: parsed.argv as string[],
      exit: typeof parsed.exit === 'number' ? parsed.exit : 0,
    };
  }
  if (parsed.kind === 'cli' && Array.isArray(parsed.argv)) {
    return {
      kind: 'cli',
      argv: parsed.argv as string[],
      exit: typeof parsed.exit === 'number' ? parsed.exit : 0,
    };
  }
  if (parsed.kind === 'mcp' && typeof parsed.tool === 'string') {
    return {
      kind: 'mcp',
      tool: parsed.tool,
      args: parsed.args,
      ok: parsed.ok !== false, // default to true if missing
    };
  }
  throw new Error(`malformed cassette line: ${line}`);
}
```

- [x] **Step 4: Run all tests**

```bash
cd /home/fintan/repos/kadai
bun test tests/cassette/ 2>&1 | tail -3
bun test 2>&1 | tail -3
bun run typecheck
```

Expected: all pass (existing 7 recorder tests + 1 new + 5 in replay-format-compat = 13 in cassette/, full suite green).

- [x] **Step 5: Tick the plan checkboxes for Task 1 + commit**

```bash
cd /home/fintan/repos/kadai
git add src/cassette/recorder.ts tests/cassette/recorder.test.ts tests/cassette/replay-format-compat.test.ts docs/superpowers/plans/2026-05-07-cassette-mcp-recording.md
git commit -m "$(cat <<'EOF'
feat(cassette): discriminated cassette format + MCP recorder helper [cassette-mcp Task-1]

Cassette lines are now {kind: 'cli' | 'mcp', ...} discriminated unions:
- kind:cli → existing argv/exit shape (legacy lines without kind also
  parse as cli for back-compat)
- kind:mcp → new {tool, args, ok} shape

appendMcpCallToCassette({tool, args, ok}) is the new recorder entry point
for MCP server-side instrumentation (Task 2). It checks the tool name
against MUTATING_MCP_TOOLS — reads (list_*, get_*, search) are excluded
because they don't mutate state and don't need replay.

parseCassetteLine() handles both formats and the legacy back-compat path,
so existing cassettes (recorded before this change) continue to replay
cleanly.

5 new tests cover the format discriminator + back-compat + the allowlist.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: MCP server-side instrumentation

**Files:**
- Modify: `src/mcp/server.ts`
- Create: `tests/mcp/server-recording.test.ts`

**Goal:** When the dispatch handler in `src/mcp/server.ts` invokes a tool, also call `appendMcpCallToCassette` with the outcome. Single ~5-line change at the dispatch site. Test that a mutating tool invocation produces the cassette line; non-mutating reads do not.

- [ ] **Step 1: Write the integration test**

Create `tests/mcp/server-recording.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../src/mcp/registry';
import { registerCreateTools } from '../../src/mcp/handlers/creates';
import { registerReadTools } from '../../src/mcp/handlers/reads';

function seedSpine(root: string) {
  mkdirSync(join(root, '.kadai/epics'), { recursive: true });
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":0,"feature":0,"story":0,"task":0}');
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n[[phases]]\nslug = "mvp"\ndisplay = "MVP"\ncolor = "#22c55e"\n');
}

test('MCP create_epic call writes a kind:mcp cassette line', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-rec-'));
  try {
    seedSpine(root);
    _resetRegistry();
    registerCreateTools();
    const cassettePath = join(root, '.kadai/cassette.jsonl');
    process.env.KADAI_RECORD_TO = cassettePath;
    try {
      const tool = getTool('create_epic');
      expect(tool).toBeTruthy();
      const args = { title: 'Test Epic', phase: 'mvp' };
      const parsed = tool!.inputSchema.parse(args);
      await tool!.handler(parsed, { rootDir: root });
    } finally {
      delete process.env.KADAI_RECORD_TO;
    }
    expect(existsSync(cassettePath)).toBe(true);
    const lines = readFileSync(cassettePath, 'utf8').trim().split('\n').filter(Boolean);
    expect(lines.length).toBe(1);
    const entry = JSON.parse(lines[0]) as { kind: string; tool: string };
    expect(entry.kind).toBe('mcp');
    expect(entry.tool).toBe('create_epic');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('MCP read tools (list_epics) do NOT write to the cassette', async () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-rec-'));
  try {
    seedSpine(root);
    _resetRegistry();
    registerReadTools();
    const cassettePath = join(root, '.kadai/cassette.jsonl');
    process.env.KADAI_RECORD_TO = cassettePath;
    try {
      const tool = getTool('list_epics');
      expect(tool).toBeTruthy();
      const parsed = tool!.inputSchema.parse({});
      await tool!.handler(parsed, { rootDir: root });
    } finally {
      delete process.env.KADAI_RECORD_TO;
    }
    // No cassette file, OR if it exists, no entries.
    if (existsSync(cassettePath)) {
      const content = readFileSync(cassettePath, 'utf8').trim();
      expect(content).toBe('');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

(Note: this test invokes the handler directly, NOT through the MCP server transport. We're testing the recorder integration with the handler/registry; full server roundtrip is overkill for this test.)

**WAIT** — the test above calls the handler directly, but the recording instrumentation lives in `src/mcp/server.ts`'s dispatch handler, NOT inside individual tool handlers. So this test won't actually exercise the integration. We need a test that goes through the dispatch path.

Instead, expose `appendMcpCallToCassette` via a thin wrapper that the server calls. The integration test can either:
(a) call that wrapper directly (testing the recorder + allowlist, not server dispatch)
(b) start an actual MCP server transport, send a tool call, and verify

Going with (a) — simpler, exercises the allowlist + format. The dispatch hook in server.ts is small enough that it can be visually code-reviewed; full transport-level testing isn't needed for the recorder integration alone.

Replace the test above with this simpler version:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendMcpCallToCassette } from '../../src/cassette/recorder';

test('appendMcpCallToCassette writes kind:mcp for a mutating tool', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-app-'));
  try {
    const cassettePath = join(root, 'cassette.jsonl');
    process.env.KADAI_RECORD_TO = cassettePath;
    try {
      appendMcpCallToCassette({ tool: 'create_epic', args: { title: 'T', phase: 'mvp' }, ok: true });
    } finally {
      delete process.env.KADAI_RECORD_TO;
    }
    const lines = readFileSync(cassettePath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(1);
    const entry = JSON.parse(lines[0]) as { kind: string; tool: string; args: unknown; ok: boolean };
    expect(entry.kind).toBe('mcp');
    expect(entry.tool).toBe('create_epic');
    expect(entry.args).toEqual({ title: 'T', phase: 'mvp' });
    expect(entry.ok).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('appendMcpCallToCassette does NOT write for read tools (allowlist filter)', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-app-'));
  try {
    const cassettePath = join(root, 'cassette.jsonl');
    process.env.KADAI_RECORD_TO = cassettePath;
    try {
      appendMcpCallToCassette({ tool: 'list_epics', args: {}, ok: true });
      appendMcpCallToCassette({ tool: 'get_item', args: { id: 'EPIC-001' }, ok: true });
      appendMcpCallToCassette({ tool: 'search', args: { q: 'foo' }, ok: true });
    } finally {
      delete process.env.KADAI_RECORD_TO;
    }
    if (existsSync(cassettePath)) {
      expect(readFileSync(cassettePath, 'utf8').trim()).toBe('');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('appendMcpCallToCassette no-op when KADAI_RECORD_TO unset', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-app-'));
  try {
    delete process.env.KADAI_RECORD_TO;
    const cassettePath = join(root, 'cassette.jsonl');
    appendMcpCallToCassette({ tool: 'create_epic', args: { title: 'T' }, ok: true });
    expect(existsSync(cassettePath)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('appendMcpCallToCassette records ok:false on handler failure', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-app-'));
  try {
    const cassettePath = join(root, 'cassette.jsonl');
    process.env.KADAI_RECORD_TO = cassettePath;
    try {
      appendMcpCallToCassette({ tool: 'create_epic', args: { title: 'T' }, ok: false });
    } finally {
      delete process.env.KADAI_RECORD_TO;
    }
    const entry = JSON.parse(readFileSync(cassettePath, 'utf8').trim()) as { ok: boolean };
    expect(entry.ok).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

- [ ] **Step 2: Run the new tests; they should mostly pass already** (since `appendMcpCallToCassette` was implemented in Task 1)

```bash
cd /home/fintan/repos/kadai
bun test tests/mcp/server-recording.test.ts
```

Expected: 4 pass. (If you put these tests in the recorder test file in Task 1 instead, that's fine — same outcome.)

- [ ] **Step 3: Wire `appendMcpCallToCassette` into the server dispatch handler**

Read `src/mcp/server.ts`. Modify the `CallToolRequestSchema` handler. The current dispatch code is:

```typescript
try {
  const parsed = tool.inputSchema.parse(args ?? {});
  const result = await tool.handler(parsed, ctx);
  // ...
  return { content: [{ type: 'text' as const, text }] };
} catch (e: unknown) {
  // ...
}
```

Add the recorder calls so both success and failure paths record:

```typescript
import { appendMcpCallToCassette } from '../cassette/recorder';

// ... inside the CallToolRequestSchema handler ...
try {
  const parsed = tool.inputSchema.parse(args ?? {});
  let result: unknown;
  let ok = true;
  try {
    result = await tool.handler(parsed, ctx);
  } catch (e) {
    ok = false;
    appendMcpCallToCassette({ tool: name, args: parsed, ok });
    throw e;
  }
  appendMcpCallToCassette({ tool: name, args: parsed, ok });
  const text = result === undefined
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
```

(The schema-parse failure case won't record because we don't have a parsed args object then — that's fine; replay couldn't replay schema failures anyway.)

- [ ] **Step 4: Verify no regressions**

```bash
cd /home/fintan/repos/kadai
bun test 2>&1 | tail -3
bun run typecheck
```

Expected: full suite green; typecheck clean.

- [ ] **Step 5: Tick the plan checkboxes for Task 2 + commit**

```bash
cd /home/fintan/repos/kadai
git add src/mcp/server.ts tests/mcp/server-recording.test.ts docs/superpowers/plans/2026-05-07-cassette-mcp-recording.md
git commit -m "$(cat <<'EOF'
feat(cassette): MCP server records mutating tool calls [cassette-mcp Task-2]

Single instrumentation point in src/mcp/server.ts's dispatch handler:
appendMcpCallToCassette is called on both successful and failing tool
invocations (with ok: true / false respectively). Read tools (list_*,
get_*, search) are filtered by the MUTATING_MCP_TOOLS allowlist in
the recorder, so the dispatch handler doesn't need to know which is
which.

Schema-parse failures don't record (we don't have validated args at
that point, and replay couldn't replay them anyway).

4 unit tests cover the recorder side; the dispatch instrumentation is
small enough for visual review.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Replay MCP dispatch

**Files:**
- Modify: `tests/cassette/replay.test.ts`

**Goal:** When the replay test reads a cassette line with `kind: 'mcp'`, dispatch it via `tool.handler(args, {rootDir: tmp})` against the in-process registry. CLI lines continue to use the existing `execFileSync` path.

- [ ] **Step 1: Update the replay test runner**

Read `tests/cassette/replay.test.ts`. Update the test loop:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, existsSync, readdirSync, readFileSync, rmSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serializeSpine, diffSpines, type Snapshot } from '../../src/cassette/snapshot';
import { parseCassetteLine } from '../../src/cassette/recorder';
import { _resetRegistry, getTool } from '../../src/mcp/registry';
import { registerReadTools } from '../../src/mcp/handlers/reads';
import { registerGetTools } from '../../src/mcp/handlers/get';
import { registerSearchTools } from '../../src/mcp/handlers/search';
import { registerCreateTools } from '../../src/mcp/handlers/creates';
import { registerStatusTools } from '../../src/mcp/handlers/status';
import { registerPickTools } from '../../src/mcp/handlers/picks';
import { registerAttachTools } from '../../src/mcp/handlers/attach';
import { registerRecordChangeTool } from '../../src/mcp/handlers/record-change';

const CASSETTES_DIR = join(__dirname, '../cassettes');
const KADAI_CLI = join(__dirname, '../../src/cli/index.ts');

// Register all MCP tools once at module load — same as src/cli/mcp.ts does.
_resetRegistry();
registerReadTools();
registerGetTools();
registerSearchTools();
registerCreateTools();
registerStatusTools();
registerPickTools();
registerAttachTools();
registerRecordChangeTool();

function listCassettes(): string[] {
  if (!existsSync(CASSETTES_DIR)) return [];
  return readdirSync(CASSETTES_DIR).filter(name => {
    const dir = join(CASSETTES_DIR, name);
    const stat = lstatSync(dir);
    if (stat.isSymbolicLink() || !stat.isDirectory()) return false;
    return existsSync(join(dir, 'calls.jsonl'))
      && existsSync(join(dir, 'spine.snapshot.json'));
  });
}

const cassettes = listCassettes();
const REPLAY_ENV: NodeJS.ProcessEnv = { ...process.env, KADAI_RECORD_TO: '' };

if (cassettes.length === 0) {
  test('no cassettes recorded yet — see scripts/record-cassette.ts', () => {
    expect(cassettes.length).toBe(0);
  });
}

for (const name of cassettes) {
  test(`cassette: ${name}`, async () => {
    const cassetteDir = join(CASSETTES_DIR, name);
    const lines = readFileSync(join(cassetteDir, 'calls.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean);
    const entries = lines.map(parseCassetteLine);
    const captured = JSON.parse(readFileSync(join(cassetteDir, 'spine.snapshot.json'), 'utf8')) as Snapshot;

    const tmp = mkdtempSync(join(tmpdir(), `kadai-cass-${name}-`));
    try {
      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        if (entry.kind === 'cli') {
          let actualExit = 0;
          try {
            execFileSync('bun', [KADAI_CLI, ...entry.argv], { cwd: tmp, stdio: 'pipe', env: REPLAY_ENV });
          } catch (e) {
            actualExit = (e as { status?: number }).status ?? 1;
          }
          if (actualExit !== entry.exit) {
            throw new Error(`[cassette: ${name}] cli call ${i} (${JSON.stringify(entry.argv)}): captured exit ${entry.exit}, replay got ${actualExit}`);
          }
        } else {
          // entry.kind === 'mcp'
          const tool = getTool(entry.tool);
          if (!tool) throw new Error(`[cassette: ${name}] mcp call ${i}: unknown tool "${entry.tool}"`);
          let threw = false;
          try {
            const parsed = tool.inputSchema.parse(entry.args);
            await tool.handler(parsed, { rootDir: tmp });
          } catch (e) {
            threw = true;
            if (entry.ok) {
              throw new Error(`[cassette: ${name}] mcp call ${i} (${entry.tool}): captured ok=true but replay threw: ${(e as Error).message}`);
            }
          }
          if (!threw && !entry.ok) {
            throw new Error(`[cassette: ${name}] mcp call ${i} (${entry.tool}): captured ok=false but replay succeeded`);
          }
        }
      }
      const produced = serializeSpine(tmp);
      const diff = diffSpines(captured, produced);
      if (diff !== null) {
        throw new Error(`cassette "${name}" diverged:\n${diff}`);
      }
      expect(diff).toBeNull();
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60 * 1000);
}
```

Key changes:
- Import the MCP register functions and call them at module load (mirror `src/cli/mcp.ts`)
- Use `parseCassetteLine` to discriminate
- Add the `entry.kind === 'mcp'` branch that dispatches via `tool.handler(parsed, { rootDir: tmp })`

- [ ] **Step 2: Run the replay test**

```bash
cd /home/fintan/repos/kadai
bun test tests/cassette/replay.test.ts 2>&1 | tail -3
bun test 2>&1 | tail -3
bun run typecheck
```

Expected: sentinel test passes (no cassettes yet); full suite green; typecheck clean.

- [ ] **Step 3: Tick the plan checkboxes for Task 3 + commit**

```bash
cd /home/fintan/repos/kadai
git add tests/cassette/replay.test.ts docs/superpowers/plans/2026-05-07-cassette-mcp-recording.md
git commit -m "$(cat <<'EOF'
feat(cassette): replay dispatches MCP entries via in-process handlers [cassette-mcp Task-3]

The replay runner now reads cassette entries via parseCassetteLine
(discriminated on kind), and dispatches each:

- kind: 'cli'  → execFileSync (existing flow)
- kind: 'mcp'  → tool.handler(parsed, {rootDir: tmp}) directly,
                  using the same registry the production MCP server
                  uses. No subprocess, no marshaling — just function
                  call against the validated args.

ok mismatch handling: if captured ok=true and replay throws, the test
fails with a precise diagnostic. Same for the inverse case.

The MCP register functions are called once at module load to populate
the registry — mirrors src/cli/mcp.ts so replay sees the same tool
universe production sees.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Re-record blog-mvp + verify

**Files:**
- Create: `tests/cassettes/blog-mvp/calls.jsonl`
- Create: `tests/cassettes/blog-mvp/spine.snapshot.json`

**Goal:** Run the recorder against real Claude with the wrapper firing MCP tool calls. Verify the cassette now contains `kind: 'mcp'` entries. Verify replay reproduces the spine state.

This task requires `claude` on PATH (5–10 min real model run) and can be deferred to anyone who has it. The plan still ships meaningful work (Tasks 1–3) without this — the replay runner is ready and the MCP recorder works; this just validates end-to-end.

- [ ] **Step 1: Run the recorder**

```bash
cd /home/fintan/repos/kadai
# Delete any stale partial cassette first
rm -rf tests/cassettes/blog-mvp
bun scripts/record-cassette.ts blog-mvp "Use kadai-brainstorming and kadai-writing-plans to plan a small CLI tool that converts Markdown to plaintext. Keep it minimal: one command, one input file, one output file. Don't ask me clarifying questions — make reasonable choices and proceed. After the plan is written, stop."
```

Expect 5–10 minutes, real model spend.

- [ ] **Step 2: Inspect the cassette**

```bash
cd /home/fintan/repos/kadai
wc -l tests/cassettes/blog-mvp/calls.jsonl
head -5 tests/cassettes/blog-mvp/calls.jsonl
# Should now show kind:cli for init plus kind:mcp lines for create_epic, attach_spec, etc.

bun -e 'const lines = require("fs").readFileSync("tests/cassettes/blog-mvp/calls.jsonl", "utf8").trim().split("\n"); const kinds = new Set(); const tools = new Set(); for (const l of lines) { const e = JSON.parse(l); kinds.add(e.kind); if (e.kind === "mcp") tools.add(e.tool); } console.log("kinds:", [...kinds]); console.log("mcp tools used:", [...tools].sort());'
```

Expected output: `kinds: ['cli', 'mcp']`, `mcp tools used:` includes at least `create_epic`, `create_feature`, `create_story`, `create_task`, `attach_spec`, `attach_plan`, `pick_story`.

- [ ] **Step 3: Replay should now actually verify the wrapper**

```bash
cd /home/fintan/repos/kadai
bun test tests/cassette/replay.test.ts
```

Expected: 1 test "cassette: blog-mvp" passes. The replay walks each captured call, applies it to a fresh temp spine, then diffs against the captured snapshot and finds null.

If the replay diverges, the diff output names the spine path that differs. Common reasons:
- Schema drift (a tool's input/output changed since recording — re-record)
- Bug introduced (a recent change broke the wrapper's spine writes — fix it, the cassette is your contract)

- [ ] **Step 4: Run the full suite**

```bash
cd /home/fintan/repos/kadai
bun test 2>&1 | tail -3
bun run typecheck
```

Expected: full suite green, including the new cassette test.

- [ ] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add tests/cassettes/blog-mvp/
git commit -m "$(cat <<'EOF'
test(cassette): first real cassette — blog-mvp wrapper end-to-end [cassette-mcp Task-4]

Recorded via `bun scripts/record-cassette.ts blog-mvp "..."` against
Claude. Captures the kadai-brainstorming + kadai-writing-plans wrapper
firing through MCP tool calls (create_epic, attach_spec, create_story,
create_task, attach_plan, pick_story).

Cassette tier now provides actual coverage of the wrapper end-to-end:
every `bun test` runs the replay against the kadai code as it stands,
diffs the resulting spine vs the captured snapshot, fails on any
divergence. Real Tier 2 — no model calls on replay, full integration
verified.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: Wiki update

**Files:**
- Modify: `docs/wiki/concepts.md`
- Modify: `docs/wiki/troubleshooting.md`

**Goal:** Update the existing cassette content to reflect that cassettes now capture both CLI and MCP calls.

- [ ] **Step 1: Update concepts.md**

In the existing "Test tiers" section, expand the cassette description:

```markdown
### Tier 2 — Cassette

Cassettes are recorded sequences of kadai operations + a snapshot of the resulting `.kadai/` state. Each cassette line is one of:

- `kind: 'cli'` — a `kadai <subcommand>` invocation captured during the recording. Replayed via `execFileSync('bun', [cli, ...argv])`.
- `kind: 'mcp'` — a kadai MCP tool call (e.g., `create_epic`, `attach_spec`) captured from the MCP server during the recording. Replayed via in-process `tool.handler(args, {rootDir: tmp})` against the same handler registry the production server uses.

Replay applies all entries in order to a fresh temp spine, then diffs the resulting `.kadai/` against the captured snapshot. Identical = pass; divergent = fail with a path-by-path diff.

What gets captured:
- All spine-mutating CLI subcommands (init, add, pick, set-status, attach-*, config, sync)
- All spine-mutating MCP tools (`create_*`, `attach_*`, `pick_*`, `unpick`, `set_status`, `record_change`)

What does NOT get captured (filtered by recorder):
- `kadai hook` calls (Claude Code session lifecycle noise)
- `kadai mcp` and `kadai serve` (long-running launches)
- MCP read tools (`list_*`, `get_*`, `search`) — they don't mutate state, so they don't need replay
```

- [ ] **Step 2: Update troubleshooting.md**

In the existing "cassette diverged" entry, mention that the diff might point to either CLI or MCP-driven differences, and that re-recording captures both.

- [ ] **Step 3: Run the full suite + commit**

```bash
cd /home/fintan/repos/kadai
bun test 2>&1 | tail -3
git add docs/wiki/concepts.md docs/wiki/troubleshooting.md
git commit -m "$(cat <<'EOF'
docs(wiki): cassettes capture CLI + MCP operations [cassette-mcp Task-5]

Concepts: expanded the Tier 2 description to cover both kind:cli and
kind:mcp cassette entries with what each captures and how replay
dispatches them. Lists what's filtered (hook noise, server launches,
MCP reads) so users can predict cassette contents.

Troubleshooting: noted that a divergence diff could point to either
the CLI or MCP path; re-record captures both.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan self-review checklist

- [ ] All 5 tasks completed.
- [ ] `bun test` passes (existing 386 + ~9 new from Tasks 1-2 = ~395, plus 1 cassette replay if Task 4 ran).
- [ ] `bun run typecheck` passes.
- [ ] Recording a `claude -p` session that uses kadai-aware-skills wrappers produces a cassette with `kind: 'mcp'` entries (Task 4 verifies this; if deferred, mark as "needs manual recording").
- [ ] Replay correctly handles both `cli` and `mcp` entries.
- [ ] Existing cassettes without `kind` field replay as `cli` (back-compat).
- [ ] Read tools are NOT in cassettes.
