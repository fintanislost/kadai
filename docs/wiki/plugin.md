# Claude Code plugin

The kadai-plugin/ directory is an installable Claude Code plugin.

## What it provides

- **`kadai` skill** — auto-triggers on planning/scoping language (*plan, implement, build, design, story, feature, epic, scope, MVP*). Teaches Claude the canonical kadai workflow: check active story → pick → plan → set status. Tells Claude to check the [`docs/wiki/`](.) for any user-facing change before marking a story done.
- **`/kadai-pick <story-id>`** — picks a story (via MCP `pick_story` + `set_status(in_progress)`, with CLI fallback).
- **`/kadai-status`** — prints picked + in-progress + ready queue.

## Install

In a Claude Code session:

```
/plugin install /path/to/kadai-repo/kadai-plugin
/reload-plugins
```

This is **per-user** — the plugin is loaded for your Claude Code, not per-project. The plugin's slash commands and skill are then available in any project where kadai has been initialized.

## Verify

The skill loaded:

```
/help    # the kadai skill should appear in the available skills list
```

The slash commands loaded:

```
/kadai-pick STORY-001   # try it (will fail gracefully if no kadai project / no story)
/kadai-status
```

## Uninstall

```
/plugin uninstall kadai
```

## What the plugin doesn't do

- It doesn't install kadai's CLI — that's a separate `bun link` step ([getting started](getting-started.md)).
- It doesn't install hooks or MCP server — those are per-project, configured by `kadai init`.
- It doesn't provide `/kadai-add`, `/kadai-sync`, or `/kadai-unpick` — those are post-MVP.

## Why is the plugin separate from `kadai init`?

`kadai init` installs project-scoped artifacts (`.kadai/`, `.mcp.json`, hooks). Those need to be in the project directory.

The plugin is a Claude Code-scoped concept — once you install it, it's available across all your projects. `kadai init` doesn't need to know it exists; the project's `.mcp.json` registers the MCP server independently.
