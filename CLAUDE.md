# Kadai — Project Overview

Kadai is a local-first product spine for projects driven by agentic coding. It tracks a hierarchical spine (epics → features → stories → tasks) as markdown files committed to the repo, and exposes typed MCP tools + hooks so agents stay honest to the spine.

## Cold-start: where to begin

If you're a fresh Claude session, read in this order:

1. **Spec** — [`docs/superpowers/specs/2026-05-05-kadai-design.md`](docs/superpowers/specs/2026-05-05-kadai-design.md) — what we're building and why.
2. **Plans index** — [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md) — implementation plans (5 of them, executed sequentially).
3. **Active plan** (see below).

## Active plan

> **Currently:** Plan 3 — Hooks (guardrails) (stub; awaiting `/writing-plans`)
>
> Plans 1 (Spine + CLI) and 2 (MCP server) shipped. Plan 2 also extended `kadai init` to merge `.mcp.json`, so any project can register the kadai MCP server with `kadai init`. The next step is to run `/writing-plans` against [`docs/superpowers/plans/2026-05-05-kadai-03-hooks.md`](docs/superpowers/plans/2026-05-05-kadai-03-hooks.md) to draft the executable plan from its stub.
>
> **Plan 3 also includes the mid-build dogfood transition** — once hooks ship, kadai installs against this very project and Plans 4 and 5 are executed under kadai's own guardrails.

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

## Self-hosted dogfood

After **Plan 3** (hooks) ships, kadai installs against this very project. From that point, work on Plans 4 and 5 happens under kadai's own guardrails — you'll need to `kadai pick <story-id>` before editing code.

## Kadai

This project uses kadai for product/feature/story tracking (spine in `.kadai/`).
Use the `kadai` CLI to read/update the spine — direct edits to `.kadai/` are allowed but `kadai add` validates schema and increments IDs.

Run `kadai status` to see the picked story and queue.
