# `kadai disable` / `kadai enable` — design spec

**Status:** Draft 2026-05-08. Lives on `feature/kadai-toggle` (off master).

## Motivation

Kadai integrates with a Claude Code session through five surfaces — MCP server, four hooks, slash commands — plus the standalone CLI. Each has its own opt-out mechanism, none unified:

| Surface | Disable mechanism today |
|---|---|
| MCP server | `disabledMcpjsonServers` in Claude Code's `settings.local.json` |
| Hooks | hand-edit `.claude/settings.json` |
| CLI commands | just don't run them |
| Per-write bypass | `KADAI_BYPASS=1` env var (per-shell, all-or-nothing) |
| Skills | Claude's prompt-matching heuristic |

Real-world consequence (from the ufo_analysis dogfood session, 2026-05-08): the user disabled the kadai MCP via Claude Code's per-server toggle — but the PreToolUse hook kept running, so the agent kept hitting the guardrail and fell back to the CLI. The "MCP off, hooks on" state was a happy accident, not a designed UX. There's no clean answer to "I'm using kadai but I want to do this one weird thing without picking a story or editing the allowlist."

## Goals

- A single project-level toggle that flips kadai off cleanly across every surface.
- `kadai disable` writes the toggle; `kadai enable` removes it. Optional reason recorded when disabling.
- When disabled: no hook firings disrupt the agent, no CLI mutations succeed, no MCP mutating tool calls succeed. Read commands continue to work. The escape hatches (`disable`, `enable`, `status`, `run`) always work.
- Plugin slash commands `/kadai-disable [reason]` and `/kadai-enable` for one-keystroke control inside Claude Code.
- A friendly, low-noise enable path: `kadai status` shows toggle state prominently; the disabled state is visible in `ls .kadai/`.

## Non-goals

- Drift detection on re-enable (auditing files-changed-while-disabled). v2 if anyone asks.
- Per-story or per-feature disable. Project-level only.
- Time-limited disable (`kadai disable --for 1h` auto-re-enables). Maybe v2.
- Disabling the wrapper skills themselves. Skills are loaded by Claude's heuristic; outside our control. Disabling the underlying surfaces is enough — the wrappers' MCP and CLI calls will all error/no-op cleanly.
- Replacing `KADAI_BYPASS=1`. That stays for one-shot escapes; the toggle is for session-long opt-outs.

## Storage

A flag file at `.kadai/disabled`:

```
disabled-since: 2026-05-08T22:30:15Z
reason: needed to do a quick refactor across multiple stories
```

YAML-style key/value, two known fields. Both optional in the file itself; readers default to "(no reason given)" if absent. Presence of the file is the sole signal that kadai is off — readers don't need to parse content unless they want to display it.

Why a file (not `disabled = true` in `config.toml`):

- Atomic: write-and-rename for set, single-syscall-unlink for clear. No TOML parse round-trip on every hook call.
- Visible: `ls -la .kadai/` immediately surfaces the state to a human inspecting the project.
- Cheap to check: `existsSync(path)` is one syscall; we'd be adding it to every hook entry, so cost matters.
- Carries reason inline: no awkward two-key relationship inside config.toml.

## Surfaces — what each one does when the flag is present

### Hooks (`src/cli/hook.ts`)

All four hook subcommands check the disabled flag first; if set, exit 0 immediately without doing their normal work.

- **PreToolUse:** allow the write (don't gate on no-picked-story). The whole point.
- **PostToolUse:** skip changelog append.
- **UserPromptSubmit:** inject nothing (silent — adding "kadai disabled" to every prompt would be noise).
- **Stop:** no reminder.

Each hook implementation gets a one-line guard at the top:

```ts
if (isDisabled(rootDir)) process.exit(0);
```

Where `isDisabled(rootDir)` is a new helper in `src/core/toggle.ts` (see below).

### MCP server (`src/mcp/server.ts`)

The dispatch handler (`CallToolRequestSchema`) checks the flag before invoking each tool's handler. Two paths:

- **Mutating tool** (the `MUTATING_MCP_TOOLS` set already exists from the cassette work): return `{ content: [{ type: 'text', text: 'kadai is disabled in this project; run `kadai enable` to re-enable' }], isError: true }`. The agent sees a clear error and can route around.
- **Read tool** (everything else): proceed normally. Reading the spine while disabled is fine.

### CLI commands (`src/cli/index.ts` + per-command files)

Mutating subcommands check the flag in their action handlers and error early with a friendly message. Read subcommands proceed normally. The full split:

| Command | Behavior when disabled |
|---|---|
| `kadai add (epic|feature|story|task)` | Error: "kadai is disabled in this project; `kadai enable` to re-enable" |
| `kadai pick`, `unpick`, `set-status` | Same |
| `kadai attach-spec`, `attach-plan` | Same |
| `kadai sync`, `phases (mutating)`, `config (mutating)` | Same |
| `kadai init` | Works (init is fine when disabled — it's the project-bootstrap path; if the user wants a fresh kadai while disabled, that's intentional). Re-running init does NOT remove the disabled flag. |
| `kadai run` | Works — the runner is an escape hatch the user might explicitly invoke. Whether the picked story actually runs depends on its tasks; nothing is gated. |
| `kadai disable`, `enable`, `status` | Always work (escape hatches must) |
| `kadai list*`, `get-file`, `phases (read)`, `config (read)`, `plan compose` (stdout), `plan compose --out` | Read; work normally |
| `kadai serve` | Works; UI shows "DISABLED" banner prominently in the topbar |
| `kadai mcp` | Works; tool dispatch enforces the rules above |
| `kadai hook *` | Works (no-ops as described) |

The error message pattern is consistent: `"kadai is disabled in this project (since 2026-05-08T22:30:15Z; reason: ${reason}). Run \`kadai enable\` to re-enable."` Includes the timestamp + reason from the disabled file when present, so the user instantly remembers why.

### `kadai status` (read command, special)

Shows toggle state prominently when disabled:

```
$ kadai status
⚠ kadai is DISABLED in this project
  since: 2026-05-08T22:30:15Z (3h ago)
  reason: needed to do a quick refactor across multiple stories
  re-enable with: kadai enable

picked: STORY-007 (Magic link delivery)
status: in_progress
phase: mvp
parent: FEAT-001
acceptance criteria:
  - ...
```

When enabled, status output is unchanged from today.

### `kadai serve` (web viewer)

Adds a banner to the Layout topbar when the active project's `.kadai/disabled` file is present:

```
[k Kadai]  Activity  Compare  [search]  ⚠ DISABLED  Picked: STORY-001
```

Color: same as the brand accent (teal-300) for visibility, not red — disabled is a deliberate state, not an error. Tooltip on hover shows the reason and timestamp.

API endpoint `GET /api/disabled-status` returns `{ disabled: boolean, since?: string, reason?: string }` — the frontend calls it once per project on load.

### Plugin slash commands

Two new commands in `kadai-plugin/commands/`:

- `commands/kadai-disable.md` — `/kadai-disable [reason...]` runs `kadai disable --reason "<args>"` if args present, else `kadai disable`.
- `commands/kadai-enable.md` — `/kadai-enable` runs `kadai enable`.

Both single-action; no prompts.

## CLI verbs

```
kadai disable [--reason <text>]
  Disable kadai in this project. Writes .kadai/disabled with timestamp
  and (optional) reason. Subsequent kadai mutations error; hooks no-op.
  Reads still work. Restart your Claude Code session for the .mcp.json
  / hooks change to take full effect (or just trust it; existing
  mid-session hooks will check the flag and exit cleanly).

kadai enable
  Re-enable kadai. Removes .kadai/disabled. Mutations and hooks resume
  normally. No drift audit (yet) — if you did work that should have
  been tracked while disabled, you'll need to add it manually.

kadai status
  (Existing command; gains the "DISABLED" preamble when applicable.)
```

`kadai disable` when already disabled is a no-op + warning ("kadai is already disabled (since X; reason: Y). To change the reason, `kadai enable` first then `kadai disable --reason "..."`.").

`kadai enable` when already enabled is a no-op + info message.

## What this catches vs misses

**Catches** (real use cases observed during the dogfood):
- "I want to do something quick without picking a story" — `kadai disable`, do thing, `kadai enable`.
- "kadai is misbehaving and I need to bypass everything" — `kadai disable` is the unified circuit breaker.
- "This project shouldn't be tracked by kadai right now" — `kadai disable --reason "exploratory; revisit in a week"`.

**Misses** (acknowledged):
- **Drift while disabled.** If the user does spine-relevant work while disabled, the spine and reality diverge. v1 doesn't audit. Mitigation: the `enabled_at` / `disabled-since` timestamps make it easy for a future `kadai audit-disabled-period` command to walk a date range. Not v1.
- **Per-tool granularity.** Today the user can't say "disable the guardrail but keep changelog capture." If that ever becomes a real ask, sub-toggles can be added — for now, "all on" or "all off" is enough.
- **Wrapper skills.** Skills are loaded by Claude based on prompt heuristics; the disabled flag doesn't change skill loading. But all the wrapper's MCP/CLI calls error cleanly, so the wrapper itself effectively becomes a no-op.

## Out of scope (v1)

- Drift detection / audit-on-enable.
- Time-limited disable.
- Reason-required mode (`require_reason = true` in config).
- Per-skill or per-tool sub-toggles.
- Cross-project disable (e.g., a global `~/.kadai/disabled` that disables kadai everywhere). Likely fine to add in v2; out of scope here.

## Acceptance criteria

This ships when:

1. `kadai disable` creates `.kadai/disabled` with timestamp; `kadai enable` removes it. Both idempotent.
2. While disabled: every hook subcommand exits 0 without side effects; the MCP server returns a clear error on mutating tool calls; mutating CLI subcommands error with a friendly message; reads work normally.
3. `kadai status` prominently shows DISABLED state with the timestamp + reason.
4. `kadai serve` shows a DISABLED banner in the topbar; `GET /api/disabled-status` returns the right shape.
5. `/kadai-disable [reason]` and `/kadai-enable` slash commands work from Claude Code.
6. The toggle survives across `kadai mcp` server restarts (it's a file, not a process flag).
7. `bun test` passes including new tests for: helper `isDisabled()`, hook no-op behavior, CLI mutation refusal, MCP mutating-tool refusal, status display.
8. Updated wiki entries for `cli-reference.md` (the new verbs), `concepts.md` (the toggle as a project-state concept), `troubleshooting.md` ("how do I temporarily disable kadai?").

## Suggested implementation tasks

1. **`src/core/toggle.ts` helper module.** `isDisabled(rootDir): boolean`, `getDisabledInfo(rootDir): { since: string, reason?: string } | null`, `setDisabled(rootDir, reason?): void`, `clearDisabled(rootDir): void`. Atomic file writes via existing `writeFileAtomic`. ~40 lines + 5 unit tests.

2. **Hook integration.** Add `if (isDisabled(rootDir)) process.exit(0);` to all four hook subcommands. ~5 line changes total + integration tests confirming hooks no-op when disabled.

3. **MCP integration.** Add `if (isDisabled(rootDir) && MUTATING_MCP_TOOLS.has(name)) return errorResponse(...)` to the dispatch handler in `src/mcp/server.ts`. ~10 lines + 2 unit tests.

4. **CLI verb implementations.** New `src/cli/disable.ts` and `src/cli/enable.ts`. Each ~30 lines + 4 tests covering: idempotency, reason capture, file shape, output messages.

5. **CLI mutation guards.** Add `assertEnabled(rootDir)` calls at the entry point of every mutating subcommand action. ~1 line per command × ~8 commands; one shared error message constant. + 1 integration test per affected command (~8 tests).

6. **`kadai status` enhancement.** Update `src/cli/status.ts` to prepend the DISABLED preamble when applicable. ~15 lines + 2 tests.

7. **Web viewer banner.** New `GET /api/disabled-status` endpoint in `src/web/api.ts`. Frontend addition: hook in `Layout.tsx` to render the banner when the API returns `disabled: true`. ~30 lines + 1 API test + 1 Playwright assertion.

8. **Plugin slash commands.** `kadai-plugin/commands/kadai-disable.md` + `kadai-plugin/commands/kadai-enable.md`. Plugin manifest version bump to 1.4.1 (or whatever the cassette work landed at).

9. **Wiki updates.** `cli-reference.md`, `concepts.md`, `troubleshooting.md`. Probably ~50 lines combined.

10. **Dogfood test (`claude -p`-based, gated)** — fresh project, `kadai disable`, agent attempts a write, verify the agent gets the disabled error rather than the guardrail block. Optional; the unit + integration tests probably cover the meaningful behavior.

## References

- The follow-up TODO that captured the user's request: [`docs/follow_up_todo.md`](../../follow_up_todo.md) (section "Idea: a kadai on/off toggle")
- Real-world session that surfaced the need: ufo_analysis dogfood, 2026-05-08
- Existing escape hatches: `KADAI_BYPASS` env var (per-shell), `disabledMcpjsonServers` in Claude Code (per-MCP-server), allowlist in `config.toml` (per-path)
- Related: `MUTATING_MCP_TOOLS` set lives in `src/cassette/recorder.ts` (added in the cassette tier work). The dispatch handler can reuse it for the toggle's mutating-tool detection.

---

**Approved questions resolved during brainstorming:**

- Storage: flag file at `.kadai/disabled` (vs config.toml `disabled = true`). File chosen.
- Reason: optional, no prompt. Pass `--reason "..."` when you want; otherwise just disabled with timestamp only.
- CLI scope: mutating commands error, reads work, escape hatches always work, server commands work but show disabled.
- UserPromptSubmit hook: silent (no nag).
- Drift detection: skip in v1.
- Slash commands: `/kadai-disable [reason]` and `/kadai-enable` only.

**Ready for `superpowers:writing-plans` to produce the implementation plan.**
