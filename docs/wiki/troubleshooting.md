# Troubleshooting

## "After `kadai init`, hooks/MCP don't seem to be working"

**Cause:** MCP servers and hooks are loaded by Claude Code at session start. If you ran `kadai init` while a Claude Code session was already open in that directory, the new `.mcp.json` and `.claude/settings.json` aren't picked up.

**Fix:** Restart your Claude Code session in the project directory.

## "`kadai serve` fails with 'Web viewer assets not found'"

**Cause:** The web viewer needs `src/web/dist/` to exist (Vite-built SPA assets). For Plan 4 MVP, asset embedding into the binary is deferred — `kadai serve` reads dist at runtime.

**Fix:** From the kadai source repo:

```bash
cd /path/to/kadai-repo
bun run build:web
```

Then `kadai serve` again. (Re-run `build:web` after pulling source updates.)

## "`kadai` is not on my PATH after `bun link`"

**Cause:** `bun link` registers the package globally but doesn't always add `~/.bun/bin` to your shell's PATH.

**Fix:** Symlink into a directory that IS on PATH:

```bash
mkdir -p ~/.local/bin
ln -sf ~/.bun/bin/kadai ~/.local/bin/kadai
```

Or add `~/.bun/bin` to your shell's PATH (`.bashrc` / `.zshrc`).

## "I want to edit a file but the guardrail keeps blocking me"

**Cause:** The PreToolUse hook blocks `Edit`/`Write` outside `.kadai/` and the configured allowlist when no story is picked.

**Three fixes (pick one):**

1. **Pick a story** (the right answer): `kadai pick STORY-XXX`
2. **Add the path to the allowlist** (if it's a permanently-allowed path like `docs/`): `kadai config guardrail.allowed_paths` shows the current list; edit `.kadai/config.toml` to add to it.
3. **Bypass for one session** (one-off escape): set `KADAI_BYPASS=1` in your shell. Optionally `KADAI_BYPASS_REASON="..."` for the audit log at `.kadai/bypass.log`.

## "The guardrail isn't blocking anything — agents write code without picking a story"

**Cause:** Your `[guardrail.allowed_paths]` is too permissive. The default ships with `["docs/", "README.md", ".gitignore", "CLAUDE.md"]` — wide enough that brainstorming and planning docs go in `docs/` without forcing a pick, but narrow enough that source files (`src/`, `app/`, `lib/`) and scripts hit the gate.

If your project has an older default that includes `scripts/`, edit `.kadai/config.toml` and remove it. For strict enforcement (block everything except spec/plan docs):

```toml
[guardrail]
allowed_paths = [ ".gitignore", "CLAUDE.md", "README.md", "docs/superpowers/" ]
```

## "/kadai-pick or /kadai-status returns 'Unknown command'"

**Cause:** The kadai plugin isn't actually installed. Claude Code plugins come from **marketplaces** — `/plugin install <local-path>` is not supported. You need to register the kadai repo as a marketplace first.

**Fix:**

```
/plugin marketplace add /path/to/kadai-repo
/plugin install kadai@kadai
/reload-plugins
```

Verify with `/help` — the `kadai` skill should appear in the available skills list.

## "The MCP server isn't appearing in my Claude Code"

**Causes:**
- `.mcp.json` isn't in the project root (run `kadai init` from the project root)
- Claude Code session was already open before init (restart)
- MCP server not registered in your Claude Code's allow list — Claude Code may prompt to approve new MCP servers on first start

## "I want a CLI to set status to `done` (for testing)"

**Status:** Post-MVP. Currently the only CLI status mutations are:
- `kadai pick <id>` — transitions to `in_progress`
- `kadai unpick` — does NOT change status

For arbitrary transitions (`in_progress → review`, `review → done`), use the MCP tool `set_status` from a Claude Code session, or call into `src/core/operations.ts` from a script.

A `kadai set-status <id> <status>` CLI command is on the post-MVP backlog.

## "I want to delete a kadai item"

**Status:** Post-MVP. There's no `kadai delete` command yet. Workaround: directly `rm -rf` the item's directory, then run a counter rebuild (also post-MVP — for now you can edit `.kadai/.counters.json` by hand if you need to recycle IDs).

## "The runner is stuck in paused-needs-feature and won't advance"

**Cause:** The runner is waiting for you to confirm the unblocker plan. Inspect the current state:

```bash
kadai run --status
```

The `lastBlocker` field shows what feature the implementer asked for. Three ways to resolve:

1. **Plan the unblocker:** `/kadai-run` from Claude Code re-presents the prompt; answer Y to invoke `kadai-brainstorming` in fast-follow-up scope. The runner will then queue the original story and start on the new feature's stories.
2. **Skip:** Mark the original story blocked manually (`kadai set-status STORY-XXX blocked`) and start a fresh `/kadai-run` — it will see no runnable story and stop cleanly.
3. **Reset state:** If the runner is genuinely stuck (e.g., from a crash), `kadai run --status` shows the problem. Manually editing `.kadai/runner.json` (set `status: "idle"`, clear `pausedStack: []`) will get you out — but you'll lose the resume context.

## "kadai run says no story picked but I have stories"

**Cause:** The runner consults `.kadai/.picked` for the current target. If you have stories in your spine but none is picked, run:

```bash
kadai pick STORY-001
/kadai-run
```

`kadai status` shows the full ready queue — pick the story you want the runner to start with before invoking `/kadai-run`.

## "Wrapper skill didn't fire — I see superpowers:brainstorming was loaded instead"

**Cause:** Skill matching is heuristic. Claude picked the upstream skill because the prompt matched its description more directly. The kadai wrappers are designed to take precedence when a `.kadai/` directory is present, but the matching is not deterministic.

**Fix:** Be explicit in your prompt — "Use kadai-brainstorming to design X" forces the wrapper. Alternatively, if the problem persists across sessions, reload the plugin so the latest SKILL.md descriptions are indexed:

```
/plugin uninstall kadai
/plugin install kadai@kadai
/reload-plugins
```

The kadai discipline skill's description points agents at the wrappers — make sure you're on the latest plugin version before filing a bug.

## "Tests fail with permission errors on `proper-lockfile`"

**Cause:** `proper-lockfile` uses an OS-level advisory lock. On some filesystems (e.g., NFS, certain CI environments) the lock primitive isn't supported.

**Fix:** Tests should use temp dirs on local disk (the existing `mkdtempSync(tmpdir(), ...)` pattern does this). If you're hitting it elsewhere, file an issue.

## "Cassette test failed: cassette diverged"

**Cause:** The replay test (Tier 2) found that current code produces a different `.kadai/` state than the captured cassette expected. Either:

- A real bug — your change breaks the wrapper's spine writes
- A valid behavior change — the wrapper now produces a different (still-correct) end state

**Diagnostic:** read the diff message carefully. It lists `missing:` / `extra:` / `content mismatch:` paths with a hint at the divergence position.

**Fix paths:**

1. **If it's a bug:** revert the change OR fix it so the cassette replays cleanly.
2. **If the behavior change is intentional:** re-record the cassette:

   ```
   rm -rf tests/cassettes/<name>
   bun scripts/record-cassette.ts <name> "<original prompt>"
   git add tests/cassettes/<name>
   git commit
   ```

   Be deliberate — the cassette is the contract. Re-recording is fine when the behavior change is intended (e.g., new `kadai add story` flag, schema migration). It's NOT fine to silently re-record because the test is annoying — that defeats the whole tier.
