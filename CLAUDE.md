# Kadai — Project Overview

Kadai is a local-first product spine for projects driven by agentic coding. It tracks a hierarchical spine (epics → features → stories → tasks) as markdown files committed to the repo, and exposes typed MCP tools + hooks so agents stay honest to the spine.

## Cold-start: where to begin

If you're a fresh Claude session, read in this order:

1. **Spec** — [`docs/superpowers/specs/2026-05-05-kadai-design.md`](docs/superpowers/specs/2026-05-05-kadai-design.md) — what we're building and why.
2. **Plans index** — [`docs/superpowers/plans/README.md`](docs/superpowers/plans/README.md) — implementation plans (5 of them, executed sequentially).
3. **Active plan** (see below).

## Active plan

> **Currently:** Plan 1 — Spine + CLI ([file](docs/superpowers/plans/2026-05-05-kadai-01-spine-and-cli.md))

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
