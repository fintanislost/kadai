# Kadai — Project Overview

Kadai is a local-first product spine for projects driven by agentic coding. It tracks a hierarchical spine (epics → features → stories → tasks) as markdown files committed to the repo, and exposes typed MCP tools + hooks so agents stay honest to the spine.

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
- **MCP:** `@modelcontextprotocol/sdk`
- **Web viewer:** Vite + React + Tailwind + TanStack Router

## Tests

```
bun test                # run all tests
bun test src/core       # core module tests
bun test src/cli        # CLI tests
```

## Dogfood / testing approach

Kadai's own test suite exercises kadai via **subagents in isolated working directories** — integration and behavior tests spawn fresh subagents (or use temp dirs) where kadai is initialized and exercised in isolation, so the test runs don't perturb this repo's spine.

This repo *is* self-tracked with kadai (the `.kadai/` directory exists locally), so changes here flow through the normal pick-a-story workflow.

## Kadai

This project uses kadai for product/feature/story tracking (spine in `.kadai/`).
Use the `kadai` CLI to read/update the spine — direct edits to `.kadai/` are allowed but `kadai add` validates schema and increments IDs.

Run `kadai status` to see the picked story and queue.
