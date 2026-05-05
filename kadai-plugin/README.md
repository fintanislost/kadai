# Kadai Plugin

A Claude Code plugin for the [kadai](https://github.com/fintan/kadai) product spine.

## What's inside

- **`kadai` skill** — auto-triggers when you mention planning, implementing, building, designing, scoping, or working on stories/features/epics. Teaches Claude the canonical kadai workflow.
- **`/kadai-pick <story-id>`** — picks a story for active work (sets it as picked, transitions status to `in_progress`).
- **`/kadai-status`** — prints the picked story, in-progress queue, and ready stories.

## Prerequisites

- The `kadai` CLI installed and on your PATH (`bun link` from the kadai repo, or `npm i -g kadai` once published).
- A project with `.kadai/` initialized (`kadai init`).

## Install

```bash
# From a Claude Code session:
/plugin install /path/to/kadai-plugin
/reload-plugins
```

After installing, the skill auto-triggers on relevant prompts. The slash commands `/kadai-pick` and `/kadai-status` are available.

## Uninstall

```bash
/plugin uninstall kadai
```
