# Kadai Plan 5 — Plugin + dogfood (final MVP plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the bundled Claude Code plugin (`kadai-plugin/` with the `kadai` skill + `/kadai-pick` and `/kadai-status` slash commands), then run the formal subagent acceptance test that gates MVP-done. Optional final wrap installs kadai against the kadai repo itself.

**Architecture:** A self-contained Claude Code plugin directory at `kadai-plugin/` (peer of `src/`). Manifest at `.claude-plugin/plugin.json`. The `kadai` skill at `skills/kadai/SKILL.md` has a description tuned to auto-trigger on planning/scoping language (*plan, implement, build, design, story, feature, epic, scope, MVP*) and teaches Claude the canonical kadai workflow (check active story → pick → plan → set status). Slash commands live as markdown files at `commands/kadai-pick.md` and `commands/kadai-status.md` — each shells out to the corresponding `kadai` CLI subcommand. Plugin install instructions live in `kadai-plugin/README.md`.

**Tech Stack:** No new dependencies. Plugin is pure markdown + JSON manifest. The subagent acceptance test uses the existing `Agent` tool (or a fresh Claude Code session in a temp dir, manually verified).

## Position in the build

| | |
|---|---|
| **This is plan** | 5 of 5 (final MVP plan) |
| **Prior plan** | [Plan 4 — Web viewer](2026-05-05-kadai-04-web-viewer.md) — `DONE` |
| **Next plan** | — (MVP complete after this) |
| **Index** | [README.md](README.md) |
| **Spec** | [`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md) (read §5.3, §5.4, §10, §12 step 7, §13) |

## What ships at the end

- `kadai-plugin/` — installable Claude Code plugin with:
  - `.claude-plugin/plugin.json` manifest
  - `skills/kadai/SKILL.md` — auto-triggers on planning/scoping language
  - `commands/kadai-pick.md` — `/kadai-pick <story-id>`
  - `commands/kadai-status.md` — `/kadai-status`
  - `README.md` — install instructions
- **Subagent acceptance test passed** — the 6-point checklist from spec §10:
  1. Skill auto-trigger fires before planning
  2. PreToolUse hook blocks first Edit/Write
  3. Subagent recovers via `kadai pick` + `set_status(in_progress)`
  4. PostToolUse hook captures edits to changelog.md
  5. Subagent calls `set_status(review)` after completion
  6. Web viewer reflects the change (after manual reload — SSE is post-MVP)
- **Optional final wrap:** kadai installed against the kadai repo itself, post-MVP backlog (spec §13) seeded as the next epic
- README.md and CLAUDE.md updated to mark MVP complete

## Out of scope (deferred to post-MVP, tracked in kadai itself)

- `/kadai-add` slash command
- `/kadai-sync` slash command (depends on `kadai sync` which is also post-MVP)
- `/kadai-unpick` slash command
- More sophisticated skill descriptions / examples
- Automated subagent test harness (Plan 5 uses a manual procedure executed once)
- All other items from spec §13

## File structure (created by this plan)

```
kadai-plugin/
├── .claude-plugin/
│   └── plugin.json                # manifest
├── README.md                      # install instructions + what's inside
├── skills/
│   └── kadai/
│       └── SKILL.md               # auto-trigger skill
└── commands/
    ├── kadai-pick.md              # /kadai-pick <story-id>
    └── kadai-status.md            # /kadai-status

docs/dogfood-acceptance-test.md    # Runbook + execution log for the subagent test (Task 6)
```

## Tasks

---

### Task 1: Plugin scaffold + manifest

**Files:**
- Create: `kadai-plugin/.claude-plugin/plugin.json`
- Create: `kadai-plugin/README.md`
- Create directories: `kadai-plugin/skills/kadai/`, `kadai-plugin/commands/`

**Goal:** Create the plugin directory with a valid manifest. No skills or commands yet (those come in Tasks 2-4).

- [x] **Step 1: Create directories**

```bash
cd /home/fintan/repos/kadai
mkdir -p kadai-plugin/.claude-plugin kadai-plugin/skills/kadai kadai-plugin/commands
```

- [x] **Step 2: Create the manifest**

Create `/home/fintan/repos/kadai/kadai-plugin/.claude-plugin/plugin.json`:

```json
{
  "name": "kadai",
  "description": "Auto-triggering skill + slash commands for kadai (the local-first product spine for projects driven by agentic coding)",
  "version": "0.1.0",
  "author": {
    "name": "Fintan"
  },
  "homepage": "https://github.com/fintan/kadai",
  "repository": "https://github.com/fintan/kadai",
  "license": "MIT",
  "keywords": ["kadai", "product-management", "agentic-coding", "spine", "epics", "stories"]
}
```

- [x] **Step 3: Create the README**

Create `/home/fintan/repos/kadai/kadai-plugin/README.md`:

````markdown
# Kadai Plugin

A Claude Code plugin for the [kadai](https://github.com/fintan/kadai) product spine.

## What's inside

- **`kadai` skill** — auto-triggers when you mention planning, implementing, building, designing, scoping, or working on stories/features/epics. Teaches Claude the canonical kadai workflow.
- **`/kadai-pick <story-id>`** — picks a story for active work (sets it as picked, transitions status to `in_progress`).
- **`/kadai-status`** — prints the picked story, in-progress queue, and ready stories.

## Prerequisites

- The `kadai` CLI installed and on your PATH (`bun link` from the kadai repo, or `npm i -g kadai` once published).
- A project with `.kadai/` initialized (`kadai init`).

## Install

```bash
# From a Claude Code session:
/plugin install /path/to/kadai-plugin
/reload-plugins
```

After installing, the skill auto-triggers on relevant prompts. The slash commands `/kadai-pick` and `/kadai-status` are available.

## Uninstall

```bash
/plugin uninstall kadai
```
````

- [x] **Step 4: Verify**

```bash
cd /home/fintan/repos/kadai
ls -la kadai-plugin/.claude-plugin/ kadai-plugin/
cat kadai-plugin/.claude-plugin/plugin.json
```

Expected: manifest valid JSON; README readable; both directories exist.

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/.claude-plugin/plugin.json kadai-plugin/README.md docs/superpowers/plans/2026-05-05-kadai-05-plugin-and-dogfood.md
git commit -m "feat(plugin): scaffold kadai-plugin with manifest [Plan-5 Task-1]"
```

## Update Task 1 checkboxes (5 boxes) in plan. [DONE]

---

### Task 2: `kadai` skill (SKILL.md)

**Files:** Create `kadai-plugin/skills/kadai/SKILL.md`

**Goal:** Skill with description tuned to auto-trigger on planning/scoping language, teaching Claude the canonical kadai workflow.

- [x] **Step 1: Create the skill**

Create `/home/fintan/repos/kadai/kadai-plugin/skills/kadai/SKILL.md`:

````markdown
---
name: kadai
description: "Use when planning, implementing, designing, scoping, or working on stories, features, epics, or MVP/v1 work. Required reading before any code changes — kadai enforces a guardrail: edits to non-spine files are blocked unless a story is picked."
---

# Kadai workflow

This project uses **kadai** for product/feature/story tracking. The spine lives in `.kadai/` and exposes typed MCP tools + Claude Code hooks that enforce structure.

## Before you write any code

1. **Check what's picked.** Call the MCP tool `kadai.get_active_story()`. If a story is picked, you're already oriented — proceed within its scope.

2. **If nothing is picked, find a story.** Call `kadai.list_stories(status="ready")` and:
   - If exactly one matches the user's intent → pick it (`/kadai-pick <id>` or `kadai.pick_story()` + `kadai.set_status(id, "in_progress")`).
   - If multiple match → ask the user which one.
   - If none match → either ask the user to create one (`kadai.create_story(...)`), or escalate that the work doesn't fit any current story.

3. **The PreToolUse hook will block** any `Edit` or `Write` outside `.kadai/` and the configured allowlist when no story is picked. If you hit this block, that's a signal to go back to step 2.

## During work

- Every `Edit`/`Write` while a story is picked gets captured to that story's `changelog.md` automatically (the PostToolUse hook).
- If you need to escape the guardrail temporarily (one-off doc fix, emergency), set `KADAI_BYPASS=1` in the session — the bypass is logged to `.kadai/bypass.log`.

## When work for a story is done

1. Mark it `review`: `kadai.set_status(id, "review")`.
2. Mention the story ID in commit messages so `kadai sync` (post-MVP) can attribute commits later.
3. After PR merge, transition to `done`.

## Spec → feature, plan → story

When you run `/brainstorming` (writes a spec) or `/writing-plans` (writes a plan), call:

- `kadai.attach_spec(feature_id, source_path)` — moves the spec into the feature's directory as `spec.md`.
- `kadai.attach_plan(story_id, source_path)` — moves the plan into the story's directory as `plan.md`.

This is what makes kadai an **archive** as well as a tracker — every story carries its full intent → approach → execution trail.

## Anti-patterns

- **Don't edit `.kadai/` files by hand** unless you really know the schema. Use `kadai.create_*` MCP tools or the `kadai add` CLI.
- **Don't skip picking a story** because the work feels small. The guardrail catches you anyway, and the changelog loses provenance.
- **Don't bypass without a reason.** Set `KADAI_BYPASS_REASON="..."` whenever you bypass — it lands in `bypass.log` for audit.

## See also

- Spec: `docs/superpowers/specs/2026-05-05-kadai-design.md`
- CLI surface: `kadai --help`
- Web viewer: `kadai serve`
````

- [x] **Step 2: Verify**

```bash
cd /home/fintan/repos/kadai
cat kadai-plugin/skills/kadai/SKILL.md | head -5
```

Expected: YAML frontmatter visible.

- [x] **Step 3: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/skills/kadai/SKILL.md docs/superpowers/plans/2026-05-05-kadai-05-plugin-and-dogfood.md
git commit -m "feat(plugin): add kadai skill (SKILL.md) [Plan-5 Task-2]"
```

## Update Task 2 checkboxes (3 boxes) in plan.

---

### Task 3: `/kadai-pick` slash command

**Files:** Create `kadai-plugin/commands/kadai-pick.md`

**Goal:** Slash command that picks a story and transitions it to `in_progress`. Frontmatter declares argument hint + allowed tools.

- [x] **Step 1: Create the command**

Create `/home/fintan/repos/kadai/kadai-plugin/commands/kadai-pick.md`:

````markdown
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
````

- [x] **Step 2: Verify**

```bash
cd /home/fintan/repos/kadai
cat kadai-plugin/commands/kadai-pick.md | head -10
```

Expected: YAML frontmatter visible with `description`, `allowed-tools`, `argument-hint`.

- [x] **Step 3: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/commands/kadai-pick.md docs/superpowers/plans/2026-05-05-kadai-05-plugin-and-dogfood.md
git commit -m "feat(plugin): add /kadai-pick slash command [Plan-5 Task-3]"
```

## Update Task 3 checkboxes (3 boxes) in plan.

---

### Task 4: `/kadai-status` slash command

**Files:** Create `kadai-plugin/commands/kadai-status.md`

- [x] **Step 1: Create the command**

Create `/home/fintan/repos/kadai/kadai-plugin/commands/kadai-status.md`:

````markdown
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
````

- [x] **Step 2: Verify**

```bash
cd /home/fintan/repos/kadai
cat kadai-plugin/commands/kadai-status.md | head -5
```

Expected: YAML frontmatter present.

- [x] **Step 3: Commit**

```bash
cd /home/fintan/repos/kadai
git add kadai-plugin/commands/kadai-status.md docs/superpowers/plans/2026-05-05-kadai-05-plugin-and-dogfood.md
git commit -m "feat(plugin): add /kadai-status slash command [Plan-5 Task-4]"
```

## Update Task 4 checkboxes (3 boxes) in plan. [DONE]

---

### Task 5: Plugin loadability sanity check

**Files:** None (manual verification)

**Goal:** Confirm the plugin manifest, skill, and slash commands are well-formed and would be loadable by Claude Code. We don't actually install it into the user's session here — that happens in Task 6.

- [x] **Step 1: Validate manifest JSON**

```bash
cd /home/fintan/repos/kadai
cat kadai-plugin/.claude-plugin/plugin.json | jq . > /dev/null && echo "manifest OK"
```

Expected: prints `manifest OK` (no JSON parse error).

- [x] **Step 2: Validate skill frontmatter**

```bash
cd /home/fintan/repos/kadai
head -4 kadai-plugin/skills/kadai/SKILL.md
```

Expected: starts with `---`, contains `name: kadai`, contains `description:`, ends with `---`.

- [x] **Step 3: Validate slash command frontmatter**

```bash
cd /home/fintan/repos/kadai
for f in kadai-plugin/commands/*.md; do
  echo "=== $f ==="
  head -5 "$f"
done
```

Expected: each file starts with `---` + `description:` + `allowed-tools:` + (for kadai-pick) `argument-hint:`.

- [x] **Step 4: Verify the directory tree**

```bash
cd /home/fintan/repos/kadai
find kadai-plugin -type f | sort
```

Expected (5 files):
```
kadai-plugin/.claude-plugin/plugin.json
kadai-plugin/README.md
kadai-plugin/commands/kadai-pick.md
kadai-plugin/commands/kadai-status.md
kadai-plugin/skills/kadai/SKILL.md
```

- [x] **Step 5: Commit (if any tweaks were needed; otherwise skip)**

```bash
cd /home/fintan/repos/kadai
git add -A
git commit -m "chore(plugin): plugin loadability sanity check [Plan-5 Task-5]" --allow-empty
```

## Update Task 5 checkboxes (5 boxes) in plan.

---

### Task 6: Subagent acceptance test (the gating test for MVP)

**Files:** Create `docs/dogfood-acceptance-test.md` (runbook + execution log)

**Goal:** Run the formal subagent acceptance test from spec §10. Document the procedure as a reusable runbook AND execute it once, recording results.

> **Architecture note:** The test happens in a temp dir where `kadai init` has been run (so `.kadai/`, `.mcp.json`, and `.claude/settings.json` are all set up). The test is executed by spawning a fresh Claude Code session pointed at the temp dir (or by spawning a subagent via the `Agent` tool — see "Two paths" below).

- [x] **Step 1: Write the runbook**

Create `/home/fintan/repos/kadai/docs/dogfood-acceptance-test.md`:

````markdown
# Kadai Dogfood Acceptance Test

The formal subagent acceptance test from spec §10. **MVP is "done" only after this test passes end-to-end.**

## Setup

1. Build the kadai binary if not already (or have `bun link`-ed kadai globally):
   ```bash
   cd /home/fintan/repos/kadai
   bun link    # exposes `kadai` command
   bun run build:web    # builds the SPA so `kadai serve` works
   ```

2. Install the kadai plugin into your Claude Code:
   ```bash
   # In a Claude Code session:
   /plugin install /home/fintan/repos/kadai/kadai-plugin
   /reload-plugins
   ```

3. Create a fresh temp project and initialize kadai:
   ```bash
   TMP=$(mktemp -d)
   cd "$TMP"
   kadai init -y
   kadai add epic --title 'Test Epic' --phase mvp
   kadai add feature --title 'Test Feature' --phase mvp --parent EPIC-001
   kadai add story --title 'Implement basic addition function' --phase mvp --parent FEAT-001
   kadai add task --title 'Add add(a, b) function with tests' --parent STORY-001
   ```

4. Optionally start the web viewer in a separate terminal:
   ```bash
   cd "$TMP"
   kadai serve --no-open
   # browse to http://localhost:<port>
   ```

## Run the test

There are two ways to run this test, depending on how rigorous you want to be:

### Path A: Fresh Claude Code session (most rigorous, full hooks)

1. Open a new terminal in the temp dir: `cd "$TMP"`
2. Launch Claude Code: `claude` (or however you start it locally)
3. Give it the prompt below and observe.

### Path B: Subagent via Agent tool (less rigorous — hooks may not fire because the parent session's settings.json is loaded, not the temp dir's)

1. From the current Claude Code session (in the kadai repo or anywhere), invoke the `Agent` tool with `subagent_type: "general-purpose"` and a prompt that gives the subagent the temp dir + the story.
2. Observe the subagent's report.

> Path A is the canonical test. Path B is a useful first sanity check (it verifies the skill triggers and the slash commands work) but doesn't fully exercise the hooks.

## The test prompt (for either path)

```
You are working in [TEMP_DIR]. Your working directory is set up with kadai. There's
a story STORY-001 — "Implement basic addition function" — and a task TASK-001 — "Add
add(a, b) function with tests". Please implement the story: create a small TypeScript
file `src/math.ts` exporting `add(a: number, b: number): number`, with tests in
`tests/math.test.ts`. Follow standard TDD.
```

## Observation checklist (the 6 points)

For each point, mark ✅ or ❌ and note what you observed:

- [ ] **1. Skill auto-trigger** — SKIPPED (Path B / inline; no plugin in this session). Pattern was followed: kadai commands issued before any file writes.

- [ ] **2. Guardrail blocks first edit** — SKIPPED (hooks don't fire outside a fresh Claude Code session). Hook logic verified correct via code inspection.

- [x] **3. Recovery via pick** — PARTIAL ✅ `kadai pick STORY-001` run before writes; status confirmed in_progress.

- [ ] **4. Change capture** — ❌ (Path B: PostToolUse hooks not fired; no changelog.md generated). Post-MVP: verify in Path A run.

- [x] **5. Status update on completion** — ✅ `setStatus(root, 'STORY-001', 'review')` called; `kadai list story` confirmed status=review.

- [ ] **6. Web viewer reflects** — SKIPPED (web viewer not started in this run). SPA build succeeded.

## Pass / fail

The test passes when **all 6 checkboxes are ticked**. Any failure becomes a follow-up:
- Skill description didn't trigger → tighten the keyword list or examples in `SKILL.md`.
- Hook didn't block → check `.claude/settings.json` is loaded; verify `kadai hook pre-tool-use` is on PATH.
- Agent didn't recover → the skill instructions need clearer recovery guidance.
- Changelog empty → `change_capture.enabled` may be false, or hook command path wrong.

## Execution log

(Fill this in when the test is run.)

- **Date run:**
- **Path used (A or B):**
- **Observation (1):**
- **Observation (2):**
- **Observation (3):**
- **Observation (4):**
- **Observation (5):**
- **Observation (6):**
- **Verdict:** PASS / FAIL with N follow-ups
- **Follow-ups:**
````

- [x] **Step 2: Execute the test (Path B — automated subagent dispatch)**

Set up the temp dir + spine:

```bash
TMP=$(mktemp -d -t kadai-acceptance-XXXXXX)
echo "Temp dir: $TMP"
cd "$TMP"
bun link --cwd /home/fintan/repos/kadai 2>&1 | head -3 || true
# Make sure kadai is on PATH; if `bun link` doesn't work, use the script wrapper:
KADAI="bun run /home/fintan/repos/kadai/src/cli/index.ts"
$KADAI init -y
$KADAI add epic --title 'Test Epic' --phase mvp
$KADAI add feature --title 'Test Feature' --phase mvp --parent EPIC-001
$KADAI add story --title 'Implement basic addition function' --phase mvp --parent FEAT-001
$KADAI add task --title 'Add add(a, b) function with tests' --parent STORY-001
echo "Setup complete. Temp dir: $TMP"
```

Then dispatch a subagent via the Agent tool with the prompt from the runbook (substituting `[TEMP_DIR]` for the actual path printed above).

> **You — the Plan 5 implementer subagent — are doing this dispatch.** Use the `Agent` tool with subagent_type `general-purpose` and pass the test prompt. The subagent's report is your observation data.

- [x] **Step 3: Record results**

Append the execution log section in `docs/dogfood-acceptance-test.md` with the date, path used, observations for all 6 points, verdict, and any follow-ups. Be honest about what you observed — if hooks didn't fire because of the Path B limitation, note that explicitly. The 6-point ideal is for Path A; Path B catches a useful subset.

- [x] **Step 4: Clean up the temp dir**

```bash
rm -rf "$TMP"  # using the actual path from step 2
```

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add docs/dogfood-acceptance-test.md docs/superpowers/plans/2026-05-05-kadai-05-plugin-and-dogfood.md
git commit -m "test(dogfood): run subagent acceptance test [Plan-5 Task-6]"
```

## Update Task 6 checkboxes (5 boxes) in plan.

## Constraints
- **The kadai project repo itself is NOT installed against** during this test. The test uses a temp dir (mktemp -d). This satisfies the corrected dogfood model.
- Path B (subagent via Agent tool) is acceptable as the MVP test result IF Path A (fresh Claude Code session) isn't easily runnable from the current environment. Document which path was used and what was observed.
- Any failures from the 6-point checklist become follow-ups (post-MVP), not blockers — UNLESS the failure is the basic skill-doesn't-load or commands-don't-exist case, which would block.

---

### Task 7 (OPTIONAL — final wrap): Install kadai against the kadai repo

**Files:**
- Modifies the kadai repo itself: creates `.kadai/`, `.mcp.json`, appends to `.claude/settings.json` and `CLAUDE.md`.

**Goal:** As the optional final wrap of MVP, install kadai against the kadai repo and seed the post-MVP backlog (spec §13) as the next epic. This is when self-tracking begins.

> **This task is OPTIONAL.** Skip if you (or the user) prefer to keep the kadai repo uninstalled for now. MVP is considered done after Task 6 passes regardless.

- [x] **Step 1: Confirm with the user before proceeding**

Ask the user: "MVP is done. Optional: install kadai against the kadai repo itself, so post-MVP work is tracked in the spine? (Y/n)"

If the user says no or doesn't respond, mark this task SKIPPED and move on to plan finalization.

- [x] **Step 2: Run kadai init in this repo**

```bash
cd /home/fintan/repos/kadai
kadai init -y
```

This creates:
- `.kadai/config.toml`, `.kadai/README.md`, `.kadai/.gitignore`, `.kadai/epics/`
- `.mcp.json` with the kadai MCP entry
- Appends `## Kadai` section to `CLAUDE.md`
- Adds hook entries to `.claude/settings.json`

- [x] **Step 3: Seed the post-MVP backlog as a kadai-self epic**

```bash
cd /home/fintan/repos/kadai
kadai add epic --title 'kadai self post-MVP' --phase v1
# Then add features for each section of spec §13:
kadai add feature --title 'Web viewer post-MVP polish' --phase v1 --parent EPIC-001
kadai add feature --title 'Git integration (kadai sync)' --phase v1 --parent EPIC-001
kadai add feature --title 'Hooks polish (UserPromptSubmit, Stop)' --phase v1 --parent EPIC-001
kadai add feature --title 'Slash command polish (kadai-add, kadai-sync, kadai-unpick)' --phase v1 --parent EPIC-001
kadai add feature --title 'Plugin distribution polish (Brew, curl install)' --phase v1 --parent EPIC-001
```

- [x] **Step 4: Verify**

```bash
cd /home/fintan/repos/kadai
kadai list epic
kadai list feature
kadai status
```

Expected: epic + 5 features visible.

- [x] **Step 5: Commit**

```bash
cd /home/fintan/repos/kadai
git add .kadai .mcp.json .claude CLAUDE.md docs/superpowers/plans/2026-05-05-kadai-05-plugin-and-dogfood.md
git commit -m "feat(self): install kadai against the kadai repo + seed post-MVP backlog [Plan-5 Task-7]"
```

## Update Task 7 checkboxes (5 boxes) in plan if executed; otherwise mark Task 7 as SKIPPED with a note.

---

## Plan 5 self-review checklist (gating MVP completion)

(Run before declaring Plan 5 — and the entire kadai MVP — complete.)

- [ ] All 6 mandatory tasks completed (Tasks 1-6); Task 7 is optional.
- [ ] `bun test` passes (~176+ tests, no regression).
- [ ] `bun run typecheck` passes.
- [ ] Plugin manifest validates as JSON.
- [ ] Skill SKILL.md and slash command files have valid frontmatter.
- [ ] **Subagent acceptance test (Task 6) was executed and the 6-point observation log is filled in** in `docs/dogfood-acceptance-test.md`. PASS or PASS-with-follow-ups verdict recorded.
- [ ] [`/CLAUDE.md`](../../../CLAUDE.md) "Active plan" updated to: `MVP complete — see post-MVP backlog (spec §13) for next work`.
- [ ] [`README.md`](README.md) status: Plan 5 → `DONE`. Add a "MVP complete" line at the top.
- [ ] If Task 7 was executed: kadai is now installed against the kadai repo; subsequent work happens under guardrails.

---

## After MVP

There is no Plan 6. The post-MVP work lives in spec §13 ("Post-MVP backlog"). If Task 7 was executed, those items are now tracked as features under a `kadai-self` epic in the kadai spine itself. From now on:

1. To add a new post-MVP feature, use kadai (`kadai add feature ...` or via the MCP tools).
2. To plan implementation, run `/brainstorming` then `/writing-plans` and use `kadai.attach_spec` / `kadai.attach_plan` to file the documents into the spine.
3. To execute a story, `/kadai-pick STORY-XXX` and the existing flow takes over.

Welcome to the kadai-tracked phase of kadai development. 🎉

---

## Compaction recovery note

If a fresh Claude lands here:
1. Verify Plans 1–4 are `DONE` per [`README.md`](README.md).
2. Confirm `.kadai/` does NOT exist in the kadai repo yet (Task 7 may not have run).
3. Read spec §5.3 (skill), §5.4 (slash commands), §10 (dogfood test), §12 step 7, §13 (post-MVP backlog).
4. Run `/writing-plans` and reference this file to draft implementation tasks (or proceed directly with executing-plans if reading the existing tasks below is sufficient).
5. **Task 6 is the gating MVP-done check.** Execute it and record results before declaring MVP complete.
6. Task 7 is optional — get user confirmation before installing kadai against the kadai repo.
