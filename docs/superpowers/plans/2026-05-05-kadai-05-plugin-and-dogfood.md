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
  - Spawn a fresh subagent (via the Agent tool) with a kadai-managed story
  - Observe the 6-point checklist from spec §10:
    1. Skill auto-trigger fires before planning
    2. PreToolUse hook blocks first Edit/Write
    3. Subagent recovers via `pick_story` + `set_status(in_progress)`
    4. PostToolUse hook captures edits to changelog.md
    5. Subagent calls `set_status(review)` after task completion
    6. Web viewer (running in terminal session) reflects the change after manual reload (live updates are post-MVP)
  - Document pass/fail; iterate on guardrails / skill description / hook config if any step fails
- **MVP "done" gate:** all 6 points pass; update README and CLAUDE.md to mark MVP complete; seed post-MVP backlog (spec §13) into the kadai spine as the next epics to work

## Out of scope (deferred — these become the first post-MVP work, tracked in kadai itself)

- `/kadai-add` slash command
- `/kadai-sync` slash command (depends on `kadai sync` which is also post-MVP)
- `/kadai-unpick` slash command
- More sophisticated skill descriptions / examples
- All other items from spec §13 (post-MVP backlog)

## Dependencies — what must exist before writing this plan

**Plan(s) shipped:** Plans 1–4. Kadai is installed and self-tracking.

**Specifically, these inputs:**

- All MCP tools functional and tested
- Hooks installed and tested
- Web viewer running (the subagent test verifies the file changes that an SSE-equipped viewer would consume; for MVP, manual reload is fine)

## Outputs — what ships at the end of this plan

- `kadai-plugin/` directory ready to install via Claude Code's plugin system
- `kadai` skill auto-triggers on planning language
- `/kadai-pick` and `/kadai-status` slash commands work
- Subagent acceptance test passes all 6 points
- README.md and CLAUDE.md updated: MVP marked complete; post-MVP backlog seeded into kadai itself

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
2. Read spec §5.3, §5.4, §10, §12 step 7, §13.
3. Run `/writing-plans` and reference this file.
4. **The terminal task of this plan is the subagent acceptance test.** It is the gating check for MVP-done. Do not declare MVP done until all 6 points pass.
5. After MVP is done, seed the kadai spine with post-MVP backlog items (spec §13) as the next work.
