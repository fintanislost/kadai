# Kadai-aware brainstorming + writing-plans wrappers — design spec

**Status:** Draft 2026-05-06. Exploration. Lives on `feature/kadai-aware-skills` so we can swap back to hooks-only enforcement if this doesn't pan out.

## Motivation

Two problems surfaced during the first real testpro2 dogfood of the Plan-17 viewer:

1. **Skill auto-loading is best-effort, not deterministic.** A user prompt like "Could we plan and build a small website here, an MVP for a blog?" matches the upstream `superpowers:brainstorming` description directly. Claude loads brainstorming and runs the full flow before the kadai SKILL.md ever gets a chance to fire. We made the kadai skill description more aggressive (commit `88b61e0`), but it's still a popularity contest between skill descriptions, not enforcement. The kadai workflow only happens if Claude voluntarily reads our skill.

2. **The plan→spine translation is lossy and post-hoc.** Today, `superpowers:writing-plans` produces one freeform `<feature>.md` with N tasks. Whoever (agent or human) reads that plan then has to mentally map it onto kadai's hierarchy: "this is one feature with three stories, each story owns these four tasks." That translation is inconsistent across sessions, often skipped entirely, and the relationship between a plan's "Task 7" and a kadai task is never explicit. Plans drift from the spine the moment they're written.

The fix is to invert the relationship: have a **kadai-aware planning flow** that thinks in spine shape upfront and emits artifacts directly into the spine, with the hooks as the safety net rather than the primary enforcement.

## Goals

- A user prompt that triggers brainstorming + writing-plans in a `.kadai/`-bearing repo runs through **kadai-aware** versions of those flows by default.
- The brainstorming flow ends by creating an **epic + feature** in the spine and attaching the spec as `feature.spec`, not by leaving a free-floating `docs/superpowers/specs/*.md`.
- The writing-plans flow decomposes the work into **kadai stories** and emits **one `plan.md` per story** directly into the story's directory, with each plan's `### Task N` blocks corresponding 1:1 to real `kadai add task` calls.
- A new `kadai run` command auto-executes the planned work story-by-story, pausing for confirmation at story boundaries and pausing-with-escalation when the implementer hits a blocker that requires a fast-follow-up feature to unblock.
- A new `kadai plan compose <epic-id>` (or `<feature-id>`) command renders all descendant per-story plans as one composite document for human review, so the "read the whole thing top-to-bottom" use case stays intact.
- Hooks stay in place as a safety net — if an agent skips the wrapper for whatever reason, the PreToolUse gate still bites on the first off-spine `Edit`/`Write`.

## Non-goals

- Breaking compatibility with `superpowers:brainstorming` and `superpowers:writing-plans`. The wrappers are additive, not replacement.
- Forking the upstream skills' question content. We invoke their flow and add kadai-specific pre/post.
- Changing kadai's data model. Epics → features → stories → tasks stays the same; we just write to it more deterministically.
- Remote / multi-user collaboration. Out of scope, same as kadai's MVP.

## Audience

The wrapper exists for **two failure modes** observed in real use:

- **Agents skipping the kadai discipline** because the upstream skill matched first. They produce a spec in the wrong place, never call `kadai create_feature`, and the spine has no record of the work.
- **Humans manually translating plans to spine items** — error-prone and tedious. Even with discipline, the translation is inconsistent across sessions.

## Approach

Three new artifacts in `kadai-plugin/`:

1. **`skills/kadai-brainstorming/SKILL.md`** — wrapper around `superpowers:brainstorming`
2. **`skills/kadai-writing-plans/SKILL.md`** — wrapper around `superpowers:writing-plans`
3. **`commands/kadai-plan-compose.md`** + a backing CLI subcommand `kadai plan compose <id>`

The kadai skill's existing description gets one more sentence: *"When the user requests planning, brainstorming, or new feature work, prefer `kadai-brainstorming` and `kadai-writing-plans` over the upstream variants."*

### `kadai-brainstorming` skill

Description (frontmatter):
> "Use instead of `superpowers:brainstorming` when working in a `.kadai/`-bearing repo. Runs the full brainstorming flow (explore → questions → approaches → design → spec) and then plumbs the result into the kadai spine: creates the epic if needed, creates the feature, attaches the spec as `feature.spec`. The single visible artifact at the end is a feature in `.kadai/` with its `spec.md` attached, not a free-floating doc."

Internal flow:

1. **Pre-step:** detect `.kadai/`. If absent, fall through to upstream brainstorming and emit a warning that this skill is a no-op outside kadai-tracked repos.
2. **Run upstream brainstorming verbatim** for the explore → questions → approaches → design → user-approval steps. The wrapper does not touch question content; it inherits all of it.
3. **At the spec-writing step**, instead of writing to `docs/superpowers/specs/<topic>-design.md`:
   1. Ask the user (or infer): "Does this map to a new epic, or an existing one?"
   2. If new: `kadai create_epic --title <suggested> --phase <suggested>` (default mvp).
   3. `kadai create_feature --title <suggested> --epic <id>` — store the spec at the feature's directory.
   4. Write the spec content to a temp file, then `kadai attach_spec <feature-id> <temp-path>`.
4. **Self-review pass** (same as upstream).
5. **User review gate** (same as upstream, but the linked path is the feature's spine path, not a `docs/superpowers/` path).
6. **Hand off:** invoke `kadai-writing-plans` instead of `superpowers:writing-plans`.

### `kadai-writing-plans` skill

Description (frontmatter):
> "Use instead of `superpowers:writing-plans` after `kadai-brainstorming` (or any time you're writing a plan inside a kadai-tracked repo). Decomposes the spec's feature into kadai stories, emits one `plan.md` per story directly into the spine (`.kadai/.../stories/<id>/plan.md`), and creates the corresponding tasks via `kadai add task` so each `### Task N` in the plan is also a real spine task. Picks the first story automatically when done."

Internal flow:

1. **Pre-step:** detect `.kadai/`. If absent, fall through with a warning.
2. **Read the feature spec** (`kadai get_file <feature-id> spec.md`).
3. **Decompose into stories:** ask the user (or propose from the spec's "Implementation notes" section): "I see N stories here. Confirm or revise: [list]." Each story gets a title + a phase (default to feature's phase).
4. **Create the stories:** `kadai create_story --feature <id> --title ... --phase ...` for each.
5. **Per story**, run the upstream writing-plans question content (file structure, task decomposition, code blocks per step) but emit the result as `<story-id>'s plan.md` rather than a single doc. The plan covers ONLY that story's tasks.
6. **For each `### Task N` in each plan**, call `kadai create_task --story <id> --title <task-name>`. The task ID is captured and back-referenced in the plan as `<!-- TASK-001 -->` so the executor can find it.
7. **Attach plan.md** to the story via `kadai attach_plan <story-id> <temp-path>`.
8. **Self-review** (per-story).
9. **Pick the first story:** `kadai pick STORY-001` and `kadai set-status STORY-001 in_progress`.
10. **Hand off:** present execution choice (subagent-driven recommended).

### `kadai plan compose <id>` CLI subcommand

Reads all descendant `plan.md` files (story-level) under the given epic or feature ID and renders them as one composite document, in the order they appear in the spine. Output is markdown to stdout (or a file with `--out`). Use cases:

- Pre-implementation review: "show me the whole plan for EPIC-001 before I kick off subagents."
- Cross-story consistency check: "does Task 7 in STORY-002 match what STORY-001 promised?"
- Archive / pasteable PR description.

Composition format:

```markdown
# Composite plan — EPIC-001 Authentication
> Generated 2026-05-06T14:30:00Z from N story plans.

## STORY-001 — Magic link delivery
[contents of story-001/plan.md verbatim]

## STORY-002 — Password reset
[contents of story-002/plan.md verbatim]

...
```

Tasks are already self-contained per story; no cross-story dependency analysis in v1.

## Data model implications

No schema changes. Existing files used:

- `.kadai/epics/<E>/features/<F>/spec.md` — the feature's spec (was already a thing; now ALWAYS populated by the wrapper).
- `.kadai/epics/<E>/features/<F>/stories/<S>/plan.md` — the story's plan (was already a thing; now ALWAYS populated, one per story).
- Tasks in the story's frontmatter or as separate `tasks/` files (use whatever kadai already does — Plan 17 didn't change this).

The composite-plan rendering reads from these files; no caching, no derived state.

## Failure modes + fallbacks

- **Wrapper skill not loaded** → upstream skill runs, produces a freeform `docs/superpowers/...` doc. PreToolUse hook gates the implementation phase as today. We're no worse off; we just lose the spine plumbing for that one session. The user can re-run the kadai-aware version or manually attach.
- **`.kadai/` missing in repo** → wrapper detects, falls through to upstream, warns once.
- **User rejects the proposed feature/story decomposition** → wrapper rolls back the spine writes (delete the partially-created epic/feature/stories) and goes back to the question step. Important: every spine create needs a corresponding rollback path.
- **Plan changes mid-execution** (user says "actually we need a 4th story") → manual `kadai add story` + add a `### Task` block to the new story's plan. The compose command will pick it up automatically next render.

## Out of scope (for v1)

- Auto-detecting story decomposition from the spec without user confirmation. We always ask.
- Fancy diff between the composite plan and the actual spine state ("plan says 4 stories, spine has 5 — which is right?"). User-facing tool, not a v1 priority.
- Cross-feature plans (one plan that spans multiple features). Probably not desirable anyway; if it spans features, it should be at the epic level, which the compose command already handles.
- Templating systems for plan.md content. The plan structure stays whatever upstream writing-plans produces, just with story-scoped content.

## Acceptance criteria

This ships when:

1. A user prompt "let's build X" in a `.kadai/`-bearing repo invokes `kadai-brainstorming`, not `superpowers:brainstorming`. (Verified by reading the session transcript or `Skill(...)` tool calls.)
2. At the end of brainstorming, a feature exists in the spine with `spec.md` attached. No `docs/superpowers/specs/<topic>-design.md` is created.
3. After writing-plans completes, every story has its own `plan.md`, and `kadai list tasks --story STORY-XXX` returns the same task titles that appear as `### Task N` headings in that story's plan.
4. `kadai plan compose EPIC-001` renders all descendant story plans as one document, in spine order.
5. The PreToolUse guardrail still bites if the wrapper is somehow skipped — the skill update doesn't replace the hook, it complements it.
6. Existing `superpowers:brainstorming` and `superpowers:writing-plans` flows continue to work in non-kadai repos (no regression).

## Suggested implementation tasks (for the planning phase)

1. **`kadai-brainstorming` SKILL.md** — wrapper with `.kadai/` detect + the pre-spec-write spine plumbing prompts (auto-create epic, attach spec, rework-by-replace).
2. **`kadai-writing-plans` SKILL.md** — wrapper with per-story plan slicing + auto `kadai add task` for each `### Task N` + auto-pick first story.
3. **`kadai plan compose <id>` CLI** — small subcommand: read spine, walk descendants, concatenate `plan.md` content. ~80 lines + tests.
4. **`kadai run` CLI** — the runner engine. `.kadai/runner.json` state, per-story dispatch loop, blocker detection, resume semantics. The biggest single chunk; probably 2-3 sub-tasks (state model + loop + blocker handling).
5. **`kadai-runner` skill + `/kadai-run` slash command** — the Claude Code surface for the runner, including the fast-follow-up pause UX (the "plan the unblocker now?" prompt that invokes `kadai-brainstorming --scope=fast-followup`).
6. **Plugin manifest** — `kadai-plugin/.claude-plugin/plugin.json` register the three new skills + two new slash commands (`/kadai-plan-compose`, `/kadai-run`). Bump to 1.4.0.
7. **Plugin commands** — `commands/kadai-plan-compose.md`, `commands/kadai-run.md`.
8. **Documentation:**
   - `docs/wiki/plugin.md` — describe the wrapper skills + runner.
   - `docs/wiki/troubleshooting.md` — entries for "wrapper didn't fire", "runner stuck in paused-needs-feature", "runner state corrupt".
   - `docs/wiki/cli-reference.md` — `kadai plan compose`, `kadai run`.
   - `docs/wiki/concepts.md` — section on the runner state model + the fast-follow-up dependency edge.
9. **Dogfood test (`claude -p`-based)** — fresh `mktemp -d` repo, run `claude -p "let's plan a small CLI for X"`, then `kadai run`, with a planted scenario that triggers a `paused-needs-feature` to verify the unblock flow works end-to-end. Assert on spine state at each pause point. This subsumes the file-shape test from the original plan.

## Resolved questions (from spec review)

- **`kadai-brainstorming` auto-creates the epic** if no existing epic matches. The brainstorming flow already proposes a project-shaped name; we use that as the epic title and default phase to `mvp`. The user can override during the standard "does this look right?" gate. Keeps the wrapper from front-loading kadai-specific friction onto a flow that's already 5+ questions deep.
- **Re-running brainstorming on an existing feature is reworking it.** Treat the new spec as the canonical replacement: `kadai attach_spec --replace <feature-id>`. Old spec content is preserved in the feature's directory as `spec.<timestamp>.md.bak` for audit. Stories under that feature stay; the user can rerun `kadai-writing-plans` to regenerate plans if the rework is large.
- **Dogfood test invokes the actual flow via `claude -p`** rather than asserting on file structure. Plan 17's CSS bug taught us that build-time green ≠ runtime correct — a test that builds the wrappers but doesn't actually run a brainstorm + plan + first-task end-to-end against a temp project will miss exactly the kind of skill-loading + spine-write integration this spec is trying to fix. The dogfood test is therefore a `claude -p "let's plan a small CLI for X"` invocation in a `mktemp -d` repo, with assertions on the resulting spine state (epic exists, feature exists, spec attached, N stories with N plans, first story picked).

## Auto-running the planned work — the kadai runner

Late-binding requirement. Once brainstorming + writing-plans have populated the spine, the user shouldn't have to manually pick STORY-001 and dispatch implementer subagents one at a time. A **runner** picks up where writing-plans leaves off and works through the planned stories autonomously, with controlled pause points when the work hits a blocker that can't be resolved within the current story's scope.

### Concept

Two surfaces:

1. **`kadai run` CLI command** — the headless engine. Reads the spine, picks the next ready or in-progress story, dispatches an implementer (subagent or local), tracks per-task progress, and persists state across invocations.
2. **`/kadai-run` slash command + `kadai-runner` skill** — the Claude Code surface. Wraps the CLI + handles the conversational pause/resume UX (the "do you want to plan the unblocker now?" prompt).

Both share the same state model so a session can switch between them.

### State model

A runner is in one of these states, persisted at `.kadai/runner.json`:

- **idle** — nothing in flight. Default.
- **running** — actively executing a story. Records: which story, which task, dispatched subagent ID (if subagent-driven).
- **paused-blocked** — the implementer reported it can't complete the current task without external input (a missing capability, an architectural decision, etc.). Surface the blocker, wait for user.
- **paused-needs-feature** — the implementer discovered the current story depends on a feature that doesn't exist in the spine yet. Surface the unblocker proposal, wait for user.
- **paused-review** — story finished. Awaiting user confirmation to advance to next story.
- **error** — last invocation crashed in an unrecoverable way (usually a kadai/MCP/CLI bug). State preserved for debugging.

State transitions are explicit; the runner never silently advances past `paused-*`.

### The fast-follow-up unblocking flow

When the implementer subagent reports `BLOCKED` with a structured reason `"needs-feature: <description>"` (or the runner infers it from a free-form blocker):

1. **Pause:** runner enters `paused-needs-feature`. Persists what was being worked on.
2. **Surface:** "STORY-007 hit a blocker — agent thinks we need a new feature: 'X'. Plan it now and resume? [Y/n/skip]."
3. **Plan the unblocker (if Y):** invoke `kadai-brainstorming` in a constrained mode (`--scope=fast-followup`) — same flow but defaults to "small feature, mvp phase, brief design, propose 1-3 stories." Output: a new feature with attached spec, plan'd stories, all in the spine.
4. **Re-order:** the new feature becomes the runner's next target. Original story stays paused with a note in its changelog: `paused 2026-05-06T... awaiting FEAT-009 unblocker`. Add a `dependency:` field on STORY-007's frontmatter referencing the new feature for spine-level traceability.
5. **Resume:** runner enters `running` on the unblocker's first story. Iterates the unblocker to completion, then unpauses STORY-007 and resumes from the task it was on.
6. **Skip / no:** the original story's status is set to `blocked`, the runner enters `idle`, and the user is told what manual action to take (typically: do the unblock manually + `kadai run --resume`).

The dependency edge is recorded in the spine, not just runner state — so even if the runner crashes mid-flight, the next `kadai status` shows STORY-007 blocked-by FEAT-009 and a human can pick up the thread.

### Per-story execution

Inside `running`, for each task in the story's plan.md:

1. Mark the kadai task `in_progress`.
2. Dispatch implementer subagent with the task's full text (per subagent-driven-development pattern).
3. Wait for status: `DONE` / `DONE_WITH_CONCERNS` / `BLOCKED` / `NEEDS_CONTEXT`.
4. On DONE: review (spec + quality reviewers, per the existing pattern), then mark task `done`, advance.
5. On BLOCKED: parse blocker. If `needs-feature` → fast-follow-up flow above. If anything else → `paused-blocked`.
6. On NEEDS_CONTEXT: provide context if the runner has it (the spine, the story, the plan); otherwise pause.
7. After all tasks: set story `review` (or `done` per the project's auto-transition config), persist the changelog, present summary, await confirmation to advance to the next story.

### Resume semantics

`kadai run --resume` (or simply re-running `kadai run` while state is `paused-*`) consults `.kadai/runner.json`, picks up where it left off, and continues. The agent is given the same context the prior step had (story + plan + last task + reason for pause). Idempotent: a second `--resume` while still paused is a no-op + reminder.

### Out-of-scope for the runner v1

- **Parallel story execution.** Run sequential only. Parallelism opens too many merge / dependency cans of worms for v1.
- **Cross-session locking.** If two `kadai run` processes run concurrently, behavior is undefined. v1 assumes one runner at a time. (Easy follow-up: pid file under `.kadai/`.)
- **Auto-merging the dependency edge into the original plan.** When STORY-007 resumes after the unblocker, its plan.md isn't rewritten to reflect the now-available capability. The runner just resumes the existing tasks; if they're now wrong, the implementer will report it and we'll re-pause-needs-feature or escalate to the user.
- **Recovering from a half-failed implementer subagent.** If a subagent crashes mid-task with the file system in a partial state, the runner pauses and the user resolves manually. Cleaner partial-state rollback is a v2 concern.

### Acceptance criteria additions

7. `kadai run` from a fresh post-plan state picks the first story, executes its tasks via subagents, and stops at `paused-review` after the last story or `paused-needs-feature` if any story declares one.
8. The fast-follow-up flow creates a new feature with stories + plans in the spine, sets a dependency edge on the originally-blocked story, and resumes after the unblocker completes.
9. `kadai run --resume` can pick up from `paused-*` states and finish the work.
10. Crash recovery: if the kadai CLI process dies mid-run, `.kadai/runner.json` reflects the last good state, and `kadai run --resume` continues without re-doing completed tasks.

## Why a feature branch

The wrapper might turn out to be more friction than value: agents that already followed the kadai discipline manually now have to follow a more opinionated flow. The spine plumbing is irreversible during a session (a half-created feature is uglier than no feature). And the upstream skills evolve — every time they do, our wrappers may need to re-converge.

If after dogfooding we find the wrappers misfire more than they help, we revert the branch and fall back to the hooks-only model. Master stays buildable and shippable until we explicitly merge.

## References

- Upstream brainstorming skill: `/home/fintan/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/brainstorming/SKILL.md`
- Upstream writing-plans skill: `/home/fintan/.claude/plugins/cache/claude-plugins-official/superpowers/5.1.0/skills/writing-plans/SKILL.md`
- Kadai discipline skill (current): `kadai-plugin/skills/kadai/SKILL.md`
- Kadai design spec: `docs/superpowers/specs/2026-05-05-kadai-design.md`
- Plan 17 (the redesign that exposed the integration friction): `docs/superpowers/plans/2026-05-06-kadai-17-web-viewer-redesign.md`
- Hooks implementation: `src/cli/hook.ts`
- Conversation that generated this spec: post-Plan-17 dogfood with testpro2 (2026-05-06)

---

**Status:** Open questions resolved — see "Resolved questions" below. Ready to add the runner section, then promote to writing-plans for the implementation plan.
