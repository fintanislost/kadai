# Follow-up TODOs

> Issues + ideas surfaced during real-world use, not yet planned formally. Captured 2026-05-08 from the ufo_analysis dogfood session.

## Bugs

### 🔴 1. `kadai mcp` rootDir misdirection (architectural)

**Symptom:** Real ufo_analysis work landed at `/home/fintan/repos/.kadai/` instead of `/home/fintan/repos/ufo_analysis/.kadai/`. Agent thought it was working in the right place; nothing in the UX surfaced the divergence.

**Root cause:** `src/cli/mcp.ts:23` does `runServer(process.cwd())`. The MCP server's `rootDir` is locked at startup to whatever cwd Claude Code uses to spawn the subprocess — which is the `.mcp.json`'s parent directory, not the user's session cwd. If `.mcp.json` lives above the actual project (because someone ran `kadai init` at the wrong level), every MCP tool call writes to the wrong spine forever.

**No MCP handler walks up via `findKadaiRoot()`.** They all use `ctx.rootDir` directly (`grep -rn findKadaiRoot src/mcp/` returns zero hits).

**Fix (option B from session discussion):** Bake the absolute path into `.mcp.json` at init time.

Three tasks:

1. **`kadai mcp` accepts `--root <path>`.** `src/cli/mcp.ts`. If provided, `runServer(resolve(opts.root))`; guard that the path contains `.kadai/` and error clearly otherwise. Backwards-compat: no flag → fall back to `process.cwd()`.
2. **`kadai init` writes the absolute path into `.mcp.json`.** `src/cli/init.ts:mergeKadaiIntoMcpJson`. Change `args: ["mcp"]` → `args: ["mcp", "--root", absolutePath]`. Re-running `kadai init` upgrades existing registrations.
3. **Helper messaging when `kadai init` runs in a suspicious location.** `src/cli/init.ts`. Detect: no `.git/` in cwd or any ancestor, or cwd is `$HOME` / `/` / parent of multiple project dirs. Refuse without `--force`, with a message like:

   ```
   ⚠  kadai init at /home/fintan/repos doesn't look like a project root:
       - no .git/ here or in any ancestor
       - looks like a parent of multiple subdirectories: kadai/, ufo_analysis/, ...

   Initializing here means the spine lives at the parent of those projects,
   which is usually NOT what you want. Each project should have its own .kadai/.

     Continue anyway? [y/N]   (or rerun with --force)
   ```

Plugin version bump to 1.4.1. ~4-6 hours including tests + wiki updates.

---

### 🔴 2. Plan 17 runner uses wrong picked-file name

**Symptom:** `kadai run` would never see a picked story.

**Root cause:** `src/cli/run.ts:20` does `join(rootDir, '.kadai/picked')` (no leading dot on `picked`). The canonical filename written by `kadai pick` is `.picked` (with leading dot, see `src/core/picked.ts:6`). I introduced this in `feature/kadai-aware-skills` Task 7 (commit `a420603` / `1d2270f`). Tests passed because they wrote/read the same wrong filename internally.

**Fix:** One-line change — `src/cli/run.ts` reads/writes `.kadai/.picked`. Also update the integration tests in `tests/cli/run.integration.test.ts` to use the canonical name.

**Bonus:** Audit `src/web/api.ts` and any other reader for the same typo. The web viewer should be reading `.picked` correctly (it pre-dates Plan 17), but worth a check.

**Trivial — 15 min including tests.** Probably worth landing on master independently of the bigger bugfix above.

---

### 🟡 3. PostToolUse hook may not be writing changelogs

**Symptom:** Zero `changelog.md` files in `/home/fintan/repos/.kadai/` despite 4 completed tasks under STORY-001.

**Possible causes (unverified):**
- The hook reads `picked` instead of `.picked` (similar to bug #2)
- The hook resolves `rootDir` differently than where the spine actually is (related to bug #1)
- The agent never invoked `Edit`/`Write` while a story was picked (it might have used MCP tools or some other mechanism)
- `change_capture.enabled` is true in config.toml but something about the path resolution fails silently

**Investigation steps:**
1. `grep -n "picked\|changelog" src/cli/hook.ts` — see what filename the PostToolUse hook reads
2. Run `echo '{"tool_name":"Edit","tool_input":{"file_path":"/tmp/foo"}}' | KADAI_RECORD_TO=/tmp/cassette kadai hook post-tool-use` from a project with a picked story; check whether changelog.md gets a line
3. If the hook code uses a different filename or different rootDir resolution, fix to match the canonical pattern

---

## Migration: relocate `/home/fintan/repos/.kadai` → `/home/fintan/repos/ufo_analysis/.kadai`

**Why:** The in-flight ufo_analysis spine landed at `/home/fintan/repos/.kadai/` (one directory too high) due to bug #1. Move it back to where it belongs.

**Pre-flight:**
1. Confirm no kadai mcp / serve / agent is running: `pgrep -af "kadai (mcp|serve)" || echo OK`
2. Confirm ufo_analysis has no `.kadai/`: `ls /home/fintan/repos/ufo_analysis/.kadai 2>&1`
3. **Insurance backup** (no git in either dir, so nothing to revert against): `tar czf ~/kadai-ufo-backup-$(date +%s).tgz -C /home/fintan/repos .kadai .mcp.json .claude`

**Move:**
```bash
cd /home/fintan/repos
mv .kadai ufo_analysis/.kadai
mv .mcp.json ufo_analysis/.mcp.json
mv .claude/settings.json ufo_analysis/.claude/settings.json
rmdir .claude    # was empty after settings.json moved
```

**Verify:**
```bash
cd /home/fintan/repos/ufo_analysis
ls .kadai/epics/       # should show EPIC-001 + EPIC-002
bun /home/fintan/repos/kadai/src/cli/index.ts status   # STORY-001 picked
```

**Then restart claude in the new location.** Without the bugfix above, the existing `.mcp.json` has `args: ["mcp"]` (no `--root`), so the MCP server starts with `process.cwd() = /home/fintan/repos/ufo_analysis/`, finds `.kadai/` there, and uses it correctly. Migration alone doesn't reintroduce the bug; the bug only re-bites on a future accidental `kadai init` somewhere else.

---

## Use-case observations from the dogfood (positive + open questions)

### What worked

- **Wrappers fired end-to-end.** EPIC-002 + FEAT-001 with attached spec + 4 stories with attached plans + 18 tasks. Full kadai-aware-skills shape, in real product work.
- **Task slugs are self-documenting.** `TASK-006-create-ocr-scanned-py-running-pdftoppm-and-tessera` — the slug derivation preserves enough title for `ls` to be useful.
- **Status transitions happened correctly.** TASK-001..004 went `done`, STORY-001 is `in_progress`, picked is current.
- **Wrapper-design improvement (commit `6859bb6`) validated in production.** The create-tasks-first ordering meant attach_plan landed final correct content; no placeholder dance.
- **Cassette tier proved its value during this session.** The improved diff output (`47d6b10`) was what made the placeholder-vs-real-ID divergence diagnosable in seconds rather than spelunking.
- **The kadai guardrail just blocked the original write of this very file** (because no story was picked in the kadai repo) and forced it under `docs/` — the gate works in real use, not just in tests.

### Open questions worth answering when next in the ufo_analysis project

- Did the user ever invoke `kadai run`? If yes, what happened? (Bug #2 says it would have silently no-op'd.)
- Is anything driving task status transitions automatically, or is the user / agent manually calling `kadai set-status`?
- If we relocate the spine, does Claude Code pick up the new `.mcp.json` cleanly on session restart?
- After ~14 more tasks complete, what does the spine size look like? Does anything degrade (counters performance, web viewer load times, anything else)?

### Things to watch for

- **Silent path bugs are the worst class.** All three bugs above are silent — they don't error, they just write to the wrong place / read from the wrong file / no-op invisibly. Worth thinking about "loud-fail" patterns: every read/write should error if its assumed path doesn't exist, rather than no-op'ing or creating something fresh.
- **No git in the in-flight project means no history backstop for kadai mistakes.** Suggest in the wiki: kadai works best in a git repo, and `kadai init` could even auto-`git init` if `--git` is passed.

---

## Suggested ordering when picking these up next session

1. **Bug #2** (picked-file typo) — trivial, lands on master independently. 15 min.
2. **Migration** (relocate ufo work) — one-shot user action when the agent isn't actively writing. ~5 min.
3. **Investigation for Bug #3** (changelog hook) — diagnostic only; fix scope depends on what's found. 30 min to investigate.
4. **Bug #1 fix (--root in .mcp.json)** — full spec + plan + branch. ~4-6 hours.

Items 1-3 are low-risk cleanups. Item 4 is the architectural fix that prevents this entire class of issue going forward.
