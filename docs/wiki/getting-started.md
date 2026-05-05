# Getting started

Three setup steps (one-time per machine), then `kadai init` once per project, then you're using it.

## 1. Install kadai globally

From the kadai source repo:

```bash
cd /path/to/kadai-repo
bun install               # if you haven't yet
bun link                  # registers the `kadai` binary
bun run build:web         # builds the web viewer SPA into src/web/dist/
```

If `bun link` doesn't put `kadai` on your PATH automatically, add a symlink:

```bash
mkdir -p ~/.local/bin
ln -sf ~/.bun/bin/kadai ~/.local/bin/kadai
# (make sure ~/.local/bin is in your PATH)
```

Verify:

```bash
kadai --version    # → 0.1.0
kadai --help       # lists all subcommands
```

## 2. Install the Claude Code plugin (one-time per Claude Code installation)

In a Claude Code session:

```
/plugin install /path/to/kadai-repo/kadai-plugin
/reload-plugins
```

This loads the `kadai` skill (auto-triggers on planning language) and the `/kadai-pick` / `/kadai-status` slash commands.

## 3. Initialize a project

In any project where you want to use kadai:

```bash
cd ~/projects/my-app
kadai init
```

This creates:

- `.kadai/` — your spine (config, epics dir, README)
- `.mcp.json` — registers the kadai MCP server so agents in this project can call `kadai.list_stories`, `kadai.create_*`, etc.
- `.claude/settings.json` — installs the PreToolUse + PostToolUse hooks (the guardrails)
- Appends a `## Kadai` section to `CLAUDE.md`

The wizard offers to create your first epic. Accept it (or use `kadai init -y` to skip).

> **⚠ Restart your Claude Code session in this directory after `kadai init`.** MCP servers and hooks are loaded at session start; an existing session won't pick them up until you restart.

## 4. Build the spine

After init, add features, stories, and tasks under the epic:

```bash
kadai add feature --title 'User login' --phase mvp --parent EPIC-001
kadai add story --title 'Email login' --phase mvp --parent FEAT-001
kadai add task --title 'Add bcrypt hashing' --parent STORY-001
```

See the [CLI reference](cli-reference.md) for all the flags.

## 5. Start working

```bash
kadai pick STORY-001    # picks the story + transitions to in_progress
kadai status            # shows what's picked + the queue
```

Now Claude Code agents in this project will:

- Auto-trigger the `kadai` skill on planning language
- Be **blocked from editing code outside `.kadai/` and the configured allowlist** unless a story is picked
- Have every edit captured to the picked story's `changelog.md`

## 6. View the roadmap

```bash
kadai serve
```

Opens `http://localhost:<port>` in your browser. Phase swim lanes, epic cards, drill-down to story detail with spec/plan/changelog/tasks tabs.

## Next reads

- [Concepts](concepts.md) — what's an epic vs feature vs story, phases, picked
- [CLI reference](cli-reference.md) — every command + flag
- [Troubleshooting](troubleshooting.md) — common first-run gotchas
