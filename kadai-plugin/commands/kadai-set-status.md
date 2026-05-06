---
description: Update the status of a kadai item (validated against the state machine)
allowed-tools: Bash, mcp__kadai__set_status, mcp__kadai__get
argument-hint: <id> <status>
---

The user wants to set a kadai item's status. The arguments are `$ARGUMENTS` — first the ID (like `STORY-042`), then the status (`backlog | ready | in_progress | blocked | review | done | cancelled`).

## What to do

1. **Parse the args.** Need both an ID (matching `(EPIC|FEAT|STORY|TASK)-\d+`) and a status. If either is missing or invalid, tell the user the expected form (`/kadai-set-status STORY-001 review`) and stop.

2. **Verify the item exists** via `mcp__kadai__get` with the ID. If null, report and stop.

3. **Set the status** via `mcp__kadai__set_status` with the ID and status. The MCP tool validates against the state machine; if the transition is illegal, it returns an error message — pass that back to the user.

4. **Confirm:** print "✓ ID → status".

## If the MCP tools aren't available

Fall back to the CLI:

```bash
kadai set-status $ARGUMENTS
```

This does the same thing.

## Common transitions

- `STORY-001 in_progress` — start work (also done automatically by `/kadai-pick`)
- `STORY-001 review` — work done, awaiting PR review
- `STORY-001 done` — shipped
- `STORY-001 blocked` — stuck, needs human input
- `STORY-001 cancelled` — explicitly killed
