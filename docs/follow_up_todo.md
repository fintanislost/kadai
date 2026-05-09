# Follow-up TODOs

> Issues + ideas surfaced during real-world use. Captured 2026-05-08 from the ufo_analysis dogfood session, updated post-cleanup the same evening with the broader root-walking diagnosis.

## Bugs (open)

### 🔴 1. `findKadaiRoot` walks across project boundaries silently (architectural)

> **Reframed.** Originally this was scoped to "kadai mcp rootDir misdirection." The post-migration audit revealed the issue is broader — see "Surprise discovery" below.

**Symptom:** Real ufo_analysis work landed at `/home/fintan/repos/.kadai/` instead of `/home/fintan/repos/ufo_analysis/.kadai/`. Agent thought it was working in the right place; nothing in the UX surfaced the divergence.

**Surprise discovery during post-migration audit:** `ufo_analysis/.claude/settings.local.json` contained `"disabledMcpjsonServers": ["kadai"]`. The kadai MCP server was DISABLED for the entire 30-story session. **All 58 task creates and 30 story creates happened via `kadai add` CLI calls invoked from Bash, not via MCP tools.**

That means the misdirection isn't really an MCP issue at all. The CLI walks up from `process.cwd()` via `findKadaiRoot` (`src/core/find-root.ts`), which has no concept of a project boundary — it walks all the way to `/` looking for any ancestor `.kadai/`. If a stray `.kadai/` exists at any ancestor, every `kadai` command silently uses it.

**Root cause (now narrower than originally diagnosed):** `findKadaiRoot` has no project-boundary stop condition.

**Fix (revised):** Two surfaces, both need to be addressed:

1. **CLI path (the bigger, newly-identified surface):** `findKadaiRoot` should refuse to walk past a project boundary. Simplest signal: `.git/`. If the cwd is inside a git repo and the walk reaches the repo root without finding `.kadai/`, return `null` rather than continuing upward. "No kadai project here" is the correct answer in that case. This single change kills the silent-misdirection class for any user with git-tracked projects.

2. **MCP path (still also broken):** `kadai mcp` accepts `--root <path>`, and `kadai init` bakes the absolute path into `.mcp.json` at init time. Independent of the CLI fix because MCP servers spawn from `.mcp.json`'s directory which may differ from anywhere the user runs CLI commands from.

**Three tasks (revised):**

1. **`findKadaiRoot` stops at `.git/`.** `src/core/find-root.ts`. While walking up, if `<cur>/.git` exists AND `<cur>/.kadai` does not exist, return `null`. Stop the walk at the repo root. ~5 lines + 3 tests covering: cwd inside repo with `.kadai/` returns it; cwd inside repo with no `.kadai/` returns null (does NOT walk past `.git/`); cwd outside any repo walks unbounded as today (back-compat for non-git use).

2. **`kadai mcp` accepts `--root <path>`.** `src/cli/mcp.ts`. If provided, `runServer(resolve(opts.root))`; guard that the path contains `.kadai/` and error clearly otherwise. Backwards-compat: no flag → fall back to `findKadaiRoot(process.cwd()) ?? process.cwd()` (so existing `.mcp.json` files keep working, and they benefit from the find-root fix in task 1 too).

3. **`kadai init` writes the absolute path into `.mcp.json`** AND **emits a helper message when init runs in a suspicious location** (no `.git/` in cwd or any ancestor, or cwd is `$HOME` / `/` / parent of multiple project dirs). Refuse without `--force`. Re-running `kadai init` upgrades existing `.mcp.json` registrations to include the `--root` arg.

Plugin version bump to 1.4.1. ~5-7 hours total now.

---

### 🟡 3. PostToolUse hook may not be writing changelogs

(unchanged from original — see investigation steps below)

**FINDING from the dogfood session:** Even after 58 done tasks across 30 stories, ZERO `changelog.md` files exist in the spine. This was verified on the in-flight project before migration. Root cause unconfirmed; possible factors include:

- The agent did all writes from `cwd=/home/fintan/repos/ufo_analysis/`, but the spine was at `/home/fintan/repos/.kadai/` (one level up). The PostToolUse hook calls `findKadaiRoot(process.cwd())` which walks up — that should have found the spine. So this isn't the same class of bug as #1.
- More likely: the agent rarely or never invoked `Edit`/`Write` on a file path inside the spine OR while a story was picked. The `kadai add` CLI calls aren't `Edit` tool calls — they're `Bash` invocations that don't fire the PreToolUse/PostToolUse(Edit, Write) hooks.
- Worth verifying by inspecting the hook code path against the actual conditions of the session.

**Investigation steps:**
1. `grep -n "picked\|changelog" src/cli/hook.ts` — see what filename the PostToolUse hook reads
2. Does the hook fire on `Bash` tool invocations, or only `Edit`/`Write`? (If only the latter, and the agent used `Bash` to run `kadai add` etc., then no changelogs would ever be written for that workflow.)
3. Run `echo '{"tool_name":"Edit","tool_input":{"file_path":"/tmp/foo"}}' | kadai hook post-tool-use` in a project with a picked story; check whether `changelog.md` gets a line.

---

## Bugs (closed in this session)

### ✅ 2. Plan 17 runner used wrong picked-file name

Fixed in commit `259a176` on `feature/cassette-tier`. `src/cli/run.ts` now reads/writes the canonical `.kadai/.picked`. Tests + comments updated. The web viewer reads `.picked` correctly (predates Plan 17, no audit issue).

### ✅ 4. Cassette `normalizeSpine` only normalized datetimes-with-T, not date-only fields

Fixed in commit `f111b0b` on `feature/cassette-tier`. The `created`/`updated` frontmatter fields are date-only YAML strings (kadai writes `new Date().toISOString().split('T')[0]`). A cassette recorded May 7 always diverged from a May 8 replay because the regenerated dates differed. Added an `ISO_DATE_REGEX` to normalize date-only YYYY-MM-DD strings to `<DATE>` alongside the existing datetime-to-`<TIMESTAMP>` rule. Updated the corresponding unit test. The blog-mvp cassette now replays cleanly across days.

> The original Task 1 of the cassette plan deliberately preserved date-only strings on the assumption they were "deterministic given a known seed" — true for hand-crafted unit-test seeds, false for real cassettes from the agent. The reasoning was wrong; the fix is correct.

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

**COMPLETED** 2026-05-08 evening. Backup at `~/kadai-ufo-backup-1778292311.tgz`. Counters intact post-move (2 epics, 12 features, 30 stories, 58 tasks). `kadai status` from the new location confirms spine is queryable. `/home/fintan/repos/` top-level is clean of kadai residue. The existing `.mcp.json` had `args: ["mcp"]` with no `--root`, so the MCP server now starts with `process.cwd() = /home/fintan/repos/ufo_analysis/`, finds `.kadai/` at that level, and uses it correctly — migration alone didn't reintroduce the bug.

---

## Use-case observations from the dogfood

### Final state of the in-flight project

- **30 stories, 58 tasks, all done.** 12 features across 2 epics. Real product shipped: PDF analysis dashboard with OCR pipeline, FTS5 search, geocoding/maps, timeline, clustering, graph visualization, R2 deployment.
- **Wrappers fired correctly across 12 distinct features.** Each ran the full kadai-brainstorming + kadai-writing-plans cycle. The create-tasks-first wrapper ordering (commit `6859bb6`) held in production.
- **Task slugs are self-documenting.** `TASK-006-create-ocr-scanned-py-running-pdftoppm-and-tessera` — the slug derivation preserves enough title for `ls` to be useful at scale.
- **EPIC-002 stayed `ready` despite all features done.** kadai doesn't auto-cascade epic→done from features-done. Minor follow-up; either implement an auto-transition rule or document that epic status is manual.

### What worked vs what surprised

- **The kadai guardrail blocked my own write of this very file** (no story picked in the kadai repo) and forced it under `docs/`. The gate fires correctly in real use.
- **Cassette tier earned its keep during the cleanup session.** The improved diff output (`47d6b10`) made the placeholder-vs-real-ID divergence diagnosable in seconds, and the post-recording date issue (commit `f111b0b`) was found by re-running the replay against today's date.
- **Surprise: the agent disabled the kadai MCP.** `disabledMcpjsonServers: ["kadai"]` in `.claude/settings.local.json`. Reframed the entire bug #1 diagnosis (see above) from "MCP issue" to "CLI also walks up unbounded." A more general fix.
- **Bug #3 confirmed.** Zero `changelog.md` files anywhere in the spine despite 58 done tasks. Root cause unknown until investigated; most likely the agent's path was `kadai add ...` via `Bash`, not `Edit`/`Write` on spine files — and `Bash` doesn't fire the PostToolUse(Edit, Write) hook.
- **No git in the in-flight project.** Easy to lose data on misadventure. Worth a wiki note suggesting kadai works best in a git-tracked project; could add `kadai init --git` to auto-`git init` if not already.

### Open questions for the next session

- Verify whether `kadai run` would now work end-to-end against the migrated ufo_analysis spine (bug #2 fix landed; this is the validation).
- Walk the hook code to confirm bug #3's root cause and whether `Bash` should also fire a hook.
- Add a "kadai works best in a git repo" recommendation to the wiki, possibly with `kadai init --git`.

### Open questions worth answering when next in the ufo_analysis project

- Did the user ever invoke `kadai run`? If yes, what happened? (Bug #2 says it would have silently no-op'd.)
- Is anything driving task status transitions automatically, or is the user / agent manually calling `kadai set-status`?
- If we relocate the spine, does Claude Code pick up the new `.mcp.json` cleanly on session restart?
- After ~14 more tasks complete, what does the spine size look like? Does anything degrade (counters performance, web viewer load times, anything else)?

### Things to watch for

- **Silent path bugs are the worst class.** All three bugs above are silent — they don't error, they just write to the wrong place / read from the wrong file / no-op invisibly. Worth thinking about "loud-fail" patterns: every read/write should error if its assumed path doesn't exist, rather than no-op'ing or creating something fresh.
- **No git in the in-flight project means no history backstop for kadai mistakes.** Suggest in the wiki: kadai works best in a git repo, and `kadai init` could even auto-`git init` if `--git` is passed.

---

## Idea: a kadai on/off toggle

**Use cases that emerged this session:**

- "I want to do something quick that's not part of the spine" — without picking a story or editing the allowlist.
- "kadai is misbehaving and I need to bypass everything" — the user actually hit this and disabled the MCP via Claude Code's `disabledMcpjsonServers`. But the hooks still ran.
- "This project shouldn't be tracked by kadai for one specific session" — exploratory work in a kadai repo.
- A friendlier alternative to `KADAI_BYPASS=1` for session-long opt-outs.

**The current escape hatches are partial and asymmetric:**

| Surface | How to disable today |
|---|---|
| MCP server | `disabledMcpjsonServers: ["kadai"]` in Claude Code's `settings.local.json` |
| PreToolUse / PostToolUse hooks | Edit `.claude/settings.json` and remove the entries |
| `UserPromptSubmit` / `Stop` hooks | Same |
| Skills (`kadai-*`) | Don't load them (Claude's choice based on prompt matching) |
| CLI commands | No way to disable; you just don't run them |
| Per-write bypass | `KADAI_BYPASS=1` env var (per-shell, all-or-nothing) |

Each surface has a different opt-out mechanism; nothing flips them all at once. The user disabled the MCP but the PreToolUse hook still ran (which is why the agent saw the guardrail and used the CLI instead — a happy accident).

**Recommendation: a single project-level disabled flag, checked at every surface.**

Two parts:

1. **`.kadai/disabled` flag file** (or `disabled = true` in `config.toml` — pick one). When present, every kadai surface checks it at entry and short-circuits to a clean no-op:
   - PreToolUse hook → exits 0 (allow the write, don't gate)
   - PostToolUse hook → exits 0 without writing changelog
   - UserPromptSubmit → no context injection
   - Stop → no reminder
   - MCP `runServer` → optionally returns "kadai disabled in this project" on every tool call (the agent knows immediately)
   - CLI mutating commands (`add`, `pick`, `set-status`, etc.) → error with "kadai is disabled in this project; `kadai enable` to re-enable"

2. **CLI verbs to control it:**
   - `kadai disable [--reason "..."]` — writes the flag, optional reason logged
   - `kadai enable` — removes the flag
   - `kadai status` shows DISABLED prominently when active

3. **Plugin slash commands** (the actual "toggle in the plugin" the user asked about):
   - `/kadai-disable [reason]` and `/kadai-enable` — wrap the CLI verbs for one-keystroke control inside a Claude Code session

**Main tradeoff:** when disabled, the spine still exists but isn't being maintained. Risk of drift between disabled work and the spine state. Mitigation: `kadai enable` could prompt "X edits happened to spine-watched paths while disabled — investigate?" using `find -newer .kadai/disabled` against allowlist paths. Probably overkill for v1; surface the option in a follow-up.

**Implementation cost:** small. ~3 hours including hook updates + CLI verbs + slash commands + tests + wiki. The cost is concentrated in coordination — every hook + the MCP + the CLI need the same check, ideally factored into one helper (`isDisabled(rootDir)`).

**Worth doing soon.** This is the friendliest thing kadai could add for users who occasionally don't want kadai in the way. It also gives a clean answer to "I'm using kadai but I want to do this one weird thing" — currently there's no good answer beyond `KADAI_BYPASS=1` per-shell.

---

## Suggested ordering when picking these up next session

1. **Bug #2** (picked-file typo) — **DONE** in commit `259a176`.
2. **Bug #4** (date-only normalization) — **DONE** in commit `f111b0b`.
3. **Migration** (relocate ufo work) — **DONE** 2026-05-08 evening.
4. **Investigation for Bug #3** (changelog hook) — diagnostic only; fix scope depends on what's found. 30 min.
5. **Bug #1 fix (find-root project boundaries + --root in .mcp.json + init helper messaging)** — full spec + plan + branch. ~5-7 hours.
6. **kadai disable/enable toggle** — see "Idea" section above. ~3 hours.

Items 4-6 are still open. Item 5 is the architectural fix; item 6 is the friendly UX addition. They're orthogonal, so order doesn't matter — could ship them on independent branches.
