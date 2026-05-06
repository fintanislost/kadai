---
name: kadai
description: "Required when working in any repository that contains a `.kadai/` directory — including brainstorming, designing, scoping, planning, building, or implementing anything (MVPs, features, prototypes, fixes, websites, scripts). Load this skill at the START of the session, before invoking brainstorming/writing-plans or writing any files. Kadai enforces a guardrail (edits outside the spine + allowlist are blocked when no story is picked) and tracks the spec→plan→implementation trail in `.kadai/`. If you skip this skill, you'll write specs/plans into the wrong place and lose the provenance kadai is designed to capture."
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

1. **Check docs.** If you changed user-facing behavior (CLI flag, config key, MCP tool surface, hook protocol, plugin), update the relevant page in `docs/wiki/` *in the same commit*. Stale docs are worse than no docs.
2. Mark it `review`: `kadai.set_status(id, "review")`.
3. Mention the story ID in commit messages so `kadai sync` (post-MVP) can attribute commits later.
4. After PR merge, transition to `done`.

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

- User docs: `docs/wiki/` (getting-started, cli-reference, plugin, troubleshooting, concepts)
- Spec: `docs/superpowers/specs/2026-05-05-kadai-design.md`
- CLI surface: `kadai --help`
- Web viewer: `kadai serve`
