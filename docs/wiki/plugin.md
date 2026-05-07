# Claude Code plugin

The kadai-plugin/ directory is an installable Claude Code plugin.

## What it provides

- **`kadai` skill** — auto-triggers on planning/scoping language (*plan, implement, build, design, story, feature, epic, scope, MVP*). Teaches Claude the canonical kadai workflow: check active story → pick → plan → set status. Tells Claude to check the [`docs/wiki/`](.) for any user-facing change before marking a story done.
- **`/kadai-add <kind> [title]`** — guided creation of any item kind, asking for parent and phase when needed.
- **`/kadai-pick <story-id>`** — picks a story (via MCP `pick_story` + `set_status(in_progress)`, with CLI fallback).
- **`/kadai-status`** — prints picked + in-progress + ready queue.
- **`/kadai-set-status <id> <status>`** — set status to any state machine value (e.g., `STORY-001 review`).
- **`/kadai-unpick`** — clear the picked-story flag (does not change status).
- **`/kadai-run`** — start or resume the autonomous runner (see Wrapper skills section below).
- **`/kadai-plan-compose <id>`** — render all descendant story plans of an epic/feature/story as one composite markdown document.

## Install

Claude Code plugins come from **marketplaces** — a directory with a `marketplace.json` listing one or more plugins. The kadai repo IS its own single-plugin marketplace (declared at `.claude-plugin/marketplace.json`).

In a Claude Code session:

```
# 1. Register the kadai repo as a marketplace
/plugin marketplace add /path/to/kadai-repo

# 2. Install the kadai plugin from it
/plugin install kadai@kadai
/reload-plugins
```

The first step adds the kadai marketplace to Claude Code's known marketplaces (recorded in `~/.claude/plugins/known_marketplaces.json`). The second installs the `kadai` plugin from it.

This is **per-user** — the plugin is loaded for your Claude Code, not per-project. The plugin's slash commands and skill are then available in any project where kadai has been initialized.

> **Why a marketplace and not a direct path install?** Claude Code's plugin install model is built around marketplaces (a single source can publish many plugins, with versioning, etc.). Even for a one-plugin source like kadai, the marketplace abstraction is required — `/plugin install <local-path>` is not a supported syntax.

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

## Wrapper skills (kadai-brainstorming, kadai-writing-plans, kadai-runner)

The plugin ships three **wrapper skills** on top of the global superpowers skills. These are the **recommended** way to run brainstorming and planning inside a kadai project:

| Skill | Wraps | What it adds |
|---|---|---|
| `kadai-brainstorming` | `superpowers:brainstorming` | After the upstream skill finishes, attaches the resulting spec to the correct feature via `attach_spec`. Writes the file into `.kadai/…/spec.md` rather than `docs/superpowers/specs/`. |
| `kadai-writing-plans` | `superpowers:writing-plans` | After the upstream skill finishes, attaches the resulting plan to the correct story via `attach_plan`. Also creates tasks in the spine from the plan's task list. |
| `kadai-runner` | _(standalone)_ | Autonomous story runner. Picks the next ready story, dispatches an implementer subagent via Claude Code's Task tool, monitors for blockers, handles fast-follow-up feature requests, and persists state to `.kadai/runner.json` across sessions. |

### Using the wrappers

Invoke them explicitly in your prompt to ensure the wrapper fires:

```
Use kadai-brainstorming to design the authentication feature.
Use kadai-writing-plans to write implementation plans for FEAT-002.
```

Or start the autonomous runner with the `/kadai-run` slash command.

> **Why wrappers?** Skill matching is heuristic. If you use a bare "brainstorm X" prompt, Claude may load `superpowers:brainstorming` instead of `kadai-brainstorming`. The upstream skills still work — your spec/plan will be written — but the spine plumbing (attach_spec, attach_plan, task creation) won't run automatically. Being explicit, or invoking `/kadai-run`, is the reliable path.

### `/kadai-run` slash command

`/kadai-run` is the entry point for the runner. It reads `.kadai/runner.json` to decide whether to start a new run or resume a paused one. Internally it uses the `kadai-runner` skill and Claude Code's `Task` tool to dispatch implementer subagents.

```
/kadai-run          # start or resume; dispatches the next picked story
```

Runner state is preserved across sessions in `.kadai/runner.json`. From the CLI you can inspect it with `kadai run --status` (see [CLI reference](cli-reference.md)).

### `/kadai-plan-compose` slash command

```
/kadai-plan-compose EPIC-001     # render all descendant story plans as one composite doc
```

Equivalent to `kadai plan compose <id>` but runs inside a Claude Code session with MCP context already available.

## What the plugin doesn't do

- It doesn't install kadai's CLI — that's a separate `bun link` step ([getting started](getting-started.md)).
- It doesn't install hooks or MCP server — those are per-project, configured by `kadai init`.
- It doesn't provide `/kadai-sync` — that is post-MVP.

## Why is the plugin separate from `kadai init`?

`kadai init` installs project-scoped artifacts (`.kadai/`, `.mcp.json`, hooks). Those need to be in the project directory.

The plugin is a Claude Code-scoped concept — once you install it, it's available across all your projects. `kadai init` doesn't need to know it exists; the project's `.mcp.json` registers the MCP server independently.
