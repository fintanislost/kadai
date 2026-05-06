---
description: Clear the picked-story flag (does NOT change the story's status)
allowed-tools: Bash, mcp__kadai__unpick
---

The user wants to clear the picked-story flag.

## What to do

1. Call `mcp__kadai__unpick` (no arguments).
2. Confirm: print "✓ unpicked — no story is currently picked".

Note: this does NOT change the picked story's status. If the story was `in_progress`, it stays `in_progress`. To also revert status, the user would need `/kadai-set-status STORY-XXX ready` or similar.

## If the MCP tools aren't available

Fall back to the CLI:

```bash
kadai unpick
```
