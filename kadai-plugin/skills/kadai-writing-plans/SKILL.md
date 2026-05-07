---
name: kadai-writing-plans
description: "Use INSTEAD OF superpowers:writing-plans when writing implementation plans inside a kadai-tracked repo (`.kadai/` present). Decomposes the feature into kadai stories, writes one `plan.md` per story directly into the spine (`.kadai/.../stories/<id>/plan.md`), and creates one real kadai task for each `### Task N` block. Auto-picks the first story when done. Without this wrapper you'll produce a single freeform plan that someone has to translate into spine items by hand."
---

# Kadai-aware writing-plans

Wraps `superpowers:writing-plans`. The "DRY / YAGNI / TDD / frequent commits" discipline, the bite-sized step granularity, the "no placeholders" rule, the self-review pass — all unchanged. The wrapper only changes WHERE the plan lands and HOW it maps to the spine.

## What this skill adds

Plans no longer come out as one big `<feature>.md`. They're sliced **per story**, and each `### Task N` becomes a real kadai task.

### 1. Read the feature spec

```bash
# The feature was attached by kadai-brainstorming; read its spec:
kadai get-file <feature-id> spec.md
```

(Or via MCP: `kadai.get_file(feature_id, 'spec.md')`.)

### 2. Decompose into stories

- Read the spec's "Implementation notes" or "Suggested implementation tasks" section if present — that's usually a natural story boundary.
- Otherwise, propose a decomposition: "I see N stories here: [list of titles]. Each should be small enough to implement in one session. Confirm or revise."
- Wait for user approval. Story decomposition is the most user-facing decision in this flow — don't auto-confirm.

### 3. Create the stories

For each approved story:

```bash
kadai add story --feature <feature-id> --title "<name>" --phase <inherited from feature>
```

(Or via MCP: `kadai.create_story(...)`.) Capture the returned story IDs.

### 4. Write per-story plans

For each story, run the upstream writing-plans question content (file structure, task decomposition, code blocks per step) but limit the scope to **just that story's tasks**. Don't include cross-story tasks in the same plan.

Output: one `plan.md` per story, written via `kadai attach_plan <story-id> <tmp-path>`.

### 5. Create the tasks

For each `### Task N: <title>` block in each plan, create a real kadai task:

```bash
kadai add task --story <story-id> --title "<title>"
```

Back-reference the task ID in the plan as a comment: `<!-- TASK-001 -->` immediately after the heading. This lets the runner correlate plan tasks with spine tasks.

### 6. Self-review per story

Run the per-story self-review (placeholder scan, type consistency, spec coverage). The cross-story consistency check ("does Task 7 in STORY-002 align with the deliverable from STORY-001?") is harder; flag uncertainties for the user.

### 7. Auto-pick the first story

```bash
kadai pick STORY-001
# kadai pick auto-transitions to in_progress
```

### 8. Present the runner option

Tell the user:

> "Plans written and attached. Three execution options:
> 
> 1. **`kadai run` (autonomous)** — runner walks the stories one by one, dispatches subagents per task, pauses for review at story boundaries.
> 2. **Subagent-driven (manual)** — I dispatch a subagent per task, you review between tasks. (`superpowers:subagent-driven-development`)
> 3. **Inline** — I execute the tasks in this session with checkpoints. (`superpowers:executing-plans`)
> 
> Which approach?"

If the user picks `kadai run`, invoke the `kadai-runner` skill (or run `/kadai-run` directly).

## Detection: am I in a kadai repo?

Same check as `kadai-brainstorming`. If `.kadai/` is missing, fall through to `superpowers:writing-plans` and warn.

## Anti-patterns

- **Don't write to `docs/superpowers/plans/`.** Plans live under `.kadai/.../stories/<id>/plan.md`.
- **Don't auto-create stories without showing the user the proposed decomposition.** Story shape is the most opinionated decision the wrapper makes.
- **Don't skip the kadai-add-task step.** Without it, the runner can't track per-task progress.
- **Don't try to compose cross-story dependencies in the plan.** The spine carries dependency edges (`dependsOn` field on the story); plans stay scoped to their own story.

## See also

- Upstream writing-plans: `superpowers:writing-plans` (do NOT load both)
- Composite review: `kadai plan compose <epic-id>` renders all per-story plans as one document.
- Next step: `kadai-runner` (or one of the manual execution skills).
