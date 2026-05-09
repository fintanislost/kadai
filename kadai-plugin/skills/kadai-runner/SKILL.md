---
name: kadai-runner
description: "Autonomous executor for kadai-tracked work. Picks up where kadai-writing-plans leaves off — walks the picked story's plan task-by-task, dispatches an implementer subagent for each ### Task block, runs spec + code-quality reviews per task, marks tasks done as it goes. Pauses for human review at story boundaries. When an implementer reports BLOCKED with reason `needs-feature: <desc>`, surfaces a prompt to plan a fast-follow-up unblocker via kadai-brainstorming, executes the unblocker, then resumes the original story. State persisted in `.kadai/runner.json`; resumable across sessions via `kadai run --resume`."
---

# Kadai runner

Use after `kadai-writing-plans` (or whenever a story is picked and has a plan.md). Combines `superpowers:subagent-driven-development` (per-task implementer + reviews) with kadai-specific orchestration (state machine, fast-follow-up unblocking).

## How to use

User says "run it" / "execute the plan" / "kadai run":

1. Read `.kadai/runner.json` (via `kadai run --status`) — what state are we in?
2. If `idle` and a story is picked → start.
3. If `paused-needs-feature` → present the unblocker decision (see below).
4. If `paused-review` → present the story summary, ask "advance to next?"
5. If `paused-blocked` → present the blocker, ask user how to proceed.

## Per-task loop

For each `### Task N` in the picked story's `plan.md`:

1. Mark the kadai task `in_progress` (`kadai set-status TASK-XXX in_progress`).
2. Dispatch an implementer subagent — same template as `superpowers:subagent-driven-development`'s implementer-prompt. Pass: full task text, surrounding context (story title, spec, relevant prior tasks).
3. Wait for outcome: `DONE` / `DONE_WITH_CONCERNS` / `BLOCKED` / `NEEDS_CONTEXT`.
4. On `DONE`: dispatch spec compliance review subagent; on review pass, dispatch code quality review subagent; on quality pass, mark task `done`. (Same two-stage review as the upstream pattern.)
5. On `BLOCKED`: parse the reason. If it starts with `needs-feature:` → see "Fast-follow-up flow" below. Otherwise → write state `paused-blocked` and surface the blocker.
6. On `NEEDS_CONTEXT`: provide the missing context if you have it (story spec, surrounding plan tasks); otherwise pause.

After all tasks: set the story `review`, write state `paused-review`, summarize, ask user to advance.

## Fast-follow-up flow

When an implementer says `BLOCKED: needs-feature: <description>`:

1. Pause: state → `paused-needs-feature`. The original story + task are pushed onto the pausedStack.
2. Present:
   ```
   STORY-XXX hit a blocker on Task N.
   
   The implementer believes a fast-follow-up feature is needed:
     Title: <suggested>
     Why:   <description>
   
   Plan it now and resume after? [Y/n/skip]
   ```
3. **If Y:** invoke `kadai-brainstorming` in fast-follow-up scope:
   - Constrained: brief design (5 min, not 30), default `mvp` phase, propose 1-3 stories max.
   - At spec attach time, also call `recordDependencyEdge(STORY-XXX, FEAT-NEW)` so the original story's frontmatter shows `dependsOn: [FEAT-NEW]`.
   - Then invoke `kadai-writing-plans` for the new feature. First story of the unblocker auto-picks.
   - Return to runner: `kadai run` (it will detect the new picked story and execute the unblocker).
4. **If n:** mark the original story `blocked` (kadai status), runner state → `idle`, tell user manual intervention is needed.
5. **If skip:** same as n but with a `bypass.log` entry noting the skip reason.

When the unblocker finishes (`story-done` AND `pausedStack` is non-empty), the runner automatically:
- Pops the pausedStack
- Re-picks the original story (`kadai pick STORY-XXX`)
- Continues from the task that was paused.

## Resume semantics

`/kadai-run` (or `kadai run --resume`) consults `.kadai/runner.json`:
- `idle` + story picked → start fresh
- `running` → resume the loop (means a prior session crashed; pick up where state.currentTaskId says)
- `paused-*` → present the appropriate decision UI

Idempotent: re-running while still in `paused-needs-feature` re-presents the prompt; no auto-advance.

## What this skill does NOT do (v1)

- **Parallel story execution.** Sequential only.
- **Auto-merging the unblocker's deliverable into the original plan.** When STORY-007 resumes, its plan.md is the same as before. If that plan is now wrong (because the unblocker changed assumptions), the implementer will report it and we'll re-pause-needs-feature.
- **Concurrent runners.** One `kadai run` process at a time. (Easy follow-up: pid file.)
- **Recovering from half-failed implementer subagents.** If a subagent crashes mid-task with the file system in a partial state, pause and tell the user.

## See also

- CLI: `kadai run` (informational; just prints state) and `kadai run --status`.
- Composite review: `kadai plan compose <epic-id>` — render all per-story plans as one document, e.g., before kicking off a fresh run.
- Hooks (the safety net): the PreToolUse gate still bites if an implementer tries to write outside the picked story's scope.
