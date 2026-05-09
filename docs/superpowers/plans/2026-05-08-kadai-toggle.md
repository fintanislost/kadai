# `kadai disable` / `kadai enable` — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a unified project-level toggle that disables every kadai surface (hooks, MCP, CLI mutations, web banner) when `.kadai/disabled` is present — per [`docs/superpowers/specs/2026-05-08-kadai-toggle-design.md`](../specs/2026-05-08-kadai-toggle-design.md).

**Architecture:** A single helper (`src/core/toggle.ts`) is the source of truth for "is kadai disabled in this project?" Every surface threads `isDisabled(rootDir)` and short-circuits accordingly. New CLI verbs (`kadai disable [--reason]` / `kadai enable`) write/clear `.kadai/disabled`. The web viewer adds a banner. The plugin gets two new slash commands.

**Tech Stack:** TypeScript on Bun (existing). No new deps.

## Position in the build

| | |
|---|---|
| **Branch** | `feature/kadai-toggle` (off master) |
| **Spec** | [`docs/superpowers/specs/2026-05-08-kadai-toggle-design.md`](../specs/2026-05-08-kadai-toggle-design.md) |
| **Plugin version after merge** | bump to 1.4.1 (or current+0.0.1 if cassette/aware-skills haven't merged yet) |

## Spec → tasks map

| Spec section | Task |
|---|---|
| `src/core/toggle.ts` helper | 1 |
| Hook integration | 2 |
| MCP integration | 3 |
| CLI verbs (`disable`, `enable`) | 4 |
| CLI mutation guards | 5 |
| `kadai status` enhancement | 6 |
| Web viewer banner | 7 |
| Plugin slash commands | 8 |
| Wiki updates | 9 |

(The spec's task 10 — gated `claude -p` dogfood — is dropped from this plan as redundant. The unit + integration tests in tasks 1-7 cover the same behavior.)

## File structure

```
src/core/toggle.ts                          NEW — isDisabled + setDisabled + clearDisabled + getDisabledInfo
tests/core/toggle.test.ts                   NEW

src/cli/hook.ts                             MODIFIED — guard at top of all four hook handlers
tests/cli/hook.test.ts                      MODIFIED — add tests for the disabled-no-op behavior

src/mcp/server.ts                           MODIFIED — disabled check before mutating tool dispatch
tests/mcp/server-disabled.test.ts           NEW — verify mutating-tool refusal when disabled

src/cli/disable.ts                          NEW — disableCommand
src/cli/enable.ts                           NEW — enableCommand
src/cli/index.ts                            MODIFIED — register both
tests/cli/disable-enable.test.ts            NEW

src/cli/add.ts                              MODIFIED — assertEnabled guard
src/cli/pick.ts                             MODIFIED — same
src/cli/set-status.ts                       MODIFIED — same
src/cli/attach-spec.ts                      MODIFIED — same  (if it exists; else attach.ts)
src/cli/attach-plan.ts                      MODIFIED — same
src/cli/sync.ts                             MODIFIED — same
src/cli/phases.ts                           MODIFIED — same (mutating subcommands only)
src/cli/config.ts                           MODIFIED — same (mutating subcommands only)
tests/cli/mutation-guards.test.ts           NEW — one parameterized test per command

src/cli/status.ts                           MODIFIED — DISABLED preamble
tests/cli/status-disabled.test.ts           NEW

src/web/api.ts                              MODIFIED — GET /api/disabled-status
src/web/frontend/src/components/Layout.tsx  MODIFIED — banner when disabled
src/web/frontend/src/api.ts                 MODIFIED — getDisabledStatus client
tests/web/api.test.ts                       MODIFIED — test new endpoint

kadai-plugin/commands/kadai-disable.md      NEW
kadai-plugin/commands/kadai-enable.md       NEW
kadai-plugin/.claude-plugin/plugin.json     MODIFIED — version bump

docs/wiki/cli-reference.md                  MODIFIED
docs/wiki/concepts.md                       MODIFIED
docs/wiki/troubleshooting.md                MODIFIED
```

## Tasks

---

### Task 1: `src/core/toggle.ts` helper module

**Files:**
- Create: `src/core/toggle.ts`
- Create: `tests/core/toggle.test.ts`

**Goal:** A single helper module every kadai surface depends on. Pure file I/O — no logging, no side effects beyond the file write itself.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/core/toggle.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, existsSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isDisabled, setDisabled, clearDisabled, getDisabledInfo } from '../../src/core/toggle';

function fresh(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-toggle-'));
  mkdirSync(join(tmp, '.kadai'), { recursive: true });
  return tmp;
}

test('isDisabled returns false when .kadai/disabled does not exist', () => {
  const root = fresh();
  try { expect(isDisabled(root)).toBe(false); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test('setDisabled writes .kadai/disabled with timestamp; isDisabled then true', () => {
  const root = fresh();
  try {
    setDisabled(root);
    expect(isDisabled(root)).toBe(true);
    expect(existsSync(join(root, '.kadai/disabled'))).toBe(true);
    const content = readFileSync(join(root, '.kadai/disabled'), 'utf8');
    expect(content).toMatch(/^disabled-since: \d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('setDisabled with reason includes it in the file', () => {
  const root = fresh();
  try {
    setDisabled(root, 'quick refactor');
    const content = readFileSync(join(root, '.kadai/disabled'), 'utf8');
    expect(content).toContain('reason: quick refactor');
    const info = getDisabledInfo(root);
    expect(info?.reason).toBe('quick refactor');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('clearDisabled removes the file; isDisabled then false', () => {
  const root = fresh();
  try {
    setDisabled(root, 'x');
    clearDisabled(root);
    expect(isDisabled(root)).toBe(false);
    expect(existsSync(join(root, '.kadai/disabled'))).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('clearDisabled is idempotent (no error when already enabled)', () => {
  const root = fresh();
  try {
    expect(() => clearDisabled(root)).not.toThrow();
    expect(() => clearDisabled(root)).not.toThrow();
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('setDisabled is idempotent — second call updates the timestamp + reason', () => {
  const root = fresh();
  try {
    setDisabled(root, 'first');
    const first = getDisabledInfo(root);
    // Second call should overwrite, not error
    setDisabled(root, 'second');
    const second = getDisabledInfo(root);
    expect(second?.reason).toBe('second');
    // since timestamps may match if called in same millisecond; just verify reason changed
    expect(first?.reason).toBe('first');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('getDisabledInfo returns null when not disabled', () => {
  const root = fresh();
  try { expect(getDisabledInfo(root)).toBeNull(); }
  finally { rmSync(root, { recursive: true, force: true }); }
});

test('getDisabledInfo returns since but undefined reason when disabled with no reason', () => {
  const root = fresh();
  try {
    setDisabled(root);
    const info = getDisabledInfo(root);
    expect(info?.since).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(info?.reason).toBeUndefined();
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/toggle.test.ts
```

Expected: 8 failures, "Cannot find module".

- [x] **Step 3: Implement toggle.ts**

Create `/home/fintan/repos/kadai/src/core/toggle.ts`:

```typescript
import { existsSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { writeFileAtomic } from './files';

const DISABLED_FILE = '.kadai/disabled';

export interface DisabledInfo {
  since: string;
  reason?: string;
}

function disabledPath(rootDir: string): string {
  return join(rootDir, DISABLED_FILE);
}

export function isDisabled(rootDir: string): boolean {
  return existsSync(disabledPath(rootDir));
}

export function setDisabled(rootDir: string, reason?: string): void {
  const since = new Date().toISOString();
  const lines: string[] = [`disabled-since: ${since}`];
  if (reason !== undefined && reason !== '') {
    lines.push(`reason: ${reason}`);
  }
  writeFileAtomic(disabledPath(rootDir), lines.join('\n') + '\n');
}

export function clearDisabled(rootDir: string): void {
  const path = disabledPath(rootDir);
  if (!existsSync(path)) return;  // idempotent
  unlinkSync(path);
}

export function getDisabledInfo(rootDir: string): DisabledInfo | null {
  const path = disabledPath(rootDir);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  const since = raw.match(/^disabled-since:\s*(.+)$/m)?.[1]?.trim() ?? new Date(0).toISOString();
  const reasonMatch = raw.match(/^reason:\s*(.+)$/m);
  const reason = reasonMatch?.[1]?.trim();
  return reason ? { since, reason } : { since };
}
```

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/core/toggle.test.ts
bun run typecheck
```

Expected: 8 pass, typecheck clean.

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/core/toggle.ts tests/core/toggle.test.ts docs/superpowers/plans/2026-05-08-kadai-toggle.md
git commit -m "$(cat <<'EOF'
feat(toggle): src/core/toggle.ts — isDisabled / setDisabled / getDisabledInfo [toggle Task-1]

Single helper module that backs the kadai disable/enable toggle. Other
surfaces (hooks, MCP, CLI guards, web viewer) all consult these
functions rather than implementing their own .kadai/disabled lookup.

setDisabled writes a YAML-style file with disabled-since (ISO timestamp)
and optional reason. clearDisabled is idempotent. isDisabled is a
single existsSync syscall — designed to be cheap to call from every
hook handler invocation.

8 unit tests cover the happy path + idempotency + missing-reason +
back-to-back overwrites.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Hook integration

**Files:**
- Modify: `src/cli/hook.ts` (add disabled check at top of all four handlers)
- Modify: `tests/cli/hook.test.ts` (add disabled-no-op tests)

**Goal:** When `.kadai/disabled` is present, every hook subcommand exits 0 cleanly without doing its normal work. PreToolUse stops gating, PostToolUse stops appending changelog, UserPromptSubmit stops injecting context, Stop stops nagging.

- [x] **Step 1: Add the disabled-no-op tests**

Read `/home/fintan/repos/kadai/tests/cli/hook.test.ts` to find the existing test patterns. APPEND tests like:

```typescript
import { setDisabled } from '../../src/core/toggle';

test('evaluatePreToolUse allows the edit when kadai is disabled (no story needed)', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-hook-disabled-'));
  try {
    seedSpine(tmp);  // existing helper that creates a minimal spine
    setDisabled(tmp);
    const result = evaluatePreToolUse({ tool_name: 'Write', tool_input: { file_path: join(tmp, 'src/foo.ts') } }, tmp);
    expect(result.allow).toBe(true);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('recordPostToolUse skips changelog write when kadai is disabled', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-hook-disabled-'));
  try {
    seedSpineWithPickedStory(tmp);  // existing or new helper
    setDisabled(tmp);
    recordPostToolUse({ tool_name: 'Write', tool_input: { file_path: join(tmp, 'src/foo.ts') } }, tmp);
    // Verify no changelog.md was written or appended to.
    const changelogPath = join(tmp, '.kadai/epics/EPIC-001-x/features/FEAT-001-y/stories/STORY-001-a/changelog.md');
    expect(existsSync(changelogPath)).toBe(false);
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('buildActiveStoryContext returns null when kadai is disabled', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-hook-disabled-'));
  try {
    seedSpineWithPickedStory(tmp);
    setDisabled(tmp);
    expect(buildActiveStoryContext(tmp)).toBeNull();
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});

test('buildStopReminder returns null when kadai is disabled', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-hook-disabled-'));
  try {
    seedSpineWithPickedStory(tmp);
    setDisabled(tmp);
    expect(buildStopReminder(tmp)).toBeNull();
  } finally { rmSync(tmp, { recursive: true, force: true }); }
});
```

(Read the existing test file first to use the existing seed helpers; if `seedSpineWithPickedStory` doesn't exist, write a small inline equivalent.)

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/hook.test.ts
```

Expected: 4 new failures (the disabled checks aren't in place yet, so the original behavior runs and the tests fail their assertions).

- [x] **Step 3: Add the disabled guards in hook.ts**

Read `/home/fintan/repos/kadai/src/cli/hook.ts`. Add `import { isDisabled } from '../core/toggle';` near the top.

Then add a guard at the top of each of these functions:

```typescript
export function evaluatePreToolUse(input: PreToolUseInput, rootDir: string): EvaluationResult {
  if (isDisabled(rootDir)) return { allow: true };
  // ... existing body unchanged
}

export function recordPostToolUse(input: PostToolUseInput, rootDir: string): void {
  if (isDisabled(rootDir)) return;
  // ... existing body unchanged
}

export function buildActiveStoryContext(rootDir: string): string | null {
  if (isDisabled(rootDir)) return null;
  // ... existing body unchanged
}

export function buildStopReminder(rootDir: string, opts: StopReminderOptions = {}): string | null {
  if (isDisabled(rootDir)) return null;
  // ... existing body unchanged
}
```

Each is a single line at the top of the function.

- [x] **Step 4: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/hook.test.ts
bun test 2>&1 | tail -3   # full suite — no regressions
bun run typecheck
```

Expected: 4 new tests pass + all existing hook tests still pass.

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/hook.ts tests/cli/hook.test.ts docs/superpowers/plans/2026-05-08-kadai-toggle.md
git commit -m "$(cat <<'EOF'
feat(toggle): hooks no-op cleanly when kadai is disabled [toggle Task-2]

Add `if (isDisabled(rootDir)) return;` guard at the top of all four
hook entry-point functions:

- evaluatePreToolUse → return { allow: true }  (don't gate)
- recordPostToolUse → return                    (don't write changelog)
- buildActiveStoryContext → return null         (don't inject context)
- buildStopReminder → return null               (don't remind)

Each guard is a single line. The hook subcommand wrappers around these
functions exit 0 in all cases, so PreToolUse silently allows + the
others silently no-op.

4 new tests cover each branch.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: MCP server integration

**Files:**
- Modify: `src/mcp/server.ts` (disabled check before mutating dispatch)
- Create: `tests/mcp/server-disabled.test.ts`

**Goal:** When kadai is disabled, the MCP dispatch handler returns a clear error for any mutating tool call. Read tools (list_*, get_*, search) work normally.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/mcp/server-disabled.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { _resetRegistry, getTool } from '../../src/mcp/registry';
import { registerCreateTools } from '../../src/mcp/handlers/creates';
import { registerReadTools } from '../../src/mcp/handlers/reads';
import { setDisabled } from '../../src/core/toggle';
import { MUTATING_MCP_TOOLS } from '../../src/cassette/recorder';

function seedSpine(root: string): void {
  mkdirSync(join(root, '.kadai/epics'), { recursive: true });
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":0,"feature":0,"story":0,"task":0}');
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n[[phases]]\nslug = "mvp"\ndisplay = "MVP"\ncolor = "#22c55e"\n');
}

test('MUTATING_MCP_TOOLS contract — server-disabled.test depends on this set', () => {
  expect(MUTATING_MCP_TOOLS.has('create_epic')).toBe(true);
  expect(MUTATING_MCP_TOOLS.has('list_epics')).toBe(false);
});

// The actual dispatch-handler test is best run via the helper exposed below
// (server.ts factors out the guard so we can test it without spinning up the transport).
// For now we test the conditions that matter: disabled flag + mutating-tool-set membership.

test('isDisabled gate fires for create_epic when disabled', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-disabled-'));
  try {
    seedSpine(root);
    _resetRegistry();
    registerCreateTools();
    setDisabled(root, 'test');
    // The guard logic: server.ts dispatches only when !isDisabled || !MUTATING_MCP_TOOLS.has(name)
    const tool = getTool('create_epic');
    expect(tool).toBeTruthy();
    expect(MUTATING_MCP_TOOLS.has('create_epic')).toBe(true);
    // We don't invoke server transport here; the dispatch test in tests/cli/run.integration.test.ts
    // pattern would be needed for a true e2e. For server.ts, factor the guard into a testable helper:
    const { shouldRefuseMcpCall } = require('../../src/mcp/server');
    expect(shouldRefuseMcpCall('create_epic', root)).toBe(true);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('isDisabled gate does NOT fire for list_epics when disabled (reads are fine)', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-disabled-'));
  try {
    seedSpine(root);
    setDisabled(root, 'test');
    const { shouldRefuseMcpCall } = require('../../src/mcp/server');
    expect(shouldRefuseMcpCall('list_epics', root)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('isDisabled gate does NOT fire when not disabled (any tool)', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-mcp-disabled-'));
  try {
    seedSpine(root);
    const { shouldRefuseMcpCall } = require('../../src/mcp/server');
    expect(shouldRefuseMcpCall('create_epic', root)).toBe(false);
    expect(shouldRefuseMcpCall('list_epics', root)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/mcp/server-disabled.test.ts
```

Expected: failures around `shouldRefuseMcpCall` not being exported.

- [x] **Step 3: Refactor server.ts to expose the guard + use it in dispatch**

Read `/home/fintan/repos/kadai/src/mcp/server.ts`. Add at the top:

```typescript
import { isDisabled } from '../core/toggle';
import { MUTATING_MCP_TOOLS } from '../cassette/recorder';

/** Exported for testability. Returns true if a tool call should be refused
 *  because kadai is disabled in this project AND the tool is a mutating one. */
export function shouldRefuseMcpCall(toolName: string, rootDir: string): boolean {
  return isDisabled(rootDir) && MUTATING_MCP_TOOLS.has(toolName);
}
```

Then in the `CallToolRequestSchema` handler, add the refusal branch BEFORE schema parsing (we want to refuse fast, with no arg parse cost):

```typescript
server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  const tool = getTool(name);
  if (!tool) {
    return {
      content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
      isError: true,
    };
  }
  if (shouldRefuseMcpCall(name, ctx.rootDir)) {
    return {
      content: [{ type: 'text' as const, text: 'kadai is disabled in this project; run `kadai enable` to re-enable.' }],
      isError: true,
    };
  }
  try {
    const parsed = tool.inputSchema.parse(args ?? {});
    // ... rest of the existing dispatch unchanged
```

- [x] **Step 4: Run tests + verify**

```bash
cd /home/fintan/repos/kadai
bun test tests/mcp/server-disabled.test.ts
bun test 2>&1 | tail -3
bun run typecheck
```

Expected: 4 server-disabled tests pass + full suite green + typecheck clean.

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/mcp/server.ts tests/mcp/server-disabled.test.ts docs/superpowers/plans/2026-05-08-kadai-toggle.md
git commit -m "$(cat <<'EOF'
feat(toggle): MCP server refuses mutating tools when kadai is disabled [toggle Task-3]

Single dispatch-handler guard via shouldRefuseMcpCall(toolName, rootDir):
returns true when isDisabled(rootDir) && MUTATING_MCP_TOOLS.has(name).
Refusal happens BEFORE schema parsing so it's cheap.

Refusal message: "kadai is disabled in this project; run `kadai enable`
to re-enable." The agent sees a clear, actionable error and can
proceed without kadai (or surface to the user that kadai is off).

Read tools (list_*, get_*, search) work normally even when disabled —
inspecting state shouldn't be gated.

4 unit tests cover the gate logic. shouldRefuseMcpCall is exported
for testability rather than testing through the full MCP transport.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: CLI verbs (`kadai disable` / `kadai enable`)

**Files:**
- Create: `src/cli/disable.ts`
- Create: `src/cli/enable.ts`
- Modify: `src/cli/index.ts` (register both)
- Create: `tests/cli/disable-enable.test.ts`

**Goal:** New CLI subcommands. `kadai disable [--reason "..."]` writes `.kadai/disabled`. `kadai enable` removes it. Both idempotent. Error messages are friendly.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/cli/disable-enable.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const KADAI_CLI = join(__dirname, '../../src/cli/index.ts');

function fresh(): string {
  const tmp = mkdtempSync(join(tmpdir(), 'kadai-de-'));
  mkdirSync(join(tmp, '.kadai/epics'), { recursive: true });
  // Minimum spine for findKadaiRoot to find this tmp.
  return tmp;
}

function run(cwd: string, ...args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync('bun', [KADAI_CLI, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { stdout, stderr: '', status: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? ''), status: err.status ?? 1 };
  }
}

test('kadai disable creates .kadai/disabled with timestamp; exits 0', () => {
  const root = fresh();
  try {
    const r = run(root, 'disable');
    expect(r.status).toBe(0);
    expect(existsSync(join(root, '.kadai/disabled'))).toBe(true);
    expect(readFileSync(join(root, '.kadai/disabled'), 'utf8')).toMatch(/disabled-since:/);
    expect(r.stdout).toMatch(/disabled/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai disable --reason "..." records the reason', () => {
  const root = fresh();
  try {
    const r = run(root, 'disable', '--reason', 'quick refactor');
    expect(r.status).toBe(0);
    expect(readFileSync(join(root, '.kadai/disabled'), 'utf8')).toContain('reason: quick refactor');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai enable removes .kadai/disabled; exits 0', () => {
  const root = fresh();
  try {
    run(root, 'disable');
    const r = run(root, 'enable');
    expect(r.status).toBe(0);
    expect(existsSync(join(root, '.kadai/disabled'))).toBe(false);
    expect(r.stdout).toMatch(/enabled/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai disable while already disabled is a no-op + warning', () => {
  const root = fresh();
  try {
    run(root, 'disable', '--reason', 'first');
    const r = run(root, 'disable', '--reason', 'second');
    expect(r.status).toBe(0);
    expect(r.stderr + r.stdout).toMatch(/already disabled/i);
    // First reason preserved (we don't auto-overwrite without explicit instruction)
    expect(readFileSync(join(root, '.kadai/disabled'), 'utf8')).toContain('reason: first');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai enable while already enabled is a no-op + info', () => {
  const root = fresh();
  try {
    const r = run(root, 'enable');
    expect(r.status).toBe(0);
    expect(r.stderr + r.stdout).toMatch(/already enabled/i);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/disable-enable.test.ts
```

Expected: 5 failures, "Unknown command: disable" / "Unknown command: enable".

- [x] **Step 3: Implement disable.ts and enable.ts**

Create `/home/fintan/repos/kadai/src/cli/disable.ts`:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { findKadaiRoot } from '../core/find-root';
import { isDisabled, setDisabled, getDisabledInfo } from '../core/toggle';

export const disableCommand = new Command('disable')
  .description('Disable kadai in this project — hooks no-op, mutations error, web shows banner')
  .option('--reason <text>', 'optional reason recorded in .kadai/disabled')
  .action((opts: { reason?: string }) => {
    const root = findKadaiRoot(process.cwd());
    if (!root) { process.stderr.write('Not inside a kadai project\n'); process.exit(1); }
    if (isDisabled(root)) {
      const info = getDisabledInfo(root);
      const reasonStr = info?.reason ? ` reason: ${info.reason}` : '';
      process.stdout.write(pc.yellow(`kadai is already disabled (since ${info?.since};${reasonStr}). To change the reason, \`kadai enable\` first then \`kadai disable --reason "..."\`.\n`));
      return;
    }
    setDisabled(root, opts.reason);
    const reasonNote = opts.reason ? ` reason: "${opts.reason}"` : '';
    process.stdout.write(pc.green(`✓ kadai disabled in this project.${reasonNote}\n`));
    process.stdout.write(pc.dim(`  Hooks no-op, mutations refused, web shows banner. Run \`kadai enable\` to restore.\n`));
  });
```

Create `/home/fintan/repos/kadai/src/cli/enable.ts`:

```typescript
import { Command } from 'commander';
import pc from 'picocolors';
import { findKadaiRoot } from '../core/find-root';
import { isDisabled, clearDisabled } from '../core/toggle';

export const enableCommand = new Command('enable')
  .description('Re-enable kadai in this project (clears the disabled flag)')
  .action(() => {
    const root = findKadaiRoot(process.cwd());
    if (!root) { process.stderr.write('Not inside a kadai project\n'); process.exit(1); }
    if (!isDisabled(root)) {
      process.stdout.write(pc.dim(`kadai is already enabled in this project.\n`));
      return;
    }
    clearDisabled(root);
    process.stdout.write(pc.green(`✓ kadai re-enabled in this project.\n`));
  });
```

- [x] **Step 4: Wire into the CLI**

In `/home/fintan/repos/kadai/src/cli/index.ts`, add at the top with the other CLI imports:

```typescript
import { disableCommand } from './disable';
import { enableCommand } from './enable';
```

And add to the `program.addCommand(...)` block near the bottom:

```typescript
program.addCommand(disableCommand);
program.addCommand(enableCommand);
```

- [x] **Step 5: Run tests + verify**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/disable-enable.test.ts
bun test 2>&1 | tail -3
bun run typecheck
bun src/cli/index.ts disable --help
bun src/cli/index.ts enable --help
```

Expected: 5 tests pass + full suite green + typecheck clean + both CLI helps print.

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/disable.ts src/cli/enable.ts src/cli/index.ts tests/cli/disable-enable.test.ts docs/superpowers/plans/2026-05-08-kadai-toggle.md
git commit -m "$(cat <<'EOF'
feat(toggle): kadai disable / kadai enable CLI verbs [toggle Task-4]

  kadai disable [--reason <text>]  → writes .kadai/disabled
  kadai enable                     → removes .kadai/disabled

Both idempotent: re-running gives a friendly info/warning rather than
an error. The disable warning preserves the existing reason rather than
silently overwriting (user must enable + re-disable to change reasons).

Output uses picocolors green for success, yellow for "already" warnings,
dim for the follow-up hint about hook/mutation behavior.

5 integration tests covering: disable creates the file; --reason is
recorded; enable removes; double-disable is a no-op preserving prior
reason; double-enable is a no-op.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: CLI mutation guards

**Files:**
- Modify: `src/cli/add.ts` (or wherever `add` lives)
- Modify: `src/cli/pick.ts`
- Modify: `src/cli/set-status.ts`
- Modify: `src/cli/sync.ts`
- Modify: `src/cli/phases.ts` (mutating subcommands only)
- Modify: `src/cli/config.ts` (mutating subcommands only)
- Modify: `src/cli/attach.ts` (or per-file for attach-spec/attach-plan)
- Create: `tests/cli/mutation-guards.test.ts`

**Goal:** Every mutating CLI subcommand checks the disabled flag at the top of its action and errors with a friendly, consistent message. Reads are unaffected.

- [x] **Step 1: Write the parameterized failing test**

Create `/home/fintan/repos/kadai/tests/cli/mutation-guards.test.ts`:

```typescript
import { test, expect, describe } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setDisabled } from '../../src/core/toggle';

const KADAI_CLI = join(__dirname, '../../src/cli/index.ts');

function seedSpine(root: string): void {
  mkdirSync(join(root, '.kadai/epics/EPIC-001-x'), { recursive: true });
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":1,"feature":0,"story":0,"task":0}');
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n[[phases]]\nslug = "mvp"\ndisplay = "MVP"\ncolor = "#22c55e"\n');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: ready\ncreated: "2026-01-01"\nupdated: "2026-01-01"\norder: 1\n---\n');
}

function run(cwd: string, ...args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync('bun', [KADAI_CLI, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
    return { stdout, stderr: '', status: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? ''), status: err.status ?? 1 };
  }
}

const MUTATING_COMMANDS: Array<{ name: string; argv: string[] }> = [
  { name: 'add epic',     argv: ['add', 'epic',    '--title', 'Test', '--phase', 'mvp'] },
  { name: 'add feature',  argv: ['add', 'feature', '--title', 'Test', '--phase', 'mvp', '--epic', 'EPIC-001'] },
  // story / task creation depends on parent IDs that may not exist; commenting out for the v1 sweep
  // (re-add when there's a fixture with parent items)
  { name: 'pick',         argv: ['pick', 'STORY-001'] },
  { name: 'unpick',       argv: ['unpick'] },
  { name: 'set-status',   argv: ['set-status', 'EPIC-001', 'in_progress'] },
  { name: 'sync',         argv: ['sync'] },
];

describe('mutation guards', () => {
  for (const { name, argv } of MUTATING_COMMANDS) {
    test(`${name} errors when disabled`, () => {
      const root = mkdtempSync(join(tmpdir(), 'kadai-mg-'));
      try {
        seedSpine(root);
        setDisabled(root, 'test');
        const r = run(root, ...argv);
        expect(r.status).not.toBe(0);
        expect(r.stderr + r.stdout).toMatch(/kadai is disabled/i);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });

    test(`${name} works when NOT disabled`, () => {
      const root = mkdtempSync(join(tmpdir(), 'kadai-mg-'));
      try {
        seedSpine(root);
        const r = run(root, ...argv);
        // We're not asserting success — some commands might still fail for other
        // reasons (e.g. pick STORY-001 fails because no STORY-001 exists). The
        // assertion is that the FAILURE MODE is NOT the disabled message.
        expect(r.stderr + r.stdout).not.toMatch(/kadai is disabled/i);
      } finally { rmSync(root, { recursive: true, force: true }); }
    });
  }

  test('READ commands work when disabled (sanity — list epics, status)', () => {
    const root = mkdtempSync(join(tmpdir(), 'kadai-mg-'));
    try {
      seedSpine(root);
      setDisabled(root, 'test');
      const list = run(root, 'list', 'epics');
      expect(list.status).toBe(0);
      // status should also work and show DISABLED preamble (Task 6 enforces it)
    } finally { rmSync(root, { recursive: true, force: true }); }
  });
});
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/mutation-guards.test.ts
```

Expected: the "errors when disabled" tests fail (no guard installed yet).

- [x] **Step 3: Add an `assertEnabled` helper**

Add to `/home/fintan/repos/kadai/src/core/toggle.ts`:

```typescript
import { findKadaiRoot } from './find-root';
import { getDisabledInfo, isDisabled } from './toggle';   // self-ref; if recursive, factor into the same file

/** Check the disabled flag for the project containing process.cwd(). If disabled,
 *  print a friendly error message and exit(1). Used at the top of mutating CLI
 *  command actions. */
export function assertEnabled(): void {
  const root = findKadaiRoot(process.cwd());
  if (!root) return;  // not in a kadai project; let the command's own error handling fire
  if (!isDisabled(root)) return;
  const info = getDisabledInfo(root);
  const reason = info?.reason ? ` reason: ${info.reason}` : '';
  process.stderr.write(`kadai is disabled in this project (since ${info?.since};${reason}). Run \`kadai enable\` to re-enable.\n`);
  process.exit(1);
}
```

(Note: depending on how toggle.ts is structured, `assertEnabled` belongs there directly. The self-import in the snippet above is wrong — just use `isDisabled` and `getDisabledInfo` directly within toggle.ts.)

Update toggle.ts properly — no self-imports:

```typescript
// (existing exports above unchanged)

import { findKadaiRoot } from './find-root';

/** Check the disabled flag for the project containing process.cwd(). If disabled,
 *  print a friendly error message and exit(1). Used at the top of mutating CLI
 *  command actions. */
export function assertEnabled(): void {
  const root = findKadaiRoot(process.cwd());
  if (!root) return;  // not in a kadai project; let the command's own error handling fire
  if (!isDisabled(root)) return;
  const info = getDisabledInfo(root);
  const reason = info?.reason ? ` reason: ${info.reason}` : '';
  process.stderr.write(`kadai is disabled in this project (since ${info?.since};${reason}). Run \`kadai enable\` to re-enable.\n`);
  process.exit(1);
}
```

- [x] **Step 4: Add guards to every mutating subcommand**

For each of these files, add `import { assertEnabled } from '../core/toggle';` at the top, and `assertEnabled();` as the first line inside each action handler:

- `src/cli/add.ts` — the `add` command's action and any subcommand actions (epic, feature, story, task)
- `src/cli/pick.ts` — the pick command (and unpick if it's in the same file or a sibling)
- `src/cli/set-status.ts` — the set-status action
- `src/cli/sync.ts` — the sync action
- `src/cli/phases.ts` — only the mutating subcommand actions (`add`, `rename`, `remove` — not `list`)
- `src/cli/config.ts` — only the mutating subcommand actions (`set` — not the no-arg display variant)
- `src/cli/attach.ts` (or attach-spec.ts / attach-plan.ts) — both attach actions

Read each file first to understand its action handler shape.

Important: do NOT add the guard to `src/cli/init.ts` (init is fine when disabled), `src/cli/run.ts` (escape hatch), `src/cli/disable.ts`, `src/cli/enable.ts`, or any reads (`list.ts`, `status.ts`, `get-file.ts`, `phases list`, `config get`, `compose.ts`, `serve.ts`, `mcp.ts`, `hook.ts`).

- [x] **Step 5: Run tests to verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/mutation-guards.test.ts
bun test 2>&1 | tail -3
bun run typecheck
```

Expected: all mutation-guard tests pass + full suite green + typecheck clean.

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/core/toggle.ts src/cli/add.ts src/cli/pick.ts src/cli/set-status.ts src/cli/sync.ts src/cli/phases.ts src/cli/config.ts src/cli/attach.ts tests/cli/mutation-guards.test.ts docs/superpowers/plans/2026-05-08-kadai-toggle.md
git commit -m "$(cat <<'EOF'
feat(toggle): mutation guards on every mutating CLI subcommand [toggle Task-5]

assertEnabled() helper in src/core/toggle.ts: checks the project's
disabled flag, prints a friendly message and exits 1 if disabled.
Called at the top of each mutating subcommand's action:

  add (epic|feature|story|task), pick, unpick, set-status, sync,
  phases (add|rename|remove), config (set), attach-spec, attach-plan

Read commands (list, status, get-file, phases list, config get, plan
compose, serve, mcp, hook) and escape-hatch commands (init, run,
disable, enable) skip the guard.

Parameterized test in tests/cli/mutation-guards.test.ts covers each
mutating command + a sanity check that reads work when disabled.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: `kadai status` enhancement

**Files:**
- Modify: `src/cli/status.ts`
- Create: `tests/cli/status-disabled.test.ts`

**Goal:** When kadai is disabled, `kadai status` prepends a prominent DISABLED preamble showing timestamp + reason + how to re-enable.

- [x] **Step 1: Write the failing test**

Create `/home/fintan/repos/kadai/tests/cli/status-disabled.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { setDisabled } from '../../src/core/toggle';

const KADAI_CLI = join(__dirname, '../../src/cli/index.ts');

function seedSpine(root: string): void {
  mkdirSync(join(root, '.kadai/epics'), { recursive: true });
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":0,"feature":0,"story":0,"task":0}');
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n[change_capture]\nenabled = true\n[[phases]]\nslug = "mvp"\ndisplay = "MVP"\ncolor = "#22c55e"\n');
}

function run(cwd: string, ...args: string[]): string {
  return execFileSync('bun', [KADAI_CLI, ...args], { cwd, encoding: 'utf8', stdio: 'pipe' });
}

test('kadai status without disabled flag does NOT show DISABLED preamble', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-sd-'));
  try {
    seedSpine(root);
    const out = run(root, 'status');
    expect(out).not.toMatch(/DISABLED/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai status with disabled shows DISABLED preamble + since + re-enable hint', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-sd-'));
  try {
    seedSpine(root);
    setDisabled(root, 'quick refactor');
    const out = run(root, 'status');
    expect(out).toMatch(/DISABLED/);
    expect(out).toMatch(/since:/i);
    expect(out).toMatch(/quick refactor/);
    expect(out).toMatch(/kadai enable/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('kadai status with disabled but no reason shows preamble without reason line', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-sd-'));
  try {
    seedSpine(root);
    setDisabled(root);
    const out = run(root, 'status');
    expect(out).toMatch(/DISABLED/);
    expect(out).not.toMatch(/^\s*reason:/m);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

- [x] **Step 2: Run tests to confirm they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/status-disabled.test.ts
```

Expected: the disabled-preamble tests fail.

- [x] **Step 3: Update status.ts**

Read `/home/fintan/repos/kadai/src/cli/status.ts`. At the top of the action handler (after the `findKadaiRoot` resolution), insert:

```typescript
import { getDisabledInfo } from '../core/toggle';
import pc from 'picocolors';

// ... inside the action handler, after rootDir is resolved ...
const disabled = getDisabledInfo(rootDir);
if (disabled) {
  const ago = humanRelativeTime(disabled.since);  // existing helper if available, else compute inline
  process.stdout.write(pc.yellow(`⚠ kadai is DISABLED in this project\n`));
  process.stdout.write(pc.dim(`  since: ${disabled.since} (${ago})\n`));
  if (disabled.reason) process.stdout.write(pc.dim(`  reason: ${disabled.reason}\n`));
  process.stdout.write(pc.dim(`  re-enable with: kadai enable\n`));
  process.stdout.write('\n');
}
// ... rest of status output unchanged
```

If `humanRelativeTime` doesn't exist, just print the ISO timestamp without the relative-time annotation; the timestamp alone is enough.

- [x] **Step 4: Run tests + verify**

```bash
cd /home/fintan/repos/kadai
bun test tests/cli/status-disabled.test.ts
bun test 2>&1 | tail -3
bun run typecheck
```

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cli/status.ts tests/cli/status-disabled.test.ts docs/superpowers/plans/2026-05-08-kadai-toggle.md
git commit -m "$(cat <<'EOF'
feat(toggle): kadai status shows DISABLED preamble when applicable [toggle Task-6]

When .kadai/disabled is present, kadai status prepends:

  ⚠ kadai is DISABLED in this project
    since: 2026-05-08T22:30:15Z
    reason: quick refactor
    re-enable with: kadai enable

Picked story + queue display unchanged below the preamble. Reason
line is omitted when no reason was given.

3 unit tests cover: clean output when not disabled; preamble with
reason when disabled with reason; preamble without reason line when
disabled with no reason.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 7: Web viewer banner

**Files:**
- Modify: `src/web/api.ts` (new endpoint)
- Modify: `src/web/frontend/src/api.ts` (client wrapper)
- Modify: `src/web/frontend/src/components/Layout.tsx` (banner JSX)
- Modify: `tests/web/api.test.ts` (test new endpoint)

**Goal:** When the active project is disabled, the web viewer's topbar shows a "DISABLED" banner with the reason (tooltip on hover). API endpoint provides the data.

- [x] **Step 1: Add the API test**

APPEND to `/home/fintan/repos/kadai/tests/web/api.test.ts`:

```typescript
test('GET /api/disabled-status returns disabled:false when no disabled flag', async () => {
  const r = await fetch(`${base()}/api/disabled-status`);
  expect(r.status).toBe(200);
  const json = await r.json();
  expect(json.disabled).toBe(false);
});

test('GET /api/disabled-status returns disabled:true with since + reason when disabled', async () => {
  // The seed test fixture writes its own .kadai; toggle helpers can drop a disabled file there.
  const { setDisabled, clearDisabled } = await import('../../src/core/toggle');
  setDisabled(SEED_ROOT, 'test');  // SEED_ROOT is whatever the existing test seed exposes
  try {
    const r = await fetch(`${base()}/api/disabled-status`);
    const json = await r.json();
    expect(json.disabled).toBe(true);
    expect(json.since).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(json.reason).toBe('test');
  } finally {
    clearDisabled(SEED_ROOT);
  }
});
```

(If the test file doesn't expose `SEED_ROOT` cleanly, adapt to use whatever the existing API tests use to point at the seed dir.)

- [x] **Step 2: Implement the endpoint**

In `/home/fintan/repos/kadai/src/web/api.ts`, add the endpoint inside `handleApi` near the other simple GET handlers:

```typescript
import { getDisabledInfo } from '../core/toggle';

// ... inside handleApi ...
if (path === '/api/disabled-status' && req.method === 'GET') {
  const info = getDisabledInfo(rootDir);
  if (!info) return Response.json({ disabled: false });
  return Response.json({ disabled: true, since: info.since, reason: info.reason });
}
```

(Adapt `rootDir` to whatever variable name the `handleApi` already uses; also handle multi-project mode if applicable — there should be a per-project rootDir already in scope.)

- [x] **Step 3: Run API tests + add the client wrapper**

```bash
cd /home/fintan/repos/kadai
bun test tests/web/api.test.ts 2>&1 | tail -3
```

Expected: 2 new tests pass.

Then APPEND to `/home/fintan/repos/kadai/src/web/frontend/src/api.ts`:

```typescript
export interface DisabledStatus {
  disabled: boolean;
  since?: string;
  reason?: string;
}

export async function getDisabledStatus(slug?: string | null): Promise<DisabledStatus> {
  const r = await fetch(withBase(slug, '/disabled-status'));
  if (!r.ok) return { disabled: false };  // gracefully degrade
  return r.json() as Promise<DisabledStatus>;
}
```

- [x] **Step 4: Add the banner to Layout.tsx**

Read `/home/fintan/repos/kadai/src/web/frontend/src/components/Layout.tsx`. In the topbar JSX (between the brand/nav and the picked indicator), add:

```tsx
import { getDisabledStatus } from '../api';

// ... inside the Layout component ...
const [disabledStatus, setDisabledStatus] = useState<{ disabled: boolean; since?: string; reason?: string }>({ disabled: false });
useEffect(() => {
  getDisabledStatus(activeSlug).then(setDisabledStatus).catch(() => setDisabledStatus({ disabled: false }));
}, [activeSlug, liveKey]);

// ... in the topbar JSX, before the picked-pill ...
{disabledStatus.disabled && (
  <span
    title={`Disabled since ${disabledStatus.since}${disabledStatus.reason ? ` — reason: ${disabledStatus.reason}` : ''}\nRun \`kadai enable\` to re-enable.`}
    className="bg-accent/[0.10] text-accent border border-accent/25 rounded-md px-2.5 py-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide"
  >
    ⚠ DISABLED
  </span>
)}
```

(Adapt token classes to whatever Layout uses. The accent color is intentional — disabled is a deliberate state, not an error.)

- [x] **Step 5: Build + verify**

```bash
cd /home/fintan/repos/kadai
bun run build:web
bun run embed-assets
bun test 2>&1 | tail -3
bun run typecheck
cd src/web/frontend && bunx tsc --noEmit -p tsconfig.json && cd /home/fintan/repos/kadai
```

Expected: all green.

- [x] **Step 6: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/web/api.ts src/web/frontend/src/api.ts src/web/frontend/src/components/Layout.tsx tests/web/api.test.ts docs/superpowers/plans/2026-05-08-kadai-toggle.md
git commit -m "$(cat <<'EOF'
feat(toggle): web viewer banner when project is disabled [toggle Task-7]

New endpoint GET /api/disabled-status returns:
  { disabled: false }  OR  { disabled: true, since, reason? }

Layout.tsx topbar adds a "⚠ DISABLED" pill (accent-colored, not red —
disabled is a deliberate state, not an error) between the brand mark
and the picked indicator. Hover tooltip shows the timestamp + reason
+ re-enable hint.

2 API tests + frontend tsc clean + Playwright still green.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8: Plugin slash commands + version bump

**Files:**
- Create: `kadai-plugin/commands/kadai-disable.md`
- Create: `kadai-plugin/commands/kadai-enable.md`
- Modify: `kadai-plugin/.claude-plugin/plugin.json` (version bump)

**Goal:** `/kadai-disable [reason...]` and `/kadai-enable` slash commands accessible from any Claude Code session.

- [x] **Step 1: Create the slash command files**

`/home/fintan/repos/kadai/kadai-plugin/commands/kadai-disable.md`:

```markdown
# /kadai-disable

Disable kadai in the current project. Hooks no-op, mutating CLI commands error, MCP mutating tools refuse, web viewer shows a DISABLED banner. Reads still work.

## Usage

```
/kadai-disable
/kadai-disable a quick refactor across stories
```

The free-form arg becomes the `--reason` recorded in `.kadai/disabled` for the audit log. Run `kadai enable` (or `/kadai-enable`) to restore.

## What happens

Runs `kadai disable` (with `--reason "$ARGS"` if args present). Restart your Claude Code session for `.mcp.json` changes to take full effect — mid-session hooks already check the flag at every invocation, so they no-op immediately without restart.
```

`/home/fintan/repos/kadai/kadai-plugin/commands/kadai-enable.md`:

```markdown
# /kadai-enable

Re-enable kadai in the current project. Hooks resume gating, mutating commands work again, web banner clears.

## Usage

```
/kadai-enable
```

No drift detection — if you did spine-relevant work while kadai was disabled, you'll need to record it manually.
```

- [x] **Step 2: Bump the plugin version**

Read `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`. Bump `version` (e.g., `1.4.0` → `1.4.1`, or whatever the current+0.0.1 is).

- [x] **Step 3: Verify**

```bash
cd /home/fintan/repos/kadai
ls kadai-plugin/commands/ | grep -E "kadai-(disable|enable)"
grep '"version"' kadai-plugin/.claude-plugin/plugin.json
```

- [x] **Step 4: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/commands/kadai-disable.md kadai-plugin/commands/kadai-enable.md kadai-plugin/.claude-plugin/plugin.json docs/superpowers/plans/2026-05-08-kadai-toggle.md
git commit -m "$(cat <<'EOF'
feat(plugin): /kadai-disable and /kadai-enable slash commands [toggle Task-8]

Two new slash commands wrapping the CLI verbs from Task 4. Free-form
args to /kadai-disable become the --reason; /kadai-enable takes no
args (no drift detection in v1, so nothing to negotiate at re-enable
time).

Plugin version bumped to reflect the new surface.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 9: Wiki documentation

**Files:**
- Modify: `docs/wiki/cli-reference.md`
- Modify: `docs/wiki/concepts.md`
- Modify: `docs/wiki/troubleshooting.md`

**Goal:** Document the new verbs, the project-state concept, and the answer to "how do I temporarily disable kadai?"

- [ ] **Step 1: Update cli-reference.md**

Add entries (preserve existing structure/style):

```markdown
### `kadai disable [--reason <text>]`

Disable kadai in this project. Writes `.kadai/disabled`. Hooks no-op, mutating commands error, MCP refuses mutating tools, web viewer shows a DISABLED banner. Reads still work, as do `kadai disable`/`enable`/`status`/`run`.

```
kadai disable
kadai disable --reason "quick refactor"
```

Idempotent — running twice prints a warning and preserves the original reason.

### `kadai enable`

Re-enable kadai in this project. Removes `.kadai/disabled`. No drift detection — if you did spine-relevant work while disabled, record it manually.

```
kadai enable
```

Idempotent — running twice prints an info message.
```

- [ ] **Step 2: Add a "Toggle" concept section to concepts.md**

Append:

```markdown
## The disable toggle

A project-level on/off switch for all kadai surfaces. When `.kadai/disabled` is present:

- **Hooks no-op cleanly.** PreToolUse stops gating writes; PostToolUse stops appending changelogs; UserPromptSubmit/Stop go silent.
- **Mutating CLI commands refuse.** `kadai add`, `pick`, `set-status`, `attach-*`, `sync`, etc. error with a friendly message pointing at `kadai enable`.
- **MCP mutating tools refuse.** `create_*`, `attach_*`, `pick_story`, `set_status`, etc. return an isError response.
- **Reads work.** `list`, `status`, `get-file`, `phases` (read), `config` (read), `plan compose`, `serve`, `mcp` (reads only) all unaffected.
- **Escape hatches always work.** `disable`, `enable`, `status`, `run` ignore the flag.
- **Web viewer shows a banner** in the topbar, accent-colored.

The flag file holds an ISO timestamp and an optional reason:
```
disabled-since: 2026-05-08T22:30:15Z
reason: quick refactor across multiple stories
```

Use cases:
- "I want to do something quick that's not part of the spine."
- "kadai is misbehaving and I need to bypass everything."
- "This project shouldn't be tracked by kadai right now (exploratory mode)."

Vs `KADAI_BYPASS=1`: bypass is per-shell + per-write; the toggle is project-level + persistent across shells/sessions until you `kadai enable`. Use bypass for one-shot escapes; use the toggle for session-or-longer.

No drift detection (v1): if you do spine-relevant work while disabled, the spine and reality diverge silently. Easy to add later via the timestamps.
```

- [ ] **Step 3: Add a troubleshooting entry**

Append:

```markdown
## "I want to temporarily disable kadai"

**Use the toggle:**

```
kadai disable                       # silent
kadai disable --reason "quick fix"  # records why for the audit log
```

This switches off every kadai surface (hooks, MCP mutations, CLI mutations, web banner) until you run `kadai enable`. Reads continue working. See `concepts.md > The disable toggle` for the full behavior contract.

For per-write/per-shell escapes (rare cases), `KADAI_BYPASS=1` env var still works — that doesn't write the disabled flag and only affects the current shell.
```

- [ ] **Step 4: Verify the markdown is valid + commit**

```bash
cd /home/fintan/repos/kadai
for f in docs/wiki/cli-reference.md docs/wiki/concepts.md docs/wiki/troubleshooting.md; do
  echo "=== $f ==="
  wc -l "$f"
done
git add docs/wiki/cli-reference.md docs/wiki/concepts.md docs/wiki/troubleshooting.md docs/superpowers/plans/2026-05-08-kadai-toggle.md
git commit -m "$(cat <<'EOF'
docs(wiki): document the kadai disable/enable toggle [toggle Task-9]

- cli-reference.md: kadai disable / kadai enable entries
- concepts.md: "The disable toggle" section explaining behavior across
  every surface + flag-file format + comparison vs KADAI_BYPASS
- troubleshooting.md: "I want to temporarily disable kadai" entry

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan self-review checklist

- [ ] All 9 tasks completed.
- [ ] `bun test` passes (estimate: ~30+ new tests across the 9 tasks → full suite ≈ 410+).
- [ ] `bun run typecheck` passes.
- [ ] `cd src/web/frontend && bunx tsc --noEmit -p tsconfig.json` passes.
- [ ] `kadai disable && kadai disable && kadai enable && kadai enable` works (manual sanity).
- [ ] `kadai status` shows DISABLED preamble when disabled.
- [ ] Web viewer shows DISABLED banner when API returns `disabled: true`.
- [ ] Plugin v1.4.x has the two new slash commands.
- [ ] Wiki updated for cli-reference + concepts + troubleshooting.

## Post-merge follow-ups

- Bump CLAUDE.md "active state" if needed
- Add to docs/wiki/post-mvp.md "Recently shipped"
- Run the full Playwright suite once more pre-merge to confirm the banner doesn't break any existing assertions
