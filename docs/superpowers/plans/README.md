# Kadai Implementation — Plans Index

Implementation of kadai is split across 5 plans, executed sequentially. Each plan ends in working software you can run.

## Source spec

[`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md) — the design this implementation realizes. Read it before any of these plans.

## Plan order & status

Update the **Status** column as plans complete (and update [`/CLAUDE.md`](../../../CLAUDE.md) "Active plan" in lockstep).

| # | Plan | Status | Ships at end |
|---|---|---|---|
| 1 | [Spine + CLI](2026-05-05-kadai-01-spine-and-cli.md) | **TODO** | `kadai init / add / list / status / pick` working from terminal |
| 2 | [MCP server](2026-05-05-kadai-02-mcp-server.md) | STUB | Agents read/write the spine through MCP tools |
| 3 | [Hooks (guardrails)](2026-05-05-kadai-03-hooks.md) | STUB | `PreToolUse` blocks off-spine edits; `PostToolUse` captures changelog |
| 4 | [Web viewer (read-only)](2026-05-05-kadai-04-web-viewer.md) | STUB | Roadmap + drill-down views at localhost |
| 5 | [Plugin + dogfood](2026-05-05-kadai-05-plugin-and-dogfood.md) | STUB | Bundled skill + slash commands; subagent acceptance test passes → MVP done |

**Status values:** `STUB` (description only — needs `/writing-plans` to draft tasks) → `TODO` (plan written, not started) → `IN PROGRESS` → `DONE`.

## When each STUB transitions to TODO

Run `/writing-plans` against the next plan's stub file *after* the prior plan's "Final task" has shipped (so the new plan can reference the actual landed APIs). Each stub documents exactly what inputs to expect from prior plans and what triggers writing it.

## Mid-build dogfood transition

Per spec §10 / §12, once **Plan 3 (hooks)** ships, kadai installs against itself. Plans 4 and 5 are then executed *under kadai's own guardrails* — the agents writing them will work through `kadai pick`, `kadai status`, etc. This is intentional: Plans 4 and 5 are also the first dogfood test.

## Compaction-safe recovery — if a fresh Claude lands here cold

1. **Read the spec first** ([`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md)).
2. **Read this README** to find the active plan (first row marked `IN PROGRESS`, or first `TODO` if none).
3. **Open the active plan file.** The first unchecked `- [ ]` task is your next action.
4. **The project's [`CLAUDE.md`](../../../CLAUDE.md) also points here** — if you opened that first, follow its "Active plan" pointer.
5. **Don't write code that isn't covered by an unchecked task** in the active plan. If a real need emerges that the plan doesn't cover, add a task to the plan first.
