# /kadai-plan-compose

Render all descendant story plans of an epic, feature, or story as one composite markdown document.

## Usage

```
/kadai-plan-compose EPIC-001
/kadai-plan-compose FEAT-005
/kadai-plan-compose STORY-012
```

## When to use

- Pre-implementation review: "show me the whole plan for this epic before I kick off /kadai-run"
- Cross-story consistency check: spot tasks that depend on each other across stories
- PR description / archive: paste the whole composite into a PR body

Backed by `kadai plan compose <id>` CLI.
