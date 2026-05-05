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

Claude Code plugins come from **marketplaces**. The kadai repo is itself a single-plugin marketplace (defined by `.claude-plugin/marketplace.json` at the repo root). Two steps:

```
# 1. Register the kadai repo as a marketplace
/plugin marketplace add /path/to/kadai-repo

# 2. Install the kadai plugin from that marketplace
/plugin install kadai@kadai
/reload-plugins
```

After installing, the skill auto-triggers on relevant prompts. The slash commands `/kadai-pick` and `/kadai-status` become available.

Verify: `/help` should list the `kadai` skill among installed skills, and `/kadai-pick STORY-001` should be a known command (even if it errors because no story exists).

## Uninstall

```bash
/plugin uninstall kadai
```
