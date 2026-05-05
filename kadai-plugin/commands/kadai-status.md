---
description: Show the picked story, in-progress queue, and recent activity
allowed-tools: Bash, mcp__kadai__get_active_story, mcp__kadai__list_stories
---

The user wants to see kadai status.

## What to do

1. **Picked story** — call `mcp__kadai__get_active_story`. If non-null, print "Picked: ID — title". If null, print "Nothing picked".

2. **In progress** — call `mcp__kadai__list_stories` with `status: "in_progress"`. List ID + title for each.

3. **Ready queue** — call `mcp__kadai__list_stories` with `status: "ready"`. List ID + title for each (top 10 if there are many).

4. **Format compactly.** Total output should fit in ~30 lines.

## If the MCP tools aren't available

Fall back to the CLI:

```bash
kadai status
```

This produces the same information (formatted with colors).
