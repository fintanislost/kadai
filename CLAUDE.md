# Kadai — Project Overview

Kadai is a local-first product spine for projects driven by agentic coding. It tracks a hierarchical spine (epics → features → stories → tasks) as markdown files committed to the repo, and exposes typed MCP tools + hooks so agents stay honest to the spine.

## Cold-start: where to begin

If you're a fresh Claude session, read in this order:

1. **Spec** — [`docs/superpowers/specs/2026-05-05-kadai-design.md`](docs/superpowers/specs/2026-05-05-kadai-design.md) — what we're building and why.
2. **Plans index** — [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md) — implementation plans (5 of them, executed sequentially).
3. **Active plan** (see below).

## Active plan

> ✅ **Plans 1-10 shipped.** kadai-plugin is at v0.6.0.
>
> What's working today:
> - `kadai init / add / list / get / status / pick / unpick / set-status / phases / config / sync` — full CLI
> - `kadai mcp` — stdio MCP server with 18 typed tools
> - `kadai hook pre-tool-use / post-tool-use` — Claude Code hooks (guardrail + changelog capture)
> - `kadai serve` — localhost web viewer with writable API, live updates via SSE, and spine-wide search
> - `kadai sync` — scrapes git log for item ID refs (`STORY-NNN` etc.) and appends matching commits to `changelog.md`; idempotent; optional PR-merge auto-transition
> - `kadai-plugin/` — installable Claude Code plugin (skill + `/kadai-pick` + `/kadai-status` + `/kadai-add` + `/kadai-set-status` + `/kadai-unpick`)
>
> **Next plan:** Plan 11 — Hook polish (`UserPromptSubmit` injects active-story context; `Stop` reminds when a turn ends without a status update). See [`docs/wiki/post-mvp.md`](docs/wiki/post-mvp.md) for the full backlog.

When a plan completes, update both this section *and* the plans index status column to point to the next plan.

## Discipline

Don't write code outside the active plan's task list. If a need emerges that the plan doesn't cover:

1. Add a task to the plan first (with code and tests).
2. Then implement.

This is the safety property that makes the work resumable after compaction.

## Documentation discipline

When you change user-facing behavior, **update the relevant page in [`docs/wiki/`](docs/wiki/) in the same commit**:

- New CLI flag or subcommand → update `docs/wiki/cli-reference.md`
- New MCP tool, hook, or schema field → update the relevant reference page
- New common gotcha discovered → add it to `docs/wiki/troubleshooting.md`
- Concept change (state machine, phases, picked semantics) → update `docs/wiki/concepts.md`
- Plugin change (skill description, slash command) → update `docs/wiki/plugin.md`

If a change spans multiple pages, that's a sign it's a real concept shift — be sure to update all affected pages plus any relevant code comments. Stale docs are worse than no docs.

## Tech stack quick reference

- **Language:** TypeScript on **Bun** (runtime + test runner + bundler)
- **CLI:** `commander`
- **Validation:** `zod`
- **Frontmatter:** `gray-matter`
- **TOML config:** `smol-toml`
- **Terminal output:** `picocolors`
- **Prompts:** `prompts`
- **MCP** (Plan 2+): `@modelcontextprotocol/sdk`
- **Web viewer** (Plan 4): Vite + React + Tailwind + TanStack Router

## Tests

```
bun test                # run all tests
bun test src/core       # core module tests
bun test src/cli        # CLI tests
```

## Dogfood / testing approach

Kadai testing happens via **subagents in isolated working directories**, not by installing kadai against this project itself.

- **Plans 3 and 4:** integration and behavior tests spawn fresh subagents (or use temp dirs) where kadai is initialized and exercised. The kadai project repo stays clean — no `.kadai/`, no MCP registration, no hooks installed here.
- **Plan 5:** the formal dogfood test spawns a subagent given a kadai-managed story (with kadai initialized in the subagent's working dir) and observes the 6-point behavior checklist (spec §10). Optionally, Plan 5 also installs kadai against this very project as a final wrap, so kadai becomes self-tracked going into post-MVP work.

Until Plan 5 lands, treat this repo as a normal TypeScript project — no kadai guardrails apply to commits here.
