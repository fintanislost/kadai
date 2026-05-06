---
description: Create a kadai item (epic, feature, story, or task) with prompts for missing fields
allowed-tools: Bash, mcp__kadai__create_epic, mcp__kadai__create_feature, mcp__kadai__create_story, mcp__kadai__create_task, mcp__kadai__list_phases, mcp__kadai__list_epics, mcp__kadai__list_features, mcp__kadai__list_stories, mcp__kadai__get
argument-hint: <kind> [title]
---

The user wants to create a kadai item. The arguments are `$ARGUMENTS` — the first word should be the kind (`epic`, `feature`, `story`, or `task`); anything after is treated as the title.

## What to do

1. **Parse the kind.** Must be one of `epic | feature | story | task`. If invalid or missing, ask the user.

2. **Determine the title.** If text follows the kind in `$ARGUMENTS`, use it; otherwise ask the user for a title.

3. **For non-task kinds, determine the phase.** Default to `mvp` unless the user specifies. Call `mcp__kadai__list_phases` if you need to confirm the available phases.

4. **For non-epic kinds, determine the parent.**
   - feature → parent epic (use `mcp__kadai__list_epics`)
   - story → parent feature (use `mcp__kadai__list_features`)
   - task → parent story (use `mcp__kadai__list_stories`)

   If the user didn't say which parent, look up candidates and ask the user to pick one. If exactly one candidate exists, use it without asking.

5. **Call the matching MCP create tool:**
   - `mcp__kadai__create_epic({ title, phase, description })`
   - `mcp__kadai__create_feature({ parent_epic, title, phase, description })`
   - `mcp__kadai__create_story({ parent_feature, title, phase, description, acceptance_criteria? })`
   - `mcp__kadai__create_task({ parent_story, title, description, plan_step? })`

   Pass empty `description: ""` if the user didn't provide one (the create tool will use a placeholder body).

6. **Confirm:** print the new item's ID and a one-line next step (e.g., for an epic: "Next: `/kadai-add feature` under EPIC-XXX").

## If the MCP tools aren't available

Fall back to the CLI:

```bash
kadai add $ARGUMENTS    # may need additional flags depending on kind
```

The CLI prompts for missing fields too.
