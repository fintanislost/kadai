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

## "Tests fail with permission errors on `proper-lockfile`"

**Cause:** `proper-lockfile` uses an OS-level advisory lock. On some filesystems (e.g., NFS, certain CI environments) the lock primitive isn't supported.

**Fix:** Tests should use temp dirs on local disk (the existing `mkdtempSync(tmpdir(), ...)` pattern does this). If you're hitting it elsewhere, file an issue.
