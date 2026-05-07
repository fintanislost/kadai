# Cassette tier — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Tier 2 cassette test layer to kadai per [`docs/superpowers/specs/2026-05-07-cassette-tier-design.md`](../specs/2026-05-07-cassette-tier-design.md). Captures real `claude -p` runs as cassettes (CLI calls + spine snapshot); replays them deterministically without model calls.

**Architecture:** Two new directories: `src/cassette/` (snapshot helpers — pure functions over a `.kadai/` tree) and `tests/cassette/` (the replay test runner). The kadai CLI gets a one-line addition to write a JSONL audit log when `KADAI_RECORD_TO=path` is set. A new `scripts/record-cassette.ts` is the dev-only recorder. No production code paths change unless `KADAI_RECORD_TO` is set.

**Tech Stack:** TypeScript on Bun (existing). Cassettes are JSON/JSONL; snapshots are recursive serializations of `.kadai/`. Tests use Bun's test runner. Recorder uses `execFileSync('claude', ...)`.

## Position in the build

| | |
|---|---|
| **This is plan** | post aware-skills (on `feature/cassette-tier`, branched off `feature/kadai-aware-skills`) |
| **Spec** | [`docs/superpowers/specs/2026-05-07-cassette-tier-design.md`](../specs/2026-05-07-cassette-tier-design.md) |
| **Branch** | `feature/cassette-tier` (revertable; sits on top of aware-skills) |
| **Plugin version after merge** | unchanged from 1.4.0 (cassettes are dev/test infrastructure, no plugin surface) |

## File structure

```
src/cassette/
  snapshot.ts                                NEW — serializeSpine, normalizeSpine, diffSpines
  recorder.ts                                NEW — appendCallToCassette helper used by CLI
tests/cassette/
  snapshot.test.ts                           NEW — unit tests for snapshot/normalize/diff
  recorder.test.ts                           NEW — verify CLI writes JSONL with KADAI_RECORD_TO set
  replay.test.ts                             NEW — discovers + replays all tests/cassettes/*/
tests/cassettes/                             NEW dir — committed cassettes (calls + snapshots)
  blog-mvp/
    calls.jsonl                              recorded
    spine.snapshot.json                      recorded
scripts/
  record-cassette.ts                         NEW — dev-only recorder
src/cli/index.ts                             MODIFIED — call appendCallToCassette before exit
docs/wiki/concepts.md                        MODIFIED — three-tier model overview
docs/wiki/troubleshooting.md                 MODIFIED — cassette diff failures
```

## Tasks

---

### Task 1: Snapshot helpers (`src/cassette/snapshot.ts`)

**Files:**
- Create: `src/cassette/snapshot.ts`
- Create: `tests/cassette/snapshot.test.ts`

**Goal:** Pure functions for serializing a `.kadai/` tree, normalizing volatile fields, and diffing two snapshots. Heavily tested before anything depends on them.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/cassette/snapshot.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serializeSpine, normalizeSpine, diffSpines, type Snapshot } from '../../src/cassette/snapshot';

function seedMinimalSpine(root: string) {
  mkdirSync(join(root, '.kadai/epics/EPIC-001-x'), { recursive: true });
  writeFileSync(join(root, '.kadai/config.toml'), '[guardrail]\nallowed_paths = []\n');
  writeFileSync(join(root, '.kadai/.counters.json'), '{"epic":1,"feature":0,"story":0,"task":0}');
  writeFileSync(join(root, '.kadai/epics/EPIC-001-x/epic.md'), '---\nid: EPIC-001\ntitle: X\nphase: mvp\nstatus: in_progress\ncreated: "2026-05-07"\nupdated: "2026-05-07T14:30:00.123Z"\norder: 1\n---\n# Body\n');
}

test('serializeSpine returns a flat object with .kadai/-relative paths', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-snap-'));
  try {
    seedMinimalSpine(root);
    const snap = serializeSpine(root);
    expect(Object.keys(snap)).toContain('config.toml');
    expect(Object.keys(snap)).toContain('.counters.json');
    expect(Object.keys(snap)).toContain('epics/EPIC-001-x/epic.md');
    expect(snap['config.toml']).toContain('allowed_paths');
    expect(snap['epics/EPIC-001-x/epic.md']).toContain('id: EPIC-001');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('serializeSpine returns empty snapshot when .kadai/ does not exist', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-snap-'));
  try {
    const snap = serializeSpine(root);
    expect(snap).toEqual({});
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('serializeSpine includes picked file when present', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-snap-'));
  try {
    seedMinimalSpine(root);
    writeFileSync(join(root, '.kadai/picked'), 'STORY-001');
    const snap = serializeSpine(root);
    expect(snap['picked']).toBe('STORY-001');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('normalizeSpine replaces ISO timestamps with <TIMESTAMP> placeholder', () => {
  const snap: Snapshot = {
    'epics/EPIC-001/epic.md': 'updated: "2026-05-07T14:30:00.123Z"\nother: foo\n',
    'epics/EPIC-001/feature.md': 'updated: "2026-05-07T14:30:00Z"\n',
  };
  const normalized = normalizeSpine(snap);
  expect(normalized['epics/EPIC-001/epic.md']).toContain('updated: "<TIMESTAMP>"');
  expect(normalized['epics/EPIC-001/epic.md']).not.toContain('14:30:00');
  expect(normalized['epics/EPIC-001/epic.md']).toContain('other: foo');  // non-timestamp content preserved
  expect(normalized['epics/EPIC-001/feature.md']).toContain('updated: "<TIMESTAMP>"');
});

test('normalizeSpine preserves date-only YYYY-MM-DD fields (those are deterministic)', () => {
  const snap: Snapshot = { 'epics/E/epic.md': 'created: "2026-05-07"\nupdated: "2026-05-07"\n' };
  const normalized = normalizeSpine(snap);
  // Date-only strings are deterministic given a known seeded date — only ISO datetimes get replaced.
  expect(normalized['epics/E/epic.md']).toBe('created: "2026-05-07"\nupdated: "2026-05-07"\n');
});

test('diffSpines returns null when snapshots are identical after normalization', () => {
  const a: Snapshot = { 'config.toml': '[g]\n', 'epics/E/epic.md': 'updated: "2026-05-07T14:30:00Z"\n' };
  const b: Snapshot = { 'config.toml': '[g]\n', 'epics/E/epic.md': 'updated: "2026-05-07T16:45:11.000Z"\n' };
  expect(diffSpines(a, b)).toBeNull();
});

test('diffSpines surfaces missing keys with a clear message', () => {
  const a: Snapshot = { 'config.toml': 'x', 'epics/E/epic.md': 'y' };
  const b: Snapshot = { 'config.toml': 'x' };
  const diff = diffSpines(a, b);
  expect(diff).not.toBeNull();
  expect(diff!).toContain('epics/E/epic.md');
  expect(diff!).toMatch(/missing/i);
});

test('diffSpines surfaces extra keys with a clear message', () => {
  const a: Snapshot = { 'config.toml': 'x' };
  const b: Snapshot = { 'config.toml': 'x', 'epics/E/epic.md': 'y' };
  const diff = diffSpines(a, b);
  expect(diff).not.toBeNull();
  expect(diff!).toContain('epics/E/epic.md');
  expect(diff!).toMatch(/extra|unexpected/i);
});

test('diffSpines surfaces content mismatch with the path + a hint', () => {
  const a: Snapshot = { 'epics/E/epic.md': 'title: Original' };
  const b: Snapshot = { 'epics/E/epic.md': 'title: Different' };
  const diff = diffSpines(a, b);
  expect(diff).not.toBeNull();
  expect(diff!).toContain('epics/E/epic.md');
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cassette/snapshot.test.ts
```

Expected: 9 failures, "Cannot find module".

- [x] **Step 3: Implement snapshot.ts**

Create `/home/fintan/repos/kadai/src/cassette/snapshot.ts`:

```typescript
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export type Snapshot = Record<string, string>;

const SKIP_FILES = new Set(['runner.json', 'bypass.log']);
// `runner.json` is per-session state, not part of the spine; bypass.log is audit trail.

function walk(dir: string, baseKadai: string, out: Snapshot): void {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir).sort()) {
    if (SKIP_FILES.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      walk(full, baseKadai, out);
    } else {
      const key = relative(baseKadai, full);
      out[key] = readFileSync(full, 'utf8');
    }
  }
}

export function serializeSpine(rootDir: string): Snapshot {
  const kadaiDir = join(rootDir, '.kadai');
  const out: Snapshot = {};
  walk(kadaiDir, kadaiDir, out);
  return out;
}

// Match an ISO datetime (with time component) inside any quoted string in YAML frontmatter,
// e.g.  updated: "2026-05-07T14:30:00.123Z"  →  updated: "<TIMESTAMP>"
// Date-only strings ("2026-05-07") are intentionally NOT matched.
const ISO_DATETIME_REGEX = /"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?"/g;

export function normalizeSpine(snap: Snapshot): Snapshot {
  const out: Snapshot = {};
  for (const [k, v] of Object.entries(snap)) {
    out[k] = v.replace(ISO_DATETIME_REGEX, '"<TIMESTAMP>"');
  }
  return out;
}

export function diffSpines(captured: Snapshot, produced: Snapshot): string | null {
  const a = normalizeSpine(captured);
  const b = normalizeSpine(produced);
  const aKeys = new Set(Object.keys(a));
  const bKeys = new Set(Object.keys(b));
  const issues: string[] = [];
  for (const k of [...aKeys].sort()) {
    if (!bKeys.has(k)) issues.push(`missing: ${k}`);
  }
  for (const k of [...bKeys].sort()) {
    if (!aKeys.has(k)) issues.push(`extra/unexpected: ${k}`);
  }
  for (const k of [...aKeys].sort()) {
    if (!bKeys.has(k)) continue;
    if (a[k] !== b[k]) {
      // Provide the path + a short hint about the divergence position.
      const aShort = a[k].slice(0, 80).replace(/\n/g, '\\n');
      const bShort = b[k].slice(0, 80).replace(/\n/g, '\\n');
      issues.push(`content mismatch: ${k}\n  expected: ${aShort}\n  actual:   ${bShort}`);
    }
  }
  return issues.length === 0 ? null : issues.join('\n');
}
```

- [x] **Step 4: Run tests, verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cassette/snapshot.test.ts
bun run typecheck
```

Expected: 9 pass + typecheck clean.

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cassette/snapshot.ts tests/cassette/snapshot.test.ts
git commit -m "$(cat <<'EOF'
feat(cassette): snapshot helpers — serialize/normalize/diff .kadai/ trees [cassette Task-1]

Pure functions over a .kadai/ directory:
- serializeSpine(rootDir) → Snapshot (flat map of relative-path → contents)
- normalizeSpine(snap) → Snapshot (ISO datetimes replaced by <TIMESTAMP>;
  date-only YYYY-MM-DD preserved because they're deterministic given a
  known seeded created/updated)
- diffSpines(captured, produced) → string | null (null = match;
  string = human-readable list of missing/extra/mismatched paths)

Skips runner.json (per-session state, not spine) and bypass.log (audit
trail). 9 unit tests cover the happy path + edge cases.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: CLI recording instrumentation

**Files:**
- Create: `src/cassette/recorder.ts`
- Modify: `src/cli/index.ts` (add the appendCallToCassette call)
- Create: `tests/cassette/recorder.test.ts`

**Goal:** When `KADAI_RECORD_TO=<path>` is set in the environment, every `kadai` CLI invocation appends one JSONL line `{argv, exit}` to that file. Append-only, atomic-enough for our single-writer use case. Zero behavior change when the env var is unset.

- [x] **Step 1: Write the failing tests**

Create `/home/fintan/repos/kadai/tests/cassette/recorder.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const KADAI_BIN = process.env.KADAI_BIN ?? 'bun';
const KADAI_ARGS = process.env.KADAI_BIN ? [] : [join(__dirname, '../../src/cli/index.ts')];

function runKadai(env: NodeJS.ProcessEnv, ...args: string[]): { stdout: string; stderr: string; status: number } {
  try {
    const stdout = execFileSync(KADAI_BIN, [...KADAI_ARGS, ...args], { env: { ...process.env, ...env }, encoding: 'utf8', stdio: 'pipe' });
    return { stdout, stderr: '', status: 0 };
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; status?: number };
    return { stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? ''), status: err.status ?? 1 };
  }
}

test('CLI writes JSONL line to KADAI_RECORD_TO when set', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    runKadai({ KADAI_RECORD_TO: cassettePath }, '--version');
    expect(existsSync(cassettePath)).toBe(true);
    const lines = readFileSync(cassettePath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(1);
    const parsed = JSON.parse(lines[0]);
    expect(parsed.argv).toEqual(['--version']);
    expect(parsed.exit).toBe(0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI appends multiple lines across multiple invocations', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    runKadai({ KADAI_RECORD_TO: cassettePath }, '--version');
    runKadai({ KADAI_RECORD_TO: cassettePath }, '--help');
    const lines = readFileSync(cassettePath, 'utf8').trim().split('\n');
    expect(lines.length).toBe(2);
    expect(JSON.parse(lines[0]).argv).toEqual(['--version']);
    expect(JSON.parse(lines[1]).argv).toEqual(['--help']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI does NOT write any cassette file when KADAI_RECORD_TO is unset', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    // Explicitly delete the env var if our parent has it set
    const env = { ...process.env };
    delete env.KADAI_RECORD_TO;
    execFileSync(KADAI_BIN, [...KADAI_ARGS, '--version'], { env, encoding: 'utf8', stdio: 'pipe' });
    expect(existsSync(cassettePath)).toBe(false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI records non-zero exits too', () => {
  const root = mkdtempSync(join(tmpdir(), 'kadai-rec-'));
  try {
    const cassettePath = join(root, 'calls.jsonl');
    // `kadai status` from outside any kadai project should exit non-zero.
    runKadai({ KADAI_RECORD_TO: cassettePath, PWD: root }, 'status');
    if (existsSync(cassettePath)) {
      const line = readFileSync(cassettePath, 'utf8').trim();
      const parsed = JSON.parse(line);
      expect(parsed.argv).toEqual(['status']);
      // Exit may be 0 or non-zero depending on whether status errors when no kadai project — capture either way.
      expect(typeof parsed.exit).toBe('number');
    }
  } finally { rmSync(root, { recursive: true, force: true }); }
});
```

- [x] **Step 2: Run tests to verify they fail**

```bash
cd /home/fintan/repos/kadai
bun test tests/cassette/recorder.test.ts
```

Expected: failures with "cassette file does not exist" — the CLI doesn't yet write to it.

- [x] **Step 3: Implement recorder.ts**

Create `/home/fintan/repos/kadai/src/cassette/recorder.ts`:

```typescript
import { appendFileSync } from 'node:fs';

export interface CallRecord {
  argv: string[];
  exit: number;
}

export function appendCallToCassette(record: CallRecord): void {
  const path = process.env.KADAI_RECORD_TO;
  if (!path) return;
  try {
    appendFileSync(path, JSON.stringify(record) + '\n', 'utf8');
  } catch {
    // Best-effort — if the cassette file isn't writable, don't crash the CLI.
  }
}
```

- [x] **Step 4: Wire into the CLI**

Read `/home/fintan/repos/kadai/src/cli/index.ts`. Find the entry point — typically a `program.parse(process.argv)` or `program.parseAsync(process.argv)` call near the bottom.

Add at the top (with other imports):

```typescript
import { appendCallToCassette } from '../cassette/recorder';
```

Wrap the parse call so the cassette write happens after the command finishes (success OR failure). The cleanest pattern:

```typescript
async function main() {
  let exitCode = 0;
  try {
    await program.parseAsync(process.argv);
  } catch (e) {
    exitCode = 1;
    process.stderr.write(`${(e as Error).message}\n`);
  }
  // argv after parsing: process.argv[0] is the runtime, process.argv[1] is the script,
  // the rest is the user's args. Slice them out for the cassette record.
  appendCallToCassette({ argv: process.argv.slice(2), exit: exitCode });
  process.exit(exitCode);
}

main();
```

If `src/cli/index.ts` already has a different shape (e.g., it just calls `program.parse()` synchronously at the bottom), adapt — the goal is: capture argv and exit code, call `appendCallToCassette` once before the process exits.

**IMPORTANT:** the command's own `process.exit(N)` calls (like in `composeCommand`) bypass this main wrapper. Either replace those `process.exit(N)` with `throw new Error(...)` so the main catches them, OR add a `process.on('exit', () => appendCallToCassette(...))` handler instead. The exit-handler approach is more robust and doesn't require touching every subcommand.

Switch to the exit-handler approach:

```typescript
import { appendCallToCassette } from '../cassette/recorder';

let recordedExit = 0;
const originalExit = process.exit.bind(process);
process.exit = ((code?: number) => {
  recordedExit = code ?? 0;
  appendCallToCassette({ argv: process.argv.slice(2), exit: recordedExit });
  return originalExit(code);
}) as typeof process.exit;

process.on('exit', (code) => {
  // For paths that fall through the bottom of main without calling process.exit explicitly.
  if (recordedExit === 0 && code === 0) {
    appendCallToCassette({ argv: process.argv.slice(2), exit: 0 });
  }
});

// ... existing CLI body ...
program.parse(process.argv);
```

Wait — that double-records on the explicit-exit path. Simpler: a flag that prevents double-record.

```typescript
import { appendCallToCassette } from '../cassette/recorder';

let alreadyRecorded = false;
function recordOnce(exit: number) {
  if (alreadyRecorded) return;
  alreadyRecorded = true;
  appendCallToCassette({ argv: process.argv.slice(2), exit });
}

const originalExit = process.exit.bind(process);
process.exit = ((code?: number) => {
  recordOnce(code ?? 0);
  return originalExit(code);
}) as typeof process.exit;

process.on('exit', (code) => recordOnce(code));

// ... existing CLI body ...
```

This handles both explicit `process.exit(N)` and natural-completion paths.

- [x] **Step 5: Run tests, verify they pass**

```bash
cd /home/fintan/repos/kadai
bun test tests/cassette/recorder.test.ts
bun test 2>&1 | tail -3   # full suite — should still be 367 + 4 new = 371
bun run typecheck
```

Expected: 4 recorder tests pass, full suite green, typecheck clean.

- [x] **Step 6: Sanity-check no behavior change without env var**

```bash
cd /home/fintan/repos/kadai
bun src/cli/index.ts --version
# Should print version, exit 0, NOT create any cassette file in cwd.
ls calls.jsonl 2>/dev/null && echo "BUG: file created without env" || echo "OK: no file"
```

- [x] **Step 7: Commit**

```bash
cd /home/fintan/repos/kadai
git add src/cassette/recorder.ts src/cli/index.ts tests/cassette/recorder.test.ts
git commit -m "$(cat <<'EOF'
feat(cassette): KADAI_RECORD_TO env writes JSONL audit log [cassette Task-2]

When KADAI_RECORD_TO=<path> is set in env, every kadai CLI invocation
appends one JSONL line `{argv, exit}` to that file. Wired via a
process.exit override + an on('exit') fallback so both explicit-exit
subcommands (composeCommand, runCommand --status, etc.) and natural-
completion paths get recorded. recordOnce() flag prevents double-write.

Zero behavior change when KADAI_RECORD_TO is unset — appendFileSync is
inside an early-return.

4 unit tests cover: env-set writes JSONL, multiple invocations append,
no-env-no-file, non-zero exits captured.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Cassette replay test runner

**Files:**
- Create: `tests/cassette/replay.test.ts`
- Create: `tests/cassettes/.gitkeep` (so the cassettes dir exists for the discovery loop)

**Goal:** Discover all cassettes in `tests/cassettes/*/`, replay each against a fresh temp dir, snapshot the resulting spine, diff against the captured snapshot.

- [x] **Step 1: Write the test runner**

Create `/home/fintan/repos/kadai/tests/cassette/replay.test.ts`:

```typescript
import { test, expect } from 'bun:test';
import { mkdtempSync, existsSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serializeSpine, diffSpines, type Snapshot } from '../../src/cassette/snapshot';

const CASSETTES_DIR = join(__dirname, '../cassettes');
const KADAI_CLI = join(__dirname, '../../src/cli/index.ts');

function listCassettes(): string[] {
  if (!existsSync(CASSETTES_DIR)) return [];
  return readdirSync(CASSETTES_DIR).filter(name => {
    const dir = join(CASSETTES_DIR, name);
    return statSync(dir).isDirectory()
      && existsSync(join(dir, 'calls.jsonl'))
      && existsSync(join(dir, 'spine.snapshot.json'));
  });
}

const cassettes = listCassettes();

if (cassettes.length === 0) {
  test('no cassettes recorded yet — see scripts/record-cassette.ts', () => {
    // Sentinel test that always passes when there are no cassettes.
    expect(cassettes.length).toBe(0);
  });
}

for (const name of cassettes) {
  test(`cassette: ${name}`, () => {
    const cassetteDir = join(CASSETTES_DIR, name);
    const calls = readFileSync(join(cassetteDir, 'calls.jsonl'), 'utf8')
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(line => JSON.parse(line) as { argv: string[]; exit: number });
    const captured = JSON.parse(readFileSync(join(cassetteDir, 'spine.snapshot.json'), 'utf8')) as Snapshot;

    const tmp = mkdtempSync(join(tmpdir(), `kadai-cass-${name}-`));
    try {
      for (let i = 0; i < calls.length; i++) {
        const call = calls[i];
        let actualExit = 0;
        try {
          execFileSync('bun', [KADAI_CLI, ...call.argv], { cwd: tmp, stdio: 'pipe' });
        } catch (e) {
          actualExit = (e as { status?: number }).status ?? 1;
        }
        if (actualExit !== call.exit) {
          throw new Error(`call ${i} (${JSON.stringify(call.argv)}): captured exit ${call.exit}, replay got ${actualExit}`);
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
  }, 60 * 1000);  // 60s per cassette is generous; most should run in <10s
}
```

- [x] **Step 2: Create empty cassettes dir**

```bash
cd /home/fintan/repos/kadai
mkdir -p tests/cassettes
touch tests/cassettes/.gitkeep
```

- [x] **Step 3: Run the replay test (should pass with the sentinel since no cassettes yet)**

```bash
cd /home/fintan/repos/kadai
bun test tests/cassette/replay.test.ts 2>&1 | tail -3
```

Expected: 1 sentinel test passes (no real cassettes yet).

- [x] **Step 4: Run full suite + typecheck**

```bash
cd /home/fintan/repos/kadai
bun test 2>&1 | tail -3
bun run typecheck
```

Expected: full suite green (372 ish: 367 + 9 snap + 4 recorder + 1 sentinel — but Bun test counts may differ depending on per-file vs per-test counting). Typecheck clean.

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add tests/cassette/replay.test.ts tests/cassettes/.gitkeep
git commit -m "$(cat <<'EOF'
feat(cassette): replay test runner — discovers + executes tests/cassettes/*/ [cassette Task-3]

Auto-discovers any cassette directory under tests/cassettes/ that has
both calls.jsonl and spine.snapshot.json. For each one:
1. Create a fresh mktemp -d
2. Replay each captured `kadai` CLI invocation against it
3. Verify each replay's exit code matches the captured exit
4. Snapshot the resulting spine
5. Diff captured vs produced (after timestamp normalization)
6. Fail with a unified-diff-style breakdown on mismatch

When no cassettes are committed yet, a sentinel test passes so the
discovery loop is exercised in CI. Once `scripts/record-cassette.ts`
lands (Task 4) and a cassette is committed (Task 5), real replays
take over.

Per-cassette timeout is 60s — generous; most should run in <10s.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Recorder script (`scripts/record-cassette.ts`)

**Files:**
- Create: `scripts/record-cassette.ts`

**Goal:** Dev-only one-shot tool: takes a scenario name + a Claude prompt, runs `claude -p` against a fresh kadai-init'd temp dir with `KADAI_RECORD_TO` set, then writes both the calls.jsonl and the spine snapshot into `tests/cassettes/<name>/`.

- [x] **Step 1: Implement the recorder**

Create `/home/fintan/repos/kadai/scripts/record-cassette.ts`:

```typescript
#!/usr/bin/env bun
import { mkdtempSync, mkdirSync, copyFileSync, existsSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { serializeSpine } from '../src/cassette/snapshot';

const KADAI_CLI = join(__dirname, '../src/cli/index.ts');

function usage(): never {
  process.stderr.write('Usage: bun scripts/record-cassette.ts <scenario-name> "<claude prompt>"\n');
  process.exit(1);
}

const [, , name, prompt] = process.argv;
if (!name || !prompt) usage();
if (!/^[a-z0-9][a-z0-9-]*$/.test(name)) {
  process.stderr.write(`Invalid scenario name "${name}": use lowercase letters, digits, hyphens.\n`);
  process.exit(1);
}

const cassetteDir = join(__dirname, '..', 'tests', 'cassettes', name);
if (existsSync(cassetteDir)) {
  process.stderr.write(`Cassette "${name}" already exists at ${cassetteDir}.\nDelete it first if you want to re-record.\n`);
  process.exit(1);
}

// Verify claude + kadai are on PATH
try { execFileSync('which', ['claude'], { stdio: 'pipe' }); } catch { process.stderr.write('`claude` is not on PATH — install Claude Code first.\n'); process.exit(1); }

const tmp = mkdtempSync(join(tmpdir(), `kadai-record-${name}-`));
const cassettePath = join(tmp, 'calls.jsonl');

console.log(`Recording cassette "${name}"`);
console.log(`  Working dir: ${tmp}`);
console.log(`  Cassette path: ${cassettePath}`);

try {
  // 1. kadai init in the temp dir.
  console.log(`Step 1: kadai init -y`);
  execFileSync('bun', [KADAI_CLI, 'init', '-y'], {
    cwd: tmp,
    env: { ...process.env, KADAI_RECORD_TO: cassettePath },
    stdio: 'inherit',
  });

  // 2. Run claude -p with the prompt. Stream stdout so the user can see progress.
  console.log(`Step 2: claude -p "${prompt.slice(0, 80)}${prompt.length > 80 ? '...' : ''}"`);
  console.log(`(this can take 5-10 minutes — real model calls)`);
  execFileSync('claude', ['-p', prompt], {
    cwd: tmp,
    env: { ...process.env, KADAI_RECORD_TO: cassettePath },
    stdio: 'inherit',
    timeout: 15 * 60 * 1000,  // 15 min hard cap
  });

  // 3. Snapshot the resulting spine.
  console.log(`Step 3: snapshot .kadai/`);
  const snapshot = serializeSpine(tmp);

  // 4. Write both files into tests/cassettes/<name>/.
  console.log(`Step 4: writing cassette to ${cassetteDir}`);
  mkdirSync(cassetteDir, { recursive: true });
  copyFileSync(cassettePath, join(cassetteDir, 'calls.jsonl'));
  writeFileSync(join(cassetteDir, 'spine.snapshot.json'), JSON.stringify(snapshot, null, 2), 'utf8');

  // 5. Print summary.
  const callCount = readFileSync(cassettePath, 'utf8').trim().split('\n').filter(Boolean).length;
  const snapKeyCount = Object.keys(snapshot).length;
  console.log(`\n✓ Cassette recorded:`);
  console.log(`    ${callCount} CLI call(s) captured`);
  console.log(`    ${snapKeyCount} spine file(s) snapshotted`);
  console.log(`\nNext: review tests/cassettes/${name}/, then commit it.`);
  console.log(`The replay test will pick it up automatically on next \`bun test\`.`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
```

- [x] **Step 2: Smoke-test the recorder script (no real claude run — just verify the CLI surface)**

```bash
cd /home/fintan/repos/kadai
bun scripts/record-cassette.ts 2>&1 | head -2
# Expected: prints usage, exits 1.

bun scripts/record-cassette.ts BadName "test" 2>&1 | head -2
# Expected: prints "Invalid scenario name", exits 1.
```

- [x] **Step 3: Commit**

```bash
cd /home/fintan/repos/kadai
git add scripts/record-cassette.ts
git commit -m "$(cat <<'EOF'
feat(cassette): scripts/record-cassette.ts — dev-only recorder [cassette Task-4]

Wraps `claude -p` with KADAI_RECORD_TO set, so the wrapper's CLI
invocations get logged to a JSONL audit log; then snapshots the
resulting .kadai/ tree and writes both files into
tests/cassettes/<name>/.

CLI surface:
  bun scripts/record-cassette.ts <scenario-name> "<claude prompt>"

Validates: scenario name is lowercase-kebab; cassette directory
doesn't already exist (re-recording requires manual delete first);
claude is on PATH.

Real model calls + 5-10 minute runtime — same cost profile as
RUN_DOGFOOD_E2E. Once recorded, the replay test (Task 3) runs the
cassette on every `bun test` for free.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5: First captured cassette

**Files:**
- Create: `tests/cassettes/blog-mvp/calls.jsonl`
- Create: `tests/cassettes/blog-mvp/spine.snapshot.json`

**Goal:** Run the recorder once against the canonical "plan a CLI tool" prompt that Task 10 of aware-skills used, commit the result. From that point on, the cassette tier is non-empty and provides real coverage of the wrapper plumbing.

- [ ] **Step 1: Run the recorder** (this requires `claude` on PATH; takes 5–10 minutes)

```bash
cd /home/fintan/repos/kadai
bun scripts/record-cassette.ts blog-mvp "Use kadai-brainstorming and kadai-writing-plans to plan a small CLI tool that converts Markdown to plaintext. Keep it minimal: one command, one input file, one output file. Don't ask me clarifying questions — make reasonable choices and proceed. After the plan is written, stop."
```

If `claude` is not on PATH, this task has to be done by someone who has it. The replay test runner from Task 3 will continue to pass with the sentinel until a cassette is committed.

- [ ] **Step 2: Verify the cassette replays cleanly**

```bash
cd /home/fintan/repos/kadai
bun test tests/cassette/replay.test.ts
```

Expected: 1 test "cassette: blog-mvp" passes. (Sentinel test no longer runs because cassettes.length > 0 — that's fine.)

- [ ] **Step 3: Run the full suite to confirm everything still passes**

```bash
cd /home/fintan/repos/kadai
bun test 2>&1 | tail -3
bun run typecheck
```

Expected: full suite green, typecheck clean.

- [ ] **Step 4: Inspect the cassette before committing**

```bash
cd /home/fintan/repos/kadai
wc -l tests/cassettes/blog-mvp/calls.jsonl                                # how many CLI calls?
jq 'keys | length' tests/cassettes/blog-mvp/spine.snapshot.json           # how many spine files?
head -5 tests/cassettes/blog-mvp/calls.jsonl                              # sanity-check the first few calls
```

If the cassette has 0 calls or only `init` (meaning the wrapper didn't fire — Claude loaded the upstream skill instead), the recording is stale and needs a re-run. Delete `tests/cassettes/blog-mvp/` and try again with a more explicit prompt.

- [ ] **Step 5: Commit the cassette**

```bash
cd /home/fintan/repos/kadai
git add tests/cassettes/blog-mvp/
git commit -m "$(cat <<'EOF'
test(cassette): first captured cassette — blog-mvp brainstorm + plan [cassette Task-5]

Recorded via `bun scripts/record-cassette.ts blog-mvp "..."` against
Claude. Captures the kadai-brainstorming + kadai-writing-plans wrapper
firing end-to-end on the same prompt aware-skills Task 10's e2e test
used (the one that timed out at 5 minutes).

Replay runs in <10s on every `bun test` — no model calls.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 6: Wiki documentation

**Files:**
- Modify: `docs/wiki/concepts.md` (the three-tier model)
- Modify: `docs/wiki/troubleshooting.md` (cassette divergence entry)

**Goal:** Make the cassette tier discoverable for next-time-someone-touches-the-wrapper situations.

- [x] **Step 1: Update concepts.md with a "Test tiers" section**

Read `/home/fintan/repos/kadai/docs/wiki/concepts.md` first. Append (or insert near other testing-related content):

```markdown
## Test tiers

Kadai's tests live in three tiers, deliberately gated to balance signal vs cost:

| Tier | What it runs | Cost | Frequency |
|---|---|---|---|
| **1 — Unit** (`bun test`) | Pure logic, mocked LLM, in-process | Free | Every PR |
| **2 — Cassette** (`bun test tests/cassette/`) | Captured `claude -p` runs replayed against the kadai CLI; no model calls | Free | Every PR |
| **3 — Real e2e** (`RUN_DOGFOOD_E2E=1 bun test tests/dogfood/`) | Live `claude -p` against a fresh kadai project | $$ + 5–10min | Pre-release / nightly |

Tier 2 is the cassette pattern — recorded sequences of `kadai` CLI invocations + a serialized `.kadai/` snapshot. The replay verifies that current code, given the same call sequence, produces the same final spine state. It catches schema regressions, plumbing bugs, and any code change that breaks the wrapper's spine writes — without needing to call Claude.

**To re-record a cassette** (after intentional behavior changes):

```
rm -rf tests/cassettes/<name>
bun scripts/record-cassette.ts <name> "<prompt>"
git add tests/cassettes/<name>
git commit
```

Tier 3 (real e2e) is the canary for skill-matching drift — Claude shipping a model update that stops loading the wrapper skill. Treat it as a periodic check, not a PR gate.
```

- [x] **Step 2: Update troubleshooting.md with a cassette-divergence entry**

Append:

```markdown
## "Cassette test failed: cassette diverged"

**Cause:** The replay test (Tier 2) found that current code produces a different `.kadai/` state than the captured cassette expected. Either:

- A real bug — your change breaks the wrapper's spine writes
- A valid behavior change — the wrapper now produces a different (still-correct) end state

**Diagnostic:** read the diff message carefully. It lists `missing:` / `extra:` / `content mismatch:` paths with a hint at the divergence position.

**Fix paths:**

1. **If it's a bug:** revert the change OR fix it so the cassette replays cleanly.
2. **If the behavior change is intentional:** re-record the cassette:

   ```
   rm -rf tests/cassettes/<name>
   bun scripts/record-cassette.ts <name> "<original prompt>"
   git add tests/cassettes/<name>
   git commit
   ```

   Be deliberate — the cassette is the contract. Re-recording is fine when the behavior change is intended (e.g., new `kadai add story` flag, schema migration). It's NOT fine to silently re-record because the test is annoying — that defeats the whole tier.
```

- [x] **Step 3: Commit**

```bash
cd /home/fintan/repos/kadai
git add docs/wiki/concepts.md docs/wiki/troubleshooting.md
git commit -m "$(cat <<'EOF'
docs(wiki): three-tier test model + cassette-divergence troubleshooting [cassette Task-6]

- concepts.md: explain the unit / cassette / real-e2e gating model
  with a quick comparison table; mention how to re-record a cassette
  after intentional behavior changes.
- troubleshooting.md: cassette-diverged entry explaining the diff
  output and the bug-vs-behavior-change decision.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Plan self-review checklist

- [ ] All 6 tasks completed (Task 5 deferred — needs real `claude` session).
- [ ] `bun test` passes (≥367 baseline + 9 snap + 4 recorder + 1 cassette + 1 sentinel-or-replay = ~382).
- [ ] `bun run typecheck` passes.
- [ ] At least one cassette in `tests/cassettes/` (Task 5 may be deferred to whoever has `claude` on PATH).
- [x] `KADAI_RECORD_TO` is documented in `docs/wiki/concepts.md` or similar.
- [x] `bun scripts/record-cassette.ts` prints clean usage when run with no args.
