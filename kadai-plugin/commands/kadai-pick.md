---
description: Pick a kadai story for active work (sets it as picked AND transitions to in_progress)
allowed-tools: Bash, mcp__kadai__pick_story, mcp__kadai__set_status, mcp__kadai__get
argument-hint: <story-id>
---

The user is picking a kadai story. The argument is `$ARGUMENTS` (typically a story ID like `STORY-042`).

## What to do

1. **Validate the ID** — must match `STORY-\d+` (e.g., `STORY-001`). If invalid, tell the user and stop.

2. **Verify the story exists** by calling `mcp__kadai__get` with the ID. If it doesn't exist, tell the user and stop.

3. **Pick it** by calling `mcp__kadai__pick_story` with the ID. This sets the picked-story flag (used by the PostToolUse hook for change capture).

4. **Transition status to `in_progress`** by calling `mcp__kadai__set_status` with `status: "in_progress"`. If the transition is illegal (e.g., the story is already `done`), report the error.

5. **Confirm to the user**: print the picked story's ID + title, plus a short next-step suggestion ("ready to work — start by reading the spec/plan if attached").

## If the MCP tools aren't available

Fall back to the CLI:

```bash
kadai pick $ARGUMENTS
```

This does the same thing (sets picked + transitions to in_progress).
