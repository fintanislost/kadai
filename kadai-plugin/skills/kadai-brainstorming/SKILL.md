---
name: kadai-brainstorming
description: "Use INSTEAD OF superpowers:brainstorming when working in any repository that contains a `.kadai/` directory. Runs the full brainstorming flow (explore → questions → approaches → design → user approval → spec → self-review) AND then plumbs the result into the kadai spine: auto-creates the epic if missing, creates a feature, attaches the spec to the feature as `spec.md`. The single visible artifact at the end is a feature in `.kadai/epics/<E>/features/<F>/` with `spec.md` attached, NOT a free-floating `docs/superpowers/specs/*.md`. If you load `superpowers:brainstorming` in a kadai repo, you'll write specs into the wrong place and lose the spec → plan → implementation provenance kadai is designed to capture."
---

# Kadai-aware brainstorming

This skill wraps `superpowers:brainstorming` with kadai spine plumbing. The conversational question flow, the visual companion offer, the design presentation, and the user-approval gates are all unchanged — the upstream skill's content carries through.

## What this skill adds

At the **spec-writing** step (after the user approves the design, before you would write to `docs/superpowers/specs/...`), do this instead:

### 1. Determine the epic

- Call `kadai.list_epics()` (MCP).
- If exactly one epic obviously matches the intent → use it.
- If multiple match → ask the user: "Which epic should this live under? Existing: [list]. Or create a new one?"
- If none match → create one: `kadai.create_epic(title=<inferred from brainstorm>, phase='mvp')`. The brainstorming flow's "what are we building" answer is usually the epic title.

### 2. Determine the feature

- If you're **reworking** an existing feature (the user said "let's redo FEAT-XXX" or similar), use that feature ID. Skip to step 4.
- Otherwise, create a new feature: `kadai.create_feature(epic_id=<id>, title=<derived from spec>, phase=<epic's phase>)`.

### 3. Write the spec

- Generate the spec content as you would normally — same structure as the upstream skill produces.
- Write it to a temp file in `/tmp/`, then call `kadai.attach_spec(feature_id=<id>, source_path=<tmp-path>)`. This moves the file into the feature's directory as `spec.md`.

### 4. Rework path (re-run on existing feature)

- If the feature already has a `spec.md` and the user is reworking:
  - Back up the existing spec: copy `.kadai/epics/<E>/features/<F>/spec.md` to `spec.<ISO-timestamp>.md.bak` in the same directory. (Use the `kadai.attach_spec` MCP tool if it supports a `replace` parameter; otherwise do the backup yourself via shell `cp` then call the standard `attach_spec` which overwrites.)
  - Confirm with the user: "Replaced FEAT-XXX/spec.md (old version archived as spec.<timestamp>.md.bak). Stories under this feature stay; rerun /kadai-writing-plans if the rework is large enough to redecompose."

### 5. Self-review the spec (same as upstream)

The self-review pass is unchanged: scan for placeholders, internal contradictions, scope creep, ambiguity.

### 6. User review gate

Tell the user: "Spec written and attached to FEAT-XXX. Read it at `.kadai/epics/<E>/features/<F>/spec.md`. Let me know if you want changes before we run /kadai-writing-plans."

### 7. Hand off

When the user approves, invoke `kadai-writing-plans` (NOT `superpowers:writing-plans`).

## Detection: am I in a kadai repo?

Run this check at the START of the skill:
```bash
test -d .kadai && echo "kadai repo" || echo "non-kadai repo"
```

If non-kadai → fall through to `superpowers:brainstorming` and warn the user once: "This is `kadai-brainstorming` but no `.kadai/` was found — invoking upstream brainstorming with no spine plumbing."

## Anti-patterns

- **Don't write to `docs/superpowers/specs/`.** That's the upstream skill's path. Kadai's spine is `.kadai/epics/<E>/features/<F>/spec.md`.
- **Don't skip step 1 (the epic question).** Even if it feels like friction — re-using an existing epic vs creating a new one is a genuine architectural decision the user should own.
- **Don't auto-replace specs without confirming.** Rework is destructive; show the user the old vs new diff if the rework is large.

## See also

- Upstream brainstorming: `superpowers:brainstorming` (do NOT load both — this skill subsumes it)
- Next step: `kadai-writing-plans`
- Kadai discipline: the `kadai` skill (passive guidance + MCP tool reference)
