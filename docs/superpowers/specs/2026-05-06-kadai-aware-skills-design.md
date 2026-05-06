# Kadai-aware brainstorming + writing-plans wrappers — design spec

**Status:** Draft 2026-05-06. Exploration. Lives on `feature/kadai-aware-skills` so we can swap back to hooks-only enforcement if this doesn't pan out.

## Motivation

Two problems surfaced during the first real testpro2 dogfood of the Plan-17 viewer:

1. **Skill auto-loading is best-effort, not deterministic.** A user prompt like "Could we plan and build a small website here, an MVP for a blog?" matches the upstream `superpowers:brainstorming` description directly. Claude loads brainstorming and runs the full flow before the kadai SKILL.md ever gets a chance to fire. We made the kadai skill description more aggressive (commit `88b61e0`), but it's still a popularity contest between skill descriptions, not enforcement. The kadai workflow only happens if Claude voluntarily reads our skill.

2. **The plan→spine translation is lossy and post-hoc.** Today, `superpowers:writing-plans` produces one freeform `<feature>.md` with N tasks. Whoever (agent or human) reads that plan then has to mentally map it onto kadai's hierarchy: "this is one feature with three stories, each story owns these four tasks." That translation is inconsistent across sessions, often skipped entirely, and the relationship between a plan's "Task 7" and a kadai task is never explicit. Plans drift from the spine the moment they're written.

The fix is to invert the relationship: have a **kadai-aware planning flow** that thinks in spine shape upfront and emits artifacts directly into the spine, with the hooks as the safety net rather than the primary enforcement.

## Goals

- A user prompt that triggers brainstorming + writing-plans in a `.kadai/`-bearing repo runs through **kadai-aware** versions of those flows by default.
- The brainstorming flow ends by creating a **feature** in the spine and attaching the spec as `feature.spec`, not by leaving a free-floating `docs/superpowers/specs/*.md`.
- The writing-plans flow decomposes the work into **kadai stories** and emits **one `plan.md` per story** directly into the story's directory, with each plan's `### Task N` blocks corresponding 1:1 to real `kadai add task` calls.
- Stories are picked automatically as the agent moves into implementation.
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

1. **`kadai-brainstorming` SKILL.md** — write the wrapper, including the `.kadai/` detect + the pre-spec-write spine plumbing prompts. Test by running it manually in a fresh repo.
2. **`kadai-writing-plans` SKILL.md** — same shape; the per-story decomposition is the meaningful new logic. Test by running brainstorm-then-plan end-to-end and verifying the spine state.
3. **`kadai plan compose <id>` CLI** — small subcommand: read spine, walk descendants, concatenate `plan.md` content. ~80 lines + tests.
4. **Plugin commands/`kadai-plan-compose.md`** — slash-command wrapper.
5. **`kadai-plugin/.claude-plugin/plugin.json`** — register the two new skills + the new slash command. Bump version to 1.4.0.
6. **Documentation:**
   - `docs/wiki/plugin.md` — describe the wrapper skills.
   - `docs/wiki/troubleshooting.md` — entry for "wrapper didn't fire."
   - `docs/wiki/cli-reference.md` — `kadai plan compose`.
7. **Dogfood test** — fresh `kadai init` repo, run a brainstorm + plan end-to-end via the wrappers, verify acceptance criteria 1-6 pass.

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

**Status:** Draft. Needs review before promoting to a writing-plans pass. Questions worth resolving before implementation:

- Should `kadai-brainstorming` also create the **epic** automatically, or always require an existing one? (Current draft: create if missing — but maybe asking once is friction worth keeping.)
- Should each story's plan get its own self-review checklist, or is one feature-level checklist enough?
- What happens when an existing feature has a `spec.md` and the user re-runs brainstorming for it? Overwrite, version, or refuse?
- Plan 17's experience suggests build-time verification (rendering pages, not just tests) catches what unit tests miss. Should the dogfood test include actually invoking the wrappers via `claude -p` rather than asserting on file structure?
