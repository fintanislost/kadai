# Cassette tier — MCP recording extension

**Status:** Draft 2026-05-07. Extends [`2026-05-07-cassette-tier-design.md`](2026-05-07-cassette-tier-design.md). Same branch (`feature/cassette-tier`).

## Motivation

The first cassette recording revealed that the kadai-aware-skills wrapper does its work via **kadai MCP tool calls** (`kadai.create_epic`, `kadai.attach_spec`, ...), not via CLI subprocess invocations. The recorder shipped today instruments only the CLI process, so the captured cassette had:

- 1 useful call (`init -y`)
- 22 noise lines (`hook pre-tool-use`/`post-tool-use` for every Edit/Write — now filtered)
- 1 `mcp` server launch — also filtered now
- **0 spine-mutating wrapper operations**

The wrapper's actual operations (which the snapshot proves DID happen — it produced 21 spine files) ran inside the kadai MCP server process and never touched the CLI. The cassette tier therefore doesn't verify the wrapper's behavior end-to-end. Without this extension, Tier 2 catches CLI regressions only — not what we built it for.

## Goals

- Every MCP tool invocation against the kadai server appends a record to the cassette when `KADAI_RECORD_TO` is set.
- Cassettes mix CLI and MCP entries in **execution order** (the order matters for replay correctness — e.g., `init -y` must run before `create_epic`).
- Replay handles both entry types: CLI via `execFileSync`, MCP via in-process handler dispatch.
- Backwards-compatible: existing cassettes (no `kind` field) replay as CLI-only.

## Non-goals

- Capturing tool reads (list_epics, get_item, etc.). Reads don't mutate state; they don't need replay. Only mutating tools record.
- MCP server mocking/replay against a live `claude -p` session. Replay calls handlers directly in the test process, no MCP protocol involved.
- Audit logging beyond cassettes (a real audit feature would belong elsewhere).

## Cassette format change

Each line in `calls.jsonl` becomes a discriminated union:

```jsonl
{"kind":"cli","argv":["init","-y"],"exit":0}
{"kind":"mcp","tool":"create_epic","args":{"title":"Auth","phase":"mvp"},"ok":true}
{"kind":"mcp","tool":"attach_spec","args":{"feature_id":"FEAT-001","source_path":"/tmp/spec.md"},"ok":true}
{"kind":"cli","argv":["pick","STORY-001"],"exit":0}
```

**Backwards compat:** if a line has no `kind` but has `argv`, treat as `kind: 'cli'`. (Existing recorder.test.ts cassettes don't have `kind`; the test fixtures stay valid.)

## Server-side instrumentation

In `src/mcp/server.ts`, after a successful tool invocation, append to the cassette. Single injection point at the dispatch handler:

```typescript
const result = await tool.handler(parsed, ctx);
appendMcpCallToCassette({ tool: name, args: parsed, ok: true });
```

On a thrown handler error, append `ok: false` so the cassette captures the failure (and replay can verify the same handler still throws).

The server only registers and invokes spine-mutating tools when called by the agent. Reads are also dispatched through this code path; we filter at write time using a `MUTATING_TOOLS` allowlist (or skip recording when the tool's name doesn't match a known mutating set). Defense-in-depth: the recorder helper in `src/cassette/recorder.ts` is the single source of truth for "which tool names are recorded."

## Replay MCP dispatch

In `tests/cassette/replay.test.ts`, before iterating the cassette:

1. Call all `register*Tools()` functions (importing the same modules as `src/cli/mcp.ts`).
2. For each MCP entry: `const tool = getTool(entry.tool); const parsed = tool.inputSchema.parse(entry.args); await tool.handler(parsed, { rootDir: tmp });`
3. If the handler throws and `entry.ok === true`, fail the test (regression).
4. If the handler succeeds and `entry.ok === false`, fail the test (cassette expected an error but didn't get one).

Handler dispatch is **in-process**, not via subprocess. Same registry, same Zod schemas, same code paths. Only difference: no MCP protocol marshaling.

## Recorder integration

`scripts/record-cassette.ts` doesn't need changes — `KADAI_RECORD_TO` is already passed to the `claude -p` env. Claude Code spawns the kadai mcp server with that env inherited, the server logs to the cassette, the CLI logs to the same cassette. Single ordered file.

The one consideration: **cassette ordering** depends on the OS-level write order. CLI invocations and MCP tool calls happen in different processes that might race. In practice they're driven by the same Claude session sequentially (the agent makes a tool call, awaits it, then makes the next), so races are unlikely. If they happen, the cassette is wrong; we'd need a write-lock or seq-num. v1: assume no race.

## Out of scope (v1)

- Concurrent MCP tool calls (kadai's tools are all sync from the agent's perspective).
- Recording the MCP request envelope (just the tool name + args is enough for replay).
- Tool versioning (if we add a `created_at` arg to a tool later, old cassettes break — re-record is the answer).

## Acceptance criteria

This ships when:

1. Recording a `claude -p` session that invokes `kadai.create_epic`, `kadai.attach_spec`, etc. produces cassette lines with `kind: 'mcp'` for each invocation.
2. Replay correctly dispatches MCP entries via `tool.handler(...)` in-process.
3. The blog-mvp cassette (re-recorded) replays cleanly: same final spine state.
4. Existing cassettes without a `kind` field still replay as CLI (backwards compat).
5. Reads (list_epics, get_item) are NOT recorded.

## Suggested implementation tasks

1. **Cassette format + recorder helpers.** Extend `src/cassette/recorder.ts` with `appendMcpCallToCassette({tool, args, ok})`. Add a `MUTATING_MCP_TOOLS` set as the source-of-truth allowlist. Update `appendCallToCassette` to write `kind: 'cli'`. Update unit tests to assert on the new format. ~30 lines + 3 tests.

2. **Server-side dispatch instrumentation.** ~5 lines in `src/mcp/server.ts` to call `appendMcpCallToCassette` on each handler outcome. Add a small server-level test that exercises a mutating tool and verifies the cassette line.

3. **Replay MCP dispatch.** Update `tests/cassette/replay.test.ts` to:
   - Register all MCP tools at module load (mirror `src/cli/mcp.ts`)
   - Discriminate cassette entries on `kind` (default `'cli'` for back-compat)
   - For MCP entries, call `tool.handler(args, {rootDir: tmp})` directly. ~30 lines.

4. **Re-record blog-mvp.** Run `scripts/record-cassette.ts blog-mvp "..."` against real Claude. Verify the cassette now has `kind: 'mcp'` entries for the wrapper's tool calls. Verify replay produces the same spine state. Commit. (5–10 min real model run; this can be deferred to whoever has Claude on PATH, but the rest of the work doesn't gate on it.)

5. **Wiki update.** Note in `docs/wiki/concepts.md` and the cassette troubleshooting entry that cassettes capture both CLI and MCP operations.

## References

- Cassette tier base spec: [`2026-05-07-cassette-tier-design.md`](2026-05-07-cassette-tier-design.md)
- Cassette tier base plan: [`docs/superpowers/plans/2026-05-07-cassette-tier.md`](../plans/2026-05-07-cassette-tier.md)
- The first recording attempt that revealed the gap: see commit `3587fb9` — captured an MCP-driven wrapper run with zero useful CLI calls.
- MCP server entry: `src/mcp/server.ts`
- Tool registry: `src/mcp/registry.ts`
- Handler modules: `src/mcp/handlers/{creates,attach,picks,status,record-change}.ts`
