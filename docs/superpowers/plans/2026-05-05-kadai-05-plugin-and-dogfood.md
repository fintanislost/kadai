# Plan 5 — Plugin + dogfood

> **Status:** STUB — implementation plan not yet written.
> **To draft this plan:** run `/writing-plans` against this file (after Plan 4 has shipped).

## Position in the build

| | |
|---|---|
| **This is plan** | 5 of 5 (final plan for kadai MVP) |
| **Prior plan** | [Plan 4 — Web viewer](2026-05-05-kadai-04-web-viewer.md) — must be `DONE` |
| **Next plan** | — (MVP complete) |
| **Index** | [README.md](README.md) |
| **Spec** | [`../specs/2026-05-05-kadai-design.md`](../specs/2026-05-05-kadai-design.md) |

## Goal

Build the bundled Claude Code plugin (skill + minimal slash commands) and run the formal subagent acceptance test that gates MVP-done.

## Scope

- Create `kadai-plugin/` directory with proper Claude Code plugin structure (manifest, skills, commands)
- Implement the `kadai` skill:
  - Description tuned to auto-trigger on planning/scoping language (*plan, implement, build, design, story, feature, epic, scope, MVP*)
  - Skill instructions teach Claude the canonical kadai workflow (check active story → list ready stories → pick → plan via writing-plans → set status to review/done)
- Implement `/kadai-pick <story-id>` slash command
- Implement `/kadai-status` slash command
- Document plugin install instructions
- **Run the subagent acceptance test (spec §10):**
  - Spawn a fresh subagent (via the Agent tool) in a **temp working directory** where kadai has just been freshly initialized (`kadai init`) and the spine has been seeded with a sample story to work
  - Assign the subagent a kadai-managed story (e.g., "STORY-N: implement the SSE endpoint for live updates")
  - Observe the 6-point checklist from spec §10:
    1. Skill auto-trigger fires before planning
    2. PreToolUse hook blocks first Edit/Write
    3. Subagent recovers via `pick_story` + `set_status(in_progress)`
    4. PostToolUse hook captures edits to changelog.md
    5. Subagent calls `set_status(review)` after task completion
    6. Web viewer (running in terminal session against the same temp dir) reflects the change after manual reload (live updates are post-MVP)
  - Document pass/fail; iterate on guardrails / skill description / hook config if any step fails
- **MVP "done" gate:** all 6 points pass.
- **Optional final wrap (after the gate passes):** install kadai against the kadai repo itself (`kadai init`), seed the spine with the post-MVP backlog from spec §13 as the next epic, and update README + CLAUDE.md accordingly. This is the moment the kadai repo first becomes self-tracked.

## Out of scope (deferred — these become the first post-MVP work, tracked in kadai itself)

- `/kadai-add` slash command
- `/kadai-sync` slash command (depends on `kadai sync` which is also post-MVP)
- `/kadai-unpick` slash command
- More sophisticated skill descriptions / examples
- All other items from spec §13 (post-MVP backlog)

## Dependencies — what must exist before writing this plan

**Plan(s) shipped:** Plans 1–4. Kadai is NOT yet installed against the kadai repo (that is the optional final wrap of this plan).

**Specifically, these inputs:**

- All MCP tools functional and tested (Plan 2)
- Hooks implemented and verified via temp-dir tests (Plan 3)
- Web viewer running (Plan 4) — for the subagent test, point it at the temp dir where kadai is initialized for the test
- For MVP, manual reload of the web viewer is fine (live updates via SSE are post-MVP)

## Outputs — what ships at the end of this plan

- `kadai-plugin/` directory ready to install via Claude Code's plugin system
- `kadai` skill auto-triggers on planning language
- `/kadai-pick` and `/kadai-status` slash commands work
- Subagent acceptance test passes all 6 points (executed in a temp dir)
- README.md and CLAUDE.md updated: MVP marked complete
- (Optional final wrap) Kadai installed against the kadai repo itself; post-MVP backlog seeded as the next epic

## Spec sections covered

- §5.3 — bundled `kadai` skill
- §5.4 — slash commands (the two MVP ones)
- §10 — dogfood / subagent acceptance test (the formal version)
- §12 step 7 — finalization
- §13 — post-MVP backlog seeded into kadai for future work

## When to write this plan

After Plan 4 ships. Read Plan 4's outputs (especially the web viewer's read paths) to know what state the subagent test should observe.

## Compaction recovery note

If a fresh Claude lands here:
1. Verify Plans 1–4 are `DONE` per [`README.md`](README.md).
2. Confirm `.kadai/` does NOT exist in the kadai repo yet — install only happens at the optional final wrap of this plan.
3. Read spec §5.3, §5.4, §10, §12 step 7, §13.
4. Run `/writing-plans` and reference this file.
5. **The terminal task of this plan is the subagent acceptance test, executed against a temp dir.** It is the gating check for MVP-done. Do not declare MVP done until all 6 points pass.
6. After the subagent test passes, optionally install kadai against the kadai repo as a final wrap (this is when self-tracking begins; post-MVP work uses the kadai spine).
