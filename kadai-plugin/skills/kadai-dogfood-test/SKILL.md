---
name: kadai-dogfood-test
description: "Use when verifying that kadai's full integration (skill auto-trigger + PreToolUse/PostToolUse hooks + MCP server + change capture + status updates) works end-to-end. Spawns a fresh `claude -p` session in a temp dir to exercise the Path A acceptance test from the kadai design spec §10. Useful after kadai upgrades, install changes, or when something feels off about hooks/MCP/skill behavior."
---

# Kadai dogfood test (Path A automated)

This skill encapsulates the formal Path A dogfood test for kadai. It spawns a fresh Claude Code session inside a temp dir and observes whether the agent uses kadai correctly, whether hooks fire, and whether change capture works.

Use it after kadai upgrades, after editing the plugin / skill / hooks / MCP tools, or when debugging why the kadai workflow doesn't seem to be firing as expected.

## What it tests (the 6-point checklist)

From kadai design spec §10:

1. **Skill auto-trigger** — the `kadai` skill fires on planning/implementation language before any code is written.
2. **Guardrail blocks** — PreToolUse hook returns exit 2 with the "no story is picked" message on the first `Edit`/`Write` outside the spine.
3. **Recovery via pick** — agent calls `kadai pick STORY-001` (or `mcp__kadai__pick_story`), status moves to `in_progress`, next edit succeeds.
4. **Change capture** — PostToolUse hook appends each edit to the picked story's `changelog.md`.
5. **Status update** — agent calls `mcp__kadai__set_status` to mark the story `review` (or `done`) when work completes.
6. **Web viewer reflects** — manual check via `kadai serve` (skipped by default in this skill — start it separately if you want to verify).

## Procedure

### Step 1: Set up a fresh temp dir + kadai spine

```bash
TMP=$(mktemp -d -t kadai-dogfood-XXXXXX)
echo "Test temp dir: $TMP"
cd "$TMP"

kadai init -y > /dev/null
kadai add epic --title "Test Epic" --phase mvp > /dev/null
kadai add feature --title "Math utils" --phase mvp --parent EPIC-001 > /dev/null
kadai add story --title "Implement add(a,b)" --phase mvp --parent FEAT-001 > /dev/null

# Verify spine
kadai list epic && kadai list feature && kadai list story
```

### Step 2: Spawn a fresh `claude -p` session in the temp dir

```bash
cd "$TMP"

echo "STORY-001 needs implementing — 'Implement add(a,b)'. Use the kadai workflow: pick the story, then create src/math.ts with an add(a, b) function and tests/math.test.ts using bun:test. Mark the story 'review' when done. Report which kadai commands you used and any hook errors you saw." \
  | claude -p --model haiku \
  --allowedTools "Bash Edit Write Read mcp__kadai__set_status mcp__kadai__pick_story mcp__kadai__get_active_story mcp__kadai__list_stories mcp__kadai__get mcp__kadai__create_task" \
  2>&1 | tee /tmp/kadai-dogfood-output.txt | tail -40
```

The `--allowedTools` whitelist is conservative — only what the agent needs. Add tools as the test evolves.

### Step 3: Verify each acceptance point

```bash
cd "$TMP"

echo "=== (point 1+3) Did the agent's report mention kadai pick / kadai workflow? ==="
grep -iE "(pick|kadai)" /tmp/kadai-dogfood-output.txt

echo "=== (point 4) Changelog populated? ==="
find .kadai -name changelog.md -exec echo "{}:" \; -exec cat {} \; -exec echo "" \;

echo "=== (point 5) Story status moved? ==="
kadai list story

echo "=== Created files (sanity) ==="
ls src/ tests/ 2>&1

echo "=== Final overall status ==="
kadai status
```

### Step 4: Report verdict

For each of the 6 points, mark ✅/❌/SKIPPED with the evidence above:

- 1. Skill auto-trigger: ✅ if the agent's report references kadai commands/workflow before edits
- 2. Guardrail blocks: ✅ if the report contains "Kadai guardrail" or "blocked because no story is picked" — OR PARTIAL if the agent picked preemptively (which is correct workflow but doesn't exercise the block)
- 3. Recovery via pick: ✅ if `kadai pick STORY-001` was called
- 4. Change capture: ✅ if changelog.md has timestamped entries for each Write
- 5. Status update: ✅ if STORY-001 is in `review` or `done`
- 6. Web viewer: SKIPPED unless you started `kadai serve` separately

Verdict: PASS / PASS-with-notes / FAIL.

### Step 5: Append the run to the dogfood log

If the test passed (or had notable findings), append a dated entry to `docs/dogfood-acceptance-test.md` in the kadai repo so we have a history of dogfood runs over time.

### Step 6: Clean up

```bash
rm -rf "$TMP" /tmp/kadai-dogfood-output.txt
```

## Notes & troubleshooting

- **Uses `--model haiku`** for speed. Switch to `sonnet` if you want more deliberation from the test agent.
- **If `claude` isn't on PATH:** the test can't run. The skill prerequisite is a working `claude` CLI.
- **If point 2 (guardrail) doesn't fire:** the agent may have picked the story preemptively (which is correct workflow). To FORCE the guardrail to fire, modify the prompt to explicitly say "do not pick the story; just edit src/math.ts directly" — the hook should then block and the agent should self-correct.
- **If point 5 fails with "permission denied for mcp__kadai__set_status":** make sure `mcp__kadai__set_status` is in `--allowedTools`. The skill's allowlist already includes it; if you've modified the command, re-check.
- **Repeatability:** each run uses a fresh temp dir, so previous runs don't leak. Safe to run repeatedly.
- **Don't run this against the actual kadai repo or any project you care about** — it's destructive in the temp dir (deletes everything on cleanup) and uses real kadai tooling.

## When to NOT use this skill

- After unrelated CLI/web/docs changes that don't touch hooks, skill, or MCP — those have their own unit tests; the dogfood test is for integration.
- In CI environments without an interactive `claude` install — this skill assumes you can spawn `claude -p` locally.
