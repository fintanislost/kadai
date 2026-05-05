# Kadai docs

User-facing documentation for kadai. (For design specs and implementation plans, see `../superpowers/specs/` and `../superpowers/plans/`.)

## Pages

- [Getting started](getting-started.md) — install, init, first epic, first edit
- [CLI reference](cli-reference.md) — every `kadai` subcommand
- [Plugin (Claude Code)](plugin.md) — install the bundled skill + slash commands
- [Troubleshooting](troubleshooting.md) — common gotchas
- [Concepts](concepts.md) — epics → features → stories → tasks, phases, picked, hooks
- [Post-MVP](post-mvp.md) — what's next; backlog of deferred work

## What is kadai?

Kadai is a local-first product spine for projects whose code is written largely by agents. It tracks a hierarchical scope (epics → features → stories → tasks) as **markdown files committed to your repo** and exposes typed **MCP tools + Claude Code hooks** so agents stay honest to the spine — they can't edit code that doesn't map to a picked story.

Three things ship:

1. A **CLI** (`kadai`) for managing the spine from the terminal.
2. An **MCP server** (`kadai mcp`) that exposes the spine to agents through typed tools.
3. A **web viewer** (`kadai serve`) showing the roadmap-primary view at localhost.

Plus a **Claude Code plugin** (`kadai-plugin/`) that auto-triggers a guidance skill on planning language and provides `/kadai-pick` and `/kadai-status` slash commands.

## Discipline: keep docs up to date

When you change user-facing behavior — a CLI flag, a config key, the MCP tool surface, the hook protocol, the plugin — **update the relevant page in this directory in the same commit**. The kadai skill (in the bundled plugin) reminds agents of this before they mark a story done.
