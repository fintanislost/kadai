# Kadai — Project Overview

Kadai is a local-first product spine for projects driven by agentic coding. It tracks a hierarchical spine (epics → features → stories → tasks) as markdown files committed to the repo, and exposes typed MCP tools + hooks so agents stay honest to the spine.

## Cold-start: where to begin

If you're a fresh Claude session, read in this order:

1. **Spec** — [`docs/superpowers/specs/2026-05-05-kadai-design.md`](docs/superpowers/specs/2026-05-05-kadai-design.md) — what we're building and why.
2. **Plans index** — [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md) — implementation plans (5 of them, executed sequentially).
3. **Active plan** (see below).

## Active plan

> **Currently:** Plan 5 — Plugin + dogfood (stub; awaiting `/writing-plans`)
>
> Plans 1–4 shipped: spine + CLI, MCP server, hooks, and web viewer. `kadai init` installs the spine, MCP registration, and hooks in any project; `kadai serve` launches the localhost web viewer (after `bun run build:web`). The next step is to run `/writing-plans` against [`docs/superpowers/plans/2026-05-05-kadai-05-plugin-and-dogfood.md`](docs/superpowers/plans/2026-05-05-kadai-05-plugin-and-dogfood.md) — the final plan, which builds the bundled Claude Code plugin (skill + slash commands) and runs the formal subagent acceptance test in a temp dir.

When a plan completes, update both this section *and* the plans index status column to point to the next plan.

## Discipline

Don't write code outside the active plan's task list. If a need emerges that the plan doesn't cover:

1. Add a task to the plan first (with code and tests).
2. Then implement.

This is the safety property that makes the work resumable after compaction.

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
