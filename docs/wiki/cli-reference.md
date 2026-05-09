# CLI reference

Run `kadai <command> --help` for full flags on any subcommand.

## `kadai init`

Bootstrap a kadai spine in the current directory.

| Flag | Effect |
|---|---|
| `-y, --yes` | Skip prompts, use defaults; creates EPIC-001 titled "Project setup" so the spine is usable immediately |
| `--markdown-only` | Create `.kadai/` + README only; skip `.mcp.json` / `.claude/settings.json` / `CLAUDE.md` integration. For users who just want files + the web viewer (no agent guardrails). |

Touches:
- `.kadai/{config.toml, README.md, .gitignore, epics/}`
- `.mcp.json` (merges in the kadai MCP server registration)
- `.claude/settings.json` (merges in all four hook entries: PreToolUse, PostToolUse, UserPromptSubmit, Stop)
- `CLAUDE.md` (appends a `## Kadai` section)

Re-running is safe: nothing is overwritten or duplicated.

## `kadai add <kind> [options]`

Create an epic, feature, story, or task.

| Flag | Required for | Notes |
|---|---|---|
| `-t, --title <title>` | All | Prompted if omitted |
| `-p, --phase <phase>` | epic, feature, story | Prompted if omitted; tasks inherit from story |
| `-o, --order <n>` | None | Auto-assigned via sparse ordering if omitted |
| `--parent <id>` | feature/story/task | The parent's ID. Epics have no parent. |
| `--epic <id>` | feature (alias) | Equivalent to `--parent` when adding a feature |
| `--feature <id>` | story (alias) | Equivalent to `--parent` when adding a story |
| `--story <id>` | task (alias) | Equivalent to `--parent` when adding a task |

> The kind-specific aliases (`--epic`, `--feature`, `--story`) are sugar — they exist because agents often reach for them by intuition. All four flags resolve to the same `parent` field.

## `kadai get <id>`

Fetch a single item by ID and print it as JSON. Useful for debugging or scripting.

```bash
kadai get EPIC-001              # → JSON of the epic
kadai get STORY-042 | jq .data  # extract just the frontmatter
kadai get FEAT-999              # → "Item not found: FEAT-999" (exit 1)
```

## `kadai list <kind> [filters]`

| Flag | Effect |
|---|---|
| `-p, --phase <phase>` | Filter by phase slug |
| `-s, --status <status>` | Filter by status (`backlog`, `ready`, `in_progress`, `blocked`, `review`, `done`, `cancelled`) |
| `--parent <id>` | Filter by parent ID |

## `kadai status`

Print the picked story, in-progress items, and the ready queue.

## `kadai pick <story-id>`

Pick a story. Two effects:
1. Sets the picked-story flag (`.kadai/.picked`) — used by the PostToolUse hook for change capture.
2. Transitions the story's status to `in_progress` (must be in `ready` first).

Only stories can be picked.

## `kadai set-status <id> <status> [--reason]`

Update the status of any item. Validates against the state machine; illegal transitions exit 1 with an error message.

```bash
kadai set-status STORY-001 in_progress
kadai set-status STORY-001 review --reason "tests pass, awaiting code review"
kadai set-status STORY-001 done
```

The `--reason` flag is accepted (logged in CLI output) but not persisted in MVP — it's reserved for the post-MVP audit log feature.

For programmatic use, the MCP tool `mcp__kadai__set_status` does the same thing.

## `kadai unpick`

Clear the picked-story flag. Does NOT change status.

## `kadai disable [--reason <text>]`

Disable kadai in this project. Writes `.kadai/disabled`. Hooks no-op, mutating commands error, MCP refuses mutating tools, web viewer shows a DISABLED banner. Reads still work, as do `kadai disable`/`enable`/`status`/`run`.

```
kadai disable
kadai disable --reason "quick refactor"
```

Idempotent — running twice prints a warning and preserves the original reason.

## `kadai enable`

Re-enable kadai in this project. Removes `.kadai/disabled`. No drift detection — if you did spine-relevant work while disabled, record it manually.

```
kadai enable
```

Idempotent — running twice prints an info message.

## `kadai sync [options]`

Scan the git log for `EPIC-NNN` / `FEAT-NNN` / `STORY-NNN` / `TASK-NNN` references in commit messages and append each matching commit to the referenced item's `changelog.md`. Idempotent — re-running adds only commits not already present (dedup by short SHA).

| Flag | Effect |
|---|---|
| `--since <ref>` | Only scan commits since this git ref (commit/tag/branch). Equivalent to `git log <ref>..HEAD`. |
| `--branch <name>` | Scan a specific branch instead of HEAD. |
| `--dry-run` | Show what would be appended without writing to disk. |

Example:

```bash
kadai sync                              # full scan of HEAD
kadai sync --since v0.5.0               # only commits since the v0.5.0 tag
kadai sync --branch feature/auth        # scan a feature branch
kadai sync --dry-run                    # preview only
```

The append format is:
```
- 2026-05-06T20:30:00Z `commit` 7d8cc19 feat: implement STORY-001 happy path
```

Distinct from the hook-written format (`` `Write` src/foo.md ``) so the two coexist in one changelog without conflict.

When `auto_transitions.pr_merge_marks_story_done = true` (set via `kadai config auto_transitions.pr_merge_marks_story_done=true`), commits whose subject matches `^Merge pull request #N` AND reference a `STORY-NNN` will transition that story to `done` (only if the current status allows the transition).

## `kadai phases [list|add|remove|rename] ...`

Manage the project's phase config.

| Subcommand | Args |
|---|---|
| `list` (default) | — |
| `add <slug> <display> [color]` | color defaults to `#888888` |
| `remove <slug>` | `[--move-to <slug>]` migrates items to the target phase first; otherwise errors when items reference the phase. |
| `rename <oldSlug> <newSlug> <newDisplay>` | |

## `kadai config <expr>`

Read or write a config key. Dotted-path access into `config.toml`.

```bash
kadai config change_capture.enabled              # → true
kadai config change_capture.enabled=false        # set
kadai config guardrail.allowed_paths             # → ["docs/", ...]
```

Type coercion is based on the existing value (boolean stays boolean, etc.).

## `kadai mcp`

Run the MCP stdio server. Spawned by Claude Code via `.mcp.json` — not for direct use.

Tool surface (19 tools):
- **Reads:** `list_phases`, `list_epics`, `list_features`, `list_stories`, `list_tasks`, `get`, `get_active_story`, `search`
- **Writes:** `create_epic`, `create_feature`, `create_story`, `create_task`, `set_status`, `set_phase`, `attach_spec`, `attach_plan`, `pick_story`, `unpick`

All write tools validate against the schema + state machine.

## `kadai plan compose <id>`

Render all descendant story plans of an epic, feature, or story as one composite markdown document. Useful for feeding a full implementation plan into an agent context or reviewing what's planned across a scope.

```bash
kadai plan compose EPIC-001                  # to stdout
kadai plan compose FEAT-001 --out plan.md    # to file
```

Stories without a `plan.md` render as "(no plan yet)" so the composite mirrors the actual spine state rather than hiding gaps.

## `kadai run [--status]`

Autonomous runner — informational from the CLI (the real execution lives in the `/kadai-run` slash command, which can use Claude Code's Task tool to dispatch implementer subagents).

```bash
kadai run --status        # JSON-print .kadai/runner.json
kadai run                 # informational; tells you to use /kadai-run from Claude Code
```

State is persisted in `.kadai/runner.json` and survives across sessions. To start or resume a run, use `/kadai-run` from a Claude Code session.

## `kadai hook (pre-tool-use|post-tool-use|user-prompt-submit|stop)`

Hook scripts invoked by Claude Code via `.claude/settings.json`. Read JSON from stdin, exit 0 (allow / inject) or 2 (block, with stderr message).

| Subcommand | Trigger | Effect |
|---|---|---|
| `pre-tool-use` | Before `Edit` / `Write` | Blocks edits to paths outside `.kadai/` and the configured allowlist when no story is picked. Honors `KADAI_BYPASS=1` (logged to `.kadai/bypass.log`). |
| `post-tool-use` | After `Edit` / `Write` | Appends each edit to the picked story's `changelog.md` if `change_capture.enabled = true`. |
| `user-prompt-submit` | Before each user prompt | Injects an `[kadai-active-story]` context block into the prompt when a story is picked (id, title, phase, status, spec/plan attachments, acceptance criteria). Silent otherwise. |
| `stop` | After Claude finishes a turn | If the picked story is `in_progress` AND the changelog has fresh entries (within 30 minutes), prints a JSON `{"reason": "..."}` reminder; Claude Code surfaces it on the next prompt. Silent otherwise. |

`kadai init` registers all four entries in `.claude/settings.json` automatically. Re-running `init` is safe (idempotent on hook entries).

## `kadai serve [options]`

Start the localhost web viewer.

| Flag | Effect |
|---|---|
| `-p, --port <n>` | Port (default: ephemeral) |
| `--no-open` | Don't auto-open the browser |
| `--single` | Force single-project mode (ignore the registry) |
| `--project <slug>` | Open browser pre-selected to a registered project (multi-project mode) |

Requires `bun run build:web` to have built `src/web/dist/` (one-time per source checkout).

### `kadai serve register [path]`

Add a project to `~/.kadai/known-projects.json`. Multi-project mode auto-activates when ≥1 project is registered.

| Flag | Effect |
|---|---|
| `--slug <slug>` | URL slug (default: basename of path) |
| `--name <name>` | Display name (default: slug) |

```bash
kadai serve register                       # registers cwd
kadai serve register ~/projects/foo        # registers a specific path
kadai serve register . --slug myproj --name "My Project"
```

### `kadai serve list`

Print the registered projects.

### `kadai serve unregister <slug>`

Remove a project from the registry. Does NOT delete its `.kadai/`.

## `kadai uninstall [options]`

Reverse of `kadai init`. Removes:

- `.kadai/` directory (unless `--keep-spine`)
- the `kadai` entry from `.mcp.json` (preserving any sibling MCP servers)
- all four `kadai hook ...` entries from `.claude/settings.json` (preserving sibling hooks)
- the `## Kadai` section from `CLAUDE.md`

| Flag | Effect |
|---|---|
| `--keep-spine` | preserve `.kadai/` (only remove integration: MCP, hooks, CLAUDE.md section) |
| `-y, --yes` | skip the confirmation prompt |

Example:

```bash
kadai uninstall              # interactive — prompts before deleting .kadai/
kadai uninstall --keep-spine # remove integration, keep the spine for re-init later
kadai uninstall -y           # delete everything, no prompt
```

A subsequent `kadai init` will re-create the integration.
